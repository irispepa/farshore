// Dev-only helpers for scripted playtests (loaded from main.js in dev builds only).
export function installAutopilot(g) {
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
  const st = () => {
    const p = g.girl.root.position, c = g.canoe, card = document.querySelector('#card');
    return {
      state: g.state, mode: g.mode, p: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
      canoe: [+c.group.position.x.toFixed(1), +c.group.position.z.toFixed(1), +c.heading.toFixed(2), +c.speed.toFixed(2)],
      act: g.action && g.action.label, blocked: g.walker.blocked, stage: g.save.stage,
      clues: Object.keys(g.save.clues).join(','), places: Object.keys(g.save.places).join(','),
      owned: JSON.stringify(g.save.owned), toast: document.querySelector('#toast').textContent,
      card: !card.classList.contains('hidden') && card.querySelector('h2').textContent,
      spy: !!g.spy, fps: Math.round(1000 / g.frameAvg), pr: g.pixelRatio,
    };
  };
  // Steer toward each [x, z] in turn. Cards are dismissed on the way. Resolves 'done' | 'stuck' | 'timeout'.
  const route = (pts, { tol = 1.2, timeout = 120 } = {}) => new Promise((res) => {
    let i = 0, lastD = 1e9, still = 0;
    const t0 = performance.now();
    const fin = (r) => { clearInterval(iv); g.input.move.x = g.input.move.y = 0; res(`${r}@${i}`); };
    const iv = setInterval(() => {
      if ((performance.now() - t0) / 1000 > timeout) return fin('timeout');
      if (g.state === 'card') { document.querySelector('#card button').click(); return; }
      if (g.state !== 'play') { g.input.move.x = g.input.move.y = 0; return; }
      const sail = g.mode === 'sail', p = sail ? g.canoe.group.position : g.girl.root.position;
      const [tx, tz] = pts[i], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < (sail ? 3 : tol)) { i++; lastD = 1e9; still = 0; if (i >= pts.length) fin('done'); return; }
      if (d > lastD - 0.02) still++; else still = 0;
      lastD = Math.min(lastD, d);
      if (still > 260) return fin('stuck');
      if (sail) {
        let df = (Math.atan2(dx, dz) - g.canoe.heading) % (Math.PI * 2);
        if (df > Math.PI) df -= Math.PI * 2;
        if (df < -Math.PI) df += Math.PI * 2;
        g.input.move.x = -Math.max(-1, Math.min(1, df * 2));
        g.input.move.y = Math.abs(df) > 1 ? 0.35 : d < 8 ? 0.5 : 1;
      } else {
        const s = Math.sin(g.cam.yaw), c = Math.cos(g.cam.yaw), wx = dx / d, wz = dz / d;
        g.input.move.x = wx * c - wz * s;
        g.input.move.y = -wx * s - wz * c;
      }
    }, 30);
  });
  const run = (on) => { g.input.keys[on ? 'add' : 'delete']('ShiftLeft'); };
  const start = async (choice = 'new') => {
    document.querySelector(choice === 'new' ? '#btn-new' : '#btn-continue').click();
    await wait(0.8);
    if (g.state === 'card') document.querySelector('#card button').click();
    await wait(0.2);
  };
  window.ap = { g, st, route, run, wait, start, act: () => g.ui.onAction(), ok: () => document.querySelector('#card button').click() };
}
