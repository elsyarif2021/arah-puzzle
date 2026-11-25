import {readFile, writeFile, mkdir} from 'node:fs/promises';

const types = {
  html:'text/html; charset=utf-8', css:'text/css; charset=utf-8',
  mjs:'text/javascript; charset=utf-8', js:'text/javascript; charset=utf-8',
  webmanifest:'application/manifest+json', png:'image/png', mp3:'audio/mpeg', zip:'application/zip'
};
const names = ['index.html','app.mjs','leaderboard.mjs','profile.mjs','certificate.mjs','puzzle.mjs','quiz.mjs','style.css','sw.js',
  'manifest.webmanifest','icon-192.png','icon-512.png','benar.mp3','salah.mp3','mentok.mp3','melesat.mp3'];
const assets = {};
for (const name of names) {
  const bytes = await readFile(name);
  assets['/' + name] = [types[name.split('.').at(-1)], bytes.toString('base64')];
}
try {
  assets['/arah-pwa.zip'] = [types.zip, (await readFile('arah-pwa.zip')).toString('base64')];
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
assets['/'] = assets['/index.html'];
const moduleSource = await readFile('worker/index.mjs','utf8');
const dependencies = await Promise.all(['puzzle.mjs','quiz.mjs','profile.mjs'].map(path=>readFile(path,'utf8')));
await mkdir('dist/server',{recursive:true});
await writeFile('dist/server/index.js', [
  ...dependencies, moduleSource.replace(/^import .*;\n/gm,''),
  'export default createWorker(' + JSON.stringify(assets) + ');'
].join('\n'));
