# Polices sous licence

Ce dossier est vide par défaut, et c'est voulu.

Le site demande **Helvetica Now** (Monotype) en premier dans sa pile de polices,
puis retombe sur **Archivo** (OFL) si elle est absente. Helvetica Now est une
police commerciale : ses fichiers ne peuvent pas être versionnés ici, puisqu'un
webfont les distribue à chaque visiteur.

## Pour l'activer

Si vous détenez une licence webfont Monotype, déposez les fichiers ici sous
exactement ces noms :

- `HelveticaNowText-Regular.woff2`
- `HelveticaNowText-Medium.woff2`
- `HelveticaNowText-Bold.woff2`
- `HelveticaNowDisplay-Bold.woff2`
- `HelveticaNowDisplay-Black.woff2`

Aucune modification de code n'est nécessaire : les `@font-face` correspondantes
sont déjà déclarées dans `src/app/globals.css`. Elles essaient d'abord la police
installée sur le système (`local(...)`), puis ces fichiers, et sont simplement
ignorées si ni l'un ni l'autre n'existe.
