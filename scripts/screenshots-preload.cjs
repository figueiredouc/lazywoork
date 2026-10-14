// Preload for the screenshot runs: the same API as src/preload, served from a canned state.
const { contextBridge, ipcRenderer } = require('electron')

const state = JSON.parse(process.argv.find((a) => a.startsWith('--state=')).slice('--state='.length))

contextBridge.exposeInMainWorld('inbox', {
  setMode: (mode) => ipcRenderer.send('shot:mode', mode),
  fitHeight: (height) => ipcRenderer.send('shot:height', height),
  setPinned: () => {},
  getState: async () => state,
  dismiss: () => {},
  rename: () => {},
  focus: async () => true,
  answer: async () => true,
  onState: () => () => {}
})
