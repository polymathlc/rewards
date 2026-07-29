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
`polymathlc/cer` → `pdf-annotator.html` is wired into this reward system and shares this Firebase
project. When a student revises a saved worksheet there (Revise mode, typing keywords from
memory) the annotator, straight from the student's own session:

- tops up `students.marks` — `ANNOTATOR_KEYWORD_MARKS` (2) per keyword found for the first time,
  plus a one-off `ANNOTATOR_COMPLETE_BONUS` (5) for finding every keyword on a worksheet;
- appends an `awards` row with `source: "annotator"`, so it shows in the student's marks history
  and can be undone like any other award;
- damages the active `bosses` — same as a test-paper upload;
- writes `annotatorRuns/{uid}__{worksheetId}` holding `foundWords`, the keywords already paid
  for, which is what makes the award idempotent. Never award marks without re-checking that list
  inside the transaction.

`config/links` (`{ annotatorUrl, rewardsUrl }`) is edited by the admin on the **Worksheet
revision** tab and is how the two apps point at each other — do not hard-code deploy URLs beyond
the fallbacks.

**Both sides ship together.** `ANNOTATOR_KEYWORD_MARKS` / `ANNOTATOR_COMPLETE_BONUS` here must
stay equal to `KEYWORD_MARKS` / `COMPLETE_BONUS` in `pdf-annotator.html`, and any change to the
`annotatorRuns` shape needs a matching change in the other repo. Push and merge both.

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
