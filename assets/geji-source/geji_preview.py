"""Blender 4.0: one static geji sculpture, three orthographic PNGs; no GLB export."""
import bpy, math, os, json
from mathutils import Vector
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,rough=.36):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
    return m
shell=mat('olive charcoal chitin',(.025,.031,.021),.34)
edge=mat('warm plate margins',(.20,.16,.085))
under=mat('ventral brown',(.13,.105,.055),.48)
leg=mat('amber ochre legs',(.38,.205,.048),.36)
band=mat('brown joint bands',(.19,.125,.05),.38)
tip=mat('fine dark distal tarsi',(.12,.085,.041))
eye=mat('small lateral compound eyes',(.015,.019,.012),.24)
def ell(name,p,s,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=p)
    o=bpy.context.object; o.name=name; o.scale=s; o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o
def rod(name,a,b,r1,r2,m):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r1,radius2=r2,depth=d.length,location=(a+b)/2)
    o=bpy.context.object; o.name=name; o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
def chain(name,points,radii,m):
    for j in range(len(points)-1):rod(name+'_%02d'%j,points[j],points[j+1],radii[j],radii[j+1],m)
def shield(name,p,s,m):
    # Broad organic domed rectangle, with a narrower posterior edge.
    verts=[]; faces=[]; n=32; rings=17
    def signed(v,e):return math.copysign(abs(v)**e,v)
    for j in range(rings):
        lat=-math.pi/2+math.pi*(j+.01)/(rings-1+.02)
        for k in range(n):
            a=2*math.pi*k/n; xx=signed(math.cos(a),.62)*math.cos(lat)
            yy=signed(math.sin(a),.68)*math.cos(lat)*(1+.09*xx)
            verts.append((p[0]+s[0]*xx,p[1]+s[1]*yy,p[2]+s[2]*math.sin(lat)))
    for j in range(rings-1):
        for k in range(n):faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
    faces.extend([tuple(reversed(range(n))),tuple((rings-1)*n+k for k in range(n))])
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); mesh.materials.append(m)
    for f in mesh.polygons:f.use_smooth=True
# +X forward, +Z dorsal. Dimensions are provisional artistic ratios from supplied photos.
# Fifteen paired leg roots; broad overlapping dorsal shields cover multiple roots.
for i in range(15):
    t=i/14; x=2.05-4.15*t; w=.29+.075*math.sin(math.pi*t)-.07*t
    ell('ventral_segment_%02d'%i,(x,0,.66),( .19,w*.92,.16),under)
    for s in (-1,1):
        spread=.79+1.28*t; sweep=.42-1.52*t
        root=(x,s*w*.85,.69); hip=(x+.06,s*(w+.17),.73)
        knee=(x+sweep*.5,s*(w+spread*.57),1.04+.40*t)
        ankle=(x+sweep,s*(w+spread),.22)
        foot=(x+sweep-.22,s*(w+spread+.27),.045)
        if i==14:
            knee=(x-1.25,s*.85,1.38); ankle=(x-2.35,s*1.3,.46); foot=(x-3.18,s*1.62,.06)
        name='leg_%02d_%s'%(i,'L' if s>0 else 'R')
        chain(name,[root,hip,knee,ankle,foot],[.049,.043,.029,.013,.0025],leg)
        for j,p in enumerate([hip,knee,ankle]):ell(name+'_joint%d'%j,p,(.044 if j<2 else .020,)*3,band)
        # short narrow bands near joints; slender, non-furry setae.
        for a,b in [(hip,knee),(knee,ankle)]:
            a,b=Vector(a),Vector(b)
            rod(name+'_band',a.lerp(b,.82),a.lerp(b,.87),.024,.022,band)
            q=a.lerp(b,.72); rod(name+'_seta',q,q+Vector((-.06,s*.05,.055)),.005,.0008,tip)
        rod(name+'_claw',foot,(foot[0]-.07,foot[1]+s*.045,.022),.009,.001,tip)
for i,(x,length) in enumerate([(2.02,.22),(1.56,.35),(.91,.39),(.20,.40),(-.53,.40),(-1.25,.37),(-1.89,.28)]):
    w=.30+.065*math.sin(i/6*math.pi)-.045*i/6
    shield('shield_rim_%02d'%i,(x,0,.755),(length,w,.109),edge)
    shield('dorsal_shield_%02d'%i,(x+.025,0,.785),(length*.98,w*.97,.115),shell)
    for s in (-1,1):ell('ochre_shoulder_%02d_%s'%(i,s),(x+.11,s*w*.84,.82),(.065,.048,.053),edge)
ell('head',(2.43,0,.75),(.29,.29,.20),shell)
for s in (-1,1):
    ell('lateral_eye_'+str(s),(2.49,s*.259,.80),(.094,.035,.065),eye)
    chain('mouth_'+str(s),[(2.55,s*.10,.62),(2.7,s*.16,.56),(2.77,s*.07,.55)],[.065,.039,.008],under)
    # Long multiannulate feelers, no face-like decorative features.
    pts=[]; radii=[]
    for j in range(37):
        t=j/36; pts.append((2.61+3.08*t,s*(.14+.98*t+.22*math.sin(t*math.pi)),.82+.16*math.sin(t*math.pi)-.37*t)); radii.append(.027*(1-t)**1.2+.0015)
    chain('antenna_'+str(s),pts,radii,leg)
    for j in range(3,36,2):rod('antenna_annulus',pts[j],Vector(pts[j]).lerp(Vector(pts[j+1]),.25),radii[j]*1.07,radii[j]*1.03,band)
creature=[o for o in bpy.context.scene.objects if o.type=='MESH']
bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object; floor.name='studio_floor'; floor.data.materials.append(mat('neutral warm grey',(.27,.285,.28),.8))
sc=bpy.context.scene; sc.world.use_nodes=True; sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.3,.32,.34,1); sc.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for p,power,size in [((3,-4,8),1400,6),((-4,2,6),1100,5),((0,5,3),650,4)]:
    bpy.ops.object.light_add(type='AREA',location=p); o=bpy.context.object; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; sc.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=13
sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=48; sc.eevee.use_gtao=True; sc.eevee.gtao_distance=3; sc.eevee.gtao_factor=1.12
sc.render.resolution_x=1800; sc.render.resolution_y=1100; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'
sc.view_settings.view_transform='AgX'; sc.view_settings.look='AgX - Medium High Contrast'
sc.render.film_transparent=False; bpy.context.preferences.filepaths.save_version=0
target=Vector((.15,0,.6))
views={'geji_top':((.15,0,18),'Y'),'geji_oblique':((7,-11,12),'Z'),'geji_side':((.15,-18,.6),'Z')}
for name,(pos,up) in views.items():
    cam.location=pos; cam.rotation_euler=(target-cam.location).to_track_quat('-Z',up).to_euler(); sc.render.filepath=os.path.join(OUT,name+'.png')
    bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'geji_review.blend'))
with open(os.path.join(OUT,'validation.json'),'w') as f:json.dump({'leg_pairs':15,'antennae':2,'views':list(views),'mesh_objects':len(creature),'export_glb':False,'coordinates':'+X forward / +Z dorsal','static_preview_only':True},f,indent=2)
