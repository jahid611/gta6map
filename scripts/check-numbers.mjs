// Règle typographique : tous les nombres de l'app utilisent `.vi-num`
// (police display + chiffres tabulaires). `font-mono` est proscrit dans src/.
// Lancé avant chaque build (`prebuild`) — échoue si une occurrence apparaît.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const offenders = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx|ts|css)$/.test(entry)) {
      const text = readFileSync(full, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (/\bfont-mono\b/.test(line) && !/check-numbers/.test(line)) offenders.push(`${path.relative(".", full)}:${i + 1}`);
      });
    }
  }
}
walk(ROOT);
if (offenders.length) {
  console.error("✗ `font-mono` interdit — utiliser la classe `vi-num` pour les nombres :\n  " + offenders.join("\n  "));
  process.exit(1);
}
console.log("✓ typographie des nombres : OK (aucun font-mono)");
