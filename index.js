import express from "express";
import { OAuth2Client } from "google-auth-library";
import { Database } from "bun:sqlite";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();
import { unlink } from "fs/promises";
import nodemailer from "nodemailer";
import crypto from "crypto";

function checkNameServer(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Ім’я має бути непустим рядком.';
  }
  if (name.length > 80) {
    return 'Ім’я має бути не довше 80 символів.';
  }
  if (!/[A-Za-z\u0400-\u04FF]/.test(name)) {
    return 'Ім’я має містити хоча б одну літеру.';
  }
  if (/^[^A-Za-z\u0400-\u04FF]+$/.test(name)) {
    return 'Ім’я не може складатися лише з цифр або лише зі знаків.';
  }
  return null;
}

function checkPasswordServer(pw, oldPw = null) {
  if (typeof pw !== 'string' || pw.length < 8)
    return 'Пароль має бути щонайменше 8 символів.';
  if (!/[a-zа-яёїієґ]/u.test(pw))
    return 'Пароль має містити малу літеру.';
  if (!/[A-ZА-ЯЁЇІЄҐ]/u.test(pw))
    return 'Пароль має містити велику літеру.';
  if (!/\d/.test(pw))
    return 'Пароль має містити цифру.';
  if (!/[\W_]/.test(pw))
    return 'Пароль має містити спеціальний символ.';
  if (oldPw !== null && pw === oldPw)
    return 'Новий пароль не може співпадати зі старим.';
  return null;
}

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: { rejectUnauthorized: false }
});

transporter.verify()
  .then(() => console.log("✔ SMTP ready"))
  .catch(err => console.error("❌ SMTP error", err));


const resetTokens = new Map();
const verificationTokens = new Map();

const app = express();
const db = new Database("users.db");

app.use(express.static("public"));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/public/intro.html");
});
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error("Відсутні змінні середовища Google OAuth.");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

await db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT,
  birthday TEXT,
  picture TEXT,
  provider TEXT DEFAULT 'local',
  emailVerified INTEGER DEFAULT 0
);
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    cover TEXT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    description TEXT,
    note TEXT,
    genre TEXT,
    pages INTEGER,
    status TEXT,
    rating INTEGER,
    startDate TEXT,
    endDate TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    bookId INTEGER,
    note TEXT,
    duration INTEGER NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    isNotified INTEGER DEFAULT 0,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(bookId) REFERENCES books(id)
  );
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    timerId INTEGER NOT NULL,
    message TEXT NOT NULL,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(timerId) REFERENCES timers(id)
  );
`);

function generateCookieOptions() {
  return {
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

app.post("/register", async (req, res) => {
  const { email, password, name, birthday } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Відсутні обов'язкові поля." });
  }
  let err = checkNameServer(name);
  if (err) return res.status(400).json({ message: err });
  err = checkPasswordServer(password);
  if (err) return res.status(400).json({ message: err });

  const exists = db.query(`SELECT 1 FROM users WHERE email = ?`).get(email);
  if (exists) {
    return res.status(409).json({ message: "Електронна пошта вже зареєстрована." });
  }

  const hashed = await bcrypt.hash(password, 10);
  try {
    db.query(`
      INSERT INTO users (email, password, name, birthday, provider)
      VALUES (?, ?, ?, ?, 'local')
    `).run(email, hashed, name, birthday || null);
  } catch (dbErr) {
    console.error("DB error on register:", dbErr);
    return res.status(500).json({ message: "Помилка бази даних." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  verificationTokens.set(token, email);
  setTimeout(() => verificationTokens.delete(token), 24 * 60 * 60 * 1000);

  const verifyUrl = `http://localhost:3000/verify-email?token=${token}`;
  try {
    const info = await transporter.sendMail({
      from: `"BookProgress" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Підтвердження email",
      text: `Щоб підтвердити пошту, перейдіть за посиланням:\n\n${verifyUrl}`
    });
    console.log("Confirmation email sent:", info.messageId);
  } catch (mailErr) {
    console.error("Error sending confirmation email:", mailErr);
    return res
      .status(500)
      .json({ message: "Не вдалося відправити листа підтвердження." });
  }

  res.json({ message: "Реєстрація успішна! Лист підтвердження надіслано." });
});

app.get("/verify-email", (req, res) => {
  const { token } = req.query;
  const email = verificationTokens.get(token);
  if (!email) {
    return res
      .status(400)
      .send("<h1>Невірний або прострочений токен</h1>");
  }
  db.query(`UPDATE users SET emailVerified = 1 WHERE email = ?`).run(email);
  verificationTokens.delete(token);
  res.send("<h1>Email підтверджено! Тепер можете увійти.</h1>");
});


app.post("/login", async (req, res) => {
  console.log("BODY:", req.body);
  const { email, password } = req.body;

  const user = db.query(`SELECT * FROM users WHERE email = ?`).get(email);

  if (!user) {
    return res.status(401).json({ message: "Недійсні облікові дані." });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: "Недійсні облікові дані." });
  }


  res.cookie("token", email, generateCookieOptions());
  res.json({ message: "Вхід успішний!" });
});

app.get("/auth/google", (req, res) => {
  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["email", "profile"],
    redirect_uri: GOOGLE_REDIRECT_URI
  });
  res.redirect(url);
});

// Google OAuth логін
app.post("/auth/google/login", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(401).json({ message: "Неавторизовано" });

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    }).then(r => r.json());

    if (!tokenRes.id_token) {
      console.error("No id_token:", tokenRes);
      return res.status(500).json({ message: "Не отримали ID токен" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: tokenRes.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const { email, name, picture } = ticket.getPayload();

    const existingUser = db
      .query(`SELECT * FROM users WHERE email = ?`)
      .get(email);

    if (!existingUser) {
      const randomPass = crypto.randomBytes(16).toString("hex");
      const hashed = await bcrypt.hash(randomPass, 10);

      db.query(`
        INSERT INTO users (email, password, name, picture, provider)
        VALUES (?, ?, ?, ?, 'google')
      `).run(email, hashed, name, picture);

    } else if (!existingUser.password) {
      const randomPass = crypto.randomBytes(16).toString("hex");
      const hashed = await bcrypt.hash(randomPass, 10);

      db.query(`
        UPDATE users
        SET password = ?
        WHERE email = ?
      `).run(hashed, email);
    }

    res.cookie("token", email, generateCookieOptions());
    res.json({ message: "Вхід завдяки Google успішний" });

  } catch (err) {
    console.error("OAuth Error:", err);
    res.status(500).json({ message: "Помилка Google OAuth" });
  }
});


function isAuthenticated(req, res, next) {
  const email = req.cookies.token;

  if (!email) {
    return res.status(401).json({ message: "Не автентифіковано" });
  }

  const user = db.query(`SELECT * FROM users WHERE email = ?`).get(email);

  if (!user) {
    return res.status(401).json({ message: "Недійсний користувач" });
  }

  req.user = user;
  next();
}


app.get("/me", isAuthenticated, (req, res) => {
  const { id, email, name, birthday, picture, provider } = req.user;
  res.json({ id, email, name, birthday, picture, provider });
});

app.post("/timers", isAuthenticated, (req, res) => {
  const { bookId, note, duration } = req.body;
  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + duration * 60000).toISOString();
  const result = db.query(`
    INSERT INTO timers (userId, bookId, note, duration, startTime, endTime)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, bookId || null, note || null, duration, startTime, endTime);
  scheduleTimer(result.lastInsertRowid);
  res.json({ message: "Таймер запущено", timerId: result.lastInsertRowid });
});

app.get("/timers", isAuthenticated, (req, res) => {
  const rows = db.query("SELECT * FROM timers WHERE userId = ?").all(req.user.id);
  res.json(rows);
});

app.post("/timers/:id/read", isAuthenticated, (req, res) => {
  const timerId = Number(req.params.id);
  const { confirm } = req.body;
  db.query("UPDATE timers SET isNotified = 1 WHERE id = ?").run(timerId);

  const timer = db.query("SELECT * FROM timers WHERE id = ?").get(timerId);
  if (!timer) return res.status(404).json({ message: "Таймер не знайдено" });

  if (timer.bookId && confirm) {
    db.query(`
      UPDATE books
      SET status = 'read',
          endDate = ?
      WHERE id = ?
    `).run(timer.endTime, timer.bookId);
  }

  res.json({ message: "Дякую за підтвердження!", confirmed: !!confirm });
});

// Видалити таймер
app.delete("/timers/:id", isAuthenticated, (req, res) => {
  const timerId = Number(req.params.id);
  const exists = db.query(
    "SELECT COUNT(*) as cnt FROM timers WHERE id = ? AND userId = ?"
  ).get(timerId, req.user.id).cnt;
  if (!exists) {
    return res.status(404).json({ message: "Таймер не знайдено" });
  }
  db.query("DELETE FROM timers WHERE id = ?").run(timerId);
  res.json({ success: true });
});
app.delete("/timers", isAuthenticated, (req, res) => {
  db.query("DELETE FROM timers WHERE userId = ?").run(req.user.id);
  res.json({ success: true });
});


app.get("/notifications", isAuthenticated, (req, res) => {
  const notes = db.query(`
    SELECT n.*, t.bookId
    FROM notifications n
    LEFT JOIN timers t ON t.id = n.timerId
    WHERE n.userId = ? AND n.isRead = 0
  `).all(req.user.id);

  res.json(notes);
});


app.post("/notifications/:id/dismiss", isAuthenticated, (req, res) => {
  db.query("UPDATE notifications SET isRead = 1 WHERE id = ?").run(Number(req.params.id));
  res.json({ message: "Сповіщення приховано" });
});


function checkNameServer(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Ім’я має бути непустим рядком.';
  }
  if (name.length > 80) {
    return 'Ім’я має бути не довше 80 символів.';
  }
  if (!/[A-Za-z\u0400-\u04FF]/.test(name)) {
    return 'Ім’я має містити хоча б одну літеру.';
  }
  if (/^[^A-Za-z\u0400-\u04FF]+$/.test(name)) {
    return 'Ім’я не може складатися лише з цифр або лише зі знаків.';
  }
  return null;
}

app.post("/profile/update", isAuthenticated, async (req, res) => {
  try {
    const { name, birthday, picture } = req.body;

    const nameErr = checkNameServer(name);
    if (nameErr) {
      return res.status(400).json({ message: nameErr });
    }

    if (!birthday) {
      return res.status(400).json({ message: "Відсутні поля." });
    }

    let picturePath = req.user.picture;
    let newPicturePath = null;

    if (picture && picture.startsWith("data:image/")) {
      const base64Data = picture.split(",")[1];
      const extension = picture.split(";")[0].split("/")[1];
      const fileName = `uploads/profile_${Date.now()}.${extension}`;

      await Bun.write(`public/${fileName}`, Buffer.from(base64Data, "base64"));
      newPicturePath = `/${fileName}`;


      if (picturePath && picturePath.startsWith("/uploads/")) {
        try {
          await unlink(`public${picturePath}`);
        } catch (err) {
          console.warn("Не вдалося видалити старе зображення профілю:", err.message);
        }
      }

      picturePath = newPicturePath;
    }

    db.query(
      `UPDATE users SET name = ?, birthday = ?, picture = ? WHERE email = ?`
    ).run(name, birthday, picturePath, req.user.email);

    res.json({ message: "Профіль оновлено!", picture: picturePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Помилка при оновленні профілю." });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Ви вийшли з системи" });
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = db.query(`SELECT * FROM users WHERE email = ?`).get(email);

  if (!user) return res.json({ message: "Ми надіслали посилання для створення нового паролю вам на електронну адресу." });

  const token = crypto.randomBytes(32).toString("hex");
  resetTokens.set(token, email);
  setTimeout(() => resetTokens.delete(token), 1000 * 60 * 15);

  const resetUrl = `http://localhost:3000/reset-password.html?token=${token}`;
  try {
    const info = await transporter.sendMail({
      from: `"BookProgress" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Скидання паролю",
      text: `Щоб створити новий пароль, перейдіть за посиланням:\n\n${resetUrl}`
    });
    console.log("→ Reset password email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Error sending reset-password email:", err);
  }

  res.json({ message: "Ми надіслали посилання для створення нового паролю вам на електронну адресу." });
});

app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  const email = resetTokens.get(token);
  if (!email) {
    return res.status(400).json({ message: "Недійсний або прострочений токен." });
  }

  const err = checkPasswordServer(newPassword);
  if (err) {
    return res.status(400).json({ message: err });
  }

  const user = db.query(`SELECT * FROM users WHERE email = ?`).get(email);
  if (!user) {
    return res.status(400).json({ message: "Користувача не знайдено." });
  }

  if (user.password) {
    const same = await bcrypt.compare(newPassword, user.password);
    if (same) {
      return res.status(400).json({ message: "Новий пароль не може бути використаним раніше" });
    }
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  db.query(`UPDATE users SET password = ? WHERE email = ?`).run(hashed, email);
  resetTokens.delete(token);

  res.json({ message: "Пароль змінено." });
});


app.post("/books", isAuthenticated, (req, res) => {
  const {
    cover, title, author,
    description, note,
    genre, pages,
    status, rating,
    startDate, endDate
  } = req.body;

  if (!title || !author || !status) {
    return res.status(400).json({ message: "Необхідні поля (назва, автор, статус) не заповнені." });
  }

  const genreStr = Array.isArray(genre) ? JSON.stringify(genre) : (genre || null);

  const result = db.query(`
    INSERT INTO books
      (userId, cover, title, author, description, note, genre, pages, status, rating, startDate, endDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    cover || null,
    title, author,
    description || null,
    note || null,
    genreStr,
    pages || null,
    status,
    rating || 0,
    startDate || null,
    endDate || null
  );

  res.json({ message: "Книгу додано", bookId: result.lastInsertRowid });
});


app.get('/check-book', isAuthenticated, (req, res) => {
  const { title, author, id } = req.query;
  const userId = req.user.id;

  if (!title || !author) {
    return res.status(400).json({ exists: false });
  }

  const trimmedTitle = title.trim().toLowerCase();
  const trimmedAuthor = author.trim().toLowerCase();

  const rows = db.prepare(`
    SELECT id FROM books
    WHERE userId = ? AND LOWER(title) = ? AND LOWER(author) = ?
  `).all(userId, trimmedTitle, trimmedAuthor);

  const isDuplicate = rows.some(row => row.id.toString() !== (id || "").toString());

  res.json({ exists: isDuplicate });
});





app.get("/books/:id", isAuthenticated, (req, res) => {
  const id = Number(req.params.id);
  const row = db.query(`SELECT * FROM books WHERE id = ? AND userId = ?`)
    .get(id, req.user.id);
  if (!row) return res.status(404).json({ message: "Не знайдено" });
  row.genre = row.genre ? JSON.parse(row.genre) : [];
  res.json(row);
});


app.put("/books/:id", isAuthenticated, async (req, res) => {
  const id = Number(req.params.id);
  const { cover, title, author, description, note, genre, pages, status, rating, startDate, endDate } = req.body;
  const genreStr = Array.isArray(genre) ? JSON.stringify(genre) : null;
  await db.query(`
    UPDATE books
    SET cover=?, title=?, author=?, description=?, note=?,
        genre=?, pages=?, status=?, rating=?, startDate=?, endDate=?
    WHERE id=? AND userId=?
  `).run(
    cover, title, author, description, note,
    genreStr, pages, status, rating, startDate, endDate,
    id, req.user.id
  );
  res.json({ message: "Оновлено" });
});


app.delete('/books/:id', isAuthenticated, (req, res) => {
  const bookId = Number(req.params.id);
  const userId = req.user.id;

  try {
    const result = db.run(
      `DELETE FROM books WHERE id = ? AND userId = ?`,
      [bookId, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Книга не знайдена" });
    }

    res.sendStatus(204);
  } catch (err) {
    console.error('DB DELETE error:', err);
    res.status(500).json({ message: "Не вдалося видалити книгу" });
  }
});


app.get("/books", isAuthenticated, (req, res) => {
  const rows = db.query(`
    SELECT * FROM books WHERE userId = ?
  `).all(req.user.id);


  const books = rows.map(b => ({
    ...b,
    genre: b.genre ? JSON.parse(b.genre) : []
  }));
  res.json(books);
});

app.post("/delete", isAuthenticated, async (req, res) => {
  try {
    const user = req.user;


    if (user.picture && user.picture.startsWith("/uploads/")) {
      try {
        await unlink(`public${user.picture}`);
      } catch (err) {
        console.warn("Не вдалося видалити зображення профілю при видаленні акаунта:", err.message);
      }
    }

    db.query(`DELETE FROM users WHERE email = ?`).run(user.email);
    res.clearCookie("token");
    res.json({ message: "Акаунт видалено" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Помилка при видаленні акаунта." });
  }
});

app.get("/stats", isAuthenticated, (req, res) => {
  const books = db.query(`SELECT * FROM books WHERE userId = ?`).all(req.user.id);

  const stats = {
    read: 0,
    reading: 0,
    notStarted: 0,
    totalHours: 0,
    months: {},
    genres: {}
  };

  const monthNames = [
    "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
    "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
  ];

  for (const book of books) {
    const pages = book.pages || 0;


    if (book.status === "read") stats.read++;
    else if (book.status === "reading") stats.reading++;
    else stats.notStarted++;


    if (
      book.status === "read" &&
      book.startDate &&
      book.endDate &&
      new Date(book.endDate) > new Date(book.startDate)
    ) {
      const start = new Date(book.startDate);
      const end = new Date(book.endDate);
      const hours = (end - start) / (1000 * 60 * 60);

      stats.totalHours += hours;
    }

    if (book.startDate && book.endDate) {
      const start = new Date(book.startDate);
      const end = new Date(book.endDate);
      const totalMs = end - start;

      if (totalMs > 0) {
        const hourMs = 1000 * 60 * 60;
        const totalHours = Math.ceil(totalMs / hourMs);

        const hourlyDistribution = {};

        for (let t = +start; t < +end; t += hourMs) {
          const hour = new Date(t);
          const year = hour.getFullYear();
          const month = monthNames[hour.getMonth()].slice(0, 3); 
          const key = `${year}-${month}`;

          if (!hourlyDistribution[key]) hourlyDistribution[key] = 0;
          hourlyDistribution[key] += 1;
        }

        
        for (const key in hourlyDistribution) {
          const portion = hourlyDistribution[key] / totalHours;
          if (!stats.months[key]) stats.months[key] = 0;
          stats.months[key] += pages * portion;
        }
      }
    }

    if (book.genre) {
      let genreValue = book.genre;

      try {
        const parsed = JSON.parse(book.genre);
        if (Array.isArray(parsed)) genreValue = parsed[0];
      } catch (e) { }

      if (genreValue && typeof genreValue === "string" && genreValue.trim() !== "") {
        if (!stats.genres[genreValue]) stats.genres[genreValue] = 0;
        stats.genres[genreValue]++;
      }
    }
  }

  res.json(stats);
});

function scheduleTimer(timerId) {
  const timer = db.query("SELECT * FROM timers WHERE id = ? AND isNotified = 0").get(timerId);
  if (!timer) return;
  const ms = new Date(timer.endTime) - new Date();
  if (ms <= 0) return handleExpiration(timer);
  setTimeout(() => handleExpiration(timer), ms);
}

async function handleExpiration(timer) {
  db.query("UPDATE timers SET isNotified = 1 WHERE id = ?").run(timer.id);
  const user = db.query("SELECT email FROM users WHERE id = ?").get(timer.userId);
  let subject, text;
  if (timer.bookId) {
    const book = db.query(
      "SELECT title, author FROM books WHERE id = ?"
    ).get(timer.bookId);

    const notePart = timer.note ? `\nНотатка: ${timer.note}` : "";

    subject = `Ваш таймер для книги "${book.title}" сплив.`;
    text = [
      "Вітаємо!",
      "Ваш таймер для книги сплив.",
      "",
      "Ваша книга:",
      `  "${book.title}" - ${book.author || "(невідомий)"}` + notePart,
      "",
      "Чи прочитали ви цю книгу за встановлений час?",
      "Пітвердіть прочитання: http://localhost:3000/timer.html"
    ].join("\n");
  } else {
    subject = `Ваш таймер сплив.`;
    text = [
      "Вітаємо!",
      "Ваш таймер сплив.",
      "",
      `Ваш таймер:`,
      `Нотатка: "${timer.note || ""}"`,
      "",
      "Не забувайте за свій таймер!",
      "Ваші таймери: http://localhost:3000/timer.html"
    ].join("\n");
  }

  await transporter.sendMail({
    from: `"BookProgress" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject,
    text
  });

  const book = timer.bookId
    ? db.query("SELECT title, author FROM books WHERE id = ?")
      .get(timer.bookId)
    : null;

  const notePart = timer.note ? ` Нотатка: ${timer.note}` : "";

  const inAppMessage = timer.bookId
    ? `Таймер для книги "${book.title}" — ${book.author || "(невідомий)"}, сплив.` +
    `${notePart}` +
    ` Ви прочитали книгу?`
    : `Ваш нотатковий таймер сплив.${notePart}`;


  db.query(`
    INSERT INTO notifications (userId, timerId, message, createdAt)
    VALUES (?, ?, ?, ?)
  `).run(
    timer.userId,
    timer.id,
    inAppMessage,
    new Date().toISOString()
  );

  if (timer.bookId) {
    const bookState = db.query(
      "SELECT status FROM books WHERE id = ?"
    ).get(timer.bookId);
    if (bookState.status === "notStarted") {
      db.query(
        "UPDATE books SET status = 'reading', startDate = ? WHERE id = ?"
      ).run(timer.startTime, timer.bookId);
    }
  }
}

const pendingTimers = db.query("SELECT id FROM timers WHERE isNotified = 0").all();
pendingTimers.forEach(t => scheduleTimer(t.id));


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});