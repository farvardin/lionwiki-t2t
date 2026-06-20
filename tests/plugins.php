<?php
/**
 * Tests de régression des plugins LionWiki.
 *
 * Contrairement à run.php (qui teste le rendu txt2tags via fichiers « golden »),
 * ce harnais teste la *logique PHP* des plugins en isolation. Les plugins
 * dépendent normalement de l'état global et des fonctions d'index.php : on
 * fournit ici des stubs minimaux (h, u, clear_path, template_replace, plugin…)
 * puis on appelle les méthodes « pures » des plugins avec entrée → attendu.
 *
 * Ces tests verrouillent notamment les corrections de compatibilité PHP 8 :
 *   - Tables          : lien dans une cellule (ex-create_function, fatal 8.0)
 *   - InlineDiff      : rendu mot-à-mot (ex-each(), constructeurs PHP4)
 *   - Comments        : __construct + count() sans dossier (TypeError 8.0)
 *   - SyntaxHighlighter : extraction {syntax}, propriété $codes
 *
 * Usage :
 *   php tests/plugins.php            # tous les tests
 *   php tests/plugins.php Tables     # un seul groupe
 *
 * Codes de sortie : 0 = tout OK, 1 = au moins un échec.
 */

error_reporting(E_ALL);

$ROOT = dirname(__DIR__);
chdir($ROOT);

/* ------------------------------------------------------------------ *
 * Stubs des fonctions/globales fournies normalement par index.php.
 * ------------------------------------------------------------------ */

if (!function_exists('h')) {
    function h($t) { return htmlspecialchars((string) $t, ENT_QUOTES); }
}
if (!function_exists('u')) {
    function u($t) { return urlencode((string) $t); }
}
if (!function_exists('clear_path')) {
    function clear_path($s) {
        $s = (string) $s;
        for ($i = 0, $ret = '', $c = strlen($s); $i < $c; $i++) {
            $ret .= ctype_cntrl($s[$i]) ? '' : $s[$i];
        }
        return trim(str_replace(array('..', '<', '>', '"', '//', '/.', '\\\\', "\0"), '', $ret), '/');
    }
}
if (!function_exists('template_replace')) {
    function template_replace($what, $subs, $where) {
        return str_replace('{' . $what . '}', $subs, $where);
    }
}
if (!function_exists('template_match')) {
    function template_match($what, $where, &$null) { return strpos($where, '{' . $what . '}') !== false; }
}
if (!function_exists('plugin')) {
    function plugin($hook) { return false; } // pas de chaîne de plugins en test
}

$GLOBALS['PLUGINS_DIR']      = 'plugins/';
$GLOBALS['PLUGINS_DATA_DIR'] = 'var/plugins/';
$GLOBALS['VAR_DIR']          = 'var/';
$GLOBALS['PG_DIR']           = 'var/pages/';
$GLOBALS['self']             = 'index.php';
$GLOBALS['LANG']             = 'fr';

/* ------------------------------------------------------------------ *
 * Mini-framework d'assertions.
 * ------------------------------------------------------------------ */

$GLOBALS['__passed'] = 0;
$GLOBALS['__failed'] = 0;
$GLOBALS['__filter'] = $argv[1] ?? null;
$GLOBALS['__diags']  = array();

set_error_handler(function ($no, $str, $file, $line) {
    // On ne capture que les diagnostics issus du code du projet (pas des
    // extensions), en ignorant les I/O déjà supprimées par @ : en PHP 8 le
    // handler les voit encore car @ ne ramène plus error_reporting() à 0.
    if (strpos($file, 'lionwiki') !== false && strpos($str, 'Failed to open ') === false) {
        $GLOBALS['__diags'][] = "[$no] $str @ " . basename($file) . ":$line";
    }
    return true;
});

function group($name) {
    return $GLOBALS['__filter'] === null || $GLOBALS['__filter'] === $name;
}

function check($name, $cond, $detail = '') {
    if ($cond) {
        echo "OK       $name\n";
        $GLOBALS['__passed']++;
    } else {
        echo "FAIL     $name" . ($detail ? "  ($detail)" : '') . "\n";
        $GLOBALS['__failed']++;
    }
}

function check_contains($name, $haystack, $needle) {
    check($name, is_string($haystack) && strpos($haystack, $needle) !== false,
        "attendu de trouver « $needle »");
}

/* ================================================================== *
 * Tables — locks the ex-create_function (fatal PHP 8.0) regression.
 * ================================================================== */
if (group('Tables')) {
    require_once 'plugins/wkp_Tables.php';
    $p = new Tables();

    // Tableau simple
    $GLOBALS['CON'] = "| a | b |\n| c | d |\n";
    $p->formatBegin();
    check_contains('Tables: tableau simple → <table>', $GLOBALS['CON'], '<table class="wikitable">');
    check_contains('Tables: cellule rendue', $GLOBALS['CON'], '<td');

    // Cellule contenant un lien avec « | » (chemin ex-create_function)
    $GLOBALS['CON'] = "| [http://exemple.org|lien] | b |\n| c | d |\n";
    $p->formatBegin();
    check_contains('Tables: lien dans une cellule préservé', $GLOBALS['CON'], 'http://exemple.org|lien');
}

/* ================================================================== *
 * InlineDiff — locks the ex-each() + PHP4-constructor regressions.
 * ================================================================== */
if (group('InlineDiff')) {
    require_once 'plugins/InlineDiff/diff.php';
    require_once 'plugins/InlineDiff/renderer.php';
    require_once 'plugins/InlineDiff/inline.php';

    // Entrée assez longue + lignes répétées pour exercer l'algo LCS (_diag, ex-each()).
    $base = array();
    for ($i = 0; $i < 60; $i++) { $base[] = "ligne commune $i"; if ($i % 7 === 0) $base[] = "motif repete"; }
    $a = $base; $b = $base;
    $a[5] = "ancienne phrase a modifier"; $b[5] = "nouvelle phrase modifiee";
    array_splice($b, 20, 0, array("ajout 1", "ajout 2", "motif repete"));
    array_splice($a, 40, 2);

    $diff = new Text_Diff('native', array($a, $b));
    $out  = (new Text_Diff_Renderer_inline())->render($diff);

    check('InlineDiff: au moins une opération de diff', count($diff->getDiff()) > 0);
    check_contains('InlineDiff: insertion <ins>', $out, '<ins>');
    check_contains('InlineDiff: suppression <del>', $out, '<del>');
    check_contains('InlineDiff: mot inséré conservé', $out, 'nouvelle');

    // Cas trivial sans différence : pas de <ins>/<del>.
    $same = new Text_Diff('native', array(array('x', 'y'), array('x', 'y')));
    $out2 = (new Text_Diff_Renderer_inline())->render($same);
    check('InlineDiff: contenu identique → aucun <ins>/<del>',
        strpos($out2, '<ins>') === false && strpos($out2, '<del>') === false);
}

/* ================================================================== *
 * Comments — locks __construct + count($filenames) (TypeError 8.0).
 * ================================================================== */
if (group('Comments')) {
    require_once 'plugins/wkp_Comments.php';
    $c = new Comments();

    // __construct doit avoir tourné (init + localize).
    check('Comments: __construct initialise data_dir', $c->data_dir === 'plugins/Comments/');
    check('Comments: localisation FR chargée', ($c->strings['TP_COMMENTS'] ?? '') === 'Commentaires');

    // processComment : syntaxe wiki → HTML.
    check_contains('Comments: gras', $c->processComment("'''gras'''"), '<strong>gras</strong>');
    check_contains('Comments: italique', $c->processComment("''ital''"), '<em>ital</em>');
    check_contains('Comments: lien externe',
        $c->processComment('[label|http://exemple.org]'), 'href="http://exemple.org"');

    // template() ne doit pas planter quand il n'existe aucun dossier de
    // commentaires (chemin count($filenames) qui levait un TypeError en 8.0).
    $GLOBALS['CON'] = "Texte {COMMENTS} fin";
    $GLOBALS['html'] = ''; $GLOBALS['action'] = ''; $GLOBALS['preview'] = false;
    $GLOBALS['page'] = '__page_inexistante__'; $GLOBALS['HEAD'] = '';
    $GLOBALS['comments_html'] = ''; $GLOBALS['comment_captcha_failed'] = false;
    $ok = true;
    try { $c->template(); } catch (\Throwable $e) { $ok = false; }
    check('Comments: template() sans dossier ne plante pas', $ok,
        $ok ? '' : 'exception levée');
}

/* ================================================================== *
 * SyntaxHighlighter — locks la propriété $codes + extraction {syntax}.
 * ================================================================== */
if (group('SyntaxHighlighter')) {
    require_once 'plugins/wkp_SyntaxHighlighter.php';
    $s = new SyntaxHighlighter();
    $_GET = array(); // pas de plaincode

    // Page sans code : ne fait rien, ne plante pas.
    $GLOBALS['CON'] = "Juste du texte.";
    $s->subPagesLoaded();
    check('SyntaxHighlighter: aucun code → n_codes = 0', $s->n_codes === 0);

    // Page avec un bloc {syntax} : remplacé par le marqueur {SYNTAX}.
    $GLOBALS['CON'] = "Avant {syntax php}echo 1;{/syntax} apres";
    $s->subPagesLoaded();
    check('SyntaxHighlighter: bloc détecté → n_codes = 1', $s->n_codes === 1);
    check_contains('SyntaxHighlighter: code remplacé par marqueur', $GLOBALS['CON'], '{SYNTAX}');
    check('SyntaxHighlighter: code mis de côté dans $codes', count($s->codes) === 1);
}

/* ================================================================== *
 * Footnotes — {footnote}…{/footnote} → renvoi [n] + liste <ol>.
 * ================================================================== */
if (group('Footnotes')) {
    require_once 'plugins/wkp_Footnotes.php';
    $f = new Footnotes();

    $GLOBALS['CON'] = "Phrase{footnote}Première note{/footnote} et autre{footnote}Deuxième{/footnote}.";
    $f->formatEnd();
    check_contains('Footnotes: 1er renvoi [1]', $GLOBALS['CON'], '[1]</a></sup>');
    check_contains('Footnotes: 2e renvoi [2]', $GLOBALS['CON'], '[2]</a></sup>');
    check('Footnotes: 2 notes mémorisées', count($f->ft) === 2);

    $GLOBALS['CON'] = "{plugin:FOOT_NOTES}";
    $f->template();
    check_contains('Footnotes: liste <ol>', $GLOBALS['CON'], '<ol id="footnotes">');
    check_contains('Footnotes: contenu de la note', $GLOBALS['CON'], 'Première note');
}

/* ================================================================== *
 * ImageExt — [./img.png|options] → <img …>. Inclut le cas « $ littéral ».
 * ================================================================== */
if (group('ImageExt')) {
    require_once 'plugins/wkp_ImageExt.php';
    $img = new ImageExt();

    // Image simple : marquée de côté en formatBegin, rendue en formatEnd.
    $GLOBALS['CON'] = "Avant [./photo.png] apres";
    $img->formatBegin();
    check_contains('ImageExt: image mise de côté → {IMAGE}', $GLOBALS['CON'], '{IMAGE}');
    $img->formatEnd();
    check_contains('ImageExt: balise <img> générée', $GLOBALS['CON'], '<img src="./photo.png"');

    // Régression : un « $ » dans un attribut ne doit pas être interprété comme
    // référence arrière (chemin ex-preg_replace → preg_replace_callback).
    $img2 = new ImageExt();
    $GLOBALS['CON'] = '[./p.png|alt=Prix: $5]'; // $5 littéral (guillemets simples)
    $img2->formatBegin();
    $img2->formatEnd();
    check_contains('ImageExt: « $ » dans alt préservé littéralement', $GLOBALS['CON'], 'Prix: $5');
}

/* ================================================================== *
 * WhatLinksHere — locks count($files) sans résultat (TypeError 8.0).
 * ================================================================== */
if (group('WhatLinksHere')) {
    require_once 'plugins/wkp_WhatLinksHere.php';
    $w = new WhatLinksHere();

    // Pages temporaires : « source » pointe vers « cible », « autre » non.
    $pgdir = sys_get_temp_dir() . '/lw_wlh_' . getmypid() . '/';
    @mkdir($pgdir, 0777, true);
    file_put_contents($pgdir . 'source.txt', "Voir [cible] pour la suite.");
    file_put_contents($pgdir . 'autre.txt', "Aucun lien ici.");
    file_put_contents($pgdir . 'cible.txt', "Je suis la cible.");
    $GLOBALS['PG_DIR'] = $pgdir;
    $GLOBALS['CON'] = ''; $GLOBALS['TITLE'] = '';

    // Cas nominal : une page pointe vers « cible ».
    $GLOBALS['page'] = 'cible';
    $w->action('whatlinkshere');
    check_contains('WhatLinksHere: liste la page source', $GLOBALS['CON'], 'page=source');
    check_contains('WhatLinksHere: titre avec compteur (1)', $GLOBALS['TITLE'], '? (1)');

    // Cas limite (ex-TypeError) : aucune page ne pointe vers « orpheline ».
    $GLOBALS['CON'] = ''; $GLOBALS['TITLE'] = '';
    $GLOBALS['page'] = 'orpheline';
    $ok = true;
    try { $w->action('whatlinkshere'); } catch (\Throwable $e) { $ok = false; }
    check('WhatLinksHere: aucune référence ne plante pas', $ok, $ok ? '' : 'exception');
    check_contains('WhatLinksHere: compteur (0)', $GLOBALS['TITLE'], '? (0)');

    @unlink($pgdir . 'source.txt'); @unlink($pgdir . 'autre.txt'); @unlink($pgdir . 'cible.txt');
    @rmdir($pgdir);
    $GLOBALS['PG_DIR'] = 'var/pages/';
}

/* ------------------------------------------------------------------ */

$total = $GLOBALS['__passed'] + $GLOBALS['__failed'];
echo "\n{$GLOBALS['__passed']}/{$total} passé(s)";
if ($GLOBALS['__failed']) echo ", {$GLOBALS['__failed']} échoué(s)";
echo "\n";

if ($GLOBALS['__diags']) {
    echo "\nDiagnostics PHP capturés :\n";
    foreach (array_unique($GLOBALS['__diags']) as $d) echo "  $d\n";
}

exit(($GLOBALS['__failed'] > 0 || $GLOBALS['__diags']) ? 1 : 0);
