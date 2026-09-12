"""Clean the baked game source and round-trip the game GLB, including weights/pose."""
import bpy, os, json, math
ROOT=os.path.dirname(os.path.abspath(__file__)); DEST=os.path.abspath(os.path.join(ROOT,'../../public/models/gecko.glb'))
body=bpy.data.objects['Gecko_GameSkin']; rig=bpy.data.objects['Gecko_Rig']
bpy.context.view_layer.objects.active=body; bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
mesh_repaired=body.data.validate(verbose=True,clean_customdata=True); body.data.update()
bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
rig.select_set(True); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'game/gecko_game.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=DEST,export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True,export_apply=False,export_all_influences=False)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=DEST)
arms=[o for o in bpy.data.objects if o.type=='ARMATURE']; meshes=[o for o in bpy.data.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]; assert len(arms)==1 and len(meshes)==1
arm=arms[0]; ob=meshes[0]; assert len(arm.data.bones)==68
assert all(v.groups and abs(sum(g.weight for g in v.groups)-1)<1e-4 and len(v.groups)<=4 for v in ob.data.vertices)
assert all(math.isfinite(c) for v in ob.data.vertices for c in v.co)
assert 'fore_L_digit3_02' in arm.data.bones and 'tail_08' in arm.data.bones
embedded=[i for i in bpy.data.images if i.type=='IMAGE']; assert len(embedded)>=2
report={'roundtrip':'PASS','bones':len(arm.data.bones),'mesh_count':len(meshes),'vertices':len(ob.data.vertices),'triangles':sum(len(p.vertices)-2 for p in ob.data.polygons),'max_vertex_influences':max(len(v.groups) for v in ob.data.vertices),'normalized_weights':True,'images':len(embedded),'bytes':os.path.getsize(DEST),'mesh_repaired':mesh_repaired}
with open(os.path.join(ROOT,'game/roundtrip_validation.json'),'w') as f:json.dump(report,f,indent=2)
print('GECKO_ROUNDTRIP',json.dumps(report))
