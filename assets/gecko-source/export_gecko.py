"""Approved review blend -> texture-baked, rigged game GLB. Run with Blender 4.0."""
import bpy, os, math, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(ROOT,'game'); os.makedirs(OUT,exist_ok=True)
DEST=os.path.abspath(os.path.join(ROOT,'../../public/models/gecko.glb'))
rig=bpy.data.objects['Gecko_Rig']; body=bpy.data.objects['Gecko_skin_deform']
# Keep the approved authoring file intact. Tiny dorsal tubercles become shader detail at game scale.
for ob in list(bpy.data.objects):
    if ob!=rig and (ob.type!='MESH' or ob.parent!=rig or ob.name.startswith('Dorsal tubercle')):bpy.data.objects.remove(ob,do_unlink=True)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for ob in meshes:
    bpy.context.view_layer.objects.active=ob
    for mod in list(ob.modifiers):
        if mod.type!='ARMATURE':ob.modifiers.remove(mod)
    if ob==body or len(ob.data.polygons)>1200:
        dec=ob.modifiers.new('Game mesh reduction','DECIMATE'); dec.ratio=.19 if ob==body else .3
        bpy.ops.object.modifier_apply(modifier=dec.name)
# One skinned mesh and one material keeps the per-frame render cost bounded.
bpy.ops.object.select_all(action='DESELECT')
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=body; bpy.ops.object.join(); body.name='Gecko_GameSkin'
for poly in body.data.polygons:poly.use_smooth=True
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.008); bpy.ops.object.mode_set(mode='OBJECT')
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=1; sc.cycles.use_denoising=False
sc.render.bake.margin=12; sc.render.bake.use_selected_to_active=False; sc.render.bake.use_pass_direct=False; sc.render.bake.use_pass_indirect=False; sc.render.bake.use_pass_color=True
images={}
for kind,size in [('DIFFUSE',2048),('NORMAL',2048)]:
    im=bpy.data.images.new('Gecko_'+kind,width=size,height=size,alpha=False)
    if kind=='NORMAL':im.colorspace_settings.name='Non-Color'
    for mat in body.data.materials:
        if not mat or not mat.use_nodes:continue
        for node in mat.node_tree.nodes:node.select=False
        node=mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=im; node.select=True; mat.node_tree.nodes.active=node
    print('BAKE',kind,flush=True); bpy.ops.object.bake(type=kind)
    im.filepath_raw=os.path.join(OUT,'gecko_'+kind.lower()+'.png'); im.file_format='PNG'; im.save(); im.pack(); images[kind]=im
mat=bpy.data.materials.new('Gecko baked skin'); mat.use_nodes=True; n=mat.node_tree.nodes; l=mat.node_tree.links; p=n.get('Principled BSDF'); p.inputs['Roughness'].default_value=.74
tex=n.new('ShaderNodeTexImage'); tex.image=images['DIFFUSE']; l.new(tex.outputs['Color'],p.inputs['Base Color'])
tex=n.new('ShaderNodeTexImage'); tex.image=images['NORMAL']; normal=n.new('ShaderNodeNormalMap'); l.new(tex.outputs['Color'],normal.inputs['Color']); l.new(normal.outputs['Normal'],p.inputs['Normal'])
body.data.materials.clear(); body.data.materials.append(mat)
for poly in body.data.polygons:poly.material_index=0
body.data.validate(verbose=True,clean_customdata=True); body.data.update()
bpy.context.view_layer.objects.active=body
bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
# Export rest metadata in Blender-local coordinates; runtime converts glTF +Y-up back to wall +Z.
rig['nose']=[3.12,0,.22]; rig['contactZ']=.0012583263451233506
rig['runtime']='distance-driven planted feet / articulated spine and tail; no baked locomotion clip'
for bone in rig.data.bones:
    bone['restHead']=list(bone.head_local); bone['restTail']=list(bone.tail_local)
# Rig is authored +X forward / +Z back; glTF conversion is +X forward / +Y back.
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); body.select_set(True); bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'gecko_game.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=DEST,export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_apply=False,export_all_influences=False)
tri=sum(len(p.vertices)-2 for p in body.data.polygons)
report={'vertices':len(body.data.vertices),'triangles':tri,'bones':len(rig.data.bones),'materials':1,'texture_size':2048,'bytes':os.path.getsize(DEST),'export':'GLB','forward':'+X','native_dorsal':'+Y','runtime_dorsal':'+Z','authoring_blend_unchanged':True}
with open(os.path.join(OUT,'export_report.json'),'w') as f:json.dump(report,f,indent=2)
print('GECKO_EXPORT',json.dumps(report),flush=True)
