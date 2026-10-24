# CLAUDE.md

Guidance for Claude when working in this repo.

## Apps
- `index.html` — **"Polymath Learning Centre Point System"**: the reward system. One self-contained
  file (markup + CSS + JS), on the shared `mathgen--app` Firebase project with Google sign-in.
  Admin (`chungzhikai@gmail.com`) manages students, awards/deducts marks, runs the timetable,
  rewards, bosses, item shop, claims and test papers; students link their Google account to a
  student record once, then earn and spend marks. Firestore collections: `students`, `awards`
  (append-only ledger), `rewards`, `claims`, `testPapers`, `shopItems`, `purchases`, `bosses`,
  `annotatorRuns`, `config/branding`, `config/links`. The recommended Firestore + Storage rules
  live in the big comment block near the top of the file — keep them in step with the code.
- `monster-cards-beta.html` — Monster Codex trading-card beta.

## 📲 Installable app (Polymath install kit v2.0.0)
Since **v1.3.0** the Point System installs as **Polymath Rewards** ("Rewards" under the icon) on PC,
Android and iPhone/iPad. It is a Progressive Web App, not a store app.

- **The offline page carries its icon inline (sw 2.0.1, kit v2.0.1).** `sw.js` answers page loads only, so an
  icon file beside `offline.html` could never arrive with no connection (it showed as a broken picture).
  The icon is a `data:` URI inside `offline.html`, `PRECACHE` is just the offline page, and `SW_VERSION`
  went to 2.0.1 so installed copies re-cache it. The browser harness now checks the icon shows offline.

- **The files.** `manifest.webmanifest` (relative `id` / `start_url` / `scope` = `./`, so the same file
  works at `polymathlc.com.sg/rewards/` and on github.io), the icons in `assets/app-icons/` (192/512
  `any`, 192/512 `maskable`, 180 `apple-touch-icon`, 32 favicon — drawn by the kit), `sw.js`,
  `offline.html`, `pwa-install.js`, and the head tags in `index.html` (manifest, theme-color, favicon,
  apple-touch-icon, apple-mobile-web-app-*, and the inline `[data-pwa-install][data-pwa-hidden]` hiding
  rule). The installer is loaded once, just before `</body>`, as a classic
  `<script defer src="pwa-install.js?v=2.0.0" …>` whose `data-*` attributes name the app, its key
  (`rewards`), icon and accent.
- **`pwa-install.js` is byte for byte the kit shared with every Polymath app** (polymathlc/cer
  `student/` and `online/` carry copies, as do the other app repos). Never fork it or patch it here:
  change it in all of them together, and bump the `?v=` on every tag that loads it. Repo-local tweaks
  (e.g. moving the floating button) go in `index.html`'s own CSS.
- **`sw.js` never caches the app.** It answers only same-origin GET page loads (navigations), network
  first, and shows `offline.html` when the network fails; scripts, Firebase, Storage, POSTs and other
  origins are never touched, so releases still reach phones straight away. It uses its own cache prefix,
  `polymath-rewards-shell-`, because every app lives on the one polymathlc.com.sg origin and shares its
  Cache Storage — it only ever deletes its own old caches.
- **The controls.** Every `[data-pwa-install]` control starts `data-pwa-hidden`; the installer shows it,
  and keeps it hidden inside the installed app and when the page is inside another page's frame. The
  header control is `#installAppBtn` (📲 Install app) in the `.topbar`, between the e-mail and
  **Sign out** — outside every admin-only block, so students and the admin both see it once signed in.
  It is a `.btn ghost` like Sign out; on a phone (≤ 600px) the topbar wraps onto a second row so both
  buttons stay on screen.
  Pressing it uses the browser's own install prompt where there is one (Chrome / Edge on a computer,
  Chrome on Android), else shows the steps for that browser (iPhone/iPad: Share → Add to Home Screen).
  The sign-in screen has no control of its own, so the kit's small floating button (bottom right,
  `data-floating="auto"`) covers it; nothing of this app sits at the bottom right, so it needs no nudge.
- **Run after touching any of it** (CI runs both on every PR, `.github/workflows/installable-app.yml`):
  `node --test tools/pwa-install-tests.mjs` and
  `PW=/path/to/playwright/index.mjs node tools/pwa-install-browser.mjs`
  (`PWA_SCREENSHOTS=some/folder` saves a picture of each step).

## Linked app — the Ans Key annotator (separate repo)
`polymathlc/anskey` → `index.html` shares this Firebase project and can award marks into this
system. Its **Reward** button is **admin-only**: it opens the students of one class (guessed from
the worksheet's day, level and lesson time, then pinned to the worksheet as `rewardClass`, and
always changeable in the dropdown) and hands out marks on the spot. Each award, from the admin's
own session:

- updates `students.marks`;
- appends an `awards` row with `source: "annotator"`, so it appears in the student's marks history
  here and can be undone like any other award;
- damages the active `bosses`, the same way a test-paper upload does.

The annotator's Reward window also edits the roster: it can add a `students` doc for a new name in
the class shown, drop a class from a student's `slots`, or delete a `students` doc outright — the
same operations as the Students tab here, just reachable mid-lesson. A student removed from a class
keeps their record, marks and history; only *Delete entirely* removes the doc.

There is **no student-facing earning path in the annotator** — students earn in this app. Nothing
in the annotator is visible to a student account, so don't add UI here that assumes otherwise.

**Both sides ship together.** The annotator writes the same `awards` shape this app's `awardDoc()`
produces; change one and you change the other. Push and merge both.

The older annotator in `polymathlc/cer` (`pdf-annotator.html`) used to do this and no longer does —
the Reward window was moved to `polymathlc/anskey`. Don't reinstate it there.

## Versioning convention — applies to EVERY change (do this every time)
1. **Bump the version.** In `index.html`, update `const APP_VERSION = "vX.Y.Z"` (search
   `APP_VERSION`). Patch bump for fixes/small tweaks, minor bump for new features.
2. **Keep it visible.** It renders in the topbar for admins only (`#appVersionBadge`). This is how
   the user confirms the latest build is actually deployed.
3. **Report it.** When summarising an update in chat, always state the new version number
   (e.g., "Shipped in **v1.1.0**").

The whole point: the user checks the version shown in the app against the number reported in chat
to know whether the upload/deploy went through.

## Design convention — breathing space (applies to EVERY UI you build/touch)
- Give elements room to breathe: generous, consistent padding inside cards/banners, clear vertical
  spacing between title → description → meta → buttons, and comfortable line-height. Never cram
  content edge-to-edge or stack lines tightly.
- Cards/banners are rounded rectangles constrained to a sensible max-width (not full page width)
  and centered — not a dense, full-bleed block.
- When the user says something is "too big/thick/messy", the fix is usually *more* whitespace and a
  tighter width, not shrinking fonts until it's cramped.
- Keep spacing scale consistent across the whole app so every surface feels like the same design
  system.

## House rules
- After editing `index.html`, syntax-check the script block, e.g.
  `python3 -c "import re;open('/tmp/c.js','w').write(re.findall(r'<script>\n(.*?)\n</script>', open('index.html').read(), re.S)[-1])" && node --check /tmp/c.js`
- Commit messages and pushed artifacts must not contain the model identifier.
