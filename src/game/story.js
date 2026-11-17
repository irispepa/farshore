// Chapter one: Sheltered Cove. Original fiction; Hawaiian words are used sparingly and plainly
// (Tūtū: grandparent, waʻa: canoe, koholā: humpback whale).

export const MAP = { x0: -52, x1: 150, z0: -74, z1: 66, w: 1010, h: 700 };
export const mapU = (x) => (x - MAP.x0) / (MAP.x1 - MAP.x0);
export const mapV = (z) => (z - MAP.z0) / (MAP.z1 - MAP.z0);

export const OBJECTIVES = [
  'Find Tūtū’s tin where the sea sings in the rock',
  'Watch for the koholā beyond the reef',
  'Mark the whale’s spot in your atlas',
  'Heading found! Explore the cove',
];

export const CLUES = [
  { id: 'letter', title: 'Tūtū’s letter', text: '“Where the sea sings inside the rock.” Sail the waʻa, or follow the path inland.' },
  { id: 'cave', title: 'Cave mouth', text: 'Too deep to wade. The canoe could slip inside, or the headland above may hide a way down.' },
  { id: 'tin', title: 'Tūtū’s tin', text: 'A snapshot, a shell and a note: watch for the koholā past the reef and mark where she breaches.' },
  { id: 'whale', title: 'Koholā beyond the reef', text: 'A humpback breached north-east of the cove, out past the reef heads.' },
  { id: 'heading', title: 'First heading', text: 'Marked in the atlas. The voyage has a direction now.' },
];

export const TASKS = [
  { clue: 'tin', text: 'Find Tūtū’s tin' },
  { clue: 'whale', text: 'Spot the koholā' },
  { clue: 'heading', text: 'Mark her heading' },
];

export const PLACES = [
  { id: 'landing', name: 'Canoe Landing', x: 8, z: 40, r: 0 },
  { id: 'path', name: 'Path Inland', x: -27, z: -6, r: 9, at: [-19, 2] },
  { id: 'cave', name: 'Sea Cave', x: 36, z: -27, r: 0 },
  { id: 'lookout', name: 'Lookout', x: 79, z: -42, r: 7, at: [76, -35] },
  { id: 'reef', name: 'Reef', x: 82, z: 8, r: 16, at: [80, 6] },
  { id: 'islet', name: 'Islet', x: 97, z: 27, r: 12, at: [96, 20] },
];

export const CARDS = {
  letter: {
    kicker: 'A letter in your pack',
    title: 'Dear explorer,',
    body: `<p>I hid my first marker in this cove long ago, <b>where the sea sings inside the rock</b>.</p>
      <p>Sail the old waʻa, or follow the path inland. Both remember the way.</p>
      <p>Draw what you find in your atlas, so the voyage has a shape.</p><p class="sign">Tūtū</p>`,
    button: 'Start exploring',
  },
  cave: {
    kicker: 'New clue',
    title: 'The cave mouth',
    body: `<p>The sea slides under the headland and echoes back. This must be the singing rock.</p>
      <p>It is too deep to wade. The canoe could slip inside… or maybe there is a way down from above.</p>`,
    button: 'Add to atlas',
  },
  tin: {
    kicker: 'You found it',
    title: 'Tūtū’s tin',
    body: `<p>Inside: a faded snapshot, a pink shell and a note in looping handwriting.</p>
      <p>“You found the singing rock! Now go where you can see past the reef and wait for the <b>koholā</b>. Where she breaches is our heading. Mark it in your atlas so we never lose it.”</p>`,
    button: 'Keep the note',
  },
  whale: {
    kicker: 'Whale sighting',
    title: 'Koholā!',
    body: `<p>A humpback bursts from the sea beyond the reef and crashes down in a cloud of spray.</p>
      <p>Remember where she surfaced.</p>`,
    button: 'Wow',
  },
  sign: {
    kicker: 'Signpost',
    title: 'Two ways on',
    body: `<p><b>Path Inland</b> climbs the stone steps to the headland.</p><p><b>Canoe Landing</b> is back along the sand.</p>`,
    button: 'Okay',
  },
  heading: {
    kicker: 'Atlas updated',
    title: 'A first heading',
    body: `<p>Your mark sits right where the koholā surfaced. Tūtū’s old route runs north-east, out past the reef.</p>
      <p>The voyage has a direction now. Until the waʻa is ready for open water, the cove still has corners to map and looks to find.</p>`,
    button: 'Keep exploring',
  },
  wrongMark: 'Hmm. She surfaced further out, north-east past the reef.',
};

// What each hidden chest holds.
export const LOOT = {
  islet: { slot: 'top', id: 'sunset', where: 'on the islet beyond the reef' },
  shelf: { slot: 'footwear', id: 'seafoam', where: 'at the tip of the lava shelf' },
};
export const lootCard = (name, where) => ({
  kicker: 'New look found',
  title: name,
  body: `<p>Tucked in a little chest ${where}. Someone left this for an explorer.</p><p>Try it on from the <b>Looks</b> page of your journal.</p>`,
  button: 'Cute!',
});

export const HINT = {
  deep: 'Too deep to wade. The waʻa could cross this.',
  edge: 'The open sea is for another chapter.',
  shallow: 'Too shallow here. Steer for deeper water.',
  reef: 'Reef! Look for the darker gaps between the coral heads.',
  markNow: 'Open your journal and mark where she surfaced.',
  spyWait: 'Keep the glass on the open water…',
  sailTip: 'Push forward to fill the sail · steer left and right',
};
