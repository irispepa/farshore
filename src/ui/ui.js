// HUD, cards, title and pause overlays.
import { ICON } from './icons.js';

const TEMPLATE = `
<div id="hud" class="hidden">
  <div class="plaque"><span class="plaque-flower">${ICON.hibiscus}</span>
    <div class="plaque-text"><b id="loc">Sheltered Cove</b><span id="obj"><i>${ICON.shell}</i><em></em></span></div></div>
  <button id="btn-pause" class="glass round" aria-label="Pause">${ICON.pause}</button>
  <div id="stick"><div id="knob"></div></div>
  <button id="btn-act" class="glass big" disabled><span class="ico">${ICON.hand}</span><span class="lbl">Interact</span><i class="pearl">${ICON.shell}</i></button>
  <button id="btn-journal" class="glass big"><span class="ico">${ICON.journal}</span><span class="lbl">Journal</span><i class="pearl">${ICON.shell}</i></button>
  <div id="prompt" class="hidden"><i>${ICON.shell}</i><span></span></div>
</div>
<div id="spyglass" class="hidden"></div>
<div id="toast"></div>
<div id="title" class="overlay">
  <div class="title-inner">
    <h1>Farshore</h1>
    <p class="tag">Chapter one · Sheltered Cove</p>
    <div class="title-buttons">
      <button id="btn-continue" class="pill pink hidden">Continue voyage</button>
      <button id="btn-new" class="pill pink">Set sail</button>
    </div>
    <p id="loading">Packing your atlas…</p>
  </div>
</div>
<div id="card" class="overlay hidden"><div class="card-paper">
  <span class="card-flower">${ICON.hibiscus}</span>
  <p class="kicker"></p><h2></h2><div class="card-body"></div>
  <button class="pill pink"></button>
</div></div>
<div id="pause" class="overlay hidden"><div class="card-paper small">
  <h2>Paused</h2>
  <button id="btn-resume" class="pill pink">Keep exploring</button>
  <button id="btn-sound" class="pill">Sound: on</button>
  <button id="btn-restart" class="pill">Restart voyage</button>
  <p class="hint">Left thumb moves, push to the edge to run · right thumb looks around</p>
</div></div>
<div id="journal" class="overlay hidden"></div>
<div id="rotate"><span>${ICON.rotate}</span><p>Turn your phone sideways to explore</p></div>`;

const ACTION_ICONS = { hand: ICON.hand, sail: ICON.sail, eye: ICON.eye, anchor: ICON.anchor };

export class UI {
  constructor(root) {
    root.innerHTML = TEMPLATE;
    this.root = root;
    const $ = (s) => root.querySelector(s);
    this.el = {
      hud: $('#hud'), obj: $('#obj em'), loc: $('#loc'), act: $('#btn-act'), actIcon: $('#btn-act .ico'), actLabel: $('#btn-act .lbl'),
      journalBtn: $('#btn-journal'), pauseBtn: $('#btn-pause'), prompt: $('#prompt'), promptText: $('#prompt span'), toast: $('#toast'),
      title: $('#title'), loading: $('#loading'), btnNew: $('#btn-new'), btnContinue: $('#btn-continue'), card: $('#card'), pause: $('#pause'),
      spyglass: $('#spyglass'), stick: $('#stick'), journal: $('#journal'), sound: $('#btn-sound'),
    };
    this.onAction = this.onJournal = this.onPause = this.onResume = this.onRestart = this.onSound = () => {};
    const tap = (el, fn) => el.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    tap(this.el.act, () => this.onAction());
    tap(this.el.journalBtn, () => this.onJournal());
    tap(this.el.pauseBtn, () => this.onPause());
    tap($('#btn-resume'), () => this.onResume());
    tap($('#btn-restart'), () => this.onRestart());
    tap(this.el.sound, () => this.onSound());
    this.actionKey = '';
    this.toastTimer = 0;
  }

  ready(hasSave) {
    this.el.loading.classList.add('hidden');
    this.el.title.classList.add('ready');
    this.el.btnContinue.classList.toggle('hidden', !hasSave);
    this.el.btnNew.textContent = hasSave ? 'New voyage' : 'Set sail';
    this.el.btnNew.classList.toggle('pink', !hasSave);
    return new Promise((resolve) => {
      this.el.btnNew.onclick = () => resolve('new');
      this.el.btnContinue.onclick = () => resolve('continue');
    });
  }

  hideTitle() { this.el.title.classList.add('hidden'); }
  showHud(on) { this.el.hud.classList.toggle('hidden', !on); }
  setObjective(text) { this.el.obj.textContent = text; }
  setSound(on) { this.el.sound.textContent = `Sound: ${on ? 'on' : 'off'}`; }
  spyglass(on) { this.el.spyglass.classList.toggle('hidden', !on); }
  showPause(on) { this.el.pause.classList.toggle('hidden', !on); }

  setAction(label, icon = 'hand') {
    const key = `${label}|${icon}`;
    if (key === this.actionKey) return;
    this.actionKey = key;
    this.el.act.disabled = !label;
    this.el.actLabel.textContent = label || 'Interact';
    this.el.actIcon.innerHTML = ACTION_ICONS[label ? icon : 'hand'];
  }

  setPrompt(text, x, y) {
    const p = this.el.prompt;
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    if (this.el.promptText.textContent !== text) this.el.promptText.textContent = text;
    p.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }

  toast(text, ms = 3200) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  card({ kicker = '', title, body, button = 'Okay' }) {
    const c = this.el.card;
    c.querySelector('.kicker').textContent = kicker;
    c.querySelector('h2').textContent = title;
    c.querySelector('.card-body').innerHTML = body;
    const btn = c.querySelector('button');
    btn.textContent = button;
    c.classList.remove('hidden');
    return new Promise((resolve) => {
      btn.onclick = () => { c.classList.add('hidden'); resolve(); };
    });
  }
}
