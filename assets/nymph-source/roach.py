"""
クロゴキブリ (Periplaneta fuliginosa) 幼虫 — 手続き生成スクリプト

規約:
  - 前方 = +Y / 上 = +Z (Blender)  →  glTF書き出しで -Z前方 / +Y上 になる
  - 全長 1.0 unit (触角・尾毛を除いた体長)
  - 原点は体の中心線上、脚の接地面が z=0

使い方:
  blender --background --factory-startup --python roach.py -- [instar] [outdir]
"""
import bpy, bmesh, math, sys, os

# ---------------------------------------------------------------- パラメータ
# instar: 齢。1齢幼虫が基準。数字を上げると成虫寄りのプロポーションになる。
P = dict(
    body_len      = 1.00,   # 体長（頭端〜腹端）
    pronotum_w    = 0.185,  # 前胸背板の半幅 ← 上から見て一番目立つ盾
    abdomen_w     = 0.180,  # 腹部最大の半幅。前胸背板と同等かやや広く、楕円に見せる
    flatness      = 0.20,   # 背腹の平たさ。小さいほど平べったい
    antenna_len   = 1.30,   # 体長比。写真では体長より明確に長い
    antenna_segs  = 20,     # 触角の節数（縞の数でもある）
    leg_spines    = True,
)

# ------------------------------------------------------------------ 色
def srgb(hexstr):
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i+2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)

COL = dict(
    shell    = '#412E23',   # 腹部の背板
    plate    = '#2B1E18',   # 前胸背板。いちばん濃く、いちばん照る
    band     = '#C6B7A0',   # 前胸のうしろの淡い帯
    leg      = '#6E5340',
    leg_dark = '#3A2A20',   # 跗節と棘
    eye      = '#0A0806',
)

def material(name, hexstr, rough, spec=0.5, clearcoat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(hexstr)
    b.inputs['Roughness'].default_value = rough
    for key, val in (('Specular IOR Level', spec), ('Coat Weight', clearcoat)):
        if key in b.inputs:
            b.inputs[key].default_value = val
    return m

MAT = {}

# ------------------------------------------------------------------ 部品
def _obj(name, me, mat):
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    bpy.context.collection.objects.link(ob)
    return ob

def ellipsoid(name, loc, scale, mat, rot=(0, 0, 0), segs=14, rings=8):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    bm.to_mesh(me); bm.free()
    ob = _obj(name, me, mat)
    ob.location = loc
    ob.rotation_euler = rot
    return ob

def limb(name, a, b, r1, r2, mat, segs=6):
    """a→b を結ぶテーパー付きの円筒。脚の一節。"""
    ax, ay, az = a; bx, by, bz = b
    dx, dy, dz = bx - ax, by - ay, bz - az
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=segs,
                          radius1=r1, radius2=r2, depth=length)
    bm.to_mesh(me); bm.free()
    ob = _obj(name, me, mat)
    ob.location = ((ax+bx)/2, (ay+by)/2, (az+bz)/2)
    # +Z を向いている円筒を a→b 方向へ回す
    ob.rotation_euler = (math.acos(max(-1, min(1, dz/length))),
                         0,
                         math.atan2(dy, dx) + math.pi/2)
    return ob

def spine(name, base, direction, length, mat):
    bx, by, bz = base
    dx, dy, dz = direction
    n = math.sqrt(dx*dx + dy*dy + dz*dz) or 1
    tip = (bx + dx/n*length, by + dy/n*length, bz + dz/n*length)
    return limb(name, base, tip, 0.006, 0.0008, mat, segs=4)

# ------------------------------------------------------------------ 組み立て
def build():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)

    MAT['shell'] = material('shell', COL['shell'], 0.30, 0.6, 0.35)
    MAT['plate'] = material('plate', COL['plate'], 0.16, 0.8, 0.75)
    MAT['band']  = material('band',  COL['band'],  0.55, 0.3, 0.10)
    MAT['leg']   = material('leg',   COL['leg'],   0.45, 0.5, 0.15)
    MAT['dark']  = material('dark',  COL['leg_dark'], 0.40, 0.5, 0.10)
    MAT['eye']   = material('eye',   COL['eye'],   0.08, 1.0, 1.00)

    parts = []
    F = P['flatness']
    Z = 0.135                      # 体の中心高さ。腹面が床に潜らないよう脚の長さぶん持ち上げる

    # --- 頭部。前胸背板の下にもぐりこませ、上から見るとほぼ隠れる
    head = ellipsoid('head', (0, 0.400, Z - 0.020), (0.115, 0.105, 0.082),
                     MAT['plate'], rot=(math.radians(28), 0, 0))
    parts.append(head)
    for s in (-1, 1):
        parts.append(ellipsoid('eye', (s*0.083, 0.436, Z + 0.004),
                               (0.030, 0.026, 0.024), MAT['eye'], segs=10, rings=6))
    # 小顎髭
    for s in (-1, 1):
        parts.append(limb('palp', (s*0.045, 0.455, Z - 0.055),
                          (s*0.075, 0.545, Z - 0.090), 0.008, 0.004, MAT['leg'], segs=5))

    # --- 前胸背板。写真でいちばん面積を持つ、照りのある盾
    # 縦に丸くせず、横に広い盾にする。丸めすぎると球が並んだように見える。
    parts.append(ellipsoid('pronotum', (0, 0.262, Z + 0.004),
                           (P['pronotum_w'], 0.152, F * 0.44),
                           MAT['plate'], segs=20, rings=12))

    # --- 後胸。淡い帯はこの1節だけ。
    # 幼齢は縦が詰まっているので、前胸背板と帯のあいだの中胸は置かない。
    # 前胸背板とほぼ同じ高さ・幅にして、段差を作らずになだらかに繋ぐ。
    parts.append(ellipsoid('metanotum', (0, 0.075, Z + 0.001),
                           (0.182, 0.098, F * 0.43), MAT['band'], segs=16, rings=8))

    # --- 腹部。8節を重ねる。
    # 幼齢は上から見ると逆三角形ではなく楕円。中ほどでいちばん広くなり、
    # 最後の2〜3節でようやく丸くすぼまる。節ごとの相対幅を直接持たせて調整する。
    TERGITE_W = [1.00, 1.05, 1.06, 1.02, 0.90, 0.62]
    tergites = len(TERGITE_W)
    y0, y1 = -0.030, -0.310
    for n, rel in enumerate(TERGITE_W):
        t = n / (tergites - 1)
        y = y0 + (y1 - y0) * t
        w = P['abdomen_w'] * rel
        # 節の前後幅を節間隔(0.056)より大きく取って深く重ねる。
        # ここが小さいと球が一列に並んだように見えて、区切りが丸くなりすぎる。
        d = 0.098 * (1.0 - 0.16 * t)
        h = F * (0.43 - 0.10 * t)
        parts.append(ellipsoid(f'tergite{n}', (0, y, Z - 0.003 * t),
                               (w, d, h), MAT['shell'], segs=16, rings=8))
    body_back = y1 - 0.098 * 0.84        # 最後の節の後端。全長の正規化に使う

    # --- 腹部第2節に入る白い細線。中央で切れて左右に分かれる。
    # 背板は丸いので、節の断面（楕円）の上に沿わせて小片を並べる。
    STRIPE_SEG = 1                       # 頭側から数えて2つ目の節
    st = STRIPE_SEG / (tergites - 1)
    sy = y0 + (y1 - y0) * st + 0.008     # 節のやや前寄りに乗せる
    sw = P['abdomen_w'] * TERGITE_W[STRIPE_SEG]
    sh = F * (0.43 - 0.10 * st)
    sz = Z - 0.003 * st
    for s in (-1, 1):
        for n in range(5):
            u = 0.21 + n * 0.152         # 中央から外へ。u=0 が正中線
            z = sz + sh * math.sqrt(max(0.0, 1.0 - u * u)) - 0.005
            parts.append(ellipsoid(f'stripe{n}', (s * u * sw, sy, z),
                                   (0.021, 0.011, 0.011), MAT['band'],
                                   segs=6, rings=4))

    # --- 尾毛。腹端から左右に開いて伸びる短い一対
    for s in (-1, 1):
        parts.append(limb('cercus', (s*0.030, -0.330, Z - 0.020),
                          (s*0.066, -0.410, Z - 0.030), 0.014, 0.003, MAT['shell'], segs=5))

    # --- 脚。前・中・後の3対。関節位置を対ごとに明示する。
    # 節の順番:  基節の付け根 → 腿節の付け根 → 膝（脚でいちばん高い点）
    #            → 跗節の付け根（接地の手前） → 爪先（z=0 に接地）
    # 3対とも胸部に付く。前脚は前胸背板の「下段」(y≈0.20、盾の後ろ寄り)から生え、
    # 俯瞰で大きく外へ開いてから前を向く。後脚はいちばん長く腹端より後ろへ届く。
    LEGS = [
        [  # 前脚：前胸背板の後ろ寄りから、外へ開いて前向き
            (0.064, 0.200, Z - 0.058), (0.126, 0.266, Z - 0.018),
            (0.198, 0.358, Z + 0.044), (0.252, 0.426, Z - 0.104),
            (0.288, 0.470, 0.004),
        ],
        [  # 中脚：長く、横へ大きく開く
            (0.070, 0.110, Z - 0.064), (0.142, 0.104, Z - 0.018),
            (0.256, 0.066, Z + 0.052), (0.320, 0.008, Z - 0.104),
            (0.356, -0.046, 0.004),
        ],
        [  # 後脚：いちばん長く、後方へ大きく伸びる。
           # 付け根から先まで腹節1つぶん(0.056)まるごと後ろへずらしている。
            (0.070, -0.054, Z - 0.064), (0.136, -0.112, Z - 0.018),
            (0.244, -0.222, Z + 0.066), (0.298, -0.394, Z - 0.100),
            (0.318, -0.532, 0.004),
        ],
    ]
    # 基節・腿節・脛節・跗節の太さ。対ごとに持たせる。
    # 後脚の腿節（2本目）は跳ねる筋肉が入るぶん、実物でも明らかに太い。
    RADII = [
        [(0.025, 0.019), (0.019, 0.013), (0.013, 0.0070), (0.0070, 0.0036)],  # 前脚
        [(0.027, 0.021), (0.021, 0.014), (0.014, 0.0075), (0.0075, 0.0038)],  # 中脚
        [(0.031, 0.027), (0.029, 0.016), (0.015, 0.0080), (0.0080, 0.0040)],  # 後脚
    ]
    SEGMAT = ['leg', 'leg', 'leg', 'dark']
    for i, joints in enumerate(LEGS):
        for s in (-1, 1):
            pts = [(s * x, y, z) for (x, y, z) in joints]
            for k in range(4):
                r1, r2 = RADII[i][k]
                parts.append(limb(f'leg{i}_{k}', pts[k], pts[k+1], r1, r2, MAT[SEGMAT[k]]))
            if P['leg_spines']:
                # 脛節（膝→跗節）に並ぶ棘。写真でいちばん目を引くディテール
                a, b = pts[2], pts[3]
                for k in range(5):
                    u = 0.14 + k * 0.19
                    base = tuple(a[j] + (b[j] - a[j]) * u for j in range(3))
                    parts.append(spine(f'spine{i}_{k}', base,
                                       (s*0.35, -0.55, -0.75), 0.040, MAT['dark']))

    # --- 触角。長く、節ごとに濃淡の縞。先端はほぼ白
    L = P['antenna_len']
    n_seg = P['antenna_segs']
    for s in (-1, 1):
        px, py, pz = s*0.055, 0.470, Z + 0.010
        for n in range(n_seg):
            t = n / n_seg
            step = L / n_seg
            # ゆるく外へ開きながら垂れる弧
            ang = 0.55 + t * 0.35
            nx = px + s * math.sin(ang) * step * (0.55 + t*0.35)
            ny = py + math.cos(ang) * step * 1.05
            nz = pz - step * (0.10 + t * 0.55)
            r1 = 0.0115 * (1 - t*0.72)
            r2 = 0.0115 * (1 - (t + 1/n_seg)*0.72)
            mat = MAT['band'] if (n % 2 == 0 or t > 0.90) else MAT['dark']
            parts.append(limb(f'ant{n}', (px, py, pz), (nx, ny, nz),
                              max(r1, 0.0016), max(r2, 0.0014), mat, segs=5))
            px, py, pz = nx, ny, nz

    # --- 1つのオブジェクトにまとめる
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = bpy.context.active_object
    body.name = 'roach'

    # 体長（頭端〜腹端。触角と脚は含めない）を 1.0 unit に正規化する。
    # プロポーションをいじっても書き出し規約が動かないよう、最後に一律で掛ける。
    body_front = 0.400 + 0.105
    k = P['body_len'] / (body_front - body_back)
    body.scale = (k, k, k)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    print(f'BODYLEN {body_front - body_back:.3f} -> scale x{k:.3f}')
    return body


# ------------------------------------------------------------------ 撮影
def light(name, kind, energy, loc, rot, size=3.0):
    l = bpy.data.lights.new(name, kind)
    l.energy = energy
    if kind == 'AREA':
        l.size = size
    ob = bpy.data.objects.new(name, l)
    ob.location = loc
    ob.rotation_euler = rot
    bpy.context.collection.objects.link(ob)
    return ob

def studio():
    # 参考写真と見比べやすいよう、白背景・上からの拡散光で撮る
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.60, 0.60, 0.63, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.30
    bpy.context.scene.world = world

    me = bpy.data.meshes.new('floor')
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6.0)
    bm.to_mesh(me); bm.free()
    m = material('floor', '#F2F0EE', 0.55, 0.2)
    _obj('floor', me, m)

    light('key',  'AREA', 22, (0.9, -0.8, 1.4), (math.radians(30), math.radians(18), 0), 2.0)
    light('fill', 'AREA',  7, (-1.2, -0.6, 0.8), (math.radians(58), math.radians(-42), 0), 2.5)
    light('rim',  'AREA', 10, (0.0, 1.3, 0.9), (math.radians(-54), 0, 0), 1.5)

def camera(loc, look, fov=38):
    c = bpy.data.cameras.new('cam')
    c.lens_unit = 'FOV'
    c.angle = math.radians(fov)
    ob = bpy.data.objects.new('cam', c)
    ob.location = loc
    bpy.context.collection.objects.link(ob)
    dx, dy, dz = look[0]-loc[0], look[1]-loc[1], look[2]-loc[2]
    # Blender のカメラは初期状態で -Z 方向を向く。それを loc→look へ向ける
    ob.rotation_euler = (math.atan2(math.hypot(dx, dy), -dz), 0, math.atan2(-dx, dy))
    bpy.context.scene.camera = ob
    return ob

def render(path, res=(900, 700)):
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE'
    s.render.resolution_x, s.render.resolution_y = res
    s.render.film_transparent = False
    s.view_settings.view_transform = 'Standard'
    s.view_settings.exposure = 0.0
    s.render.filepath = path
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ main
argv = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
outdir = argv[1] if len(argv) > 1 else '//out'

body = build()
print('BBOX', [round(v, 3) for v in body.dimensions], 'LOC', [round(v, 3) for v in body.location])
studio()

VIEWS = [
    # 参考写真と同じ真上から。触角の先まで入れる
    ('top',     (0.00, 0.62, 4.70), (0.00, 0.62, 0.09), 34),
    # 体だけ寄って造形を見る
    ('body',    (0.00, 0.06, 2.80), (0.00, 0.06, 0.12), 34),
    # 斜め上から。ゲーム内の見え方に近い角度
    ('quarter', (2.30, -2.30, 2.10), (0.00, 0.08, 0.09), 34),
    # 真横。平べったさを見る
    ('side',    (2.90,  0.00, 0.28), (0.00, 0.04, 0.11), 32),
]
for name, loc, look, fov in VIEWS:
    for ob in list(bpy.data.objects):
        if ob.type == 'CAMERA':
            bpy.data.objects.remove(ob, do_unlink=True)
    camera(loc, look, fov)
    render(os.path.join(outdir, f'roach_{name}.png'))

tris = sum(len(p.vertices) - 2 for p in bpy.data.objects['roach'].data.polygons)
print(f'TRIS {tris}')
print('DONE')
