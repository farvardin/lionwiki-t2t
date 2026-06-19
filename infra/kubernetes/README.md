# LionWiki-t2t — Kubernetes Deployment
# ======================================
# Tested on bare microk8s cluster, Scaleway DEV1-M (4 GB RAM, Ubuntu, disk minimum 15 Gb)

## Prerequisites: install microk8s

```bash
snap install microk8s --classic
microk8s config > ~/.kube/config
alias kubectl=microk8s.kubectl
```

k9s — graphical interface for Kubernetes: download from https://github.com/derailed/k9s/releases

---

## 1. (Optional) Build and push the Docker image

Skip this step to use the public image `farvardin4/lionwiki:latest`.

```bash
cd infra/docker/lionwiki
docker build -t myrepo/lionwiki:latest .
docker push myrepo/lionwiki:latest
```

---

## 2. Install the nginx ingress controller (bare metal variant)

**Without an ingress controller, the Ingress has no ADDRESS and the site does not respond.**

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.1/deploy/static/provider/baremetal/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=Ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

On bare metal, the service uses NodePort (no LoadBalancer). Patch it with the node's public IP so ports 80/443 are directly accessible:

```bash
kubectl get nodes -o wide   # note the public IP (EXTERNAL-IP or INTERNAL-IP column)
kubectl patch svc ingress-nginx-controller -n ingress-nginx \
  --patch '{"spec": {"externalIPs": ["X.X.X.X"]}}'   # replace X.X.X.X
```

Verify the ingress has an ADDRESS:

```bash
kubectl get ingress lionwiki   # ADDRESS column should show the IP
```

---

## 3. Disable the nginx validation webhook

The nginx validation webhook blocks the temporary Ingress that cert-manager creates for the ACME HTTP-01 challenge. Removing it does not affect routing.

```bash
kubectl delete validatingwebhookconfiguration ingress-nginx-admission
```

---

## 4. Data persistence

No StorageClass is available on a bare cluster. A `hostPath` PersistentVolume stores data in `/opt/lionwiki-data` on the node.

Persisted data:
- `var/` — wiki pages and revision history
- `config.php` — local configuration
- `config.t2t` — global txt2tags directives

```bash
kubectl apply -f lionwiki-pv.yaml
kubectl apply -f data-persistentvolumeclaim.yaml
kubectl get pvc lionwiki-data   # must show Bound before continuing
```

---

## 5. Deploy the application

Edit `lionwiki-ingress.yaml`: replace `yourdomain.org` with your actual domain before applying.

```bash
kubectl apply -f lionwiki-deployment.yaml
kubectl apply -f lionwiki-service.yaml
kubectl apply -f lionwiki-ingress.yaml
```

Verify:

```bash
kubectl get pods -l app=lionwiki
kubectl logs -l app=lionwiki --follow
```

---

## 6. TLS with cert-manager

### a) Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --namespace cert-manager --for=condition=Ready pod --all --timeout=120s
```

### b) Create Let's Encrypt ClusterIssuers

```bash
kubectl apply -f letsencrypt-clusterissuer.yaml
```

### c) Test with staging first

No rate limits. The certificate will not be trusted by browsers — this is expected.

In `lionwiki-ingress.yaml`, set:
```yaml
cert-manager.io/cluster-issuer: letsencrypt-staging
```

The domain's DNS must point to the cluster IP before this step.

```bash
kubectl apply -f lionwiki-ingress.yaml
kubectl get certificate lionwiki-tls -w   # wait for Ready: True
```

### d) Switch to production

In `lionwiki-ingress.yaml`, set:
```yaml
cert-manager.io/cluster-issuer: letsencrypt-prod
```

Delete the staging secret to force re-issuance:

```bash
kubectl delete secret lionwiki-tls
kubectl delete certificate lionwiki-tls
kubectl apply -f lionwiki-ingress.yaml
kubectl get certificate lionwiki-tls -w   # wait for Ready: True
```

> **Note:** The message `"waiting for ACME server to update the status of the order"` is normal — it means the HTTP-01 challenge succeeded and Let's Encrypt is finalizing the signature.

### e) If the Order stays stuck in "pending"

cert-manager may not create a Challenge object. Delete the Order to force a retry:

```bash
kubectl delete order --all
kubectl get certificate lionwiki-tls -w
```

### f) cert-manager diagnostics

```bash
kubectl describe certificate lionwiki-tls
kubectl get order && kubectl describe order
kubectl get certificaterequest
kubectl describe challenge
kubectl logs -n cert-manager deployment/cert-manager --tail=30
```

---

## Data location on the node

```
/opt/lionwiki-data/var/pages/     — wiki pages
/opt/lionwiki-data/var/history/   — revision history
/opt/lionwiki-data/config.php     — configuration
/opt/lionwiki-data/config.t2t     — txt2tags directives
```

---

## Updating the image

`imagePullPolicy: Always` is set on all containers, so every pod restart pulls the latest image from Docker Hub automatically:

```bash
kubectl rollout restart deployment/lionwiki
kubectl rollout status deployment/lionwiki
```

If the image is stuck in the node's local cache (e.g. `already present on machine`), remove it manually — microk8s uses containerd, not docker:

```bash
microk8s ctr images rm docker.io/farvardin4/lionwiki:latest
kubectl rollout restart deployment/lionwiki
```

---

## Troubleshooting: DiskPressure / Evicted pods

Pods showing `Evicted` status are caused by the node's kubelet evicting workloads under resource pressure. The most common cause on a small instance is **inode exhaustion** — disk space may appear free but inodes run out due to the large number of small files created by containerd.

Diagnose:

```bash
df -i                         # check inode usage — look for IUse% near 100%
df -h                         # check disk space
kubectl describe node | grep -A8 Conditions   # look for DiskPressure: True
```

Clean up evicted pods and unused images:

```bash
# Remove evicted / failed pods
kubectl get pods -A | grep -E 'Evicted|Completed|Error' | awk '{print $1, $2}' | while read ns pod; do kubectl delete pod "$pod" -n "$ns"; done

# Remove unused containerd images
microk8s ctr images prune --all

# Trim system logs
journalctl --vacuum-size=100M

# Verify after cleanup
df -i && df -h
kubectl describe node | grep DiskPressure
```

> **Recommendation:** Use a minimum 15 GB disk. microk8s images alone occupy 5–6 GB.

---

## Cleanup

```bash
kubectl delete -f lionwiki-ingress.yaml -f lionwiki-service.yaml -f lionwiki-deployment.yaml
kubectl delete -f data-persistentvolumeclaim.yaml -f lionwiki-pv.yaml
# /opt/lionwiki-data is kept on the node (reclaimPolicy: Retain)
# Remove manually if needed: rm -rf /opt/lionwiki-data
```
