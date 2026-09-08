# 幼齢GLBのゲーム組込み（2026-09-08）

プレイヤーと兄弟、脱皮の抜け殻を `public/models/roach-nymph.glb` に変更。アリ・クモは既存モデル、simulationの移動・敵・難易度値は変更していない。

## 呼び出し規約

- scene生成前に `await loadAnimals()`。モデル取得中は開始ボタンを無効化し、失敗時は再読み込みボタンを表示する。
- `createAnimal('roach', scale)` は個別の骨を持つスキンモデルを返す。`SkeletonUtils.clone` と個体ごとのAnimationMixerを使用する。
- `animateAnimal(g,time,speed,heading,molt)` の既存APIを維持する。予定されていたQuaternion引数への変更は不要と判断し、実際の姿勢は既存 `space.ts` の台座が担当する。読み込み境界で glTF(-Z前/+Y上)→モデル(+X前/+Z背中)へ変換する。
- `src/nymph.ts` がGLB・歩行・触角・脱皮時のボーン姿勢を担当。`src/animals.ts` は種類別の入口。旧ゴキブリ生成分岐は置き換えた。
- 移動速度に応じて仮歩行クリップの重みと周期を変える。停止時は脚を静止姿勢に戻す。触角は独立した揺れ。**マウス照準との連動(C01)は未実装**。
- `userData.nymph` がGLBモデル識別子。GLB個体のlegacy `legs` / `feelers` は空配列。ボーンは `src/nymph.ts` で操作する。外部からlegacy配列に脚があると仮定しない。

## 脱皮・複数個体

プレイヤーのgeometryと材質を複製して、白化を頂点色にも適用。兄弟の色は変わらない。復色時に元の色配列を復元。抜け殻は開始地点の台座Quaternionを保存し、体の抽出方向も接触面内で計算する。リトライで抜け殻の材質とスケルトンを解放する。

## 検証

- `npm run build`: PASS。本番distにも同一GLBをコピー（SHA256一致）。Viteの500KB超注意は継続。
- `bash scripts/verify.sh`: build / smoke 11群 / playthrough 229.3秒・won / browser-audit PASS。
- `node nymph-audit.mjs`: 12個体のGLB化、3,944三角形、1材質、27骨、骨の独立性、歩行と停止、床/四方向壁の前方と背面法線、白化/復色と兄弟色の不変、壁面での抜け殻、リトライ、GLB取得失敗→再試行、ページ例外0件を確認。後からverify.shのブラウザー検証部にも追加した。
- `artifacts/nymph-integration.json` と `nymph-game-*.png` が証跡。拡大画像は `?cam=45,30,55,4` による確認用の一時カメラ。通常プレイのカメラ値は変更していない。

## 未検証・調整余地

素材変更後のIris Xe実機FPS、ガクチョによる造形と見やすさの最終判断、足滑り・動作中の細かな接地は未検証。既存の台座高さを継承しており、脚を地形に密着させるIKはない。歩行速度上限3周期/秒・触角振幅0.09rad・脱皮時の脚0.65rad/触角0.5radはAI暫定値。モデル自体の4,000三角形予算は満たすが、それだけでFPSを保証しない。
