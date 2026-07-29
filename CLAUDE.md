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

## Linked app — the PDF Annotator (separate repo)
`polymathlc/cer` → `pdf-annotator.html` shares this Firebase project and can award marks into this
system. Its **Reward** button is **admin-only**: it opens the students of one class (the worksheet's
saved `slot`, or whichever class the admin picks) and hands out marks on the spot. Each award,
from the admin's own session:

- updates `students.marks`;
- appends an `awards` row with `source: "annotator"`, so it appears in the student's marks history
  here and can be undone like any other award;
- damages the active `bosses`, the same way a test-paper upload does.

There is **no student-facing earning path in the annotator** — students earn in this app. Nothing
in the annotator is visible to a student account, so don't add UI here that assumes otherwise.

**Both sides ship together.** The annotator writes the same `awards` shape this app's `awardDoc()`
produces; change one and you change the other. Push and merge both.

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
