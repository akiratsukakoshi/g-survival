# ヤモリ Blender 確認素材

ガクチョ提供の `dsc_20170629299917.jpg` と `Gekko_japonicus_kyoto-1200x900.jpg` を形・色の参考にした初稿。画像そのものの貼り付けや再配布はしていない。

## 確認範囲

- 壁面に伏せた静止姿勢の真俯瞰・斜俯瞰・真横PNG。GLBの作成はガクチョのPNG確認後。
- 一続きの皮膚メッシュ、灰褐色の斑模様・粒状鱗、側眼・縦瞳孔・鼻孔・口の線、四肢それぞれ5指。
- 68ボーン：root、骨盤、脊柱2節、首、頭、顎、尾9節、四肢各3節、20指各2節。顎ボーンは将来の開口用の予約で、閉口した皮膚はまだ顎に分離していない。
- 胴体・尾・四肢・指のスキニングは初期ウェイト。歩行クリップ・足先IK・指の剥離／再接着・壁角の乗り越えは未実装。自然な動きの実プレイ判定は未完。
- +X前方、+Z背中、XYが壁の接平面。撮影用の壁はz=-0.005。壁面をローカルXYに置くため、真横画像では壁が水平線に見える。ゲームへの適用時は台座を回転させて垂直壁に合わせる。
- 真横のみ、薄い面が消えないよう撮影用の壁断面を追加。静止皮膚の最低z=0.001258で壁への潜り込みは0、壁との最小間隔は約0.0063（Blender単位）。全指の厳密な接触・移動中の接地は未検証。
- 寸法・色・ボーン配置・ウェイトはすべてAI暫定値。ゲームコード・配布GLBは未変更。

## 再生成（Blender 4.0.2）

```bash
blender -b -t 4 --python assets/gecko-source/gecko_preview.py
blender -b assets/gecko-source/preview/gecko_review.blend -t 4 --python assets/gecko-source/render_gecko.py -- top
blender -b assets/gecko-source/preview/gecko_review.blend -t 4 --python assets/gecko-source/render_gecko.py -- oblique
blender -b assets/gecko-source/preview/gecko_review.blend -t 4 --python assets/gecko-source/render_gecko.py -- side
blender -b assets/gecko-source/preview/gecko_review.blend -t 4 --python assets/gecko-source/validate_gecko.py
```

EEVEEのソフトウェア描画がメモリ上限終了したため、造形保存と各ビュー描画を別プロセスにし、PNGはCycles CPU・32サンプルで描画する。このBlenderはOpenImageDenoiserなしのビルドのためデノイズは無効。真俯瞰・斜俯瞰1600×1000、真横1600×460（側面の上下余白を縮小）。

編集用コピーは `C:\Users\tukap\blender-work\gecko_codex_v1\gecko_review.blend`。

`preview/rig_validation.json` はウェイト正規化・5関節の変形応答・静止姿勢への復帰・壁への潜り込みの計測。歩行の自然さやゲーム性能を保証するものではない。

プロシージャル材質はBlender用。GLB化の前にテクスチャのベイク、ゲーム用途のポリゴン削減、ウェイト調整と歩行／接地の検証が必要。
