/**
 * Infinity Notes Premium - Renderer Process
 */

let allNotes = [];
let currentUser = null;
let activeNoteName = null;
let zenMode = false;
let previewHidden = false;
let selectedAdminUser = null;

// DOM
const notesListEl = document.getElementById('notes-list');
const noteTitleInput = document.getElementById('note-title');
const markdownInput = document.getElementById('markdown-input');
const markdownPreview = document.getElementById('markdown-preview');
const searchInput = document.getElementById('search-input');
const saveStatus = document.getElementById('save-status');
const appRoot = document.getElementById('app-root');

// --- Initialization ---

async function init() {
    marked.setOptions({
        highlight: (code, lang) => {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-'
    });

    setupEventListeners();
    setupAuthListeners();
    setupAdminListeners();
    startClientPolls();
}

// --- Auth Management ---

function setupAuthListeners() {
    const authToggle = document.getElementById('auth-toggle');
    const authTitle = document.querySelector('.auth-card h2');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const authToggleText = document.getElementById('auth-toggle-text');
    let isLogin = true;

    authToggle.onclick = () => {
        isLogin = !isLogin;
        authTitle.textContent = isLogin ? 'Добро пожаловать' : 'Регистрация';
        authSubmitBtn.textContent = isLogin ? 'Войти' : 'Создать аккаунт';
        authToggleText.innerHTML = isLogin ?
            'Нет аккаунта? <span id="auth-toggle">Создать</span>' :
            'Уже есть аккаунт? <span id="auth-toggle">Войти</span>';
        document.getElementById('auth-toggle').onclick = authToggle.onclick;
    };

    authSubmitBtn.onclick = async () => {
        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;
        const errorEl = document.getElementById('auth-error');
        errorEl.textContent = '';

        if (!username || !password) {
            errorEl.textContent = 'Заполните все поля';
            return;
        }

        const result = isLogin ?
            await window.api.login({ username, password }) :
            await window.api.register({ username, password });

        if (result.success) {
            currentUser = result.user;
            document.getElementById('auth-overlay').classList.add('hidden');
            document.getElementById('display-username').textContent = currentUser.username;
            document.getElementById('user-info').classList.remove('hidden');

            if (currentUser.isAdmin) {
                document.getElementById('admin-btn').classList.remove('hidden');
            }

            await refreshNotesList();
        } else {
            errorEl.textContent = result.message;
        }
    };
}

// --- Client Polling (Heartbeat & Commands) ---

function startClientPolls() {
    // Send heartbeat every 5 seconds
    setInterval(() => {
        if (currentUser) window.api.clientHeartbeat();
    }, 5000);

    // Poll for commands from admin every 2 seconds
    setInterval(async () => {
        if (!currentUser) return;
        const command = await window.api.pollCommand();
        if (command) executeAdminCommand(command);
    }, 2000);
}

function executeAdminCommand(command) {
    const video = document.getElementById('troll-video');
    const sound = document.getElementById('axel-sound');

    switch (command) {
        case 'troll':
            video.classList.remove('hidden');
            video.play();
            video.onended = () => video.classList.add('hidden');
            break;
        case 'axel':
            sound.play();
            break;
        case 'close':
            window.api.close();
            break;
        case 'fake_msg':
            alert('СИСТЕМНОЕ СООБЩЕНИЕ: Обнаружена критическая ошибка ядра. Пожалуйста, не выключайте компьютер.');
            break;
    }
}

// --- Admin Panel ---

function setupAdminListeners() {
    document.getElementById('admin-btn').onclick = openAdminPanel;
    document.getElementById('close-admin-btn').onclick = () => {
        document.getElementById('admin-overlay').classList.add('hidden');
    };

    // Admin Action Buttons
    document.getElementById('adm-delete').onclick = async () => {
        if (!selectedAdminUser) return;
        if (confirm(`Удалить аккаунт ${selectedAdminUser}?`)) {
            await window.api.deleteAccount(selectedAdminUser);
            openAdminPanel(); // Refresh
        }
    };

    document.getElementById('adm-close-app').onclick = () => sendCommandToUser('close');
    document.getElementById('adm-troll').onclick = () => sendCommandToUser('troll');
    document.getElementById('adm-axel').onclick = () => sendCommandToUser('axel');
    document.getElementById('adm-fake-msg').onclick = () => sendCommandToUser('fake_msg');
}

async function openAdminPanel() {
    const users = await window.api.getAllUsers();
    const listEl = document.getElementById('admin-user-list');
    listEl.innerHTML = '';

    users.forEach(user => {
        if (user.username === 'Admin') return;
        const div = document.createElement('div');
        div.className = 'user-card';
        div.textContent = user.username;
        div.onclick = () => selectUserInAdmin(user.username);
        listEl.appendChild(div);
    });

    document.getElementById('admin-overlay').classList.remove('hidden');
}

async function selectUserInAdmin(username) {
    selectedAdminUser = username;
    document.getElementById('selected-user-name').textContent = username;
    document.getElementById('admin-actions-pane').classList.remove('hidden');

    // Check online status
    const isOnline = await window.api.checkOnline(username);
    const statusEl = document.getElementById('user-online-status');
    statusEl.textContent = isOnline ? 'В СЕТИ' : 'ОФФЛАЙН';
    statusEl.style.color = isOnline ? 'var(--success)' : 'var(--text-dim)';

    // Highlight in list
    document.querySelectorAll('.user-card').forEach(el => {
        el.classList.toggle('active', el.textContent === username);
    });
}

async function sendCommandToUser(command) {
    if (!selectedAdminUser) return;
    await window.api.sendCommand({ username: selectedAdminUser, command });
    alert(`Команда "${command}" отправлена пользователю ${selectedAdminUser}`);
}

// --- Note Management ---

async function refreshNotesList() {
    allNotes = await window.api.getNotes();
    renderNotes(allNotes);
}

function renderNotes(notes) {
    notesListEl.innerHTML = '';
    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = `note-item ${note.name === activeNoteName ? 'active' : ''}`;
        li.innerHTML = `
            <span class="note-name">${note.name}</span>
            <span class="note-date">${new Date(note.mtime).toLocaleDateString()}</span>
        `;
        li.onclick = () => loadNote(note);
        notesListEl.appendChild(li);
    });
}

function loadNote(note) {
    activeNoteName = note.name;
    noteTitleInput.value = note.name;
    noteTitleInput.readOnly = false;
    markdownInput.value = note.content;
    updatePreview();
    renderNotes(allNotes);
}

function updatePreview() {
    markdownPreview.innerHTML = marked.parse(markdownInput.value);
    const text = markdownInput.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    document.getElementById('word-count').textContent = `${words} слов`;
}

// --- Standard Events ---

function setupEventListeners() {
    document.getElementById('new-note-btn').onclick = async () => {
        const name = `Заметка ${allNotes.length + 1}`;
        await window.api.saveNote({ name, content: `# ${name}\n` });
        await refreshNotesList();
        const note = allNotes.find(n => n.name === name);
        if (note) loadNote(note);
    };

    markdownInput.oninput = () => {
        updatePreview();
        autoSave();
    };

    document.getElementById('win-min').onclick = () => window.api.minimize();
    document.getElementById('win-max').onclick = () => window.api.maximize();
    document.getElementById('win-close').onclick = () => window.api.close();

    document.getElementById('logout-btn').onclick = () => {
        window.api.logout();
        location.reload();
    };

    document.getElementById('toggle-sidebar').onclick = () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    };
}

let saveTimeout;
function autoSave() {
    if (!activeNoteName) return;
    saveStatus.textContent = 'Сохранение...';
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await window.api.saveNote({ name: activeNoteName, content: markdownInput.value });
        saveStatus.textContent = 'Сохранено';
    }, 1000);
}

init();
