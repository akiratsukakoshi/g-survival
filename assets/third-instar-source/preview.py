"""Static third-instar reference sculpture. Blender 4.0. No GLB export."""
import bpy, math, os, json
from mathutils import Vector
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'preview')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,c,r=.3):
 m=bpy.data.materials.new(name); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=r
 if name.startswith('chitin'):
  n=m.node_tree.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=115; n.inputs['Detail'].default_value=2
  b=m.node_tree.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=.13; b.inputs['Distance'].default_value=.009
  m.node_tree.links.new(n.outputs['Fac'],b.inputs['Height']); m.node_tree.links.new(b.outputs['Normal'],p.inputs['Normal'])
 return m
shell=mat('chitin deep chestnut',(.052,.0045,.003),.28)
red=mat('chitin red pronotum',(.092,.009,.005),.29)
rim=mat('chitin warm margins',(.24,.049,.018),.33)
legmat=mat('amber legs',(.30,.095,.024),.34)
dark=mat('dark articulations and spines',(.037,.013,.008),.38)
eye=mat('small black lateral eyes',(.008,.005,.004),.21)
def ell(n,p,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,location=p); o=bpy.context.object; o.name=n; o.scale=s; o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
 return o
def rod(n,a,b,r1,r2,m):
 a,b=Vector(a),Vector(b); d=b-a
 bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2)
 o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for f in o.data.polygons:f.use_smooth=True
def tube(n,pts,rs,m):
 for j in range(len(pts)-1):rod(n+'_%02d'%j,pts[j],pts[j+1],rs[j],rs[j+1],m)
# Continuous flattened abdomen underneath overlapping transverse tergites.
ell('ventral abdomen',(-.68,0,.50),(1.25,.79,.28),dark)
def width(x): return .88*math.sqrt(max(.04,1-((x+.42)/1.62)**2))
def plate(n,front,back,m):
 vs=[];fs=[]; rows=12;cols=48
 for i in range(rows):
  t=i/(rows-1); x=front+(back-front)*t
  for j in range(cols):
   a=2*math.pi*j/cols; w=width(x); z=.53+(.36 if math.sin(a)>0 else .14)*math.sin(a)
   # Modest overlapping lip, avoiding separate sausage-like segments.
   z+=.023*math.sin(math.pi*t); vs.append((x,w*math.cos(a),z))
 for i in range(rows-1):
  for j in range(cols):fs.append((i*cols+j,i*cols+(j+1)%cols,(i+1)*cols+(j+1)%cols,(i+1)*cols+j))
 fs.extend([tuple(reversed(range(cols))),tuple((rows-1)*cols+j for j in range(cols))])
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);me.materials.append(m)
 for f in me.polygons:f.use_smooth=True
for i in range(8):
 front=.36-i*.267;plate('abdominal tergite %02d'%(i+1),front,front-.275,shell if i%3 else red)
ell('mesothorax',(.57,0,.56),(.47,.79,.33),shell)
ell('metathorax',(.24,0,.53),(.40,.84,.33),shell)
ell('broad pronotal shield',(1.08,0,.59),(.66,.70,.38),red)
ell('head tucked under pronotum',(1.62,0,.44),(.36,.39,.27),red)
for s in (-1,1):
 ell('lateral compound eye '+str(s),(1.73,s*.31,.54),(.17,.075,.12),eye)
 ell('mouthpart '+str(s),(1.87,s*.105,.29),(.12,.07,.075),dark)
 # Three jointed pairs. Femora wide and flattened; tibiae carry distinct spines.
 for k,(x,kx,ky,ax,ay) in enumerate([(1.05,1.47,1.01,.98,1.55),(.50,.21,1.25,-.26,1.87),(-.10,-.87,1.19,-1.55,1.85)]):
  root=Vector((x,s*.48,.40)); hip=Vector((x-.12,s*.74,.40)); knee=Vector((kx,s*ky,.38)); ankle=Vector((ax,s*ay,.10)); foot=Vector((ax-.26,s*(ay+.23),.035))
  n='leg_%d_%s'%(k,s)
  tube(n,[root,hip,knee,ankle],[.09,.115,.065,.023],legmat)
  for q in [hip,knee]:ell(n+' joint',q,(.075,.075,.07),rim)
  for j in range(5):
   a=ankle.lerp(foot,j/5); b=ankle.lerp(foot,(j+1)/5);rod(n+' tarsus',a,b,.024*(1-j/6),.021*(1-(j+1)/6),legmat)
  for side in (-1,1):
   rod(n+' claw',foot,foot+Vector((-.065,side*.033,-.006)),.008,.001,dark)
  for j in range(8):
   t=.12+j*.10; p=knee.lerp(ankle,t)
   for side in (-1,1):rod(n+' tibial spine',p,p+Vector((-.10,side*.14,.035)),.014,.001,dark)
  for j in range(5):
   p=hip.lerp(knee,.18+j*.15);rod(n+' femur spine',p,p+Vector((-.06,s*.10,-.055)),.014,.001,dark)
 # Slender curved antennae, body-length, tapering to hair tips.
 pts=[];rs=[]
 for j in range(65):
  t=j/64;pts.append((1.82+3.05*t-.36*t*t,s*(.24+1.12*t+.48*t*t),.49+.42*math.sin(math.pi*t)-.28*t));rs.append(.028*(1-t)**1.3+.0016)
 tube('antenna '+str(s),pts,rs,legmat)
 for j in range(3,64,2):rod('antenna annulus',pts[j],Vector(pts[j]).lerp(Vector(pts[j+1]),.17),rs[j]*1.04,rs[j]*1.03,dark)
 # Paired tapered cerci, no adult wings.
 pts=[(-1.72,s*.30,.49),(-1.94,s*.43,.49),(-2.12,s*.50,.55)]
 tube('cercus '+str(s),pts,[.085,.052,.004],rim)
 for j in range(4):
  p=Vector(pts[0]).lerp(Vector(pts[2]),.15+j*.18);rod('cercal seta',p,p+Vector((-.06,s*.085,.055)),.006,.0005,dark)
creature=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.name='studio floor';bpy.context.object.data.materials.append(mat('warm grey studio',(.32,.34,.33),.85))
sc=bpy.context.scene;sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.4,.42,.45,1);sc.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for p,power,size in [((1,-4,7),950,5),((-4,2,5),750,4),((3,5,5),650,4)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;sc.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=8.6
sc.render.engine='BLENDER_EEVEE';sc.eevee.taa_render_samples=32;sc.eevee.use_gtao=True;sc.eevee.gtao_distance=2;sc.eevee.gtao_factor=1.1
sc.render.resolution_x=1800;sc.render.resolution_y=1200;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='AgX'
bpy.context.preferences.filepaths.save_version=0
target=Vector((1.0,0,.45))
views={'nymph_top':((1,0,18),'Y'),'nymph_oblique':((6,-10,12),'Z'),'nymph_side':((1,-18,.45),'Z')}
for n,(pos,up) in views.items():
 cam.location=pos;cam.rotation_euler=(target-cam.location).to_track_quat('-Z',up).to_euler();sc.render.filepath=os.path.join(OUT,n+'.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'third_instar_review.blend'))
with open(os.path.join(OUT,'validation.json'),'w') as f:json.dump({'leg_pairs':3,'antennae':2,'cerci':2,'wings':0,'views':list(views),'mesh_objects':len(creature),'coordinates':'+X forward / +Z dorsal','GLB_exported':False,'dimensions':'artistic reference ratios, not measured biological dimensions'},f,indent=2)
