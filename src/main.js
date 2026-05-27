const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const store = new Store();

let mainWindow;
let editorWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    backgroundColor: '#1a1a2e',
    title: 'LiveSplit Guides',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createEditorWindow() {
  if (editorWindow) {
    editorWindow.focus();
    return;
  }
  editorWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1a1a2e',
    title: 'Guide Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  editorWindow.loadFile(path.join(__dirname, 'renderer', 'editor.html'));
  editorWindow.on('closed', () => { editorWindow = null; });
}

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!mainWindow) createMainWindow(); });

// --- IPC: settings ---

ipcMain.handle('get-setting', (_e, key) => store.get(key));
ipcMain.handle('set-setting', (_e, key, value) => {
  if (value === undefined || value === null) store.delete(key);
  else store.set(key, value);
});

// --- IPC: guide files ---

function guidesDir() {
  const dir = store.get('guidesDir', path.join(app.getPath('userData'), 'guides'));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('list-guides', () => {
  const dir = guidesDir();
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
});

ipcMain.handle('load-guide', (_e, name) => {
  const file = path.join(guidesDir(), `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
});

ipcMain.handle('save-guide', (_e, name, data) => {
  const file = path.join(guidesDir(), `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
});

ipcMain.handle('delete-guide', (_e, name) => {
  const file = path.join(guidesDir(), `${name}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
});

// --- IPC: image import (copy to app userData so paths survive moves) ---

ipcMain.handle('import-image', async (_e, guideName, splitIndex) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select an image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;

  const src = filePaths[0];
  const ext = path.extname(src);
  const destDir = path.join(guidesDir(), 'images', guideName);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `split_${splitIndex}_${Date.now()}${ext}`);
  fs.copyFileSync(src, dest);
  return dest;
});

ipcMain.handle('image-to-data-url', (_e, imgPath) => {
  if (!fs.existsSync(imgPath)) return null;
  const ext = path.extname(imgPath).slice(1).toLowerCase();
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const data = fs.readFileSync(imgPath).toString('base64');
  return `data:${mime};base64,${data}`;
});

// --- IPC: import .lss file ---

ipcMain.handle('read-lss', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open a LiveSplit file (.lss)',
    filters: [{ name: 'LiveSplit Splits', extensions: ['lss'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  return fs.readFileSync(filePaths[0], 'utf8');
});

// --- IPC: select folder ---

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select guides folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths.length) return null;
  return filePaths[0];
});

// --- IPC: open editor ---

ipcMain.handle('open-editor', () => createEditorWindow());

// --- IPC: forward split event from main to editor (if open) ---

ipcMain.on('relay-to-editor', (_e, payload) => {
  if (editorWindow) editorWindow.webContents.send('livesplit-event', payload);
});

ipcMain.on('relay-to-main', (_e, payload) => {
  if (mainWindow) mainWindow.webContents.send('livesplit-event', payload);
});
