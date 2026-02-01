const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
let dataPath, notesDir, themesDir, fontsDir, settingsPath, usersPath, videoDir, soundsDir;
let currentUser = null;

function initPaths() {
    try {
        if (isDev) {
            dataPath = __dirname;
        } else {
            const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
            dataPath = portableDir ? path.join(portableDir, 'NotesManager_Data') : app.getPath('userData');
        }

        notesDir = path.join(dataPath, 'notes');
        themesDir = path.join(dataPath, 'themes');
        fontsDir = path.join(dataPath, 'fonts');
        settingsPath = path.join(dataPath, 'settings.json');
        usersPath = path.join(dataPath, 'users.json');
        videoDir = path.join(__dirname, 'Video');
        soundsDir = path.join(__dirname, 'Sounds');

        [dataPath, notesDir, themesDir, fontsDir].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });

        if (!fs.existsSync(usersPath)) {
            const initialUsers = [{ username: 'Admin', password: 'Test009', isAdmin: true }];
            fs.writeFileSync(usersPath, JSON.stringify(initialUsers, null, 2));
        }

        // System folder for heartbeats and commands
        const sysDir = path.join(notesDir, '.system');
        if (!fs.existsSync(sysDir)) fs.mkdirSync(sysDir, { recursive: true });

    } catch (err) {
        console.error('Path init error:', err);
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 850,
        minWidth: 1000,
        minHeight: 700,
        frame: false, // Custom borderless window for premium look
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    initPaths();
    createWindow();
});

// --- IPC Handlers ---

ipcMain.handle('auth:login', async (event, { username, password }) => {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        const userNotesDir = path.join(notesDir, username);
        if (!fs.existsSync(userNotesDir)) fs.mkdirSync(userNotesDir, { recursive: true });
        return { success: true, user: { username: user.username, isAdmin: !!user.isAdmin } };
    }
    return { success: false, message: 'Неверный логин или пароль' };
});

ipcMain.handle('auth:register', async (event, { username, password }) => {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    if (users.find(u => u.username === username)) return { success: false, message: 'Пользователь уже существует' };

    const newUser = { username, password, isAdmin: false };
    users.push(newUser);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    const userNotesDir = path.join(notesDir, username);
    if (!fs.existsSync(userNotesDir)) fs.mkdirSync(userNotesDir, { recursive: true });

    currentUser = newUser;
    return { success: true, user: { username, isAdmin: false } };
});

ipcMain.handle('auth:logout', () => {
    currentUser = null;
    return true;
});

// Notes
ipcMain.handle('get-notes', async () => {
    if (!currentUser) return [];
    const userNotesDir = path.join(notesDir, currentUser.username);
    if (!fs.existsSync(userNotesDir)) fs.mkdirSync(userNotesDir, { recursive: true });

    const files = fs.readdirSync(userNotesDir);
    return files.filter(f => f.endsWith('.md')).map(file => {
        const p = path.join(userNotesDir, file);
        return { name: file.replace('.md', ''), content: fs.readFileSync(p, 'utf-8'), mtime: fs.statSync(p).mtime };
    }).sort((a, b) => b.mtime - a.mtime);
});

ipcMain.handle('save-note', async (e, { name, content }) => {
    if (!currentUser) return false;
    fs.writeFileSync(path.join(notesDir, currentUser.username, `${name}.md`), content, 'utf-8');
    return true;
});

ipcMain.handle('delete-note', async (e, name) => {
    const p = path.join(notesDir, currentUser.username, `${name}.md`);
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
    return false;
});

// Admin Panel Features
ipcMain.handle('admin:get-all-users', async () => {
    if (!currentUser?.isAdmin) return [];
    return JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
});

ipcMain.handle('admin:delete-account', async (e, username) => {
    if (!currentUser?.isAdmin || username === 'Admin') return false;
    let users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    users = users.filter(u => u.username !== username);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    return true;
});

ipcMain.handle('admin:send-command', async (e, { username, command }) => {
    if (!currentUser?.isAdmin) return false;
    const cmdPath = path.join(notesDir, '.system', `cmd_${username}.json`);
    fs.writeFileSync(cmdPath, JSON.stringify({ command, timestamp: Date.now() }));
    return true;
});

ipcMain.handle('admin:check-online', async (e, username) => {
    const hbPath = path.join(notesDir, '.system', `hb_${username}.txt`);
    if (!fs.existsSync(hbPath)) return false;
    const stat = fs.statSync(hbPath);
    return (Date.now() - stat.mtimeMs) < 10000; // 10 seconds timeout
});

// Heartbeat & Command Polling (For the client side)
ipcMain.on('client:heartbeat', () => {
    if (!currentUser) return;
    const hbPath = path.join(notesDir, '.system', `hb_${currentUser.username}.txt`);
    fs.writeFileSync(hbPath, Date.now().toString());
});

ipcMain.handle('client:poll-command', async () => {
    if (!currentUser) return null;
    const cmdPath = path.join(notesDir, '.system', `cmd_${currentUser.username}.json`);
    if (fs.existsSync(cmdPath)) {
        const data = JSON.parse(fs.readFileSync(cmdPath, 'utf-8'));
        fs.unlinkSync(cmdPath); // Clear command after reading
        return data.command;
    }
    return null;
});

// Window Controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => mainWindow.close());

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
