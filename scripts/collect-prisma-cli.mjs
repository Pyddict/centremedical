/**
 * Prépare un node_modules minimal contenant le CLI Prisma et ses dépendances.
 *
 * L'image Docker finale utilise la sortie « standalone » de Next.js, qui
 * n'embarque que les dépendances utilisées par l'application — le CLI Prisma
 * n'en fait pas partie alors qu'il est nécessaire au démarrage pour appliquer
 * les migrations (`prisma migrate deploy`).
 *
 * Copier l'intégralité de node_modules ferait passer l'image de ~450 Mo à plus
 * de 1,5 Go. Ce script calcule donc la fermeture transitive des dépendances du
 * CLI et ne copie que celles-ci (~150 Mo), sans liste codée en dur qui se
 * périmerait à la prochaine mise à jour de Prisma.
 *
 * Usage : node scripts/collect-prisma-cli.mjs <node_modules source> <destination>
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) {
  console.error("Usage : node scripts/collect-prisma-cli.mjs <source> <destination>");
  process.exit(1);
}

/** Parcours en profondeur des dépendances, en partant du paquet `prisma`. */
function resolveClosure(root, entryPoints) {
  const collected = new Set();
  const pending = [...entryPoints];

  while (pending.length > 0) {
    const name = pending.pop();
    if (collected.has(name)) continue;

    const manifestPath = path.join(root, name, "package.json");
    if (!existsSync(manifestPath)) continue; // dépendance optionnelle absente

    collected.add(name);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!collected.has(dependency)) pending.push(dependency);
    }
  }

  return [...collected].sort();
}

const modules = resolveClosure(source, ["prisma"]);
if (!modules.includes("prisma")) {
  console.error(`Le paquet « prisma » est introuvable dans ${source}.`);
  process.exit(1);
}

mkdirSync(destination, { recursive: true });
for (const name of modules) {
  cpSync(path.join(source, name), path.join(destination, name), {
    recursive: true,
    dereference: true,
  });
}

console.log(`CLI Prisma : ${modules.length} modules copiés vers ${destination}`);
