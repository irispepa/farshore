// Inline SVG icons (no external assets).
const svg = (body, vb = '0 0 48 48') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

const petals = (cx, cy, r, fill) => [0, 72, 144, 216, 288].map((a) =>
  `<ellipse cx="${cx}" cy="${cy - r * 0.62}" rx="${r * 0.5}" ry="${r * 0.66}" fill="${fill}" transform="rotate(${a} ${cx} ${cy})"/>`).join('');

export const ICON = {
  hibiscus: svg(`${petals(24, 24, 20, '#ff6fa8')}${petals(24, 24, 12, '#ff94bf')}<circle cx="24" cy="24" r="5" fill="#ffd84a"/><circle cx="24" cy="24" r="2.2" fill="#f59b2f"/>`),
  shell: svg(`<path d="M24 40c-11 0-18-8-18-17C6 13 14 7 24 7s18 6 18 16c0 9-7 17-18 17z" fill="#ffd9e6" stroke="#f58ab0" stroke-width="2.5"/><path d="M24 40V9M24 40 12 13M24 40l12-27M24 40 7 22M24 40l17-18" stroke="#f58ab0" stroke-width="2" fill="none" stroke-linecap="round"/>`),
  hand: svg(`<path d="M15 26V13a3 3 0 0 1 6 0v9-13a3 3 0 0 1 6 0v13-11a3 3 0 0 1 6 0v13-7a3 3 0 0 1 6 0v12c0 9-6 14-14 14-7 0-10-3-13-8l-5-8c-2-4 3-6 5-3z" fill="#fff" stroke="#2f9c92" stroke-width="2" stroke-linejoin="round"/>`),
  sail: svg(`<path d="M22 6v28h17C37 22 31 12 22 6z" fill="#fff"/><path d="M22 20h13l3 9H22z" fill="#ff8fc0"/><path d="M18 10v24H9c1-10 4-18 9-24z" fill="#fff" opacity=".85"/><path d="M6 37h36l-5 6H11z" fill="#fff"/>`),
  eye: svg(`<path d="M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z" fill="#fff"/><circle cx="24" cy="24" r="7" fill="#2f9c92"/><circle cx="26" cy="22" r="2.2" fill="#fff"/>`),
  anchor: svg(`<path d="M24 14v26M12 28c0 8 6 12 12 12s12-4 12-12M17 20h14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="24" cy="10" r="4.5" fill="none" stroke="#fff" stroke-width="4"/>`),
  journal: svg(`<rect x="10" y="6" width="30" height="36" rx="5" fill="#ff8fc0" stroke="#fff" stroke-width="2.5"/><path d="M7 14h7M7 24h7M7 34h7" stroke="#fff3d6" stroke-width="3.5" stroke-linecap="round"/>${petals(24, 19, 8, '#fff')}<circle cx="24" cy="19" r="2.2" fill="#ffd84a"/><path d="M19 34c2-4 5-4 6 0 1-3 4-4 6-1" stroke="#7fe3d2" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  pause: svg(`<rect x="13" y="11" width="8" height="26" rx="3" fill="#fff"/><rect x="27" y="11" width="8" height="26" rx="3" fill="#fff"/>`),
  close: svg(`<path d="M14 14l20 20M34 14 14 34" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`),
  pencil: svg(`<path d="M9 39l3-11L31 9l8 8-19 19z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M27 13l8 8" stroke="currentColor" stroke-width="4"/>`),
  pin: svg(`<path d="M24 43S10 28 10 19a14 14 0 0 1 28 0c0 9-14 24-14 24z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="24" cy="19" r="4.5" fill="currentColor"/>`),
  eraser: svg(`<path d="M8 30 26 12l12 12-14 14H14z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M18 20l12 12M16 38h26" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`),
  undo: svg(`<path d="M16 12 7 20l9 8" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 20h20a11 11 0 0 1 0 22H18" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`),
  palm: svg(`<path d="M25 44c0-10-1-17-3-24" stroke="#b9834f" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M22 20C14 14 8 16 5 21c6-2 11-1 17-1zM22 20c0-9 5-13 11-14-2 5-5 9-11 14zM22 20c8-5 15-3 20 2-7-1-13-2-20-2zM22 20c-6-8-13-9-18-6 7 1 12 2 18 6z" fill="#3fb3a6"/>`),
  search: svg(`<circle cx="21" cy="21" r="12" fill="none" stroke="currentColor" stroke-width="5"/><path d="M30 30l11 11" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`),
  tail: svg(`<path d="M24 44c-1-9 0-15 0-20-6 1-14-2-19-10 8 0 14 2 19 7 5-5 11-7 19-7-5 8-13 11-19 10 0 5 1 11 0 20z" fill="currentColor"/>`),
  shirt: svg(`<path d="M17 7c2 3 12 3 14 0l11 6-5 9-5-2v21H16V20l-5 2-5-9z" fill="currentColor"/>`),
  star: svg(`<path d="M24 5l5.6 12.3 13.4 1.5-10 9 2.8 13.2L24 34.3 12.2 41 15 27.800 5 18.800l13.400-1.500z" fill="currentColor"/>`),
  sound: svg(`<path d="M8 19v10h8l10 8V11l-10 8z" fill="currentColor"/><path d="M32 17c3 4 3 10 0 14M37 12c6 7 6 17 0 24" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  rotate: svg(`<rect x="15" y="6" width="18" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="3.500"/><path d="M6 30c0 8 6 13 14 13M40 18C40 10 34 5 26 5" stroke="currentColor" stroke-width="3.500" fill="none" stroke-linecap="round"/>`),
};
