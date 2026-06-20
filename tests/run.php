<?php
/**
 * Test de régression du rendu HTML de txt2tags.class.php
 *
 * Usage :
 *   php tests/run.php           # lancer tous les tests
 *   php tests/run.php basic     # lancer un seul fixture
 *
 * Codes de sortie : 0 = tout OK, 1 = au moins un échec
 */

require_once __DIR__ . '/../txt2tags.class.php';

$filter   = $argv[1] ?? null;
$fixtures = glob(__DIR__ . '/fixtures/*.t2t');
$passed   = 0;
$failed   = 0;
$missing  = 0;

foreach ($fixtures as $fixture) {
    $name = basename($fixture, '.t2t');

    if ($filter !== null && $name !== $filter) continue;

    $expected_file = __DIR__ . "/expected/{$name}.html";

    // Rendu
    $t2t = new T2T(file_get_contents($fixture));
    $t2t->go();
    $actual = $t2t->bodyhtml;

    // Fixture spéciale : macros aléatoires — on vérifie seulement que ça tourne
    if ($name === 'macros') {
        if (is_string($actual) && strlen($actual) > 0) {
            echo "OK       $name  (aléatoire, rendu non comparé)\n";
            $passed++;
        } else {
            echo "FAIL     $name  (rendu vide ou invalide)\n";
            $failed++;
        }
        continue;
    }

    if (!file_exists($expected_file)) {
        echo "MISSING  $name  (lancez update.php pour générer la référence)\n";
        $missing++;
        continue;
    }

    $expected = file_get_contents($expected_file);

    if ($actual === $expected) {
        echo "OK       $name\n";
        $passed++;
    } else {
        echo "FAIL     $name\n";
        $tmp = tempnam(sys_get_temp_dir(), 't2t_');
        file_put_contents($tmp, $actual);
        passthru("diff --unified " . escapeshellarg($expected_file) . " " . escapeshellarg($tmp));
        unlink($tmp);
        $failed++;
    }
}

$total = $passed + $failed + $missing;
echo "\n{$passed}/{$total} passé(s)";
if ($failed)  echo ", {$failed} échoué(s)";
if ($missing) echo ", {$missing} référence(s) manquante(s)";
echo "\n";

exit(($failed + $missing) > 0 ? 1 : 0);
