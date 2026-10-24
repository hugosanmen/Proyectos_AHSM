// tools/build.mjs — reescribe VERSION y PRECACHE en sw.js y, opcionalmente, arma la carpeta pública.
// Uso:  npm run build                    → solo actualiza sw.js
//       node tools/build.mjs --out public → además copia SOLO los archivos de la app a ./public
//                                           (así Vercel no publica server/, api/, test/ ni tools/)
//
// - PRECACHE: todos los archivos servibles de la app (HTML, CSS, JS, íconos, KaTeX...).
// - VERSION: hash del contenido; si cambia cualquier archivo, cambia la caché y los clientes
//   reciben el aviso «Hay una versión nueva».

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// api/ y server/ son código del servidor: nunca van al precaché ni a la carpeta pública.
const IGNORE_DIRS = new Set(['node_modules', 'test', 'tools', '.git', 'api', 'server', 'public']);
const IGNORE_FILES = new Set(['package.json', 'package-lock.json', 'README.md', '.gitignore', 'vercel.json', 'sw.js']);

export function listAppFiles(dir = ROOT) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!IGNORE_DIRS.has(name) && !name.startsWith('.')) out.push(...listAppFiles(full));
    } else if (!IGNORE_FILES.has(name)) {
      out.push(relative(ROOT, full).split(sep).join('/'));
    }
  }
  return out;
}

/** Calcula versión, lista de precaché y el nuevo contenido de sw.js SIN escribir nada. */
export function computeBuild() {
  const files = listAppFiles();
  const hash = createHash('sha256');
  for (const f of files) {
    hash.update(f).update('\0').update(readFileSync(join(ROOT, f)));
  }
  const version = hash.digest('hex').slice(0, 12);
  const precache = ['./', ...files.map((f) => `./${f}`)];

  let sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  sw = sw.replace(
    /\/\/ <build:version>[\s\S]*?\/\/ <\/build:version>/,
    `// <build:version>\nconst VERSION = '${version}';\n// </build:version>`,
  );
  sw = sw.replace(
    /\/\/ <build:precache>[\s\S]*?\/\/ <\/build:precache>/,
    `// <build:precache>\nconst PRECACHE = ${JSON.stringify(precache, null, 2)};\n// </build:precache>`,
  );
  return { version, precache, sw };
}

export function build({ out, updateSw = true } = {}) {
  const { version, precache, sw } = computeBuild();
  if (updateSw) writeFileSync(join(ROOT, 'sw.js'), sw);

  if (out) {
    const dest = resolve(ROOT, out);
    // Salvaguarda: jamás borrar la raíz del proyecto ni nada fuera de ella.
    if (dest === ROOT.replace(/[\\/]+$/, '') || !dest.startsWith(ROOT)) throw new Error(`--out inválido: ${out}`);
    rmSync(dest, { recursive: true, force: true });
    for (const f of [...listAppFiles(), 'sw.js']) {
      const target = join(dest, f);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(ROOT, f), target);
    }
  }
  return { version, count: precache.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const out = i > -1 ? process.argv[i + 1] : undefined;
  const { version, count } = build({ out });
  console.log(`sw.js actualizado: versión ${version}, ${count} entradas en precaché${out ? `; carpeta pública: ${out}/` : ''}.`);
}
