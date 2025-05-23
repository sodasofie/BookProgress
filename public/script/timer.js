let _booksCache = [];  

const STATUS_LABELS = {
    notStarted: "Не почато",
    reading: "Читається",
    read: "Прочитано",
};

async function loadBooks() {
    const res = await fetch("/books", { credentials: "include" });
    if (!res.ok) return;
    const books = await res.json();
    _booksCache = books;

    const sel = document.getElementById("timer-book");
    sel.innerHTML = `<option value="">— без книги —</option>`;
    books.filter(b => b.status !== "read")
        .forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            const label = STATUS_LABELS[b.status] || b.status;
            opt.textContent = `${b.title} (${label})`;
            sel.append(opt);
        });
}

function fmtRemaining(ms) {
    if (ms <= 0) return "закінчився";
    const m = Math.floor(ms / 60000),
        s = String(Math.floor(ms % 60000 / 1000)).padStart(2, "0");
    return `${m}хв ${s}с`;
}

async function refreshTimers() {
    const res = await fetch("/timers", { credentials: "include" });
    if (!res.ok) return;
    let timers = (await res.json()).reverse();

    const list = document.getElementById("timer-list");
    list.innerHTML = "";

    const emptyMsg = document.getElementById("empty-timers");
    if (timers.length === 0) {
        emptyMsg.style.display = "flex";
    } else {
        emptyMsg.style.display = "none";

        timers.forEach(t => {
            const endMs = new Date(t.endTime).getTime();
            const book = _booksCache.find(b => b.id === t.bookId);
            let titleText = t.bookId
                ? `📖 ${book?.title || ("#" + t.bookId)} — ${book?.author || "Автор невідомий"}`
                : "⏰";

            let noteText = t.note ? `Нотатка: ${t.note}` : "";

            const li = document.createElement("li");
            li.innerHTML = `
          <span class="timer-title">${titleText}</span>
          <span class="timer-note">${noteText}</span>
          <span class="remains" data-end="${endMs}"></span>
          <button class="delete-timer" data-id="${t.id}" title="Видалити таймер">🗑️</button>
        `;
            list.append(li);
        });
    }


    list.querySelectorAll(".delete-timer").forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.dataset.id;
            const ok = await showConfirmation("Ви дійсно хочете видалити цей таймер?");
            if (!ok) return;
            await fetch(`/timers/${id}`, {
                method: "DELETE",
                credentials: "include"
            });
            await loadBooks();
            await refreshTimers();
        });
    });
}


function startRemainingUpdater() {
    setInterval(() => {
        document.querySelectorAll("#timer-list .remains").forEach(el => {
            const end = Number(el.dataset.end);
            el.textContent = fmtRemaining(end - Date.now());
        });
    }, 1000);
}

function showConfirmation(message, options = { confirmOnly: false }) {
    return new Promise(resolve => {
        const modal = document.getElementById("confirm-modal"),
            msg = document.getElementById("confirm-message"),
            okBtn = document.getElementById("confirm-ok"),
            noBtn = document.getElementById("confirm-cancel");

        msg.textContent = message;
        modal.classList.remove("hidden");

        if (options.confirmOnly) {
            noBtn.style.display = "none";
            okBtn.textContent = "Гаразд";
        } else {
            noBtn.style.display = "";
            okBtn.textContent = "Так";
        }

        function cleanup(answer) {
            okBtn.removeEventListener("click", onOk);
            noBtn.removeEventListener("click", onNo);
            modal.classList.add("hidden");
            noBtn.style.display = "";
            okBtn.textContent = "Так";
            resolve(answer);
        }
        function onOk() { cleanup(true); }
        function onNo() { cleanup(false); }

        okBtn.addEventListener("click", onOk);
        noBtn.addEventListener("click", onNo);
    });
}



async function handleNotifications() {
    const res = await fetch("/notifications", { credentials: "include" });
    if (!res.ok) return;
    const notes = await res.json();
    for (const n of notes) {
        const isNoteOnly = !n.bookId; 
        const ok = await showConfirmation(n.message, { confirmOnly: isNoteOnly });

        await fetch(`/timers/${n.timerId}/read`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirm: ok })
        });
        await fetch(`/notifications/${n.id}/dismiss`, {
            method: "POST", credentials: "include"
        });
        await loadBooks();
        await refreshTimers();
    }
}

(async function init() {
    await loadBooks();
    await refreshTimers();
    startRemainingUpdater();

    document.getElementById("timer-form")
        .addEventListener("submit", async e => {
            e.preventDefault();
            const bookId = Number(e.target.querySelector("#timer-book").value) || null,
                note = e.target.querySelector("#timer-note").value.trim() || null,
                dur = Number(e.target.querySelector("#timer-duration").value) || 0;
            await fetch("/timers", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bookId, note, duration: dur })
            });
            e.target.reset();
            document.getElementById("timer-duration").value = 30;
            await loadBooks();
            await refreshTimers();
        });

    setInterval(handleNotifications,2000);
    document.getElementById("delete-all-timers")
        .addEventListener("click", async () => {
            const ok = await showConfirmation("Ви дійсно хочете видалити всі таймери?");
            if (!ok) return;

            await fetch("/timers", {
                method: "DELETE",
                credentials: "include"
            });

            await loadBooks();
            await refreshTimers();
        });

})();
