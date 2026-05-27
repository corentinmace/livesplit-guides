const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // settings
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // guides
  listGuides: () => ipcRenderer.invoke('list-guides'),
  loadGuide: (name) => ipcRenderer.invoke('load-guide', name),
  saveGuide: (name, data) => ipcRenderer.invoke('save-guide', name, data),
  deleteGuide: (name) => ipcRenderer.invoke('delete-guide', name),

  // lss import
  readLss: () => ipcRenderer.invoke('read-lss'),

  // images
  importImage: (guideName, splitIndex) => ipcRenderer.invoke('import-image', guideName, splitIndex),
  imageToDataUrl: (imgPath) => ipcRenderer.invoke('image-to-data-url', imgPath),

  // folder picker
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // editor window
  openEditor: () => ipcRenderer.invoke('open-editor'),

  // LiveSplit events relay
  relayToEditor: (payload) => ipcRenderer.send('relay-to-editor', payload),
  relayToMain: (payload) => ipcRenderer.send('relay-to-main', payload),
  onLiveSplitEvent: (cb) => {
    ipcRenderer.on('livesplit-event', (_e, payload) => cb(payload));
  },
});
