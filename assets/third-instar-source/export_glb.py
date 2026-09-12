"""Export approved static sculpture only; never writes public/models or game code."""
import bpy, os, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
OUT=os.path.join(ROOT,'export');os.makedirs(OUT,exist_ok=True)
DEST=os.path.join(OUT,'roach-third-instar.glb')
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'preview/third_instar_review.blend'))
parts=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name!='studio floor']
def stats(objects):
 points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
 return {'objects':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),'bounds_min':[min(p[i] for p in points) for i in range(3)],'bounds_max':[max(p[i] for p in points) for i in range(3)]}
before=stats(parts)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
# glTF preserves PBR color/roughness. Blender's procedural Noise/Bump is unsupported.
# Remove only the nonportable bump connection in this export scene, not in the source.
for m in {m for o in parts for m in o.data.materials}:
 p=m.node_tree.nodes.get('Principled BSDF')
 for link in list(p.inputs['Normal'].links):m.node_tree.links.remove(link)
bpy.ops.export_scene.gltf(filepath=DEST,export_format='GLB',use_selection=True,export_yup=True,export_animations=False,export_extras=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=DEST)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
after=stats(meshes)
assert before['objects']==after['objects']
assert before['triangles']==after['triangles']
assert max(abs(before[k][i]-after[k][i]) for k in ['bounds_min','bounds_max'] for i in range(3))<1e-5
assert not any(o.type in ['CAMERA','LIGHT','ARMATURE'] or o.name=='studio floor' for o in bpy.context.scene.objects)
assert all(o.data.materials and all(m.use_nodes for m in o.data.materials) for o in meshes)
report={'roundtrip':'PASS','before':before,'after':after,'bytes':os.path.getsize(DEST),'materials':len({m.name for o in meshes for m in o.data.materials}),'static_asset':True,'rigged':False,'animations':0,'source_coordinates':'+X forward / +Z dorsal','gltf_coordinates':'+X forward / +Y dorsal (export_yup conversion)','material_limitation':'PBR base color and roughness preserved; procedural microscopic Noise/Bump not included','production_integrated':False}
with open(os.path.join(OUT,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print(json.dumps(report))
