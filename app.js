/**
 * PixelDisplay240 Studio - Enhanced Standalone Designer
 * Features: Layers, AI Creator, Collection, Animation, Move/Selection tools, RLE.
 */

class EditorModule {
    constructor() { this.dom = (id) => document.getElementById(id); }
}

class Layer {
    constructor(appRef, name, width, height, dataURL = null, backgroundColor = null) {
        this.app = appRef; this.name = name; this.visible = true;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width; this.canvas.height = height;
        this.canvas.className = 'canvas-layer';
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (dataURL) {
            const img = new Image(); img.onload = () => { this.ctx.drawImage(img, 0, 0, width, height); this.app.refresh(); };
            img.src = dataURL;
        } else if (backgroundColor) {
            this.ctx.fillStyle = backgroundColor; this.ctx.fillRect(0, 0, width, height);
        }
    }
}

class LayerManager extends EditorModule {
    constructor(app) {
        super(); this.app = app; this.layers = []; this.activeIndex = 0;
        this.container = this.dom('layers-container'); this.listEl = this.dom('layers-list');
    }
    add(name = "Camada", dataURL = null, silent = false) {
        const w = parseInt(this.dom('canvas-width')?.value) || 240, h = parseInt(this.dom('canvas-height')?.value) || 240;
        const bg = (this.layers.length === 0) ? (this.dom('bg-color-picker')?.value || '#000000') : null;
        const nl = new Layer(this.app, name, w, h, dataURL, bg);
        this.layers.push(nl); this.activeIndex = this.layers.length - 1;
        if (this.container) this.container.insertBefore(nl.canvas, this.dom('temp-canvas'));
        this.updateZIndex(); this.renderUI();
        if (!silent) this.app.saveHistory();
    }
    select(i) { if (this.layers[i]) { this.activeIndex = i; this.renderUI(); } }
    get active() { return this.layers[this.activeIndex]; }
    delete(i) {
        if (this.layers.length <= 1) return;
        this.layers[i].canvas.remove(); this.layers.splice(i, 1);
        this.activeIndex = Math.min(this.activeIndex, this.layers.length - 1);
        this.app.refresh(); this.app.saveHistory();
    }
    toggleVisibility(i) {
        const l = this.layers[i]; l.visible = !l.visible;
        l.canvas.style.display = l.visible ? 'block' : 'none';
        this.renderUI(); this.app.refresh();
    }
    async rename(i) {
        const n = await this.app.dialog.prompt('Renomear', 'Nome:', this.layers[i].name);
        if (n) { this.layers[i].name = n; this.renderUI(); this.app.saveHistory(); }
    }
    mergeAll() {
        if (this.layers.length <= 1) return;
        const base = this.layers[0];
        for (let i = 1; i < this.layers.length; i++) {
            if (this.layers[i].visible) base.ctx.drawImage(this.layers[i].canvas, 0, 0);
            this.layers[i].canvas.remove();
        }
        this.layers = [base]; this.activeIndex = 0;
        this.renderUI(); this.app.refresh(); this.app.saveHistory();
    }
    updateZIndex() { this.layers.forEach((l, i) => l.canvas.style.zIndex = i); }
    renderUI() {
        if (!this.listEl) return; this.listEl.innerHTML = '';
        [...this.layers].reverse().forEach((l, revIdx) => {
            const i = this.layers.length - 1 - revIdx;
            const item = document.createElement('div');
            item.className = `layer-item ${i === this.activeIndex ? 'active' : ''}`;
            item.innerHTML = `<span onclick="event.stopPropagation(); app.layers.toggleVisibility(${i})"><i data-lucide="${l.visible ? 'eye' : 'eye-off'}" style="width:14px;"></i></span><span style="flex:1; margin-left:8px;" ondblclick="app.layers.rename(${i})">${l.name}</span><button class="text-btn" onclick="event.stopPropagation(); app.layers.delete(${i})"><i data-lucide="trash-2" style="width:14px;"></i></button>`;
            item.onclick = () => this.select(i); this.listEl.appendChild(item);
        });
        if (window.lucide) lucide.createIcons();
    }
}

class DrawingManager extends EditorModule {
    constructor(app) {
        super(); this.app = app; this.isDrawing = false;
        this.startX = 0; this.startY = 0; this.lastX = 0; this.lastY = 0;
        this.symX = false; this.symY = false;
        this.tempCanvas = this.dom('temp-canvas'); this.tempCtx = this.tempCanvas.getContext('2d');
        this.selection = null; // {x, y, w, h, data}
        this._setupEvents();
    }
    _setupEvents() {
        const w = this.dom('canvas-wrapper');
        w.onmousedown = (e) => this._onMouseDown(e);
        w.onmousemove = (e) => this._onMouseMove(e);
        window.onmouseup = () => this._onMouseUp();
        this.dom('btn-sym-x').onclick = () => { this.symX = !this.symX; this.dom('btn-sym-x').classList.toggle('active'); };
        this.dom('btn-sym-y').onclick = () => { this.symY = !this.symY; this.dom('btn-sym-y').classList.toggle('active'); };
    }
    _getPos(e) {
        const r = this.dom('canvas-wrapper').getBoundingClientRect();
        const active = this.app.layers.active;
        const sX = active.canvas.width / r.width, sY = active.canvas.height / r.height;
        return [(e.clientX - r.left) * sX, (e.clientY - r.top) * sY];
    }
    _onMouseDown(e) {
        const active = this.app.layers.active; if (!active || !active.visible) return;
        this.isDrawing = true;[this.startX, this.startY] = this._getPos(e);[this.lastX, this.lastY] = [this.startX, this.startY];
        const t = this.app.currentTool;
        if (t === 'brush' || t === 'eraser') {
            this._drawSym(active.ctx, this.startX, this.startY, this.startX, this.startY);
            this.app.refresh();
        } else if (t === 'picker') { this._pick(this.startX, this.startY); this.isDrawing = false; }
        else if (t === 'fill') { this._fill(active.ctx, Math.floor(this.startX), Math.floor(this.startY)); this.isDrawing = false; this.app.refresh(); this.app.saveHistory(); }
    }
    _onMouseMove(e) {
        if (!this.isDrawing) return; const [x, y] = this._getPos(e); const t = this.app.currentTool;
        const active = this.app.layers.active;
        if (t === 'brush' || t === 'eraser') {
            this._drawSym(active.ctx, this.lastX, this.lastY, x, y);
            [this.lastX, this.lastY] = [x, y]; this.app.refresh();
        } else if (['line', 'rect', 'circle', 'selection'].includes(t)) {
            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            this._drawShape(this.tempCtx, t, this.startX, this.startY, x, y, false);
            this.lastX = x; this.lastY = y;
        } else if (t === 'move' && this.selection) {
            this.selection.x += (x - this.lastX); this.selection.y += (y - this.lastY);
            this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
            this.tempCtx.putImageData(this.selection.data, this.selection.x, this.selection.y);
            this.lastX = x; this.lastY = y;
        }
    }
    _onMouseUp() {
        if (!this.isDrawing) return; this.isDrawing = false;
        const t = this.app.currentTool, active = this.app.layers.active; if (!active) return;
        if (['line', 'rect', 'circle'].includes(t)) {
            this._drawShape(active.ctx, t, this.startX, this.startY, this.lastX, this.lastY, true);
        } else if (t === 'selection') {
            const x = Math.min(this.startX, this.lastX), y = Math.min(this.startY, this.lastY);
            const w = Math.abs(this.startX - this.lastX), h = Math.abs(this.startY - this.lastY);
            if (w > 2 && h > 2) {
                this.selection = { x, y, w, h, data: active.ctx.getImageData(x, y, w, h) };
                active.ctx.clearRect(x, y, w, h); // Cut
                this.app.toast.show('info', 'Seleção Criada', 'Use ferramenta Mover para posicionar.');
                this.app.currentTool = 'move';
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                this.dom('tool-move').classList.add('active');
            }
        } else if (t === 'move' && this.selection) {
            active.ctx.putImageData(this.selection.data, this.selection.x, this.selection.y);
            this.selection = null;
        }
        this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        this.app.refresh(); this.app.saveHistory();
    }
    _drawSym(ctx, x1, y1, x2, y2) {
        const c = this.dom('color-picker').value, s = parseInt(this.dom('brush-size').value) || 2;
        const w = ctx.canvas.width, h = ctx.canvas.height;
        ctx.save();
        if (this.app.currentTool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = c; ctx.lineWidth = s; ctx.lineCap = 'round';
        const pat = this.dom('brush-pattern').value;
        if (pat !== 'solid' && this.app.currentTool !== 'eraser') ctx.strokeStyle = this._pat(ctx, pat, c);
        const l = (ox1, oy1, ox2, oy2) => { ctx.beginPath(); ctx.moveTo(ox1, oy1); ctx.lineTo(ox2, oy2); ctx.stroke(); };
        l(x1, y1, x2, y2);
        if (this.symX) l(w - x1, y1, w - x2, y2);
        if (this.symY) l(x1, h - y1, x2, h - y2);
        if (this.symX && this.symY) l(w - x1, h - y1, w - x2, h - y2);
        ctx.restore();
    }
    _drawShape(ctx, t, x1, y1, x2, y2, sym) {
        const c = this.dom('color-picker').value, s = parseInt(this.dom('brush-size').value) || 2;
        ctx.strokeStyle = c; ctx.lineWidth = s; ctx.lineCap = 'round';
        if (t === 'selection') { ctx.setLineDash([5, 5]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; }
        const d = (ox1, oy1, ox2, oy2) => {
            ctx.beginPath();
            if (t === 'line') { ctx.moveTo(ox1, oy1); ctx.lineTo(ox2, oy2); }
            else if (t === 'rect' || t === 'selection') ctx.strokeRect(ox1, oy1, ox2 - ox1, oy2 - oy1);
            else if (t === 'circle') { const r = Math.sqrt((ox2 - ox1) ** 2 + (oy2 - oy1) ** 2); ctx.arc(ox1, oy1, r, 0, Math.PI * 2); }
            ctx.stroke();
        };
        d(x1, y1, x2, y2);
        if (sym && t !== 'selection') {
            const w = ctx.canvas.width, h = ctx.canvas.height;
            if (this.symX) d(w - x1, y1, w - x2, y2);
            if (this.symY) d(x1, h - y1, x2, h - y2);
            if (this.symX && this.symY) d(w - x1, h - y1, w - x2, h - y2);
        }
    }
    _pat(ctx, t, c) {
        const cv = document.createElement('canvas'); cv.width = 4; cv.height = 4;
        const cx = cv.getContext('2d'); cx.fillStyle = c;
        if (t === 'checker') { cx.fillRect(0, 0, 2, 2); cx.fillRect(2, 2, 2, 2); }
        else if (t === 'dots') cx.fillRect(0, 0, 1, 1);
        else if (t === 'lines') cx.fillRect(0, 0, 4, 1);
        return ctx.createPattern(cv, 'repeat');
    }
    _pick(x, y) {
        const d = this.app.layers.active.ctx.getImageData(x, y, 1, 1).data;
        this.dom('color-picker').value = "#" + ((1 << 24) + (d[0] << 16) + (d[1] << 8) + d[2]).toString(16).slice(1);
    }
    _fill(ctx, x, y) {
        const c = this.dom('color-picker').value;
        const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
        const id = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), d = id.data, w = ctx.canvas.width;
        const t = this._get(d, x, y, w); if (this._m(t, [r, g, b, 255])) return;
        const s = [[x, y]];
        while (s.length) {
            const [cx, cy] = s.pop();
            if (cx >= 0 && cy >= 0 && cx < w && cy < ctx.canvas.height && this._m(this._get(d, cx, cy, w), t)) {
                this._set(d, cx, cy, w, [r, g, b, 255]);
                s.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
            }
        }
        ctx.putImageData(id, 0, 0);
    }
    _get(d, x, y, w) { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }
    _set(d, x, y, w, c) { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; }
    _m(c1, c2) { return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3]; }
}

class LayoutManager extends EditorModule {
    constructor(app) { super(); this.app = app; this._setup(); }
    _setup() {
        this.dom('toggle-grid').onchange = () => this.renderGrid();
        this.dom('toggle-ruler').onchange = () => { this.updateRulers(); const s = this.dom('toggle-ruler').checked ? 'visible' : 'hidden'; this.dom('ruler-h').style.visibility = s; this.dom('ruler-v').style.visibility = s; };
        this.dom('toggle-guides').onchange = () => { this.dom('guides-container').style.display = this.dom('toggle-guides').checked ? 'block' : 'none'; };
        this.dom('work-zoom').oninput = (e) => { this.dom('work-zoom-val').textContent = e.target.value; document.querySelector('.canvas-container').style.transform = `scale(${e.target.value / 100})`; };
        document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => this._tab(b.dataset.tab));

        const rh = this.dom('ruler-h'), rv = this.dom('ruler-v');
        rh.onclick = (e) => this._guide('v', e, rh); rv.onclick = (e) => this._guide('h', e, rv);
    }
    _tab(id) {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        const content = this.dom('tab-' + id); if (content) content.classList.add('active');
        const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`); if (btn) btn.classList.add('active');
        if (window.lucide) lucide.createIcons();
    }
    renderGrid() {
        const can = this.dom('grid-canvas'), ctx = can.getContext('2d');
        const w = parseInt(this.dom('canvas-width').value), h = parseInt(this.dom('canvas-height').value);
        if (can.width !== w || can.height !== h) { can.width = w; can.height = h; }
        ctx.clearRect(0, 0, w, h);
        if (!this.dom('toggle-grid').checked) return;
        // High contrast grid
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.5;
        for (let i = 0; i <= w; i += 10) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
        for (let j = 0; j <= h; j += 10) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke(); }
    }
    updateRulers() {
        const rh = this.dom('ruler-h'), rv = this.dom('ruler-v'); if (!rh || !rv) return;
        rh.innerHTML = ''; rv.innerHTML = '';
        if (!this.dom('toggle-ruler').checked) return;
        const w = parseInt(this.dom('canvas-width').value), h = parseInt(this.dom('canvas-height').value);
        rh.style.width = w + 'px'; rv.style.height = h + 'px';
        for (let i = 0; i <= w; i += 20) {
            const m = document.createElement('div'); m.className = 'ruler-mark'; m.style.left = i + 'px';
            m.style.height = (i % 100 === 0) ? '100%' : '40%';
            if (i % 100 === 0) { const l = document.createElement('span'); l.className = 'ruler-label'; l.textContent = i; l.style.left = (i + 2) + 'px'; rh.appendChild(l); }
            rh.appendChild(m);
        }
        for (let i = 0; i <= h; i += 20) {
            const m = document.createElement('div'); m.className = 'ruler-mark'; m.style.top = i + 'px';
            m.style.width = (i % 100 === 0) ? '100%' : '40%';
            if (i % 100 === 0) { const l = document.createElement('span'); l.className = 'ruler-label'; l.textContent = i; l.style.top = (i + 2) + 'px'; rv.appendChild(l); }
            rv.appendChild(m);
        }
    }
    _guide(t, e, r) {
        if (!this.dom('toggle-guides').checked) return;
        const rect = r.getBoundingClientRect(), w = parseInt(this.dom('canvas-width').value), h = parseInt(this.dom('canvas-height').value);
        const pos = t === 'v' ? (e.clientX - rect.left) * (w / rect.width) : (e.clientY - rect.top) * (h / rect.height);
        const g = document.createElement('div'); g.className = `guide guide-${t}`;
        if (t === 'v') g.style.left = pos + 'px'; else g.style.top = pos + 'px';
        this.dom('guides-container').appendChild(g);
    }
}

class CollectionManager extends EditorModule {
    constructor(app) {
        super(); this.app = app; this.collection = []; this.isPlaying = false; this.timer = null;
        this.dom('btn-add-collection').onclick = () => this.add();
        this.dom('btn-export-collection').onclick = () => this.export();
        this.dom('btn-play-anim').onclick = () => this.play();
        this.dom('btn-stop-anim').onclick = () => this.stop();
        this.dom('anim-fps').oninput = (e) => this.dom('anim-fps-val').textContent = e.target.value;
    }
    add() {
        const c = this.dom('preview-canvas'); const data = c.toDataURL();
        this.collection.push({ data, w: c.width, h: c.height });
        this.render(); this.app.toast.show('success', 'Capturado!');
    }
    render() {
        const l = this.dom('sprite-list'); l.innerHTML = '';
        this.collection.forEach((s, i) => {
            const item = document.createElement('div'); item.className = 'layer-item';
            item.innerHTML = `<img src="${s.data}" style="width:30px;height:30px;background:#000;border-radius:2px;"> <span style="flex:1;">Sprite ${i}</span> <button class="text-btn" onclick="app.collection.remove(${i})"><i data-lucide="trash-2" style="width:14px;"></i></button>`;
            l.appendChild(item);
        });
        if (window.lucide) lucide.createIcons();
    }
    remove(i) { this.collection.splice(i, 1); this.render(); }
    play() {
        if (this.collection.length < 2) return this.app.toast.show('warning', 'Aviso', 'Adicione pelo menos 2 sprites.');
        this.isPlaying = true; this.dom('anim-overlay').style.display = 'block';
        let i = 0; const c = this.dom('preview-canvas'), ctx = c.getContext('2d');
        const loop = () => {
            if (!this.isPlaying) return;
            const s = this.collection[i];
            const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0); i = (i + 1) % this.collection.length; };
            img.src = s.data;
            this.timer = setTimeout(loop, 1000 / parseInt(this.dom('anim-fps').value));
        };
        loop();
    }
    stop() {
        this.isPlaying = false; clearTimeout(this.timer);
        this.dom('anim-overlay').style.display = 'none'; this.app.refresh();
    }
    export() {
        if (!this.collection.length) return;
        const json = JSON.stringify(this.collection);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a'); a.download = 'collection.json'; a.href = URL.createObjectURL(blob); a.click();
    }
}

class AIPixelArtGenerator extends EditorModule {
    constructor(app) {
        super(); this.app = app;
        const btn = this.dom('tool-font-gen'); // Reusing a button slot if needed or add new
        this.dom('btn-ai-generate').onclick = () => this.generate();
        this.dom('btn-ai-apply').onclick = () => this.apply();
        this.dom('ai-modal-close').onclick = () => this.dom('ai-modal').style.display = 'none';
        // Hacky way to add AI button if it doesn't exist or map to existing
        const oldG = this.dom('tool-ai-gen'); if (oldG) oldG.onclick = () => this.dom('ai-modal').style.display = 'flex';
        // For BASIC version, let's use the tool-font-gen as AI for now as it was in the grid
        const fontBtn = this.dom('tool-font-gen'); if (fontBtn) {
            fontBtn.title = "AI Generator";
            fontBtn.innerHTML = '<i data-lucide="sparkles"></i>';
            fontBtn.onclick = () => this.dom('ai-modal').style.display = 'flex';
        }
    }
    async generate() {
        const p = this.dom('ai-prompt').value; if (!p) return;
        this.dom('ai-loading').style.display = 'block'; this.dom('ai-preview').style.display = 'none';
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=240&height=240&seed=${Math.random()}&nologo=true`;
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => {
            const c = this.dom('ai-preview-canvas'), ctx = c.getContext('2d');
            const pz = parseInt(this.dom('ai-pixel-size').value);
            if (pz > 1) {
                const t = document.createElement('canvas'); t.width = 240 / pz; t.height = 240 / pz;
                t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
                ctx.imageSmoothingEnabled = false; ctx.drawImage(t, 0, 0, 240, 240);
            } else ctx.drawImage(img, 0, 0);
            this.dom('ai-loading').style.display = 'none'; this.dom('ai-preview').style.display = 'block';
            this.dom('btn-ai-apply').style.display = 'inline-flex';
        };
        img.src = url;
    }
    apply() {
        const active = this.app.layers.active;
        if (active) { active.ctx.drawImage(this.dom('ai-preview-canvas'), 0, 0); this.app.refresh(); this.app.saveHistory(); }
        this.dom('ai-modal').style.display = 'none';
    }
}

class PixelDisplay240App extends EditorModule {
    constructor() {
        super(); this.currentTool = 'brush'; this.undoStack = []; this.redoStack = [];
        this.dialog = new DialogManager(); this.toast = new ToastManager();
        this.layers = new LayerManager(this); this.layout = new LayoutManager(this);
        this.drawing = new DrawingManager(this); this.collection = new CollectionManager(this);
        this.ai = new AIPixelArtGenerator(this);
        this.init();
    }
    init() { this.layers.add("Fundo"); this._wire(); this.refresh(); }
    _wire() {
        this.dom('btn-undo').onclick = () => this.undo();
        this.dom('btn-redo').onclick = () => this.redo();
        this.dom('btn-add-layer').onclick = () => this.layers.add();
        this.dom('btn-merge-layers').onclick = () => this.layers.mergeAll();

        // Report pixel size correctly
        this.dom('brush-size').oninput = (e) => {
            this.dom('brush-size-val').textContent = e.target.value;
        };

        document.querySelectorAll('.tool-btn').forEach(b => {
            b.onclick = () => {
                if (b.id === 'tool-clear') return this._clear();
                this.currentTool = b.id.replace('tool-', '');
                document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
                b.classList.add('active');
            };
        });
        this.dom('btn-save-project').onclick = () => this.saveProject();
        this.dom('btn-load-project').onclick = () => this.dom('project-input').click();
        this.dom('project-input').onchange = (e) => this.loadProject(e);
        this.dom('btn-export').onclick = () => this.export();
        this.dom('palette-presets').onchange = (e) => this.setPalette(e.target.value);
    }
    refresh() {
        const w = parseInt(this.dom('canvas-width').value), h = parseInt(this.dom('canvas-height').value);
        const cw = this.dom('canvas-wrapper'); cw.style.width = w + 'px'; cw.style.height = h + 'px';
        const tc = this.dom('temp-canvas'); if (tc.width !== w || tc.height !== h) { tc.width = w; tc.height = h; }
        const c = this.dom('preview-canvas'), ctx = c.getContext('2d');
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        ctx.clearRect(0, 0, w, h);
        this.layers.layers.forEach(l => { if (l.visible) ctx.drawImage(l.canvas, 0, 0); });
        this.layout.updateRulers(); this.layout.renderGrid();
    }
    saveHistory() {
        const s = this.layers.layers.map(l => ({ name: l.name, data: l.canvas.toDataURL(), visible: l.visible }));
        this.undoStack.push(JSON.stringify(s)); if (this.undoStack.length > 30) this.undoStack.shift();
    }
    undo() { if (this.undoStack.length < 2) return; this.redoStack.push(this.undoStack.pop()); this._apply(JSON.parse(this.undoStack[this.undoStack.length - 1])); }
    redo() { if (!this.redoStack.length) return; const s = this.redoStack.pop(); this.undoStack.push(s); this._apply(JSON.parse(s)); }
    _apply(snap) {
        this.layers.layers.forEach(l => l.canvas.remove()); this.layers.layers = [];
        snap.forEach((d, i) => { this.layers.add(d.name, d.data, true); this.layers.layers[i].visible = d.visible; this.layers.layers[i].canvas.style.display = d.visible ? 'block' : 'none'; });
        this.refresh();
    }
    async _clear() { if (await this.dialog.confirm('Limpar', 'Apagar tudo?')) { this.layers.active.ctx.clearRect(0, 0, parseInt(this.dom('canvas-width').value), parseInt(this.dom('canvas-height').value)); this.refresh(); this.saveHistory(); } }
    saveProject() {
        const project = { layers: this.layers.layers.map(l => ({ name: l.name, data: l.canvas.toDataURL(), visible: l.visible })), collection: this.collection.collection };
        const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
        const a = document.createElement('a'); a.download = 'project.json'; a.href = URL.createObjectURL(blob); a.click();
    }
    loadProject(e) {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader(); reader.onload = (re) => {
            const proj = JSON.parse(re.target.result);
            if (proj.layers) this._apply(proj.layers);
            if (proj.collection) { this.collection.collection = proj.collection; this.collection.render(); }
            this.toast.show('success', 'Projeto Carregado');
        };
        reader.readAsText(file);
    }
    export() {
        const f = this.dom('export-format').value, c = this.dom('preview-canvas'), ctx = c.getContext('2d');
        if (f === 'jpeg') { const a = document.createElement('a'); a.download = 'img.jpg'; a.href = c.toDataURL('image/jpeg'); a.click(); return; }
        const id = ctx.getImageData(0, 0, c.width, c.height).data;
        let code = `const uint16_t img[${c.width * c.height}] PROGMEM = {\n  `;
        if (f === 'rle565') {
            let rle = []; let cur = -1; let count = 0;
            for (let i = 0; i < id.length; i += 4) {
                const p = ((id[i] >> 3) << 11) | ((id[i + 1] >> 2) << 5) | (id[i + 2] >> 3);
                if (cur === -1) { cur = p; count = 1; }
                else if (cur === p && count < 255) count++;
                else { rle.push(count, cur); cur = p; count = 1; }
            }
            rle.push(count, cur);
            code = `const uint16_t img_rle[${rle.length}] PROGMEM = {\n  ` + rle.map(v => '0x' + v.toString(16).padStart(4, '0').toUpperCase()).join(', ') + '\n};';
        } else {
            for (let i = 0; i < id.length; i += 4) {
                const p = ((id[i] >> 3) << 11) | ((id[i + 1] >> 2) << 5) | (id[i + 2] >> 3);
                code += '0x' + p.toString(16).padStart(4, '0').toUpperCase() + (i < id.length - 4 ? ', ' : '');
                if ((i / 4 + 1) % 12 === 0) code += '\n  ';
            }
            code += '\n};';
        }
        const b = new Blob([code], { type: 'text/plain' }); const l = document.createElement('a'); l.download = 'img.h'; l.href = URL.createObjectURL(b); l.click();
    }
    setPalette(id) {
        const p = { pico8: ['#000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'] };
        const g = this.dom('color-palette'); g.querySelectorAll('.palette-color').forEach(c => c.remove());
        if (p[id]) p[id].forEach(c => {
            const div = document.createElement('div'); div.className = 'palette-color'; div.style.backgroundColor = c;
            div.onclick = () => this.dom('color-picker').value = c; g.insertBefore(div, this.dom('btn-save-color'));
        });
    }
}

class DialogManager extends EditorModule {
    confirm(t, m) { this.dom('modal-title').textContent = t; this.dom('modal-message').textContent = m; this.dom('ui-overlay').style.display = 'flex'; return new Promise(r => { this.dom('modal-ok').onclick = () => { this.dom('ui-overlay').style.display = 'none'; r(true); }; this.dom('modal-cancel').onclick = () => { this.dom('ui-overlay').style.display = 'none'; r(false); }; }); }
    prompt(t, m, v) { this.dom('modal-title').textContent = t; this.dom('modal-message').textContent = m; const i = this.dom('modal-input'); i.style.display = 'block'; i.value = v; this.dom('ui-overlay').style.display = 'flex'; return new Promise(r => { this.dom('modal-ok').onclick = () => { this.dom('ui-overlay').style.display = 'none'; r(i.value); }; this.dom('modal-cancel').onclick = () => { this.dom('ui-overlay').style.display = 'none'; r(null); }; }); }
}

class ToastManager extends EditorModule {
    show(type, title, msg) { const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerHTML = `<b>${title}</b><p>${msg || ''}</p>`; this.dom('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000); }
}

const app = new PixelDisplay240App(); window.app = app;
if (window.lucide) lucide.createIcons();
