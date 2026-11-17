import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vite';

const SW_FILE = 'sw.js';
const SKIP = /(^|\/)\.|\.map$/; // dotfiles (.DS_Store) and sourcemaps

// Runtime for the generated service worker. FILES and VERSION are prepended at build time.
// URLs resolve against sw.js's own location, so the build works from any subdirectory.
const SW_RUNTIME = `
const SCOPE = self.registration.scope;
const PREFIX = 'farshore-precache:' + SCOPE + ':';
const CACHE = PREFIX + VERSION;
const URLS = FILES.map((f) => new URL(f, self.location).href);
const PRECACHED = new Set(URLS);
const INDEX = new URL('index.html', self.location).href;

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(URLS.map(async (url) => {
    const res = await fetch(new Request(url, { cache: 'reload' }));
    if (!res.ok) throw new Error('precache failed: ' + url + ' ' + res.status);
    // Safari refuses redirected responses for navigations, so store a clean copy.
    const clean = res.redirected
      ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
      : res;
    await cache.put(url, clean);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(req, { ignoreSearch: true })) || (await cache.match(INDEX)) || fetch(req);
    })());
    return;
  }

  url.hash = '';
  if (!PRECACHED.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(url.href)) || fetch(req);
  })());
});
`;

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : e.isFile() ? [join(dir, e.name)] : []);
}

// Emits sw.js listing every build output file. The cache version is a hash of all file
// contents plus the runtime, so any change to the build produces a fresh cache.
function offlineServiceWorker() {
  let config;
  return {
    name: 'farshore-offline-sw',
    apply: 'build',
    enforce: 'post', // run after Vite's HTML/CSS plugins have added index.html and CSS to the bundle
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle(_options, bundle) {
      const files = new Map();
      const pub = config.publicDir;
      if (pub && config.build.copyPublicDir !== false && existsSync(pub)) {
        for (const abs of listFiles(pub)) files.set(relative(pub, abs).split(sep).join('/'), readFileSync(abs));
      }
      for (const out of Object.values(bundle)) {
        files.set(out.fileName, out.type === 'chunk' ? out.code : out.source);
      }
      files.delete(SW_FILE);

      const names = [...files.keys()].filter((n) => !SKIP.test(n)).sort();
      const hash = createHash('sha256').update(SW_RUNTIME);
      for (const name of names) hash.update(`\0${name}\0`).update(files.get(name));
      const version = hash.digest('hex').slice(0, 12);

      this.emitFile({
        type: 'asset',
        fileName: SW_FILE,
        source: `const VERSION = ${JSON.stringify(version)};\nconst FILES = ${JSON.stringify(names, null, 2)};\n${SW_RUNTIME}`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  server: { host: true },
  plugins: [offlineServiceWorker()],
});
