import { fetchUser } from './global.js';

function createBookCard(book) {
  const div = document.createElement('div');
  div.className = 'book-card';
  div.dataset.id = book.id;
  div.innerHTML = `
    <div class="cover" style="background-image: url('${book.cover || 'images/placeholder.png'}')"></div>
    <div class="info">
      <h3 class="title">${book.title}</h3>
      <p class="author">${book.author}</p>
      <div class="stars">
        ${[1, 2, 3, 4, 5].map(i => i <= book.rating ? '★' : '☆').join('')}
      </div>
      <div class="status ${book.status}">
        ${book.status === 'read' ? 'Прочитано'
      : book.status === 'reading' ? 'Читається'
        : 'Не розпочато'}
      </div>
    </div>
  `;
  div.addEventListener('click', () => {
    window.location.href = `viewbook.html?id=${book.id}&from=mybooks`;
  });
  return div;
}

function groupByLetter(books) {
  return books.reduce((groups, book) => {
    const letter = book.title.charAt(0).toUpperCase();
    (groups[letter] = groups[letter] || []).push(book);
    return groups;
  }, {});
}

function renderBooks(books) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';
  books.sort((a, b) => a.title.localeCompare(b.title, 'uk', { sensitivity: 'base' }));

  const groups = groupByLetter(books);

  Object.keys(groups)
    .sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }))
    .forEach(letter => {
      const section = document.createElement('div');
      section.className = 'book-group';
      section.innerHTML = `
      <h2 class="group-letter" id="letter-${letter}">${letter}</h2>
      <hr>
      <div class="cards"></div>
    `;
      const cardsContainer = section.querySelector('.cards');
      groups[letter].forEach(book =>
        cardsContainer.appendChild(createBookCard(book))
      );
      container.appendChild(section);
    });

}

async function loadAndRender() {
  const res = await fetch('/books', { credentials: 'include' });
  if (!res.ok) {
    console.error('Не вдалося завантажити книги');
    return;
  }

  const books = await res.json();

  const booksSection = document.querySelector('.book-list');
  const emptyState = document.getElementById('empty-books');
  const searchInput = document.getElementById('search');

  if (books.length === 0) {
    booksSection.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  booksSection.style.display = '';
  emptyState.style.display = 'none';


  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = books.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q)
    );
    renderBooks(filtered);
  });

  renderBooks(books);
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const viewId = params.get('view');
  if (viewId) {
    window.location.replace(`viewbook.html?id=${viewId}`);
  }

  await fetchUser();
  await loadAndRender();


  document.querySelectorAll('.alphabet li').forEach(li => {
    li.addEventListener('click', () => {
      const target = document.getElementById(`letter-${li.textContent.toUpperCase()}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
});

