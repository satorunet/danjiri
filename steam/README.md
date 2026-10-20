# だんじり疾走 Steam 版

サイトのゲーム（`../index.html` と `../js/`）を Electron に入れて、Windows・Linux（Steam Deck）・macOS 向けに書き出します。
オンラインレースとランキングは、本番の `wss://danjiri.satoru.net/ws` にそのままつながります（ブラウザ版の人とも一緒に走れます）。

## 作り方

```sh
cd steam
npm install
npm start          # web/ を作って、この PC でウィンドウを開いて試す
npm run dist       # web/ を作り直して dist/ に Windows・Linux・Mac 版を書き出す
```

- `scripts/build-web.mjs` … ゲームを `web/` に写し、three.js と Google Fonts を同梱してネットなしでも起動できるようにする
- `scripts/package.mjs` … `dist/Danjiri Dash-{win32,linux,darwin}-x64/` を作る。Windows の .exe にはアイコン（`icon.ico`）とバージョンを入れる
- `main.cjs` … ゲームを `app://danjiri/` で開く。全画面で起動（F11 / Alt+Enter で切り替え）、外のリンクはブラウザで開く
- ゲームの側は `location.protocol === 'app:'` で Steam 版かどうかを見ています（接続先・シェアの URL・タイトルの「終了」ボタン）

サイトのゲームを直したら、Steam 版も `npm run dist` で作り直してアップロードし直してください。

## Steamworks（Steam の機能）

`steamworks.js` を使っています。Steam から起動したとき、または `steam/steam_appid.txt` に App ID を書いたときだけつながります（オーバーレイと実績）。
App ID がないときは、Steam の機能なしでそのまま動きます。

**実績** は 15 個。一覧・条件・英語名は [achievements.md](achievements.md)、アイコンは `achievements/`（256×256、解除前の灰色版つき）。
Steamworks に同じ API 名で登録して「公開」すると解除されるようになります。

## Steam に出すまでの手順

1. **Steamworks に登録** … https://partner.steamgames.com/ （Steam Direct の登録料 100 米ドル。税と銀行口座の情報、本人確認が必要）
2. **App ID をもらう** … 登録料を払うと App ID が 1 つ発行される。デポを 3 つ作る（Windows 用・Linux 用・Mac 用）
3. **ストアページ** … 説明文（日本語・英語）、スクリーンショット 5 枚以上、トレーラー（あれば）、カプセル画像：
   - ヘッダー 920×430、小カプセル 462×174、メインカプセル 1232×706、縦カプセル 748×896
   - ライブラリ用：カプセル 600×900、ヒーロー 3840×1240、ロゴ 1280×720（透過 PNG）、ライブラリヘッダー 920×430
   - アイコン：`icon.png`（512×512）を元に作れる
4. **年齢区分のアンケート**と**価格**を Steamworks で入力
5. **ビルドをアップロード**
   ```sh
   npm run dist
   ./steamcmd/upload.sh <AppID> <Windowsデポ> <Linuxデポ> <Macデポ または -> <Steamworksのユーザー名>
   ```
   Steamworks の「インストール → 一般」で起動オプションを設定：
   - Windows：`DanjiriDash.exe`
   - Linux：`DanjiriDash`（引数に `--no-sandbox` が要る環境もある）
   - macOS：`Danjiri Dash.app`
6. **審査に出す** … ストアページとビルドをそれぞれ審査に出す（数日かかる）。ストアページは「近日登場」として 2 週間以上公開しておく決まりがある

## macOS 版について

- Linux で作っているので **署名なし・Intel（x64）向け**。Apple シリコンの Mac でも Rosetta で動く
- Steam から入れた場合は普通は起動できるが、ちゃんと出すなら Mac で Apple の開発者署名と公証（Developer ID、年 99 米ドル）をし、Apple シリコン用（arm64）も作るのが望ましい
- Mac を出さないなら、upload.sh の Mac デポに `-` を書けば Windows・Linux だけになる
