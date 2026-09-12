"""Run against the saved review .blend; exercise skinning without exporting."""
import bpy, json, math, os
from mathutils import Vector
rig=bpy.data.objects['Gecko_Rig']; body=bpy.data.objects['Gecko_skin_deform']
dg=bpy.context.evaluated_depsgraph_get()
def coords():
    bpy.context.view_layer.update(); ob=body.evaluated_get(dg); me=ob.to_mesh(); points=[v.co.copy() for v in me.vertices]; ob.to_mesh_clear(); return points
rest=coords(); assert all(len(v.groups)>0 and abs(sum(g.weight for g in v.groups)-1)<1e-5 for v in body.data.vertices)
tests={}
for name in ['spine_front','tail_03','fore_L_lower','hind_R_upper','fore_L_digit3_02']:
    pb=rig.pose.bones[name]; pb.rotation_mode='XYZ'; pb.rotation_euler.y=math.radians(12)
    moved=coords(); delta=max((a-b).length for a,b in zip(rest,moved)); assert delta>1e-4,name
    assert all(math.isfinite(c) for p in moved for c in p)
    tests[name]=delta; pb.rotation_euler=(0,0,0)
reset=coords(); assert max((a-b).length for a,b in zip(rest,reset))<1e-6
minimum=min(p.z for p in rest)
report={'bones':len(rig.data.bones),'weighted_vertices':len(body.data.vertices),'evaluated_vertices':len(rest),'weight_normalization':'PASS','pose_response_and_reset':'PASS','pose_max_displacement':tests,'rest_mesh_min_z':minimum,'wall_z':-.005,'wall_penetration':max(0,-.005-minimum),'toe_bones':len([b for b in rig.data.bones if 'digit' in b.name]),'motion_quality':'NOT VALIDATED; these are deformation smoke checks only'}
path=os.path.join(os.path.dirname(bpy.data.filepath),'rig_validation.json')
with open(path,'w') as f:json.dump(report,f,indent=2)
print('RIG_VALIDATION',json.dumps(report))
