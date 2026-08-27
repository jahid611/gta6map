# Polices sous licence

Ce dossier n'est pas versionné, et c'est voulu : `.gitignore` en exclut les
`.woff2`. Un webfont sert le fichier à **chaque visiteur** — le publier, c'est
le redistribuer, et cela relève de la licence, pas d'un `git add`.

Le site demande **Helvetica Now** (Monotype) en premier dans sa pile de polices,
puis retombe sur **Archivo** (OFL) si elle est absente.

## Faces attendues

Le texte, en trois graisses :

- `HelveticaNowText-Regular.woff2` — 400
- `HelveticaNowText-Medium.woff2` — 500
- `HelveticaNowText-Bold.woff2` — 600/700

Les deux graisses lourdes, pour les titres. Sans elles, un titre en 800/900 ne
trouve rien au-delà de Bold : soit il retombe sur Archivo, soit le navigateur
épaissit la Bold lui-même — un faux gras, plus lourd et moins net que la vraie
coupe.

- `HelveticaNowText-ExtraBold.woff2` — 800
- `HelveticaNowText-Black.woff2` — 900

La coupe *Display*, enfin, dessinée pour les grands corps (contreformes plus
serrées, chasse plus étroite). Elle est en tête de la pile des titres, et son
absence les fait simplement retomber sur la coupe Texte ci-dessus :

- `HelveticaNowDisplay-Bold.woff2` — 600/700
- `HelveticaNowDisplay-Black.woff2` — 800/900

## Poser les fichiers

Déposez-les ici sous exactement ces noms. Aucune modification de code n'est
nécessaire : les `@font-face` correspondantes sont déjà déclarées dans
`src/app/globals.css`. Elles essaient d'abord la police installée sur le système
(`local(...)`), puis ces fichiers, et sont simplement ignorées si ni l'un ni
l'autre n'existe — une face introuvable ne bloque rien.

## Les mettre en ligne

Ce qui précède ne vaut qu'en local. Pour que le site déployé les serve, il faut
lever la ligne `/public/fonts/*.woff2` de `.gitignore` — donc décider
sciemment de redistribuer la police, ce que seule une licence *webfont*
autorise. Une licence *desktop* ne la couvre pas.
