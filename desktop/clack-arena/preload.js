// What the shell page may ask the app for: window buttons, fullscreen, zoom, reload, opening velmarox.com.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  win: (cmd, arg) => ipcRenderer.send('win', cmd, arg),
  info: () => ipcRenderer.invoke('win:info'),
  onState: (fn) => ipcRenderer.on('win:state', (_e, s) => fn(s)),
});
