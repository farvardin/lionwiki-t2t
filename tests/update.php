<?php
/**
 * Génère (ou régénère) les fichiers HTML de référence dans tests/expected/
 *
 * Usage :
 *   php tests/update.php           # régénérer tous les expected
 *   php tests/update.php basic     # régénérer un seul fixture
 *
 * À lancer :
 *   - une première fois pour initialiser les références
 *   - après un changement de rendu intentionnel pour mettre les références à jour
 */

require_once __DIR__ . '/../txt2tags.class.php';

$filter = $argv[1] ?? null;

foreach (glob(__DIR__ . '/fixtures/*.t2t') as $fixture) {
    $name = basename($fixture, '.t2t');

    if ($filter !== null && $name !== $filter) continue;

    $t2t = new T2T(file_get_contents($fixture));
    $t2t->go();
    $out = __DIR__ . "/expected/{$name}.html";
    file_put_contents($out, $t2t->bodyhtml);
    echo "Généré  : $out\n";
}
