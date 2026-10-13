# Pour Claude : dépôt PUBLIC, code seulement

LIFE est la messagerie personnelle (app web installable, servie par GitHub Pages).
Ce dépôt est public : il ne contient que le code (index.html, sw.js, manifest, icônes, garde-fou).

Interdit ici, même temporairement : adresse du serveur (elle se saisit dans les Réglages, sur l'appareil), clé, jeton,
prénom ou nom, comptes, lieux, captures d'écran, données de santé, de famille, d'argent ou de vie amoureuse, noms
d'espaces personnels. La source de travail est dans le dépôt privé du système (app-life/) ; la version publiée ici
est sa copie neutre. Avant chaque commit : `MOTS_FICHIER=<liste privée> bash tests/garde-fou.sh`.

## Deux apps : l'app téléphone et l'app ordinateur
LIFE existe en deux versions pensées séparément, comme deux produits : l'**app téléphone** (une colonne, fils en rangée)
et l'**app ordinateur** (≥ 900 px à la souris : fils en liste à gauche, conversation à droite). Une modification vaut pour
l'app où elle est demandée ; rien n'est reporté de l'une sur l'autre sans le décider. Tests et captures : les deux, séparément.

## Numéro de version
Un chiffre par position : V.0.0.3.7, puis V.0.0.3.8, V.0.0.3.9, V.0.0.4.0… (`VERSION` dans app.js et `CACHE` dans sw.js, ensemble).
