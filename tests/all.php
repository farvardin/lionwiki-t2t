<?php
/**
 * Runner combiné : lance toutes les suites de tests de régression.
 *
 *   php tests/all.php
 *
 * - tests/run.php          : rendu HTML de txt2tags.class.php (fixtures « golden »)
 * - tests/plugins.php      : logique PHP des plugins (compat PHP 8 incluse)
 * - tests/integration.php  : flux de requête complet d'index.php (serveur web)
 *
 * Code de sortie : 0 si toutes les suites passent, 1 sinon.
 */

$php    = PHP_BINARY;
$dir    = __DIR__;
$suites = array(
    'txt2tags (rendu)' => 'run.php',
    'plugins'          => 'plugins.php',
    'intégration'      => 'integration.php',
);

$failed = 0;

foreach ($suites as $label => $script) {
    echo "\n===== $label =====\n";
    passthru(escapeshellarg($php) . ' ' . escapeshellarg("$dir/$script"), $code);
    if ($code !== 0) $failed++;
}

echo "\n=====================\n";
echo $failed === 0 ? "Toutes les suites sont passées.\n" : "$failed suite(s) en échec.\n";

exit($failed === 0 ? 0 : 1);
