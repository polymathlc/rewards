// node --test tools/find-your-name-tests.mjs
//
// A student links their account by choosing level → class → name. These run
// the SHIPPED picker (cut out of index.html) against the records that went
// missing: a pupil filed under a different level from his class (the Ans Key
// Reward window used to prefill the worksheet's level), a pupil with no level
// at all, and levels typed in different spellings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function cut(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  assert.ok(a !== -1, 'missing marker: ' + startMarker);
  const b = html.indexOf(endMarker, a);
  assert.ok(b !== -1, 'missing marker: ' + endMarker);
  return html.slice(a, b);
}

const slotsSrc = cut('function studentSlots(s) {', 'function slotsText(s) {');
const pickSrc = cut('// ---------- FINDING YOUR NAME (pure) ----------', '// ---------- End finding your name ----------');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(slotsSrc + pickSrc +
  ';this.setupChoices = setupChoices; this.normLevel = normLevel;' +
  'this.PICK_ANY_LEVEL = PICK_ANY_LEVEL; this.PICK_NO_CLASS = PICK_NO_CLASS;', ctx);
const { setupChoices, normLevel, PICK_ANY_LEVEL, PICK_NO_CLASS } = ctx;
// Values built inside the vm carry its own Array prototype; copy them out so
// deepStrictEqual compares contents, not realms.
const plain = v => JSON.parse(JSON.stringify(v));
const names = (c, slot) => plain(c.namesFor(slot).map(n => n.label));

const P6 = 'P6 Science — Friday 5pm';
const P4 = 'P4 Science — Saturday 9am';
const roster = [
  { id: 'a', name: 'Amy', level: 'P6', slots: [P6], uid: null },
  { id: 'b', name: 'Ben', level: 'P6', slots: [P6], uid: 'claimed-uid' },
  { id: 'e', name: 'Ethan', level: 'P5', slots: [P6], uid: null },     // wrong level for his class
  { id: 'f', name: 'Faris', level: '', slots: [P4], uid: null },       // no level, class nobody else is in
  { id: 'g', name: 'Gwen', level: '', slots: [P6], uid: null },        // no level, class with levels
  { id: 'h', name: 'Hana', level: 'p4', slot: 'P4 Science — Saturday 9am', uid: null } // older single-slot record, lower-case level
];

test('the level is normalised the way a teacher types it', () => {
  for (const v of ['P5', 'p5', 'P 5', 'p.5', 'Pri 5', 'primary 5', '  Primary   5 ']) assert.equal(normLevel(v), 'P5', v);
  for (const v of ['S1', 's1', 'Sec 1', 'secondary 1']) assert.equal(normLevel(v), 'S1', v);
  assert.equal(normLevel(''), '');
  assert.equal(normLevel(null), '');
  assert.equal(normLevel(undefined), '');
  assert.equal(normLevel('  Sec 1 Express '), 'Sec 1 Express');   // unrecognised: kept, trimmed
});

test('a pupil filed under the wrong level is found under his class', () => {
  const c = setupChoices(roster);
  assert.ok(plain(c.slotsFor('P6')).includes(P6));
  const list = names(c, P6);
  assert.ok(list.includes('Ethan'), 'Ethan (P5) is in the P6 class and must be listed there');
  assert.ok(list.includes('Amy'));
  assert.ok(!list.includes('Ben'), 'a claimed record is never offered again');
  // …and under his own (wrong) level too, in case that is the one he picks.
  assert.ok(plain(c.slotsFor('P5')).includes(P6));
});

test('a pupil with no level is reachable', () => {
  const c = setupChoices(roster);
  // Gwen has no level, but her class does: she is under P6.
  assert.ok(names(c, P6).includes('Gwen'));
  // Faris has no level and shares his class only with a lower-case "p4", which
  // is normalised — so P4 offers his class.
  assert.ok(plain(c.slotsFor('P4')).includes(P4));
  assert.deepEqual(names(c, P4), ['Faris', 'Hana']);
  // A blank level is never a level option (it would read as the placeholder).
  assert.ok(!plain(c.levels).includes(''));
  assert.deepEqual(plain(c.levels), ['P4', 'P5', 'P6']);
});

test('"Not sure" offers every class with an unclaimed name', () => {
  const lonely = [{ id: 'z', name: 'Zara', level: '', slots: ['Maths — Tuesday 7pm'], uid: null }];
  const c = setupChoices(roster.concat(lonely));
  assert.ok(c.any);
  assert.deepEqual(plain(c.slotsFor(PICK_ANY_LEVEL)), ['Maths — Tuesday 7pm', P4, P6]);
  assert.deepEqual(names(c, 'Maths — Tuesday 7pm'), ['Zara']);
  // Zara's class has no level anywhere, so only "Not sure" reaches it.
  for (const lv of c.levels) assert.ok(!plain(c.slotsFor(lv)).includes('Maths — Tuesday 7pm'));
});

test('a record with no class at all is still reachable under "Not sure"', () => {
  const c = setupChoices([{ id: 'n', name: 'Nobody', level: 'P5', slots: [], uid: null }]);
  assert.deepEqual(plain(c.slotsFor(PICK_ANY_LEVEL)), [PICK_NO_CLASS]);
  assert.deepEqual(names(c, PICK_NO_CLASS), ['Nobody']);
  assert.deepEqual(plain(c.slotsFor('P5')), []);
});

test('a class whose every name is claimed is not offered', () => {
  const c = setupChoices([{ id: 'b', name: 'Ben', level: 'P6', slots: [P6], uid: 'x' }]);
  assert.equal(c.any, false);
  assert.deepEqual(plain(c.levels), []);
  assert.deepEqual(plain(c.slotsFor(PICK_ANY_LEVEL)), []);
});

test('two records with one name in one class are told apart', () => {
  const c = setupChoices([
    { id: '1', name: 'Ethan', level: 'P6', slots: [P6], uid: null },
    { id: '2', name: 'ethan ', level: '', slots: [P6], uid: null },
    { id: '3', name: 'Amy', level: 'P6', slots: [P6], uid: null }
  ]);
  const list = plain(c.namesFor(P6));
  assert.deepEqual(list.map(n => n.label), ['Amy', 'Ethan (P6)', 'ethan (no level)']);
  assert.deepEqual(list.map(n => n.id), ['3', '1', '2']);
});

test('nothing chosen offers nothing', () => {
  const c = setupChoices(roster);
  assert.deepEqual(plain(c.slotsFor('')), []);
  assert.deepEqual(plain(c.namesFor('')), []);
});

test('the setup screen uses the picker, stays live and lets go of its listener', () => {
  const boot = cut('async function bootStudent() {', 'function showStudentMain() {');
  assert.match(boot, /setupChoices\(/);
  assert.match(boot, /choices\.namesFor\(/);
  // The old filter that hid the names: matching the record's level as well as its class.
  assert.doesNotMatch(boot, /s\.level\s*===\s*lv/);
  assert.match(boot, /unsubSetup\s*=\s*db\.collection\("students"\)\.onSnapshot/);
  assert.match(boot, /unsubSetup\(\);\s*unsubSetup\s*=\s*null;/, 'linking the account must stop the setup listener');
  const auth = cut('auth.onAuthStateChanged(async (user) => {', 'function wireLogoPaste() {');
  assert.match(auth, /unsubMyHistory, unsubSetup\]\.forEach/, 'sign-out must tear the setup listener down');
  assert.match(auth, /unsubSetup = null;/);
});
