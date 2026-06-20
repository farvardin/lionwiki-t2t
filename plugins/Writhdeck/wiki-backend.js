'use strict';
/*
 * LionWiki-t2t backend + bootstrap for the embedded writhdeck editor.
 *
 * Injected by the Writhdeck plugin (plugins/wkp_Writhdeck.php) BEFORE
 * writhdeck.js, only on edit/preview pages. It binds writhdeck's storage layer
 * to the wiki's pages on disk (var/pages/) so the full writhdeck experience —
 * editor AND file browser — works against the wiki:
 *
 *   1. window.WRITHDECK_BACKEND — the storage interface writhdeck's backend.js
 *      picks up instead of IndexedDB. getAllDocs/getDoc read the wiki page list
 *      and page source through the plugin's JSON API (action=writhdeck_api);
 *      saving POSTs LionWiki's native action=save (conflict detection, password,
 *      edit summary, rename, history are all still handled server-side).
 *
 *   2. The two leave actions are kept DISTINCT (upstream they are identical):
 *        - Quit  (✕ / Ctrl+Q / Ctrl+Shift+Q / menu "Quit")  → Editor.close
 *          overridden: confirm-if-dirty, then LEAVE the editor back to the last
 *          edited/visited wiki page (location change).
 *        - Browser (menu "Browser") → Editor.browser left at its upstream
 *          default (show writhdeck's file browser), now populated with every
 *          editable page in var/pages/. Opening a row edits that page in place;
 *          quitting from the browser also returns to the last visited page.
 *
 *   3. writhdeck's 60s autosave is disabled (window.WRITHDECK_AUTOSAVE = false)
 *      so long edits don't flood the wiki page history; saving is explicit.
 *
 * Settings/theme/cursors live in localStorage (getMeta/setMeta).
 */
(function () {
  var input = document.getElementById('inputPane');
  if (!input) return; // not an edit surface — leave writhdeck inert

  // Saving is explicit here; don't let the 60s autosave spam the page history.
  window.WRITHDECK_AUTOSAVE = false;

  var form      = input.form;
  var endpoint  = (form && form.getAttribute('action')) || location.pathname;
  var entryPage = (form && form.querySelector('[name=page]')) ? form.querySelector('[name=page]').value : '';
  var entryLast = (form && form.querySelector('[name=last_changed]')) ? +form.querySelector('[name=last_changed]').value : 0;

  var api = null;          // set by WRITHDECK_ON_READY; access to writhdeck modules
  var wikiPassword = '';   // cached wiki password for the session (form sc field / prompt)

  function pageHref(name) {
    return location.pathname + '?page=' + encodeURIComponent(name);
  }
  function edText() {
    var ed = document.getElementById('ed-input');
    return ed ? ed.value : (api && api.State.doc ? api.State.doc.content : input.value);
  }

  // --- "last edited/visited page" — where Quit returns to. -------------------
  var LAST_KEY = 'writhdeck:wiki:lastPage';
  var lastPage = entryPage;
  try { lastPage = localStorage.getItem(LAST_KEY) || entryPage; } catch (e) {}
  function rememberPage(name) {
    if (!name) return;
    lastPage = name;
    try { localStorage.setItem(LAST_KEY, name); } catch (e) {}
  }
  rememberPage(entryPage);

  // --- localStorage-backed meta (settings, theme, cursors, recents…) ---------
  var META_PREFIX = 'writhdeck:';
  function getMeta(key) {
    try {
      var raw = localStorage.getItem(META_PREFIX + key);
      return Promise.resolve(raw == null ? undefined : JSON.parse(raw));
    } catch (e) { return Promise.resolve(undefined); }
  }
  function setMeta(key, value) {
    try { localStorage.setItem(META_PREFIX + key, JSON.stringify(value)); } catch (e) {}
    // Settings were (re)saved → mirror the chosen colour scheme to the wiki's
    // template stylesheet (no-op unless the scheme actually changed).
    if (key === 'iniText') syncWikiTheme();
    return Promise.resolve();
  }

  // --- Mirror the editor's colour scheme to templates/writerdeck/style.css ---
  // The wiki keeps "alt01" as its built-in default; picking another scheme in
  // the editor's Settings writes a style.css that overrides it (server-side,
  // gated on auth + a writable var/pages/). Deleting that file restores alt01.
  var lastThemeJson = null;

  // Map the current writhdeck scheme (dark + light "Alt" sets) onto the
  // writerdeck template's CSS variables. Returns {name, payload} or null.
  function buildThemePayload() {
    if (!api || typeof api.getScheme !== 'function') return null;
    var name = api.State.settings.scheme;
    var sc = api.getScheme(name) || {};
    var pick = function (k, alt) { return sc[k] || sc[alt] || ''; };
    var dark = {
      'bg': sc.bg, 'fg': sc.fg, 'bg-bar': sc.bgBar, 'fg-bar': sc.fgBar,
      'bg-sel': sc.bgSel, 'heading': sc.heading, 'comment': sc.comment,
      'link': sc.markup, 'rule': sc.bgBar, 'code-bg': sc.bgBar,
    };
    var light = {
      'bg': pick('bgAlt', 'bg'), 'fg': pick('fgAlt', 'fg'),
      'bg-bar': pick('bgBarAlt', 'bgBar'), 'fg-bar': pick('fgBarAlt', 'fgBar'),
      'bg-sel': pick('bgSelAlt', 'bgSel'), 'heading': pick('headingAlt', 'heading'),
      'comment': pick('commentAlt', 'comment'), 'link': pick('markupAlt', 'markup'),
      'rule': pick('bgBarAlt', 'bgBar'), 'code-bg': pick('bgBarAlt', 'bgBar'),
    };
    // Mode-independent layout/typography settings (margins, fonts, spacing) so
    // the wiki reflects the editor's appearance, not just its colours.
    var s = api.State.settings;
    var layout = {
      'margin-x': s.marginX, 'margin-y': s.marginY,
      'font-size': s.fontSize, 'line-height': s.lineSpacing, 'font': s.fontFamily,
    };
    return {
      name: name,
      payload: JSON.stringify({ scheme: name, light: light, dark: dark, layout: layout }),
    };
  }

  // Automatic sync on settings save. initOnly=true records the current scheme
  // as the baseline without writing, so only a real scheme change (not any
  // settings save) updates style.css.
  var suppressAutoSync = false;
  function syncWikiTheme(initOnly) {
    if (!api || suppressAutoSync) return;
    if (typeof api.getScheme !== 'function') {
      // Old cached bundle without the getScheme seam — make it visible.
      if (!initOnly) api.Editor.setMsg('Wiki theme sync unavailable — reload the editor');
      return;
    }
    var p = buildThemePayload();
    if (!p) return;
    if (p.payload === lastThemeJson) return;  // unchanged scheme — skip the write
    lastThemeJson = p.payload;
    if (initOnly) return;                     // baseline recorded; nothing to write yet
    postThemeCss(p.payload, p.name, false);
  }

  // Explicit "Synchronise backend appearance to frontend" action (the
  // Settings → Profile button). Always writes, regardless of the baseline.
  function applyWikiThemeNow() {
    if (!api) return;
    var noteEl = document.getElementById('wiki-theme-sync-msg');
    var notify = function (text, ok) {
      if (noteEl) { noteEl.textContent = text; noteEl.style.color = ok ? '#3a9d5a' : '#c0392b'; }
      if (api) api.Editor.setMsg(text);       // also the status bar (visible after closing the dialog)
    };
    if (typeof api.getScheme !== 'function') {
      notify('Sync unavailable — reload the editor', false);
      return;
    }
    // Commit any pending Settings-dialog edits first: margins/fonts/spacing are
    // only written to State.settings when "Apply" runs, so without this the
    // sync would read stale values. Suppress the auto-sync it would trigger —
    // we post explicitly below (with inline feedback).
    var applyBtn = document.getElementById('settings-apply');
    if (applyBtn) {
      suppressAutoSync = true;
      try { applyBtn.click(); } finally { suppressAutoSync = false; }
    }
    var p = buildThemePayload();
    if (!p) return;
    lastThemeJson = p.payload;                // keep the auto-sync baseline aligned
    if (noteEl) { noteEl.textContent = 'Saving…'; noteEl.style.color = 'var(--comment)'; }
    postThemeCss(p.payload, p.name, false, notify);
  }

  // POST the validated colours to op=savecss. Like saving a page, this needs
  // the wiki password: on a 403 'auth' we prompt once and retry. Failures are
  // surfaced via the editor status bar (no longer silent).
  // `notify(text, ok)` reports the outcome. Defaults to the status bar, but
  // callers triggered from the (modal) Settings dialog pass an inline notifier
  // so the result — including read-only / permission errors — is actually
  // visible, since the 2-second status-bar message is hidden behind the dialog.
  function postThemeCss(payload, name, retried, notify) {
    notify = notify || function (m) { if (api) api.Editor.setMsg(m); };
    var fd = new FormData();
    fd.set('vars', payload);
    var pwField = form && form.querySelector('input[name=sc]');
    var pw = wikiPassword || (pwField && pwField.value) || '';
    if (pw) fd.set('sc', pw);
    fetch(apiUrl('savecss'), { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http ' + r.status }; }); })
      .then(function (j) {
        if (j && j.ok) { notify('Wiki theme updated (' + name + ')', true); return; }
        var err = j && j.error;
        if (err === 'auth' && !retried) {
          var entered = window.prompt('Wiki password to update the site theme:');
          if (entered === null) { notify('Wiki theme unchanged', false); return; }
          wikiPassword = entered;
          postThemeCss(payload, name, true, notify);
          return;
        }
        notify(
          err === 'auth'                 ? 'Wiki theme: wrong password' :
          err === 'readonly'             ? 'Wiki theme: var/pages not writable' :
          err === 'template not writable'? 'Wiki theme: templates/writerdeck/ not writable' :
          'Wiki theme not saved (' + (err || 'error') + ')',
          false
        );
      })
      .catch(function () { notify('Wiki theme not saved (network)', false); });
  }

  // --- JSON API (read-only): page list + raw page source. --------------------
  function apiUrl(op, extra) {
    return endpoint + (endpoint.indexOf('?') >= 0 ? '&' : '?') +
      'action=writhdeck_api&op=' + op + (extra || '');
  }
  function apiList() {
    return fetch(apiUrl('list'), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.ok && j.pages) || []; })
      .catch(function () { return []; });
  }
  function apiRaw(name) {
    return fetch(apiUrl('raw', '&page=' + encodeURIComponent(name)), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  // Build a writhdeck doc object from page metadata. Content is loaded lazily
  // (on open) for list rows — `_stub` marks a not-yet-loaded page.
  function makeDoc(name, modifiedSec, content) {
    return {
      id:          name,                       // page name is the stable id
      name:        name,
      content:     content == null ? '' : content,
      created:     (modifiedSec || 0) * 1000,
      modified:    (modifiedSec || 0) * 1000,
      lastChanged: modifiedSec || 0,           // mtime at load → conflict detection
      _stub:       content == null,
    };
  }

  // --- AJAX save: POST LionWiki's native action=save for an arbitrary page. --
  // Resolves true on success, false on failure (wrong password / edit conflict).
  function ajaxSave(doc, moveto, _retried) {
    if (!doc) return Promise.resolve(false);

    var fd = new FormData();
    fd.set('action', 'save');
    fd.set('page', doc.name);
    fd.set('content', doc.content);
    fd.set('last_changed', String(doc.lastChanged || Math.floor(Date.now() / 1000)));
    fd.set('esum', '');
    if (moveto != null) fd.set('moveto', moveto);

    // Password: a session value if we have one (the form's sc field is only
    // present when not yet authenticated; once a save succeeds the LW_AUT
    // cookie keeps the session authenticated without it).
    var pwField = form && form.querySelector('input[name=sc]');
    var pw = wikiPassword || (pwField && pwField.value) || '';
    if (pw) fd.set('sc', pw);

    // redirect:'manual' — a successful save answers with a 302 (opaque redirect);
    // a rejected save (bad password / edit conflict) answers with a 200 edit page.
    return fetch(endpoint, {
      method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual'
    }).then(function (resp) {
      var ok = resp.type === 'opaqueredirect' || resp.redirected ||
               (resp.status >= 300 && resp.status < 400);
      if (!ok) {
        // 200 edit page ⇒ save rejected. Ask for the password once and retry.
        if (!_retried && (pwField || !pw)) {
          var entered = window.prompt('Wiki password to save this page:');
          if (entered === null) return false;       // cancelled
          wikiPassword = entered;
          return ajaxSave(doc, moveto, true);
        }
        wikiPassword = '';
        if (api) api.Editor.setMsg('Save failed (password or edit conflict)');
        return false;
      }
      // Success: bump lastChanged so the next save of this doc doesn't conflict.
      doc.lastChanged = Math.floor(Date.now() / 1000);
      doc.modified    = Date.now();
      if (api) { api.State.dirty = false; api.Editor.setMsg('Saved'); }
      rememberPage(doc.name);
      return true;
    }).catch(function () {
      if (api) api.Editor.setMsg('Save failed (network)');
      return false;
    });
  }

  // Save — stay in the editor (operates on the currently-open page).
  function wikiSave() {
    if (!api || !api.State.doc) return Promise.resolve(false);
    api.State.doc.content = edText();
    return ajaxSave(api.State.doc, null);
  }

  // Save as → rename/move the current page, then keep editing under the new name.
  function renamePage() {
    if (!api || !api.State.doc) return;
    var doc  = api.State.doc;
    var from = doc.name;
    var dest = window.prompt('Save as (rename) — new page name:', from);
    if (dest === null) return;            // cancelled
    dest = dest.replace(/^\s+|\s+$/g, '');
    if (!dest) return;
    if (dest === from) { wikiSave(); return; }

    doc.content = edText();
    ajaxSave(doc, dest).then(function (ok) {
      if (!ok) return;                    // failed — message already shown
      doc.name = dest;
      doc.id   = dest;
      rememberPage(dest);
      document.title = dest + ' — Writhdeck';
      if (api) api.Editor.setMsg('Renamed to ' + dest);
      try { history.replaceState(null, '', pageHref(dest) + '&action=edit'); } catch (e) {}
    });
  }

  // Yes/No/Cancel "save before leaving?" using writhdeck's own dialog.
  function confirmClose(name) {
    return new Promise(function (resolve) {
      var dlg = document.getElementById('close-confirm-dlg');
      if (!dlg || typeof dlg.showModal !== 'function') {
        resolve(window.confirm('Save changes before leaving?') ? 'yes' : 'no');
        return;
      }
      var msg = document.getElementById('close-confirm-msg');
      var yes = document.getElementById('close-confirm-yes');
      var no = document.getElementById('close-confirm-no');
      var cancel = document.getElementById('close-confirm-cancel');
      if (msg) msg.textContent = 'Save "' + (name || 'page') + '" before leaving?';
      function cleanup(val) {
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
        cancel.removeEventListener('click', onCancel);
        dlg.removeEventListener('cancel', onEsc);
        try { dlg.close(); } catch (e) {}
        resolve(val);
      }
      function onYes() { cleanup('yes'); }
      function onNo() { cleanup('no'); }
      function onCancel() { cleanup('cancel'); }
      function onEsc(e) { e.preventDefault(); cleanup('cancel'); }
      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
      cancel.addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onEsc);
      dlg.showModal();
    });
  }

  // Quit → confirm if dirty, then LEAVE to the last edited/visited wiki page.
  // Triggered by ✕, Ctrl+Q, Ctrl+Shift+Q, the menu "Quit" and cmd-mode 'q'.
  async function wikiClose() {
    var doc = api && api.State.doc;
    if (doc && api.State.dirty) {
      var choice = await confirmClose(doc.name);
      if (choice === 'cancel') return;
      if (choice === 'yes') {
        doc.content = edText();
        var ok = await ajaxSave(doc, null);
        if (!ok) return;                  // save failed → stay in the editor
      }
    }
    if (api) api.State.dirty = false;     // avoid the beforeunload prompt
    location.href = pageHref((doc && doc.name) || lastPage || entryPage);
  }

  window.WRITHDECK_BACKEND = {
    open:        function ()      { return Promise.resolve(); },
    // Browser list — every editable page in var/pages/ (content loaded on open).
    getAllDocs:  function ()      {
      return apiList().then(function (pages) {
        return pages.map(function (p) { return makeDoc(p.name, p.modified, null); });
      });
    },
    getDoc:      function (id)     {
      return apiRaw(id).then(function (j) {
        return j && j.ok ? makeDoc(j.name, j.modified, j.content) : null;
      });
    },
    saveDoc:     function (d)      { if (!d) return Promise.resolve(false); d.content = (d.content || ''); return ajaxSave(d, null); },
    // Delete = save empty content (LionWiki unlinks empty pages). `id` is the
    // page name (our doc ids are page names).
    deleteDoc:   function (id)     { return id ? ajaxSave({ name: id, content: '', lastChanged: 0 }, null) : Promise.resolve(); },
    getMeta:     getMeta,
    setMeta:     setMeta,
  };

  // --- Bootstrap once writhdeck has initialised ------------------------------
  window.WRITHDECK_ON_READY = function (writhdeckApi) {
    api = writhdeckApi;

    // Reveal the app and let the editor take over the page.
    var appEl = document.getElementById('writhdeck-app');
    if (appEl) appEl.hidden = false;
    document.body.classList.add('writhdeck-active');

    // Override the shared Editor leave/save methods. Editor.browser is left at
    // its upstream default (show the file browser) — now backed by var/pages/.
    api.Editor.save   = wikiSave;
    api.Editor.saveAs = renamePage;
    api.Editor.close  = wikiClose;

    // Lazily load page source when a browser row (a stub) is opened, and keep
    // track of the last page touched (for Quit). Wraps the shared open method.
    var origOpen = api.Editor.open;
    api.Editor.open = function (doc) {
      if (doc && doc._stub) {
        return apiRaw(doc.name).then(function (j) {
          if (j && j.ok) {
            doc.content     = j.content;
            doc.modified    = (j.modified || 0) * 1000;
            doc.lastChanged = j.modified || 0;
          }
          doc._stub = false;
          rememberPage(doc.name);
          return origOpen.call(api.Editor, doc);
        });
      }
      rememberPage(doc && doc.name);
      return origOpen.call(api.Editor, doc);
    };

    // Record the current scheme as the baseline so only a real scheme change
    // (not an unrelated settings save) rewrites the wiki's style.css.
    syncWikiTheme(true);

    // Settings → Profile: add a LionWiki-only control under "Default scheme" to
    // push the chosen scheme to the wiki template (writes style.css on demand).
    var profSel = document.getElementById('scheme-select-profile');
    var profLabel = profSel && profSel.closest('label');
    if (profLabel && !document.getElementById('wiki-theme-sync-btn')) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'margin:6px 0 2px';
      var btn = document.createElement('button');
      btn.id = 'wiki-theme-sync-btn';
      btn.type = 'button';
      btn.textContent = 'Synchronise backend appearance to frontend';
      btn.addEventListener('click', function (e) { e.preventDefault(); applyWikiThemeNow(); });
      var note = document.createElement('span');
      note.id = 'wiki-theme-sync-msg';
      note.style.cssText = 'margin-left:8px;font-size:.85em;';
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.style.margin = '2px 0 0';
      hint.textContent = 'Applies current settings, then writes templates/writerdeck/style.css from the scheme, margins, fonts and spacing (needs the wiki password; templates/writerdeck/ must be writable).';
      wrap.appendChild(btn);
      wrap.appendChild(note);
      wrap.appendChild(hint);
      profLabel.insertAdjacentElement('afterend', wrap);
    }

    // Relabel the rename entry (LionWiki-only DOM tweak).
    var saBtn = document.querySelector('#ed-menu [data-cmd="save-as"]');
    if (saBtn) saBtn.innerHTML = 'Save as (rename) <span class="hint">Ctrl+Shift+S</span>';

    // Browser header (LionWiki-only DOM tweaks): the file browser is the root
    // view, so upstream has no way to leave it — add a ✕ Quit that returns to
    // the wiki. Hide the disk-only actions (watch folder / open / import file):
    // there is no local filesystem here, only var/pages/.
    ['br-folder-btn', 'br-opendisk-btn', 'br-import-btn'].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.hidden = true;
    });
    var hdrBtns = document.getElementById('br-header-btns');
    if (hdrBtns && !document.getElementById('br-quit-btn')) {
      var quitBtn = document.createElement('button');
      quitBtn.id = 'br-quit-btn';
      quitBtn.title = 'Quit — back to the wiki';
      quitBtn.textContent = '✕';
      quitBtn.addEventListener('click', function () { wikiClose(); });
      hdrBtns.insertBefore(quitBtn, hdrBtns.firstChild);
    }

    // Open the page we arrived to edit directly (content is already in the
    // textarea — no fetch needed). The browser still lists every page.
    var entryDoc = makeDoc(entryPage || 'page', 0, input.value);
    entryDoc.lastChanged = entryLast || Math.floor(Date.now() / 1000);
    return api.Editor.open(entryDoc);
  };
})();
