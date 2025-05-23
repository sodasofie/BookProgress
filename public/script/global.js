const MAX_WIDTH = 512;
const MAX_HEIGHT = 512;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 200;

export function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
                    reject(new Error(`Зображення занадто мале. Мінімум ${MIN_WIDTH}x${MIN_HEIGHT}px.`));
                    return;
                }

                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                    if (width / height > MAX_WIDTH / MAX_HEIGHT) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    } else {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", 0.8));

            };

            img.onerror = () => reject(new Error('Не вдалося завантажити зображення.'));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Не вдалося зчитати файл.'));
        reader.readAsDataURL(file);
    });
}


async function fetchUser() {
    try {
        const res = await fetch("/me", { credentials: "include" });
        if (!res.ok) {
            window.location.href = "../login.html";
            return;
        }
        const data = await res.json();
        showUser(data);
    } catch (error) {
        console.error("Failed to fetch user", error);
        window.location.href = "../login.html";
    }
}

function showUser(user) {
    const nameElem = document.querySelector('.user-info .name');
    const emailElem = document.querySelector('.user-info .email');
    const avatarElem = document.querySelector('.avatar');

    if (nameElem) nameElem.textContent = user.name || "Без імені";
    if (emailElem) emailElem.textContent = user.email || "";

    if (avatarElem) {
        if (user.picture) {
            avatarElem.style.backgroundImage = `url(${user.picture})`;
            avatarElem.style.backgroundSize = "cover";
            avatarElem.style.backgroundPosition = "center";
        } else {
            avatarElem.style.backgroundColor = "#bbb";
        }
    }
}


async function fetchFullUserProfile() {
    try {
        const res = await fetch("/me", { credentials: "include" });
        if (!res.ok) {
            console.error("Не вдалося отримати профіль користувача");
            return;
        }

        const user = await res.json();

        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const birthdayInput = document.getElementById('birthday');
        const profilePicturePreview = document.getElementById('profile-picture-preview');

        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (birthdayInput) birthdayInput.value = user.birthday || '';
        if (profilePicturePreview && user.picture) {
            profilePicturePreview.src = user.picture;
        }
    } catch (error) {
        console.error("Помилка завантаження профілю для редагування", error);
    }
}

import { validateName } from './login.js'; 

async function setupEditProfileForm() {
    const form = document.getElementById('edit-profile-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = document.getElementById('name').value;
        const nameErr = validateName(name);
        if (nameErr) {
          alert(nameErr);
          return;
        }
        const birthday = document.getElementById('birthday').value;
        const fileInput = document.getElementById('profile-picture-input');
        let pictureData = null;
        if (fileInput.files.length > 0) {
            try {
                pictureData = await resizeImage(fileInput.files[0]);
            } catch (error) {
                alert(error.message);
                return;
            }
        }

        const payload = {
            name,
            birthday,
            picture: pictureData
        };

        try {
            const res = await fetch('/profile/update', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                const avatarElem = document.querySelector('.avatar');
                if (avatarElem && data.picture) {
                    avatarElem.style.backgroundImage = `url(${data.picture})`;
                    avatarElem.style.backgroundSize = "cover";
                    avatarElem.style.backgroundPosition = "center";
                }
                alert('Профіль оновлено успішно!');
                await fetchUser();
                window.location.reload();
            } else {
                console.error("Помилка сервера:", data.message);
                alert('Помилка при оновленні профілю.');
            }
        } catch (error) {
            console.error("Помилка запиту", error);
            alert('Помилка при оновленні профілю.');
        }
    });

    const pictureInput = document.getElementById('profile-picture-input');
    if (pictureInput) {
        pictureInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('profile-picture-preview').src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {


    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const menuToggle = document.querySelector('.menu-toggle');
    const alphabet = document.querySelector('.alphabet');
    const themeLink = document.getElementById('theme-style');

    const moonButton = document.getElementById('moon');
    const sunButton = document.getElementById('sun');
    const bwButton = document.getElementById('bw');

    const themeButtons = [moonButton, sunButton, bwButton];


    const savedTheme = localStorage.getItem('selected-theme');
    if (savedTheme) {
        themeLink.setAttribute('href', savedTheme);

        if (savedTheme.includes('dark.css')) {
            setActiveButton(moonButton);
        } else if (savedTheme.includes('light.css')) {
            setActiveButton(sunButton);
        } else if (savedTheme.includes('bw.css')) {
            setActiveButton(bwButton);
        }
    }

    function changeTheme(themePath, activeButton) {
        themeLink.setAttribute('href', themePath);
        localStorage.setItem('selected-theme', themePath);
        setActiveButton(activeButton);
    }

    function setActiveButton(activeButton) {
        themeButtons.forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    }

    moonButton.addEventListener('click', () => {
        changeTheme('style/dark.css', moonButton);
    });

    sunButton.addEventListener('click', () => {
        changeTheme('style/light.css', sunButton);
    });

    bwButton.addEventListener('click', () => {
        changeTheme('style/bw.css', bwButton);
    });

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }


    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });

    window.addEventListener('scroll', () => {
        const scrollTop = window.scrollY;
        if (scrollTop > 50) {
            alphabet.style.opacity = 0.5;
        } else {
            alphabet.style.opacity = 1;
        }
    });

    const delBooksBtn = document.getElementById('delete-books');
  if (delBooksBtn) {
    delBooksBtn.addEventListener('click', async () => {
      if (!confirm('Ви дійсно хочете видалити ВСІ ваші книги?')) return;
      try {
        const res = await fetch('/books', { credentials: 'include' });
        if (!res.ok) throw new Error();
        const books = await res.json();
        await Promise.all(books.map(b =>
          fetch(`/books/${b.id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        ));
        alert('Всі книги успішно видалені.');
      } catch {
        alert('Помилка при видаленні книг.');
      }
    });
  }

  const delAccBtn = document.getElementById('delete-account');
  if (delAccBtn) {
    delAccBtn.addEventListener('click', async () => {
      if (!confirm('Ви дійсно хочете видалити ваш акаунт?')) return;
      try {
        const res = await fetch('/delete', {
          method: 'POST',
          credentials: 'include'
        });
        if (res.ok) {
          alert('Акаунт видалено.');
          window.location.href = '/';
        } else {
          throw new Error();
        }
      } catch {
        alert('Не вдалося видалити акаунт.');
      }
    });
  }

    fetchUser();
    setupEditProfileForm();
    fetchFullUserProfile();
});


function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

export { fetchUser, fetchFullUserProfile, setupEditProfileForm };



