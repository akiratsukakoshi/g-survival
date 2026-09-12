# 3齢相当ゴキブリ・造形確認用

ガクチョ提供の `468315.webp`、`P6190019-1024x768.jpg`、`32127000060.webp` を視覚参照したBlender静止モデル。第1章脱皮後・第2章開始時用の造形案。写真のウォーターマークや背景は素材化していない。

- 広い赤褐色の前胸背板、低く楕円形の腹部、横方向に重なる腹節、3対の有棘脚、2本の触角、2本の尾毛。翅なし。
- 色・寸法比・厚みは写真からのAI暫定造形値。齢・種の独立した生物学的同定や寸法測定はしていない。側面は斜俯瞰からの推定。
- +X前方、+Z背中。同一モデルを3台のカメラ方向で描画。ゲーム寸法は未適用。
- `preview/third_instar_review.blend`: 編集用。`preview/nymph_top.png` / `nymph_oblique.png` / `nymph_side.png`: 1800×1200 PNG。
- GLB書出し・ゲーム接続・リグ・歩行・脱皮白化はこの確認工程の対象外。まずガクチョの造形判断待ち。

再生成: `blender -b -t 4 --python assets/third-instar-source/preview.py`

## 2026-09-12 承認後のGLB書出し

ガクチョのPNG承認を受け `export/roach-third-instar.glb` を作成。本番は別セッションで作業中のため、`public/models/` への配置・ゲーム接続は実施していない。

- 再生成: `blender -b -noaudio -t 4 --python assets/third-instar-source/export_glb.py`
- 約1.91 MB、61,792三角形、417メッシュオブジェクト、6材質。スタジオ床・カメラ・照明は除外。
- Blender再読込でオブジェクト数・三角形数・境界寸法一致、全メッシュの材質を確認。`export/validation.json` 参照。
- PBRの色と粗さは保持。BlenderのNoise/Bumpによる微細凹凸は未収録。元の承認済みblendは変更していない。
- 静止モデル。骨格・アニメーションなし。大量個体の描画に向けた結合・軽量化、独立スキン複製、脱皮白化/復色/リセット、実機FPSは未検証。
- 座標はBlenderで+X前方/+Z背中、GLBでは+X前方/+Y背中。読込層でX軸+90度回転するとBlender座標へ戻る。モデル原点は造形時のまま、ゲーム寸法への正規化は未実施。
- 次の担当は本番反映の指示後に上記制約と既存 `src/nymph.ts` APIを確認する。今回のGLB生成は本番反映許可を意味しない。
