"""Render one view per Blender process to bound software-renderer memory."""
import bpy, os, sys
from mathutils import Vector
view=sys.argv[sys.argv.index('--')+1]
views={'top':(-1.4,0,15),'oblique':(5,-9,10),'side':(-1.4,-15,.20)}
sc=bpy.context.scene; cam=sc.camera; cam.location=views[view]
cam.rotation_euler=(Vector((-1.4,0,.20))-cam.location).to_track_quat('-Z','Y').to_euler()
if view=='top':cam.rotation_euler=(0,0,0)
if view=='side':
    sc.render.resolution_y=460
    # An infinitely thin plane is invisible at exactly 90 degrees. Show its solid edge.
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.505))
    wall_edge=bpy.context.object; wall_edge.name='Review only wall thickness'; wall_edge.scale=(30,10,1)
    wall_edge.data.materials.append(bpy.data.materials['Warm neutral plaster'])
    bg=sc.world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value=(.5,.5,.5,1)
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=32; sc.cycles.use_denoising=False
sc.cycles.max_bounces=4; sc.cycles.diffuse_bounces=2; sc.cycles.glossy_bounces=2
sc.render.filepath=os.path.join(os.path.dirname(bpy.data.filepath),'gecko_'+view+'.png')
bpy.ops.render.render(write_still=True)
