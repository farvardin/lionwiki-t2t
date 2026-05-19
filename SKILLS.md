# SKILLS.md — Référence développeur LionWiki-t2t

Recettes rapides pour les tâches courantes sur ce projet.

## Tests

```bash
# Lancer tous les tests de régression txt2tags
php tests/run.php

# Tester un seul fixture
php tests/run.php tables

# Régénérer les fichiers expected/ après un changement intentionnel
php tests/update.php

# Vérifier la syntaxe PHP des fichiers principaux
php -l index.php && php -l txt2tags.class.php
```

## Créer un nouveau fixture de test

1. Ajouter `tests/fixtures/montest.t2t` avec du contenu txt2tags
2. Lancer `php tests/update.php` pour générer `tests/expected/montest.html`
3. Vérifier le HTML généré, puis committer les deux fichiers

## Créer un plugin

```php
// plugins/wkp_MonPlugin.php
class MonPlugin {
    // appelé après le chargement de tous les plugins
    function pluginsLoaded() {}

    // appelé avant le traitement de l'action courante
    function actionBegin() {}

    // appelé avant d'écrire une page (retourner true bloque l'écriture)
    function writingPage() { return false; }

    // appelé après l'écriture (retourner true empêche la redirection)
    function pageWritten() { return false; }

    // appelé après le rendu txt2tags mais avant le rendu des liens
    function formatBegin() {}

    // appelé après tout le formatage
    function formatEnd() {}

    // appelé après formatEnd, toujours (même hors page)
    function formatFinished() {}

    // pour injecter du HTML dans le template
    function template() {
        global $html;
        // $html contient le template en cours de construction
    }

    // diff personnalisé : stocker le résultat dans $GLOBALS['plugin_ret_diff']
    // retourner true pour court-circuiter le diff interne
    function diff($f1, $f2) { return false; }
}
```

## Substitutions de template

Les templates HTML utilisent `{PLACEHOLDER}`. Principales valeurs :

| Placeholder | Description |
|---|---|
| `{CONTENT}` | Corps de la page rendue |
| `{WIKI_TITLE}` | Titre du wiki |
| `{PAGE_TITLE}` | Titre de la page courante |
| `{MENU}` | Contenu de `menu.php` |
| `{MENU_SIDE}` | Contenu de `menu_side.php` |
| `{MENU_TOP}` | Contenu de `menu_top.php` |
| `{EDIT}` | Lien "Éditer" |
| `{HISTORY}` | Lien "Historique" |
| `{RECENT_CHANGES}` | Lien "Modifications récentes" |
| `{TOC}` | Table des matières |
| `{SEARCH_FORM}…{/SEARCH_FORM}` | Formulaire de recherche |
| `{LAST_CHANGED}` | Date de dernière modification |
| `{HEAD}` | Balises `<head>` supplémentaires |
| `{CONTENT_FORM}…{/CONTENT_FORM}` | Formulaire d'édition |
| `{CONTENT_TEXTAREA}` | Zone de texte d'édition |
| `{CONTENT_SUBMIT}` | Bouton "Enregistrer" |
| `{plugin:NOM}` | Tag réservé à un plugin (supprimé si absent) |

## Syntaxe txt2tags essentielle

```
**gras**          //italique//       --barré--        __souligné__
= Titre 1 =       == Titre 2 ==      === Titre 3 ===
- item liste      + item numéroté
[lien texte|PageWiki]    [texte|http://url]
%%toc             — table des matières
{include:SousPage}
```

## Débogage

Pour activer les erreurs PHP dans `index.php` :

```php
// Décommenter en haut de index.php :
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
```

## Kubernetes — opérations courantes

```bash
# État général
kubectl get pods -l app=lionwiki
kubectl get pvc lionwiki-data
kubectl get ingress lionwiki

# Logs applicatifs
kubectl logs -l app=lionwiki --follow

# Accéder aux données sur le nœud
ls /opt/lionwiki-data/var/pages/

# Redémarrer le pod (sans changer la config)
kubectl rollout restart deployment/lionwiki

# Mettre à jour l'image (imagePullPolicy: Always — tire toujours la dernière depuis Docker Hub)
kubectl rollout restart deployment/lionwiki
kubectl rollout status deployment/lionwiki

# Si l'image est mise en cache sur le nœud et doit être supprimée manuellement
# (microk8s utilise containerd, pas docker) :
microk8s ctr images rm docker.io/farvardin4/lionwiki:latest

# TLS : forcer le renouvellement du certificat
kubectl delete secret lionwiki-tls
kubectl delete certificate lionwiki-tls
kubectl apply -f infra/kubernetes/lionwiki-ingress.yaml
kubectl get certificate lionwiki-tls -w

# Order cert-manager bloquée en pending → forcer la recréation
kubectl delete order --all

# Diagnostics cert-manager
kubectl describe certificate lionwiki-tls
kubectl describe order
kubectl logs -n cert-manager deployment/cert-manager --tail=30
```

## Variables de configuration principales

Définies dans `index.php`, surchargeables dans `config.php` :

| Variable | Défaut | Rôle |
|---|---|---|
| `$WIKI_TITLE` | `'My wiki'` | Titre du site |
| `$PASSWORD` | `''` | Hash SHA1 du mot de passe |
| `$TEMPLATE` | `'templates/minimal.html'` | Template actif |
| `$NO_HTML` | `true` | Bloquer `{html}` (protection XSS) |
| `$START_PAGE` | `'main'` | Page d'accueil |
| `$PROTECTED_READ` | `false` | Mot de passe requis pour lire |
| `$DATE_FORMAT` | `'Y-m-d H:i'` | Format de date PHP |
| `$LOCAL_HOUR` | `0` | Décalage horaire en heures |
| `$LANG` | auto-détecté | Code langue (ex: `'fr'`) |
