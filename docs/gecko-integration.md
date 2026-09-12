# ヤモリGLB・骨格アニメーション（2026-09-12）

> 2026-09-12 追加調整：第2章の生成倍率は1.2（従来.4の3倍）。大きな個体の旋回時に遊脚の着地点を到達可能な壁面上へ補正。APIの既定倍率.4とモデル座標は維持。最新の根拠・検証は [第2章サイズ調整](chapter2-gecko-scale.md)。
ガクチョが3方向PNGを承認し、ゲームへの差し替えと骨格を意識した動きを依頼したため実装。

## ファイルと接続境界

- 承認済み造形: `assets/gecko-source/preview/gecko_review.blend`（変更しない）
- ベイク済みゲーム素材: `assets/gecko-source/game/gecko_game.blend`
- 配布: `public/models/gecko.glb`。1 skinned mesh / 1 material / 68 bones / 36,603 triangles / 2K色・法線テクスチャ / 約6.9MB。
- 読み込みとアニメ: `src/gecko.ts`
- 本編: `src/chapter2.ts` のimport、非同期ロード、生成、render呼出し、開発用snapshotに限定して変更。ヤモリの探知・予告時間・突進速度・接触判定・生存数ルールは変更していない。

Claudeの難易度調整と並行するため、接続前にMAPの占有と対象ファイル差分を確認し、短い接続作業を記録して解放。後続調整ではシミュレーションの値をそのまま渡す。

```ts
await loadGecko(); // 既存の Promise.all に追加済み
const gecko=createGecko(); // AI暫定スケール .4
scene.add(gecko);
animateGecko(gecko,now/1000,{
  x:geckoAttack.x,y:-geckoAttack.y,z:-.095,
  heading:Math.atan2(-(geckoAttack.ty-geckoAttack.y),geckoAttack.tx-geckoAttack.x),
  mode:geckoWarning>0?'warning':geckoAttack.strike>0?'strike':
    Math.hypot(geckoAttack.x-grid.lair.x,geckoAttack.y-grid.lair.y)>.05?'return':'idle',
  warning:geckoWarning
});
```

`warning`は接続互換用の任意値（現在はmodeから滑らかに構えへ移行）。`animateGecko`がposition/rotation/scaleを管理する。旧来の全身拡大縮小や外側のrotation設定を重ねない。`geckoDebug`は検査用の状態を返す。ロード失敗時はPromiseをrejectし、再試行可能。`disposeGecko`は個体専用Skeletonと材質を解放する。

## 座標・独立性

Blenderは+X前方/+Z背中。glTFのY-up変換後は+X前方/+Y背中なので、読み込み層でX軸90度回転して壁面の+Z背中に戻す。幼齢モデルの-Z前方変換とは異なる。

外側の原点XYは吻先（元造形x=3.12）。皮膚の静止最低zを差し引いて接地基準にする。現行壁板の上面z=-.1に対し、本編ではz=-.095（.005の描画余裕、AI暫定）を渡す。従来のz=.72では浮いて見えるため使用しない。

複製は`SkeletonUtils.clone`、Skeletonと材質は個体ごとに独立。読み込み済みのジオメトリとテクスチャは読み取り専用で共有する。

## 動作

- 静止: 距離カウンターを進めず、足の壁上の位置を保持。胴体の小さな呼吸と尾先の小さな動き。
- 予告: 全身スケールを変えず、骨盤・胴体を低くし、首と頭を段階的に向ける。胴体と尾には回頭の遅れを付け、足を置き直す。既存予告時間の判定はシミュレーション側。
- 移動: 頭の実際の移動履歴を脊柱・骨盤・尾がたどる。時間だけで脚を空回りさせない。頭から尾まで同時に回転する板状の動きを避ける。
- 四肢: 左前/右後と右前/左後を位相違いで踏み替える。接地足はワールド座標に固定。二節IKで上腕・前腕、大腿・下腿を解き、肘/膝が壁の外側へ曲がるよう方向を制約する。
- 指: 遊脚で指を曲げて壁から離し、着地前に伸ばす。手首/足首の着地姿勢は接地中に回転させない。
- 戻り: 進行方向が急に逆になる退避では、体の向きを維持して後ずさりする。同じ軌跡を折り返して胴体が折り畳まれる変形を防ぐ。
- 再配置・再開: 大きな位置飛び、時刻の巻き戻り、長い中断時には履歴と足位置を再初期化する。

スケール .4、歩幅基準 .84、足上げ最大 .088、指曲げ最大 .65rad、首の向き変更上限4rad/sなどはAI暫定。ゲームの突進速度などを置き換える値ではない。

## 再生成と検証

```bash
blender -b assets/gecko-source/preview/gecko_review.blend -t 4 --python assets/gecko-source/export_gecko.py
blender -b assets/gecko-source/game/gecko_game.blend -t 3 --python assets/gecko-source/validate_export.py
node gecko-audit.mjs
node assets/gecko-source/chapter_integration_audit.mjs
npm run build
bash scripts/verify.sh
```

ブラウザー検証はVite起動後。専用監査は`GECKO_AUDIT_URL`でポート指定できる。GLB再読み込みで骨数・単一スキン・画像2枚・正規化済みの最大4影響を検証。BlenderのglTF importerが作るIcosphere骨表示ウィジェットは配布メッシュとして数えない。Dracoライブラリ不在の通知は出るが、Draco圧縮は使用していない。

専用監査は独立複製、読込失敗からの再試行、破棄、停止/歩行、実足首の接地誤差、指曲げ、30/60fpsでの高速突進と旋回、サンプリングしたスキン頂点の壁貫通、時刻巻戻し、180度の予告方向変更、後ずさりを検証する。`assets/gecko-source/game/*audit.json`と`roundtrip_validation.json`に結果を保存。本編の写真は`artifacts/gecko-chapter-*.png`。

最終結果: 通常歩行の接地足首誤差は丸め誤差内、突進/旋回の最大誤差 .02061、検査した皮膚頂点の最低z=.001059（基準壁z=0）。停止後の足の移動量と距離カウンターは丸め誤差内/0。本編の予告は53ステップ（約.883秒）確認、ロード失敗・ページ例外0。buildと`verify.sh`全項目PASS（SKIPなし）、通常キー入力で第2章を8/8匹・74.1シミュレーション秒で走破。初見所要時間の実測ではない。

`GECKO_RECORD=1 node gecko-audit.mjs`で制御された確認用経路の6秒動画`artifacts/gecko-motion-review.webm`も作成する。これは骨格動作の確認用であり、本編の通常プレイ動画ではない。

## 残る実機判断・制約

自動検証は生き物としての自然さ・恐怖感・実機FPSの合格判定ではない。ガクチョの実プレイで判断する。足の厳密な皮膚接触は骨とサンプル頂点の検査範囲であり、全頂点全時刻の非貫通保証ではない。急な高速旋回ではIKの到達距離の上限による小さな接地誤差が残る。

頭の経路から胴体と尾を曲げるが、全身と迷路壁の衝突・身体幅を含む角回り・別の面への乗り移りは未実装。顎は予約ボーンのままで、噛みつきの開口は付けない。骨格アニメーションはゲーム内の手続き制御であり、GLB単体に歩行クリップは入っていない。
