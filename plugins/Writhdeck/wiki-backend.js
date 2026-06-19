'use strict';
/*
 * LionWiki-t2t backend + bootstrap for the embedded writhdeck editor.
 *
 * Injected by the Writhdeck plugin (plugins/wkp_Writhdeck.php) BEFORE
 * writhdeck.js, only on edit/preview pages. It:
 *
 *   1. Exposes window.WRITHDECK_BACKEND — the storage interface writhdeck's
 *      `backend.js` picks up instead of IndexedDB. Phase 1 is single-document:
 *      the one "document" is the wiki page currently being edited, mirrored to
 *      the native LionWiki <textarea id="inputPane"> inside the edit <form>.
 *      Saving POSTs that form via fetch (AJAX) so the user STAYS in the editor;
 *      all native save semantics are preserved server-side (conflict detection,
 *      password, edit summary, rename, history). Settings/theme go to localStorage.
 *
 *   2. Overrides Editor.save / saveAs / close so that, in the wiki:
 *        - Save (Ctrl+S / menu)            → AJAX save, stay in the editor
 *        - Save as (Ctrl+Shift+S / menu)   → rename/move the page, stay editing
 *        - Close (✕ / Ctrl+Q / cmd 'q')    → confirm-if-dirty, then back to the page
 *      The writhdeck file browser is therefore never shown (it is meaningless
 *      and was unsafe in a single-page context — e.g. "new file" could wipe the
 *      page being edited).
 *
 *   3. Disables writhdeck's 60s autosave (window.WRITHDECK_AUTOSAVE = false) so a
 *      long edit doesn't flood the wiki page history with revisions; saving is
 *      explicit (Ctrl+S / Save), and Close prompts to save unsaved changes.
 *
 * Phase 2 will swap this single-doc backend for HTTP calls to an index.php
 * JSON API (list / raw / save&ajax) to drive the full writhdeck file browser.
 */
(function () {
  var input = document.getElementById('inputPane');
  if (!input) return; // not an edit surface — leave writhdeck inert

  // Saving is explicit here; don't let the 60s autosave spam the page history.
  window.WRITHDECK_AUTOSAVE = false;

  var form     = input.form;
  var pageName = (form && form.querySelector('[name=page]')) ? form.querySelector('[name=page]').value : '';
  var pageUrl  = location.pathname + '?page=' + encodeURIComponent(pageName);

  // The single document, identity-stable so State.doc === this object.
  var doc = {
    id:       'wiki-page',
    name:     pageName || 'page',
    content:  input.value,
    created:  Date.now(),
    modified: Date.now(),
  };

  var api = null; // set by WRITHDECK_ON_READY; gives access to writhdeck modules

  function edText() {
    var ed = document.getElementById('ed-input');
    return ed ? ed.value : doc.content;
  }

  // --- localStorage-backed meta (settings, theme, cursors, recents…) ---
  var META_PREFIX = 'writhdeck:';
  function getMeta(key) {
    try {
      var raw = localStorage.getItem(META_PREFIX + key);
      return Promise.resolve(raw == null ? undefined : JSON.parse(raw));
    } catch (e) { return Promise.resolve(undefined); }
  }
  function setMeta(key, value) {
    try { localStorage.setItem(META_PREFIX + key, JSON.stringify(value)); } catch (e) {}
    return Promise.resolve();
  }

  // --- AJAX save: POST the native edit form without leaving the editor. ---
  // `moveto` (optional) renames/moves the page via LionWiki's native field.
  // Resolves true on success, false on failure (wrong password / edit conflict).
  function ajaxSave(moveto) {
    if (!form) return Promise.resolve(false);
    doc.content = edText();
    input.value = doc.content; // so FormData(form) carries the latest text

    // Ask for the wiki password once if the form requires it and it's empty.
    var pw = form.querySelector('input[name=sc]');
    if (pw && !pw.value) {
      var entered = window.prompt('Wiki password to save this page:');
      if (entered === null) return Promise.resolve(false); // cancelled
      pw.value = entered;
    }

    var fd = new FormData(form);
    fd.set('content', doc.content);
    if (moveto != null) fd.set('moveto', moveto);

    // Don't send ajax=1: that would hand the POST to the AjaxEditing plugin.
    // Use redirect:'manual' — LionWiki answers a successful save with a 302
    // (→ an opaque-redirect response), and a rejected save (bad password / edit
    // conflict) with a 200 edit page. The password also rides in the form's
    // `sc` field, so saves stay authenticated without reading the response.
    return fetch(form.getAttribute('action') || location.href, {
      method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual'
    }).then(function (resp) {
      var ok = resp.type === 'opaqueredirect' || resp.redirected ||
               (resp.status >= 300 && resp.status < 400);
      if (!ok) {                        // 200 edit page ⇒ save rejected
        if (pw) pw.value = '';          // let the user retry the password
        if (api) api.Editor.setMsg('Save failed (password or edit conflict)');
        return false;
      }
      // Success: bump last_changed so our next save doesn't self-conflict.
      var lc = form.querySelector('[name=last_changed]');
      if (lc) lc.value = Math.floor(Date.now() / 1000);
      if (api) { api.State.dirty = false; api.Editor.setMsg('Saved'); }
      return true;
    }).catch(function () {
      if (api) api.Editor.setMsg('Save failed (network)');
      return false;
    });
  }

  // Save — stay in the editor.
  function wikiSave() { return ajaxSave(null); }

  // Save as → rename/move the page, then keep editing under the new name.
  function renamePage() {
    var dest = window.prompt('Save as (rename) — new page name:', pageName);
    if (dest === null) return;          // cancelled
    dest = dest.replace(/^\s+|\s+$/g, '');
    if (!dest || dest === pageName) { if (dest === pageName) ajaxSave(null); return; }

    ajaxSave(dest).then(function (ok) {
      if (!ok) return;                  // failed — message already shown, stay
      // Adopt the new identity and keep editing.
      pageName = dest;
      pageUrl  = location.pathname + '?page=' + encodeURIComponent(dest);
      doc.name = dest;
      var pageField = form && form.querySelector('[name=page]');
      if (pageField) pageField.value = dest;
      var moveField = form && form.querySelector('[name=moveto]');
      if (moveField) moveField.value = ''; // page == dest now: no further move
      if (api && api.State.doc) api.State.doc.name = dest;
      document.title = dest + ' — Writhdeck';
      if (api) api.Editor.setMsg('Renamed to ' + dest);
      try { history.replaceState(null, '', pageUrl + '&action=edit'); } catch (e) {}
    });
  }

  // Yes/No/Cancel "save before leaving?" using writhdeck's own dialog.
  function confirmClose() {
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
      if (msg) msg.textContent = 'Save "' + (pageName || 'page') + '" before leaving?';
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

  // Close → confirm if dirty, then return to the wiki reading view (never the
  // writhdeck browser). Triggered by ✕, Ctrl+Q, Ctrl+Shift+Q and cmd-mode 'q'.
  async function wikiClose() {
    if (api && api.State.dirty) {
      var choice = await confirmClose();
      if (choice === 'cancel') return;
      if (choice === 'yes') {
        var ok = await ajaxSave(null);
        if (!ok) return;                // save failed → stay in the editor
      }
    }
    if (api) api.State.dirty = false;   // avoid the beforeunload prompt
    location.href = pageUrl;
  }

  window.WRITHDECK_BACKEND = {
    open:        function ()    { return Promise.resolve(); },
    getAllDocs:  function ()    { return Promise.resolve([doc]); },
    getDoc:      function ()    { return Promise.resolve(doc); },
    saveDoc:     function (d)   { if (d) doc.content = d.content; return ajaxSave(null); },
    deleteDoc:   function ()    { return Promise.resolve(); },
    getMeta:     getMeta,
    setMeta:     setMeta,
  };

  // --- Bootstrap once writhdeck has initialised ---
  window.WRITHDECK_ON_READY = function (writhdeckApi) {
    api = writhdeckApi;

    // Reveal the app and let the editor take over the page.
    var appEl = document.getElementById('writhdeck-app');
    if (appEl) appEl.hidden = false;
    document.body.classList.add('writhdeck-active');

    // Override the shared Editor methods — this covers every trigger (menu
    // buttons, Ctrl+S/Ctrl+Shift+S/Ctrl+Q, command mode) since they all call
    // these properties. Upstream writhdeck-web is untouched.
    api.Editor.save   = wikiSave;
    api.Editor.saveAs = renamePage;
    api.Editor.close  = wikiClose;

    // Relabel the menu entry (LionWiki-only DOM tweak).
    var saBtn = document.querySelector('#ed-menu [data-cmd="save-as"]');
    if (saBtn) saBtn.innerHTML = 'Save as (rename) <span class="hint">Ctrl+Shift+S</span>';

    return api.Editor.open(doc);
  };
})();
