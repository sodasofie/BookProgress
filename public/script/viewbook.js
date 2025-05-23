import { fetchUser } from './global.js';

const genreMap = {
  poetry: 'Вірші / Поезія',
  detective: 'Детектив',
  drama: 'Драма',
  horror: 'Жахи',
  fairy_tale: 'Казка',
  comedy: 'Комедія / Гумор',
  adventure: 'Пригоди',
  novel: 'Роман',
  romance: 'Романтика',
  thriller: 'Трилер',
  sci_fi: 'Фантастика',
  fantasy: 'Фентезі',
  biography: 'Біографія',
  documentary: 'Документалістика',
  history: 'Історія',
  culture: 'Культура',
  art: 'Мистецтво',
  science: 'Наука',
  political_lit: 'Політична література',
  psychology: 'Психологія / Саморозвиток',
  journalism: 'Публіцистика',
  religious_lit: 'Релігійна література',
  philosophy: 'Філософія'
};


document.addEventListener("DOMContentLoaded", async () => {
  await fetchUser();


  const params = new URLSearchParams(window.location.search);
  const from = params.get("from");
  const backLink = document.getElementById("back-to-list");
  if (from === "mybooks" && backLink) {
    backLink.classList.add("visible");
  }


  const id = params.get("id");
  if (!id) {
    alert("Не передано ідентифікатор книги");
    return;
  }

  const res = await fetch(`/books/${id}`, { credentials: "include" });
  if (!res.ok) {
    alert("Книга не знайдена");
    return;
  }
  const book = await res.json();

  document.getElementById("book-cover").style.backgroundImage =
    `url('${book.cover || 'images/placeholder.png'}')`;
  document.getElementById("book-title").textContent = book.title || "-";
  document.getElementById("book-author").textContent = book.author || "-";
  document.getElementById("book-description").textContent = book.description || "-";
  document.getElementById("book-note").textContent = book.note || "-";
  const genres = Array.isArray(book.genre) ? book.genre : [book.genre];
  const displayGenres = genres.map(g => genreMap[g] || g).join(", ");
  document.getElementById("book-genre").textContent = displayGenres || "-";
  document.getElementById("book-pages").textContent = book.pages || "-";


  const ratingContainer = document.getElementById("book-rating");
  ratingContainer.className = "stars"; 
  ratingContainer.innerHTML = `
  ${[1, 2, 3, 4, 5].map(i => i <= book.rating ? '★' : '☆').join('')}
`;


  const statusSpan = document.getElementById("book-status");
  if (book.status === "read") {
    statusSpan.textContent = "Прочитано";
    statusSpan.classList.add("read");
  } else if (book.status === "reading") {
    statusSpan.textContent = "Читається";
    statusSpan.classList.add("reading");
  } else {
    statusSpan.textContent = "Не розпочато";
    statusSpan.classList.add("notStarted");
  }

  document.getElementById("book-start").textContent =
    book.startDate ? book.startDate.slice(0, 10) : "-";
  document.getElementById("book-end").textContent =
    book.endDate ? book.endDate.slice(0, 10) : "-";

  document.getElementById("edit-btn").addEventListener("click", () => {
    window.location.href = `addbook.html?id=${book.id}`;
  });


  document.getElementById("delete-btn").addEventListener("click", async () => {
    if (!confirm("Видалити цю книгу?")) return;
    const del = await fetch(`/books/${book.id}`, {
      method: "DELETE", credentials: "include"
    });
    if (del.ok) window.location.href = "mybooks.html";
    else alert("Не вдалося видалити книгу");
  });
});

