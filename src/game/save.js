// Progress lives in localStorage; one slot.
const KEY = 'farshore-save-v1';

export function freshSave() {
  return {
    v: 1,
    clues: { letter: true },
    places: { landing: true },
    owned: { top: ['tee'], bottoms: ['shorts'], footwear: ['sneakers'] },
    outfit: { top: 'tee', bottoms: 'shorts', footwear: 'sneakers' },
    chests: {},
    seen: {},
    atlas: [],
    stage: 0,
    mode: 'walk',
    player: null,   // { x, y, z, facing }
    canoe: null,    // { x, z, heading }
  };
}

// 0 find the tin · 1 watch for the whale · 2 mark the atlas · 3 heading found
export function stageOf(save) {
  const c = save.clues;
  if (!c.tin) return 0;
  if (!c.whale) return 1;
  if (!c.heading) return 2;
  return 3;
}

export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || raw.v !== 1) return null;
    const base = freshSave();
    const save = { ...base, ...raw };
    for (const k of ['clues', 'places', 'owned', 'outfit', 'chests', 'seen']) save[k] = { ...base[k], ...(raw[k] || {}) };
    if (!Array.isArray(save.atlas)) save.atlas = [];
    save.stage = stageOf(save);
    return save;
  } catch {
    return null;
  }
}

export function storeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode or full: play on without saving */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
