'use strict';
// Color scheme definitions — ported from src/schemes/*.tcl
// Each scheme: dark (primary) + light (alt) color sets
const SCHEMES = {
  default: {
    bg:'#1a1a1a', fg:'#e8e8e8', bgBar:'#2a2a2a', fgBar:'#aaaaaa', bgSel:'#3a5a8a',
    heading:'#c8a060', comment:'#606060', markup:'#6aa9d4', bg2:'#1a1a1a',
    bgAlt:'#fdf6e3', fgAlt:'#657b83', bgBarAlt:'#eee8d5', fgBarAlt:'#93a1a1',
    bgSelAlt:'#e6ddb9', headingAlt:'#b58900', commentAlt:'#aaaaaa', markupAlt:'#2a7090', bg2Alt:'#fdf6e3'
  },
  solarized: {
    bg:'#002b36', fg:'#839496', bgBar:'#073642', fgBar:'#586e75', bgSel:'#004555',
    heading:'#b58900', comment:'#586e75', markup:'#268bd2', bg2:'#002b36',
    bgAlt:'#fdf6e3', fgAlt:'#657b83', bgBarAlt:'#eee8d5', fgBarAlt:'#93a1a1',
    bgSelAlt:'#e6ddb9', headingAlt:'#b58900', commentAlt:'#93a1a1', markupAlt:'#268bd2', bg2Alt:'#fdf6e3'
  },
  gruvbox: {
    bg:'#282828', fg:'#ebdbb2', bgBar:'#1d2021', fgBar:'#a89984', bgSel:'#504945',
    heading:'#fabd2f', comment:'#928374', markup:'#83a598', bg2:'#282828',
    bgAlt:'#fbf1c7', fgAlt:'#3c3836', bgBarAlt:'#ebdbb2', fgBarAlt:'#7c6f64',
    bgSelAlt:'#d5c4a1', headingAlt:'#b57614', commentAlt:'#a89984', markupAlt:'#076678', bg2Alt:'#fbf1c7'
  },
  everforest: {
    bg:'#2b3339', fg:'#d3c6aa', bgBar:'#1e2326', fgBar:'#a7c080', bgSel:'#3a464c',
    heading:'#a7c080', comment:'#7a8478', markup:'#7fbbb3', bg2:'#2b3339',
    bgAlt:'#fdf6e3', fgAlt:'#5c6a72', bgBarAlt:'#efead4', fgBarAlt:'#8da101',
    bgSelAlt:'#e6e2cc', headingAlt:'#8da101', commentAlt:'#a6b0a0', markupAlt:'#3a94c5', bg2Alt:'#fdf6e3'
  },
  nord: {
    bg:'#2e3440', fg:'#d8dee9', bgBar:'#3b4252', fgBar:'#81a1c1', bgSel:'#434c5e',
    heading:'#88c0d0', comment:'#4c566a', markup:'#8fbec0', bg2:'#2e3440',
    bgAlt:'#eceff4', fgAlt:'#2e3440', bgBarAlt:'#e5e9f0', fgBarAlt:'#5e81ac',
    bgSelAlt:'#d8dee9', headingAlt:'#5e81ac', commentAlt:'#4c566a', markupAlt:'#5e81ac', bg2Alt:'#eceff4'
  },
  alt01: {
    bg:'#1a1214', fg:'#e8dcc8', bgBar:'#241820', fgBar:'#9e8878', bgSel:'#521828',
    heading:'#e63060', comment:'#6e5858', markup:'#c24868', bg2:'#1a1214',
    bgAlt:'#fffde9', fgAlt:'#363c42', bgBarAlt:'#eee8d5', fgBarAlt:'#93a1a1',
    bgSelAlt:'#f0e7c1', headingAlt:'#c8064a', commentAlt:'#aaaaaa', markupAlt:'#7e1c3e', bg2Alt:'#fffde9'
  },
  alt02: {
    bg:'#2a2520', fg:'#d4c4b0', bgBar:'#2a2520', fgBar:'#c4b4a0', bgSel:'#4a4035',
    heading:'#e8a87c', comment:'#6a5a50', markup:'#c49070', bg2:'#2a2520',
    bgAlt:'#f5f0eb', fgAlt:'#3a2a20', bgBarAlt:'#e8e0d8', fgBarAlt:'#3a2a20',
    bgSelAlt:'#e0d4c8', headingAlt:'#a65d2b', commentAlt:'#a89080', markupAlt:'#8b5a3c', bg2Alt:'#f5f0eb'
  },
  retro: {
    bg:'#0a0a0a', fg:'#33ff33', bgBar:'#111111', fgBar:'#22bb22', bgSel:'#004400',
    heading:'#aaffaa', comment:'#1a661a', markup:'#00ffcc', bg2:'#0a0a0a',
    bgAlt:'#ffffff', fgAlt:'#000000', bgBarAlt:'#e0e0e0', fgBarAlt:'#333333',
    bgSelAlt:'#d0d0d0', headingAlt:'#000000', commentAlt:'#999999', markupAlt:'#333333', bg2Alt:'#ffffff'
  }
};

// User-defined custom schemes (loaded from IndexedDB, merged at runtime)
let customSchemes = {};

function getScheme(name) {
  return customSchemes[name] || SCHEMES[name] || SCHEMES.default;
}

function getAllSchemeNames() {
  return [...Object.keys(SCHEMES), ...Object.keys(customSchemes)];
}


'use strict';
// IndexedDB wrapper — promise-based.
// This is the default storage backend. `backend.js` selects the active `DB`
// implementation (this one, or a host-provided `window.WRITHDECK_BACKEND`).
const IndexedDbBackend = (() => {
  const DB_NAME = 'writhdeck';
  const DB_VER  = 1;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const req = fn(s);
      if (req && typeof req.onsuccess === 'undefined') {
        // fn returned a value, not a request
        resolve(req);
        return;
      }
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror    = e => reject(e.target.error);
      if (req) {
        req.onerror  = e => reject(e.target.error);
      }
    }));
  }

  // Documents
  function saveDoc(doc) {
    return tx('documents', 'readwrite', s => {
      doc.modified = Date.now();
      if (!doc.created) doc.created = doc.modified;
      return s.put(doc);
    }).then(id => { if (!doc.id) doc.id = id; return doc; });
  }

  function getDoc(id) {
    return tx('documents', 'readonly', s => s.get(Number(id)));
  }

  function getAllDocs() {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction('documents', 'readonly');
      const s = t.objectStore('documents');
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = e => reject(e.target.error);
    }));
  }

  function deleteDoc(id) {
    return tx('documents', 'readwrite', s => s.delete(Number(id)));
  }

  // Meta (settings, favorites, etc.)
  function getMeta(key) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction('meta', 'readonly');
      const req = t.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror   = e => reject(e.target.error);
    }));
  }

  function setMeta(key, value) {
    return tx('meta', 'readwrite', s => s.put({ key, value }));
  }

  return { open, saveDoc, getDoc, getAllDocs, deleteDoc, getMeta, setMeta };
})();


'use strict';
// Storage backend selector.
//
// `IndexedDbBackend` (db.js) is the default — used by the standalone
// writhdeck.html. A host page (e.g. the LionWiki-t2t template) can provide an
// alternative implementation by defining `window.WRITHDECK_BACKEND` *before*
// this script runs. The chosen object must expose the same interface as
// `IndexedDbBackend`: open, saveDoc, getDoc, getAllDocs, deleteDoc,
// getMeta, setMeta.
//
// `IndexedDbBackend` stays globally reachable so an adapter can delegate
// client-side concerns (settings/theme via getMeta/setMeta) to it while
// overriding document storage.
const DB = (typeof window !== 'undefined' && window.WRITHDECK_BACKEND)
  ? window.WRITHDECK_BACKEND
  : IndexedDbBackend;


'use strict';
// In-memory application state
const State = {
  doc:   null,  // { id, name, content, created, modified }
  dirty: false,

  docs: [],   // IDB-backed document list

  // Watched folder (File System Access API)
  dirHandle:    null,
  dirFiles:     [],   // in-memory only, rebuilt by scanDir()
  dirSubdirs:   [],   // [{name, handle}] subdirectories of the current folder
  dirStack:     [],   // [{name, handle}] root..current dir for subfolder navigation
  dirIniHandle: null, // FileSystemFileHandle for writhdeck.ini in folder

  // Cached INI text — the canonical settings format in IDB
  iniText: '',

  // Per-profile overrides (12-key aligned set — see ini.js PROFILE_JS_KEYS)
  profiles: {},        // {name: {jsKey: value, ...}}
  activeProfile: 'default',
  profileNames: [],

  // Settings defaults (overwritten from IDB on load)
  settings: {
    scheme: 'default',
    darkMode: true,
    fontSize: 18,
    fontFamily: 'monospace',
    marginX: 80,
    marginY: 40,
    lineSpacing: 1.5,
    headingMarker: '=',
    commentMarker: '% ',
    boldMarker: '**',
    italicMarker: '//',
    underlineMarker: '__',
    strikeMarker: '--',
    markdownHeadings: true,
    wordGoal: 0,
    hemingwayMode: false,
    cursorRestore: true,
    openLastDoc: false,
    timerType: 'countdown',
    timerDuration: 25,
    timerSound: true,
    timerAlert: true,
    timerShow: true,
    statusLeft: 'filename dirty words',
    statusCenter: '',
    statusRight: 'goal clock timer',
    lineNumbers: false,
    blockCursor: false,
    blinkCursor: false,
    interceptBrowserShortcuts: true,
    interceptContextMenu: true,
    browserFilter: '*.txt *.t2t *.md *.ini',
    browserShowAll: false,
    browserSubdirs: true
  },

  favorites: [],  // [id, ...]
  recents: [],    // [id, ...] max 4
  cursors: {},    // {id: charOffset}
  daily: {},      // {id: {"YYYY-MM-DD": N, ...}}
  customSchemes: {}
};

// ── Load ──────────────────────────────────────────────────────────────────

async function loadState() {
  const [iniText, oldSettings, favorites, recents, cursors, daily, oldCs, dh] = await Promise.all([
    DB.getMeta('iniText'),       // canonical INI storage (current)
    DB.getMeta('settings'),      // legacy JSON (migration only)
    DB.getMeta('favorites'),
    DB.getMeta('recents'),
    DB.getMeta('cursors'),
    DB.getMeta('daily'),
    DB.getMeta('customSchemes'), // legacy separate custom schemes
    DB.getMeta('dirHandle')
  ]);

  if (iniText) {
    // Normal path — INI is the source of truth
    const { settings, schemes, profiles, activeProfile } = INI.parseIni(iniText);
    Object.assign(State.settings, settings);
    // Only load non-built-in schemes: built-in colors come from code, not IDB
    for (const [n, sc] of Object.entries(schemes)) {
      if (!SCHEMES[n]) customSchemes[n] = sc;
    }
    State.customSchemes = { ...customSchemes };
    State.iniText = iniText;
    applyParsedProfiles(profiles, activeProfile);
  } else if (oldSettings) {
    // One-time migration from legacy JSON format
    Object.assign(State.settings, oldSettings);
    if (oldCs) Object.assign(customSchemes, oldCs);
    State.customSchemes = { ...customSchemes };
    seedProfilesIfMissing();
    await saveSettings();             // re-persist as INI
    await DB.setMeta('settings', null);
    await DB.setMeta('customSchemes', null);
  }
  // else: first run — defaults are in place, INI saved after init by app.js

  seedProfilesIfMissing();

  if (favorites) State.favorites = favorites;
  if (recents)   State.recents   = recents;
  if (cursors)   State.cursors   = cursors;
  if (daily)     State.daily     = daily;
  if (dh)        State.dirHandle = dh;

  State.docs = await DB.getAllDocs();
}

// ── Profiles ──────────────────────────────────────────────────────────────

// Adopts profiles parsed from an INI file (no-op if the file had none),
// merging the active profile's overrides onto State.settings.
function applyParsedProfiles(profiles, activeProfile) {
  if (Object.keys(profiles).length === 0) return;
  State.profiles = profiles;
  State.activeProfile = profiles[activeProfile] ? activeProfile : Object.keys(profiles)[0];
  State.profileNames = Object.keys(profiles);
  Object.assign(State.settings, State.profiles[State.activeProfile] || {});
}

// First-run / older-INI fallback: seed `default` (snapshot of current
// settings, lossless) plus a `novel` profile, mirroring the Android/Tcl
// "two starter profiles" set.
function seedProfilesIfMissing() {
  if (Object.keys(State.profiles).length > 0) {
    State.profileNames = Object.keys(State.profiles);
    return;
  }
  const extract = () => Object.fromEntries(INI.PROFILE_JS_KEYS.map(k => [k, State.settings[k]]));
  const novel = extract();
  novel.scheme           = 'everforest';
  novel.marginX          = State.settings.marginX * 2;
  novel.marginY          = Math.round(State.settings.marginY * 1.5);
  novel.wordGoal         = 1000;
  novel.fontSize         = State.settings.fontSize + 2;
  novel.fontFamily       = 'serif';
  novel.lineSpacing      = Math.round(State.settings.lineSpacing * 1.2 * 10) / 10;
  novel.markdownHeadings = false;

  State.profiles = { default: extract(), novel };
  State.activeProfile = 'default';
  State.profileNames = Object.keys(State.profiles);
}

// ── Settings — INI is canonical ───────────────────────────────────────────

async function saveSettings() {
  const allSchemes = { ...SCHEMES, ...customSchemes };
  const text = INI.writeIni(State.settings, allSchemes, State.profiles, State.activeProfile);
  State.iniText = text;
  await DB.setMeta('iniText', text);
}

// Custom schemes are embedded in the INI — just re-save settings
async function saveCustomSchemes() {
  State.customSchemes = { ...customSchemes };
  await saveSettings();
}

// ── Persistence helpers ───────────────────────────────────────────────────

async function saveFavorites() { await DB.setMeta('favorites', State.favorites); }
async function saveRecents()   { await DB.setMeta('recents',   State.recents);   }
async function saveCursors()   { await DB.setMeta('cursors',   State.cursors);   }
async function saveDaily()     { await DB.setMeta('daily',     State.daily);     }
async function saveDirHandle() { await DB.setMeta('dirHandle', State.dirHandle); }

async function clearDirHandle() {
  State.dirHandle    = null;
  State.dirFiles     = [];
  State.dirSubdirs   = [];
  State.dirStack     = [];
  State.dirIniHandle = null;
  await DB.setMeta('dirHandle', null);
}

// ── Browser file filter ───────────────────────────────────────────────────
// Mirrors the Tcl desktop's `list-docs` filtering: an empty filter or
// browserShowAll=true shows everything; otherwise glob-match (case-insensitive,
// `*`/`?`/`[...]`) against each space-separated pattern.

function globToRegex(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close < 0) re += '\\[';
      else { re += '[' + pattern.slice(i + 1, close) + ']'; i = close; }
    }
    else if ('.+^${}()|\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$', 'i');
}

function matchesBrowserFilter(name) {
  if (State.settings.browserShowAll) return true;
  const patterns = (State.settings.browserFilter || '').trim().split(/\s+/).filter(Boolean);
  if (patterns.length === 0) return true;
  return patterns.some(pat => globToRegex(pat).test(name));
}

// ── Watched folder ────────────────────────────────────────────────────────

// Handle of the folder currently being browsed (root, or a subfolder when
// the user has navigated into one via subfolder navigation).
function currentDir() {
  if (State.dirStack.length) return State.dirStack[State.dirStack.length - 1].handle;
  return State.dirHandle;
}

// Relative path (with trailing '/') from the watched root to the current
// folder, e.g. "chapters/act1/" — "" when at the root. Used to build unique
// ids and to display the breadcrumb.
function dirRelPath() {
  if (State.dirStack.length <= 1) return '';
  return State.dirStack.slice(1).map(s => s.name).join('/') + '/';
}

async function scanDir() {
  if (!State.dirHandle) return false;
  // Initialise / repair the navigation stack to the root.
  if (!State.dirStack.length) State.dirStack = [{ name: State.dirHandle.name, handle: State.dirHandle }];
  // When subfolder navigation is off, never browse below the root.
  if (!State.settings.browserSubdirs && State.dirStack.length > 1) {
    State.dirStack = [State.dirStack[0]];
  }
  const cur = currentDir();
  const rel = dirRelPath();
  const files = [];
  const subdirs = [];
  try {
    for await (const [name, handle] of cur.entries()) {
      if (handle.kind === 'directory') {
        if (State.settings.browserSubdirs && name !== 'backups') subdirs.push({ name, handle });
        continue;
      }
      if (handle.kind !== 'file') continue;
      if (!matchesBrowserFilter(name)) continue;
      const file = await handle.getFile();
      files.push({
        id: `dir:${rel}${name}`, name, content: null,
        fileHandle: handle, fromDisk: true, dirFile: true,
        modified: file.lastModified
      });
    }
  } catch (e) {
    if (e.name !== 'NotAllowedError') console.error(e);
    return false;
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  subdirs.sort((a, b) => a.name.localeCompare(b.name));
  State.dirFiles = files;
  State.dirSubdirs = subdirs;
  try {
    State.dirIniHandle = await currentDir().getFileHandle('writhdeck.ini');
  } catch (_) {
    State.dirIniHandle = null;
  }
  return true;
}

// Enter a subfolder (by name, from State.dirSubdirs) and rescan.
async function dirEnter(name) {
  const sub = State.dirSubdirs.find(s => s.name === name);
  if (!sub) return;
  State.dirStack.push(sub);
  await scanDir();
}

// Go up one folder (no-op at the root) and rescan.
async function dirUp() {
  if (State.dirStack.length <= 1) return;
  State.dirStack.pop();
  await scanDir();
}

// ── Recents / favorites ───────────────────────────────────────────────────

function pushRecent(id) {
  State.recents = [id, ...State.recents.filter(r => r !== id)].slice(0, 4);
  saveRecents();
}

function removeRecent(id) {
  State.recents = State.recents.filter(r => r !== id);
  saveRecents();
}

function toggleFavorite(id) {
  const idx = State.favorites.indexOf(id);
  if (idx >= 0) State.favorites.splice(idx, 1);
  else State.favorites.unshift(id);
  saveFavorites();
}

function isFavorite(id) { return State.favorites.includes(id); }

// ── Daily stats — high-water mark ─────────────────────────────────────────

function updateDaily(id, added) {
  const today = new Date().toISOString().slice(0, 10);
  if (!State.daily[id]) State.daily[id] = {};
  const prev = State.daily[id][today] || 0;
  if (added > prev) { State.daily[id][today] = added; saveDaily(); }
}

function todayWords(id) {
  const today = new Date().toISOString().slice(0, 10);
  return (State.daily[id] && State.daily[id][today]) || 0;
}


'use strict';
// writhdeck.ini parser/writer — compatible with the Tcl/Tk desktop version

// ── Key mappings ─────────────────────────────────────────────────────────
// INI key  →  State.settings key  (+ type coercion)

const INI_TO_SETTINGS = {
  scheme:               ['scheme',          'str'],
  dark_mode:            ['darkMode',         'bool'],
  font_size:            ['fontSize',         'int'],
  font_family:          ['fontFamily',       'str'],
  bar_font_family:      ['fontFamily',       'str'],   // fallback
  margin_width:         ['marginX',          'int'],
  margin_height:        ['marginY',          'int'],
  line_spacing:         ['lineSpacing',      'float'],
  word_goal:            ['wordGoal',         'int'],
  heading_marker:       ['headingMarker',    'str'],
  comment_marker:       ['commentMarker',    'str'],
  dim_marker:           ['commentMarker',    'str'],   // legacy alias
  bold_marker:          ['boldMarker',       'str'],
  italic_marker:        ['italicMarker',     'str'],
  underline_marker:     ['underlineMarker',  'str'],
  strikethrough_marker: ['strikeMarker',     'str'],
  markdown_headings:    ['markdownHeadings', 'bool'],
  hemingway_mode:       ['hemingwayMode',    'bool'],
  timer_type:           ['timerType',        'str'],
  timer_duration:       ['timerDuration',    'int'],
  timer_sound:          ['timerSound',       'bool'],
  timer_alert:          ['timerAlert',       'bool'],
  chrono_show:          ['timerShow',        'bool'],
  status_left:          ['statusLeft',       'str'],
  status_center:        ['statusCenter',     'str'],
  status_right:         ['statusRight',      'str'],
  cursor_restore:             ['cursorRestore',             'bool'],
  line_numbers:               ['lineNumbers',               'bool'],
  block_cursor:               ['blockCursor',               'bool'],
  blink_cursor:               ['blinkCursor',               'bool'],
  intercept_browser_shortcuts:['interceptBrowserShortcuts', 'bool'],
  intercept_context_menu:     ['interceptContextMenu',      'bool'],
  open_last_doc:              ['openLastDoc',               'bool'],
  browser_filter:             ['browserFilter',             'str'],
  browser_show_all:           ['browserShowAll',            'bool'],
  browser_subdirs:            ['browserSubdirs',            'bool'],
};

const SETTINGS_TO_INI = Object.fromEntries(
  Object.entries(INI_TO_SETTINGS).map(([k, [v]]) => [v, k])
);
// Fix aliases — keep the canonical INI key for write
SETTINGS_TO_INI['commentMarker']  = 'comment_marker';
SETTINGS_TO_INI['fontFamily']     = 'font_family';

// Per-profile settings — aligned with the Tcl/Android "profile" key set.
const PROFILE_KEYS = [
  'scheme', 'heading_marker', 'markdown_headings',
  'margin_width', 'margin_height', 'word_goal',
  'font_size', 'font_family', 'line_spacing',
  'line_numbers', 'dark_mode', 'block_cursor'
];
const PROFILE_JS_KEYS = PROFILE_KEYS.map(k => INI_TO_SETTINGS[k][0]);

// Scheme color key mapping (INI ↔ JS)
const SCHEME_INI_TO_JS = {
  color_bg:          'bg',         color_fg:          'fg',
  color_bg_bar:      'bgBar',      color_fg_bar:      'fgBar',
  color_bg_sel:      'bgSel',      color_heading:     'heading',
  color_comment:     'comment',    color_markup:      'markup',
  color_bg2:         'bg2',
  color_bg_alt:      'bgAlt',      color_fg_alt:      'fgAlt',
  color_bg_bar_alt:  'bgBarAlt',   color_fg_bar_alt:  'fgBarAlt',
  color_bg_sel_alt:  'bgSelAlt',   color_heading_alt: 'headingAlt',
  color_comment_alt: 'commentAlt', color_markup_alt:  'markupAlt',
  color_bg2_alt:     'bg2Alt',
  // legacy alias
  color_dim:         'comment',    color_dim_alt:     'commentAlt',
};
const SCHEME_JS_TO_INI = {
  bg:'color_bg', fg:'color_fg', bgBar:'color_bg_bar', fgBar:'color_fg_bar',
  bgSel:'color_bg_sel', heading:'color_heading', comment:'color_comment',
  markup:'color_markup', bg2:'color_bg2',
  bgAlt:'color_bg_alt', fgAlt:'color_fg_alt', bgBarAlt:'color_bg_bar_alt',
  fgBarAlt:'color_fg_bar_alt', bgSelAlt:'color_bg_sel_alt',
  headingAlt:'color_heading_alt', commentAlt:'color_comment_alt',
  markupAlt:'color_markup_alt', bg2Alt:'color_bg2_alt',
};

// ── Boolean coercion ──────────────────────────────────────────────────────
function parseBool(v) {
  return /^(yes|1|true|on)$/i.test(String(v).trim());
}

function coerceValue(type, val) {
  if (type === 'bool')   return parseBool(val);
  if (type === 'int')    return parseInt(val, 10);
  if (type === 'float')  return parseFloat(val);
  return val;
}

// `line_spacing` uses incompatible units across versions: the Tcl desktop stores a
// percentage (100 = normal line height; extra_px = lineHeight*(v-100)/100), while web
// and Android store a CSS line-height / setLineSpacing multiplier (default 1.5). The two
// conventions differ by a factor of 100. INI values >= 10 are assumed to use the
// percentage convention (Tcl, or an already-migrated web/Android file) and are divided
// by 100; smaller values are pre-conversion web/Android files and used as-is.
// writeIni() always emits the percentage convention going forward, so a stale value
// self-heals on the next save.
function lineSpacingFromIni(raw) {
  return raw >= 10 ? raw / 100 : raw;
}
function lineSpacingToIni(value) {
  return Math.round(value * 100);
}

// Strips inline comments (# preceded by whitespace). % is line-start-only.
// Leading whitespace trimmed; trailing preserved so '% ' marker round-trips correctly.
function stripComment(v) {
  return v.replace(/\s+#.*$/, '').replace(/^\s+/, '');
}

// ── Parser ────────────────────────────────────────────────────────────────
function parseIni(text) {
  const settings = {};
  const schemes  = {};   // {name: {jsKey: value}}
  const profiles = {};   // {name: {jsKey: value}} — per-profile overrides
  let activeProfile = 'default';

  let section    = '';
  let curScheme  = '';
  let curProfile = '';
  const TOPLEVEL = new Set(['editor', 'behaviour', 'keys', 'timer', 'misc', 'tui_colors', 'display', 'web']);

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('%')) continue;

    // Section header [name]
    const secMatch = line.match(/^\[([^[\]]+)\]$/);
    if (secMatch) {
      const hdr = secMatch[1].trim();
      if (hdr === 'schemes') {
        section = 'schemes'; curScheme = ''; curProfile = '';
      } else if (hdr === 'profiles') {
        section = 'profiles'; curProfile = ''; curScheme = '';
      } else if (section === 'schemes' && !TOPLEVEL.has(hdr)) {
        curScheme = hdr;
      } else if (section === 'profiles' && !TOPLEVEL.has(hdr)) {
        curProfile = hdr;
        if (!profiles[curProfile]) profiles[curProfile] = {};
      } else {
        section = hdr; curScheme = ''; curProfile = '';
      }
      continue;
    }

    // key = value
    const kvMatch = line.match(/^(\w+)\s*=(.*)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1].trim();
    const val = stripComment(kvMatch[2]);

    if (curScheme) {
      // Scheme color key
      const jsKey = SCHEME_INI_TO_JS[key];
      if (jsKey) {
        if (!schemes[curScheme]) schemes[curScheme] = {};
        schemes[curScheme][jsKey] = val;
      }
    } else if (curProfile) {
      // Per-profile override (12-key aligned set)
      if (PROFILE_KEYS.includes(key)) {
        const [jsKey, type] = INI_TO_SETTINGS[key];
        let v = coerceValue(type, val);
        if (key === 'line_spacing') v = lineSpacingFromIni(v);
        profiles[curProfile][jsKey] = v;
      }
    } else {
      // Global setting
      if (key === 'profile') { activeProfile = val.trim(); continue; }
      const mapping = INI_TO_SETTINGS[key];
      if (mapping) {
        const [jsKey, type] = mapping;
        if (type === 'bool')        settings[jsKey] = parseBool(val);
        else if (type === 'int')    settings[jsKey] = parseInt(val, 10)  || undefined;
        else if (type === 'float')  settings[jsKey] = parseFloat(val)    || undefined;
        else                        settings[jsKey] = val;
        if (key === 'line_spacing' && settings[jsKey] !== undefined) {
          settings[jsKey] = lineSpacingFromIni(settings[jsKey]);
        }
      }
    }
  }

  // Remove undefined values
  Object.keys(settings).forEach(k => settings[k] === undefined && delete settings[k]);

  return { settings, schemes, profiles, activeProfile };
}

// ── Writer ────────────────────────────────────────────────────────────────
function writeIni(s, allSchemes, profiles, activeProfile) {
  const b = (v) => v ? 'yes' : 'no';
  const nl = '\n';

  let out = '= WrithDeck configuration =' + nl;
  out += '% https://github.com/luginf/writhdeck' + nl + nl;

  out += '= editor =' + nl + '[editor]' + nl;
  out += `profile              = ${activeProfile || 'default'}` + nl;
  out += `comment_marker       = ${s.commentMarker   || '% '}` + nl;
  out += `bold_marker          = ${s.boldMarker      || '**'}` + nl;
  out += `italic_marker        = ${s.italicMarker    || '//'}` + nl;
  out += `underline_marker     = ${s.underlineMarker || '__'}` + nl;
  out += `strikethrough_marker = ${s.strikeMarker    || '--'}` + nl;
  out += nl;

  out += '= behaviour =' + nl + '[behaviour]' + nl;
  out += `hemingway_mode  = ${b(s.hemingwayMode)}` + nl;
  out += `cursor_restore               = ${b(s.cursorRestore !== false)}` + nl;
  out += `blink_cursor                 = ${b(s.blinkCursor)}` + nl;
  out += `% browser_filter: space-separated glob patterns (* ? [...]) for the browser file list` + nl;
  out += `browser_filter  = ${s.browserFilter ?? '*.txt *.t2t *.md *.ini'}` + nl;
  out += `% browser_show_all: bypass browser_filter and show all files` + nl;
  out += `browser_show_all = ${b(s.browserShowAll)}` + nl;
  out += `% browser_subdirs: scan and browse subfolders inside the watched folder` + nl;
  out += `browser_subdirs  = ${b(s.browserSubdirs)}` + nl;
  out += nl;

  out += '= web =' + nl + '[web]' + nl;
  out += `% Options specific to the web version — ignored by the desktop version` + nl;
  out += `open_last_doc                = ${b(s.openLastDoc)}` + nl;
  out += `intercept_browser_shortcuts  = ${b(s.interceptBrowserShortcuts)}` + nl;
  out += `intercept_context_menu       = ${b(s.interceptContextMenu !== false)}` + nl;
  out += nl;

  out += '= timer =' + nl;
  out += `timer_type     = ${s.timerType     || 'countdown'}` + nl;
  out += `timer_duration = ${s.timerDuration || 25}` + nl;
  out += `timer_sound    = ${b(s.timerSound)}` + nl;
  out += `timer_alert    = ${b(s.timerAlert)}` + nl;
  out += `chrono_show    = ${b(s.timerShow)}` + nl;
  out += nl;

  out += '= display =' + nl + '[display]' + nl;
  out += `status_left    = ${s.statusLeft   || ''}` + nl;
  out += `status_center  = ${s.statusCenter || ''}` + nl;
  out += `status_right   = ${s.statusRight  || ''}` + nl;
  out += nl;

  out += '= profiles =' + nl + '[profiles]' + nl;
  for (const [name, p] of Object.entries(profiles || {})) {
    const pv = (jsKey, dflt) => p[jsKey] !== undefined ? p[jsKey] : (s[jsKey] !== undefined ? s[jsKey] : dflt);
    out += `[${name}]` + nl;
    out += `scheme            = ${pv('scheme', 'default')}` + nl;
    out += `dark_mode         = ${b(pv('darkMode', true))}` + nl;
    out += `margin_width      = ${pv('marginX', 60)}` + nl;
    out += `margin_height     = ${pv('marginY', 40)}` + nl;
    out += `font_size         = ${pv('fontSize', 18)}` + nl;
    out += `font_family       = ${pv('fontFamily', 'monospace')}` + nl;
    out += `line_spacing      = ${lineSpacingToIni(pv('lineSpacing', 1.5))}` + nl;
    out += `word_goal         = ${pv('wordGoal', 0)}` + nl;
    out += `line_numbers      = ${b(pv('lineNumbers', false))}` + nl;
    out += `block_cursor      = ${b(pv('blockCursor', false))}` + nl;
    out += `heading_marker    = ${pv('headingMarker', '=')}` + nl;
    out += `markdown_headings = ${b(pv('markdownHeadings', true))}` + nl;
    out += nl;
  }

  out += '= schemes =' + nl + '[schemes]' + nl;
  out += '% colors in #rrggbb format' + nl + nl;

  const schemeOrder = ['default', ...Object.keys(allSchemes).filter(n => n !== 'default')];
  for (const name of schemeOrder) {
    const sc = allSchemes[name];
    if (!sc) continue;
    out += `= ${name} =` + nl + `[${name}]` + nl;
    out += '% dark mode' + nl;
    for (const jsKey of ['bg','fg','bgBar','fgBar','bgSel','heading','comment','markup','bg2']) {
      if (sc[jsKey]) out += `${SCHEME_JS_TO_INI[jsKey]} = ${sc[jsKey]}` + nl;
    }
    out += '% light mode' + nl;
    for (const jsKey of ['bgAlt','fgAlt','bgBarAlt','fgBarAlt','bgSelAlt','headingAlt','commentAlt','markupAlt','bg2Alt']) {
      if (sc[jsKey]) out += `${SCHEME_JS_TO_INI[jsKey]} = ${sc[jsKey]}` + nl;
    }
    out += nl;
  }

  return out;
}

const INI = { parseIni, writeIni, PROFILE_JS_KEYS };


'use strict';
// Syntax highlighting engine — textarea overlay technique

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Inject a block-cursor span at original-text column `col` inside HTML `html`.
// HTML tags are skipped; HTML entities count as one original character each.
function injectCursorAt(html, col) {
  let rem = col;
  let done = false;
  const result = html.replace(/(<[^>]+>)|(&[^;]+;)|([\s\S])/g, (m, tag, ent, ch) => {
    if (done || tag) return m;
    if (rem-- > 0) return m;
    done = true;
    return `<span class="hl-cursor">${m}</span>`;
  });
  return done ? result : result + '<span class="hl-cursor"> </span>';
}

// Build inline-markup rules once per highlight() call (regex compilation is
// loop-invariant — doing it inside the per-line loop cost ~70ms on a 90K-word
// document). Exposed so the incremental single-line repaint in editor.js (see
// `rehighlight()`'s fast path) can reuse the exact same rules.
function _buildMarkupRules(s) {
  const rules = [];
  if (s.boldMarker)      rules.push(_markupRule(s.boldMarker));
  if (s.italicMarker)    rules.push(_markupRule(s.italicMarker));
  if (s.underlineMarker) rules.push(_markupRule(s.underlineMarker));
  if (s.strikeMarker)    rules.push(_markupRule(s.strikeMarker));
  return rules;
}

function _markupRule(marker) {
  const escMarker = escapeHtml(marker);
  const rx = new RegExp(escRx(escMarker) + '(.+?)' + escRx(escMarker), 'g');
  return { rx, replacer: (_, inner) => `<span class="hl-markup">${escMarker}${inner}${escMarker}</span>` };
}

// Render a single line's inner HTML (heading/comment/dim/inline-markup), with
// no cursor or search overlay — the part that's identical between the full
// highlight() pass and the incremental single-line repaint fast path.
function _renderLine(line, s, hm, cm, markupRules, dim) {
  const esc = escapeHtml(line);
  if (hm && line.startsWith(s.headingMarker)) {
    return `<span class="hl-heading${dim ? ' hl-dim' : ''}">${esc}</span>`;
  }
  if (s.markdownHeadings && /^#{1,6}\s/.test(line)) {
    return `<span class="hl-heading${dim ? ' hl-dim' : ''}">${esc}</span>`;
  }
  if (cm && line.startsWith(s.commentMarker)) {
    return `<span class="hl-comment${dim ? ' hl-dim' : ''}">${esc}</span>`;
  }
  if (dim) {
    return `<span class="hl-dim">${esc}</span>`;
  }
  let result = esc;
  for (const rule of markupRules) {
    rule.rx.lastIndex = 0;
    result = result.replace(rule.rx, rule.replacer);
  }
  return result;
}

function highlight(text, s, searchTerm, paraStart, paraEnd, cursorPos) {
  const hm = escRx(s.headingMarker);
  const cm = escRx(s.commentMarker);
  const hasPara = paraStart !== undefined && paraEnd !== undefined;
  const lines = text.split('\n');
  const markupRules = _buildMarkupRules(s);

  // Compute cursor line/col from absolute offset
  let cursorLine = -1, cursorCol = -1;
  if (cursorPos !== undefined) {
    let off = 0;
    for (let i = 0; i < lines.length; i++) {
      if (cursorPos <= off + lines[i].length) { cursorLine = i; cursorCol = cursorPos - off; break; }
      off += lines[i].length + 1;
    }
    if (cursorLine === -1) { cursorLine = lines.length - 1; cursorCol = lines[lines.length - 1].length; }
  }

  const out = lines.map((line, idx) => {
    const dim = hasPara && (idx < paraStart || idx > paraEnd);
    let lineHtml = _renderLine(line, s, hm, cm, markupRules, dim);
    if (idx === cursorLine) lineHtml = injectCursorAt(lineHtml, cursorCol);
    return `<span class="hl-line">${lineHtml}</span>`;
  });

  // \n between spans = line break in the pre's pre-wrap IFC.
  // Trailing \n ensures overlay height matches the textarea (cursor line at end).
  if (!searchTerm) return out.join('\n') + '\n';

  // Inject search highlights into text nodes only (skip HTML tags)
  const termRx = escRx(escapeHtml(searchTerm));
  return out.map(line => line.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) =>
    tag ? tag : text.replace(new RegExp(termRx, 'gi'),
      m => `<span class="hl-search">${m}</span>`)
  )).join('\n') + '\n';
}

function escRx(s) {
  return s ? s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
}

function wordCount(text) {
  return (text.match(/\S+/g) || []).length;
}


'use strict';
// Timer / stopwatch module
const Timer = (() => {
  let remaining = 0;   // seconds
  let active    = false;
  let lastTick  = 0;
  let intervalId = null;

  function reset() {
    const s = State.settings;
    remaining = s.timerType === 'countdown' ? s.timerDuration * 60 : 0;
    lastTick  = 0;
  }

  function start() {
    if (active) return;
    if (lastTick === 0) reset();
    active    = true;
    lastTick  = Date.now();
    intervalId = setInterval(tick, 500);
    Editor.updateStatusBar();
  }

  function pause() {
    if (!active) return;
    active = false;
    clearInterval(intervalId);
    intervalId = null;
    Editor.updateStatusBar();
  }

  function toggle() { active ? pause() : start(); }

  function stopReset() {
    pause();
    lastTick = 0;
    reset();
    Editor.updateStatusBar();
  }

  function tick() {
    if (!active) return;
    const now = Date.now();
    const elapsed = Math.floor((now - lastTick) / 1000);
    if (elapsed < 1) return;
    lastTick = now;
    if (State.settings.timerType === 'countdown') {
      remaining -= elapsed;
      if (remaining <= 0) {
        remaining = 0;
        pause();
        onFinished();
      }
    } else {
      remaining += elapsed;
    }
    Editor.updateStatusBar();
  }

  function onFinished() {
    if (State.settings.timerSound) beep();
    if (State.settings.timerAlert) {
      document.getElementById('timer-alert-dlg').showModal();
    }
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch (_) {}
  }

  function format() {
    const r = Math.max(0, remaining);
    const m = Math.floor(r / 60);
    const s = r % 60;
    const disp = `${m}'${String(s).padStart(2,'0')}"`;
    return active ? `[${disp}]` : (lastTick !== 0 ? disp : (
      State.settings.timerType === 'countdown'
        ? `${State.settings.timerDuration}'00"`
        : `0'00"`
    ));
  }

  function isActive() { return active; }

  return { start, pause, toggle, stopReset, format, isActive, reset };
})();


'use strict';
// Table of Contents — side panel (right)
const TOC = (() => {
  let _visible = false;
  let _pinned  = false;
  let _focused = -1;
  let _wired   = false;

  function _show(visible) {
    const panel = document.getElementById('toc-panel');
    if (!panel) return;
    // Use style.display instead of hidden attribute — avoids Firefox UA cascade issues
    panel.style.display = visible ? 'flex' : 'none';
    const btn = document.getElementById('ed-toc-btn');
    if (btn) btn.classList.toggle('active', visible);
  }

  function _setPinned(val) {
    _pinned = val;
    const pinBtn = document.getElementById('toc-pin-btn');
    if (pinBtn) {
      pinBtn.classList.toggle('active', _pinned);
      pinBtn.title = _pinned
        ? 'Unpin TOC (closes when selecting a chapter)'
        : 'Pin TOC (stays open when selecting a chapter)';
    }
  }

  function _wire() {
    if (_wired) return;
    _wired = true;
    const pinBtn = document.getElementById('toc-pin-btn');
    if (!pinBtn) return;
    pinBtn.addEventListener('click', () => togglePin());
  }

  // Keyboard equivalent of clicking the pin button (Shift+Ctrl+F11, mirrors
  // Tcl's cfg_key_toc_pinned). Also opens the panel when pinning it while closed —
  // pinning a hidden panel would otherwise have no visible effect.
  function togglePin() {
    _wire();
    _setPinned(!_pinned);
    if (_pinned && !_visible) {
      _visible = true;
      _show(true);
      render();
      focusPanel();
    }
  }

  function parse(text, s) {
    const entries = [];
    text.split('\n').forEach((line, idx) => {
      let level = 0, title = '';
      if (s.markdownHeadings) {
        const m = line.match(/^(#{1,3})\s+(.+)/);
        if (m) { level = m[1].length; title = m[2]; }
      }
      if (!level && s.headingMarker) {
        const hm  = s.headingMarker;
        const hmR = hm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (line.startsWith(hm)) {
          const mm = line.match(new RegExp(`^(${hmR}+)`));
          level = mm ? Math.min(Math.round(mm[1].length / hm.length), 3) : 1;
          title = line.slice(hm.length).replace(new RegExp(`^${hmR}*\\s*`), '')
                      .replace(new RegExp(`\\s*${hmR}*$`), '').trim()
                  || line.trim();
        }
      }
      if (level && title) entries.push({ line: idx, level, title });
    });
    return entries;
  }

  function lineToOffset(text, lineIdx) {
    return text.split('\n').slice(0, lineIdx).reduce((s, l) => s + l.length + 1, 0);
  }

  // The `.hl-line` spans in #ed-highlight share the textarea's exact font/padding/
  // line-height (CSS-enforced) and are kept in sync with its content, so a line's
  // already-computed offsetTop gives its scroll position directly — no extra layout.
  function linePixelTop(lineIdx) {
    const pre = document.getElementById('ed-highlight');
    const padTop = parseFloat(getComputedStyle(pre).paddingTop) || 0;
    return pre.children[lineIdx].offsetTop + padTop;
  }

  function _items() {
    return Array.from(document.querySelectorAll('#toc-list .toc-item[data-line]'));
  }

  function _focusItem(idx) {
    const items = _items();
    items.forEach(it => it.classList.remove('toc-focused'));
    if (!items.length) { _focused = -1; return; }
    _focused = ((idx % items.length) + items.length) % items.length;
    items[_focused].classList.add('toc-focused');
    items[_focused].scrollIntoView({ block: 'nearest' });
  }

  function move(delta) {
    if (!_items().length) return;
    _focusItem(_focused < 0 ? (delta > 0 ? 0 : _items().length - 1) : _focused + delta);
  }

  function selectFocused() {
    const items = _items();
    if (_focused >= 0 && _focused < items.length) items[_focused].click();
  }

  function _select(ta, lineIdx) {
    const offset = lineToOffset(ta.value, lineIdx);
    ta.focus();
    ta.setSelectionRange(offset, offset);
    ta.scrollTop = Math.max(0, linePixelTop(lineIdx) - ta.clientHeight / 3);
    if (!_pinned) {
      _visible = false;
      _show(false);
      _focused = -1;
    }
  }

  function render() {
    const ta      = document.getElementById('ed-input');
    const list    = document.getElementById('toc-list');
    if (!ta || !list) return;
    const entries = parse(ta.value, State.settings);
    list.innerHTML = '';
    _focused = -1;
    if (!entries.length) {
      const div = document.createElement('div');
      div.className = 'toc-item';
      div.style.color = 'var(--fg-bar)';
      div.textContent = 'No headings found.';
      list.appendChild(div);
      return;
    }
    entries.forEach(e => {
      const div = document.createElement('div');
      div.className = `toc-item level-${e.level}`;
      div.dataset.line = e.line;
      div.textContent = e.title;
      div.addEventListener('click', () => _select(ta, e.line));
      list.appendChild(div);
    });
  }

  function focusPanel() {
    const list = document.getElementById('toc-list');
    if (list) list.focus({ preventScroll: true });
    _focusItem(0);
  }

  function toggle() {
    _wire();
    _visible = !_visible;
    _show(_visible);
    if (_visible) {
      render();
      focusPanel();
    } else {
      _focused = -1;
    }
  }

  function hide() {
    _visible = false;
    _show(false);
    _focused = -1;
  }

  function refresh() { if (_visible) render(); }

  return {
    toggle, hide, refresh, move, selectFocused, focusPanel, togglePin,
    isVisible: () => _visible,
    isPinned: () => _pinned,
    isFocused: () => {
      const panel = document.getElementById('toc-panel');
      return !!(panel && panel.contains(document.activeElement));
    }
  };
})();


'use strict';
// Daily writing stats module
const Stats = (() => {
  function show() {
    const body = document.getElementById('stats-body');
    body.innerHTML = '';

    const daily = State.daily;
    const docs  = State.docs;
    if (!Object.keys(daily).length) {
      body.innerHTML = '<p style="color:var(--fg-bar);padding:12px">No writing stats yet.</p>';
      document.getElementById('stats-dlg').showModal();
      return;
    }

    const docMap = {};
    docs.forEach(d => { docMap[d.id] = d.name; });

    Object.entries(daily).forEach(([id, days]) => {
      if (!Object.keys(days).length) return;
      const name = document.createElement('div');
      name.className = 'stats-doc-name';
      name.textContent = docMap[id] || `#${id}`;
      body.appendChild(name);

      const table = document.createElement('table');
      table.className = 'stats-table';
      table.innerHTML = '<tr><th>Date</th><th>Words</th></tr>';
      const today = new Date().toISOString().slice(0, 10);
      Object.entries(days).sort((a,b) => b[0].localeCompare(a[0])).forEach(([date, wc]) => {
        const tr = document.createElement('tr');
        const suffix = date === today ? ' ← today' : '';
        tr.innerHTML = `<td>${date}${suffix}</td><td>${wc}</td>`;
        table.appendChild(tr);
      });
      body.appendChild(table);
    });

    document.getElementById('stats-dlg').showModal();
  }

  return { show };
})();


'use strict';
// Editor module
const Editor = (() => {
  const ta  = () => document.getElementById('ed-input');
  const pre = () => document.getElementById('ed-highlight');

  let _autosaveId     = null;
  let _clockId        = null;
  let _tocRefresh     = null;
  let _cmdMode        = false;
  let _cmdNavIdx      = -1;
  const _CMD_LIST = [
    ['f','find'], ['r','replace'], ['g','goto'], ['n','linenos'], ['o','toc'],
    ['d','dark'],  ['c','config'], ['e','export'], ['s','stats'], ['a','analyse'],
    ['i','info'],  ['t','timer'], ['p','pause'], ['w','typewriter'], ['m','menu'], ['q','close'],
    ['1','h1'], ['2','h2'], ['3','h3'], ['b','bold'], ['u','underline'], ['x','strike'], ['/','comment'],
  ];
  let _typewriter       = false;
  let _wc               = 0;
  let _sessionBaseline  = -1;  // total words in doc minus today's prior additions (set on open)
  let _sessionMaxToday  = 0;   // high-water mark of words added today this session

  // ── Open / close ──────────────────────────────────────────────────────────

  async function open(doc) {
    // For disk files, try to read fresh content from disk
    if (doc.fileHandle) {
      try {
        const perm = await doc.fileHandle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          const file = await doc.fileHandle.getFile();
          doc.content = await file.text();
        } else {
          const req = await doc.fileHandle.requestPermission({ mode: 'readwrite' });
          if (req === 'granted') {
            const file = await doc.fileHandle.getFile();
            doc.content = await file.text();
          }
          // If denied: fall through and use cached content
        }
      } catch (_) { /* use cached content */ }
    }

    State.doc   = doc;
    State.dirty = false;

    document.getElementById('browser').hidden = true;
    document.getElementById('editor').hidden  = false;
    document.title = `${doc.name} — Writhdeck`;

    const input = ta();
    input.value = doc.content || '';

    // Restore cursor
    const offset = State.cursors[doc.id] || 0;
    input.setSelectionRange(offset, offset);

    _typewriter = false;
    document.getElementById('editor').classList.remove('typewriter');
    rehighlight();
    syncGutter();
    syncScroll();
    applyLineNumbers();
    updateStatusBar();
    input.focus();
    _wc = wordCount(input.value);

    // Session baseline: words that existed before today's contribution
    if (!doc.isIni) {
      const priorToday = doc.id ? todayWords(doc.id) : 0;
      _sessionBaseline = _wc - priorToday;
      _sessionMaxToday = priorToday;
    }

    startAutosave();
    startClock();
    if (!doc.virtual) pushRecent(doc.id);
    Browser.render();
  }

  // Yes/No/Cancel confirmation matching the Tcl/Tk and Android semantics:
  // Yes = save then close, No = discard changes and close, Cancel = stay open.
  // A native confirm() only offers two buttons, which forced "Cancel" to mean
  // "close without saving" — there was no way to abort closing altogether.
  let _closeConfirmWired   = false;
  let _closeConfirmResolve = null;
  function confirmSaveBeforeClose(name) {
    if (!_closeConfirmWired) {
      _closeConfirmWired = true;
      const dlg = document.getElementById('close-confirm-dlg');
      const respond = val => {
        const resolve = _closeConfirmResolve;
        _closeConfirmResolve = null;
        dlg.close();
        if (resolve) resolve(val);
      };
      document.getElementById('close-confirm-yes').addEventListener('click', () => respond('yes'));
      document.getElementById('close-confirm-no').addEventListener('click', () => respond('no'));
      document.getElementById('close-confirm-cancel').addEventListener('click', () => respond('cancel'));
      dlg.addEventListener('cancel', e => { e.preventDefault(); respond('cancel'); }); // Esc → Cancel
    }
    return new Promise(resolve => {
      _closeConfirmResolve = resolve;
      document.getElementById('close-confirm-msg').textContent = `Save "${name}" before closing?`;
      document.getElementById('close-confirm-dlg').showModal();
    });
  }

  async function close() {
    if (State.dirty && !State.doc.isIni) {
      const choice = await confirmSaveBeforeClose(State.doc.name);
      if (choice === 'cancel') return;
      if (choice === 'yes') await save();
      // 'no' — discard changes and proceed to close
    }
    saveCursorPos();
    stopAutosave();
    stopClock();
    TOC.hide();
    _cmdMode          = false;
    _sessionBaseline  = -1;
    _sessionMaxToday  = 0;
    State.doc   = null;
    State.dirty = false;
    document.title = 'Writhdeck';
    document.getElementById('editor').hidden  = true;
    document.getElementById('browser').hidden = false;
    Browser.render();
  }

  // Show the document browser. Upstream this is identical to closing the
  // editor (there is only the browser to go back to); integrations (e.g. the
  // LionWiki plugin) override Editor.browser to open their own file browser
  // while keeping Editor.close as a distinct "quit / leave" action.
  async function browser() { return close(); }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function save() {
    if (!State.doc) return;
    State.doc.content = ta().value;

    // Virtual INI doc — parse and apply, don't write to docs store
    if (State.doc.isIni) {
      try {
        const { settings, schemes, profiles, activeProfile } = INI.parseIni(State.doc.content);
        Object.assign(State.settings, settings);
        for (const [n, sc] of Object.entries(schemes)) {
          customSchemes[n] = SCHEMES[n] ? { ...SCHEMES[n], ...sc } : sc;
        }
        applyParsedProfiles(profiles, activeProfile);
        await saveSettings();   // re-generates canonical INI text → IDB
        State.doc.content = State.iniText; // reflect normalised output
        ta().value = State.iniText;
        rehighlight();
        applyTheme();
        State.dirty = false;
        setMsg('Settings applied');
        Browser.render();
      } catch (e) {
        setMsg('Parse error');
        console.error(e);
      }
      return;
    }

    State.doc.modified = Date.now();

    if (State.doc.fileHandle) {
      // Save to disk (File System Access API)
      try {
        const perm = await State.doc.fileHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          const req = await State.doc.fileHandle.requestPermission({ mode: 'readwrite' });
          if (req !== 'granted') { setMsg('Permission denied'); return; }
        }
        const writable = await State.doc.fileHandle.createWritable();
        await writable.write(State.doc.content);
        await writable.close();
        setMsg('Saved to disk');
      } catch (e) {
        setMsg('Disk save failed');
        console.error(e);
        return;
      }
    }

    // Always update IDB (caches content, persists handle)
    await DB.saveDoc(State.doc);
    State.dirty = false;
    if (!State.doc.fileHandle) setMsg('Saved');

    // Update docs list
    const idx = State.docs.findIndex(d => d.id === State.doc.id);
    if (idx >= 0) State.docs[idx] = State.doc;

    // Update daily stats (track words added today, not total)
    _wc = wordCount(State.doc.content);
    if (_sessionBaseline >= 0) {
      const added = Math.max(0, _wc - _sessionBaseline);
      if (added > _sessionMaxToday) _sessionMaxToday = added;
      updateDaily(State.doc.id, _sessionMaxToday);
    }

    updateStatusBar();
  }

  // Save As (Ctrl+Shift+S) — mirrors the Tcl GUI's Save-As. With the File System
  // Access API, lets the user pick a new file/location and re-points this document
  // at it. Without FSA (e.g. Firefox), falls back to saving a copy under a new name
  // in browser storage and switches the editor to that copy.
  async function saveAs() {
    if (!State.doc || State.doc.isIni) return;
    if (typeof window.showSaveFilePicker === 'function') {
      let handle;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName: State.doc.name,
          types: [{ description: 'Text', accept: { 'text/plain': ['.txt', '.md', '.t2t'] } }]
        });
      } catch (e) {
        if (e.name !== 'AbortError') { setMsg('Save As failed'); console.error(e); }
        return;
      }
      try {
        const writable = await handle.createWritable();
        await writable.write(ta().value);
        await writable.close();
      } catch (e) {
        setMsg('Save As failed'); console.error(e);
        return;
      }
      State.doc.fileHandle = handle;
      State.doc.name       = handle.name;
      State.doc.fromDisk    = true;
      State.doc.content     = ta().value;
      State.doc.modified    = Date.now();
      await DB.saveDoc(State.doc);
      const idx = State.docs.findIndex(d => d.id === State.doc.id);
      if (idx >= 0) State.docs[idx] = State.doc;
      State.dirty = false;
      document.title = `${State.doc.name} — Writhdeck`;
      setMsg('Saved as ' + State.doc.name);
      updateStatusBar();
      Browser.render();
      return;
    }

    // Fallback: save a copy under a new name in browser storage
    const name = prompt('Save as (new name):', Browser.uniqueName(State.doc.name));
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (Browser.nameExists(trimmed)) {
      alert(`A document named "${trimmed}" already exists.`);
      return;
    }
    const copy = { name: trimmed, content: ta().value, created: Date.now(), modified: Date.now() };
    await DB.saveDoc(copy);
    State.docs.push(copy);
    State.doc   = copy;
    State.dirty = false;
    document.title = `${copy.name} — Writhdeck`;
    setMsg('Saved as ' + copy.name);
    updateStatusBar();
    Browser.render();
  }

  // ── Input handling ────────────────────────────────────────────────────────

  function onInput() {
    if (!_tryIncrementalRepaint()) rehighlight();
    if (!State.dirty) State.dirty = true;
    typewriterScroll();
    updateLineNumbers();
    if (_tocRefresh) clearTimeout(_tocRefresh);
    _tocRefresh = setTimeout(() => TOC.refresh(), 600);
    // Hemingway mode: prevent delete
    if (State.settings && State.settings.hemingwayMode) {
      // Handled via keydown
    }
    updateStatusBar();
  }

  // Cache describing the line the cursor sat on after the last render — lets
  // onInput() locate the changed line via lastIndexOf/indexOf around the
  // cursor (cost ~ line length) instead of text.split('\n') + full-array diff
  // (cost ~ document size, plus ~9600 string allocations on a 90K-word doc).
  let _prevText = null;
  let _prevLineIdx = -1;
  let _prevLineStart = -1;
  let _prevLineEnd = -1;

  // Tracks which <span class="hl-line"> currently renders the <span class="hl-cursor">
  // (block cursor mode only) and that line's offsets in the source text — lets
  // syncBlockCursor()/_tryIncrementalRepaint() move the cursor span by patching
  // just the old/new line(s) instead of a full rehighlight(). -1 when block
  // cursor is off or no cursor has been placed yet.
  let _prevCursorLineIdx = -1;
  let _prevCursorLineStart = -1;
  let _prevCursorLineEnd = -1;

  // Locate the line containing offset `pos` in `text` without scanning the
  // whole document for its boundaries (lastIndexOf/indexOf walk backward and
  // forward from `pos` only). Still counts newlines before the line to get
  // its index — O(document size), so only call this from full-render paths.
  // Keeps _prevLineIdx/_prevLineStart/_prevLineEnd correct when the cursor
  // moves WITHOUT an edit (click, arrow keys) — without this, a click to a
  // different line followed by typing could make _tryIncrementalRepaint patch
  // the wrong <span class="hl-line">. Cheap in the common case (cursor stays
  // within the cached line's range — just a numeric comparison); only pays
  // the O(document size) newline count when the cursor actually changes line.
  function syncCursorLineCache() {
    if (_prevText === null) return;
    const text = ta().value;
    if (text !== _prevText) return;   // an edit is pending a render — leave it to rehighlight/_tryIncrementalRepaint
    const pos = ta().selectionStart;
    if (pos >= _prevLineStart && pos <= _prevLineEnd) return;
    const info = _lineInfoAt(text, pos);
    _prevLineIdx = info.idx;
    _prevLineStart = info.lineStart;
    _prevLineEnd = info.lineEnd;
  }

  function _lineInfoAt(text, pos) {
    // lastIndexOf(needle, -1) clamps to checking index 0 rather than meaning
    // "nothing before position 0" — special-case pos === 0 to avoid that trap.
    const lineStart = pos <= 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    let idx = 0;
    for (let i = text.indexOf('\n'); i !== -1 && i < lineStart; i = text.indexOf('\n', i + 1)) idx++;
    return { idx, lineStart, lineEnd };
  }

  function rehighlight() {
    const searchVisible = !document.getElementById('search-bar').hidden;
    let paraStart, paraEnd;
    if (_typewriter) {
      const input = ta();
      const text  = input.value;
      const idx   = text.substring(0, input.selectionStart).split('\n').length - 1;
      const ls    = text.split('\n');
      const s     = State.settings;
      const isBoundary = i => {
        const l = ls[i] || '';
        return !l.trim()
          || (s.headingMarker && l.startsWith(s.headingMarker))
          || (s.markdownHeadings && /^#{1,6}\s/.test(l))
          || (s.commentMarker && l.startsWith(s.commentMarker));
      };
      paraStart = idx; paraEnd = idx;
      if (!isBoundary(idx)) {
        while (paraStart > 0 && !isBoundary(paraStart - 1)) paraStart--;
        while (paraEnd < ls.length - 1 && !isBoundary(paraEnd + 1)) paraEnd++;
      }
    }
    const cursorPos = State.settings.blockCursor ? ta().selectionStart : undefined;
    const text = ta().value;
    pre().innerHTML = highlight(text, State.settings, searchVisible ? _searchTerm : '', paraStart, paraEnd, cursorPos);
    const info = _lineInfoAt(text, ta().selectionStart);
    _prevText = text;
    _prevLineIdx = info.idx;
    _prevLineStart = info.lineStart;
    _prevLineEnd = info.lineEnd;
    if (State.settings.blockCursor) {
      _prevCursorLineIdx = info.idx;
      _prevCursorLineStart = info.lineStart;
      _prevCursorLineEnd = info.lineEnd;
    } else {
      _prevCursorLineIdx = -1;
    }
    scheduleSyncGutter();
  }

  // Patches the DOM node for a single changed line instead of replacing the
  // whole overlay's innerHTML — on a 90K-word/9600-line document, rebuilding
  // the full ~700KB HTML string and ~10K-span DOM subtree on EVERY keystroke
  // is what causes typed characters to lag seconds behind: each keystroke
  // queues another full-document re-render, and they pile up faster than the
  // browser can paint them. Returns true if it handled the repaint, false if
  // the caller should fall back to the full rehighlight().
  //
  // Only safe when the result is guaranteed identical to a full highlight()
  // pass: that means no search overlay, no typewriter dimming (depends on
  // paragraph boundaries — cross-line state) and no block-cursor span (only
  // injected on the cursor's line, computed from the whole document).
  // Finds the changed line via lastIndexOf/indexOf around the cursor (cost ~
  // line length, NOT document size — see _prevText/_prevLineIdx above). A
  // single atomic edit (the only kind a native 'input' event represents) can
  // only insert/remove a '\n' if it changes this line's start offset or
  // shifts what follows it; if both the start offset AND the trailing length
  // (text.length - lineEnd) are unchanged from the last render, no newline
  // was added or removed anywhere — this is a pure same-line content edit and
  // _prevLineIdx still names the right <span class="hl-line"> to patch.
  function _tryIncrementalRepaint() {
    if (_prevText === null || _prevLineIdx < 0) return false;
    if (!document.getElementById('search-bar').hidden) return false;
    if (_typewriter) return false;

    const text = ta().value;
    const pos  = ta().selectionStart;
    const lineStart = pos <= 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;

    if (lineStart !== _prevLineStart) return false;
    if (text.length - lineEnd !== _prevText.length - _prevLineEnd) return false;

    const lineEl = pre().children[_prevLineIdx];
    if (!lineEl) return false;

    const s = State.settings;
    let lineHtml = _renderLine(text.slice(lineStart, lineEnd), s, escRx(s.headingMarker), escRx(s.commentMarker), _buildMarkupRules(s), false);
    // Typing always edits at the cursor, which (per the invariant maintained by
    // rehighlight()/syncBlockCursor()) is already on this same line — so the
    // cursor span only ever needs to move WITHIN this line, never to another.
    if (s.blockCursor) {
      lineHtml = injectCursorAt(lineHtml, pos - lineStart);
      _prevCursorLineIdx = _prevLineIdx;
      _prevCursorLineStart = lineStart;
      _prevCursorLineEnd = lineEnd;
    }
    lineEl.innerHTML = lineHtml;
    _prevText = text;
    _prevLineStart = lineStart;
    _prevLineEnd = lineEnd;
    // _prevLineIdx unchanged — same line, no newlines shifted before it
    scheduleSyncGutter();
    return true;
  }

  // Moves the <span class="hl-cursor"> to the line under the cursor by
  // re-rendering only the old and new cursor lines — avoids a full
  // rehighlight() (rebuilding all <span class="hl-line"> via innerHTML, very
  // costly on large documents in Firefox) on every click/arrow-key when block
  // cursor is enabled. Reads line text from `text` (the source), not from the
  // DOM, since a line previously holding an end-of-line cursor has a synthetic
  // trailing space appended to its rendered HTML (see injectCursorAt).
  function syncBlockCursor() {
    if (!State.settings.blockCursor || !State.doc) return;
    const text = ta().value;
    const pos  = ta().selectionStart;
    const info = _lineInfoAt(text, pos);
    const col  = pos - info.lineStart;

    if (info.idx !== _prevCursorLineIdx && _prevCursorLineIdx >= 0) {
      _patchCursorLine(_prevCursorLineIdx, text.slice(_prevCursorLineStart, _prevCursorLineEnd), undefined);
    }
    _patchCursorLine(info.idx, text.slice(info.lineStart, info.lineEnd), col);
    _prevCursorLineIdx = info.idx;
    _prevCursorLineStart = info.lineStart;
    _prevCursorLineEnd = info.lineEnd;
  }

  function _patchCursorLine(idx, lineText, cursorCol) {
    const lineEl = pre().children[idx];
    if (!lineEl) return;
    const s = State.settings;
    let html = _renderLine(lineText, s, escRx(s.headingMarker), escRx(s.commentMarker), _buildMarkupRules(s), false);
    if (cursorCol !== undefined) html = injectCursorAt(html, cursorCol);
    lineEl.innerHTML = html;
  }

  function syncGutter() {
    const input = ta();
    const hl    = pre();
    // Measure actual scrollbar width: offsetWidth includes it, clientWidth doesn't
    const gutter   = input.offsetWidth - input.clientWidth;
    const baseRight = parseFloat(getComputedStyle(input).paddingRight) || 0;
    hl.style.paddingRight = (baseRight + gutter) + 'px';
  }

  // Reading offsetWidth/clientWidth/getComputedStyle right after mutating the (huge)
  // overlay's innerHTML forces a synchronous layout of the whole document — on a
  // 90K-word file that cost ~250ms PER KEYSTROKE. Deferring to rAF lets the browser
  // fold the measurement into the layout it has to do for the next paint anyway,
  // and collapses bursts of rehighlight() calls into a single measurement.
  let _gutterRaf = null;
  function scheduleSyncGutter() {
    if (_gutterRaf !== null) return;
    _gutterRaf = requestAnimationFrame(() => {
      _gutterRaf = null;
      syncGutter();
    });
  }

  function syncScroll() {
    pre().scrollTop  = ta().scrollTop;
    pre().scrollLeft = ta().scrollLeft;
    const ln = document.getElementById('ed-linenos');
    if (ln && !ln.hidden) ln.scrollTop = ta().scrollTop;
  }

  function saveCursorPos() {
    if (!State.doc) return;
    State.cursors[State.doc.id] = ta().selectionStart;
    saveCursors();
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  // ── Typewriter mode ───────────────────────────────────────────────────────

  function toggleTypewriter() {
    _typewriter = !_typewriter;
    document.getElementById('editor').classList.toggle('typewriter', _typewriter);
    setMsg(_typewriter ? 'Typewriter mode on' : 'Typewriter mode off');
    if (_typewriter) typewriterScroll();
  }

  function isTypewriter() { return _typewriter; }

  function typewriterScroll() {
    if (!_typewriter) return;
    const input   = ta();
    const lineIdx = input.value.substring(0, input.selectionStart).split('\n').length - 1;
    const lh      = parseFloat(getComputedStyle(input).lineHeight) || 20;
    input.scrollTop = Math.max(0, linePixelTop(lineIdx) - input.clientHeight / 2 + lh / 2);
  }

  // ── Line numbers ──────────────────────────────────────────────────────────

  // Most keystrokes don't change the line count — skip the (expensive, full-text)
  // rebuild when it's unchanged. Reading scrollTop right after rewriting `textContent`
  // forces a synchronous reflow of the gutter (same layout-thrashing pattern as
  // syncGutter — ~100-180ms on a 90K-word doc), so defer it to rAF; `syncScroll()`
  // (wired to the textarea's `scroll` event) keeps it in sync the rest of the time.
  let _lastLineCount = -1;
  function updateLineNumbers() {
    const el = document.getElementById('ed-linenos');
    if (!el || el.style.display === 'none') return;
    const count = (ta().value.match(/\n/g) || []).length + 1;
    if (count === _lastLineCount) return;
    _lastLineCount = count;
    el.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
    el.style.width = `calc(${String(count).length + 1}ch + 12px)`;
    requestAnimationFrame(() => { el.scrollTop = ta().scrollTop; });
  }

  function applyLineNumbers() {
    const el = document.getElementById('ed-linenos');
    if (!el) return;
    const show = !!State.settings.lineNumbers;
    el.style.display = show ? 'block' : 'none';
    if (show) { _lastLineCount = -1; updateLineNumbers(); }
  }

  function toggleLineNumbers() {
    State.settings.lineNumbers = !State.settings.lineNumbers;
    applyLineNumbers();
    saveSettings();
    setMsg(State.settings.lineNumbers ? 'Line numbers on' : 'Line numbers off');
  }

  // ── Go to line ────────────────────────────────────────────────────────────

  function gotoLine() {
    const bar = document.getElementById('goto-bar');
    bar.hidden = false;
    const gi = document.getElementById('goto-input');
    gi.value = '';
    gi.focus();
    gi.select();
  }

  function gotoLineGo() {
    const n = parseInt(document.getElementById('goto-input').value, 10);
    gotoLineClose();
    if (isNaN(n) || n < 1) return;
    const input   = ta();
    const lines   = input.value.split('\n');
    const lineIdx = Math.min(n - 1, lines.length - 1);
    let offset = 0;
    for (let i = 0; i < lineIdx; i++) offset += lines[i].length + 1;
    input.focus();
    input.setSelectionRange(offset, offset);
    input.scrollTop = Math.max(0, linePixelTop(lineIdx) - input.clientHeight / 3);
  }

  function gotoLineClose() {
    document.getElementById('goto-bar').hidden = true;
    ta().focus();
  }

  // The `.hl-line` spans in #ed-highlight share the textarea's exact font/padding/
  // line-height (CSS-enforced) and are kept in sync with its content, so a line's
  // already-computed offsetTop gives its scroll position directly — no extra layout.
  function linePixelTop(lineIdx) {
    const pre = document.getElementById('ed-highlight');
    const padTop = parseFloat(getComputedStyle(pre).paddingTop) || 0;
    return pre.children[lineIdx].offsetTop + padTop;
  }

  // ── Markup helpers ────────────────────────────────────────────────────────

  function applyLineMarker(marker) {
    if (!marker) return;
    // Always separate the marker from the line's content with exactly one
    // space (e.g. "% comment"), regardless of whether the configured marker
    // itself already ends with whitespace (e.g. "%" or "% ").
    const trimmed = marker.replace(/\s+$/, '');
    const input = ta();
    const s = input.selectionStart, e = input.selectionEnd;
    const text = input.value;
    const blockStart = text.lastIndexOf('\n', s - 1) + 1;
    const raw = text.indexOf('\n', e);
    const blockEnd = raw === -1 ? text.length : raw;
    const lines = text.slice(blockStart, blockEnd).split('\n');
    const allMarked = lines.every(l => l.startsWith(trimmed));
    const newLines = allMarked
      ? lines.map(l => {
          const rest = l.slice(trimmed.length);
          return rest.startsWith(' ') ? rest.slice(1) : rest;
        })
      : lines.map(l => l === '' ? trimmed : trimmed + ' ' + l);
    const newBlock = newLines.join('\n');
    input.focus();
    input.setSelectionRange(blockStart, blockEnd);
    document.execCommand('insertText', false, newBlock);
    input.setSelectionRange(blockStart, blockStart + newBlock.length);
    onInput();
  }

  function applyInlineMarker(marker) {
    if (!marker) return;
    const input = ta();
    const s = input.selectionStart, e = input.selectionEnd;
    const text = input.value;
    input.focus();
    if (s === e) {
      input.setSelectionRange(s, s);
      document.execCommand('insertText', false, marker + marker);
      input.setSelectionRange(s + marker.length, s + marker.length);
    } else {
      const sel = text.slice(s, e);
      const isWrapped = sel.startsWith(marker) && sel.endsWith(marker) && sel.length > marker.length * 2;
      if (isWrapped) {
        const inner = sel.slice(marker.length, -marker.length);
        input.setSelectionRange(s, e);
        document.execCommand('insertText', false, inner);
        input.setSelectionRange(s, s + inner.length);
      } else {
        const wrapped = marker + sel + marker;
        input.setSelectionRange(s, e);
        document.execCommand('insertText', false, wrapped);
        input.setSelectionRange(s, s + wrapped.length);
      }
    }
    onInput();
  }

  function applyHeading(level) {
    const marker = State.settings.headingMarker;
    if (!marker) return;
    const input = ta();
    const s = input.selectionStart, e = input.selectionEnd;
    const text = input.value;
    const blockStart = text.lastIndexOf('\n', s - 1) + 1;
    const raw = text.indexOf('\n', e);
    const blockEnd = raw === -1 ? text.length : raw;
    const prefix = marker.repeat(level);
    const mEsc   = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    function headingLevel(line) {
      if (!line.startsWith(marker)) return 0;
      let n = 1;
      while (n < 3 && line.startsWith(marker.repeat(n + 1))) n++;
      return n;
    }
    function stripHeading(line) {
      return line
        .replace(new RegExp(`^${mEsc}+\\s*`), '')
        .replace(new RegExp(`\\s*${mEsc}+\\s*$`), '')
        .trim();
    }

    const lines = text.slice(blockStart, blockEnd).split('\n');
    const allAtLevel = lines.every(l => headingLevel(l) === level);
    const newLines = lines.map(l => {
      if (allAtLevel) return stripHeading(l);
      const content = headingLevel(l) > 0 ? stripHeading(l) : l.trim();
      return content ? `${prefix} ${content} ${prefix}` : `${prefix}  ${prefix}`;
    });
    const newBlock = newLines.join('\n');
    input.focus();
    input.setSelectionRange(blockStart, blockEnd);
    document.execCommand('insertText', false, newBlock);
    input.setSelectionRange(blockStart, blockStart + newBlock.length);
    onInput();
  }

  // ── Command mode (ESC) ───────────────────────────────────────────────────

  function enterCmdMode() {
    _cmdMode   = true;
    _cmdNavIdx = -1;
    document.getElementById('ed-bar').classList.add('cmd-mode');
    document.getElementById('ed-menu-btn').classList.add('active');
    updateStatusBar();
  }

  function exitCmdMode() {
    _cmdMode   = false;
    _cmdNavIdx = -1;
    document.getElementById('ed-bar').classList.remove('cmd-mode');
    document.getElementById('ed-menu-btn').classList.remove('active');
    updateStatusBar();
  }

  function isCmdMode() { return _cmdMode; }

  function cmdNavMove(delta) {
    if (!_cmdMode) return;
    const n = _CMD_LIST.length;
    _cmdNavIdx = _cmdNavIdx === -1
      ? (delta > 0 ? 0 : n - 1)
      : (_cmdNavIdx + delta + n) % n;
    updateStatusBar();
  }

  function getCmdNavKey() {
    if (_cmdNavIdx < 0 || _cmdNavIdx >= _CMD_LIST.length) return null;
    return _CMD_LIST[_cmdNavIdx][0];
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  let _msgTimeout = null;
  let _msg = '';

  function setMsg(text) {
    _msg = text;
    updateStatusBar();
    if (_msgTimeout) clearTimeout(_msgTimeout);
    _msgTimeout = setTimeout(() => { _msg = ''; updateStatusBar(); }, 2000);
  }

  function updateStatusBar() {
    if (_cmdMode) {
      const bar = document.getElementById('ed-bar-left');
      bar.innerHTML = '';
      _CMD_LIST.forEach(([key, label], i) => {
        const btn = document.createElement('button');
        btn.className = 'cmd-btn' + (i === _cmdNavIdx ? ' active' : '');
        btn.dataset.cmd = key;
        btn.innerHTML = `<b>${key}</b>:${label}`;
        btn.addEventListener('mousedown', e => {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent('writhdeck-cmd', { detail: key }));
        });
        bar.appendChild(btn);
      });
      const exit = document.createElement('span');
      exit.className = 'cmd-exit';
      exit.textContent = '·ESC/Alt+C·';
      bar.appendChild(exit);
      document.getElementById('ed-bar-center').textContent = '';
      document.getElementById('ed-bar-right').textContent  = '';
      return;
    }
    const s = State.settings;
    const doc = State.doc;

    // Lazily compute expensive full-text values — only when a configured status-bar
    // token actually needs them. wordCount() alone scans the whole document, and on
    // a 90K-word file this ran on every keystroke even when "words" wasn't displayed.
    let _wc = null;
    const wc = () => {
      if (_wc === null) _wc = doc ? wordCount(ta().value) : 0;
      return _wc;
    };
    let _today = null;
    const today = () => {
      if (_today === null) {
        if (doc && _sessionBaseline >= 0) {
          const cur = Math.max(0, wc() - _sessionBaseline);
          if (cur > _sessionMaxToday) _sessionMaxToday = cur;
          _today = _sessionMaxToday;
        } else {
          _today = doc ? todayWords(doc.id) : 0;
        }
      }
      return _today;
    };
    const clk = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    function buildZone(spec) {
      return spec.split(/\s+/).map(tok => {
        switch (tok) {
          case 'filename': return doc ? doc.name : '';
          case 'dirty':    return State.dirty ? '[+]' : '';
          case 'words':    return doc ? `${wc()}w` : '';
          case 'chars':    return doc ? `${(ta().value || '').length}c` : '';
          case 'goal':     return s.wordGoal > 0 ? `${today()}/${s.wordGoal}` : '';
          case 'clock':    return clk;
          case 'timer':    return s.timerShow ? Timer.format() : '';
          case 'today':    return doc && today() > 0 ? `${today()}↑` : '';
          case 'percent':  return (doc && s.wordGoal > 0) ? `${Math.min(100, Math.round(wc() / s.wordGoal * 100))}%` : '';
          case 'lines':    return doc ? `${(ta().value.match(/\n/g) || []).length + 1}L` : '';
          case 'line': {
            if (!doc) return '';
            const pos    = ta().selectionStart || 0;
            const before = ta().value.slice(0, pos);
            return `L${(before.match(/\n/g) || []).length + 1}`;
          }
          case 'col': {
            if (!doc) return '';
            const pos    = ta().selectionStart || 0;
            const before = ta().value.slice(0, pos);
            return `C${pos - before.lastIndexOf('\n')}`;
          }
          case 'para': {
            if (!doc) return '';
            const count = ta().value.split(/\n{2,}/).filter(p => p.trim()).length;
            return count ? `${count}§` : '';
          }
          case 'pages':   return (doc && wc() > 0) ? `${Math.ceil(wc() / 250)}p` : '';
          case 'reading': {
            if (!doc || !wc()) return '';
            const mins = Math.ceil(wc() / 200);
            return mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h${mins % 60 ? (mins % 60) + 'm' : ''}`;
          }
          case 'space':    return ' ';
          case 'help_bar': return '';
          default:         return tok;
        }
      }).filter(Boolean).join('  ');
    }

    const l = _msg || buildZone(s.statusLeft   || '');
    const c =        buildZone(s.statusCenter  || '');
    const r =        buildZone(s.statusRight   || '');
    document.getElementById('ed-bar-left').textContent   = l;
    document.getElementById('ed-bar-center').textContent = c;
    document.getElementById('ed-bar-right').textContent  = r;
  }

  function startClock() {
    stopClock();
    _clockId = setInterval(updateStatusBar, 10000);
  }
  function stopClock() {
    if (_clockId) { clearInterval(_clockId); _clockId = null; }
  }

  // ── Autosave ──────────────────────────────────────────────────────────────

  function startAutosave() {
    stopAutosave();
    // Embedders can opt out of autosave (e.g. a server backend that doesn't want
    // a revision written every 60s) by setting window.WRITHDECK_AUTOSAVE = false.
    if (typeof window !== 'undefined' && window.WRITHDECK_AUTOSAVE === false) return;
    _autosaveId = setInterval(() => { if (State.dirty) save(); }, 60000);
  }
  function stopAutosave() {
    if (_autosaveId) { clearInterval(_autosaveId); _autosaveId = null; }
  }

  // ── Find / Replace ────────────────────────────────────────────────────────

  let _searchTerm = '';
  let _matches    = [];
  let _matchIdx   = -1;

  function searchOpen(withReplace = false) {
    const bar   = document.getElementById('search-bar');
    const input = document.getElementById('search-input');
    // Ctrl+F while find bar is open → close
    if (!bar.hidden && !withReplace && document.getElementById('replace-row').hidden) {
      searchClose();
      return;
    }
    bar.hidden = false;
    document.getElementById('replace-row').hidden   = !withReplace;
    document.getElementById('replace-one').hidden   = !withReplace;
    document.getElementById('replace-all').hidden   = !withReplace;
    if (_searchTerm) { input.value = _searchTerm; }
    input.focus();
    input.select();
    searchUpdate();
  }

  function searchClose() {
    document.getElementById('search-bar').hidden = true;
    ta().focus();
    _matches = []; _matchIdx = -1;
    document.getElementById('search-count').textContent = '';
    rehighlight(); // retire les surlignages (barre cachée → searchTerm ignoré)
  }

  function searchUpdate() {
    _searchTerm = document.getElementById('search-input').value;
    _matches = [];
    _matchIdx = -1;
    if (!_searchTerm) {
      document.getElementById('search-count').textContent = '';
      rehighlight();
      return;
    }
    const text = ta().value;
    const lower = text.toLowerCase();
    const term  = _searchTerm.toLowerCase();
    let pos = 0;
    while ((pos = lower.indexOf(term, pos)) !== -1) {
      _matches.push(pos);
      pos += term.length;
    }
    document.getElementById('search-count').textContent = `${_matches.length} match${_matches.length !== 1 ? 'es' : ''}`;
    if (_matches.length) searchNext();
    rehighlight(); // applique les surlignages
  }

  function searchNext() {
    if (!_matches.length) return;
    _matchIdx = (_matchIdx + 1) % _matches.length;
    selectMatch(_matches[_matchIdx]);
  }

  function searchPrev() {
    if (!_matches.length) return;
    _matchIdx = (_matchIdx - 1 + _matches.length) % _matches.length;
    selectMatch(_matches[_matchIdx]);
  }

  function selectMatch(pos) {
    const input   = ta();
    const lineIdx = input.value.slice(0, pos).split('\n').length - 1;
    // Ne pas appeler input.focus() : cela volerait le focus depuis le champ de recherche
    input.setSelectionRange(pos, pos + _searchTerm.length);
    input.scrollTop = Math.max(0, linePixelTop(lineIdx) - input.clientHeight / 3);
    syncScroll();
  }

  function replaceOne() {
    if (!_matches.length || _matchIdx < 0) return;
    const repl  = document.getElementById('replace-input').value;
    const start = _matches[_matchIdx];
    const text  = ta().value;
    ta().value  = text.slice(0, start) + repl + text.slice(start + _searchTerm.length);
    onInput();
    searchUpdate();
  }

  function replaceAll() {
    const repl = document.getElementById('replace-input').value;
    const re   = new RegExp(_searchTerm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    ta().value = ta().value.replace(re, repl);
    onInput();
    searchUpdate();
    setMsg(`Replaced`);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportDoc(fmt) {
    if (!State.doc) return;
    const ext  = fmt === 'md' ? '.md' : '.txt';
    const name = State.doc.name.replace(/\.[^.]+$/, '') + ext;
    const blob = new Blob([State.doc.content || ta().value], {type: 'text/plain'});
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: name
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  return {
    open, close, browser, save, saveAs, onInput, syncScroll, syncGutter, rehighlight, updateStatusBar, setMsg,
    syncCursorLineCache, syncBlockCursor,
    saveCursorPos, applyLineNumbers,
    toggleTypewriter, isTypewriter, typewriterScroll, toggleLineNumbers, gotoLine, gotoLineGo, gotoLineClose,
    applyLineMarker, applyInlineMarker, applyHeading,
    enterCmdMode, exitCmdMode, isCmdMode, cmdNavMove, getCmdNavKey,
    searchOpen, searchClose, searchUpdate, searchNext, searchPrev, replaceOne, replaceAll,
    exportDoc
  };
})();


'use strict';
// Document browser module
const Browser = (() => {

  // FSA detection — use typeof rather than 'in' (more robust in Brave)
  const hasFSA = (() => { try { return typeof window.showOpenFilePicker === 'function'; } catch(_) { return false; } })();

  function render() {
    const list = document.getElementById('br-list');
    list.innerHTML = '';

    const docs   = State.docs;
    const favIds = new Set(State.favorites);
    const recIds = new Set(State.recents);

    const favDocs   = State.favorites.map(id => docs.find(d => d.id === id)).filter(Boolean);
    const diskDocs  = docs.filter(d => d.fromDisk).sort((a, b) => b.modified - a.modified);
    const localDocs = docs.filter(d => !d.fromDisk).sort((a, b) => b.modified - a.modified);

    if (favDocs.length) {
      section('Favorites', favDocs, list, {});
    }

    // writhdeck.ini — always visible
    iniRow(list);

    // Watched folder section
    if (hasFSA && State.dirHandle) {
      folderSection(list);
    }

    // Individual disk files (opened with 📂, not from watched folder)
    if (hasFSA && diskDocs.filter(d => !d.dirFile).length) {
      const indiv = diskDocs.filter(d => !d.dirFile);
      const recentDisk = indiv.filter(d => recIds.has(d.id));
      const olderDisk  = indiv.filter(d => !recIds.has(d.id));
      if (recentDisk.length) section('Recent files', recentDisk, list, { disk: true });
      if (olderDisk.length)  section('Files from disk', olderDisk, list, { disk: true });
    }

    section('Documents', localDocs, list, { showRecent: id => recIds.has(id) });

    buildShortcutBar();
  }

  function section(title, docs, container, opts) {
    const hdr = document.createElement('div');
    hdr.className = 'br-section-header';
    hdr.textContent = title;
    container.appendChild(hdr);
    if (!docs.length) {
      const empty = document.createElement('div');
      empty.className = 'br-item';
      empty.style.color = 'var(--fg-bar)';
      empty.style.fontSize = '0.85em';
      empty.textContent = 'No documents yet. Press n to create one.';
      container.appendChild(empty);
      return;
    }
    docs.forEach(doc => container.appendChild(docRow(doc, opts || {})));
  }

  function docRow(doc, opts) {
    const row = document.createElement('div');
    row.className = 'br-item br-nav-item';
    row.tabIndex = -1;
    row.dataset.id = String(doc.id);
    if (State.doc && State.doc.id === doc.id) row.classList.add('selected');

    // No pin for folder files (they are ephemeral, not in IDB)
    const pin = document.createElement('span');
    if (!opts.dirFile) {
      pin.className = 'br-item-pin' + (isFavorite(doc.id) ? ' active' : '');
      pin.textContent = '★';
      pin.title = isFavorite(doc.id) ? 'Unpin' : 'Pin to favorites';
      pin.addEventListener('click', e => {
        e.stopPropagation();
        toggleFavorite(doc.id);
        render();
      });
    } else {
      pin.style.cssText = 'width:1em;'; // spacer
    }

    const name = document.createElement('span');
    name.className = 'br-item-name';
    name.textContent = doc.name;

    const meta = document.createElement('span');
    meta.className = 'br-item-meta';
    meta.textContent = fmtDate(doc.modified);

    row.appendChild(pin);
    row.appendChild(name);
    row.appendChild(meta);

    // Disk file indicator
    if (opts.disk || doc.fromDisk) {
      const ico = document.createElement('span');
      ico.textContent = '💾';
      ico.title = 'Linked to a file on disk';
      ico.style.cssText = 'font-size:0.75em;flex-shrink:0;opacity:0.7;';
      row.appendChild(ico);
    }
    // Subtle dot for recently opened storage docs
    if (opts.showRecent && opts.showRecent(doc.id)) {
      const dot = document.createElement('span');
      dot.title = 'Recently opened';
      dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:var(--heading);flex-shrink:0;';
      row.appendChild(dot);
    }

    row.addEventListener('click', () => Editor.open(doc));
    row.addEventListener('contextmenu', e => { e.preventDefault(); showContextMenu(doc, e); });
    return row;
  }

  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    }
    return d.toLocaleDateString([], {month:'short', day:'numeric'});
  }

  // ── Context menu ─────────────────────────────────────────────────────────

  let _ctxMenu = null;

  function showIniContextMenu(e, openIni) {
    hideContextMenu();
    const menu = document.createElement('div');
    menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;
      background:var(--bg-bar);border:1px solid var(--fg-bar);z-index:200;min-width:160px;`;
    const items = [
      ['Open', openIni],
      ['Export writhdeck.ini', () => Settings.exportIni()],
      ['Reset to defaults', async () => {
        if (!confirm('Reset all settings to defaults?')) return;
        await DB.setMeta('iniText', null);
        location.reload();
      }]
    ];
    items.forEach(([label, fn]) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 14px;border:none;background:none;';
      btn.style.color = label === 'Reset to defaults' ? 'var(--heading)' : 'var(--fg)';
      btn.addEventListener('click', () => { hideContextMenu(); fn(); });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    _ctxMenu = menu;
  }

  function showContextMenu(doc, e) {
    hideContextMenu();
    const menu = document.createElement('div');
    menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;
      background:var(--bg-bar);border:1px solid var(--fg-bar);z-index:200;min-width:140px;`;
    const items = [
      ['Open',          () => Editor.open(doc)],
      ['Info',          () => document.dispatchEvent(new CustomEvent('writhdeck-show-info',    { detail: doc }))],
      ['Analyse',       () => document.dispatchEvent(new CustomEvent('writhdeck-show-analyse', { detail: doc }))],
      ['Rename',        () => renameDoc(doc)],
      ['Export as .txt',() => exportDocFrom(doc, 'txt')],
      ['Export as .md', () => exportDocFrom(doc, 'md')],
      ['Stats',         () => { Stats.show(); }],
      ['Delete',        () => deleteDoc(doc)]
    ];
    items.forEach(([label, fn]) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 14px;border:none;background:none;';
      btn.style.color = 'var(--fg)';
      btn.addEventListener('click', () => { hideContextMenu(); fn(); });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    _ctxMenu = menu;
  }

  function hideContextMenu() {
    if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
  }

  // ── Document actions ─────────────────────────────────────────────────────

  function nameExists(name, excludeId) {
    return State.docs.some(d => d.name === name && d.id !== excludeId);
  }

  function uniqueName(base) {
    if (!nameExists(base)) return base;
    let n = 2;
    while (nameExists(`${base} (${n})`)) n++;
    return `${base} (${n})`;
  }

  async function newDoc() {
    const inFolder = hasFSA && !!State.dirHandle;
    const name = prompt('Document name:', uniqueName('Untitled'));
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const safeName = trimmed.lastIndexOf('.') > 0 ? trimmed : `${trimmed}.txt`;

    if (inFolder) {
      if (State.dirFiles.some(f => f.name === safeName)) {
        alert(`A file named "${safeName}" already exists in this folder.`);
        return;
      }
      let fileHandle;
      try {
        fileHandle = await currentDir().getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.close();
      } catch (e) {
        alert(`Could not create "${safeName}": ${e.message}`);
        return;
      }
      const doc = {
        id: `dir:${dirRelPath()}${safeName}`, name: safeName, content: '',
        fileHandle, fromDisk: true, dirFile: true, modified: Date.now()
      };
      State.dirFiles.push(doc);
      State.dirFiles.sort((a, b) => a.name.localeCompare(b.name));
      render();
      await Editor.open(doc);
    } else {
      if (nameExists(safeName)) {
        alert(`A document named "${safeName}" already exists.`);
        return;
      }
      const doc = { name: safeName, content: '', created: Date.now(), modified: Date.now() };
      await DB.saveDoc(doc);
      State.docs.push(doc);
      render();
      await Editor.open(doc);
    }
  }

  async function renameDoc(doc) {
    const name = prompt('Rename to:', doc.name);
    if (!name || !name.trim() || name.trim() === doc.name) return;
    const trimmed = name.trim();
    if (nameExists(trimmed, doc.id)) {
      alert(`A document named "${trimmed}" already exists.`);
      return;
    }
    doc.name = trimmed;
    await DB.saveDoc(doc);
    if (State.doc && State.doc.id === doc.id) {
      document.getElementById('ed-filename').textContent = doc.name;
    }
    render();
  }

  async function deleteDoc(doc) {
    const msg = doc.fromDisk
      ? `Remove "${doc.name}" from Writhdeck?\n\nThe original file on your disk will NOT be deleted — only the copy stored in the browser is removed.`
      : `Delete "${doc.name}" from browser storage?\n\nThis cannot be undone. The document is stored only in this browser — it is NOT on your disk.`;
    if (!confirm(msg)) return;
    await DB.deleteDoc(doc.id);
    State.docs      = State.docs.filter(d => d.id !== doc.id);
    State.favorites = State.favorites.filter(id => id !== doc.id);
    State.recents   = State.recents.filter(id => id !== doc.id);
    saveFavorites(); saveRecents();
    if (State.doc && State.doc.id === doc.id) await Editor.close();
    render();
  }

  // Returns the document corresponding to the currently keyboard-focused
  // browser row (`.br-focused`), or null if none / the row isn't a regular
  // stored document (e.g. writhdeck.ini, watched-folder files).
  function getFocusedDoc() {
    const row = document.querySelector('#br-list .br-nav-item.br-focused');
    if (!row || !row.dataset.id || row.dataset.id === '__ini__') return null;
    return State.docs.find(d => String(d.id) === row.dataset.id) || null;
  }

  // Saves a timestamped copy of `doc` as a new document (mirrors Tcl's
  // do-backup, which copies the file into DOCS_DIR/backups/ with a
  // "%Y-%m-%dT%Hh%Mm%S" timestamp).
  async function backupDoc(doc) {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}h${pad(d.getMinutes())}m${pad(d.getSeconds())}`;
    const name = uniqueName(`${doc.name} (backup ${stamp})`);
    const copy = { name, content: doc.content || '', created: Date.now(), modified: Date.now() };
    await DB.saveDoc(copy);
    State.docs.push(copy);
    render();
  }

  function exportDocFrom(doc, fmt) {
    const ext  = fmt === 'md' ? '.md' : '.txt';
    const name = doc.name.replace(/\.[^.]+$/, '') + ext;
    const blob = new Blob([doc.content || ''], {type:'text/plain'});
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: name
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── Shortcut bar ──────────────────────────────────────────────────────────

  // Wraps an action so it only fires when a browser row is keyboard-focused
  // (used for shortcuts that act on the focused document: r/d/b/f/i).
  function withFocused(fn) {
    return () => {
      const doc = getFocusedDoc();
      if (doc) fn(doc);
    };
  }

  function buildShortcutBar() {
    const bar = document.getElementById('br-bar');
    bar.innerHTML = '';
    const shortcuts = [
      ['n', 'new', newDoc],
      ...(hasFSA ? [
        ['w', 'watch folder', openFolder],
        ['o', 'open file',   openFromDisk]
      ] : []),
      ['Ctrl+O', 'import copy', () => document.getElementById('file-import-input').click()],
      ['s', 'stats', () => Stats.show()],
      ['c', 'config', () => Settings.show()],
      ['r', 'rename',   withFocused(renameDoc)],
      ['d', 'delete',   withFocused(deleteDoc)],
      ['b', 'backup',   withFocused(backupDoc)],
      ['f', 'favorite', withFocused(doc => { toggleFavorite(doc.id); render(); })],
      ['i', 'info',     withFocused(doc => document.dispatchEvent(new CustomEvent('writhdeck-show-info', { detail: doc })))],
      ['h', 'help', () => {
        const d = document.getElementById('br-help-details');
        d.open = !d.open;
      }],
      ['z', 'reload', () => location.reload()]
    ];
    shortcuts.forEach(([key, label, fn]) => {
      const sp = document.createElement('span');
      sp.className = 'br-shortcut';
      sp.innerHTML = `<span class="br-shortcut-key">${key}</span>:${label}`;
      sp.addEventListener('click', fn);
      bar.appendChild(sp);
    });
  }

  function iniRow(container) {
    const row = document.createElement('div');
    row.className = 'br-item br-nav-item';
    row.tabIndex = -1;
    row.dataset.id = '__ini__';
    if (State.doc && State.doc.isIni) row.classList.add('selected');

    const ico = document.createElement('span');
    ico.style.cssText = 'font-size:0.8em;color:var(--fg-bar);flex-shrink:0;width:1em;';
    ico.textContent = '⚙';

    const name = document.createElement('span');
    name.className = 'br-item-name';
    name.textContent = 'writhdeck.ini';
    name.style.color = 'var(--fg-bar)';

    row.appendChild(ico);
    row.appendChild(name);
    const openIni = () => Editor.open({
      id: '__ini__', name: 'writhdeck.ini',
      content: State.iniText || '', isIni: true, virtual: true
    });
    row.addEventListener('click', openIni);
    row.addEventListener('contextmenu', e => { e.preventDefault(); showIniContextMenu(e, openIni); });
    container.appendChild(row);
  }

  async function openFolder() {
    if (typeof window.showDirectoryPicker !== 'function') {
      alert('Directory access requires Chrome, Edge or Brave.\nIf using Brave, check Shields settings.');
      return;
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return;
    }
    State.dirHandle = handle;
    State.dirStack  = [];   // reset subfolder navigation to the new root
    await saveDirHandle();
    await scanDir();
    render();
  }

  async function clearFolder() {
    if (!confirm(`Remove folder "${State.dirHandle.name}" from Writhdeck?\n\nFiles on disk are not affected.`)) return;
    await clearDirHandle();
    render();
  }

  async function requestFolderPermission() {
    if (!State.dirHandle) return;
    try {
      const perm = await State.dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await scanDir();
        render();
      }
    } catch (_) {}
  }

  // A navigable folder row (subdirectory or "..") inside the watched folder.
  function dirNavRow(label, title, onActivate) {
    const row = document.createElement('div');
    row.className = 'br-item br-nav-item';
    row.tabIndex = -1;
    row.dataset.id = '__dir__';

    const ico = document.createElement('span');
    ico.style.cssText = 'flex-shrink:0;width:1em;';
    ico.textContent = '📁';

    const name = document.createElement('span');
    name.className = 'br-item-name';
    name.textContent = label;
    if (title) name.title = title;

    row.appendChild(ico);
    row.appendChild(name);
    row.addEventListener('click', onActivate);
    return row;
  }

  function folderSection(container) {
    const dirFiles = State.dirFiles;
    const subdirs  = State.settings.browserSubdirs ? State.dirSubdirs : [];
    // Breadcrumb: root name + any navigated subfolders.
    const crumb = State.dirStack.length
      ? State.dirStack.map(s => s.name).join(' / ')
      : State.dirHandle.name;

    // Header row with folder name + clear button
    const hdr = document.createElement('div');
    hdr.className = 'br-section-header';
    hdr.style.display = 'flex';
    hdr.style.alignItems = 'center';
    hdr.style.justifyContent = 'space-between';

    const label = document.createElement('span');
    label.textContent = `📁 ${crumb}`;
    hdr.appendChild(label);

    const clearBtn = document.createElement('span');
    clearBtn.textContent = '✕';
    clearBtn.title = 'Remove folder';
    clearBtn.style.cssText = 'cursor:pointer;color:var(--fg-bar);font-size:0.8em;padding:0 4px;';
    clearBtn.addEventListener('click', e => { e.stopPropagation(); clearFolder(); });
    hdr.appendChild(clearBtn);
    container.appendChild(hdr);

    // ".." row (only when navigated into a subfolder)
    if (State.settings.browserSubdirs && State.dirStack.length > 1) {
      container.appendChild(dirNavRow('..', 'Go up one folder',
        async () => { await dirUp(); render(); }));
    }
    // Subfolder rows
    subdirs.forEach(sub => {
      container.appendChild(dirNavRow(`${sub.name}/`, null,
        async () => { await dirEnter(sub.name); render(); }));
    });

    if (!dirFiles.length) {
      // Check permission state
      State.dirHandle.queryPermission({ mode: 'readwrite' }).then(perm => {
        if (perm !== 'granted') {
          const row = document.createElement('div');
          row.className = 'br-item';
          const btn = document.createElement('button');
          btn.textContent = 'Re-authorize folder access';
          btn.style.cssText = 'font-size:0.85em;margin:4px 0;';
          btn.addEventListener('click', requestFolderPermission);
          row.appendChild(btn);
          container.appendChild(row);
        } else {
          const row = document.createElement('div');
          row.className = 'br-item';
          row.style.color = 'var(--fg-bar)';
          row.style.fontSize = '0.85em';
          row.textContent = 'No .txt / .md / .tcl files in this folder.';
          container.appendChild(row);
        }
      });
      return;
    }

    dirFiles.forEach(doc => {
      const row = docRow(doc, { dirFile: true });
      container.appendChild(row);
    });
  }

  async function openFromDisk() {
    if (typeof window.showOpenFilePicker !== 'function') {
      alert('Direct file access is not available in this browser.\n\nUse the ↑ Import button to load a copy of a file, or switch to Chrome/Edge/Brave.\n\nIf you are using Brave, check that Shields fingerprinting protection is not set to "Strict".');
      return;
    }
    let handles;
    try {
      handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: 'Text files', accept: { 'text/plain': ['.txt', '.md', '.tcl', '.text'] } }]
      });
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
      return;
    }
    for (const fileHandle of handles) {
      const file    = await fileHandle.getFile();
      const content = await file.text();
      // Check if already tracked (same name + fromDisk)
      const existing = State.docs.find(d => d.fromDisk && d.name === file.name);
      if (existing) {
        // Update handle and content
        existing.fileHandle = fileHandle;
        existing.content    = content;
        existing.modified   = Date.now();
        await DB.saveDoc(existing);
        await Editor.open(existing);
      } else {
        const doc = { name: file.name, content, fromDisk: true, fileHandle, created: Date.now(), modified: Date.now() };
        await DB.saveDoc(doc);
        State.docs.push(doc);
        await Editor.open(doc);
      }
    }
    render();
  }

  return { render, newDoc, renameDoc, deleteDoc, openFromDisk, openFolder, hideContextMenu, hasFSA, nameExists, uniqueName, getFocusedDoc, backupDoc };
})();


'use strict';
const Settings = (() => {

  const COLOR_KEYS = [
    ['bg',         'Background (dark)'],
    ['fg',         'Text (dark)'],
    ['bgBar',      'Bar BG (dark)'],
    ['fgBar',      'Bar text (dark)'],
    ['bgSel',      'Selection (dark)'],
    ['heading',    'Heading (dark)'],
    ['comment',    'Comment (dark)'],
    ['markup',     'Markup (dark)'],
    ['bgAlt',      'Background (light)'],
    ['fgAlt',      'Text (light)'],
    ['bgBarAlt',   'Bar BG (light)'],
    ['fgBarAlt',   'Bar text (light)'],
    ['bgSelAlt',   'Selection (light)'],
    ['headingAlt', 'Heading (light)'],
    ['commentAlt', 'Comment (light)'],
    ['markupAlt',  'Markup (light)']
  ];

  // ── Public ────────────────────────────────────────────────────────────────

  function show(tab) {
    populate();
    if (tab) switchTab(tab);
    document.getElementById('settings-dlg').showModal();
  }

  // ── Populate ──────────────────────────────────────────────────────────────

  function populate() {
    const s = State.settings;

    // Profile selector
    const profSel = document.getElementById('profile-select');
    if (profSel) {
      profSel.innerHTML = '';
      State.profileNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = name;
        if (name === State.activeProfile) opt.selected = true;
        profSel.appendChild(opt);
      });
    }

    // Fill all data-key inputs (Profile, Timer, Misc, Display tabs)
    document.querySelectorAll('#settings-dlg [data-key]').forEach(el => {
      const key = el.dataset.key;
      if (!(key in s)) return;
      if (el.type === 'checkbox') el.checked = !!s[key];
      else el.value = s[key];
    });

    // Scheme selectors (profile + schemes tab)
    ['scheme-select-profile', 'scheme-select'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      getAllSchemeNames().forEach(name => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = name;
        if (name === s.scheme) opt.selected = true;
        sel.appendChild(opt);
      });
    });

    buildColorGrid(s.scheme);
    populateFontList(s.fontFamily);
    updateFontPreview(s.fontFamily, s.fontSize);
  }

  function populateFontList(current) {
    const list = document.getElementById('font-list');
    list.innerHTML = '';
    // Detect available fonts via canvas
    const available = detectFonts([
      'monospace', 'serif', 'sans-serif',
      'Courier New', 'Consolas', 'Fira Code', 'JetBrains Mono', 'Source Code Pro',
      'Liberation Mono', 'DejaVu Sans Mono', 'Ubuntu Mono', 'Inconsolata',
      'Noto Mono', 'Hack', 'Cascadia Code', 'Menlo', 'Monaco',
      'Georgia', 'Palatino', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana',
      'Noto Serif', 'Noto Sans', 'Tahoma', 'Trebuchet MS'
    ]);
    available.forEach(font => {
      const div = document.createElement('div');
      div.className = 'font-item' + (font === current ? ' selected' : '');
      div.textContent = font;
      div.style.fontFamily = font;
      div.addEventListener('click', () => {
        document.querySelectorAll('.font-item').forEach(d => d.classList.remove('selected'));
        div.classList.add('selected');
        document.getElementById('font-family-input').value = font;
        updateFontPreview(font);
      });
      list.appendChild(div);
    });
  }

  function detectFonts(candidates) {
    const cvs = document.createElement('canvas');
    cvs.width = 200; cvs.height = 50;
    const ctx = cvs.getContext('2d');
    const base = 'monospace';
    const text = 'abcdefghijklm0123456789';
    ctx.font = `14px ${base}`;
    const refW = ctx.measureText(text).width;
    return candidates.filter(f => {
      ctx.font = `14px "${f}", ${base}`;
      return f === 'monospace' || f === 'serif' || f === 'sans-serif'
        || ctx.measureText(text).width !== refW;
    });
  }

  function updateFontPreview(family, size) {
    const preview = document.getElementById('font-preview');
    if (!preview) return;
    const f = family || document.getElementById('font-family-input').value || 'monospace';
    const sz = size || Number(document.querySelector('[data-key="fontSize"]').value) || 14;
    preview.style.fontFamily = f;
    preview.style.fontSize = sz + 'px';
  }

  function buildColorGrid(schemeName) {
    const scheme = getScheme(schemeName);
    const grid = document.getElementById('scheme-colors');
    grid.innerHTML = '';
    COLOR_KEYS.forEach(([key, label]) => {
      const lbl = document.createElement('label');
      lbl.textContent = label;
      lbl.style.fontSize = '0.85em';
      const inp = document.createElement('input');
      inp.type = 'color';
      inp.dataset.colorKey = key;
      inp.value = (scheme[key] || '#888888').slice(0, 7); // color input needs 6-digit hex
      grid.appendChild(lbl);
      grid.appendChild(inp);
    });
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  function apply() {
    const s = State.settings;

    // Read all data-key inputs
    document.querySelectorAll('#settings-dlg [data-key]').forEach(el => {
      const key = el.dataset.key;
      if (el.type === 'checkbox')    s[key] = el.checked;
      else if (el.type === 'number') s[key] = Number(el.value);
      else                           s[key] = el.value;
    });

    // If the active scheme tab selector differs from profile tab selector, prefer schemes tab
    const schemesSel = document.getElementById('scheme-select');
    if (schemesSel) s.scheme = schemesSel.value;

    // Persist color edits for custom schemes
    const schemeName = s.scheme;
    if (!SCHEMES[schemeName]) {
      const scheme = { ...getScheme(schemeName) };
      document.querySelectorAll('#scheme-colors input[data-color-key]').forEach(inp => {
        scheme[inp.dataset.colorKey] = inp.value;
      });
      customSchemes[schemeName] = scheme;
      saveCustomSchemes();
    }

    // Persist the 12 profile-scoped settings into the active profile
    if (!State.profiles[State.activeProfile]) State.profiles[State.activeProfile] = {};
    for (const k of INI.PROFILE_JS_KEYS) State.profiles[State.activeProfile][k] = s[k];

    saveSettings();
    refreshAfterSettingsChange();
  }

  function refreshAfterSettingsChange() {
    applyTheme();
    if (State.doc) {
      Editor.rehighlight();
      Editor.applyLineNumbers();
      Editor.updateStatusBar();
    }
  }

  // ── Profile actions ───────────────────────────────────────────────────────

  function switchProfile(name) {
    if (name === State.activeProfile) return;
    apply(); // commit current edits into the active profile + persist

    State.activeProfile = name;
    Object.assign(State.settings, State.profiles[name] || {});
    saveSettings();
    populate();
    refreshAfterSettingsChange();
  }

  function newProfile() {
    const name = prompt('New profile name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (/[[\]]/.test(trimmed)) { alert('Profile names cannot contain [ or ].'); return; }
    if (State.profiles[trimmed]) { alert('A profile with this name already exists.'); return; }
    apply(); // commit current edits first

    State.profiles[trimmed] = Object.fromEntries(INI.PROFILE_JS_KEYS.map(k => [k, State.settings[k]]));
    State.profileNames.push(trimmed);
    State.activeProfile = trimmed;
    saveSettings();
    populate();
    refreshAfterSettingsChange();
  }

  function deleteProfile() {
    if (State.profileNames.length <= 1) { alert('Cannot delete the only profile.'); return; }
    const name = State.activeProfile;
    if (!confirm(`Delete profile "${name}"?`)) return;
    delete State.profiles[name];
    State.profileNames = Object.keys(State.profiles);
    State.activeProfile = State.profileNames[0];
    Object.assign(State.settings, State.profiles[State.activeProfile] || {});
    saveSettings();
    populate();
    refreshAfterSettingsChange();
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  function switchTab(name) {
    document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.stab-content').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.stab[data-tab="${name}"]`);
    const pane = document.querySelector(`.stab-content[data-tab="${name}"]`);
    if (btn) btn.classList.add('active');
    if (pane) pane.classList.add('active');
  }

  // ── Scheme actions ────────────────────────────────────────────────────────

  function newScheme() {
    const name = prompt('New scheme name:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (/[[\]]/.test(trimmed)) { alert('Scheme names cannot contain [ or ].'); return; }
    if (getAllSchemeNames().includes(trimmed)) { alert('Name already exists.'); return; }
    customSchemes[trimmed] = { ...getScheme(State.settings.scheme) };
    saveCustomSchemes();
    State.settings.scheme = trimmed;
    saveSettings();
    populate();
    applyTheme();
  }

  function deleteScheme() {
    const name = document.getElementById('scheme-select').value;
    if (SCHEMES[name]) { alert('Cannot delete a built-in scheme.'); return; }
    if (!confirm(`Delete scheme "${name}"?`)) return;
    delete customSchemes[name];
    saveCustomSchemes();
    State.settings.scheme = 'default';
    saveSettings();
    populate();
    applyTheme();
  }

  // ── INI import / export ───────────────────────────────────────────────────

  async function importIni(text) {
    const { settings, schemes, profiles, activeProfile } = INI.parseIni(text);
    Object.assign(State.settings, settings);
    for (const [n, sc] of Object.entries(schemes)) {
      customSchemes[n] = SCHEMES[n] ? { ...SCHEMES[n], ...sc } : sc;
    }
    applyParsedProfiles(profiles, activeProfile);
    await saveSettings();   // re-generates INI text + stores in IDB
    applyTheme();
    populate();
    if (State.doc) { Editor.rehighlight(); Editor.updateStatusBar(); }
    alert(`Settings imported.\nSchemes found: ${Object.keys(schemes).join(', ') || 'none'}`);
  }

  function exportIni() {
    // State.iniText is always kept in sync with IDB — no need to regenerate
    const text = State.iniText || INI.writeIni(State.settings, { ...SCHEMES, ...customSchemes }, State.profiles, State.activeProfile);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'writhdeck.ini'
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // ── Export all ────────────────────────────────────────────────────────────

  function exportAll() {
    State.docs.forEach(doc => {
      if (!doc.content) return;
      const blob = new Blob([doc.content], { type: 'text/plain' });
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: doc.name.replace(/\.[^.]+$/, '') + '.txt'
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  }

  function exportZip() {
    const files = State.docs
      .filter(d => d.content)
      .map(d => ({ name: d.name.replace(/\.[^.]+$/, '') + '.txt', content: d.content }));
    if (!files.length) { alert('No documents to export.'); return; }
    const blob = new Blob([buildZip(files)], { type: 'application/zip' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: 'writhdeck-export.zip'
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  // Minimal uncompressed ZIP builder (no external dependency)
  function buildZip(files) {
    const enc = new TextEncoder();

    function u16(n) { return [(n) & 0xff, (n >> 8) & 0xff]; }
    function u32(n) { return [(n) & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }

    function crc32(data) {
      if (!crc32._t) {
        crc32._t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
          crc32._t[i] = c;
        }
      }
      let crc = 0xffffffff;
      for (const b of data) crc = (crc32._t[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
      return (crc ^ 0xffffffff) >>> 0;
    }

    function concat(...arrays) {
      const len = arrays.reduce((s, a) => s + a.length, 0);
      const out = new Uint8Array(len);
      let off = 0;
      for (const a of arrays) { out.set(a, off); off += a.length; }
      return out;
    }

    const DOS_TIME = new Uint8Array([0, 0, 0, 0]); // midnight Jan 1 1980

    const locals = [];    // local file records
    const centralDir = [];
    let offset = 0;

    for (const file of files) {
      const name = enc.encode(file.name);
      const data = enc.encode(file.content);
      const crc  = crc32(data);
      const sz   = data.length;

      const local = concat(
        new Uint8Array([0x50,0x4b,0x03,0x04, 20,0, 0,0, 0,0]),
        DOS_TIME,
        new Uint8Array(u32(crc)),
        new Uint8Array(u32(sz)),
        new Uint8Array(u32(sz)),
        new Uint8Array(u16(name.length)),
        new Uint8Array([0,0]),
        name,
        data
      );

      const cd = concat(
        new Uint8Array([0x50,0x4b,0x01,0x02, 20,0, 20,0, 0,0, 0,0]),
        DOS_TIME,
        new Uint8Array(u32(crc)),
        new Uint8Array(u32(sz)),
        new Uint8Array(u32(sz)),
        new Uint8Array(u16(name.length)),
        new Uint8Array([0,0, 0,0, 0,0, 0,0, 0,0,0,0]),
        new Uint8Array(u32(offset)),
        name
      );

      locals.push(local);
      centralDir.push(cd);
      offset += local.length;
    }

    const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
    const eocd = concat(
      new Uint8Array([0x50,0x4b,0x05,0x06, 0,0, 0,0]),
      new Uint8Array(u16(files.length)),
      new Uint8Array(u16(files.length)),
      new Uint8Array(u32(cdSize)),
      new Uint8Array(u32(offset)),
      new Uint8Array([0,0])
    );

    return concat(...locals, ...centralDir, eocd);
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  function initEvents() {
    // Tab buttons
    document.querySelectorAll('.stab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Profile selector
    document.getElementById('profile-select').addEventListener('change', e => {
      switchProfile(e.target.value);
    });
    document.getElementById('profile-new-btn').addEventListener('click', newProfile);
    document.getElementById('profile-delete-btn').addEventListener('click', deleteProfile);

    // Scheme selector in Schemes tab → rebuild color grid
    document.getElementById('scheme-select').addEventListener('change', e => {
      buildColorGrid(e.target.value);
    });

    // Scheme selector in Profile tab → sync to Schemes tab selector
    document.getElementById('scheme-select-profile').addEventListener('change', e => {
      document.getElementById('scheme-select').value = e.target.value;
      buildColorGrid(e.target.value);
    });

    // Font size change → update preview
    document.querySelector('[data-key="fontSize"]').addEventListener('input', () => {
      updateFontPreview();
    });
    document.getElementById('font-family-input').addEventListener('input', () => {
      updateFontPreview();
    });

    // Some settings appear on more than one tab (e.g. darkMode on Display and
    // Schemes). Keep checkboxes that share a data-key in sync, otherwise apply()
    // — which reads every [data-key] in DOM order — would let a stale duplicate
    // overwrite the value the user just changed.
    document.querySelectorAll('#settings-dlg input[type=checkbox][data-key]').forEach(el => {
      el.addEventListener('change', () => {
        document.querySelectorAll('#settings-dlg input[type=checkbox][data-key="' + el.dataset.key + '"]')
          .forEach(other => { if (other !== el) other.checked = el.checked; });
      });
    });

    document.getElementById('settings-apply').addEventListener('click', apply);
    document.getElementById('settings-close').addEventListener('click', () => {
      document.getElementById('settings-dlg').close();
    });
    document.getElementById('settings-reset').addEventListener('click', async () => {
      if (!confirm('Reset all settings to defaults? This cannot be undone.')) return;
      await DB.setMeta('iniText', null);
      location.reload();
    });
    document.getElementById('scheme-new-btn').addEventListener('click', newScheme);
    document.getElementById('scheme-delete-btn').addEventListener('click', deleteScheme);
    document.getElementById('misc-export-all-btn').addEventListener('click', exportAll);
    document.getElementById('misc-export-zip-btn').addEventListener('click', exportZip);
    document.getElementById('misc-ini-export-btn').addEventListener('click', exportIni);
    document.getElementById('misc-ini-import-btn').addEventListener('click', () => {
      document.getElementById('ini-import-input').click();
    });
    document.getElementById('ini-import-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      await importIni(await file.text());
      e.target.value = '';
    });
    // misc-import-btn wired in app.js (shares logic with br-import-btn)
  }

  return { show, initEvents, switchTab, exportIni };
})();


'use strict';
// Main entry point

const README_CONTENT = "# Writhdeck\n\nA distraction-free writing app that runs as a single self-contained HTML file \u2014 no server, no install, no internet required. Open `writhdeck.html` directly in any modern browser.\n\n\n- [Try it online!](https://luginf.github.io/writhdeck/)\n- [Main project](https://github.com/luginf/writhdeck/)\n\n\n## Features\n\n- **Single-file**: the entire app is one `writhdeck.html` (~180 KB). Copy it anywhere, it just works.\n- **Document browser**: create, rename, delete, and favourite documents stored in IndexedDB. Document names are unique \u2014 duplicates are auto-suggested as `\"Untitled (2)\"` etc.\n- **Disk file support** (Chrome/Edge/Brave): open individual files or watch a folder \u2014 edits go straight back to disk via the File System Access API.\n- **Syntax highlighting overlay**: headings, comments, and inline markers (bold, italic, underline, strikethrough) are coloured in real time without leaving the textarea.\n- **Configurable markers**: choose your own syntax for headings, comments, and each inline style. Enable Markdown-style `#` headings if you prefer.\n- **8 built-in colour schemes** (default, solarized, gruvbox, everforest, nord, + 3 more), dark and light variants, and full custom-scheme support.\n- **Writing timer**: countdown or stopwatch, with optional sound and alert at the end.\n- **Table of contents**: auto-generated from heading lines, shown in a side panel.\n- **Daily writing stats**: tracks words *added* today (not total document size) with a high-water mark across sessions. Optional daily goal.\n- **Hemingway mode**: disables backspace/delete to keep you writing forward.\n- **Typewriter mode**: keeps the cursor vertically centred; dims text outside the current paragraph so only the active paragraph appears at full colour.\n- **Find & replace** with live match highlighting, goto line, line numbers.\n- **Structure analysis**: section-by-section word-count breakdown with progress bars. Accessible from the `\u2261` menu (`a`).\n- **Word occurrences**: frequency table of all words, sorted by count. Accessible from the Analyse dialog or the `\u2261` menu.\n- **Block cursor**: optional solid rectangle cursor, rendered in the highlight overlay. Supports blink on/off.\n- **Export** as `.txt` or `.md`.\n- **INI config**: `writhdeck.ini` is always visible in the browser. Right-click it to open, export, or reset to defaults. The format is compatible with the Tcl/Tk desktop version; web-specific options are in a dedicated `[web]` section.\n- **Status bar**: fully customisable left/centre/right slots with tokens \u2014 see [Status bar tokens](#status-bar-tokens).\n- **`\u2261` menu**: all commands accessible from a single dropdown \u2014 keyboard-navigable (\u2191\u2193 + Enter, or press the hint letter directly), with format options (H1\u2013H3, bold, italic\u2026), search, export, settings, and more. Opening the menu preserves any active text selection.\n- **Right-click context menu**: format, cut/copy/paste, and spell-check toggle (editor); Open / Info / Rename / Export / Delete (browser document list); Open / Export / Reset (writhdeck.ini).\n- **Command mode** (`Esc` or `Alt+C`): interactive status bar showing all commands as clickable buttons. Navigate with `\u2190`/`\u2192`, confirm with `Enter`, or click with the mouse.\n- **About dialog**: accessible from the `?` menu in the browser \u2014 shows the app description and build date.\n- **Undo support**: bold, italic, heading, and comment formatting operations integrate with the browser's native undo stack (via `execCommand('insertText')`).\n\n## Build\n\n```sh\nmake        # produces writhdeck.html (~180 KB)\nmake clean  # removes writhdeck.html\n```\n\n`build.py` reads `src/template.html`, inlines `src/style.css` and all JS modules (in the order defined in `JS_ORDER`), and writes the result to stdout. The build date is embedded as `{{BUILD_DATE}}` (ISO format). Python 3, no dependencies.\n\n## Keyboard shortcuts\n\n### Global\n\n| Shortcut | Action |\n|---|---|\n| `Ctrl+D` | Toggle dark / light mode |\n| `Ctrl+O` | Import file copy |\n| `F11` | Toggle table of contents |\n| `Alt+Enter` | Toggle fullscreen |\n| `Ctrl+N` *(opt)* | New document (overrides browser \"new window\", requires setting) |\n\n### Editor\n\n| Shortcut | Action |\n|---|---|\n| `Ctrl+S` | Save |\n| `Ctrl+Q` | Close document (`Ctrl+Shift+Q` on Firefox, see [Browser notes](#browser-notes)) |\n| `Ctrl+F` | Find (live match highlighting) |\n| `Ctrl+H` | Find & replace |\n| `Ctrl+G` | Go to line |\n| `Ctrl+L` | Toggle line numbers |\n| `Alt+T` | Toggle timer |\n| `Alt+C` / `Esc` | Enter command mode |\n| `Alt+M` | Open `\u2261` menu |\n\n### Command mode (`Alt+C` or `Esc`)\n\nThe status bar becomes an interactive row of command buttons. Works in fullscreen (`Alt+C`).\n\n| Input | Action |\n|---|---|\n| `\u2190` / `\u2192` | Move selection between commands |\n| `Enter` | Execute selected command |\n| *letter* | Execute command directly (e.g. `f` = Find) |\n| Mouse click | Execute command directly |\n\n| Key | Action | Key | Action |\n|---|---|---|---|\n| `f` | Find | `d` | Dark / light |\n| `r` | Find & replace | `o` | Table of contents |\n| `g` | Go to line | `c` | Settings |\n| `n` | Line numbers | `e` | Export as .txt |\n| `w` | Typewriter mode | `s` | Statistics |\n| `t` | Timer | `a` | Analyse structure |\n| `p` | Timer pause | `i` | File info |\n| `q` | Close document | `m` | Main menu (\u2261) |\n\n### Browser (document list)\n\n| Key | Action |\n|---|---|\n| `\u2191` / `\u2193` | Navigate document list |\n| `Enter` | Open selected document |\n| `n` | New document |\n| `o` | Open file from disk |\n| `w` | Watch a folder |\n| `s` | Stats |\n| `c` | Settings |\n\n## Browser notes\n\n- **Disk file support** (open/watch files, edits saved straight back to disk) requires the File System Access API \u2014 available in Chrome, Edge, Brave, and other Chromium-based browsers. Firefox falls back to IndexedDB-only storage.\n- **Large documents** (tens of thousands of words): Firefox is noticeably slower than Chromium-based browsers, especially when a full re-render is triggered (search highlighting, Typewriter mode, multi-line edits like paste/undo). Chromium-based browsers are recommended for very large documents.\n- **`Ctrl+Q`**: Firefox intercepts the plain shortcut as its own \"Quit\" command before the page sees it \u2014 use `Ctrl+Shift+Q` to close the document (works in both Firefox and Chrome).\n\n## Status bar tokens\n\nThe three status bar zones (left / centre / right) are configured as space-separated token strings in Settings \u2192 Profile.\n\n| Token | Example | Description |\n|---|---|---|\n| `filename` | `my-novel.txt` | Current document name |\n| `dirty` | `[+]` | Unsaved changes indicator |\n| `words` | `1 842w` | Word count |\n| `chars` | `10 240c` | Character count |\n| `lines` | `312L` | Total line count |\n| `line` | `L42` | Current cursor line |\n| `col` | `C7` | Current cursor column |\n| `para` | `18\u00a7` | Paragraph count (blank-line separated) |\n| `pages` | `7p` | Estimated pages at 250 w/page |\n| `percent` | `68%` | Progress toward word goal |\n| `today` | `342\u2191` | Words *added* today (high-water mark across sessions) |\n| `goal` | `342/500` | Today's words / goal (hidden if no goal) |\n| `reading` | `9min` | Estimated reading time at 200 w/min |\n| `clock` | `14:32` | Current time |\n| `timer` | `24:07` | Writing timer display |\n| `space` | ` ` | Single space (explicit separator) |\n| *(anything else)* | literal | Fixed text, separators, etc. |\n\nDefault: Left `filename dirty words` \u00b7 Center *(empty)* \u00b7 Right `goal clock timer`\n\n## INI config\n\n`writhdeck.ini` uses the same format as the Tcl/Tk desktop version. Web-specific options live in a dedicated section so they are silently ignored by the desktop version:\n\n```ini\n[web]\n% Options specific to the web version \u2014 ignored by the desktop version\nopen_last_doc               = no\nintercept_browser_shortcuts = yes\nintercept_context_menu      = yes\n```\n\nOptions shared with the desktop version (`block_cursor`, `blink_cursor`, `line_numbers`, `dark_mode`, etc.) stay in `[behaviour]`.\n\nRight-click `writhdeck.ini` in the browser to export it or reset all settings to defaults (the file is recreated from defaults on next load).\n\n## Project structure\n\n```\nsrc/\n  template.html   HTML skeleton with {{STYLE}} / {{SCRIPT}} / {{BUILD_DATE}} placeholders\n  style.css       All CSS (uses CSS custom properties only, no hardcoded colours)\n  schemes.js      Built-in colour schemes + custom-scheme support\n  db.js           IndexedDB wrapper (promise-based)\n  state.js        App state, load/save helpers\n  ini.js          INI config parser/writer (compatible with desktop version)\n  highlight.js    Syntax highlighter + word count + block cursor injection\n  timer.js        Writing timer\n  toc.js          Table of contents\n  stats.js        Daily word-count stats dialog\n  editor.js       Editor panel, textarea/overlay sync, find/replace, formatting\n  browser.js      Document browser panel, FSA integration\n  settings.js     Settings dialog\n  app.js          Entry point, theme, keyboard router, menus, dialogs\nbuild.py          Build script (inlines CSS/JS, stamps build date)\nMakefile          Convenience wrapper around build.py\n```\n\n## Storage\n\nDocuments are stored in IndexedDB (`writhdeck` database, version 1):\n\n- **`documents`** store \u2014 each document: `id`, `name`, `content`, `created`, `modified`.\n- **`meta`** store \u2014 keyed entries: `iniText`, `favorites`, `recents`, `cursors`, `daily`.\n\nNothing is sent to any server.\n\n## Adding a colour scheme\n\nAdd an entry to the `SCHEMES` object in `src/schemes.js`. Each scheme needs 9 dark-mode keys and 9 light-mode (`*Alt`) keys: `bg`, `fg`, `bgBar`, `fgBar`, `bgSel`, `heading`, `comment`, `markup`, `bg2` (+ `Alt` variants). Then run `make`.\n\n## License\n\nCopyright (C) 2026 by Luginfo \u2014 Zero-Clause BSD License\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted. The software is provided \"as is\" without warranty of any kind.\n";

let _edMenu          = null;
let _openMenuFn      = null;
let _menuNavLock     = false;
let _edCtxMenu       = null;
let _helpDetails     = null;
let _menuActionTime  = 0;

function hideEditorCtxMenu() {
  if (_edCtxMenu) { _edCtxMenu.remove(); _edCtxMenu = null; }
}

function showMainMenu() {
  if (!_edMenu || !_openMenuFn) return;
  _openMenuFn();
  _edMenu.hidden = true;
  setTimeout(() => { _edMenu.hidden = false; }, 0);
}

// ── File info dialog ──────────────────────────────────────────────────────

async function showFileInfo(docArg) {
  const doc = docArg || State.doc;
  if (!doc) return;
  const body = document.getElementById('info-body');
  body.innerHTML = '';

  const wc = (doc.content || '').match(/\S+/g)?.length || 0;
  const cc = (doc.content || '').length;

  // Build storage label with best available path info
  let storageLabel;
  if (doc.fromDisk) {
    let pathDisplay = doc.name;
    if (doc.dirFile && State.dirHandle && doc.fileHandle) {
      // resolve() gives the path relative to the watched folder
      try {
        const parts = await State.dirHandle.resolve(doc.fileHandle);
        if (parts) pathDisplay = [State.dirHandle.name, ...parts].join('/');
      } catch (_) {}
    } else if (doc.fileHandle) {
      pathDisplay = `${doc.fileHandle.name} <span style="color:var(--fg-bar);font-size:0.85em">(folder not set — full path unavailable)</span>`;
    }
    storageLabel = `<span class="info-storage-disk">Disk file — ${pathDisplay}</span>`;
  } else {
    storageLabel = `<span class="info-storage-browser">Browser storage (IndexedDB) — not on your disk</span>`;
  }

  const rows = [
    ['Name',     doc.name],
    ['Storage',  storageLabel],
    ['Words',    wc.toLocaleString()],
    ['Chars',    cc.toLocaleString()],
    ['Created',  doc.created  ? new Date(doc.created).toLocaleString()  : '—'],
    ['Modified', doc.modified ? new Date(doc.modified).toLocaleString() : '—']
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'info-row';
    row.innerHTML = `<span class="info-label">${label}</span><span class="info-value">${value}</span>`;
    body.appendChild(row);
  });

  document.getElementById('info-dlg').showModal();
}

// ── Word occurrences dialog ───────────────────────────────────────────────

async function showWordOcc(docArg) {
  const doc = docArg || State.doc;
  if (!doc) return;

  let content = doc.content;
  if (content == null) {
    if (doc.fileHandle) {
      try { const f = await doc.fileHandle.getFile(); content = await f.text(); }
      catch(_) { content = ''; }
    } else if (doc.id && typeof doc.id === 'number') {
      const full = await DB.getDoc(doc.id);
      content = full ? full.content : '';
    } else { content = ''; }
  }

  const counts = {};
  const words = content.toLowerCase().match(/[\wÀ-ɏ]+/g) || [];
  words.forEach(w => { if (w.length >= 3) counts[w] = (counts[w] || 0) + 1; });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const body = document.getElementById('words-body');
  body.innerHTML = '';

  if (!sorted.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color:var(--fg-bar);padding:12px 0';
    empty.textContent = 'No words found.';
    body.appendChild(empty);
  } else {
    const table = document.createElement('table');
    table.className = 'words-table';
    table.innerHTML = '<tr><th>Word</th><th>#</th></tr>';
    sorted.forEach(([word, count]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${word}</td><td>${count}</td>`;
      table.appendChild(tr);
    });
    body.appendChild(table);
  }

  document.getElementById('words-title').textContent = `Word occurrences — ${doc.name}`;
  document.getElementById('words-dlg').showModal();
}

// ── Structure analyse dialog ──────────────────────────────────────────────

async function showAnalyse(docArg) {
  const doc = docArg || State.doc;
  if (!doc) return;

  let content = doc.content;
  if (content == null) {
    if (doc.fileHandle) {
      try {
        const file = await doc.fileHandle.getFile();
        content = await file.text();
      } catch(_) { content = ''; }
    } else if (doc.id && typeof doc.id === 'number') {
      const full = await DB.getDoc(doc.id);
      content = full ? full.content : '';
    } else {
      content = '';
    }
  }

  const s = State.settings;

  function parseHeading(line) {
    if (s.headingMarker && line.startsWith(s.headingMarker)) {
      let n = 1;
      while (n < 3 && line.startsWith(s.headingMarker.repeat(n + 1))) n++;
      const mEsc = escRx(s.headingMarker);
      const title = line
        .replace(new RegExp('^' + mEsc + '+\\s*'), '')
        .replace(new RegExp('\\s*' + mEsc + '+\\s*$'), '')
        .trim();
      return { level: n, title: title || line.trim() };
    }
    if (s.markdownHeadings) {
      const m = line.match(/^(#{1,6})\s+(.*)/);
      if (m) return { level: m[1].length, title: m[2].trim() };
    }
    return null;
  }

  const sections = [];
  let curTitle = null, curLevel = 0, curWords = 0;

  content.split('\n').forEach(line => {
    const h = parseHeading(line);
    if (h) {
      sections.push({ title: curTitle, level: curLevel, words: curWords });
      curTitle = h.title; curLevel = h.level; curWords = 0;
    } else {
      curWords += (line.match(/\S+/g) || []).length;
    }
  });
  sections.push({ title: curTitle, level: curLevel, words: curWords });

  const total = sections.reduce((acc, sec) => acc + sec.words, 0);

  document.getElementById('analyse-title').textContent = `Structure — ${doc.name}`;
  const body = document.getElementById('analyse-body');
  body.innerHTML = '';

  if (total === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px 0;color:var(--fg-bar)';
    empty.textContent = 'No content to analyse.';
    body.appendChild(empty);
    document.getElementById('analyse-dlg').showModal();
    return;
  }

  const maxBar = 240; // px — max bar width at 100%
  sections.forEach(sec => {
    if (sec.words === 0 && sec.title === null) return;
    const pct = total > 0 ? Math.round(sec.words / total * 100) : 0;
    const barW = Math.max(2, Math.round(pct / 100 * maxBar));
    const indent = sec.level > 1 ? (sec.level - 1) * 14 : 0;
    const label = sec.title || '(début)';

    const row = document.createElement('div');
    row.className = 'analyse-row';
    row.style.paddingLeft = indent + 'px';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'analyse-title';
    if (sec.level > 0) {
      const lvl = document.createElement('span');
      lvl.className = 'analyse-level';
      lvl.textContent = 'H' + sec.level;
      titleDiv.appendChild(lvl);
    }
    const txt = document.createElement('span');
    txt.className = 'analyse-title-text';
    txt.textContent = label;
    titleDiv.appendChild(txt);
    row.appendChild(titleDiv);

    const barWrap = document.createElement('div');
    barWrap.className = 'analyse-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'analyse-bar';
    bar.style.width = barW + 'px';
    const stats = document.createElement('span');
    stats.className = 'analyse-stats';
    stats.textContent = sec.words.toLocaleString() + 'w · ' + pct + '%';
    barWrap.appendChild(bar);
    barWrap.appendChild(stats);
    row.appendChild(barWrap);

    body.appendChild(row);
  });

  const sectionCount = sections.filter(sec => sec.title !== null).length;
  const footer = document.createElement('div');
  footer.className = 'analyse-footer';
  footer.textContent = `Total : ${total.toLocaleString()} mots · ${sectionCount} section${sectionCount !== 1 ? 's' : ''}`;
  body.appendChild(footer);

  document.getElementById('analyse-words-btn').onclick = () => {
    document.getElementById('analyse-dlg').close();
    showWordOcc(doc);
  };
  document.getElementById('analyse-dlg').showModal();
}

// ── Fullscreen ────────────────────────────────────────────────────────────

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ── Theme ──────────────────────────────────────────────────────────────────

function applyTheme() {
  const s  = State.settings;
  const sc = getScheme(s.scheme);
  const dark = s.darkMode;
  const r = document.documentElement.style;

  r.setProperty('--bg',      dark ? sc.bg      : sc.bgAlt);
  r.setProperty('--fg',      dark ? sc.fg      : sc.fgAlt);
  r.setProperty('--bg-bar',  dark ? sc.bgBar   : sc.bgBarAlt);
  r.setProperty('--fg-bar',  dark ? sc.fgBar   : sc.fgBarAlt);
  r.setProperty('--bg-sel',  dark ? sc.bgSel   : sc.bgSelAlt);
  r.setProperty('--heading', dark ? sc.heading : sc.headingAlt);
  r.setProperty('--comment', dark ? sc.comment : sc.commentAlt);
  r.setProperty('--markup',  dark ? sc.markup  : sc.markupAlt);
  r.setProperty('--bg2',     dark ? (sc.bg2 || sc.bg) : (sc.bg2Alt || sc.bgAlt));

  r.setProperty('--font-family',  s.fontFamily || 'monospace');
  r.setProperty('--font-size',    (s.fontSize  || 14) + 'px');
  r.setProperty('--line-spacing', (s.lineSpacing || 1.5));
  r.setProperty('--margin-x',     (s.marginX   || 80) + 'px');
  r.setProperty('--margin-y',     (s.marginY   || 40) + 'px');

  document.getElementById('editor').classList.toggle('block-cursor', !!s.blockCursor);
  document.getElementById('editor').classList.toggle('no-blink', s.blinkCursor === false);
}

// ── File import ────────────────────────────────────────────────────────────

function triggerImport() {
  document.getElementById('file-import-input').click();
}

async function importFiles(files) {
  for (const file of files) {
    const text = await file.text();
    const name = file.name;
    const doc  = { name, content: text, created: Date.now(), modified: Date.now() };
    await DB.saveDoc(doc);
    State.docs.push(doc);
  }
  Browser.render();
  // If a single file, open it directly
  if (files.length === 1) {
    const last = State.docs[State.docs.length - 1];
    await Editor.open(last);
  }
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────

function onKeydown(e) {
  const ctrl  = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const key   = e.key;
  const lkey  = key.toLowerCase();
  const inEditor  = !document.getElementById('editor').hidden;
  const inBrowser = !document.getElementById('browser').hidden;

  Browser.hideContextMenu();
  if (_helpDetails && _helpDetails.open && lkey === 'escape') { _helpDetails.open = false; return; }

  // Menu keyboard handling — intercept at capture level regardless of focus.
  if (_edMenu && !_edMenu.hidden) {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (!_menuNavLock) {
        _menuNavLock = true;
        requestAnimationFrame(() => { _menuNavLock = false; });
        const items = Array.from(_edMenu.querySelectorAll('button:not(:disabled)'));
        const idx   = items.indexOf(document.activeElement);
        const next  = key === 'ArrowDown'
          ? items[(idx + 1) % items.length]
          : items[(idx - 1 + items.length) % items.length];
        if (next) next.focus();
      }
      return;
    }
    // Enter — activate focused button
    if (key === 'Enter') {
      const focused = document.activeElement;
      if (focused && _edMenu.contains(focused)) {
        e.preventDefault(); e.stopPropagation();
        focused.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        return;
      }
    }
    // Letter shortcut — activate button whose hint matches
    if (!ctrl && !e.altKey && lkey.length === 1) {
      const match = Array.from(_edMenu.querySelectorAll('button:not(:disabled)')).find(b => {
        const hint = b.querySelector('.hint');
        return hint && hint.textContent.trim() === lkey;
      });
      if (match) {
        e.preventDefault(); e.stopPropagation();
        match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        return;
      }
    }
  }

  // Global shortcuts (work anywhere, no active input focused)
  const focused = document.activeElement;
  const inInput = focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT');

  // Dark/light toggle — global (works even in editor textarea)
  if (ctrl && lkey === 'd') {
    e.preventDefault();
    State.settings.darkMode = !State.settings.darkMode;
    saveSettings();
    applyTheme();
    if (State.doc) Editor.rehighlight();
    return;
  }

  // File import — global
  if (ctrl && lkey === 'o') {
    e.preventDefault();
    triggerImport();
    return;
  }

  // Shift+Ctrl+F11 — toggle pinned TOC panel (mirrors Tcl key_toc_pinned)
  if (ctrl && shift && key === 'F11') {
    e.preventDefault(); e.stopPropagation();
    if (inEditor) TOC.togglePin();
    return;
  }

  // F11 — always intercept: TOC toggle in editor, ignored elsewhere
  if (key === 'F11') {
    e.preventDefault(); e.stopPropagation();
    if (inEditor) TOC.toggle();
    return;
  }

  // TOC keyboard navigation — active while focus is on the panel (moved there on open)
  if (inEditor && TOC.isVisible() && TOC.isFocused()) {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      TOC.move(key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      TOC.selectFocused();
      return;
    }
    if (lkey === 'escape') {
      e.preventDefault(); e.stopPropagation();
      TOC.hide();
      const ta = document.getElementById('ed-input');
      if (ta) ta.focus();
      return;
    }
  }

  // Alt+Enter — fullscreen toggle
  if (e.altKey && key === 'Enter') {
    e.preventDefault(); e.stopPropagation();
    toggleFullscreen();
    return;
  }

  // Editor shortcuts
  if (inEditor) {
    // Command mode — intercept ALL keys while active
    if (Editor.isCmdMode()) {
      e.preventDefault(); e.stopPropagation();
      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        Editor.cmdNavMove(key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (key === 'Enter') {
        const cmd = Editor.getCmdNavKey();
        if (cmd) {
          document.dispatchEvent(new CustomEvent('writhdeck-cmd', { detail: cmd }));
          return;
        }
      }
      Editor.exitCmdMode();
      switch (lkey) {
        case 'f': Editor.searchOpen(false);  break;
        case 'r': Editor.searchOpen(true);   break;
        case 'g': Editor.gotoLine();         break;
        case 'n': Editor.toggleLineNumbers(); break;
        case 'd':
          State.settings.darkMode = !State.settings.darkMode;
          saveSettings(); applyTheme();
          if (State.doc) Editor.rehighlight();
          break;
        case 'o': TOC.toggle();              break;
        case 'c': Settings.show();           break;
        case 'e': Editor.exportDoc('txt'); break;
        case 's': Stats.show();              break;
        case 'a': showAnalyse();             break;
        case 'i': showFileInfo();            break;
        case 't': Timer.toggle();  Editor.updateStatusBar(); break;
        case 'p': Timer.isActive() ? Timer.pause() : Timer.toggle();
                  Editor.updateStatusBar(); break;
        case 'w': Editor.toggleTypewriter(); break;
        case 'm': showMainMenu(); break;
        case 'q': Editor.close();            break;
        case '1': Editor.applyHeading(1);    break;
        case '2': Editor.applyHeading(2);    break;
        case '3': Editor.applyHeading(3);    break;
        case 'b': Editor.applyInlineMarker(State.settings.boldMarker);      break;
        case 'u': Editor.applyInlineMarker(State.settings.underlineMarker); break;
        case 'x': Editor.applyInlineMarker(State.settings.strikeMarker);    break;
        case '/': Editor.applyLineMarker(State.settings.commentMarker);     break;
        // any other key: just exit cmd mode (already done above)
      }
      return;
    }

    if (ctrl && shift && lkey === 's') { e.preventDefault(); e.stopPropagation(); Editor.saveAs();        return; }
    if (ctrl && lkey === 's')     { e.preventDefault(); e.stopPropagation(); Editor.save();              return; }
    // `shift` deliberately not checked: Firefox intercepts plain Ctrl+Q as "Quit" before
    // JS sees it, so Ctrl+Shift+Q is the only way to close on Firefox — letting it match
    // here too means one binding covers both browsers.
    if (ctrl && lkey === 'q')     { e.preventDefault(); e.stopPropagation(); Editor.close();             return; }
    if (ctrl && lkey === 'f')     { e.preventDefault(); e.stopPropagation(); Editor.searchOpen(false);   return; }
    if (ctrl && lkey === 'h')     { e.preventDefault(); e.stopPropagation(); Editor.searchOpen(true);    return; }
    if (ctrl && lkey === 'g')     { e.preventDefault(); e.stopPropagation(); Editor.gotoLine();          return; }
    if (ctrl && lkey === 'l')     { e.preventDefault(); e.stopPropagation(); Editor.toggleLineNumbers();  return; }
    if (ctrl && lkey === 'b')     { e.preventDefault(); e.stopPropagation(); Editor.applyInlineMarker(State.settings.boldMarker);      return; }
    if (ctrl && lkey === 'i')     { e.preventDefault(); e.stopPropagation(); Editor.applyInlineMarker(State.settings.italicMarker);    return; }
    if (ctrl && lkey === 'u')     { e.preventDefault(); e.stopPropagation(); Editor.applyInlineMarker(State.settings.underlineMarker); return; }
    if (e.altKey && lkey === 't') { e.preventDefault(); e.stopPropagation(); Timer.toggle(); Editor.updateStatusBar(); return; }
    if (e.altKey && lkey === 'c') { e.preventDefault(); e.stopPropagation(); Editor.enterCmdMode(); return; }
    if (e.altKey && lkey === 'm') { e.preventDefault(); e.stopPropagation(); showMainMenu(); return; }

    if (lkey === 'escape') {
      e.preventDefault(); e.stopPropagation();
      if (_edCtxMenu) { hideEditorCtxMenu(); return; }
      if (_edMenu && !_edMenu.hidden) { _edMenu.hidden = true; return; }
      const openDlg = document.querySelector('dialog[open]');
      if (openDlg) { openDlg.close(); return; }
      if (!document.getElementById('search-bar').hidden) { Editor.searchClose(); return; }
      if (!document.getElementById('goto-bar').hidden)   { Editor.gotoLineClose(); return; }
      // ESC enters command mode
      Editor.enterCmdMode();
      return;
    }
    // Hemingway mode is a modifier of typewriter mode (mirrors Tcl/Android):
    // it has no effect at all unless typewriter mode is also active.
    if (State.settings.hemingwayMode && Editor.isTypewriter() && (lkey === 'backspace' || lkey === 'delete')) {
      e.preventDefault(); return;
    }
  }

  // Ctrl+N → new document (overrides browser "new window", requires option)
  if (State.settings.interceptBrowserShortcuts && ctrl && lkey === 'n' && !inInput) {
    e.preventDefault(); e.stopPropagation(); Browser.newDoc(); return;
  }

  // Browser shortcuts (no input focused)
  if (inBrowser && !inInput) {
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(document.querySelectorAll('#br-list .br-nav-item'));
      if (!items.length) return;
      const cur = document.querySelector('#br-list .br-nav-item.br-focused');
      const idx = cur ? items.indexOf(cur) : -1;
      const next = idx === -1
        ? (key === 'ArrowDown' ? 0 : items.length - 1)
        : key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      if (cur) cur.classList.remove('br-focused');
      items[next].classList.add('br-focused');
      items[next].scrollIntoView({ block: 'nearest' });
      return;
    }
    if (key === 'Enter') {
      const cur = document.querySelector('#br-list .br-nav-item.br-focused');
      if (cur) { e.preventDefault(); cur.click(); return; }
    }
    // Backspace — go up one folder in the watched-folder subfolder navigation
    if (key === 'Backspace' && Browser.hasFSA &&
        State.settings.browserSubdirs && State.dirStack.length > 1) {
      e.preventDefault();
      dirUp().then(() => Browser.render());
      return;
    }
    if (lkey === 'n') { e.preventDefault(); Browser.newDoc();        return; }
    if (lkey === 'o' && Browser.hasFSA) { e.preventDefault(); Browser.openFromDisk(); return; }
    if (lkey === 'w' && Browser.hasFSA) { e.preventDefault(); Browser.openFolder();   return; }
    if (lkey === 's') { e.preventDefault(); Stats.show();            return; }
    if (lkey === 'c') { e.preventDefault(); Settings.show();         return; }

    // Shortcuts acting on the keyboard-focused row (mirrors Tcl browser r/d/b/f/i)
    if (lkey === 'r' || lkey === 'd' || lkey === 'b' || lkey === 'f' || lkey === 'i') {
      const doc = Browser.getFocusedDoc();
      if (!doc) return;
      e.preventDefault();
      switch (lkey) {
        case 'r': Browser.renameDoc(doc); break;
        case 'd': Browser.deleteDoc(doc); break;
        case 'b': Browser.backupDoc(doc); break;
        case 'f': toggleFavorite(doc.id); Browser.render(); break;
        case 'i': showFileInfo(doc);      break;
      }
      return;
    }

    // h — toggle the help menu (mirrors Tcl browser 'h' help)
    if (lkey === 'h') {
      e.preventDefault();
      if (_helpDetails) _helpDetails.open = !_helpDetails.open;
      return;
    }

    // z — reload (mirrors Tcl browser 'z' reload)
    if (lkey === 'z') { e.preventDefault(); location.reload(); return; }
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  await DB.open();
  await loadState();
  applyTheme();

  // Restore watched folder if permission still granted (silent — no user gesture needed for query)
  if (State.dirHandle) {
    try {
      const perm = await State.dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await scanDir();
        // Auto-load writhdeck.ini from the watched folder (silent, no prompt)
        if (State.dirIniHandle) {
          try {
            const f = await State.dirIniHandle.getFile();
            const { settings, schemes, profiles, activeProfile } = INI.parseIni(await f.text());
            Object.assign(State.settings, settings);
            for (const [n, sc] of Object.entries(schemes)) {
              if (!SCHEMES[n]) customSchemes[n] = sc;
            }
            applyParsedProfiles(profiles, activeProfile);
            await saveSettings();
            applyTheme(); // re-appliquer après maj des settings depuis le dossier
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  Browser.render();

  // First run — no INI yet → save defaults to IDB
  if (!State.iniText) await saveSettings();

  // Wire editor textarea events
  const ta = document.getElementById('ed-input');
  ta.addEventListener('input',  () => Editor.onInput());
  ta.addEventListener('scroll', () => Editor.syncScroll());
  // Update line/col on cursor move (click or keyboard navigation); also keep
  // the incremental-repaint line cache in sync so a click to a different line
  // followed by typing patches the right DOM node (see syncCursorLineCache),
  // and move the block-cursor span (if enabled) without a full rehighlight().
  ta.addEventListener('click',   () => { Editor.syncCursorLineCache(); Editor.updateStatusBar(); Editor.syncBlockCursor(); });
  ta.addEventListener('keyup',   () => { Editor.syncCursorLineCache(); Editor.updateStatusBar(); Editor.syncBlockCursor(); });

  // Header buttons
  document.getElementById('br-new-btn').addEventListener('click',    () => Browser.newDoc());
  document.getElementById('br-import-btn').addEventListener('click', triggerImport);
  document.getElementById('br-folder-btn').addEventListener('click',  () => Browser.openFolder());
  document.getElementById('br-opendisk-btn').addEventListener('click', () => Browser.openFromDisk());
  document.getElementById('ed-close-btn').addEventListener('click', () => Editor.close());

  // Help menu (? button) — native <details> toggle, no JS click handler needed
  const helpDetails = document.getElementById('br-help-details');
  _helpDetails = helpDetails;

  document.getElementById('br-help-readme').addEventListener('click', async () => {
    helpDetails.open = false;
    let doc = State.docs.find(d => d.name === 'README.md');
    if (!doc) {
      doc = { name: 'README.md', content: README_CONTENT, created: Date.now(), modified: Date.now() };
      await DB.saveDoc(doc);
      State.docs.push(doc);
      Browser.render();
    }
    await Editor.open(doc);
  });

  document.getElementById('br-help-settings').addEventListener('click', () => {
    helpDetails.open = false;
    Settings.show();
  });

  // File import input
  const fileInput = document.getElementById('file-import-input');
  fileInput.addEventListener('change', async () => {
    if (fileInput.files.length) {
      await importFiles(Array.from(fileInput.files));
      fileInput.value = '';
    }
  });
  // Drag and drop on browser panel
  const browserEl = document.getElementById('browser');
  browserEl.addEventListener('dragover', e => { e.preventDefault(); browserEl.style.outline = '2px dashed var(--heading)'; });
  browserEl.addEventListener('dragleave', () => { browserEl.style.outline = ''; });
  browserEl.addEventListener('drop', async e => {
    e.preventDefault();
    browserEl.style.outline = '';
    const files = Array.from(e.dataTransfer.files).filter(f => /\.(txt|md|tcl|text)$/i.test(f.name));
    if (files.length) await importFiles(files);
  });

  // Main editor menu (≡ button)
  const menuBtn  = document.getElementById('ed-menu-btn');
  const edMenu   = document.getElementById('ed-menu');
  _edMenu = edMenu;

  function execCmd(cmd) {
    edMenu.hidden = true;
    switch (cmd) {
      case 'save':       Editor.save();             break;
      case 'save-as':    Editor.saveAs();           break;
      case 'close':      Editor.close();            break;
      case 'browser':    Editor.browser();          break;
      case 'toc':        TOC.toggle();              break;
      case 'dark':
        State.settings.darkMode = !State.settings.darkMode;
        saveSettings(); applyTheme();
        if (State.doc) Editor.rehighlight();
        break;
      case 'linenos':    Editor.toggleLineNumbers(); break;
      case 'typewriter': Editor.toggleTypewriter();  break;
      case 'find':       Editor.searchOpen(false);   break;
      case 'replace':    Editor.searchOpen(true);    break;
      case 'goto':       Editor.gotoLine();          break;
      case 'export-txt': Editor.exportDoc('txt');    break;
      case 'export-md':  Editor.exportDoc('md');     break;
      case 'stats':      Stats.show();               break;
      case 'analyse':    showAnalyse();              break;
      case 'word-occ':   showWordOcc();              break;
      case 'info':       showFileInfo();             break;
      case 'timer':      Timer.toggle(); Editor.updateStatusBar(); break;
      case 'block-cursor':
        State.settings.blockCursor = !State.settings.blockCursor;
        saveSettings();
        applyTheme();
        if (State.doc) Editor.rehighlight();
        break;
      case 'ctx-menu':
        State.settings.interceptContextMenu = !State.settings.interceptContextMenu;
        saveSettings();
        Editor.setMsg(State.settings.interceptContextMenu ? 'Right-click menu on' : 'Right-click menu off');
        break;
      case 'config':     Settings.show();            break;
    }
  }

  function openMenu() {
    const s  = State.settings;
    const hm = s.headingMarker || '';
    [1, 2, 3].forEach(lvl => {
      const btn = edMenu.querySelector(`[data-markup="h${lvl}"]`);
      const p   = hm.repeat(lvl);
      const txt = hm ? `${p} H${lvl} ${p}` : `H${lvl}`;
      btn.innerHTML = `<span>${txt}</span> <span class="hint">${lvl}</span>`;
      btn.disabled  = !hm;
    });
    [['comment', s.commentMarker, 'Comment (line)', '/'],
     ['bold',    s.boldMarker,    'Bold',           'b'],
     ['italic',  s.italicMarker,  'Italic',         null],
     ['underline', s.underlineMarker, 'Underline',  'u'],
     ['strike',  s.strikeMarker,  'Strike',         'x'],
    ].forEach(([type, marker, label, hint]) => {
      const btn = edMenu.querySelector(`[data-markup="${type}"]`);
      const txt = marker ? `${marker} ${label}` : label;
      btn.innerHTML = hint ? `<span>${txt}</span> <span class="hint">${hint}</span>` : `<span>${txt}</span>`;
      btn.disabled  = !marker;
    });
    // Update toggle labels
    const ctxBtn = edMenu.querySelector('[data-cmd="ctx-menu"]');
    if (ctxBtn) ctxBtn.innerHTML = `Right-click menu <span class="hint">${s.interceptContextMenu ? 'on' : 'off'}</span>`;
    const bcBtn = edMenu.querySelector('[data-cmd="block-cursor"]');
    if (bcBtn) bcBtn.innerHTML = `Block cursor <span class="hint">${s.blockCursor ? 'on' : 'off'}</span>`;
    edMenu.hidden = false;
  }
  _openMenuFn = openMenu;

  function menuItems() {
    return Array.from(edMenu.querySelectorAll('button:not(:disabled)'));
  }

  // Prevent menu button from stealing textarea focus (preserves selection).
  menuBtn.addEventListener('mousedown', e => e.preventDefault());
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!edMenu.hidden) { edMenu.hidden = true; return; }
    openMenu();
    edMenu.hidden = true;
    setTimeout(() => { edMenu.hidden = false; }, 0);
  });

  function menuGuard() {
    const now = Date.now();
    if (now - _menuActionTime < 150) return false;
    _menuActionTime = now;
    return true;
  }

  document.getElementById('ed-more-cmd').addEventListener('mousedown', e => {
    if (!menuGuard()) return;
    e.preventDefault();
    edMenu.hidden = true;
    Editor.enterCmdMode();
  });

  edMenu.querySelectorAll('[data-markup]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      if (!menuGuard()) return;
      e.preventDefault();
      edMenu.hidden = true;
      const s = State.settings;
      switch (btn.dataset.markup) {
        case 'h1':        Editor.applyHeading(1);                      break;
        case 'h2':        Editor.applyHeading(2);                      break;
        case 'h3':        Editor.applyHeading(3);                      break;
        case 'comment':   Editor.applyLineMarker(s.commentMarker);     break;
        case 'bold':      Editor.applyInlineMarker(s.boldMarker);      break;
        case 'italic':    Editor.applyInlineMarker(s.italicMarker);    break;
        case 'underline': Editor.applyInlineMarker(s.underlineMarker); break;
        case 'strike':    Editor.applyInlineMarker(s.strikeMarker);    break;
      }
    });
  });

  edMenu.querySelectorAll('[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      if (!menuGuard()) return;
      e.preventDefault();
      execCmd(btn.dataset.cmd);
    });
  });

  document.addEventListener('click', e => { edMenu.hidden = true; if (!helpDetails.contains(e.target)) helpDetails.open = false; hideEditorCtxMenu(); });

  // ── Editor right-click context menu ──────────────────────────────────────

  function buildCtxMenu(e) {
    if (!State.settings.interceptContextMenu) return;
    e.preventDefault();
    hideEditorCtxMenu();

    const s   = State.settings;
    const ta  = document.getElementById('ed-input');
    const sel = ta.selectionStart !== ta.selectionEnd;

    const menu = document.createElement('div');
    menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;
      background:var(--bg-bar);border:1px solid var(--fg-bar);z-index:200;min-width:180px;`;

    function sep() {
      const d = document.createElement('div');
      d.style.cssText = 'height:1px;background:var(--fg-bar);opacity:0.3;margin:3px 0;';
      menu.appendChild(d);
    }

    function item(label, fn, disabled) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.disabled = !!disabled;
      btn.style.cssText = 'display:block;width:100%;text-align:left;padding:5px 14px;' +
        'border:none;background:none;font-family:var(--font-family);font-size:var(--font-size);color:var(--fg);';
      btn.addEventListener('mousedown', ev => ev.preventDefault());
      btn.addEventListener('click', () => { hideEditorCtxMenu(); fn(); });
      menu.appendChild(btn);
    }

    // Format
    const hm = s.headingMarker;
    if (hm) {
      item(`${hm} H1 ${hm}`, () => Editor.applyHeading(1));
      item(`${hm.repeat(2)} H2 ${hm.repeat(2)}`, () => Editor.applyHeading(2));
      item(`${hm.repeat(3)} H3 ${hm.repeat(3)}`, () => Editor.applyHeading(3));
    }
    if (s.commentMarker)   item(`${s.commentMarker} Comment`, () => Editor.applyLineMarker(s.commentMarker));
    if (s.boldMarker)      item(`${s.boldMarker} Bold`,       () => Editor.applyInlineMarker(s.boldMarker),      !sel);
    if (s.italicMarker)    item(`${s.italicMarker} Italic`,   () => Editor.applyInlineMarker(s.italicMarker),    !sel);
    if (s.underlineMarker) item(`${s.underlineMarker} Underline`, () => Editor.applyInlineMarker(s.underlineMarker), !sel);
    if (s.strikeMarker)    item(`${s.strikeMarker} Strike`,   () => Editor.applyInlineMarker(s.strikeMarker),    !sel);

    sep();

    // Edit
    item('Cut',   () => document.execCommand('cut'),  !sel);
    item('Copy',  () => document.execCommand('copy'), !sel);
    item('Paste', async () => {
      try {
        const text = await navigator.clipboard.readText();
        ta.focus();
        document.execCommand('insertText', false, text);
        Editor.onInput();
      } catch (_) {}
    });

    sep();

    // Spell check toggle
    item(`Spell check: ${ta.spellcheck ? 'on' : 'off'}`, () => { ta.spellcheck = !ta.spellcheck; });

    document.body.appendChild(menu);
    _edCtxMenu = menu;

    // Clamp to viewport after paint
    requestAnimationFrame(() => {
      if (!_edCtxMenu) return;
      const r = menu.getBoundingClientRect();
      if (r.right  > window.innerWidth)  menu.style.left = Math.max(0, e.clientX - r.width)  + 'px';
      if (r.bottom > window.innerHeight) menu.style.top  = Math.max(0, e.clientY - r.height) + 'px';
    });
  }

  document.getElementById('ed-input').addEventListener('contextmenu', buildCtxMenu);

  // Search bar
  document.getElementById('search-input').addEventListener('input',  () => Editor.searchUpdate());
  document.getElementById('search-next').addEventListener('click',   () => Editor.searchNext());
  document.getElementById('search-prev').addEventListener('click',   () => Editor.searchPrev());
  document.getElementById('replace-one').addEventListener('click',   () => Editor.replaceOne());
  document.getElementById('replace-all').addEventListener('click',   () => Editor.replaceAll());
  document.getElementById('search-close').addEventListener('click',  () => Editor.searchClose());
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey) Editor.searchPrev();
    else if (e.key === 'Enter')          Editor.searchNext();
    else if (e.key === 'Escape')         Editor.searchClose();
  });
  document.getElementById('replace-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); Editor.replaceAll(); }
    else if (e.key === 'Enter')                         { e.preventDefault(); Editor.replaceOne(); }
    else if (e.key === 'Escape')                        Editor.searchClose();
  });

  // Goto bar
  document.getElementById('goto-go').addEventListener('click',    () => Editor.gotoLineGo());
  document.getElementById('goto-close').addEventListener('click', () => Editor.gotoLineClose());
  document.getElementById('goto-input').addEventListener('keydown', e => {
    if (e.key === 'Enter')  Editor.gotoLineGo();
    else if (e.key === 'Escape') Editor.gotoLineClose();
  });

  // Dialog close buttons
  document.getElementById('info-close').addEventListener('click',     () => document.getElementById('info-dlg').close());
  document.getElementById('analyse-close').addEventListener('click',  () => document.getElementById('analyse-dlg').close());
  document.getElementById('words-close').addEventListener('click',    () => document.getElementById('words-dlg').close());
  document.getElementById('stats-close').addEventListener('click',    () => document.getElementById('stats-dlg').close());
  document.getElementById('timer-alert-ok').addEventListener('click',  () => document.getElementById('timer-alert-dlg').close());
  document.getElementById('about-close').addEventListener('click',    () => document.getElementById('about-dlg').close());
  document.getElementById('about-ok').addEventListener('click',       () => document.getElementById('about-dlg').close());

  // About button and logo in help menu
  const openAbout = () => { helpDetails.open = false; document.getElementById('about-dlg').showModal(); };
  document.getElementById('br-help-about').addEventListener('click', openAbout);
  document.getElementById('br-help-logo').addEventListener('click', openAbout);

  // Misc tab import button (shares triggerImport)
  document.getElementById('misc-import-btn').addEventListener('click', triggerImport);

  // Settings
  Settings.initEvents();

  // File info / analyse from browser context menu
  document.addEventListener('writhdeck-show-info',    e => showFileInfo(e.detail));
  document.addEventListener('writhdeck-show-analyse', e => showAnalyse(e.detail));

  // Command mode clicks from status bar buttons
  document.addEventListener('writhdeck-cmd', e => {
    if (!Editor.isCmdMode()) return;
    Editor.exitCmdMode();
    switch (e.detail) {
      case 'f': Editor.searchOpen(false);  break;
      case 'r': Editor.searchOpen(true);   break;
      case 'g': Editor.gotoLine();         break;
      case 'n': Editor.toggleLineNumbers(); break;
      case 'd':
        State.settings.darkMode = !State.settings.darkMode;
        saveSettings(); applyTheme();
        if (State.doc) Editor.rehighlight();
        break;
      case 'o': TOC.toggle();              break;
      case 'c': Settings.show();           break;
      case 'e': Editor.exportDoc('txt');   break;
      case 's': Stats.show();              break;
      case 'a': showAnalyse();             break;
      case 'i': showFileInfo();            break;
      case 't': Timer.toggle();  Editor.updateStatusBar(); break;
      case 'p': Timer.isActive() ? Timer.pause() : Timer.toggle();
                Editor.updateStatusBar(); break;
      case 'w': Editor.toggleTypewriter(); break;
      case 'm': showMainMenu();            break;
      case 'q': Editor.close();            break;
      case '1': Editor.applyHeading(1);    break;
      case '2': Editor.applyHeading(2);    break;
      case '3': Editor.applyHeading(3);    break;
      case 'b': Editor.applyInlineMarker(State.settings.boldMarker);      break;
      case 'u': Editor.applyInlineMarker(State.settings.underlineMarker); break;
      case 'x': Editor.applyInlineMarker(State.settings.strikeMarker);    break;
      case '/': Editor.applyLineMarker(State.settings.commentMarker);     break;
    }
  });

  // Keyboard — capture phase so we intercept before browser default handlers
  document.addEventListener('keydown', onKeydown, true);

  // Save cursor + dirty guard on unload
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && State.doc) Editor.saveCursorPos();
  });
  window.addEventListener('resize', () => {
    if (State.doc) { Editor.syncGutter(); Editor.syncScroll(); Editor.typewriterScroll(); }
  });
  document.addEventListener('fullscreenchange', () => {
    if (State.doc) { Editor.syncGutter(); Editor.syncScroll(); }
  });
  window.addEventListener('beforeunload', e => {
    if (State.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // Open last doc if configured
  if (State.settings.openLastDoc && State.recents.length) {
    const lastId = State.recents[0];
    const doc = State.docs.find(d => d.id === lastId);
    if (doc) await Editor.open(doc);
  }

  // Embedder hook: a host page (e.g. the LionWiki-t2t writhdeck template) can
  // define window.WRITHDECK_ON_READY to drive the app once init() has finished
  // — open a specific document, rewire buttons, etc. Module objects are passed
  // in because each <script> has its own scope (the embedder's script cannot
  // reach these consts directly).
  if (typeof window !== 'undefined' && typeof window.WRITHDECK_ON_READY === 'function') {
    await window.WRITHDECK_ON_READY({ Editor, Browser, Settings, Stats, State, applyTheme, saveSettings });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('Writhdeck init error:', err);
    document.body.innerHTML +=
      `<div style="position:fixed;bottom:0;left:0;right:0;padding:12px;background:#700;color:#fff;font-family:monospace;font-size:12px">
        Init error: ${err.message || err}. Open DevTools console for details.
      </div>`;
  });
});
