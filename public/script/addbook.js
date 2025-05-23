import { resizeImage, fetchUser } from "./global.js";

function getBookId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const viewId = params.get("view");
  if (viewId) {
    window.location.replace(`viewbook.html?id=${viewId}`);
    return;
  }

  await fetchUser();


  const bookId = getBookId();
  const form = document.getElementById("add-book-form");
  const statusHiddenInput = document.getElementById('status-hidden')
  const coverInput = document.getElementById("cover");
  const coverPreview = document.getElementById("cover-preview");
  const titleInput = document.getElementById("title");
  const authorInput = document.getElementById("author");
  const descriptionInput = document.getElementById("description");
  const noteInput = document.getElementById("note");
  const genreSelect = document.getElementById("genre");
  const pagesInput = document.getElementById("pages");
  const statusBtns = document.querySelectorAll(".status-btn");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const stars = document.querySelectorAll(".star");
  const saveBtn = form.querySelector("button[type='submit']");
  const warningEl = document.getElementById('duplicate-warning');

  let currentRating = 0;


  function getLocalDateTimeString() {
    const now = new Date();
    now.setSeconds(0, 0);
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  function updateDateLimits() {
    const now = getLocalDateTimeString();
    startDateInput.max = now;
    endDateInput.max = now;
  }
  updateDateLimits();

  form.addEventListener("submit", async (e) => {
    updateDateLimits();
  });



  let isDuplicate = false;

  async function checkDuplicateBook() {
    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    if (!title || !author) return;

    try {
      const res = await fetch(`/check-book?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}${bookId ? `&id=${bookId}` : ''}`, {
        credentials: 'include',
      });

      const data = await res.json();
      isDuplicate = data.exists;

      if (isDuplicate) {
        warningEl.textContent = 'У вас уже є така книга в бібліотеці!';
        warningEl.style.display = 'block';
      } else {
        warningEl.textContent = '';
        warningEl.style.display = 'none';
      }
    } catch (err) {
      console.error('Помилка перевірки книги', err);
    }
  }


  titleInput.addEventListener('input', checkDuplicateBook);
  authorInput.addEventListener('input', checkDuplicateBook);


  if (bookId) {
    document.querySelector(".menu-btn[href='mybooks.html']")?.classList.add("active");
    document.querySelector(".menu-btn[href='addbook.html']")?.classList.remove("active");
    document.getElementById("form-title").textContent = "Редагувати книгу";
    saveBtn.textContent = "Зберегти зміни";
    const backLink = document.getElementById("back-to-view");
    if (bookId && backLink) {
      backLink.href = `viewbook.html?id=${bookId}&from=mybooks`;
      backLink.style.display = "inline-block";
    } else if (backLink) {
      backLink.style.display = "none";
    }






    try {
      const res = await fetch(`/books/${bookId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Не вдалося завантажити книгу");
      const book = await res.json();

      if (book.cover) {
        coverPreview.src = book.cover;
        coverPreview.closest(".cover-upload").classList.add("has-image");
      }
      titleInput.value = book.title;
      authorInput.value = book.author;
      descriptionInput.value = book.description || "";
      noteInput.value = book.note || "";
      pagesInput.value = book.pages || "";

      Array.from(genreSelect.options).forEach((opt) => {
        opt.selected = book.genre.includes(opt.value);
      });

      currentRating = book.rating || 0;
      stars.forEach((star) => {
        const val = +star.dataset.value;
        star.textContent = val <= currentRating ? "★" : "☆";
      });

      statusBtns.forEach((btn) => {
        if (btn.dataset.value === book.status) btn.classList.add("active");
        statusHiddenInput.value = book.status;
      });



      if (book.startDate) startDateInput.value = book.startDate.slice(0, 16);
      if (book.endDate) endDateInput.value = book.endDate.slice(0, 16);
      toggleDateInputs(book.status);
    } catch (err) {
      alert(err.message);
      return;
    }

    titleInput.placeholder = "Редагувати назву книги";
    authorInput.placeholder = "Редагувати автора книги";
    descriptionInput.placeholder = "Редагувати опис книги";
    noteInput.placeholder = "Редагувати нотатку";


  } else {
    saveBtn.textContent = "Зберегти книгу";
  }

  coverInput.addEventListener("change", () => {
    const file = coverInput.files[0];
    const wrapper = coverInput.closest(".cover-upload");

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        coverPreview.src = e.target.result;
        wrapper.classList.add("has-image");
      };
      reader.readAsDataURL(file);
    } else {
      coverPreview.src = "";
      wrapper.classList.remove("has-image");
    }
  });

  stars.forEach((star) => {
    star.addEventListener("click", () => {
      currentRating = +star.dataset.value;
      stars.forEach((s) => {
        s.textContent = +s.dataset.value <= currentRating ? "★" : "☆";
      });
    });
  });

  toggleDateInputs("");


  statusBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      statusBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      statusHiddenInput.value = btn.dataset.value;
      toggleDateInputs(btn.dataset.value);
    });
  });


  function toggleDateInputs(status) {
    startDateInput.disabled = !(status === "reading" || status === "read");
    endDateInput.disabled = status !== "read";
  }

  form.addEventListener("submit", async (e) => {
    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const statusValue = statusHiddenInput.value;
    if (!form.checkValidity()) {
      if (!statusValue) {
        statusHiddenInput.reportValidity();
      }
      e.preventDefault();
      return;
    }

    e.preventDefault();

    const start = startDateInput.value;
    const end = endDateInput.value;
    const now = getLocalDateTimeString();

    if ((start && start > now) || (end && end > now)) {
      alert("Дати не можуть бути в майбутньому.");
      return;
    }

    if (start && end && start === end) {
      alert('Початок і кінець читання не можуть співпадати.');
      return;
    }

    if (start && end && start > end) {
      alert('Дата початку читання повинна бути раніше дати закінчення.');
      return;
    }


    try {
      const res = await fetch(`/check-book?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}${bookId ? `&id=${bookId}` : ''}`, {
        credentials: 'include',
      });

      const data = await res.json();
      if (data.exists) {
        warningEl.textContent = 'У вас уже є така книга в бібліотеці!';
        warningEl.style.display = 'block';
        return;
      }
    } catch (err) {
      alert("Не вдалося перевірити книгу");
      return;
    }


    let coverData = coverPreview.src || null;
    if (coverInput.files.length) {
      try {
        coverData = await resizeImage(coverInput.files[0]);
      } catch (err) {
        alert(err.message);
        return;
      }
    }

    const payload = {
      cover: coverData,
      title,
      author,
      description: descriptionInput.value.trim() || null,
      note: noteInput.value.trim() || null,
      genre: Array.from(genreSelect.selectedOptions).map((o) => o.value),
      pages: pagesInput.value ? parseInt(pagesInput.value, 10) : null,
      rating: currentRating,
      status: statusValue,
      startDate: startDateInput.value || null,
      endDate: endDateInput.value || null,
    };

    try {
      const res = await fetch(bookId ? `/books/${bookId}` : "/books", {
        method: bookId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Помилка при збереженні");

      alert(bookId ? "Книгу оновлено!" : "Книгу додано!");
      if (bookId) {
        window.location.href = `viewbook.html?id=${bookId}&from=mybooks`;
      } else {
        window.location.href = "mybooks.html";
      }

    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });


});
