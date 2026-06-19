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
- `Editor.browser()` (`src/editor.js`): a distinct "show the browser" action
  (defaults to `close()` upstream), and a **Quit** + **Browser** pair in the ≡
  menu — so a host can give them different behaviours (here: Quit leaves,
  Browser opens the page list). The ✕ tooltip now reads simply "Quit".

## Editing UX in the wiki

Saving is done with `fetch` (AJAX) so you **stay in the editor**. The adapter
overrides `Editor.save` / `saveAs` / `close` (the shared object methods), so
every trigger — menu, `Ctrl+S`, `Ctrl+Shift+S`, `Ctrl+Q` / `Ctrl+Shift+Q`,
command mode — is covered. Upstream writhdeck-web is untouched (`Editor.browser`
is left at its default — see below).

- **Save** — `Ctrl+S` or the ≡ menu → **Save**. Saves the current page and
  stays in the editor (no navigation).
- **Save as (rename)** — the ≡ menu → **Save as (rename)** (or `Ctrl+Shift+S`).
  Repurposed to **rename/move the page** via LionWiki's native `moveto` field.
- **Quit** (✕, `Ctrl+Q`, `Ctrl+Shift+Q`, ≡ menu → **Quit**, cmd `q`) — leaves
  the editor and returns to the **last edited/visited wiki page** (remembered in
  `localStorage`). Unsaved changes trigger the Yes/No/Cancel "save before
  leaving?" prompt first.
- **Browser** (≡ menu → **Browser**) — opens writhdeck's own **file browser**,
  now listing every editable page in `var/pages/`. Clicking a row edits that
  page in place; **Quit** from the browser returns to the last visited page.
- **Autosave is disabled** (`window.WRITHDECK_AUTOSAVE = false`) so a long edit
  doesn't flood the page history; save explicitly. The wiki password is asked
  via `prompt()` on the first save that needs it (then reused for the session;
  once authenticated the `LW_AUT` cookie keeps saves working). Settings/theme
  persist in `localStorage`.

## Backend (JSON API)

The plugin's `actionBegin()` hook answers a tiny read-only JSON API (gated on
`$WRITHDECK_EDITOR`), used by the file browser. No `index.php` change needed:

| Request | Response |
|---|---|
| `?action=writhdeck_api&op=list` | `{ok, pages:[{name, modified, size}]}` |
| `?action=writhdeck_api&op=raw&page=Foo` | `{ok, name, content, modified}` |
| `POST …&op=savecss` (`vars` = `{scheme,light,dark}`) | `{ok}` — writes `templates/writerdeck/style.css` |

**Theme export (`op=savecss`):** when you pick a colour scheme in the editor's
Settings, `wiki-backend.js` posts the scheme's colours and the plugin writes
`templates/writerdeck/style.css` (the `writerdeck` template loads it to override
its built-in *alt01* palette; delete the file to restore the default). Gated on
`authentified()` **and** a writable `var/pages/`; colour values are validated as
hex server-side (client CSS is never written verbatim). Needs the upstream
`getScheme` exposed via `WRITHDECK_ON_READY`.

Saving still goes through LionWiki's native `action=save` POST (conflict
detection via `last_changed`, password, edit summary, rename, history). Page
names are sanitised with `clear_path()`; `op=raw` returns 404 for unknown pages.

## Quit vs Browser — the seam

Upstream, the ✕/close and "back to browser" are the same thing (there is only
the browser to return to). The plugin keeps them **distinct**:

- `Editor.close` is overridden → **Quit** (leave to the last wiki page).
- `Editor.browser` is left at its upstream default (show the file browser),
  now backed by `var/pages/` via the JSON API + the multi-document
  `WRITHDECK_BACKEND` (`getAllDocs`/`getDoc` read the API; `saveDoc`/`deleteDoc`
  POST native saves; page source is loaded lazily when a row is opened).
