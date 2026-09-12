"""Blender 4.0: reference-driven gecko, deform rig, PNG-only review. No GLB export."""
import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, color, rough=.65):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough
    return m

skin=material('Granular warm grey brown skin',(.32,.28,.22))
n=skin.node_tree.nodes; l=skin.node_tree.links; p=n.get('Principled BSDF')
tex=n.new('ShaderNodeTexCoord')
noise=n.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=4.8; noise.inputs['Detail'].default_value=5; noise.inputs['Roughness'].default_value=.8
l.new(tex.outputs['Object'],noise.inputs['Vector'])
ramp=n.new('ShaderNodeValToRGB'); ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
for i,(pos,col) in enumerate([(.27,(.045,.035,.026,1)),(.40,(.14,.115,.082,1)),(.49,(.32,.285,.22,1)),(.64,(.48,.43,.34,1)),(.78,(.60,.54,.44,1))]):
    e=ramp.color_ramp.elements[0] if i==0 else ramp.color_ramp.elements.new(pos); e.position=pos; e.color=tuple(c*.48 for c in col[:3])+(1,)
l.new(noise.outputs['Fac'],ramp.inputs['Fac'])
fine=n.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value=34; fine.inputs['Detail'].default_value=3; l.new(tex.outputs['Object'],fine.inputs['Vector'])
speck=n.new('ShaderNodeValToRGB'); speck.color_ramp.elements[0].position=.38; speck.color_ramp.elements[0].color=(.10,.085,.07,1); speck.color_ramp.elements[1].position=.57; speck.color_ramp.elements[1].color=(1,1,1,1)
l.new(fine.outputs['Fac'],speck.inputs['Fac']); mix=n.new('ShaderNodeMixRGB'); mix.blend_type='MULTIPLY'; mix.inputs[0].default_value=.72; l.new(ramp.outputs['Color'],mix.inputs[1]); l.new(speck.outputs['Color'],mix.inputs[2]); l.new(mix.outputs[0],p.inputs['Base Color'])
vor=n.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value=85; vor.feature='DISTANCE_TO_EDGE'; l.new(tex.outputs['Object'],vor.inputs['Vector'])
bump=n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.5; bump.inputs['Distance'].default_value=.018; l.new(vor.outputs['Distance'],bump.inputs['Height']); l.new(bump.outputs['Normal'],p.inputs['Normal'])
belly=material('Pale ventral skin',(.47,.43,.34),.78)
dark=material('Mouth nostrils pupil',(.018,.014,.010),.37)
iris=material('Bronze olive iris',(.29,.25,.105),.3)
inn=iris.node_tree.nodes; il=iris.node_tree.links; ino=inn.new('ShaderNodeTexNoise'); ino.inputs['Scale'].default_value=38; ino.inputs['Detail'].default_value=3
ir=inn.new('ShaderNodeValToRGB'); ir.color_ramp.elements[0].color=(.045,.044,.018,1); ir.color_ramp.elements[1].color=(.54,.43,.19,1)
il.new(ino.outputs['Fac'],ir.inputs['Fac']); il.new(ir.outputs['Color'],inn.get('Principled BSDF').inputs['Base Color'])

parts=[]; attachments=[]; bones=[]
def bone(name,a,b,parent=None,deform=True): bones.append((name,Vector(a),Vector(b),parent,deform)); return name
bone('root',(0,0,0),(0,0,.4),None,False)
bone('pelvis',(-1.55,0,.35),(-.9,0,.38),'root')
bone('spine_rear',(-.9,0,.38),(0,0,.40),'pelvis')
bone('spine_front',(0,0,.40),(.95,0,.37),'spine_rear')
bone('neck',(.95,0,.37),(1.68,0,.36),'spine_front')
bone('head',(1.68,0,.36),(2.96,0,.30),'neck')
bone('jaw',(1.75,0,.20),(2.91,0,.17),'head')

def mesh(name,verts,faces,mat=skin):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    for f in me.polygons:f.use_smooth=True
    return o

def smooth_samples(points,steps=6):
    out=[]
    for i in range(len(points)-1):
        a=Vector(points[max(0,i-1)]); b=Vector(points[i]); c=Vector(points[i+1]); d=Vector(points[min(len(points)-1,i+2)])
        for k in range(steps):
            t=k/steps; out.append((2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)*.5)
    out.append(Vector(points[-1])); return out

def tube(name,points,flatten=1,steps=6,segments=24):
    # points = x,y,z,radius; ring axis follows the centerline within the wall plane.
    pts=smooth_samples(points,steps); verts=[]; faces=[]
    for i,q in enumerate(pts):
        tangent=pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]
        side=Vector((-tangent.y,tangent.x,0)).normalized()
        for j in range(segments):
            a=2*pi*j/segments; v=Vector(q[:3])+side*(max(.002,q[3])*cos(a))+Vector((0,0,max(.002,q[3])*flatten*sin(a)))
            verts.append(v)
    for i in range(len(pts)-1):
        for j in range(segments):
            a=i*segments+j; b=i*segments+(j+1)%segments; faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(range(segments-1,-1,-1))); faces.append(tuple((len(pts)-1)*segments+j for j in range(segments)))
    o=mesh(name,verts,faces); parts.append(o); return o

def ellipsoid(name,loc,scale,mat=skin,bind=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc); o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    if bind:attachments.append((o,bind))
    return o

# Continuous body/head envelope; flattened underside, broad temporal region, tapered muzzle.
profiles=[(-1.95,.08,.20,.11),(-1.65,.40,.33,.22),(-1.10,.57,.37,.27),(-.45,.66,.38,.29),(.25,.58,.37,.27),(.88,.41,.33,.22),(1.35,.32,.30,.19),(1.65,.47,.33,.23),(2.05,.60,.35,.26),(2.42,.53,.31,.23),(2.76,.39,.25,.17),(3.03,.22,.22,.12),(3.12,.025,.22,.06)]
pts=smooth_samples(profiles,8); verts=[]; faces=[]; rings=48
for x,w,z,h in pts:
    for j in range(rings):
        a=2*pi*j/rings; verts.append((x,w*cos(a),z+h*sin(a)))
for i in range(len(pts)-1):
    for j in range(rings):
        a=i*rings+j; b=i*rings+(j+1)%rings; faces.append((a,b,b+rings,a+rings))
faces.extend([tuple(range(rings-1,-1,-1)),tuple((len(pts)-1)*rings+j for j in range(rings))]); parts.append(mesh('Body continuous sculpt',verts,faces))

tail=[(-1.65,0,.30,.34),(-2.12,-.02,.26,.29),(-2.7,.08,.23,.24),(-3.28,.26,.21,.20),(-3.85,.51,.19,.16),(-4.42,.66,.16,.12),(-4.96,.60,.12,.085),(-5.43,.36,.087,.055),(-5.8,-.02,.065,.028),(-6.05,-.37,.052,.004)]
tube('Long tapering curved tail',tail,.8,8,32)
for i in range(len(tail)-1):bone('tail_%02d'%i,tail[i][:3],tail[i+1][:3],'pelvis' if i==0 else 'tail_%02d'%(i-1))

pad_centers=[]
for side in (-1,1):
    tag='L' if side>0 else 'R'
    for fore in (True,False):
        label=('fore_' if fore else 'hind_')+tag
        if fore:
            a=(1.05,side*.28,.32); b=(.72,side*1.0,.28); c=(1.26,side*1.48,.13); d=(1.42,side*1.69,.085); radii=(.24,.18,.095,.12); par='spine_front'
        else:
            a=(-1.28,side*.33,.30); b=(-1.78,side*1.04,.26); c=(-1.13,side*1.46,.125); d=(-1.20,side*1.72,.085); radii=(.31,.25,.115,.14); par='pelvis'
        bone(label+'_upper',a,b,par); bone(label+'_lower',b,c,label+'_upper'); bone(label+'_palm',c,d,label+'_lower')
        tube(label,[(*a,radii[0]),(*b,radii[1]),(*c,radii[2]),(*d,radii[3])],.65,8)
        # Five independent digits with broadened adhesive ends, tips flush to z=0.
        for j,angle in enumerate((-75,-37,0,37,75)):
            ang=math.radians(angle); length=[.35,.49,.57,.51,.36][j]
            dx=sin(ang); dy=side*cos(ang)
            start=(d[0]+dx*.06,d[1]+dy*.045,.080)
            mid=(d[0]+dx*length*.50,d[1]+dy*length*.50,.052)
            pad=(d[0]+dx*length*.84,d[1]+dy*length*.84,.035)
            tip=(d[0]+dx*length,d[1]+dy*length,.034)
            name=label+'_digit%d'%(j+1)
            bone(name+'_01',start,mid,label+'_palm'); bone(name+'_02',mid,tip,name+'_01')
            tube(name,[(*start,.055),(*mid,.040),(*pad,.075),(*tip,.020)],.45,6,16)
            o=ellipsoid(name+'_adhesive_pad',pad,(.065,.098,.035)); o.rotation_euler.z=-side*ang; parts.append(o); pad_centers.append(pad)

# Unify anatomical masses so elbow, hip and neck are actual continuous skin.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); body=bpy.context.object; body.name='Gecko_skin_deform'
mod=body.modifiers.new('Unified organic skin','REMESH'); mod.mode='VOXEL'; mod.voxel_size=.024; mod.use_smooth_shade=True; bpy.ops.object.modifier_apply(modifier=mod.name)
mod=body.modifiers.new('Relax joins','SMOOTH'); mod.factor=.65; mod.iterations=4; bpy.ops.object.modifier_apply(modifier=mod.name)
# Bottom vertices use ventral material, especially sides of abdomen and toes.
body.data.materials.append(belly)
for f in body.data.polygons:
    if f.center.z<.12 and f.normal.z<-.4:f.material_index=1

def line(name,points,r,mat,bind):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.bevel_depth=r; cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for b,co in zip(sp.bezier_points,points):b.co=co; b.handle_left_type='AUTO'; b.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); body.select_set(False); bpy.ops.object.convert(target='MESH'); attachments.append((bpy.context.object,bind)); bpy.context.object.select_set(False)

for side in (-1,1):
    # Eyes sit on the lateral skull, their long slit oriented dorsoventrally.
    center=Vector((2.22,side*.470,.392)); normal=Vector((.19,side*.88,.43)).normalized()
    eye=ellipsoid('Eye globe '+str(side),center,(.150,.150,.150),iris,'head')
    vertical=Vector((0,0,1)); vertical=(vertical-normal*vertical.dot(normal)).normalized(); horizontal=vertical.cross(normal).normalized()
    # Project every pupil vertex onto the sphere; a flat decal would stick out at the ends.
    pv=[center+normal*.151]; pf=[]
    for ring in range(1,13):
        for k in range(48):
            angle=2*pi*k/48; u=.017*cos(angle)*ring/12; v=.116*sin(angle)*ring/12
            pv.append(center+horizontal*u+vertical*v+normal*math.sqrt(.151**2-u*u-v*v))
    for k in range(48):pf.append((0,k+1,(k+1)%48+1))
    for ring in range(11):
        for k in range(48):
            a=1+ring*48+k; b=1+ring*48+(k+1)%48; pf.append((a,a+48,b+48,b))
    pupil=mesh('Curved vertical pupil '+str(side),pv,pf,dark); attachments.append((pupil,'head'))
    # Raised scale rim around each eye, avoiding a cartoon eyelid.
    u=Vector((1,0,0)); u=(u-normal*u.dot(normal)).normalized(); v=normal.cross(u)
    rim=[center+normal*.016+.152*(cos(2*pi*k/32)*u+sin(2*pi*k/32)*v) for k in range(33)]
    line('Orbital scale rim '+str(side),rim,.018,skin,'head')
    ellipsoid('Nostril '+str(side),(2.875,side*.267,.307),(.032,.015,.018),dark,'head')
    line('Closed mouth crease '+str(side),[(3.083,side*.07,.191),(2.91,side*.277,.174),(2.59,side*.405,.157),(2.19,side*.535,.175),(1.85,side*.48,.185)],.009,dark,'head')
    ellipsoid('Ear opening '+str(side),(1.66,side*.438,.286),(.062,.012,.08),dark,'head')

# Sparse raised dorsal tubercles complement the fine shader scales.
for i in range(29):
    x=-1.48+i*.115
    pr=min(smooth_samples(profiles,8),key=lambda q:abs(q[0]-x)); _,w,z,h=pr
    for j in (-2,-1,0,1,2):
        y=j*w*.29+.016*sin(i*2.1+j); zz=z+h*math.sqrt(max(0,1-(y/w)**2))
        bind='pelvis' if x<-.9 else ('spine_rear' if x<0 else ('spine_front' if x<.95 else 'neck'))
        ellipsoid('Dorsal tubercle %d %d'%(i,j),(x,y,zz-.011),(.028,.026,.020),skin,bind)

# Full named deformation skeleton. Smooth distance weights are a draft, not gait approval.
armdata=bpy.data.armatures.new('Gecko anatomical skeleton'); rig=bpy.data.objects.new('Gecko_Rig',armdata); bpy.context.collection.objects.link(rig); bpy.context.view_layer.objects.active=rig; rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,a,b,parent,deform in bones:
    eb=armdata.edit_bones.new(name); eb.head=a; eb.tail=b; eb.use_deform=deform
    if parent:eb.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT'); rig.show_in_front=True; rig.data.display_type='OCTAHEDRAL'
deformbones=[b for b in bones if b[4] and b[0]!='jaw']
groups={b[0]:body.vertex_groups.new(name=b[0]) for b in deformbones}
def segment_dist(p,a,b):
    d=b-a; t=max(0,min(1,(p-a).dot(d)/d.length_squared)); return (p-a-d*t).length
for vert in body.data.vertices:
    scores=sorted((segment_dist(vert.co,a,b),name) for name,a,b,_,_ in deformbones)[:3]
    weights=[math.exp(-((d-scores[0][0])/.16)**2*2) for d,_ in scores]; total=sum(weights)
    for (_,name),w in zip(scores,weights):groups[name].add([vert.index],w/total,'REPLACE')
def bind(o):
    mod=o.modifiers.new('Skeletal deformation','ARMATURE'); mod.object=rig; o.parent=rig
bind(body)
for ob,name in attachments:
    vg=ob.vertex_groups.new(name=name); vg.add(list(range(len(ob.data.vertices))),1,'REPLACE'); bind(ob)
sub=body.modifiers.new('Surface finish','SUBSURF'); sub.levels=1; sub.render_levels=1
rig['coordinate_convention']='+X forward / +Z dorsal; wall tangent XY, contact z=0'
rig['review_state']='PNG review pending; no GLB; skin weights draft; no validated locomotion'

# Neutral wall studio; wall is the local XY plane regardless of world orientation.
wall=material('Warm neutral plaster',(.57,.59,.58),.9)
wn=wall.node_tree.nodes; wl=wall.node_tree.links; noise=wn.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=100
bu=wn.new('ShaderNodeBump'); bu.inputs['Strength'].default_value=.15; bu.inputs['Distance'].default_value=.015; wl.new(noise.outputs['Fac'],bu.inputs['Height']); wl.new(bu.outputs['Normal'],wn.get('Principled BSDF').inputs['Normal'])
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.005)); bpy.context.object.name='WALL contact plane'; bpy.context.object.data.materials.append(wall)
world=bpy.data.worlds.new('Neutral studio'); bpy.context.scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
for loc,power,size in [((3,-4,8),1100,7),((-4,3,5),800,6),((0,5,7),650,5)]:
    bpy.ops.object.light_add(type='AREA',location=loc); ob=bpy.context.object; ob.data.energy=power; ob.data.shape='DISK'; ob.data.size=size; ob.rotation_euler=(Vector((-1,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; cam.name='Review camera'; cam.data.type='ORTHO'; cam.data.ortho_scale=10.6
sc=bpy.context.scene; sc.camera=cam; sc.render.engine='BLENDER_EEVEE'; sc.eevee.use_gtao=True; sc.eevee.gtao_distance=3; sc.eevee.gtao_factor=1.2; sc.eevee.taa_render_samples=64
sc.render.resolution_x=1600; sc.render.resolution_y=1000; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.view_settings.look='AgX - Medium High Contrast'
target=Vector((-1.4,0,.20))
cam.location=(5,-9,10); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'gecko_review.blend'))
report={'bones':len(bones),'skin_vertices':len(body.data.vertices),'skin_polygons':len(body.data.polygons),'digits':20,'pad_bottom_z':min(p[2]-.035 for p in pad_centers),'wall_z':-.005,'forward':'+X','dorsal':'+Z','glb_exported':False,'motion_validation':'not yet performed'}
with open(os.path.join(OUT,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print('GECKO_REPORT',json.dumps(report))
