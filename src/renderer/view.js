let guide = null;
let currentIndex = 0;
let currentTheme = 'dark';
let currentMode = 'dark';

const guideSelect = document.getElementById('guide-select');
const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const btnRetryWs = document.getElementById('btn-retry-ws');
const splitNameBadge = document.getElementById('split-name-badge');
const noGuide = document.getElementById('no-guide');
const guideView = document.getElementById('guide-view');
const splitIndexLabel = document.getElementById('split-index-label');
const splitTitle = document.getElementById('split-title');
const notesDisplay = document.getElementById('notes-display');
const nextSplitTitle = document.getElementById('next-split-title');
const nextNotesDisplay = document.getElementById('next-notes-display');
const nextPanel = document.getElementById('next-panel');
const settingsPanel = document.getElementById('settings-panel');
const themeSelect = document.getElementById('theme-select');
const wsUrlInput = document.getElementById('ws-url-input');
const guidesDirInput = document.getElementById('guides-dir-input');

// --- Guide loading ---

async function refreshGuideList() {
  const names = await window.api.listGuides();
  guideSelect.innerHTML = '<option value="">-- Select a guide --</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    guideSelect.appendChild(opt);
  });
  const saved = await window.api.getSetting('activeGuide');
  if (saved && names.includes(saved)) {
    guideSelect.value = saved;
    await loadGuide(saved);
  }
}

async function loadGuide(name) {
  guide = await window.api.loadGuide(name);
  if (!guide) return;
  await window.api.setSetting('activeGuide', name);
  showSplit(currentIndex);
}

guideSelect.addEventListener('change', async () => {
  const name = guideSelect.value;
  if (!name) { guide = null; showNoGuide(); return; }
  await loadGuide(name);
});

function showNoGuide() {
  noGuide.classList.remove('hidden');
  guideView.classList.add('hidden');
}

// Render notes content (text with basic markdown + images) into a container element
async function renderSplitContent(split, container) {
  container.innerHTML = '';

  if (split.notes) {
    const textDiv = document.createElement('div');
    textDiv.className = 'notes-text';
    // HTML from Redactor - render directly; legacy plain-text gets markdown fallback
    if (split.notes.trim().startsWith('<')) {
      textDiv.innerHTML = split.notes;
    } else {
      textDiv.innerHTML = renderNotes(split.notes);
    }
    container.appendChild(textDiv);
  }

  if (!split.notes) {
    const empty = document.createElement('p');
    empty.className = 'empty-notes';
    empty.textContent = 'No notes for this split.';
    container.appendChild(empty);
  }
}

async function showSplit(index) {
  if (!guide) { showNoGuide(); return; }

  const splits = guide.splits || [];
  if (!splits.length) { showNoGuide(); return; }

  const clampedIndex = Math.max(0, Math.min(index, splits.length - 1));
  currentIndex = clampedIndex;

  noGuide.classList.add('hidden');
  guideView.classList.remove('hidden');

  const split = splits[clampedIndex] || {};
  splitIndexLabel.textContent = `${clampedIndex + 1} / ${splits.length}`;
  splitTitle.textContent = split.name || `Split ${clampedIndex + 1}`;
  splitNameBadge.textContent = split.name || '';

  await renderSplitContent(split, notesDisplay);

  // Next split panel
  const nextIndex = clampedIndex + 1;
  if (nextIndex < splits.length) {
    nextPanel.classList.remove('last-split');
    const nextSplit = splits[nextIndex];
    nextSplitTitle.textContent = nextSplit.name || `Split ${nextIndex + 1}`;
    await renderSplitContent(nextSplit, nextNotesDisplay);
  } else {
    nextPanel.classList.add('last-split');
    nextSplitTitle.textContent = '';
    nextNotesDisplay.innerHTML = '<p class="empty-notes">Last split.</p>';
  }
}

// Lightweight markdown renderer (bold, italic, inline code, line breaks)
function renderNotes(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// --- Font size slider ---

const fontSizeSlider = document.getElementById('font-size-slider');

function applyFontSize(size) {
  document.documentElement.style.setProperty('--viewer-font-size', size + 'px');
  fontSizeSlider.value = size;
}

fontSizeSlider.addEventListener('input', async () => {
  const size = parseInt(fontSizeSlider.value, 10);
  applyFontSize(size);
  await window.api.setSetting('viewerFontSize', size);
});

// --- Image zoom ---

const zoomOverlay = document.getElementById('zoom-overlay');
const zoomImg = document.getElementById('zoom-img');
let zoomScale = 1;

function setZoomScale(scale) {
  zoomScale = Math.min(8, Math.max(0.25, scale));
  zoomImg.style.transform = `scale(${zoomScale})`;
}

notesDisplay.addEventListener('click', (e) => {
  if (e.target.tagName === 'IMG') {
    zoomImg.src = e.target.src;
    zoomImg.style.transform = '';
    zoomScale = 1;
    zoomOverlay.classList.add('active');
  }
});

zoomOverlay.addEventListener('click', () => {
  zoomOverlay.classList.remove('active');
  zoomImg.src = '';
});

zoomOverlay.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoomScale(zoomScale * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
}, { passive: false });

// --- LiveSplit WebSocket ---

document.getElementById('btn-prev-split').addEventListener('click', () => {
  if (currentIndex > 0) showSplit(currentIndex - 1);
});
document.getElementById('btn-next-split').addEventListener('click', () => {
  if (guide && currentIndex < (guide.splits || []).length - 1) showSplit(currentIndex + 1);
});

const ls = new LiveSplitWS({
  onStatus(status) {
    statusDot.className = `dot ${status === 'failed' ? 'error' : status}`;
    const labels = {
      connecting: 'Connecting…',
      connected: 'Connected',
      disconnected: 'Disconnected',
      error: 'Error',
      failed: 'Connection failed',
    };
    statusLabel.textContent = labels[status] || status;
    btnRetryWs.classList.toggle('hidden', status !== 'failed');
  },
  onEvent(ev) {
    window.api.relayToEditor(ev);
    if (ev.type === 'split' || ev.type === 'index') {
      showSplit(ev.splitIndex);
    } else if (ev.type === 'phase' && ev.phase === 'NotRunning') {
      showSplit(0);
    }
  },
});

btnRetryWs.addEventListener('click', () => ls.retry());

async function initWS() {
  const url = await window.api.getSetting('wsUrl') || 'ws://localhost:16834/livesplit';
  wsUrlInput.value = url;
  ls.connect(url);
}

// --- Settings panel ---

document.getElementById('btn-settings').addEventListener('click', async () => {
  const dir = await window.api.getSetting('guidesDir');
  guidesDirInput.value = dir || '';
  const theme = await window.api.getSetting('theme') || 'dark';
  const mode = await window.api.getSetting('themeMode') || 'dark';
  applyTheme(theme, mode);
  settingsPanel.classList.toggle('hidden');
});

document.getElementById('btn-close-settings').addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const url = wsUrlInput.value.trim();
  await window.api.setSetting('wsUrl', url);
  ls.connect(url);
  settingsPanel.classList.add('hidden');
});

document.getElementById('theme-select').addEventListener('change', async () => {
  const theme = themeSelect.value;
  await window.api.setSetting('theme', theme);
  await window.api.setSetting('themeMode', currentMode);
  applyTheme(theme, currentMode);
  window.api.relayToEditor({ type: 'theme-changed', theme: currentTheme, mode: currentMode });
});

document.getElementById('btn-browse-guides-dir').addEventListener('click', async () => {
  const chosen = await window.api.selectFolder();
  if (!chosen) return;
  guidesDirInput.value = chosen;
  await window.api.setSetting('guidesDir', chosen);
  await refreshGuideList();
});

document.getElementById('btn-reset-guides-dir').addEventListener('click', async () => {
  guidesDirInput.value = '';
  await window.api.setSetting('guidesDir', undefined);
  await refreshGuideList();
});

document.getElementById('btn-editor').addEventListener('click', () => {
  window.api.openEditor();
});

// --- Theme ---

function applyTheme(theme, mode) {
  if (theme) { currentTheme = theme; document.documentElement.dataset.theme = theme; }
  if (mode !== undefined) {
    currentMode = mode;
    if (mode === 'light') {
      document.documentElement.dataset.mode = 'light';
    } else {
      delete document.documentElement.dataset.mode;
    }
  }
  if (themeSelect) themeSelect.value = currentTheme;
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.innerHTML = currentMode === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

document.getElementById('btn-theme-toggle').addEventListener('click', async () => {
  const next = currentMode === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme, next);
  await window.api.setSetting('theme', currentTheme);
  await window.api.setSetting('themeMode', next);
  window.api.relayToEditor({ type: 'theme-changed', theme: currentTheme, mode: next });
});

window.api.onLiveSplitEvent(async (ev) => {
  if (ev.type === 'guide-saved') {
    await refreshGuideList();
  } else if (ev.type === 'theme-changed') {
    applyTheme(ev.theme, ev.mode);
  }
});

// --- Init ---

async function init() {
  const theme = await window.api.getSetting('theme') || 'dark';
  const mode = await window.api.getSetting('themeMode') || 'dark';
  applyTheme(theme, mode);
  const fontSize = await window.api.getSetting('viewerFontSize') || 15;
  applyFontSize(fontSize);
  await refreshGuideList();
  initWS();
}

init();
