tests/
    fixtures/    11 fichiers .t2t  (basic, titles, lists, tables, links,
                                    verbatim, toc, blockquote, hrule,
                                    escaping, macros)
    expected/    (vide — à remplir avec update.php)
    run.php      script de test
    update.php   script de génération des références

  Workflow en 3 commandes :

  # 1. Initialiser les références (une seule fois)
  php tests/update.php

  # 2. Tester à chaque modification du moteur
  php tests/run.php

  # 3. Si un changement de rendu est intentionnel, mettre à jour
  php tests/update.php basic      # un seul fixture
  php tests/update.php            # tous

  Note sur macros.t2t : ce fixture contient %%rand (valeurs aléatoires), il est donc exclu de la comparaison
   — run.php vérifie seulement que le rendu n'est pas vide.