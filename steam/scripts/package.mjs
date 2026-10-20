// Windows / Linux（Steam Deck）/ macOS 向けに書き出す → dist/Danjiri Dash-<platform>-x64/
//   node scripts/package.mjs [win32|linux|darwin ...]   （何も付けなければ全部）
import { packager } from '@electron/packager';
import * as ResEdit from 'resedit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STEAM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platforms = process.argv.slice(2).length ? process.argv.slice(2) : ['win32', 'linux', 'darwin'];
const VERSION = JSON.parse(fs.readFileSync(path.join(STEAM, 'package.json'), 'utf8')).version;

const base = {
  dir: STEAM,
  out: path.join(STEAM, 'dist'),
  name: 'Danjiri Dash',
  executableName: 'DanjiriDash',
  arch: 'x64',   // Mac も x64（Apple シリコンでは Rosetta で動く）
  overwrite: true,
  asar: { unpack: '**/node_modules/steamworks.js/**' },   // Steam の .dll/.so/.dylib は asar の外に置く
  ignore: [/^\/dist($|\/)/, /^\/steamcmd($|\/)/, /^\/scripts($|\/)/, /^\/achievements($|\/)/, /\.md$/, /^\/steam_appid\.txt$/, /^\/icon\.(ico|icns)$/],
  appCopyright: '© 2026 satoru.net',
  appBundleId: 'net.satoru.danjiri',
  appCategoryType: 'public.app-category.racing-games',
};

const out = [];
for (const platform of platforms) {
  // Mac は .icns を packager に渡す。Windows の .exe は rcedit（wine が要る）を使わず、あとで resedit で書き換える
  const [d] = await packager({ ...base, platform, ...(platform === 'darwin' ? { icon: path.join(STEAM, 'icon.icns') } : {}) });
  out.push(d);
  if (platform === 'win32') setExeIcon(path.join(d, 'DanjiriDash.exe'));
  // Chromium の言語ファイルは日本語と英語だけ残す（約 45 MB 減る）。Mac は .lproj が別の場所なのでそのまま
  const loc = path.join(d, 'locales');
  if (fs.existsSync(loc)) for (const f of fs.readdirSync(loc)) if (!/^(ja|en-US)\.pak$/.test(f)) fs.rmSync(path.join(loc, f));
}
console.log(out.join('\n'));

// Windows の .exe にアイコンとバージョン情報を入れる
function setExeIcon(exe) {
  const pe = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(pe);
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(STEAM, 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map(i => i.data));
  const [vi] = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  if (vi) {
    const [a, b, c] = VERSION.split('.').map(Number);
    vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
    vi.setStringValues({ lang: 1033, codepage: 1200 }, { CompanyName: 'satoru.net', ProductName: 'Danjiri Dash', FileDescription: 'Danjiri Dash', OriginalFilename: 'DanjiriDash.exe', LegalCopyright: '© 2026 satoru.net' });
    vi.outputToResourceEntries(res.entries);
  }
  res.outputResource(pe);
  fs.writeFileSync(exe, Buffer.from(pe.generate()));
}
