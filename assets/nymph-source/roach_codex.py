# Codex revision: original roach.py remains unchanged.
import bpy, math, os, json, struct
from mathutils import Vector
BASE=os.path.dirname(os.path.abspath(__file__))
source=open(os.path.join(BASE,'roach.py'),encoding='utf-8-sig').read().split('# ------------------------------------------------------------------ main')[0]
source=source.replace('antenna_segs  = 20','antenna_segs  = 34')
source=source.replace('pz - step * (0.10 + t * 0.55)','0.145 + 0.070 * math.sin((t + 1/n_seg) * math.pi)')
source=source.replace('0.0115 *','0.0060 *').replace('max(r1, 0.0016), max(r2, 0.0014)','max(r1, 0.00065), max(r2, 0.00055)')
source=source.replace("MAT['band'] if (n % 2 == 0 or t > 0.90) else MAT['dark']","MAT['leg'] if n % 5 == 0 else MAT['dark']")
source=source.replace("COL['plate'], 0.16, 0.8, 0.75","COL['plate'], 0.32, 0.5, 0.20").replace("COL['shell'], 0.30, 0.6, 0.35","COL['shell'], 0.36, 0.5, 0.18")
source=source.replace("'#412E23'","'#362C28'").replace("'#2B1E18'","'#29221E'").replace("'#C6B7A0'","'#C9C2A8'")
# Flatten the body and fine spines; all new values are AI proposals.
source=source.replace('flatness      = 0.20','flatness      = 0.16').replace('0.040, MAT', '0.024, MAT')
source=source.replace('return limb(name, base, tip, 0.006, 0.0008','return limb(name, base, tip, 0.0025, 0.0004')
source=source.replace("    # --- 1つのオブジェクトにまとめる", "    prepare_groups(parts)\n    # --- 1つのオブジェクトにまとめる")
source=source.replace('max(r1, 0.00065), max(r2, 0.00055), mat, segs=5)', 'max(r1, 0.00065), max(r2, 0.00055), mat, segs=3)')
exec(compile(source,'original_roach_base','exec'),globals())
original_ellipsoid=ellipsoid
# Longitudinal loft: broad shield and shingled plates instead of intersecting beads.
def ellipsoid(name,loc,scale,mat,rot=(0,0,0),segs=14,rings=8):
    if name.startswith('stripe'): return original_ellipsoid(name,(loc[0],loc[1],loc[2]+.007),(scale[0]*1.15,0.0035,0.002),mat,rot,segs=6,rings=4)
    if name not in ('pronotum','metanotum') and not name.startswith('tergite'):
        return original_ellipsoid(name,loc,scale,mat,rot,segs=min(segs,12),rings=min(rings,6))
    w,d,h=scale
    if name=='pronotum': profile=[(-1,.70,.50),(-.78,.94,.85),(-.40,1,.98),(0,.95,1),(.40,.81,.94),(.78,.55,.70),(1,.18,.20)]
    elif name=='metanotum': profile=[(-1,.75,.66),(-.80,.92,.86),(-.4,1,.97),(0,1,1),(.4,.99,.98),(.8,.90,.86),(1,.75,.70)]
    else: profile=[(-1,.12,.18),(-.8,.70,.76),(-.45,.94,.95),(0,1,1),(.45,.94,.96),(.8,.70,.76),(1,.10,.20)]
    vs=[]; faces=[]; sides=12
    for yy,ww,hh in profile:
        for i in range(sides):
            a=2*math.pi*i/sides
            vs.append((w*ww*math.cos(a),d*yy,h*hh*math.sin(a)))
    for j in range(len(profile)-1):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(range((len(profile)-1)*sides,len(profile)*sides))])
    me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.update()
    ob=_obj(name,me,mat);ob.location=loc; return ob

bones={}
def prepare_groups(parts):
    for ob in parts:
        name=ob.name.split('.')[0]; side='L' if ob.location.x<0 else 'R'; group='root'
        if name.startswith('leg'):
            group=f'{name}_{side}'
            direction=ob.rotation_euler.to_matrix() @ Vector((0,0,1))
            # Mesh cone depth, before object rotation.
            depth=max(v.co.z for v in ob.data.vertices)-min(v.co.z for v in ob.data.vertices)
            head=ob.location-direction*depth/2; tail=ob.location+direction*depth/2
            i,k=map(int,name[3:].split('_'));parent='root' if k==0 else f'leg{i}_{k-1}_{side}'
            bones[group]=(head,tail,parent)
        elif name.startswith('spine'):
            group=f'leg{name[5]}_2_{side}'
        elif name.startswith('ant'):
            group=f'antenna_{side}'
            s=-1 if side=='L' else 1
            bones[group]=(Vector((s*.055,.470,.145)),Vector((s*.12,.75,.17)),'root')
        ob.vertex_groups.new(name=group).add(list(range(len(ob.data.vertices))),1,'REPLACE')

outdir=os.path.join(BASE,'codex_v6');os.makedirs(outdir,exist_ok=True)
body=build();body.data.calc_loop_triangles()
ground_offset=-min(v.co.z for v in body.data.vertices)
for v in body.data.vertices:v.co.z+=ground_offset
# One PBR material with per-corner vertex colours; no external texture dependencies.
attr=body.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for poly in body.data.polygons:
    c=body.data.materials[poly.material_index].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
    for li in poly.loop_indices:attr.data[li].color=c
body.data.materials.clear();m=material('Nymph_VertexPBR','#FFFFFF',.34,.5,.16)
vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
m.node_tree.links.new(vc.outputs['Color'],m.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
body.data.materials.append(m)
for p in body.data.polygons:p.material_index=0
# Rigid segment skinning: one mesh, articulated legs and independently steerable antennae.
k=1/(.505-(-.310-.098*.84))
arm=bpy.data.armatures.new('NymphRig');rig=bpy.data.objects.new('NymphRig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;body.select_set(False);rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
r=arm.edit_bones.new('root');r.head=(0,0,.12*k);r.tail=(0,.12*k,.12*k)
for name,(head,tail,parent) in bones.items():
    b=arm.edit_bones.new(name);b.head=head*k+Vector((0,0,ground_offset));b.tail=tail*k+Vector((0,0,ground_offset));b.parent=arm.edit_bones.get(parent)
bpy.ops.object.mode_set(mode='OBJECT');body.parent=rig
mod=body.modifiers.new('Skeleton','ARMATURE');mod.object=rig
rig['note']='Rigid limb articulation. Walk is a draft cycle, no IK or guaranteed foot locking.'
scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=25
for frame in (1,7,13,19,25):
    phase=(frame-1)/24*math.tau
    for name in bones:
        pb=rig.pose.bones[name];pb.rotation_mode='XYZ'
        if name.startswith('leg'):
            i=int(name[3]);segment=int(name[5]);sign=1 if name.endswith('L') else -1
            offset=0 if (i%2==0)==(sign==1) else math.pi
            pb.rotation_euler=(0,0,sign*.24*math.sin(phase+offset)) if segment==0 else (.16*max(0,math.sin(phase+offset)) if segment==2 else 0,0,0)
        else:pb.rotation_euler=(0,0,.065*math.sin(phase))
        pb.keyframe_insert(data_path='rotation_euler',frame=frame)
rig.animation_data.action.name='Walk_Draft'
scene.frame_set(1)
# Rest pose export and walk clip are both included.
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir,'nymph.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True)
tris=len(body.data.loop_triangles)
assert tris<=4000, tris
minimum=min(v.co.z for v in body.data.vertices)
assert minimum>=-.006,minimum
studio()
VIEWS=[('top',(0,.65,6.0),(0,.65,.09),34),('body',(0,.06,2.8),(0,.06,.12),34),('quarter',(2.15,2.95,3.65),(0,.35,.10),38),('side',(4.8,.45,.38),(0,.45,.10),38)]
for name,loc,look,fov in VIEWS:
    for ob in list(bpy.data.objects):
        if ob.type=='CAMERA':bpy.data.objects.remove(ob,do_unlink=True)
    camera(loc,look,fov);render(os.path.join(outdir,'nymph_'+name+'.png'))
# Open the .blend on a useful camera view.
for ob in list(bpy.data.objects):
    if ob.type=='CAMERA':bpy.data.objects.remove(ob,do_unlink=True)
camera((2.15,2.95,3.65),(0,.35,.10),38)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir,'nymph.blend'))
with open(os.path.join(outdir,'nymph.glb'),'rb') as f:
    f.read(12);n,t=struct.unpack('<II',f.read(8));g=json.loads(f.read(n))
report={'triangles':tris,'materials':len(g.get('materials',[])),'primitives':sum(len(x['primitives']) for x in g['meshes']),'bones':len(arm.bones),'animations':[a.get('name') for a in g.get('animations',[])],'minimum_mesh_z':minimum,'body_length_convention':1.0,'glb_bytes':os.path.getsize(os.path.join(outdir,'nymph.glb'))}
assert report['primitives']==1
assert all('COLOR_0' in p['attributes'] and 'JOINTS_0' in p['attributes'] for x in g['meshes'] for p in x['primitives'])
with open(os.path.join(outdir,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print('VALIDATED',report)
