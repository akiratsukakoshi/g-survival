"""Export the current maze as a Japanese annotated PNG. Requires Pillow."""
from pathlib import Path
import re
import json
import subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'src/chapter2-maze.ts').read_text()
rows = re.findall(r"'([#.~12oMSGcgy]+)'", source.split('export const MAP:string[]=[')[1].split('];')[0])
assert len(rows) == 46 and all(len(row) == 14 for row in rows)
cell = float(re.search(r'export const CELL=([\d.]+)', source)[1])
maze = json.loads(subprocess.check_output(['node', '--experimental-strip-types', '--input-type=module', '-e', "import {parseMaze} from './src/chapter2-maze.ts'; console.log(JSON.stringify(parseMaze()))"],cwd=ROOT,text=True))
origin = float(re.search(r'ORIGIN_X=([\d.]+)', source)[1])
font_path = Path.home() / '.local/share/fonts/NotoSansJP-Regular.otf'
font = lambda size: ImageFont.truetype(str(font_path), size)
im = Image.new('RGB', (1200, 1790), '#f6f4ee')
d = ImageDraw.Draw(im)
def text(x, y, value, size=22, fill='#263b40'):
    d.text((x, y), value, font=font(size), fill=fill)
text(60, 28, 'STAGE 02  /  壁の中', 36)
text(60, 82, '現行マップ全体図  —  壁面を正面から展開（上から下へ下降）', 23)
head = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, text=True).strip()
text(60, 118, f'2026-09-12 調整版  ·  base {head}  ·  14列 × 46行  ·  1セル = {cell:g}', 18, '#657575')
X, Y, S = 92, 204, 32
colors = {'#':'#596467', '.':'#fffdf7', '~':'#dac08a', '1':'#f6cf88', '2':'#b0dbcf', 'o':'#b4dce9', 'M':'#bcace1', 'S':'#227e67', 'G':'#e7b640', 'c':'#f1b5ac', 'g':'#ead0ad', 'y':'#d4bcdf'}
for c in range(14):
    text(X+c*S+8, Y-34, chr(65+c), 17)
for r, row in enumerate(rows):
    text(40, Y+r*S+3, f'{r+1:02}', 17)
    for c, ch in enumerate(row):
        x, y = X+c*S, Y+r*S
        d.rectangle((x,y,x+S,y+S), fill=colors[ch], outline='#d9ddd6' if ch!='#' else '#667173')
        if ch in '12':
            width = float(re.search(r"'"+ch+r"':([\d.]+)", source)[1])
            jamb = (cell-width)/cell*S/2
            vertical = r>0 and r+1<len(rows) and rows[r-1][c]!='#' and rows[r+1][c]!='#'
            if vertical:
                d.rectangle((x,y,x+jamb,y+S),fill=colors['#']);d.rectangle((x+S-jamb,y,x+S,y+S),fill=colors['#'])
            else:
                d.rectangle((x,y,x+S,y+jamb),fill=colors['#']);d.rectangle((x,y+S-jamb,x+S,y+S),fill=colors['#'])
        if ch not in '#.':
            text(x+8,y+2,ch,19,'white' if ch=='S' else '#263b40')
for i,track in enumerate(maze['centipedes']):
    points=[(X+p['c']*S+S/2,Y+p['r']*S+S/2) for p in track['path']]
    d.line(points,fill='#bc5647',width=4)
    x,y=points[0]
    d.ellipse((x-12,y-12,x+12,y+12),fill='#a33b31')
    text(x-5,y-11,str(i+1),16,'white')
text(592, 196, '凡例', 28)
legend = [('#','壁・間柱（通行不可）'),('.','通常の通路'),('~','登れる断熱材の山'),('1','細い隙間：幅 1.10'),('2','広い隙間：幅 1.40'),('o','退避ポケット'),('M','脱皮ポケット'),('S','スタート'),('G','台所へ抜けるゴールの穴'),('c','赤線①〜③：ムカデ巡回'),('g','ゲジ横断の基準セル'),('y','ヤモリの巣')]
for i,(ch,label) in enumerate(legend):
    yy=248+i*46
    d.rectangle((594,yy,624,yy+30),fill=colors[ch],outline='#9ba6a4')
    if ch not in '#.':text(601,yy,ch,18,'white' if ch=='S' else '#263b40')
    text(640,yy,label,21)
notes = [
 ('成長と退避', ['Mで身体が光る → Space長押しで脱皮。','身体幅 1.02 → 1.20、速度 +12%（暫定）。','脱皮後は「1」不可、「2」は通れます。','隙間・ポケットには敵が入れません。']),
 ('位置の指定', ['H02：スタート ／ D18：脱皮','ムカデ3体：赤線を通路沿いに往復。','D22〜J22・D26〜J26：ゲジ2体','D31・K35：ヤモリ2体 ／ L45：ゴール']),
 ('図の読み方', ['29〜40行・B〜M列を一つの部屋に。','断熱材は固定配置。ヤモリの視線を遮る。','D27/D28：細い隙間を連続配置。','J27/J28：広い隙間を連続配置。','赤線は巡回路（追跡範囲は含まない）。']),
 ('縮尺と座標', [f'外周込み：幅 {14*cell:g} × 高さ {46*cell:g}',f'シミュレーション座標：x={origin:g}〜{origin+14*cell:g}、y=0〜{46*cell:g}','列は左からA〜N、行は上から01〜46。','マスは縦横同じ縮尺です。'])]
yy=832
for title,lines in notes:
    text(592,yy,title,25);yy+=42
    for line in lines:text(592,yy,line,19);yy+=31
    yy+=24
text(60,1710,'正本：src/chapter2-maze.ts の MAP ／ 隙間の柱も実際の幅・向きで表示',19)
text(60,1744,'ガクチョ指定の地形・敵追加を反映。脱皮後の速度倍率と断熱材配置はAI暫定。',19,'#657575')
out=ROOT/'artifacts/chapter2-map-2d.png'
im.save(out)
print(out)
