# Steam の実績

Steamworks の「アプリの管理 → Stats & Achievements」で、下の **API 名**のとおりに登録してください（ゲームはこの名前で解除します）。
アイコンは `achievements/<API 名>.png`（解除済み）と `achievements/<API 名>_locked.png`（未解除）、どちらも 256×256 です。

条件はランキングの実際の記録（中央値など）を見て決めています。判定は `js/game.js` の `steamAchieve()` と、ランキング登録の結果のところにあります。

| API 名 | 名前 | Name | 条件 | Description |
|---|---|---|---|---|
| FIRST_FINISH | はじめての完走 | First Finish | どこかの町でゴールする | Finish a race |
| WIN_SOLO | 町の誇り | Pride of the Town | ひとりでのレースで 1 位 | Win a solo race |
| WIN_ONLINE | 天下一のだんじり | Top Danjiri | オンラインのレースで 1 位 | Win an online race |
| NIGHT_RUN | 灯入れ曳行 | Lantern Night | 夜のレースでゴール | Finish a night race |
| ALL_TOWNS | 世界のだんじり | Danjiri World Tour | 5 つの町すべてでゴール | Finish in all five towns |
| LAP_30 | 韋駄天 | Lightning Legs | 1 周の平均タイムが 30 秒を切る | Average under 30 s per lap |
| SPEED_150 | 爆走番長 | Speed Boss | 最高速度 150 km/h | Reach 150 km/h |
| DRIFT_4 | 回し名人 | Drift Master | 1 回のやりまわしを 4 秒続ける | Hold a 4-second drift |
| AIR_2 | 飛翔 | Lift Off | 大ジャンプで 2 秒飛ぶ | Stay airborne for 2 s |
| SMASH_300 | 壊し屋 | Wrecker | 1 レースで 300 個壊す | Smash 300 things in one race |
| SMASH_1000 | 破壊王 | Demolition King | 1 レースで 1000 個壊す | Smash 1,000 things in one race |
| STUCK_1KT | 吸着 | Sticky | ひっつけた量 1,000 トン | Stick 1,000 t to your danjiri |
| STUCK_10KT | 吸着魔王 | Lord of the Haul | ひっつけた量 10,000 トン | Stick 10,000 t to your danjiri |
| TODAY_CUP_1 | 当日杯 1 位 | Today's Champion | どれかの部門で当日杯 1 位 | Take #1 in any Today's Cup category |
| ALL_TIME_RANKED | 歴代に名を刻む | Hall of Fame | どれかの部門で歴代杯 100 位以内 | Make the all-time top 100 in any category |
