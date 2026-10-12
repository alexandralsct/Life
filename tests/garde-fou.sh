#!/usr/bin/env bash
# Garde-fou du dépôt public : seulement du code. Utilisé par le contrôle GitHub (garde-fou.yml) et par le hook local .githooks/pre-commit.
#   tests/garde-fou.sh               contenu indexé (fichiers suivis / prêts à être commités)
#   tests/garde-fou.sh --historique  tout l'historique (git log -p), commits et messages
# Liste des mots privés : variable MOTS (mots séparés par |) ou fichier MOTS_FICHIER (un mot par ligne, # pour un commentaire).
# Sans liste, le contrôle échoue : il ne passe jamais « en silence ». Seuls les fichiers ou commits fautifs sont nommés, jamais les mots.
# HISTO_CONNUS : commits déjà signalés (empreintes séparées par des espaces), antérieurs au garde-fou ; l'historique public
# ne se réécrit qu'avec l'accord de la propriétaire.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1
MOTS=${MOTS:-}
if [ -z "$MOTS" ] && [ -n "${MOTS_FICHIER:-}" ] && [ -f "$MOTS_FICHIER" ]; then
  MOTS=$(grep -v '^\s*#' "$MOTS_FICHIER" | sed '/^\s*$/d' | paste -sd'|')
fi
if [ -z "$MOTS" ]; then echo "::error::Liste des mots privés absente (secret MOTS_INTERDITS, ou MOTS_FICHIER en local) : contrôle impossible."; exit 1; fi
OK=${GF_OK:-'^(\.nojekyll|\.github/workflows/[^/]+\.yml|CLAUDE\.md|README\.md|index\.html|sw\.js|manifest\.webmanifest|icon\.svg|icon-(192|512)\.png|qr\.js|tests/[^/]+\.sh)$'}
SECRETS='sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|gh[ousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY'
EMAIL='[A-Z0-9._%+-]+@[A-Z0-9.-]+\.(fr|com|net|org|archi|io)\b'
ko=0; err(){ echo "::error::$1"; ko=1; }

if [ "${1:-}" = "--historique" ]; then
  connus=" ${HISTO_CONNUS:-} "
  # lignes ajoutées de chaque commit, étiquetées « commit fichier » ; on n'affiche que l'étiquette
  git log -p --all --no-color --format='@@commit %H' | awk '/^@@commit /{c=$2; next} /^\+\+\+ /{f=substr($0,7); next} /^\+/{print c" "f"\t"substr($0,2)}' > /tmp/gf-hist.$$
  git log --all --format='%H message%x09%s %b%x00' | tr '\n' ' ' | tr '\0' '\n' >> /tmp/gf-hist.$$
  for quoi in secrets mots; do
    if [ $quoi = secrets ]; then motif=$SECRETS; opt=-E; else motif=$MOTS; opt=-iwE; fi
    trouve=$(grep $opt -- "$motif" /tmp/gf-hist.$$ | cut -f1 | sort -u | while read -r c f; do case "$connus" in *" ${c:0:7}"*) ;; *) echo "$c $f";; esac; done)
    if [ -n "$trouve" ]; then err "Historique : $quoi trouvé(s) dans :"; echo "$trouve"; fi
  done
  rm -f /tmp/gf-hist.$$
  [ $ko = 0 ] && echo "Historique : rien à signaler."; exit $ko
fi

interdits=$(git ls-files | grep -Ev "$OK" || true)
[ -n "$interdits" ] && { err "Fichiers non autorisés dans le dépôt public :"; echo "$interdits"; }
s=$(git grep --cached -lIE -- "$SECRETS" || true)
[ -n "$s" ] && { err "Un secret (clé, jeton) semble présent dans :"; echo "$s"; }
e=$(git grep --cached -nIiE -- "$EMAIL" | grep -viE 'noreply|example\.|exemple\.' | cut -d: -f1,2 || true)
[ -n "$e" ] && { err "Adresse e-mail trouvée :"; echo "$e"; }
m=$(git grep --cached -lIiwE -- "$MOTS" || true)
[ -n "$m" ] && { err "Mot privé trouvé dans :"; echo "$m"; }
[ $ko = 0 ] && echo "Garde-fou : rien à signaler."
exit $ko
