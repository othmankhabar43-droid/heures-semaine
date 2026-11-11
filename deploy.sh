#!/usr/bin/env bash
# Publie l'app sur GitHub Pages (compte gh déjà connecté sur la box). À lancer SEULEMENT après le OK de l'utilisateur.
set -euo pipefail
cd "$(dirname "$0")"
OWNER=othmankhabar43-droid; REPO=heures-semaine
git add -A && git commit -qm "Mise à jour" || true
if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" --public --source . --remote origin --push --description "Mes heures - PWA"
  gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null
else
  git push -q origin main
fi
URL="https://$OWNER.github.io/$REPO/"
echo "Attente du déploiement Pages…"
for i in $(seq 1 40); do c=$(curl -s -o /dev/null -w "%{http_code}" "$URL"); [ "$c" = 200 ] && break; sleep 10; done
for p in "" manifest.json icons/apple-touch-icon.png icons/icon-512.png sw.js vendor/jspdf.umd.min.js; do curl -s -o /dev/null -w "%{http_code} %{content_type} $p\n" "$URL$p"; done
echo "$URL"
