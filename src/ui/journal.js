// The atlas: a journal with an annotatable map, clue notes, whale log and wardrobe.
import { ICON } from './icons.js';
import { CLUES, TASKS, PLACES, MAP, mapU, mapV } from '../game/story.js';
import { WARDROBE, SLOT_LABEL } from '../entities/character.js';

const COLORS = ['#19b3a8', '#ff4f9a', '#8f63e6'];
const SYMBOLS = ['pin', 'tail', 'star', 'ask'];
const SYMBOL_ICON = { pin: ICON.pin, tail: ICON.tail, star: ICON.star, ask: '<b>?</b>' };
const HINTS = [
  'Draw the routes you try. Dotted lines are yours to keep.',
  'Somewhere with a clear view past the reef…',
  'Choose <b>Mark</b>, then tap the sea where the whale surfaced.',
  'The atlas is yours. Keep mapping the cove.',
];

const TEMPLATE = `
<div class="book">
  <nav class="tabs">
    <button data-tab="map" class="t-map">${ICON.palm}<span>Map</span></button>
    <button data-tab="clues" class="t-clues">${ICON.search}<span>Clues</span></button>
    <button data-tab="whales" class="t-whales">${ICON.tail}<span>Whales</span></button>
    <button data-tab="looks" class="t-looks">${ICON.shirt}<span>Looks</span></button>
  </nav>
  <div class="page">
    <header><span class="hib">${ICON.hibiscus}</span><h2>Sheltered Cove</h2><button class="close pill pink">${ICON.close}<span>Close</span></button></header>
    <section data-page="map">
      <div class="map-col">
        <div class="map-wrap"><canvas class="map-base" width="${MAP.w}" height="${MAP.h}"></canvas><canvas class="map-ink" width="${MAP.w}" height="${MAP.h}"></canvas><div class="map-labels"></div></div>
        <div class="tools">
          <button data-tool="draw">${ICON.pencil}<span>Draw</span></button>
          <button data-tool="mark">${ICON.pin}<span>Mark</span></button>
          <button data-tool="erase">${ICON.eraser}<span>Erase</span></button>
          <button data-act="undo">${ICON.undo}<span>Undo</span></button>
          <span class="swatches">${COLORS.map((c, i) => `<button data-color="${i}" style="--c:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}</span>
          <span class="symbols">${SYMBOLS.map((s) => `<button data-symbol="${s}" aria-label="${s}">${SYMBOL_ICON[s]}</button>`).join('')}</span>
        </div>
      </div>
      <aside><ul class="tasks"></ul><p class="map-hint"></p></aside>
    </section>
    <section data-page="clues"><ul class="clue-list"></ul></section>
    <section data-page="whales"><div class="whale-log"></div></section>
    <section data-page="looks"><div class="looks"></div></section>
  </div>
</div>`;

export class Journal {
  // host: { save, playerPos(): {x, z}, onMark(x, z) → bool, onEquip(slot, id), onClose(), persist(), tick() }
  constructor(el, host) {
    this.el = el;
    this.host = host;
    el.innerHTML = TEMPLATE;
    const $ = (s) => el.querySelector(s);
    this.base = $('.map-base');
    this.ink = $('.map-ink');
    this.ctx = this.ink.getContext('2d');
    this.labels = $('.map-labels');
    this.tool = 'draw';
    this.color = 1;
    this.symbol = 'pin';
    this.undoStack = [];
    this.stroke = null;
    this.erased = null;
    this.isOpen = false;
    this.tab = 'map';

    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { host.tick(); this.show(b.dataset.tab); }));
    $('.close').addEventListener('click', () => this.close());
    el.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { this.tool = b.dataset.tool; host.tick(); this.#syncTools(); }));
    el.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => { this.color = +b.dataset.color; if (this.tool === 'erase') this.tool = 'draw'; host.tick(); this.#syncTools(); }));
    el.querySelectorAll('[data-symbol]').forEach((b) => b.addEventListener('click', () => { this.symbol = b.dataset.symbol; this.tool = 'mark'; host.tick(); this.#syncTools(); }));
    $('[data-act="undo"]').addEventListener('click', () => { host.tick(); this.undo(); });

    const ink = this.ink;
    ink.addEventListener('pointerdown', (e) => { try { ink.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } this.#down(this.#uv(e)); });
    ink.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') this.#move(this.#uv(e)); });
    ink.addEventListener('pointerup', (e) => this.#up(this.#uv(e)));
    ink.addEventListener('pointercancel', () => { this.stroke = null; this.erased = null; this.draw(); });
    this.#syncTools();
  }

  get items() { return this.host.save.atlas; }

  #uv(e) {
    const r = this.ink.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }

  #down([u, v]) {
    if (this.tool === 'draw') this.stroke = { t: 's', c: this.color, p: [u, v] };
    else if (this.tool === 'erase') { this.erased = []; this.#eraseAt(u, v); }
  }

  #move([u, v]) {
    if (this.stroke) {
      const p = this.stroke.p, n = p.length;
      if (Math.hypot(u - p[n - 2], (v - p[n - 1]) * (MAP.h / MAP.w)) > 0.004) { p.push(u, v); this.draw(); this.host.scribble?.(); }
    } else if (this.erased) this.#eraseAt(u, v);
  }

  #up([u, v]) {
    if (this.tool === 'draw' && this.stroke) {
      if (this.stroke.p.length === 2) this.stroke.p.push(u + 0.0005, v);
      this.items.push(this.stroke);
      this.undoStack.push({ add: this.stroke });
      this.stroke = null;
      this.host.persist();
    } else if (this.tool === 'mark') {
      const mark = { t: 'm', c: this.color, s: this.symbol, u, v };
      this.items.push(mark);
      this.undoStack.push({ add: mark });
      this.host.persist();
      this.draw();
      this.host.onMark(MAP.x0 + u * (MAP.x1 - MAP.x0), MAP.z0 + v * (MAP.z1 - MAP.z0));
    } else if (this.erased) {
      if (this.erased.length) { this.undoStack.push({ del: this.erased }); this.host.persist(); }
      this.erased = null;
    }
    this.draw();
  }

  #eraseAt(u, v) {
    const k = MAP.h / MAP.w, items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      let hit = false;
      if (it.t === 'm') hit = Math.hypot(u - it.u, (v - it.v + 0.03) * k) < 0.035;
      else for (let j = 0; j < it.p.length && !hit; j += 2) hit = Math.hypot(u - it.p[j], (v - it.p[j + 1]) * k) < 0.022;
      if (hit) { this.erased.push({ item: it, index: i }); items.splice(i, 1); }
    }
    this.draw();
  }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return;
    if (op.add) {
      const i = this.items.indexOf(op.add);
      if (i >= 0) this.items.splice(i, 1);
    } else {
      for (const { item, index } of [...op.del].reverse()) this.items.splice(Math.min(index, this.items.length), 0, item);
    }
    this.host.persist();
    this.draw();
  }

  #syncTools() {
    this.el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === this.tool));
    this.el.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', +b.dataset.color === this.color));
    this.el.querySelectorAll('[data-symbol]').forEach((b) => b.classList.toggle('on', b.dataset.symbol === this.symbol && this.tool === 'mark'));
    this.el.querySelector('.tools').style.setProperty('--ink', COLORS[this.color]);
  }

  // Paint the top-down render onto paper: softened, with the edges fading out.
  setMapImage(image) {
    const ctx = this.base.getContext('2d'), w = MAP.w, h = MAP.h;
    ctx.fillStyle = '#fbf0dc';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(image, 0, 0, w, h);
    ctx.globalAlpha = 1;
    const edge = (x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(251,240,220,1)'); g.addColorStop(1, 'rgba(251,240,220,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    };
    edge(0, 0, 70, 0); edge(w, 0, w - 70, 0); edge(0, 0, 0, 60); edge(0, h, 0, h - 60);
    // Paper tooth.
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = i % 2 ? '#7a5a3a' : '#ffffff';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  draw() {
    const ctx = this.ctx, w = MAP.w, h = MAP.h;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = ctx.lineJoin = 'round';
    const path = (p) => {
      ctx.beginPath();
      ctx.moveTo(p[0] * w, p[1] * h);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * w, p[i + 1] * h);
    };
    const all = this.stroke ? [...this.items, this.stroke] : this.items;
    for (const it of all) {
      if (it.t !== 's') continue;
      path(it.p);
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 12; ctx.stroke();
      ctx.setLineDash([15, 14]); ctx.strokeStyle = COLORS[it.c]; ctx.lineWidth = 7; ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const it of all) if (it.t === 'm') this.#stamp(it.u * w, it.v * h, COLORS[it.c], it.s);

    // You are here.
    const p = this.host.playerPos(), x = mapU(p.x) * w, y = mapV(p.z) * h;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff4f9a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
  }

  // A pin badge whose tip sits on (x, y).
  #stamp(x, y, color, symbol) {
    const ctx = this.ctx, cy = y - 34, r = 19;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - 13, cy + 13); ctx.arc(x, cy, r, Math.PI * 0.75, Math.PI * 0.25); ctx.closePath();
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#fff';
    if (symbol === 'pin') { ctx.beginPath(); ctx.arc(x, cy, 7, 0, 7); ctx.fill(); }
    else if (symbol === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, rr = i % 2 ? 5.5 : 12; ctx.lineTo(x + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.fill();
    } else if (symbol === 'tail') {
      ctx.beginPath();
      ctx.moveTo(x, cy + 12); ctx.quadraticCurveTo(x - 1, cy + 2, x, cy - 2);
      ctx.bezierCurveTo(x - 5, cy - 1, x - 12, cy - 4, x - 14, cy - 10); ctx.bezierCurveTo(x - 7, cy - 10, x - 3, cy - 8, x, cy - 4);
      ctx.bezierCurveTo(x + 3, cy - 8, x + 7, cy - 10, x + 14, cy - 10); ctx.bezierCurveTo(x + 12, cy - 4, x + 5, cy - 1, x, cy - 2);
      ctx.quadraticCurveTo(x + 2, cy + 4, x + 2, cy + 12);
      ctx.fill();
    } else {
      ctx.font = '700 26px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x, cy + 1);
    }
  }

  refresh() {
    const s = this.host.save, el = this.el;
    this.labels.innerHTML = PLACES.filter((p) => s.places[p.id]).map((p) =>
      `<span style="left:${(mapU(p.x) * 100).toFixed(1)}%;top:${(mapV(p.z) * 100).toFixed(1)}%">${p.name}</span>`).join('');
    el.querySelector('.tasks').innerHTML = TASKS.map((t) => `<li class="${s.clues[t.clue] ? 'done' : ''}"><i></i>${t.text}</li>`).join('');
    el.querySelector('.map-hint').innerHTML = HINTS[s.stage];
    el.querySelector('.clue-list').innerHTML = CLUES.map((c) => s.clues[c.id]
      ? `<li><b>${c.title}</b><span>${c.text}</span></li>` : '<li class="unknown"><b>? ? ?</b><span>Something still to find.</span></li>').join('');
    el.querySelector('.whale-log').innerHTML = s.clues.whale
      ? `<div class="whale-card"><span class="whale-icon">${ICON.tail}</span><div><b>Koholā · humpback whale</b>
          <span>Seen breaching beyond the reef, north-east of Sheltered Cove.</span>
          <span class="soft">Humpbacks come to these warm waters in winter to sing and raise their calves.</span></div></div>`
      : `<div class="whale-card empty"><span class="whale-icon">${ICON.tail}</span><div><b>No sightings yet</b><span>Watch the open water beyond the reef. A high place helps.</span></div></div>`;
    let owned = 0, total = 0;
    const rows = Object.keys(WARDROBE).map((slot) => {
      const chips = Object.entries(WARDROBE[slot]).map(([id, def]) => {
        total++;
        if (!s.owned[slot].includes(id)) return '<button class="chip locked" disabled><i>?</i>Not found yet</button>';
        owned++;
        const sw = def.body ?? def.shoe;
        return `<button class="chip ${s.outfit[slot] === id ? 'on' : ''}" data-slot="${slot}" data-id="${id}"><i style="background:#${sw.toString(16).padStart(6, '0')}"></i>${def.name}</button>`;
      }).join('');
      return `<div class="look-row"><b>${SLOT_LABEL[slot]}</b><div>${chips}</div></div>`;
    }).join('');
    el.querySelector('.looks').innerHTML = `${rows}<p class="soft">${owned} of ${total} pieces found. Outfits are hidden around the cove.</p>`;
    el.querySelectorAll('.chip[data-slot]').forEach((b) => b.addEventListener('click', () => { this.host.onEquip(b.dataset.slot, b.dataset.id); this.refresh(); }));
    this.draw();
  }

  show(tab) {
    this.tab = tab;
    this.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    this.el.querySelectorAll('[data-page]').forEach((p) => p.classList.toggle('on', p.dataset.page === tab));
  }

  open(tab = 'map', tool) {
    if (tool) { this.tool = tool; this.#syncTools(); }
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.show(tab);
    this.refresh();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.host.onClose();
  }
}
