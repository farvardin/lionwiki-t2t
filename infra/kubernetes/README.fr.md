# Déploiement LionWiki-t2t sur Kubernetes
# ==========================================
# Testé sur cluster bare microk8s, Scaleway DEV1-M (4 Go RAM, Ubuntu)

# ── Prérequis : installer microk8s ────────────────────────────────────────────

snap install microk8s --classic
microk8s config > ~/.kube/config
alias kubectl=microk8s.kubectl

# k9s : interface graphique pour Kubernetes
# Télécharger sur https://github.com/derailed/k9s/releases

# ── 1. (Optionnel) Builder et pousser l'image Docker ─────────────────────────
#    (sinon l'image publique farvardin4/lionwiki:latest est utilisée)

cd infra/docker/lionwiki
docker build -t monrepo/lionwiki:latest .
docker push monrepo/lionwiki:latest

# ── 2. Installer l'ingress controller nginx (variante bare metal) ─────────────
#    IMPORTANT : sans ingress controller, l'ingress n'a pas d'ADDRESS et le site ne répond pas.

kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.1/deploy/static/provider/baremetal/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=Ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

#    Sur bare metal le service est en NodePort (pas de LoadBalancer).
#    Patcher avec l'IP publique du nœud pour que les ports 80/443 soient accessibles directement :
kubectl get nodes -o wide                                             # noter l'IP (colonne EXTERNAL-IP ou INTERNAL-IP)
kubectl patch svc ingress-nginx-controller -n ingress-nginx \
  --patch '{"spec": {"externalIPs": ["X.X.X.X"]}}'                  # remplacer X.X.X.X

#    Vérifier que l'ingress a bien une ADDRESS :
kubectl get ingress lionwiki                                          # colonne ADDRESS doit afficher l'IP

# ── 3. Désactiver le webhook de validation nginx ──────────────────────────────
#    Le webhook de validation nginx bloque l'Ingress temporaire créé par cert-manager
#    pour le challenge ACME HTTP-01. Le supprimer n'affecte pas le routage.

kubectl delete validatingwebhookconfiguration ingress-nginx-admission

# ── 4. Persistance des données ────────────────────────────────────────────────
#    Pas de StorageClass sur un cluster bare : on utilise un PV hostPath
#    qui stocke les données dans /opt/lionwiki-data sur le nœud.
#    Données persistées : var/ (pages + historique), config.php, config.t2t

kubectl apply -f lionwiki-pv.yaml
kubectl apply -f data-persistentvolumeclaim.yaml
kubectl get pvc lionwiki-data                                         # doit afficher Bound avant de continuer

# ── 5. Déployer l'application ─────────────────────────────────────────────────
#    Éditer lionwiki-ingress.yaml : remplacer yourdomain.org par le vrai domaine avant d'appliquer.

kubectl apply -f lionwiki-deployment.yaml
kubectl apply -f lionwiki-service.yaml
kubectl apply -f lionwiki-ingress.yaml

#    Vérifier :
kubectl get pods -l app=lionwiki
kubectl logs -l app=lionwiki --follow

# ── 6. TLS avec cert-manager ──────────────────────────────────────────────────

#    a) Installer cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --namespace cert-manager --for=condition=Ready pod --all --timeout=120s

#    b) Créer les ClusterIssuers Let's Encrypt staging et prod
kubectl apply -f letsencrypt-clusterissuer.yaml

#    c) Tester d'abord avec le staging (pas de limite de quota, cert non reconnu par les navigateurs)
#       Dans lionwiki-ingress.yaml, mettre : cert-manager.io/cluster-issuer: letsencrypt-staging
#       Le DNS du domaine doit pointer vers l'IP du cluster avant cette étape.
kubectl apply -f lionwiki-ingress.yaml
kubectl get certificate lionwiki-tls -w                               # attendre Ready: True

#    d) Passer en production
#       Dans lionwiki-ingress.yaml, remettre : cert-manager.io/cluster-issuer: letsencrypt-prod
#       Supprimer l'ancien secret staging pour forcer la réémission :
kubectl delete secret lionwiki-tls
kubectl delete certificate lionwiki-tls
kubectl apply -f lionwiki-ingress.yaml
kubectl get certificate lionwiki-tls -w                               # attendre Ready: True
#       Note : "waiting for ACME server to update the status of the order" est normal —
#       cela signifie que le challenge HTTP-01 a réussi, Let's Encrypt finalise la signature.

#    e) Si l'Order reste bloquée en "pending" sans créer de Challenge object :
#       Supprimer l'Order pour forcer cert-manager à repartir de zéro :
kubectl delete order --all
kubectl get certificate lionwiki-tls -w

#    f) Diagnostics cert-manager :
kubectl describe certificate lionwiki-tls
kubectl get order && kubectl describe order
kubectl get certificaterequest
kubectl describe challenge
kubectl logs -n cert-manager deployment/cert-manager --tail=30

# ── Mettre à jour l'image ────────────────────────────────────────────────────
#    imagePullPolicy: Always — chaque redémarrage tire la dernière image depuis Docker Hub.

kubectl rollout restart deployment/lionwiki
kubectl rollout status deployment/lionwiki

#    Si l'image est bloquée dans le cache du nœud (message "already present on machine") :
#    microk8s utilise containerd, pas docker — utiliser microk8s ctr :
microk8s ctr images rm docker.io/farvardin4/lionwiki:latest
kubectl rollout restart deployment/lionwiki

# ── Données ───────────────────────────────────────────────────────────────────
#    Les fichiers wiki se trouvent dans /opt/lionwiki-data sur le nœud :
#      /opt/lionwiki-data/var/pages/     — pages wiki
#      /opt/lionwiki-data/var/history/   — historique des révisions
#      /opt/lionwiki-data/config.php     — configuration
#      /opt/lionwiki-data/config.t2t     — directives txt2tags

# ── Nettoyage ─────────────────────────────────────────────────────────────────
kubectl delete -f lionwiki-ingress.yaml -f lionwiki-service.yaml -f lionwiki-deployment.yaml
kubectl delete -f data-persistentvolumeclaim.yaml -f lionwiki-pv.yaml
#    /opt/lionwiki-data reste sur le nœud (reclaimPolicy: Retain)
#    Supprimer manuellement si besoin : rm -rf /opt/lionwiki-data
