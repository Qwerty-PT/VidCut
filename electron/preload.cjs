// Ponte segura entre a interface (renderer) e o processo principal.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('vidcut', {
  info: () => ipcRenderer.invoke('app:info'),
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  registerMedia: (paths) => ipcRenderer.invoke('media:register', paths),
  /** Caminho absoluto de um ficheiro largado na janela (drag & drop do sistema) */
  pathForFile: (file) => webUtils.getPathForFile(file),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project, filePath, saveAs) => ipcRenderer.invoke('project:save', { project, filePath, saveAs }),
  autosaveWrite: (data) => ipcRenderer.invoke('autosave:write', data),
  autosaveRead: () => ipcRenderer.invoke('autosave:read'),
  exportVideo: (project, spec) => ipcRenderer.invoke('export:start', { project, spec }),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  setFullScreen: (on) => ipcRenderer.invoke('win:fullscreen', !!on),
  onFullScreen: (cb) => {
    const h = (_e, v) => cb(v);
    ipcRenderer.on('win:fullscreen', h);
    return () => ipcRenderer.removeListener('win:fullscreen', h);
  },
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  peaks: (file) => ipcRenderer.invoke('media:peaks', file),
  nativeEdit: (action) => ipcRenderer.invoke('edit:native', action),
  captionsStatus: () => ipcRenderer.invoke('captions:status'),
  captionsStart: (o) => ipcRenderer.invoke('captions:start', o),
  captionsCancel: () => ipcRenderer.invoke('captions:cancel'),
  captionsSaveSrt: (text, name) => ipcRenderer.invoke('captions:saveSrt', text, name),
  captionsOpenSrt: () => ipcRenderer.invoke('captions:openSrt'),
  onCaptionsProgress: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('captions:progress', h);
    return () => ipcRenderer.removeListener('captions:progress', h);
  },
  lottieList: () => ipcRenderer.invoke('lottie:list'),
  lottieImport: (paths) => ipcRenderer.invoke('lottie:import', paths),
  lottieRemove: (id) => ipcRenderer.invoke('lottie:remove', id),
  lottieRename: (id, name) => ipcRenderer.invoke('lottie:rename', id, name),
  onExportProgress: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('export:progress', h);
    return () => ipcRenderer.removeListener('export:progress', h);
  },
  recStatus: () => ipcRenderer.invoke('rec:status'),
  recAskCamera: () => ipcRenderer.invoke('rec:askCamera'),
  recSources: () => ipcRenderer.invoke('rec:sources'),
  recChoose: (id, systemAudio) => ipcRenderer.invoke('rec:choose', { id, systemAudio }),
  recStarted: (hide) => ipcRenderer.invoke('rec:started', { hide }),
  recEnded: () => ipcRenderer.invoke('rec:ended'),
  recTick: (text) => ipcRenderer.send('rec:tick', text),
  recSave: (bytes, mime, kind) => ipcRenderer.invoke('rec:save', { bytes, mime, kind }),
  onRecStop: (cb) => {
    const h = () => cb();
    ipcRenderer.on('rec:stop-request', h);
    return () => ipcRenderer.removeListener('rec:stop-request', h);
  },
  micAccess: () => ipcRenderer.invoke('mic:access'),
  saveRecording: (bytes, mime) => ipcRenderer.invoke('recording:save', { bytes, mime }),
  extractFrame: (file, timeSec) => ipcRenderer.invoke('frame:extract', { file, timeSec }),
  fontsImport: () => ipcRenderer.invoke('fonts:import'),
  loudness: (file, start, dur) => ipcRenderer.invoke('audio:loudness', { file, start, dur }),
  beats: (file) => ipcRenderer.invoke('audio:beats', file),
  scenes: (o) => ipcRenderer.invoke('video:scenes', o),
  soundsList: () => ipcRenderer.invoke('sounds:list'),
  soundsUse: (file) => ipcRenderer.invoke('sounds:use', file),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateCancel: () => ipcRenderer.invoke('update:cancel'),
  updateSkip: (v) => ipcRenderer.invoke('update:skip', v),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateOpenPage: () => ipcRenderer.invoke('update:openPage'),
  onUpdate: (cb) => {
    const h = (_e, u) => cb(u);
    ipcRenderer.on('update:status', h);
    return () => ipcRenderer.removeListener('update:status', h);
  },
  onMenu: (cb) => {
    const h = (_e, cmd) => cb(cmd);
    ipcRenderer.on('menu', h);
    return () => ipcRenderer.removeListener('menu', h);
  },
});
