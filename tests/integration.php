<?php
/**
 * Tests d'intégration d'index.php (flux de requête complet).
 *
 * Lance le serveur web intégré de PHP sur un docroot temporaire *isolé*
 * (jamais le vrai var/), puis effectue de vraies requêtes HTTP et vérifie
 * statut, en-têtes (redirections), corps et effets de bord (fichiers écrits).
 *
 * Le config.php de test force error_reporting(E_ALL) + display_errors : tout
 * warning/dépréciation/fatal apparaît donc dans la réponse, et chaque test
 * échoue s'il en trouve — c'est le garde-fou « anti-écran-blanc » qui couvre
 * le flux routing → auth → IO → rendu → template → plugins.
 *
 * Usage :
 *   php tests/integration.php
 *
 * Prérequis : serveur web intégré de PHP (présent par défaut).
 * Code de sortie : 0 si tout passe, 1 sinon.
 */

$ROOT = dirname(__DIR__);

/* ------------------------------------------------------------------ *
 * Mini-framework d'assertions.
 * ------------------------------------------------------------------ */
$passed = 0; $failed = 0;
function check($name, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "OK       $name\n"; $passed++; }
    else       { echo "FAIL     $name" . ($detail ? "  ($detail)" : '') . "\n"; $failed++; }
}
function check_contains($name, $hay, $needle) {
    check($name, is_string($hay) && strpos($hay, $needle) !== false, "attendu « $needle »");
}
/** Garde-fou : aucune trace d'erreur PHP dans le corps renvoyé. */
function check_no_php_error($name, $body) {
    $ok = is_string($body)
        && !preg_match('/\b(Fatal error|Parse error|Uncaught|Warning|Deprecated|Notice)\b\s*:/i', $body);
    $detail = '';
    if (!$ok && preg_match('/((Fatal error|Parse error|Uncaught|Warning|Deprecated|Notice)\s*:.*)/i', $body, $m)) {
        $detail = trim(substr($m[1], 0, 120));
    }
    check($name, $ok, $detail);
}

/* ------------------------------------------------------------------ *
 * Préparation d'un docroot temporaire isolé.
 * ------------------------------------------------------------------ */
$docroot = sys_get_temp_dir() . '/lw_integ_' . getmypid();
@mkdir($docroot, 0777, true);

// Symlinks vers le code réel (tout sauf var/ et config.php, qu'on fournit nous-mêmes).
foreach (scandir($ROOT) as $entry) {
    if (in_array($entry, array('.', '..', 'var', 'config.php', '.git', 'tests'), true)) continue;
    @symlink($ROOT . '/' . $entry, $docroot . '/' . $entry);
}

// config.php de test : garde-fou E_ALL + paramètres connus.
file_put_contents($docroot . '/config.php', <<<'PHP'
<?php
error_reporting(E_ALL);          // garde-fou : tout diagnostic visible dans la reponse
ini_set('display_errors', '1');
$WIKI_TITLE = 'Wiki de test';
$PASSWORD   = sha1('secret');     // mot de passe d'edition = "secret"
$START_PAGE = 'main';
$TEMPLATE   = 'templates/minimal.html';
PHP
);

// var/ isolé, avec des pages connues.
@mkdir($docroot . '/var/pages', 0777, true);
@mkdir($docroot . '/var/history/sample', 0777, true);
file_put_contents($docroot . '/var/pages/main.txt',
    "Bienvenue. Ceci est MARQUEUR_MAIN avec du **gras** et un [lien interne sample].\n");
file_put_contents($docroot . '/var/pages/sample.txt', "Page d'exemple sample.\n");

// Deux révisions d'historique pour exercer le diff (InlineDiff actif).
$rev1 = '20200101-1200-00.bak';
$rev2 = '20200101-1201-00.bak';
file_put_contents($docroot . "/var/history/sample/$rev1", "Ligne inchangee\nAncienne ligne\n");
file_put_contents($docroot . "/var/history/sample/$rev2", "Ligne inchangee\nNouvelle ligne modifiee\n");

/* ------------------------------------------------------------------ *
 * Démarrage du serveur web intégré (CWD = docroot → var/ isolé).
 * ------------------------------------------------------------------ */
$sock = @stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
if (!$sock) { fwrite(STDERR, "Impossible de réserver un port: $errstr\n"); exit(1); }
$name = stream_socket_get_name($sock, false);
$port = (int) substr($name, strrpos($name, ':') + 1);
fclose($sock);

$desc = array(0 => array('pipe', 'r'), 1 => array('file', '/dev/null', 'a'), 2 => array('file', '/dev/null', 'a'));
$proc = proc_open(
    array(PHP_BINARY, '-d', 'display_errors=1', '-S', "127.0.0.1:$port"),
    $desc, $pipes, $docroot
);
if (!is_resource($proc)) { fwrite(STDERR, "Échec du démarrage du serveur PHP\n"); exit(1); }

$base = "http://127.0.0.1:$port";

/** Requête HTTP ; ne suit pas les redirections. Renvoie [status, location, body]. */
function req($url, $post = null) {
    $http = array('ignore_errors' => true, 'follow_location' => 0, 'timeout' => 5);
    if ($post !== null) {
        $http['method']  = 'POST';
        $http['header']  = "Content-Type: application/x-www-form-urlencoded\r\n";
        $http['content'] = http_build_query($post);
    }
    $body = @file_get_contents($url, false, stream_context_create(array('http' => $http)));
    $status = 0; $location = '';
    foreach ($http_response_header ?? array() as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $status = (int) $m[1];
        if (stripos($h, 'Location:') === 0)           $location = trim(substr($h, 9));
    }
    return array($status, $location, $body);
}

// Attendre que le serveur réponde.
$ready = false;
for ($i = 0; $i < 50; $i++) {
    list($st) = req("$base/?page=main");
    if ($st > 0) { $ready = true; break; }
    usleep(100000); // 100 ms
}

try {
    if (!$ready) { check('serveur démarré', false, 'pas de réponse'); }
    else {
        /* ---- 1. Voir une page existante ---- */
        list($st, $loc, $body) = req("$base/?page=main");
        check('view main: HTTP 200', $st === 200, "status=$st");
        check_contains('view main: contenu rendu', $body, 'MARQUEUR_MAIN');
        check_contains('view main: titre du wiki', $body, 'Wiki de test');
        // <b> est le tag gras par défaut de txt2tags (snippets['**'], cf. txt2tags.class.php) ;
        // la ligne 47 de la classe montre comment le forcer en <strong> si besoin.
        check_contains('view main: **gras** interprété', $body, '<b>gras</b>');
        check_no_php_error('view main: aucune erreur PHP', $body);

        /* ---- 2. Page inexistante ---- */
        list($st, $loc, $body) = req("$base/?page=page_qui_nexiste_pas");
        check('view inexistante: HTTP 200', $st === 200, "status=$st");
        check_contains('view inexistante: template rendu', $body, 'Wiki de test');
        check_no_php_error('view inexistante: aucune erreur PHP', $body);

        /* ---- 3. Changements récents (chemin $recent/$m corrigé) ---- */
        list($st, $loc, $body) = req("$base/?action=recent");
        check('recent: HTTP 200', $st === 200, "status=$st");
        check_contains('recent: liste une page', $body, 'main');
        check_no_php_error('recent: aucune erreur PHP', $body);

        /* ---- 4. Formulaire d'édition ---- */
        list($st, $loc, $body) = req("$base/?page=main&action=edit");
        check('edit: HTTP 200', $st === 200, "status=$st");
        check_contains('edit: textarea présent', $body, '<textarea');
        check_contains('edit: source pré-remplie', $body, 'MARQUEUR_MAIN');
        check_no_php_error('edit: aucune erreur PHP', $body);

        /* ---- 5. Enregistrement avec bon mot de passe → 302 + fichiers écrits ---- */
        list($st, $loc, $body) = req("$base/?", array(
            'action' => 'save', 'page' => 'nouvelle_page',
            'content' => "Contenu créé par le test **ok**.", 'sc' => 'secret',
            'last_changed' => '9999999999', 'esum' => 'creation test',
        ));
        check('save (bon mdp): redirection 302', $st === 302, "status=$st");
        check_contains('save (bon mdp): Location vers la page', $loc, 'page=nouvelle_page');
        check('save (bon mdp): page écrite dans var/',
            file_exists("$GLOBALS[docroot]/var/pages/nouvelle_page.txt"));
        check('save (bon mdp): historique créé',
            is_dir("$GLOBALS[docroot]/var/history/nouvelle_page"));

        /* ---- 6. Enregistrement avec mauvais mot de passe → pas de redirection ---- */
        list($st, $loc, $body) = req("$base/?", array(
            'action' => 'save', 'page' => 'intrus',
            'content' => "ne doit pas passer", 'sc' => 'mauvais',
            'last_changed' => '9999999999',
        ));
        check('save (mauvais mdp): pas de 302', $st === 200, "status=$st");
        check('save (mauvais mdp): page non écrite',
            !file_exists("$GLOBALS[docroot]/var/pages/intrus.txt"));
        check_no_php_error('save (mauvais mdp): aucune erreur PHP', $body);

        /* ---- 7. Diff entre deux révisions → exerce InlineDiff (ex-écran blanc) ---- */
        list($st, $loc, $body) = req("$base/?action=diff&page=sample&f1=$rev1&f2=$rev2");
        check('diff: HTTP 200', $st === 200, "status=$st");
        check('diff: rendu inline <ins>/<del>',
            strpos($body, '<ins>') !== false || strpos($body, '<del>') !== false,
            'ni <ins> ni <del>');
        check_no_php_error('diff: aucune erreur PHP (InlineDiff)', $body);
    }
} finally {
    /* ---- Nettoyage ---- */
    if (is_resource($proc)) { proc_terminate($proc); proc_close($proc); }
    // Suppression récursive du docroot temporaire.
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($docroot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $f) { $f->isLink() || $f->isFile() ? @unlink($f->getPathname()) : @rmdir($f->getPathname()); }
    @rmdir($docroot);
}

$total = $passed + $failed;
echo "\n{$passed}/{$total} passé(s)";
if ($failed) echo ", {$failed} échoué(s)";
echo "\n";
exit($failed > 0 ? 1 : 0);
