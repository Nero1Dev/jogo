// Copia os arquivos do site (raiz do repo) pra www/, que é o que o Capacitor empacota no app.
// Roda antes de cada `npx cap sync` — assim dá pra puxar mudanças da branch main sem duplicar
// manualmente. Não mexe em nada fora de www/, então o conteúdo que sobe pro GitHub Pages
// (raiz do repo, branch main) fica intocado.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const wwwDir = path.join(root, 'www');
const patterns = [/\.html$/, /\.js$/, /\.css$/, /\.svg$/];
const exclude = new Set(['sync-web.js']);

fs.mkdirSync(wwwDir, { recursive: true });

const files = fs.readdirSync(root, { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name)
  .filter(name => !exclude.has(name) && patterns.some(re => re.test(name)));

for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(wwwDir, name));
}

console.log(`Copiados ${files.length} arquivos pra www/`);
