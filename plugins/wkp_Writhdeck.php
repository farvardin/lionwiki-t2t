<?php
/**
 * Writhdeck — replaces LionWiki's classic edit <textarea> with the writhdeck-web
 * editor (colour-syntax overlay, themes, typewriter focus, TOC, search) on ANY
 * template, without editing the template files or index.php.
 *
 * Template-agnostic, opt-in via config.php (non-disruptive — the plugin file can
 * stay in plugins/ without changing anything until you turn it on):
 *   - enable  : add  $WRITHDECK_EDITOR = true;  to config.php
 *   - disable : remove that line (or set it false) → classic editing comes back
 *
 * How it works: on edit/preview the template() hook (which runs before the
 * {PLACEHOLDER} substitution and before output) injects, right before </body>,
 * the writhdeck DOM + assets. wiki-backend.js binds writhdeck's storage layer to
 * the native <textarea id="inputPane">, so saving still goes through LionWiki's
 * own form (conflict detection, password, edit summary, rename, history).
 *
 * Assets in plugins/Writhdeck/:
 *   writhdeck.js / style.css / body.html  — generated from writhdeck-web (sync-assets.py)
 *   wiki-backend.js / wiki.css            — hand-written integration glue
 *
 * Note: if BetterEditor is also enabled, its toolbar attaches to the now-hidden
 * native textarea (harmless but redundant) — disable it when using Writhdeck.
 *
 * 2026 — GPL'd, same licence as LionWiki-t2t.
 */
class Writhdeck
{
    var $desc = array(
        array("Writhdeck", "replaces the edit textarea with the writhdeck-web editor.")
    );

    /**
     * Tiny JSON API driving the writhdeck file browser against var/pages/.
     * Runs very early (actionBegin) so it can answer and exit before any of
     * LionWiki's page-rendering machinery. Read-only here (list + raw page
     * source); saving keeps going through LionWiki's native action=save POST
     * (conflict detection, password, history) — see wiki-backend.js.
     *
     *   ?action=writhdeck_api&op=list          → {ok, pages:[{name,modified,size}]}
     *   ?action=writhdeck_api&op=raw&page=Foo  → {ok, name, content, modified}
     */
    function actionBegin()
    {
        global $action, $WRITHDECK_EDITOR, $PG_DIR;

        if (empty($WRITHDECK_EDITOR) || $action !== 'writhdeck_api') {
            return;
        }

        $op = isset($_REQUEST['op']) ? $_REQUEST['op'] : '';

        if ($op === 'list') {
            $pages = array();
            foreach ((array) glob($PG_DIR . '*.txt') as $file) {
                $name = substr(basename($file), 0, -4); // strip ".txt"
                $pages[] = array(
                    'name'     => $name,
                    'modified' => filemtime($file),
                    'size'     => filesize($file),
                );
            }
            $this->respond(array('ok' => true, 'pages' => $pages));
        }

        if ($op === 'raw') {
            $name = clear_path(isset($_REQUEST['page']) ? $_REQUEST['page'] : '');
            $path = $PG_DIR . $name . '.txt';
            if ($name === '' || !is_file($path)) {
                $this->respond(array('ok' => false, 'error' => 'not found'), 404);
            }
            $this->respond(array(
                'ok'       => true,
                'name'     => $name,
                'content'  => file_get_contents($path),
                'modified' => filemtime($path),
            ));
        }

        // Persist the writhdeck colour scheme to templates/writerdeck/style.css
        // so the wiki theme follows the scheme picked in the editor's Settings.
        // Gated: only an authenticated user, and only when var/pages/ is writable
        // (i.e. an editable install, not a read-only deployment). The client
        // sends colour values; we validate them as hex and build the CSS here
        // (never write client-supplied CSS verbatim).
        if ($op === 'savecss') {
            if (!authentified()) {
                $this->respond(array('ok' => false, 'error' => 'auth'), 403);
            }
            if (!is_writable($PG_DIR)) {
                $this->respond(array('ok' => false, 'error' => 'readonly'), 403);
            }
            $vars = json_decode(isset($_POST['vars']) ? $_POST['vars'] : '', true);
            if (!is_array($vars) || empty($vars['light']) || empty($vars['dark'])) {
                $this->respond(array('ok' => false, 'error' => 'bad vars'), 400);
            }
            $css = $this->buildSchemeCss(
                $vars['light'], $vars['dark'],
                isset($vars['scheme']) ? $vars['scheme'] : '',
                isset($vars['layout']) && is_array($vars['layout']) ? $vars['layout'] : array()
            );
            $dir  = 'templates/writerdeck/';
            $dest = $dir . 'style.css';
            if (!is_dir($dir) || !is_writable(is_file($dest) ? $dest : $dir)) {
                $this->respond(array('ok' => false, 'error' => 'template not writable'), 403);
            }
            if (@file_put_contents($dest, $css) === false) {
                $this->respond(array('ok' => false, 'error' => 'write failed'), 500);
            }
            $this->respond(array('ok' => true));
        }

        $this->respond(array('ok' => false, 'error' => 'unknown op'), 400);
    }

    // Build the writerdeck override stylesheet from validated hex colours.
    // Mirrors the variable structure of templates/writerdeck/writerdeck.html so
    // it overrides the default "alt01" palette while keeping the light/dark
    // toggle working (light = :root, dark = media query, both forceable).
    private function buildSchemeCss($light, $dark, $scheme, $layout)
    {
        $keys = array('bg', 'fg', 'bg-bar', 'fg-bar', 'bg-sel', 'heading', 'comment', 'link', 'rule', 'code-bg');
        $block = function ($set, $indent) use ($keys) {
            $out = '';
            if (!is_array($set)) {
                return $out;
            }
            foreach ($keys as $k) {
                if (isset($set[$k]) && preg_match('/^#[0-9a-fA-F]{3,8}$/', $set[$k])) {
                    $out .= $indent . '--' . $k . ': ' . $set[$k] . ";\n";
                }
            }
            return $out;
        };
        $l = $block($light, '  ');
        $d = $block($dark, '    ');
        $name = preg_replace('/[^A-Za-z0-9 _-]/', '', (string) $scheme);
        // Layout/typography vars are mode-independent → emitted once in :root.
        $layoutCss = $this->buildLayoutCss($layout);

        return "/* Generated by the Writhdeck plugin — wiki appearance from the editor's\n" .
            "   colour scheme" . ($name !== '' ? " \"$name\"" : '') . " (plus margins, fonts, spacing).\n" .
            "   Overrides the template's defaults. Delete this file to restore them. */\n" .
            ":root {\n$l$layoutCss}\n" .
            "@media (prefers-color-scheme: dark) {\n  :root {\n$d  }\n}\n" .
            ":root[data-theme=\"light\"] {\n$l}\n" .
            ":root[data-theme=\"dark\"] {\n" . $block($dark, '  ') . "}\n" .
            $this->buildLayoutRules($layout);
    }

    // Explicit layout rules for exact parity with the editor, applied directly
    // to the template's elements so they win regardless of the template version
    // (variables alone depend on the template referencing them). Mirrors
    // writhdeck: the body gets the margins as padding and the content blocks
    // fill the rest (no max-width cap) — so margin=1px ⇒ near-full-width column.
    private function buildLayoutRules($layout)
    {
        if (!is_array($layout)) {
            return '';
        }
        $num = function ($k) use ($layout) {
            return (isset($layout[$k]) && preg_match('/^\d{1,4}$/', (string) $layout[$k])) ? (int) $layout[$k] : null;
        };
        $mx = $num('margin-x');
        $my = $num('margin-y');
        if ($mx === null && $my === null) {
            return '';
        }
        $padX = $mx === null ? 0 : $mx;
        $padY = $my === null ? 0 : $my;

        return "/* exact-parity layout (writhdeck margins) */\n" .
            "body { padding: {$padY}px {$padX}px; }\n" .
            "header, main, footer { max-width: none; margin-left: auto; margin-right: auto; padding-left: 0; padding-right: 0; }\n";
    }

    // Validate + emit the mode-independent layout vars (--wd-*). Pixel values
    // are integers, line-height is a unitless float, the font family is
    // sanitised to a safe character set. Invalid values are simply skipped.
    private function buildLayoutCss($layout)
    {
        if (!is_array($layout)) {
            return '';
        }
        $out = '';
        $px = array('margin-x', 'margin-y', 'font-size');
        foreach ($px as $k) {
            if (isset($layout[$k]) && preg_match('/^\d{1,4}$/', (string) $layout[$k])) {
                $out .= '  --wd-' . $k . ': ' . $layout[$k] . "px;\n";
            }
        }
        // When a horizontal margin is set, lift the template's 720px column cap
        // so the margin actually controls the content width (writhdeck-style:
        // text fills the viewport minus the side margins).
        if (isset($layout['margin-x']) && preg_match('/^\d{1,4}$/', (string) $layout['margin-x'])) {
            $out .= "  --wd-content-max: none;\n";
        }
        if (isset($layout['line-height']) && preg_match('/^\d+(\.\d+)?$/', (string) $layout['line-height'])) {
            $out .= '  --wd-line-height: ' . $layout['line-height'] . ";\n";
        }
        if (isset($layout['font'])) {
            $font = trim(preg_replace('/[^A-Za-z0-9 ,"\'\-]/', '', (string) $layout['font']));
            if ($font !== '') {
                $out .= '  --wd-font: ' . $font . ";\n";
            }
        }
        return $out;
    }

    // Emit a JSON response and stop — the API never falls through to the wiki.
    private function respond($data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($data);
        exit;
    }

    function template()
    {
        global $action, $preview, $html, $PLUGINS_DIR, $WRITHDECK_EDITOR;

        // On EVERY page: cache-bust the writerdeck template stylesheet (which
        // op=savecss regenerates with the chosen scheme/margins/fonts) so the
        // browser never serves a stale copy after it changes. The template
        // links it statically, so it can't add ?v= itself.
        $tplCss = 'templates/writerdeck/style.css';
        if (is_file($tplCss) && strpos($html, $tplCss . '"') !== false) {
            $html = str_replace(
                $tplCss . '"',
                $tplCss . '?v=' . filemtime($tplCss) . '"',
                $html
            );
        }

        if (empty($WRITHDECK_EDITOR)) {
            return; // opt-in: set $WRITHDECK_EDITOR = true; in config.php to enable
        }
        if ($action != 'edit' && !$preview) {
            return; // only enhance the editing/preview view
        }

        $base = $PLUGINS_DIR . 'Writhdeck/';
        $dom  = @file_get_contents($base . 'body.html');

        // Cache-bust with the file's mtime so a proxy/browser never serves a
        // stale asset after an update (e.g. wiki-backend.js gaining features).
        $v = function ($file) use ($base) {
            return $base . $file . '?v=' . (@filemtime($base . $file) ?: 0);
        };

        $inject =
            '<link rel="stylesheet" href="' . $v('style.css') . '"/>' .
            '<link rel="stylesheet" href="' . $v('wiki.css') . '"/>' .
            '<div id="writhdeck-app" hidden>' . $dom . '</div>' .
            // wiki-backend.js must load before writhdeck.js: it defines
            // window.WRITHDECK_BACKEND, which writhdeck's backend.js reads.
            '<script src="' . $v('wiki-backend.js') . '"></script>' .
            '<script src="' . $v('writhdeck.js') . '"></script>';

        if (strpos($html, '</body>') !== false) {
            $html = str_replace('</body>', $inject . '</body>', $html);
        } else {
            $html .= $inject; // template without a </body> tag
        }
    }
}
