# ゲジ Blender確認モデル

ガクチョの添付3画像を視覚参照した静止造形。写真2/3の暗い背板・黄褐色の細長い関節脚・後方の長い脚を優先した。厳密な種同定や計測に基づく模型ではなく、比率・色はAI暫定。

- 再生成: `blender -b -t 6 --python assets/geji-source/geji_preview.py`
- 編集元: `preview/geji_review.blend`（このレビュー用素材はリポジトリ内に保存）
- PNG: `preview/geji_top.png`、`geji_oblique.png`、`geji_side.png`
- 同一モデル・同一姿勢の正投影。15対の脚、2本の触角。+X前方/+Z背中。
- 今回はPNG承認待ち。GLB出力・ゲーム接続・骨格/歩行は未実施。
- 原写真をリポジトリへ複製していない。

形状検証は生成オブジェクトと3画像の目視確認。ゲーム回帰は `verification.txt` 参照。ブラウザーはサーバー未起動でSKIP、合格ではない。
