# Writhdeck plugin for LionWiki-t2t

Replaces LionWiki's classic edit `<textarea>` with the **writhdeck-web** editor
(colour-syntax txt2tags overlay, themes, typewriter focus mode, TOC, search) —
on **any template**, without editing the templates or `index.php`.

## Enable / disable (config key)

The plugin can sit in `plugins/` without changing anything: it stays **inert**
until explicitly enabled in `config.php` (non-disruptive).

- **Enable**  : add `$WRITHDECK_EDITOR = true;` to `config.php`.
- **Disable** : remove that line (or set it to `false`) → classic template
  editing returns. No other file to touch.

(The `plugins/Writhdeck/` folder must be present next to `wkp_Writhdeck.php`.)

## How it works

`plugin('template')` runs inside `index.php` **before** the `{PLACEHOLDER}`
substitution and before output. On `edit`/`preview` only, `Writhdeck::template()`
injects, right before `</body>`:

1. `style.css` + `wiki.css` (writhdeck stylesheet + integration glue);
2. `<div id="writhdeck-app" hidden>` containing the writhdeck DOM (`body.html`);
3. `wiki-backend.js` then `writhdeck.js` (in that order — see below).

`wiki-backend.js` defines `window.WRITHDECK_BACKEND` (which writhdeck's
`backend.js` picks up instead of IndexedDB): the single "document" is the page
being edited, bound to the native `<textarea id="inputPane">`. Saving copies the
content into that textarea and **submits the native LionWiki form**, so conflict
detection, password, edit summary, rename and history are all still handled by
LionWiki.

`wiki.css` overlays `#writhdeck-app` full-screen (`position:fixed`) on top of the
host template, which keeps the plugin template-agnostic.

## Files

| File | Purpose | Generated? |
|---|---|---|
| `../wkp_Writhdeck.php` | Plugin (`template` hook) | no |
| `writhdeck.js` | writhdeck JS bundle (`build.py --script`) | **yes** |
| `style.css`    | writhdeck stylesheet (`build.py --style`) | **yes** |
| `body.html`    | writhdeck DOM (`build.py --body`, base64 logos stripped) | **yes** |
| `wiki-backend.js` | `DB`→LionWiki storage adapter + bootstrap | no |
| `wiki.css`     | Integration glue (full-screen overlay) | no |
| `sync-assets.py` | Regenerates the three generated files | no |

`writhdeck-web` (default `~/src/writerdeck/writhdeck-web`) stays the **single
source of truth**. Never hand-edit `writhdeck.js`, `style.css` or `body.html`.

## Regenerate after a writhdeck-web update

```bash
python3 plugins/Writhdeck/sync-assets.py            # or: … sync-assets.py /path/to/writhdeck-web
```

### Seams added to writhdeck-web (backward-compatible)

- `src/backend.js`: `const DB = window.WRITHDECK_BACKEND || IndexedDbBackend;`
  (the storage layer becomes swappable; `db.js` exports `IndexedDbBackend`).
- end of `init()` (`src/app.js`): calls `window.WRITHDECK_ON_READY({Editor, …})`
  when defined, to drive the app after initialisation.

## Editing UX in the wiki

Saving is done with `fetch` (AJAX) so you **stay in the editor** — only the
Close button leaves it. The adapter overrides `Editor.save` / `saveAs` / `close`
(the shared object methods), so every trigger — menu, `Ctrl+S`, `Ctrl+Shift+S`,
`Ctrl+Q` / `Ctrl+Shift+Q`, command mode — is covered. Upstream writhdeck-web is
untouched.

- **Save** — `Ctrl+S` or the ≡ menu → **Save**. Saves the page and stays in the
  editor (no navigation).
- **Save as (rename)** — the ≡ menu → **Save as (rename)** (or `Ctrl+Shift+S`).
  Repurposed to **rename/move the page** via LionWiki's native `moveto` field:
  prompts for a new name, saves the content under it, moves the history, and
  keeps editing under the new name. (Upstream keeps its disk/copy "Save as".)
- **Close** (✕, `Ctrl+Q`, `Ctrl+Shift+Q`, cmd `q`) — the only way to leave. If
  there are unsaved changes it shows the Yes/No/Cancel "save before leaving?"
  prompt, then returns to the reading view. The writhdeck file browser is never
  shown (it was meaningless and unsafe for a single page).
- **Autosave is disabled** (`window.WRITHDECK_AUTOSAVE = false`) so a long edit
  doesn't flood the page history; save explicitly. The wiki password is asked
  via `prompt()` if required (kept in the form's `sc` field for the session).
  The native Preview is not exposed. Settings/theme persist in `localStorage`.

## Limitations (phase 1) & next steps

- **Single-document**: only the current page is editable; the writhdeck file
  browser and its dialogs are present but inactive.

**Phase 2 (planned)**: a small JSON API in `index.php` (`action=list|raw|save`
+ `&ajax=1`) to drive the full writhdeck **page browser** (listing + namespaces)
against the wiki backend, replacing the single-document `wiki-backend.js`.
