let guide = { name: '', splits: [] };
let guideName = '';
let selectedSplitIndex = -1;
let dirty = false;
let currentTheme = 'dark';
let currentMode = 'dark';

// DOM refs
const guideNameInput = document.getElementById('guide-name-input');
const editorGuideSelect = document.getElementById('editor-guide-select');
const splitList = document.getElementById('split-list');
const splitEditorEmpty = document.getElementById('split-editor-empty');
const splitEditorForm = document.getElementById('split-editor-form');
const splitNameInput = document.getElementById('split-name-input');
const editorStatusDot = document.getElementById('editor-status-dot');
const editorStatusLabel = document.getElementById('editor-status-label');
const editorBtnRetryWs = document.getElementById('btn-retry-ws');
const editorThemeSelect = document.getElementById('editor-theme-select');

// --- Redactor WYSIWYG ---

let redactorReady = false;

function insertImageDataUrl(dataUrl) {
  $R('#split-notes-editor', 'module.image.insert', { image: { url: dataUrl } });
  dirty = true;
}

function initRedactor() {
  if (redactorReady) return;
  redactorReady = true;

  $R('#split-notes-editor', {
    plugins: ['alignment', 'fontcolor', 'fontsize', 'fontfamily', 'table', 'video', 'specialchars'],
    buttons: [
      'format', 'bold', 'italic', 'underline', 'deleted', 'fontcolor',
      'fontsize', 'fontfamily', 'ol', 'ul', 'indent', 'outdent',
      'alignment', 'image', 'file', 'link', 'table', 'video',
      'specialchars', 'line', 'html', 'undo', 'redo',
    ],
    formatTags: ['p', 'h1', 'h2', 'h3', 'h4'],
    minHeight: '180px',
    toolbarFixed: false,
    imageSrcData: true,
    imageUpload: function(data, files, e, upload) {
      const file = files && files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => upload.complete({ file: { url: ev.target.result, name: file.name } });
      reader.readAsDataURL(file);
    },
    imageResizable: true,
    imagePosition: true,
    callbacks: {
      changed: function() { dirty = true; },
    },
  });

  // Paste image from clipboard (Ctrl+V)
  const editorEl = document.querySelector('.redactor-in');
  if (editorEl) {
    editorEl.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (ev) => insertImageDataUrl(ev.target.result);
          reader.readAsDataURL(item.getAsFile());
          return;
        }
      }
    });
  }
}

function getNotesContent() {
  return redactorReady ? $R('#split-notes-editor', 'source.getCode') : '';
}

function setNotesContent(html) {
  initRedactor();
  $R('#split-notes-editor', 'source.setCode', html || '');
}

// --- Guide list ---

async function refreshGuideList() {
  const names = await window.api.listGuides();
  editorGuideSelect.innerHTML = '<option value="">-- Open a guide --</option>';
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    editorGuideSelect.appendChild(opt);
  });
}

async function openGuide(name) {
  const data = await window.api.loadGuide(name);
  if (!data) return;
  guide = data;
  guideName = name;
  guideNameInput.value = name;
  selectedSplitIndex = -1;
  dirty = false;
  renderSplitList();
  showSplitEditor(-1);
}

editorGuideSelect.addEventListener('change', async () => {
  const name = editorGuideSelect.value;
  if (!name) return;
  if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return;
  await openGuide(name);
});

document.getElementById('btn-new-guide').addEventListener('click', () => {
  if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return;
  guide = { name: '', splits: [] };
  guideName = '';
  guideNameInput.value = '';
  editorGuideSelect.value = '';
  selectedSplitIndex = -1;
  dirty = false;
  renderSplitList();
  showSplitEditor(-1);
});

document.getElementById('btn-delete-guide').addEventListener('click', async () => {
  if (!guideName) return;
  if (!confirm(`Delete guide "${guideName}"? This cannot be undone.`)) return;
  await window.api.deleteGuide(guideName);
  guide = { name: '', splits: [] };
  guideName = '';
  guideNameInput.value = '';
  dirty = false;
  await refreshGuideList();
  renderSplitList();
  showSplitEditor(-1);
});

// --- Fetch splits from live LiveSplit ---

const btnFetchSplits = document.getElementById('btn-fetch-splits');

// Auto-capture: called whenever LiveSplit emits a split name via polling
function autoCaptureSplitName(index, name) {
  if (!guide.splits || !name) return;
  while (guide.splits.length <= index) {
    guide.splits.push({ name: `Split ${guide.splits.length + 1}`, notes: '', images: [] });
  }
  const current = guide.splits[index].name;
  const isPlaceholder = !current || /^Split \d+$/.test(current);
  if (isPlaceholder) {
    guide.splits[index].name = name;
    dirty = true;
    renderSplitList();
    if (selectedSplitIndex === index) splitNameInput.value = name;
  }
}

// Button: capture the single split currently active in LiveSplit
btnFetchSplits.addEventListener('click', async () => {
  btnFetchSplits.disabled = true;
  btnFetchSplits.textContent = '⏳…';

  try {
    const result = await ls.fetchCurrentSplit();

    if (result.error) {
      alert(`Could not capture current split.\n\n${result.error}`);
      return;
    }

    autoCaptureSplitName(result.index, result.name);
    flushCurrentSplitToGuide();
    selectedSplitIndex = result.index;
    renderSplitList();
    showSplitEditor(result.index);
  } finally {
    btnFetchSplits.textContent = '⬇ Capture split';
    btnFetchSplits.disabled = false;
  }
});

// --- LSS import ---

function parseLss(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const gameName = doc.querySelector('GameName')?.textContent?.trim() || '';
  const category = doc.querySelector('CategoryName')?.textContent?.trim() || '';
  const segments = Array.from(doc.querySelectorAll('Segments > Segment'));
  const splitNames = segments.map(s => s.querySelector('Name')?.textContent?.trim() || '');
  return { gameName, category, splitNames };
}

document.getElementById('btn-import-lss').addEventListener('click', async () => {
  if (dirty && !confirm('Unsaved changes will be lost. Continue?')) return;

  const xml = await window.api.readLss();
  if (!xml) return;

  const { gameName, category, splitNames } = parseLss(xml);
  if (!splitNames.length) { alert('No splits found in this .lss file.'); return; }

  const suggestedName = [gameName, category].filter(Boolean).join(' - ') || guideNameInput.value.trim() || 'New guide';

  const existing = guide.splits || [];
  const merged = splitNames.map((name, i) => ({
    name,
    notes: existing[i]?.notes || '',
    images: existing[i]?.images || [],
  }));

  guide.splits = merged;
  if (!guideNameInput.value.trim()) guideNameInput.value = suggestedName;
  dirty = true;
  selectedSplitIndex = -1;
  renderSplitList();
  showSplitEditor(-1);
});

// --- Save ---

document.getElementById('btn-save').addEventListener('click', saveGuide);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveGuide();
  }
});

async function saveGuide() {
  flushCurrentSplitToGuide();
  const name = guideNameInput.value.trim();
  if (!name) { alert('Please give the guide a name.'); return; }
  guide.name = name;
  const oldName = guideName;
  guideName = name;
  await window.api.saveGuide(name, guide);
  if (oldName && oldName !== name) await window.api.deleteGuide(oldName);
  dirty = false;
  await refreshGuideList();
  editorGuideSelect.value = name;
  window.api.relayToMain({ type: 'guide-saved', name });
}

// --- Split list rendering ---

function renderSplitList() {
  splitList.innerHTML = '';
  (guide.splits || []).forEach((split, i) => {
    const item = document.createElement('div');
    item.className = 'split-item' + (i === selectedSplitIndex ? ' selected' : '');
    item.dataset.index = i;

    const label = document.createElement('span');
    label.className = 'split-item-label';
    label.textContent = split.name || `Split ${i + 1}`;

    const hasNotes = split.notes && split.notes.trim();
    const hasImages = split.images && split.images.length;
    const icons = document.createElement('span');
    icons.className = 'split-item-icons';
    if (hasNotes) icons.innerHTML += '<i class="fa-solid fa-note-sticky" title="Has notes"></i>';
    if (hasImages) icons.innerHTML += '<i class="fa-solid fa-image" title="Has images"></i>';

    item.draggable = true;
    item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', i); });
    item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      moveSplit(fromIndex, i);
    });

    item.addEventListener('click', () => selectSplit(i));
    item.appendChild(label);
    item.appendChild(icons);
    splitList.appendChild(item);
  });
}

function selectSplit(index) {
  flushCurrentSplitToGuide();
  selectedSplitIndex = index;
  renderSplitList();
  showSplitEditor(index);
}

function moveSplit(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  flushCurrentSplitToGuide();
  const [removed] = guide.splits.splice(fromIndex, 1);
  guide.splits.splice(toIndex, 0, removed);
  selectedSplitIndex = toIndex;
  dirty = true;
  renderSplitList();
  showSplitEditor(toIndex);
}

// --- Split editor form ---

function showSplitEditor(index) {
  if (index < 0 || !guide.splits[index]) {
    splitEditorEmpty.classList.remove('hidden');
    splitEditorForm.classList.add('hidden');
    return;
  }
  splitEditorEmpty.classList.add('hidden');
  splitEditorForm.classList.remove('hidden');

  const split = guide.splits[index];
  splitNameInput.value = split.name || '';
  setNotesContent(split.notes || '');
}

function flushCurrentSplitToGuide() {
  if (selectedSplitIndex < 0 || !guide.splits[selectedSplitIndex]) return;
  guide.splits[selectedSplitIndex].name = splitNameInput.value;
  guide.splits[selectedSplitIndex].notes = getNotesContent();
}

splitNameInput.addEventListener('input', () => {
  if (selectedSplitIndex < 0) return;
  guide.splits[selectedSplitIndex].name = splitNameInput.value;
  dirty = true;
  renderSplitList();
});

// --- Add / remove splits ---

document.getElementById('btn-add-split').addEventListener('click', () => {
  flushCurrentSplitToGuide();
  guide.splits.push({ name: `Split ${guide.splits.length + 1}`, notes: '', images: [] });
  dirty = true;
  selectSplit(guide.splits.length - 1);
});

document.getElementById('btn-remove-split').addEventListener('click', () => {
  if (selectedSplitIndex < 0) return;
  if (!confirm('Delete this split?')) return;
  guide.splits.splice(selectedSplitIndex, 1);
  dirty = true;
  const newIndex = Math.min(selectedSplitIndex, guide.splits.length - 1);
  selectedSplitIndex = newIndex;
  renderSplitList();
  showSplitEditor(newIndex);
});

// --- LiveSplit WebSocket ---

const ls = new LiveSplitWS({
  onStatus(status) {
    editorStatusDot.className = `dot ${status === 'failed' ? 'error' : status}`;
    const labels = {
      connecting: 'Connecting…',
      connected: 'Connected',
      disconnected: 'Disconnected',
      error: 'Error',
      failed: 'Connection failed',
    };
    editorStatusLabel.textContent = labels[status] || status;
    btnFetchSplits.disabled = status !== 'connected';
    editorBtnRetryWs.classList.toggle('hidden', status !== 'failed');
  },
  onEvent(ev) {
    window.api.relayToMain(ev);
    if ((ev.type === 'split' || ev.type === 'index') && ev.splitIndex >= 0) {
      document.querySelectorAll('.split-item').forEach((el, i) => {
        const active = i === ev.splitIndex;
        el.classList.toggle('live-active', active);
        if (active) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      if (ev.splitName && guide.splits) autoCaptureSplitName(ev.splitIndex, ev.splitName);
    }
  },
});

editorBtnRetryWs.addEventListener('click', () => ls.retry());

async function initWS() {
  const url = await window.api.getSetting('wsUrl') || 'ws://localhost:16834/livesplit';
  ls.connect(url);
}

window.api.onLiveSplitEvent(async (ev) => {
  if (ev.type === 'guide-saved') {
    await refreshGuideList();
  } else if (ev.type === 'theme-changed') {
    applyTheme(ev.theme, ev.mode);
  }
});

// --- Theme ---

function populateThemeSelect() {
  const themes = [
    ['dark', 'Dark'], ['abyss', 'Abyss'],
    ['forest', 'Forest'], ['slate', 'Slate'], ['amber', 'Amber'],
  ];
  editorThemeSelect.innerHTML = '';
  themes.forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    editorThemeSelect.appendChild(opt);
  });
}

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
  if (editorThemeSelect) editorThemeSelect.value = currentTheme;
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.innerHTML = currentMode === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

document.getElementById('btn-theme-toggle').addEventListener('click', async () => {
  const next = currentMode === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme, next);
  await window.api.setSetting('theme', currentTheme);
  await window.api.setSetting('themeMode', next);
  window.api.relayToMain({ type: 'theme-changed', theme: currentTheme, mode: next });
});

editorThemeSelect.addEventListener('change', async () => {
  const theme = editorThemeSelect.value;
  await window.api.setSetting('theme', theme);
  await window.api.setSetting('themeMode', currentMode);
  applyTheme(theme, currentMode);
  window.api.relayToMain({ type: 'theme-changed', theme: currentTheme, mode: currentMode });
});

// --- Init ---

async function init() {
  const theme = await window.api.getSetting('theme') || 'dark';
  const mode = await window.api.getSetting('themeMode') || 'dark';
  populateThemeSelect();
  applyTheme(theme, mode);
  await refreshGuideList();
  const activeGuide = await window.api.getSetting('activeGuide');
  if (activeGuide) {
    editorGuideSelect.value = activeGuide;
    await openGuide(activeGuide);
  }
  initWS();
}

init();
