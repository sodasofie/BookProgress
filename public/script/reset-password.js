function validatePassword(pw, oldPw = null) {
  if (pw.length < 8)
    return 'Пароль має бути щонайменше 8 символів.';
  if (!/[a-zа-яёїієґ]/u.test(pw))
    return 'Пароль має містити мінімум одну малу літеру.';
  if (!/[A-ZА-ЯЁЇІЄҐ]/u.test(pw))
    return 'Пароль має містити мінімум одну велику літеру.';
  if (!/\d/.test(pw))
    return 'Пароль має містити мінімум одну цифру.';
  if (!/[\W_]/.test(pw))
    return 'Пароль має містити мінімум один спеціальний символ.';
  if (oldPw !== null && pw === oldPw)
    return 'Новий пароль не може співпадати зі старим.';
  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const input = document.getElementById('new-password');
  const token = new URLSearchParams(window.location.search).get('token');

  input.addEventListener('input', () => {
    input.setCustomValidity('');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const err = validatePassword(input.value);
    if (err) {
      input.setCustomValidity(err);
      input.reportValidity();
      return;
    }

    let data;
    try {
      const res = await fetch('/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: input.value })
      });
      data = await res.json();

      if (!res.ok) {
        input.setCustomValidity(data.message);
        input.reportValidity();
        return;
      }

    } catch (err) {
      console.error(err);
      input.setCustomValidity('Не вдалося зв’язатися із сервером.');
      input.reportValidity();
      return;
    }

    alert('Пароль змінено. Тепер можете увійти!');
    window.location.href = '/index.html';
  });
});


