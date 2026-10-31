// The student's first sign-in, in a real browser: level → class → name → "That's me".
//
//   PW=/path/to/playwright/index.mjs node tools/find-your-name-browser.mjs
//   NAME_SCREENSHOTS=artifacts/name saves a picture of each step.
//
// Firebase is replaced by an in-memory stand-in (window.firebase is defined
// before the page's own script runs, and the CDN scripts are answered with
// nothing), so nothing here reads or writes the real project. The roster holds
// the records that used to go missing: a pupil filed under the wrong level for
// his class, and a pupil with no level whose class has no level anywhere.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function loadPlaywright() {
  const candidates = [process.env.PW, 'playwright', '/opt/npm-tools/node_modules/playwright/index.mjs', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const candidate of candidates) {
    try { return await import(candidate); } catch (error) { /* try the next one */ }
  }
  throw new Error('Playwright not found — set PW=/path/to/playwright/index.mjs');
}
const { chromium } = await loadPlaywright();

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((request, response) => {
  let relative = decodeURIComponent(request.url.split('?')[0]);
  if (relative.endsWith('/')) relative += 'index.html';
  const file = path.join(repoRoot, relative);
  if (!file.startsWith(repoRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://localhost:${server.address().port}`;
const shots = process.env.NAME_SCREENSHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });

const P6 = 'P6 Science — Friday 5pm';
const MATHS = 'Maths — Tuesday 7pm';
const SEED = {
  a: { name: 'Amy', level: 'P6', slots: [P6], marks: 10, uid: null, email: null },
  b: { name: 'Ben', level: 'P6', slots: [P6], marks: 20, uid: 'someone-else', email: 'ben@example.com' },
  e: { name: 'Ethan', level: 'P5', slots: [P6], marks: 0, uid: null, email: null },   // added from Ans Key with a P5 worksheet open
  z: { name: 'Zara', level: '', slots: [MATHS], marks: 0, uid: null, email: null }     // added from Ans Key with no level, new class
};

// Runs in the page before anything else. A small Firestore: collections of
// plain objects, where('==')/limit, get, onSnapshot that fires on every write.
function fakeFirebase(seed) {
  const user = { uid: 'student-uid', email: 'ethan@example.com', displayName: 'Ethan' };
  const DELETE = { __delete: true };
  const data = { students: new Map(Object.entries(seed)) };
  const subs = new Set();
  const table = name => { if (!data[name]) data[name] = new Map(); return data[name]; };
  const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const docSnap = (name, id) => {
    const d = table(name).get(id);
    return { id, exists: d !== undefined, data: () => copy(d), ref: docRef(name, id) };
  };
  const querySnap = docs => ({ empty: !docs.length, size: docs.length, docs, forEach(f) { docs.forEach(f); } });
  function fire() { subs.forEach(s => setTimeout(() => s.push(), 0)); }
  function docRef(name, id) {
    return {
      id,
      get: async () => docSnap(name, id),
      set: async (v) => { table(name).set(id, copy(v)); fire(); },
      update: async (patch) => {
        const cur = table(name).get(id);
        if (cur === undefined) throw new Error('No document to update');
        Object.entries(patch).forEach(([k, v]) => { if (v && v.__delete) delete cur[k]; else cur[k] = copy(v); });
        fire();
      },
      delete: async () => { table(name).delete(id); fire(); },
      onSnapshot(cb) { const s = { push: () => cb(docSnap(name, id)) }; subs.add(s); s.push(); return () => subs.delete(s); },
      collection: (sub) => query(name + '/' + id + '/' + sub)
    };
  }
  function query(name, filters = [], lim = Infinity) {
    const rows = () => [...table(name).keys()]
      .filter(id => filters.every(([f, op, v]) => { const x = table(name).get(id)[f]; return op === '==' ? x === v : op === 'array-contains' ? Array.isArray(x) && x.includes(v) : true; }))
      .slice(0, lim).map(id => docSnap(name, id));
    return {
      where: (f, op, v) => query(name, filters.concat([[f, op, v]]), lim),
      orderBy: () => query(name, filters, lim),
      limit: (n) => query(name, filters, n),
      get: async () => querySnap(rows()),
      onSnapshot(cb) { const s = { push: () => cb(querySnap(rows())) }; subs.add(s); setTimeout(s.push, 0); return () => subs.delete(s); },
      doc: (id) => docRef(name, id || Math.random().toString(36).slice(2)),
      add: async (v) => { const id = Math.random().toString(36).slice(2); table(name).set(id, copy(v)); fire(); return docRef(name, id); }
    };
  }
  const db = {
    collection: (name) => query(name),
    batch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
    runTransaction: async (fn) => fn({ get: (r) => r.get(), set() {}, update() {}, delete() {} })
  };
  const firestore = () => db;
  firestore.FieldValue = { serverTimestamp: () => null, delete: () => DELETE, increment: (n) => n };
  const auth = () => ({ onAuthStateChanged(cb) { setTimeout(() => cb(user), 0); return () => {}; }, signOut: async () => {}, signInWithPopup: async () => {}, currentUser: user });
  auth.GoogleAuthProvider = function () {};
  window.firebase = {
    initializeApp() {},
    auth, firestore,
    storage: () => ({ ref: () => ({ child() { return this; }, put: async () => ({}), getDownloadURL: async () => '' }) })
  };
  // Test hooks.
  window.__fake = {
    student: (id) => copy(table('students').get(id)),
    add: (id, v) => { table('students').set(id, copy(v)); fire(); }
  };
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
let failures = 0;
async function step(label, fn) {
  try { await fn(); console.log('ok   ' + label); }
  catch (e) { failures++; console.log('FAIL ' + label + '\n     ' + (e && e.message || e)); }
}

async function openSetup(viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => { failures++; console.log('FAIL page error: ' + e.message); });
  await page.route(/gstatic\.com\/firebasejs\//, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, body: '' }));
  await page.addInitScript(fakeFirebase, SEED);
  await page.goto(base + '/index.html');
  await page.waitForSelector('#setupView:not(.hidden)');
  await page.waitForFunction(() => document.querySelectorAll('#pickLevel option').length > 1);
  return { context, page };
}
const optionTexts = (page, sel) => page.$$eval(sel + ' option', os => os.map(o => o.textContent));

for (const [label, viewport] of [['computer', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
  const { context, page } = await openSetup(viewport);

  await step(`${label}: every level on offer, and "Not sure"`, async () => {
    const levels = await optionTexts(page, '#pickLevel');
    assert.deepEqual(levels, ['— choose —', 'P5', 'P6', 'Not sure — show every class']);
  });

  await step(`${label}: Ethan, filed as P5 in a P6 class, is found under P6`, async () => {
    await page.selectOption('#pickLevel', 'P6');
    assert.deepEqual(await optionTexts(page, '#pickSlot'), ['— choose —', P6]);
    await page.selectOption('#pickSlot', P6);
    const names = await optionTexts(page, '#pickName');
    assert.deepEqual(names, ['— choose —', 'Amy', 'Ethan'], 'Ethan must be listed with his class; Ben is claimed and must not be');
    assert.equal(await page.$eval('#linkStudentBtn', b => b.disabled), true);
    if (shots) await page.screenshot({ path: path.join(shots, `${label}-1-found.png`), fullPage: true });
  });

  await step(`${label}: Zara (no level, a class with no level) is reachable through "Not sure"`, async () => {
    await page.selectOption('#pickLevel', '*');
    assert.deepEqual(await optionTexts(page, '#pickSlot'), ['— choose —', MATHS, P6]);
    await page.selectOption('#pickSlot', MATHS);
    assert.deepEqual(await optionTexts(page, '#pickName'), ['— choose —', 'Zara']);
  });

  await step(`${label}: a name the teacher adds appears without a reload, and choices survive`, async () => {
    await page.selectOption('#pickLevel', 'P6');
    await page.selectOption('#pickSlot', P6);
    await page.selectOption('#pickName', { label: 'Amy' });
    await page.evaluate(([cls]) => window.__fake.add('n', { name: 'Nadia', level: 'P6', slots: [cls], marks: 0, uid: null, email: null }), [P6]);
    await page.waitForFunction(() => [...document.querySelectorAll('#pickName option')].some(o => o.textContent === 'Nadia'));
    assert.equal(await page.$eval('#pickLevel', s => s.value), 'P6');
    assert.equal(await page.$eval('#pickSlot', s => s.value), P6);
    assert.equal(await page.$eval('#pickName', s => s.selectedOptions[0].textContent), 'Amy', 'the name already chosen stays chosen');
    assert.equal(await page.$eval('#linkStudentBtn', b => b.disabled), false);
  });

  await step(`${label}: "That's me" links the account and opens the student view`, async () => {
    await page.selectOption('#pickName', { label: 'Ethan' });
    await page.click('#linkStudentBtn');
    await page.waitForSelector('#studentView:not(.hidden)');
    assert.equal(await page.$eval('#setupView', el => el.classList.contains('hidden')), true);
    assert.equal(await page.$eval('#studentNameTop', el => el.textContent), 'Ethan');
    const rec = await page.evaluate(() => window.__fake.student('e'));
    assert.equal(rec.uid, 'student-uid');
    assert.equal(rec.email, 'ethan@example.com');
    if (shots) await page.screenshot({ path: path.join(shots, `${label}-2-linked.png`), fullPage: true });
  });

  await step(`${label}: the setup page fits the screen`, async () => {
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(wide <= 1, 'page scrolls sideways by ' + wide + 'px');
  });

  await context.close();
}

await browser.close();
server.close();
if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nAll checks passed.');
