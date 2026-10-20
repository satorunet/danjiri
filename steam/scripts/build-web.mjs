// サイトのゲーム（../index.html と ../js）を steam/web/ に写し、ネットがなくても起動できるようにする
//   three.js → web/vendor/three/、Google Fonts → web/fonts/（ランキング・オンライン・国旗だけはネットを使う）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STEAM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.resolve(STEAM, '..');
const OUT = path.join(STEAM, 'web');
const THREE = path.join(STEAM, 'node_modules/three');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });

// ゲーム本体（エディタは入れない）
for (const f of fs.readdirSync(path.join(SRC, 'js'))) if (f.endsWith('.js') && f !== 'editor.js') fs.copyFileSync(path.join(SRC, 'js', f), path.join(OUT, 'js', f));
for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));

// three.js（import map で使うものだけ）
const V = path.join(OUT, 'vendor/three');
fs.mkdirSync(path.join(V, 'build'), { recursive: true });
fs.copyFileSync(path.join(THREE, 'build/three.module.js'), path.join(V, 'build/three.module.js'));
for (const d of ['postprocessing', 'shaders', 'utils', 'controls']) fs.cpSync(path.join(THREE, 'examples/jsm', d), path.join(V, 'examples/jsm', d), { recursive: true });

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
html = html.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', './vendor/three/build/three.module.js')
  .replace('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', './vendor/three/examples/jsm/');
if (html.includes('cdn.jsdelivr.net')) throw new Error('three.js の import map を置き換えられませんでした（バージョンが変わった？）');

// Google Fonts をまるごと取ってきて手元の CSS にする
const m = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)" rel="stylesheet">/);
if (!m) throw new Error('Google Fonts の <link> が見つかりません');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
let css = await (await fetch(m[1].replace(/&amp;/g, '&'), { headers: { 'User-Agent': UA } })).text();
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
let n = 0, bytes = 0;
for (let i = 0; i < urls.length; i += 16) {
  await Promise.all(urls.slice(i, i + 16).map(async u => {
    const name = `f${urls.indexOf(u)}${path.extname(new URL(u).pathname) || '.woff2'}`;
    const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
    fs.writeFileSync(path.join(OUT, 'fonts', name), buf); n++; bytes += buf.length;
    css = css.split(u).join(name);
  }));
}
fs.writeFileSync(path.join(OUT, 'fonts/fonts.css'), css);
html = html.replace(m[0], '<link href="fonts/fonts.css" rel="stylesheet">').replace(/<link rel="preconnect"[^>]*>\n?/g, '');

fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log(`web/ を作りました（フォント ${n} 個 ${(bytes / 1048576).toFixed(1)} MB）`);
