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

        $this->respond(array('ok' => false, 'error' => 'unknown op'), 400);
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

        if (empty($WRITHDECK_EDITOR)) {
            return; // opt-in: set $WRITHDECK_EDITOR = true; in config.php to enable
        }
        if ($action != 'edit' && !$preview) {
            return; // only enhance the editing/preview view
        }

        $base = $PLUGINS_DIR . 'Writhdeck/';
        $dom  = @file_get_contents($base . 'body.html');

        $inject =
            '<link rel="stylesheet" href="' . $base . 'style.css"/>' .
            '<link rel="stylesheet" href="' . $base . 'wiki.css"/>' .
            '<div id="writhdeck-app" hidden>' . $dom . '</div>' .
            // wiki-backend.js must load before writhdeck.js: it defines
            // window.WRITHDECK_BACKEND, which writhdeck's backend.js reads.
            '<script src="' . $base . 'wiki-backend.js"></script>' .
            '<script src="' . $base . 'writhdeck.js"></script>';

        if (strpos($html, '</body>') !== false) {
            $html = str_replace('</body>', $inject . '</body>', $html);
        } else {
            $html .= $inject; // template without a </body> tag
        }
    }
}
