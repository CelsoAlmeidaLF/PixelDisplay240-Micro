// --- PixelStream Studio IDE v5 ---
// Advanced Embedded UI Design Suite
// Core Variables & DOM
const layersContainer = document.getElementById('layers-container');
const previewCanvas = document.getElementById('preview-canvas');
const prevCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
const gridCanvas = document.getElementById('grid-canvas');
const gridCtx = gridCanvas ? gridCanvas.getContext('2d') : null;

let mainCanvas = null;
let ctx = null;
let layers = [];
let activeLayerIndex = 0;

const layersListEl = document.getElementById('layers-list');
const btnAddLayer = document.getElementById('btn-add-layer');
const btnMergeLayers = document.getElementById('btn-merge-layers');
const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');
const toggleGrid = document.getElementById('toggle-grid');
const arrayNameInput = document.getElementById('array-name');
const exportFormat = document.getElementById('export-format');
const fileInput = document.getElementById('file-input');
const bgColorPicker = document.getElementById('bg-color-picker');
const canvasWidthInput = document.getElementById('canvas-width');
const canvasHeightInput = document.getElementById('canvas-height');
const toggleRuler = document.getElementById('toggle-ruler');
const toggleGuides = document.getElementById('toggle-guides');
const rulerH = document.getElementById('ruler-h');
const rulerV = document.getElementById('ruler-v');
const guidesContainer = document.getElementById('guides-container');
const btnClearGuides = document.getElementById('btn-clear-guides');

const tempCanvas = document.getElementById('temp-canvas');
const tempCtx = tempCanvas ? tempCanvas.getContext('2d') : null;
const transformControls = document.getElementById('transform-controls');
const imgZoom = document.getElementById('img-zoom');
const imgZoomVal = document.getElementById('img-zoom-val');
const btnApplyImg = document.getElementById('btn-apply-img');
const btnCancelImg = document.getElementById('btn-cancel-img');
const transformLayer = document.getElementById('image-transform-layer');

// Workspace Zoom
const workZoomInput = document.getElementById('work-zoom');
const workZoomVal = document.getElementById('work-zoom-val');
const previewStyle = document.getElementById('preview-style');
const previewWrapper = document.getElementById('preview-wrapper');

// Collection & Animation
const btnAddCollection = document.getElementById('btn-add-collection');
const btnPlayAnim = document.getElementById('btn-play-anim');
const spriteListEl = document.getElementById('sprite-list');
let isPlayingAnim = false, animTimer = null, animFrame = 0;
let spriteCollection = [];

// History
const undoStack = [], redoStack = [];
const MAX_HISTORY = 30;

// Palette Presets
const palettePresets = document.getElementById('palette-presets');
const paletteGrid = document.getElementById('color-palette');
const PRESETS = {
    gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    pico8: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'],
    nes: ['#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400', '#503000', '#007800', '#006800', '#0058F8', '#004058', '#000000']
};

const THEMES = {
    default: { bg: '#0f172a', card: '#1e293b', primary: '#38bdf8', border: '#334155' },
    dracula: { bg: '#282a36', card: '#44475a', primary: '#bd93f9', border: '#6272a4' },
    nord: { bg: '#2e3440', card: '#3b4252', primary: '#88c0d0', border: '#4c566a' },
    monokai: { bg: '#272822', card: '#3e3d32', primary: '#f92672', border: '#75715e' }
};

const themeSwitcherElement = document.getElementById('theme-switcher-header');
if (themeSwitcherElement) themeSwitcherElement.onchange = (e) => {
    const t = THEMES[e.target.value]; if (!t) return;
    document.documentElement.style.setProperty('--bg-dark', t.bg);
    document.documentElement.style.setProperty('--card-bg', t.card);
    document.documentElement.style.setProperty('--primary', t.primary);
    document.documentElement.style.setProperty('--border', t.border);
};

if (palettePresets) palettePresets.onchange = () => {
    const val = palettePresets.value; if (val === 'custom') return;
    paletteGrid.querySelectorAll('.palette-color').forEach(c => c.remove());
    if (PRESETS[val]) PRESETS[val].forEach(color => addColorToPalette(color));
};

function addColorToPalette(color) {
    const item = document.createElement('div'); item.className = 'palette-color'; item.style.backgroundColor = color;
    item.onclick = () => colorPicker.value = rgbToHex(color);
    item.oncontextmenu = (e) => { e.preventDefault(); item.remove(); };
    if (paletteGrid && document.getElementById('btn-save-color')) {
        paletteGrid.insertBefore(item, document.getElementById('btn-save-color'));
    }
}
function rgbToHex(rgb) { if (rgb.startsWith('#')) return rgb; const p = rgb.match(/\d+/g); return "#" + p.map(v => parseInt(v).toString(16).padStart(2, '0')).join(""); }

if (document.getElementById('btn-save-color')) {
    document.getElementById('btn-save-color').onclick = () => addColorToPalette(colorPicker.value);
}

// Autosave Logic
setInterval(() => {
    if (layers.length > 0) {
        const data = {
            layers: layers.map(l => ({ name: l.name, data: l.canvas.toDataURL(), visible: l.visible })),
            collection: spriteCollection,
            screens
        };
        localStorage.setItem('v5_autosave', JSON.stringify(data));
    }
}, 30000);

// State
let currentTool = 'brush';
let isDrawing = false;
let startX = 0, startY = 0;
let lastX = 0, lastY = 0;
let symX = false, symY = false;

// Nav
const viewPanels = {
    design: document.getElementById('design-view'),
    prototype: document.getElementById('prototype-view'),
    code: document.getElementById('code-view'),
    hardware: document.getElementById('hardware-view')
};
const navBtns = {
    design: document.getElementById('nav-design'),
    prototype: document.getElementById('nav-prototype'),
    code: document.getElementById('nav-code'),
    hardware: document.getElementById('nav-hardware')
};

function switchView(viewId) {
    Object.keys(viewPanels).forEach(k => {
        if (viewPanels[k]) viewPanels[k].classList.toggle('active', k === viewId);
        if (navBtns[k]) navBtns[k].classList.toggle('active', k === viewId);
    });
    if (viewId === 'prototype') updateProtoCanvas();
    if (viewId === 'code') syncFullEditor();
    if (typeof updateStatusBar === 'function') updateStatusBar(viewId);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

Object.keys(navBtns).forEach(id => {
    if (navBtns[id]) navBtns[id].onclick = () => switchView(id);
});

const btnSymX = document.getElementById('btn-sym-x');
const btnSymY = document.getElementById('btn-sym-y');

if (btnSymX) btnSymX.onclick = () => { symX = !symX; btnSymX.classList.toggle('active', symX); };
if (btnSymY) btnSymY.onclick = () => { symY = !symY; btnSymY.classList.toggle('active', symY); };

// --- INITIALIZATION ---
function init(fullClear = false) {
    if (!canvasWidthInput || !canvasHeightInput) return;
    const w = parseInt(canvasWidthInput.value) || 240;
    const h = parseInt(canvasHeightInput.value) || 240;

    const oldLayersData = [];
    if (!fullClear && layers.length > 0) {
        layers.forEach(l => oldLayersData.push({ name: l.name, data: l.canvas.toDataURL(), visible: l.visible }));
    }

    layers.forEach(l => l.canvas.remove());
    layers = [];

    addLayer("Fundo", fullClear ? null : (oldLayersData[0]?.data || null), true);
    if (!fullClear) {
        for (let i = 1; i < oldLayersData.length; i++) {
            addLayer(oldLayersData[i].name, oldLayersData[i].data, true);
            layers[layers.length - 1].visible = oldLayersData[i].visible;
            layers[layers.length - 1].canvas.style.display = oldLayersData[i].visible ? 'block' : 'none';
        }
    }

    if (gridCanvas) { gridCanvas.width = w; gridCanvas.height = h; }
    if (previewCanvas) { previewCanvas.width = w; previewCanvas.height = h; }
    if (tempCanvas) { tempCanvas.width = w; tempCanvas.height = h; }

    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) { wrapper.style.width = w + 'px'; wrapper.style.height = h + 'px'; }

    if (layersContainer) {
        [tempCanvas, gridCanvas, guidesContainer, transformLayer].forEach(el => {
            if (el) layersContainer.appendChild(el);
        });
    }

    updateRulers();
    renderLayersUI();
    updatePreview();
    renderGrid();
    updateCodePreview();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addLayer(name = "Camada", dataURL = null, silent = false) {
    const w = parseInt(canvasWidthInput?.value) || 240;
    const h = parseInt(canvasHeightInput?.value) || 240;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.className = 'canvas-layer';
    const lCtx = canvas.getContext('2d', { willReadFrequently: true });

    if (dataURL) {
        const img = new Image();
        img.onload = () => { lCtx.drawImage(img, 0, 0); updatePreview(); };
        img.src = dataURL;
    } else if (layers.length === 0) {
        lCtx.fillStyle = bgColorPicker?.value || '#000000';
        lCtx.fillRect(0, 0, w, h);
    }

    layers.push({ name, canvas, ctx: lCtx, visible: true });
    selectLayer(layers.length - 1);
    if (layersContainer) layersContainer.insertBefore(canvas, tempCanvas);
    layers.forEach((l, i) => l.canvas.style.zIndex = i);
    renderLayersUI();
    if (!silent) saveState();
}

function selectLayer(index) {
    activeLayerIndex = index;
    if (layers[index]) {
        mainCanvas = layers[index].canvas;
        ctx = layers[index].ctx;
    }
    renderLayersUI();
}

function renderLayersUI() {
    if (!layersListEl) return;
    layersListEl.innerHTML = '';
    [...layers].reverse().forEach((l, revIdx) => {
        const i = layers.length - 1 - revIdx;
        const item = document.createElement('div');
        item.className = `layer-item ${i === activeLayerIndex ? 'active' : ''}`;
        item.innerHTML = `
            <span style="cursor:pointer; display:flex; align-items:center;" onclick="event.stopPropagation(); window.toggleLayerVisibility(${i})">
                <i data-lucide="${l.visible ? 'eye' : 'eye-off'}" style="width:14px; height:14px;"></i>
            </span>
            <span style="flex:1; margin-left:8px;" ondblclick="event.stopPropagation(); window.renameLayer(${i})">${l.name}</span>
            <button class="text-btn" onclick="event.stopPropagation(); window.deleteLayer(${i})" title="Excluir">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
        `;
        item.onclick = () => selectLayer(i);
        layersListEl.appendChild(item);
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.toggleLayerVisibility = (i) => {
    layers[i].visible = !layers[i].visible;
    layers[i].canvas.style.display = layers[i].visible ? 'block' : 'none';
    renderLayersUI(); updatePreview();
};

window.deleteLayer = (i) => {
    if (layers.length <= 1) return;
    layers[i].canvas.remove(); layers.splice(i, 1);
    selectLayer(activeLayerIndex >= layers.length ? layers.length - 1 : activeLayerIndex);
    updatePreview(); saveState();
};

window.renameLayer = async (i) => {
    const newName = await showPrompt('Renomear Camada', 'Digite o novo nome:', layers[i].name);
    if (newName && newName.trim()) {
        layers[i].name = newName.trim();
        renderLayersUI();
        saveState();
    }
};

if (btnAddLayer) btnAddLayer.onclick = () => addLayer();
if (btnMergeLayers) btnMergeLayers.onclick = async () => {
    if (layers.length <= 1) return;
    const ok = await showConfirm('Achatar Camadas', 'Deseja achatar todas as camadas em uma só?');
    if (!ok) return;
    const off = document.createElement('canvas'); off.width = mainCanvas.width; off.height = mainCanvas.height;
    const oCtx = off.getContext('2d'); layers.forEach(l => { if (l.visible) oCtx.drawImage(l.canvas, 0, 0); });
    init(true); const img = new Image(); img.onload = () => { layers[0].ctx.drawImage(img, 0, 0); saveState(); updatePreview(); };
    img.src = off.toDataURL();
};

// Tool Actions
const tools = {
    brush: document.getElementById('tool-brush'),
    eraser: document.getElementById('tool-eraser'),
    selection: document.getElementById('tool-selection'),
    move: document.getElementById('tool-move'),
    text: document.getElementById('tool-text'),
    line: document.getElementById('tool-line'),
    rect: document.getElementById('tool-rect'),
    circle: document.getElementById('tool-circle'),
    picker: document.getElementById('tool-picker'),
    fill: document.getElementById('tool-fill'),
    fontGen: document.getElementById('tool-font-gen'),
    clear: document.getElementById('tool-clear')
};

Object.keys(tools).forEach(k => {
    if (tools[k]) tools[k].onclick = async () => {
        currentTool = k;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        tools[k].classList.add('active');
        if (k === 'clear') {
            const ok = await showConfirm('Limpar Tudo', 'Deseja limpar todo o canvas?');
            if (ok) init(true);
        }
    };
});

// Zoom Logic
if (workZoomInput) {
    workZoomInput.oninput = () => {
        const zoom = workZoomInput.value;
        if (workZoomVal) workZoomVal.textContent = zoom + '%';
        const container = document.querySelector('.canvas-container');
        if (container) container.style.transform = `scale(${zoom / 100})`;
    };
}

// Rulers
function updateRulers() {
    if (!rulerH || !rulerV || !mainCanvas) return;
    rulerH.innerHTML = ''; rulerV.innerHTML = '';

    if (toggleRuler && !toggleRuler.checked) {
        rulerH.style.visibility = 'hidden'; rulerV.style.visibility = 'hidden';
        return;
    }
    rulerH.style.visibility = 'visible'; rulerV.style.visibility = 'visible';

    const step = 20; const majorStep = 100;

    for (let i = 0; i <= mainCanvas.width; i += step) {
        const m = document.createElement('div'); m.className = 'ruler-mark';
        m.style.left = i + 'px';
        m.style.height = (i % majorStep === 0) ? '100%' : '40%';
        if (i % majorStep === 0) {
            const l = document.createElement('span'); l.className = 'ruler-label';
            l.textContent = i; l.style.left = (i + 2) + 'px';
            rulerH.appendChild(l);
        }
        rulerH.appendChild(m);
    }

    for (let i = 0; i <= mainCanvas.height; i += step) {
        const m = document.createElement('div'); m.className = 'ruler-mark';
        m.style.top = i + 'px';
        m.style.width = (i % majorStep === 0) ? '100%' : '40%';
        if (i % majorStep === 0) {
            const l = document.createElement('span'); l.className = 'ruler-label';
            l.textContent = i; l.style.top = (i + 2) + 'px';
            rulerV.appendChild(l);
        }
        rulerV.appendChild(m);
    }
}

// Guides Logic
if (rulerH) rulerH.onclick = (e) => {
    const rect = rulerH.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (mainCanvas.width / rect.width);
    addGuide('v', x);
};
if (rulerV) rulerV.onclick = (e) => {
    const rect = rulerV.getBoundingClientRect();
    const y = (e.clientY - rect.top) * (mainCanvas.height / rect.height);
    addGuide('h', y);
};

function addGuide(type, pos) {
    const guide = document.createElement('div');
    guide.className = `guide guide-${type}`;
    if (type === 'v') guide.style.left = pos + 'px';
    else guide.style.top = pos + 'px';
    if (guidesContainer) guidesContainer.appendChild(guide);
}

if (btnClearGuides) btnClearGuides.onclick = () => {
    if (guidesContainer) guidesContainer.innerHTML = '';
};

if (toggleGuides) toggleGuides.onchange = () => {
    if (guidesContainer) guidesContainer.style.display = toggleGuides.checked ? 'block' : 'none';
};

// Grid
function renderGrid() {
    if (!gridCtx || !gridCanvas || !mainCanvas) return;
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    if (toggleGrid && !toggleGrid.checked) return;
    gridCtx.strokeStyle = 'rgba(255,255,255,0.1)'; gridCtx.lineWidth = 0.5;
    const step = 10;
    for (let i = 0; i <= gridCanvas.width; i += step) {
        gridCtx.beginPath(); gridCtx.moveTo(i, 0); gridCtx.lineTo(i, gridCanvas.height); gridCtx.stroke();
    }
    for (let j = 0; j <= gridCanvas.height; j += step) {
        gridCtx.beginPath(); gridCtx.moveTo(0, j); gridCtx.lineTo(gridCanvas.width, j); gridCtx.stroke();
    }
}

if (toggleGrid) toggleGrid.onchange = renderGrid;
if (toggleRuler) toggleRuler.onchange = updateRulers;

// Drawing Events
function getMousePos(e) {
    if (!mainCanvas) return [0, 0];
    const r = mainCanvas.getBoundingClientRect();
    const s = mainCanvas.width / r.width;
    return [(e.clientX - r.left) * s, (e.clientY - r.top) * s];
}

document.addEventListener('mousedown', (e) => {
    if (e.target.closest('.canvas-wrapper')) {
        isDrawing = true;
        [startX, startY] = getMousePos(e);
        [lastX, lastY] = [startX, startY];
    }
});

document.addEventListener('mousemove', (e) => {
    if (!isDrawing || !ctx) return;
    const [x, y] = getMousePos(e);

    const drawMirror = (x1, y1, x2, y2) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };

    ctx.strokeStyle = colorPicker ? colorPicker.value : '#fff';
    ctx.lineWidth = brushSize ? brushSize.value : 2;
    ctx.lineCap = 'round';

    // Original Line
    drawMirror(lastX, lastY, x, y);

    // Mirrored Lines
    if (symX) drawMirror(mainCanvas.width - lastX, lastY, mainCanvas.width - x, y);
    if (symY) drawMirror(lastX, mainCanvas.height - lastY, x, mainCanvas.height - y);
    if (symX && symY) drawMirror(mainCanvas.width - lastX, mainCanvas.height - lastY, mainCanvas.width - x, mainCanvas.height - y);

    [lastX, lastY] = [x, y];
    updatePreview();
});

document.addEventListener('mouseup', () => {
    if (isDrawing) {
        isDrawing = false;
        saveState();
    }
});

// Utils
function updatePreview() {
    if (!prevCtx || !previewCanvas) return;
    prevCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    layers.forEach(l => { if (l.visible) prevCtx.drawImage(l.canvas, 0, 0); });
    updateCodePreview();
}

function saveState() {
    const snap = layers.map(l => ({ name: l.name, data: l.canvas.toDataURL(), visible: l.visible }));
    undoStack.push(snap);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

function updateCodePreview() {
    const el = document.getElementById('live-code-preview');
    if (!el) return;
    el.textContent = `// PixelStream V5\n// Desenhe para ver o código...`;
}

// Prototype
let screens = [{ name: 'Home', background: null, elements: [] }];
let activeScreenIndex = 0;
const protoCanvas = document.getElementById('proto-canvas');
const pCtx = protoCanvas ? protoCanvas.getContext('2d') : null;

function updateProtoCanvas() {
    if (!pCtx) return;
    pCtx.fillStyle = '#111';
    pCtx.fillRect(0, 0, 240, 240);
    pCtx.fillStyle = varColor('--primary');
    pCtx.font = '12px Inter';
    pCtx.fillText(`Tela: ${screens[activeScreenIndex].name}`, 10, 20);
    pCtx.strokeStyle = '#333';
    pCtx.strokeRect(20, 40, 200, 160);
    pCtx.fillStyle = '#333';
    pCtx.fillText("Visualização do Protótipo", 60, 120);

    updateProtoCodeIDE();
}

function updateProtoCodeIDE() {
    const editor = document.getElementById('proto-code-editor');
    if (!editor) return;
    const screen = screens[activeScreenIndex];
    const code = `// Lógica da Tela: ${screen.name}\n` +
        `// Componentes: ${screen.elements.length}\n\n` +
        `void setup_${screen.name.toLowerCase()}() {\n` +
        `  display.fillScreen(BLACK);\n` +
        (screen.background ? `  display.drawBitmap(0, 0, ${screen.background}, 240, 240);\n` : "") +
        `}\n\n` +
        `void loop_${screen.name.toLowerCase()}() {\n` +
        `  // Insira interações aqui...\n` +
        `}`;
    editor.value = code;
    const fullEditor = document.getElementById('full-ide-editor');
    if (fullEditor) fullEditor.value = code;
}

function syncFullEditor() {
    const ideCanvas = document.getElementById('ide-preview-canvas');
    if (ideCanvas && protoCanvas) {
        const iCtx = ideCanvas.getContext('2d');
        iCtx.drawImage(protoCanvas, 0, 0);
    }
}

function varColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

window.toggleIdeSize = () => {
    const container = document.querySelector('.code-editor-container');
    if (!container) return;
    const isExpanded = container.classList.contains('expanded');

    container.classList.add('toggling');
    if (isExpanded) {
        container.style.height = '400px';
        container.classList.remove('expanded');
    } else {
        container.style.height = '75vh';
        container.classList.add('expanded');
    }

    setTimeout(() => container.classList.remove('toggling'), 350);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

// ========== TFT_eSPI C++ SIMULATOR ==========

const TFT_COLORS = {
    'TFT_BLACK': '#000000', 'TFT_NAVY': '#000080', 'TFT_DARKGREEN': '#008000',
    'TFT_DARKCYAN': '#008080', 'TFT_MAROON': '#800000', 'TFT_PURPLE': '#800080',
    'TFT_OLIVE': '#808000', 'TFT_LIGHTGREY': '#C0C0C0', 'TFT_DARKGREY': '#808080',
    'TFT_BLUE': '#0000FF', 'TFT_GREEN': '#00FF00', 'TFT_CYAN': '#00FFFF',
    'TFT_RED': '#FF0000', 'TFT_MAGENTA': '#FF00FF', 'TFT_YELLOW': '#FFFF00',
    'TFT_WHITE': '#FFFFFF', 'TFT_ORANGE': '#FFA500', 'TFT_GREENYELLOW': '#ADFF2F',
    'TFT_PINK': '#FFC0CB', 'TFT_SKYBLUE': '#87CEEB', 'TFT_VIOLET': '#EE82EE',
    'TFT_GOLD': '#FFD700', 'TFT_SILVER': '#C0C0C0',
    'BLACK': '#000000', 'WHITE': '#FFFFFF', 'RED': '#FF0000',
    'GREEN': '#00FF00', 'BLUE': '#0000FF', 'YELLOW': '#FFFF00',
    'CYAN': '#00FFFF', 'MAGENTA': '#FF00FF', 'ORANGE': '#FFA500',
};

function resolveColor(val, vars) {
    if (typeof val === 'string') val = val.trim();
    if (TFT_COLORS[val]) return TFT_COLORS[val];
    if (vars && vars[val] !== undefined) return resolveColor(String(vars[val]), vars);
    // 16-bit color (565) to hex
    const num = parseInt(val);
    if (!isNaN(num)) {
        if (num <= 0xFFFF && num >= 0) {
            const r = ((num >> 11) & 0x1F) * 255 / 31;
            const g = ((num >> 5) & 0x3F) * 255 / 63;
            const b = (num & 0x1F) * 255 / 31;
            return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        }
        return '#' + num.toString(16).padStart(6, '0');
    }
    // Hex notation
    if (val && val.startsWith('0x')) {
        const hex = parseInt(val, 16);
        if (!isNaN(hex)) return resolveColor(String(hex), vars);
    }
    return '#FFFFFF';
}

function evalExpr(expr, vars) {
    let e = expr.trim();
    // Replace known variables
    if (vars) {
        const sorted = Object.keys(vars).sort((a, b) => b.length - a.length);
        for (const k of sorted) {
            const re = new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
            e = e.replace(re, vars[k]);
        }
    }
    try {
        // Safe eval for math expressions
        const result = Function('"use strict"; return (' + e + ')')();
        return result;
    } catch { return 0; }
}

function simulateTFT(code, targetCanvas) {
    const canvas = targetCanvas || document.getElementById('proto-canvas');
    if (!canvas) return [];
    const ctx = canvas.getContext('2d');
    const logs = [];
    const log = (type, msg) => logs.push({ type, msg, time: Date.now() });

    // State
    let cursorX = 0, cursorY = 0;
    let textColor = '#FFFFFF';
    let textBgColor = null;
    let textSize = 1;
    let rotation = 0;
    const vars = {};
    let drawCount = 0;

    // Pre-process: remove comments
    let lines = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').split('\n');

    log('info', 'Iniciando simulação TFT_eSPI...');
    log('info', `Canvas: ${canvas.width}x${canvas.height}`);

    function processLines(lineArray, depth = 0) {
        if (depth > 20) { log('error', 'Profundidade máxima de execução atingida'); return; }
        let i = 0;
        while (i < lineArray.length) {
            let line = lineArray[i].trim();
            if (!line || line.startsWith('#include') || line.startsWith('//') || line === '{' || line === '}') { i++; continue; }

            // Variable declarations: int x = 10; / float y = 5.5;
            const varMatch = line.match(/^(?:int|float|double|uint\d+_t|long|unsigned\s+\w+|byte|char)\s+(\w+)\s*=\s*(.+?)\s*;/);
            if (varMatch) {
                vars[varMatch[1]] = evalExpr(varMatch[2], vars);
                i++; continue;
            }

            // Variable assignment: x = 10;
            const assignMatch = line.match(/^(\w+)\s*=\s*(.+?)\s*;/);
            if (assignMatch && vars[assignMatch[1]] !== undefined) {
                vars[assignMatch[1]] = evalExpr(assignMatch[2], vars);
                i++; continue;
            }

            // Increment/decrement: x++; x--;
            const incMatch = line.match(/^(\w+)\s*(\+\+|--)\s*;/);
            if (incMatch && vars[incMatch[1]] !== undefined) {
                vars[incMatch[1]] += incMatch[2] === '++' ? 1 : -1;
                i++; continue;
            }

            // Compound assignment: x += 5;
            const compMatch = line.match(/^(\w+)\s*(\+=|-=|\*=|\/=)\s*(.+?)\s*;/);
            if (compMatch && vars[compMatch[1]] !== undefined) {
                const v = evalExpr(compMatch[3], vars);
                switch (compMatch[2]) {
                    case '+=': vars[compMatch[1]] += v; break;
                    case '-=': vars[compMatch[1]] -= v; break;
                    case '*=': vars[compMatch[1]] *= v; break;
                    case '/=': vars[compMatch[1]] /= v; break;
                }
                i++; continue;
            }

            // FOR loop: for (int i = 0; i < 10; i++)
            const forMatch = line.match(/^for\s*\(\s*(?:int|uint\d+_t|byte)?\s*(\w+)\s*=\s*(.+?)\s*;\s*(\w+)\s*(<=?|>=?|!=)\s*(.+?)\s*;\s*(\w+)(\+\+|--|\+=\s*\d+|-=\s*\d+)\s*\)/);
            if (forMatch) {
                const [, varName, initVal, condVar, op, limit, incVar, incOp] = forMatch;
                vars[varName] = evalExpr(initVal, vars);
                const maxLimit = evalExpr(limit, vars);
                // Collect body
                let body = [];
                let braceCount = 0;
                let foundBrace = line.includes('{');
                if (foundBrace) braceCount = 1;
                i++;
                if (!foundBrace && i < lineArray.length && lineArray[i].trim() === '{') {
                    braceCount = 1; foundBrace = true; i++;
                }
                if (foundBrace) {
                    while (i < lineArray.length && braceCount > 0) {
                        const bl = lineArray[i];
                        for (const ch of bl) { if (ch === '{') braceCount++; if (ch === '}') braceCount--; }
                        if (braceCount > 0) body.push(bl);
                        i++;
                    }
                } else {
                    if (i < lineArray.length) body.push(lineArray[i]);
                    i++;
                }
                // Execute loop (safety: max 5000 iterations)
                let iterations = 0;
                const checkCond = () => {
                    const v = vars[condVar]; const l = evalExpr(limit, vars);
                    switch (op) {
                        case '<': return v < l; case '<=': return v <= l;
                        case '>': return v > l; case '>=': return v >= l;
                        case '!=': return v != l;
                    } return false;
                };
                while (checkCond() && iterations < 5000) {
                    processLines(body, depth + 1);
                    if (incOp === '++') vars[incVar]++;
                    else if (incOp === '--') vars[incVar]--;
                    else {
                        const addMatch = incOp.match(/(\+=|-=)\s*(\d+)/);
                        if (addMatch) {
                            vars[incVar] += (addMatch[1] === '+=' ? 1 : -1) * parseInt(addMatch[2]);
                        }
                    }
                    iterations++;
                }
                if (iterations >= 5000) log('warn', `Loop limitado a 5000 iterações (${varName})`);
                continue;
            }

            // Parse TFT commands
            const cmdMatch = line.match(/(?:tft|display|lcd)\s*\.\s*(\w+)\s*\(([^)]*)\)/);
            if (cmdMatch) {
                const [, fn, argsStr] = cmdMatch;
                // Parse arguments, handling strings
                const args = [];
                let temp = '', inStr = false, strChar = '';
                for (const ch of argsStr + ',') {
                    if ((ch === '"' || ch === "'") && !inStr) { inStr = true; strChar = ch; temp += ch; }
                    else if (ch === strChar && inStr) { inStr = false; temp += ch; }
                    else if (ch === ',' && !inStr) { args.push(temp.trim()); temp = ''; }
                    else temp += ch;
                }

                const numArgs = args.map(a => {
                    const v = evalExpr(a, vars);
                    return v;
                });

                switch (fn) {
                    case 'init': case 'begin':
                        log('info', 'Display inicializado');
                        break;

                    case 'setRotation':
                        rotation = numArgs[0] || 0;
                        log('info', `Rotação: ${rotation}`);
                        break;

                    case 'fillScreen':
                        ctx.fillStyle = resolveColor(args[0], vars);
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        log('draw', `fillScreen(${args[0]})`);
                        drawCount++;
                        break;

                    case 'fillRect':
                        ctx.fillStyle = resolveColor(args[4], vars);
                        ctx.fillRect(numArgs[0], numArgs[1], numArgs[2], numArgs[3]);
                        drawCount++;
                        break;

                    case 'drawRect':
                        ctx.strokeStyle = resolveColor(args[4], vars);
                        ctx.lineWidth = 1;
                        ctx.strokeRect(numArgs[0], numArgs[1], numArgs[2], numArgs[3]);
                        drawCount++;
                        break;

                    case 'fillRoundRect':
                        ctx.fillStyle = resolveColor(args[5], vars);
                        roundRect(ctx, numArgs[0], numArgs[1], numArgs[2], numArgs[3], numArgs[4], true);
                        drawCount++;
                        break;

                    case 'drawRoundRect':
                        ctx.strokeStyle = resolveColor(args[5], vars);
                        ctx.lineWidth = 1;
                        roundRect(ctx, numArgs[0], numArgs[1], numArgs[2], numArgs[3], numArgs[4], false);
                        drawCount++;
                        break;

                    case 'fillCircle':
                        ctx.fillStyle = resolveColor(args[3], vars);
                        ctx.beginPath();
                        ctx.arc(numArgs[0], numArgs[1], numArgs[2], 0, Math.PI * 2);
                        ctx.fill();
                        drawCount++;
                        break;

                    case 'drawCircle':
                        ctx.strokeStyle = resolveColor(args[3], vars);
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(numArgs[0], numArgs[1], numArgs[2], 0, Math.PI * 2);
                        ctx.stroke();
                        drawCount++;
                        break;

                    case 'drawLine':
                        ctx.strokeStyle = resolveColor(args[4], vars);
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(numArgs[0], numArgs[1]);
                        ctx.lineTo(numArgs[2], numArgs[3]);
                        ctx.stroke();
                        drawCount++;
                        break;

                    case 'drawPixel':
                        ctx.fillStyle = resolveColor(args[2], vars);
                        ctx.fillRect(numArgs[0], numArgs[1], 1, 1);
                        drawCount++;
                        break;

                    case 'fillTriangle':
                        ctx.fillStyle = resolveColor(args[6], vars);
                        ctx.beginPath();
                        ctx.moveTo(numArgs[0], numArgs[1]);
                        ctx.lineTo(numArgs[2], numArgs[3]);
                        ctx.lineTo(numArgs[4], numArgs[5]);
                        ctx.closePath();
                        ctx.fill();
                        drawCount++;
                        break;

                    case 'drawTriangle':
                        ctx.strokeStyle = resolveColor(args[6], vars);
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(numArgs[0], numArgs[1]);
                        ctx.lineTo(numArgs[2], numArgs[3]);
                        ctx.lineTo(numArgs[4], numArgs[5]);
                        ctx.closePath();
                        ctx.stroke();
                        drawCount++;
                        break;

                    case 'setCursor':
                        cursorX = numArgs[0]; cursorY = numArgs[1];
                        break;

                    case 'setTextColor':
                        textColor = resolveColor(args[0], vars);
                        textBgColor = args[1] ? resolveColor(args[1], vars) : null;
                        break;

                    case 'setTextSize':
                        textSize = numArgs[0] || 1;
                        break;

                    case 'print': case 'println': {
                        let text = args[0] || '';
                        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))
                            text = text.slice(1, -1);
                        else if (vars[text] !== undefined) text = String(vars[text]);

                        const fontSize = Math.max(8, textSize * 10);
                        ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

                        if (textBgColor) {
                            const m = ctx.measureText(text);
                            ctx.fillStyle = textBgColor;
                            ctx.fillRect(cursorX, cursorY - fontSize + 2, m.width, fontSize + 2);
                        }

                        ctx.fillStyle = textColor;
                        ctx.fillText(text, cursorX, cursorY + fontSize - 2);

                        if (fn === 'println') cursorY += fontSize + 2;
                        else cursorX += ctx.measureText(text).width;

                        drawCount++;
                        break;
                    }

                    case 'drawString': {
                        let text = args[0] || '';
                        if ((text.startsWith('"') && text.endsWith('"'))) text = text.slice(1, -1);
                        const dx = numArgs[1], dy = numArgs[2];
                        const fs = args[3] ? numArgs[3] * 10 : textSize * 10;
                        ctx.font = `${Math.max(8, fs)}px 'JetBrains Mono', monospace`;
                        ctx.fillStyle = textColor;
                        ctx.fillText(text, dx, dy + fs - 2);
                        drawCount++;
                        break;
                    }

                    case 'setTextDatum':
                        break; // Simplified: ignore datum for now

                    case 'width':
                    case 'height':
                        break; // getter, handled by evalExpr

                    default:
                        log('warn', `Comando não suportado: ${fn}()`);
                }
                i++; continue;
            }

            // Serial.print / Serial.println
            const serialMatch = line.match(/Serial\s*\.\s*(print|println)\s*\(([^)]*)\)/);
            if (serialMatch) {
                let text = serialMatch[2].trim();
                if (text.startsWith('"')) text = text.slice(1, -1);
                else if (vars[text] !== undefined) text = String(vars[text]);
                log('serial', text);
                i++; continue;
            }

            // delay()
            const delayMatch = line.match(/delay\s*\(\s*(\d+)\s*\)/);
            if (delayMatch) {
                log('info', `delay(${delayMatch[1]}ms) - ignorado na simulação`);
                i++; continue;
            }

            i++;
        }
    }

    function roundRect(ctx, x, y, w, h, r, fill) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        if (fill) ctx.fill(); else ctx.stroke();
    }

    try {
        processLines(lines);
        log('success', `Simulação concluída: ${drawCount} operações de desenho`);
        log('info', `Memória estimada: ${Math.round(code.length * 0.8)}B código`);
    } catch (err) {
        log('error', `Erro na simulação: ${err.message}`);
    }

    return logs;
}

// Connect to Sync buttons
let simAbort = false;

window.runSimulation = function (source) {
    const editor = source === 'ide'
        ? document.getElementById('full-ide-editor')
        : document.getElementById('proto-code-editor');
    const canvas = source === 'ide'
        ? document.getElementById('ide-preview-canvas')
        : document.getElementById('proto-canvas');

    if (!editor || !canvas) return;

    // Update button states
    simAbort = false;
    const btnRun = document.getElementById(source === 'ide' ? 'btn-sim-ide' : 'btn-sim-proto');
    const btnStop = document.getElementById(source === 'ide' ? 'btn-stop-ide' : 'btn-stop-proto');
    if (btnRun) { btnRun.disabled = true; btnRun.style.opacity = '0.5'; }
    if (btnStop) { btnStop.disabled = false; btnStop.style.opacity = '1'; }

    const logs = simulateTFT(editor.value, canvas);

    // Re-enable buttons
    if (btnRun) { btnRun.disabled = false; btnRun.style.opacity = '1'; }
    if (btnStop) { btnStop.disabled = true; btnStop.style.opacity = '0.5'; }

    // Show toast feedback
    const errors = logs.filter(l => l.type === 'error');
    const draws = logs.filter(l => l.type === 'draw');
    if (errors.length > 0) {
        showToast('error', 'Erro na Simulação', errors.map(e => e.msg).join(', '), 5000);
    } else {
        showToast('success', 'Simulação Concluída', `${draws.length} operações de desenho executadas`, 3000);
    }

    // Update console output
    const consoleDiv = document.querySelector('#code-view .sidebar div[style*="overflow-y"]');
    if (consoleDiv) {
        consoleDiv.innerHTML = '';
        logs.forEach(l => {
            const p = document.createElement('p');
            p.style.margin = '2px 0';
            switch (l.type) {
                case 'error': p.style.color = '#ef4444'; break;
                case 'warn': p.style.color = '#f59e0b'; break;
                case 'success': p.style.color = '#4ade80'; break;
                case 'serial': p.style.color = '#60a5fa'; break;
                case 'draw': p.style.color = '#94a3b8'; break;
                default: p.style.color = '#4ade80';
            }
            const prefix = l.type === 'error' ? '[ERRO]' : l.type === 'warn' ? '[AVISO]' :
                l.type === 'serial' ? '[SERIAL]' : l.type === 'draw' ? '[DRAW]' : '[INFO]';
            p.textContent = `${prefix} ${l.msg}`;
            consoleDiv.appendChild(p);
        });
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    // Sync proto canvas to IDE preview and vice-versa
    if (source !== 'ide') {
        const ideCanvas = document.getElementById('ide-preview-canvas');
        if (ideCanvas) {
            const ic = ideCanvas.getContext('2d');
            ic.drawImage(canvas, 0, 0);
        }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.stopSimulation = function (source) {
    simAbort = true;
    const canvas = source === 'ide'
        ? document.getElementById('ide-preview-canvas')
        : document.getElementById('proto-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ef4444';
        ctx.font = "14px 'JetBrains Mono', monospace";
        ctx.fillText('[ Simulação Parada ]', 55, 125);
    }

    // Reset buttons
    const btnRun = document.getElementById(source === 'ide' ? 'btn-sim-ide' : 'btn-sim-proto');
    const btnStop = document.getElementById(source === 'ide' ? 'btn-stop-ide' : 'btn-stop-proto');
    if (btnRun) { btnRun.disabled = false; btnRun.style.opacity = '1'; }
    if (btnStop) { btnStop.disabled = true; btnStop.style.opacity = '0.5'; }

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.clearSimCanvas = function (source) {
    const canvas = source === 'ide'
        ? document.getElementById('ide-preview-canvas')
        : document.getElementById('proto-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
};


function renderScreenList() {
    const list = document.getElementById('screen-list');
    if (!list) return;
    list.innerHTML = '<div class="layer-item active">Home</div>';
}

// Final Launch
function startApp() {
    try {
        init();
        switchView('design');
        renderScreenList();
        if (workZoomInput) {
            workZoomInput.value = 100;
            if (workZoomVal) workZoomVal.textContent = '100%';
            const container = document.querySelector('.canvas-container');
            if (container) container.style.transform = 'scale(1)';
        }

        // Tab support in code editors
        document.querySelectorAll('textarea').forEach(editor => {
            editor.addEventListener('keydown', function (e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = this.selectionStart;
                    const end = this.selectionEnd;
                    this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
                    this.selectionStart = this.selectionEnd = start + 4;
                }
            });
        });

        // Smooth view transitions
        Object.values(viewPanels).forEach(panel => {
            if (panel) {
                panel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            }
        });

    } catch (e) {
        console.error("Crash during launch:", e);
    }
}

// ========== CUSTOM DIALOG SYSTEM (replaces alert/confirm/prompt) ==========

function showConfirm(title, message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const dTitle = document.getElementById('dialog-title');
        const dMsg = document.getElementById('dialog-message');
        const dInput = document.getElementById('dialog-input');
        const dIcon = document.getElementById('dialog-icon');
        const btnConfirm = document.getElementById('dialog-confirm');
        const btnCancel = document.getElementById('dialog-cancel');

        dTitle.textContent = title;
        dMsg.textContent = message;
        dInput.style.display = 'none';
        btnCancel.style.display = 'inline-flex';
        btnConfirm.textContent = 'Confirmar';
        dIcon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

        dialog.style.display = 'flex';

        const cleanup = (result) => {
            dialog.style.display = 'none';
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
            resolve(result);
        };

        btnConfirm.onclick = () => cleanup(true);
        btnCancel.onclick = () => cleanup(false);
    });
}

function showPrompt(title, message, defaultValue) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const dTitle = document.getElementById('dialog-title');
        const dMsg = document.getElementById('dialog-message');
        const dInput = document.getElementById('dialog-input');
        const dIcon = document.getElementById('dialog-icon');
        const btnConfirm = document.getElementById('dialog-confirm');
        const btnCancel = document.getElementById('dialog-cancel');

        dTitle.textContent = title;
        dMsg.textContent = message;
        dInput.style.display = 'block';
        dInput.value = defaultValue || '';
        btnCancel.style.display = 'inline-flex';
        btnConfirm.textContent = 'OK';
        dIcon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

        dialog.style.display = 'flex';
        setTimeout(() => dInput.focus(), 100);

        const cleanup = (result) => {
            dialog.style.display = 'none';
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
            dInput.onkeydown = null;
            resolve(result);
        };

        btnConfirm.onclick = () => cleanup(dInput.value.trim() || null);
        btnCancel.onclick = () => cleanup(null);
        dInput.onkeydown = (e) => { if (e.key === 'Enter') cleanup(dInput.value.trim() || null); };
    });
}

// ========== TOAST NOTIFICATION SYSTEM ==========

/**
 * showToast(type, title, message, duration)
 * type: 'error' | 'warning' | 'success'
 * Error/Warning → bottom center (red/amber box)
 * Success → bottom right (default theme box)
 */
window.showToast = function (type, title, message, duration = 4000) {
    const isError = type === 'error' || type === 'warning';
    const container = document.getElementById(isError ? 'toast-error-container' : 'toast-success-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconMap = {
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${iconMap[type] || iconMap.success}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300)">×</button>
        <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);

    // Auto remove
    const timer = setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);

    // Click to dismiss
    toast.addEventListener('click', () => {
        clearTimeout(timer);
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    });
};

// ========== STATUS BAR UPDATER ==========

const viewLabels = { design: 'Design', prototype: 'Protótipo', code: 'Código IDE', hardware: 'Hardware' };

function updateStatusBar(viewId) {
    const statusView = document.getElementById('status-view');
    const statusZoom = document.getElementById('status-zoom');
    const statusTime = document.getElementById('status-time');

    if (statusView && viewId) {
        statusView.innerHTML = `<i data-lucide="layout" style="width:12px;height:12px;"></i> ${viewLabels[viewId] || viewId}`;
    }
    if (statusZoom && workZoomInput) {
        statusZoom.textContent = `Zoom: ${workZoomInput.value}%`;
    }
    if (statusTime) {
        const now = new Date();
        statusTime.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Clock tick
setInterval(() => {
    const statusTime = document.getElementById('status-time');
    if (statusTime) {
        const now = new Date();
        statusTime.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}, 1000);

startApp();

// Show startup toast
setTimeout(() => {
    showToast('success', 'PixelStream v5', 'IDE carregada com sucesso!', 3000);
    updateStatusBar('design');
}, 500);
