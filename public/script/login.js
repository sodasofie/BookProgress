export function validateName(name) {
  if (name.length > 80) {
    return 'Ім’я має бути не довше 80 символів.';
  }
  const hasLetter = /[A-Za-z\u0400-\u04FF]/.test(name);
  if (!hasLetter) {
    return 'Ім’я має містити хоча б одну літеру.';
  }
  const onlyNonLetters = /^[^A-Za-z\u0400-\u04FF]+$/.test(name);
  if (onlyNonLetters) {
    return 'Ім’я не може складатися лише з цифр або лише зі знаками.';
  }

  return null;
}

export function validatePassword(pw, oldPw = null) {
  if (pw.length < 8)
    return 'Пароль має бути щонайменше 8 символів.';
  if (!/[a-zа-яёїієґ]/u.test(pw))
    return 'Пароль повинен містити мінімум одну малу літеру.';
  if (!/[A-ZА-ЯЁЇІЄҐ]/u.test(pw))
    return 'Пароль повинен містити мінімум одну велику літеру.';
  if (!/\d/.test(pw))
    return 'Пароль повинен містити мінімум одну цифру.';
  if (!/[\W_]/.test(pw))
    return 'Пароль повинен містити мінімум один спеціальний символ.';
  if (oldPw !== null && pw === oldPw)
    return 'Новий пароль не повинен збігатися зі старим.';
  return null;
}

function googleLogin() {
  window.location.href = '/auth/google';
}

function showNativeError(inputEl, message) {
  inputEl.setCustomValidity(message);
  inputEl.reportValidity();
}

function clearNativeError(inputEl) {
  inputEl.setCustomValidity('');
}


async function sendResetEmail(email) {
  if (!email) {
    alert('Введіть email!');
    return;
  }
  try {
    const res = await fetch('/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    alert(data.message);
  } catch (err) {
    console.error(err);
    alert('Помилка при надсиланні листа');
  }
}

async function handleGoogleRedirect() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;
  try {
    const res = await fetch('/auth/google/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '../mybooks.html';
    } else {
      alert(data.message || 'Помилка Google-логіну');
    }
  } catch (err) {
    console.error(err);
    alert('Помилка при авторизації Google');
  }
}

function showError(inputEl, message) {
  clearError(inputEl);
  const err = document.createElement('div');
  err.className = 'error-message';
  err.textContent = message;
  inputEl.parentNode.insertBefore(err, inputEl.nextSibling);
}

function clearError(inputEl) {
  const next = inputEl.nextElementSibling;
  if (next && next.classList.contains('error-message')) {
    next.remove();
  }
}

document.addEventListener('DOMContentLoaded', () => {

  ['register-name', 'register-email', 'register-password', 'register-confirm', 'register-birthday']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => clearNativeError(el));
      }
    });

  if (window.location.pathname.includes('editacc.html')) {
    fetch('/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(user => {
        document.getElementById('name').value = user.name || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('birthday').value = user.birthday || '';
        document.querySelector('.user-info .name').textContent = user.name || '';
        document.querySelector('.user-info .email').textContent = user.email || '';
        const avatar = document.querySelector('.sidebar .avatar');
        if (user.picture) {
          avatar.style.backgroundImage = `url(${user.picture})`;
          avatar.textContent = '';
        } else {
          avatar.style.backgroundImage = '';
          avatar.style.backgroundColor = '#a7919f';
          const nameFirstChar = user.name?.[0] || '';
          avatar.textContent = /[a-zа-яёіїєґ]/i.test(nameFirstChar) ? nameFirstChar.toUpperCase() : '';
        }

        const preview = document.getElementById('profile-picture-preview');
        if (user.picture) preview.src = user.picture;
      })
      .catch(() => alert('Не вдалося завантажити дані користувача'));
  }

  const avatarBlock = document.querySelector(".edit-avatar-block");
  if (avatarBlock) {
    avatarBlock.addEventListener("click", () => {
      document.getElementById("profile-picture-input").click();
    });
  }



  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (registerForm) {
    registerForm.addEventListener('submit', e => {
      const bd = document.getElementById('register-birthday').value;
      if (bd > '2019-12-31') {
        alert('Дата народження не може бути пізнішою за 2019-12-31.');
        e.preventDefault();
      }
    });
  }

  const showRegister = document.getElementById('show-register');
  if (showRegister) {
    showRegister.addEventListener('click', e => {
      e.preventDefault();
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
    });
  }

  const showLogin = document.getElementById('show-login');
  if (showLogin) {
    showLogin.addEventListener('click', e => {
      e.preventDefault();
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
    });
  }


  handleGoogleRedirect();
  const googleBtn = document.getElementById('google-login-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', e => {
      e.preventDefault();   
      googleLogin();
    });
  }


  const forgotBtns = document.querySelectorAll('#forgot-password-link');
  forgotBtns.forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();

      const email =
        document.getElementById('login-email')?.value.trim() ||
        document.getElementById('email')?.value.trim();
      if (!email) {
        alert('Введіть, будь ласка, email!');
        return;
      }

      const msgEl = document.getElementById('reset-message');
      if (!msgEl) return;

      try {
        const res = await fetch('/forgot-password', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const { message } = await res.json();

        msgEl.textContent = message;
        msgEl.classList.add('visible');

        setTimeout(() => {
          msgEl.classList.remove('visible');
          setTimeout(() => {
            msgEl.textContent = '';
          }, 500); 
        }, 5000);


      } catch (err) {
        console.error(err);
        msgEl.textContent = 'Помилка при надсиланні листа';
        requestAnimationFrame(() => msgEl.classList.add('visible'));
        setTimeout(() => {
          msgEl.classList.remove('visible');
        }, 8000);
      }
    });
  });


  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    const emailEl = document.getElementById('login-email');
    const pwEl = document.getElementById('login-password');

    loginBtn.addEventListener('click', async e => {
      e.preventDefault();
      clearNativeError(emailEl);
      clearNativeError(pwEl);

      const email = emailEl.value.trim();
      const password = pwEl.value;

      try {
        const res = await fetch('/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (res.ok) {
          window.location.href = 'mybooks.html';
        } else {
          showNativeError(emailEl, data.message || 'Недійсні облікові дані');
        }
      } catch (err) {
        showNativeError(emailEl, 'Помилка сервера');
      }
    });
  }

  const registerBtn = document.getElementById('register-btn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('register-name');
      const emailInput = document.getElementById('register-email');
      const passwordInput = document.getElementById('register-password');
      const confirmInput = document.getElementById('register-confirm');
      const birthdayInput = document.getElementById('register-birthday');

      let err = validateName(nameInput.value.trim());
      if (err) {
        showNativeError(nameInput, err);
        return;
      }

      if (passwordInput.value !== confirmInput.value) {
        showNativeError(confirmInput, 'Паролі не співпадають!');
        return;
      }

      err = validatePassword(passwordInput.value);
      if (err) {
        showNativeError(passwordInput, err);
        return;
      }

      try {
        const res = await fetch('/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            email: emailInput.value,
            password: passwordInput.value,
            birthday: birthdayInput.value
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          showNativeError(emailInput, data.message);
        } else {
          window.location.href = '../mybooks.html';
        }
      } catch {
        showNativeError(emailInput, 'Помилка сервера');
      }
    });
  }
  const g1 = document.getElementById('google-login-btn');
  if (g1) {
    g1.addEventListener('click', e => {
      e.preventDefault();
      googleLogin();
    });
  }
  const g2 = document.getElementById('google-login-btn2');
  if (g2) {
    g2.addEventListener('click', e => {
      e.preventDefault();
      googleLogin();
    });
  }

});

