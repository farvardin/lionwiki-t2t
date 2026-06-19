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
