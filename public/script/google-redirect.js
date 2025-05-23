(async function handleGoogleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    try {
      const res = await fetch('/auth/google/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        credentials: 'include'
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = 'mybooks.html';
      } else {
        alert(data.message || 'Помилка Google логіну');
        window.location.href = 'login.html';
      }
    } catch (error) {
      console.error(error);
      alert('Помилка при авторизації Google');
      window.location.href = 'login.html';
    }
  } else {
    alert('Не передано код авторизації.');
    window.location.href = 'login.html';
  }
})();
