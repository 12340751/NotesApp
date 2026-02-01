const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Auth
    login: (data) => ipcRenderer.invoke('auth:login', data),
    register: (data) => ipcRenderer.invoke('auth:register', data),
    logout: () => ipcRenderer.invoke('auth:logout'),

    // Notes
    getNotes: () => ipcRenderer.invoke('get-notes'),
    saveNote: (data) => ipcRenderer.invoke('save-note', data),
    deleteNote: (name) => ipcRenderer.invoke('delete-note', name),

    // Admin
    getAllUsers: () => ipcRenderer.invoke('admin:get-all-users'),
    deleteAccount: (username) => ipcRenderer.invoke('admin:delete-account', username),
    sendCommand: (data) => ipcRenderer.invoke('admin:send-command', data),
    checkOnline: (username) => ipcRenderer.invoke('admin:check-online', username),

    // Client/System
    clientHeartbeat: () => ipcRenderer.send('client:heartbeat'),
    pollCommand: () => ipcRenderer.invoke('client:poll-command'),

    // Window
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
});
