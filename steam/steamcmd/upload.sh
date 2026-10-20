#!/bin/sh
# Steam へアップロード:  ./upload.sh <AppID> <Windowsデポ> <Linuxデポ> <Macデポ> <Steamworksのユーザー名>
#   Mac を出さないときは Macデポに - を書く。steamcmd が必要（https://partner.steamgames.com/doc/sdk/uploading）。初回は Steam Guard のコードを聞かれる
set -e
[ $# -eq 5 ] || { echo "使い方: $0 <AppID> <Windowsデポ> <Linuxデポ> <Macデポ または -> <ユーザー名>"; exit 1; }
cd "$(dirname "$0")"
mkdir -p output gen
for f in app_build.vdf depot_win.vdf depot_linux.vdf depot_mac.vdf; do
  sed -e "s/\"APPID\"/\"$1\"/" -e "s/\"WIN_DEPOT\"/\"$2\"/" -e "s/\"LINUX_DEPOT\"/\"$3\"/" -e "s/\"MAC_DEPOT\"/\"$4\"/" -e 's#"\.\./dist/#"../../dist/#' -e 's#"\./output/"#"../output/"#' "$f" > "gen/$f"
done
[ "$4" = "-" ] && sed -i '/depot_mac.vdf/d' gen/app_build.vdf
steamcmd +login "$5" +run_app_build "$(pwd)/gen/app_build.vdf" +quit
