// ゲームの画面に Steam の窓口（window.steam）を渡す。実績の解除だけ
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('steam', { unlock: names => ipcRenderer.send('steam-ach', names) });
