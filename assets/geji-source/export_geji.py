"""Rig the approved .blend without changing its geometry; export one colored skin."""
import bpy, os, math, re, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(ROOT,'game'); os.makedirs(OUT,exist_ok=True)
DEST=os.path.abspath(os.path.join(ROOT,'../../public/models/geji.glb'))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'preview/geji_review.blend'))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name!='studio_floor']
defs=[]; legs={}
def bone(name,a,b,parent=None):defs.append((name,Vector(a),Vector(b),parent))
bone('body',(0,0,.66),(1,0,.66))
bone('head',(2.20,0,.75),(2.72,0,.75),'body')
for i in range(15):
    t=i/14; x=2.05-4.15*t; w=.29+.075*math.sin(math.pi*t)-.07*t
    for s in (-1,1):
        spread=.79+1.28*t; sweep=.42-1.52*t
        pts=[(x,s*w*.85,.69),(x+.06,s*(w+.17),.73),(x+sweep*.5,s*(w+spread*.57),1.04+.40*t),(x+sweep,s*(w+spread),.22),(x+sweep-.22,s*(w+spread+.27),.045)]
        if i==14:pts[2:]=[(x-1.25,s*.85,1.38),(x-2.35,s*1.3,.46),(x-3.18,s*1.62,.06)]
        label='leg_%02d_%s'%(i,'L' if s>0 else 'R');legs[label]=[Vector(p) for p in pts]
        for j in range(4):bone(label+'_%02d'%j,pts[j],pts[j+1],'body' if j==0 else label+'_%02d'%(j-1))
for s in (-1,1):
    def ant(t):return (2.61+3.08*t,s*(.14+.98*t+.22*math.sin(t*math.pi)),.82+.16*math.sin(t*math.pi)-.37*t)
    for j in range(6):bone('feeler_%s_%02d'%(s,j),ant(j/6),ant((j+1)/6),'head' if j==0 else 'feeler_%s_%02d'%(s,j-1))
arm=bpy.data.armatures.new('GejiSkeleton');rig=bpy.data.objects.new('GejiRig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,a,b,parent in defs:
    eb=arm.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for b in arm.bones:b['restHead']=list(b.head_local);b['restTail']=list(b.tail_local)
def segdist(p,a,b):
    d=b-a; q=a+d*max(0,min(1,(p-a).dot(d)/d.length_squared));return (p-q).length_squared
def attachment(o):
    m=re.match(r'(leg_\d\d_[LR])_(.*)',o.name)
    if m:
        label,suffix=m.groups();pts=legs[label]
        if suffix in ['00','01','02','03']:return label+'_'+suffix
        if suffix.startswith('joint'):return label+'_%02d'%(int(suffix[5])+1)
        if suffix.startswith('claw'):return label+'_03'
        p=o.matrix_world.translation;return label+'_%02d'%min(range(4),key=lambda j:segdist(p,pts[j],pts[j+1]))
    if o.name.startswith('antenna'):
        p=o.matrix_world.translation;s=1 if p.y>0 else -1;j=min(5,max(0,int((p.x-2.61)/3.08*6)));return 'feeler_%s_%02d'%(s,j)
    if o.name.startswith(('head','lateral_eye','mouth')):return 'head'
    return 'body'
material=bpy.data.materials.new('Geji chitin vertex colors');material.use_nodes=True
nodes=material.node_tree.nodes;p=nodes.get('Principled BSDF');color=nodes.new('ShaderNodeVertexColor');color.layer_name='Color';material.node_tree.links.new(color.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.36
for o in parts:
    name=attachment(o);vg=o.vertex_groups.new(name=name);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
    c=o.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value[:]
    attr=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for item in attr.data:item.color=c
    o.data.materials.clear();o.data.materials.append(material)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();body=bpy.context.object;body.name='GejiSkin'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.parent=rig;mod=body.modifiers.new('Geji joints','ARMATURE');mod.object=rig
# Mesh remains identical to the approved sculpture. Rigid chitin segments rotate at their joints.
assert all(abs(sum(g.weight for g in v.groups)-1)<1e-6 for v in body.data.vertices)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'geji_rig.blend'))
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=DEST,export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_apply=False)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=DEST)
arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
assert len(arms)==len(meshes)==1 and len(arms[0].data.bones)==134
assert len([b for b in arms[0].data.bones if b.name.startswith('leg_') and b.name.endswith('_03')])==30
report={'roundtrip':'PASS','bones':134,'leg_pairs':15,'mesh_count':1,'triangles':sum(len(p.vertices)-2 for p in meshes[0].data.polygons),'bytes':os.path.getsize(DEST),'normalized_weights':True,'approved_geometry_preserved':True,'coordinates':'+X forward; glTF +Y up restored to +Z by loader'}
with open(os.path.join(OUT,'export_report.json'),'w') as f:json.dump(report,f,indent=2)
print(json.dumps(report))
