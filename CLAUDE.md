# CLAUDE.md — LionWiki-t2t

## Présentation

LionWiki-t2t est un moteur de wiki léger en PHP, sans base de données.
Les pages sont stockées en texte brut (syntaxe txt2tags) dans `var/pages/`.
L'historique des révisions va dans `var/history/`.

## Architecture

```
index.php              — point d'entrée unique (~1000 lignes), toute la logique wiki
txt2tags.class.php     — moteur de rendu txt2tags → HTML
config.php             — surcharge des paramètres par défaut (non requis)
config.t2t             — directives txt2tags globales (incluses dans chaque page)
plugins/wkp_*.php      — plugins (chargés automatiquement depuis plugins/)
templates/*.html       — gabarits HTML avec substitutions {PLACEHOLDER}
lang/*.php             — traductions ($T_* variables)
var/pages/*.txt        — contenu des pages wiki
var/history/<page>/    — révisions .bak + meta.dat
tests/all.php          — runner combiné (run.php + plugins.php + integration.php)
tests/run.php          — tests de rendu txt2tags (fixtures « golden »)
tests/plugins.php      — tests de la logique PHP des plugins (compat PHP 8 incluse)
tests/integration.php  — tests d'intégration d'index.php (serveur web + docroot isolé)
tests/fixtures/*.t2t   — entrées txt2tags
tests/expected/*.html  — sorties HTML de référence
infra/docker/lionwiki/ — Dockerfile + docker-compose pour builder/lancer l'image
infra/kubernetes/      — manifests Kubernetes (Deployment, Service, Ingress, PVC)
```

## Lancer les tests

```bash
php tests/all.php           # toutes les suites (txt2tags + plugins)

php tests/run.php           # rendu txt2tags : tous les fixtures
php tests/run.php basic     # rendu txt2tags : un seul fixture
php tests/update.php        # régénérer les fichiers expected/ (après un changement
                            # de rendu *intentionnel* — toujours relire le diff)

php tests/plugins.php       # logique des plugins : tous les groupes
php tests/plugins.php Tables # logique des plugins : un seul groupe

php tests/integration.php   # flux de requête complet d'index.php
```

`run.php` vérifie le rendu de `txt2tags.class.php` (comparaison aux fichiers
`expected/`). `plugins.php` teste les méthodes « pures » des plugins via des
stubs des fonctions/globales d'`index.php`. `integration.php` lance le serveur
web intégré de PHP sur un docroot temporaire isolé (jamais le vrai `var/`) et
effectue de vraies requêtes HTTP (view, edit, save+redirect, recent, diff…).
Les trois suites échouent si un warning/dépréciation/fatal PHP apparaît — c'est
le garde-fou de compatibilité PHP 7.4 → 8.4 (un écran blanc = test rouge).

Pour ajouter un fixture txt2tags : créer `tests/fixtures/xxx.t2t`, lancer
`php tests/update.php xxx`, **relire** le `expected/xxx.html` généré, puis
`php tests/run.php xxx`.

## Vérifier la syntaxe PHP

```bash
php -l index.php
php -l txt2tags.class.php
php -l plugins/wkp_Upload.php
```

## Conventions de code

- PHP 7.4+ requis, PHP 8.x supporté (avec quelques avertissements)
- Pas de framework, pas de composer — tout est autonome
- Les variables globales sont abondantes (héritage du design original)
- Les plugins implémentent des méthodes nommées comme les hooks : `pluginsLoaded()`, `actionBegin()`, `template()`, `formatEnd()`, etc.
- Les templates utilisent `{PLACEHOLDER}` remplacés par `template_replace()`

## Sécurité

- `$NO_HTML = true` : protège contre XSS en bloquant `{html}…{/html}`
- `clear_path()` : assainit tous les noms de fichiers/pages
- `h()` = `htmlspecialchars()`, toujours utiliser pour afficher du contenu utilisateur
- Mot de passe stocké en SHA1 dans `config.php` — SHA1 est faible, préférer `password_hash()` pour de futures migrations
- `setsafecookie()` : ajoute `httponly` ; pas de flag `secure` ni `samesite`

## Avertissements PHP connus

- `Sass::compile_file()` : warning arginfo sans impact fonctionnel (extension Sass optionnelle)
- Vérifier `isset()` avant d'accéder aux captures optionnelles de regex dans `txt2tags.class.php`

## Ajouter un plugin

Créer `plugins/wkp_MonPlugin.php` avec une classe `MonPlugin`.
Les méthodes publiques correspondent aux hooks appelés par `plugin('hookName')`.
Hooks disponibles : `pluginsLoaded`, `actionBegin`, `writingPage`, `pageWritten`,
`subPagesLoaded`, `formatBegin`, `formatEnd`, `formatFinished`, `template`, `diff`.

## Ajouter une langue

Créer `lang/xx.php` en copiant `lang/en.php` et en traduisant les `$T_*`.

## Modifier un template

Les templates sont des fichiers HTML avec des balises `{PLACEHOLDER}`.
Voir la liste complète des substitutions dans `index.php` autour de `$tpl_subs`.

## Déploiement Kubernetes

Les manifests sont dans `infra/kubernetes/`. Voir `infra/kubernetes/README.md` (EN) ou `README.fr.md` (FR) pour la procédure complète.

**Environnement testé** : microk8s sur Scaleway DEV1-M (Ubuntu), sans StorageClass disponible.

**Fichiers manifests :**
```
lionwiki-pv.yaml                  — PersistentVolume hostPath (/opt/lionwiki-data)
data-persistentvolumeclaim.yaml   — PVC lié au PV ci-dessus
lionwiki-deployment.yaml          — Deployment avec init container
lionwiki-service.yaml             — Service ClusterIP port 80
lionwiki-ingress.yaml             — Ingress nginx avec TLS cert-manager
letsencrypt-clusterissuer.yaml    — ClusterIssuers Let's Encrypt staging + prod
```

**Points critiques :**
- L'ingress controller nginx bare metal doit être patché avec l'IP publique du nœud (`externalIPs`)
- Supprimer `validatingwebhookconfiguration ingress-nginx-admission` sinon le webhook nginx bloque les Ingress temporaires de cert-manager (challenge ACME HTTP-01)
- Tester TLS avec `letsencrypt-staging` avant `letsencrypt-prod` (quota 5 certs/semaine en prod)
- Si l'Order cert-manager reste `pending` : `kubectl delete order --all` pour forcer la recréation

**Persistance** — un seul PVC `lionwiki-data` (500Mi, hostPath) contient :
- `var/`        → pages wiki et historique des révisions
- `config.php`  → configuration locale
- `config.t2t`  → directives txt2tags globales

Un init container copie ces fichiers depuis l'image au premier démarrage si le PVC est vierge.
