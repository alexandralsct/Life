# Life

Messagerie personnelle installable (app web). Le code seulement : l'adresse du serveur et la clé se saisissent sur
l'appareil, dans les Réglages.

## Place prise sur l'appareil

Le stockage du navigateur est commun aux apps du même site. LIFE se borne pour ne jamais priver les autres de place :

| Contenu | Plafond |
|---|---|
| Messages | 300 par fil, 150 000 caractères par fil, 500 000 caractères en tout (environ 1 Mo, soit à peu près 10 % du quota habituel de 5 millions de caractères par site) ; les 5 derniers messages de chaque fil et les envois pas encore partis sont toujours gardés |
| Suppressions et retraits en attente | 1 500 identifiants chacun |
| Réglages | quelques centaines d'octets |

Le serveur garde tout l'historique. Réglages → « Cet appareil » montre la place prise, si la copie est protégée contre
l'effacement automatique (`navigator.storage.persist()`), et le dernier enregistrement raté s'il y en a eu un.

## Tests

`node tests/lancer.mjs` : toute la suite Playwright, pour l'app téléphone puis pour l'app ordinateur
(voir `tests/outils.mjs` pour les variables d'environnement). Elle tourne aussi en CI (`.github/workflows/tests.yml`).
