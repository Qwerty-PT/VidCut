// Ponte da mini-janela de gravação (tempo + botão Parar).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rec', {
  stop: () => ipcRenderer.send('rec:mini-stop'),
  onTick: (cb) => ipcRenderer.on('rec:tick', (_e, t) => cb(t)),
});
