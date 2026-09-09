import bpy, math, os
from mathutils import Vector

# Preview-only centipede study. No glTF/GLB export is performed.
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, metallic=0.0, rough=.45):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1); p.inputs['Roughness'].default_value=rough; p.inputs['Metallic'].default_value=metallic
    return m
SHELL=mat('blue-black dorsal plates',(0.035,.055,.047),.28,.31)
GROOVE=mat('plate edge',(0.012,.017,.014),.15,.38)
UNDER=mat('olive underside',(.10,.105,.065),.05,.56)
LEG=mat('ochre legs',(.62,.32,.075),.02,.46)
HEAD=mat('red-brown head',(.23,.035,.014),.12,.42)
TIP=mat('dark tips',(.035,.012,.007),.05,.4)
EYE=mat('black eyes',(.003,.003,.002),.5,.18)

def uv(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material); bpy.ops.object.shade_smooth(); return o
def box(name, loc, scale, material, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.scale=scale; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('hard edge chamfer','BEVEL'); b.width=bevel; b.segments=1; o.data.materials.append(material); return o
def cone_between(name, a, b, r1, r2, material, verts=8):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=d.length, location=(a+b)/2)
    o=bpy.context.object; o.name=name; o.data.materials.append(material); o.rotation_mode='QUATERNION'; o.rotation_quaternion=Vector((0,0,1)).rotation_difference(d.normalized()); return o
def plate(name, x, y, z, width, length, h):
    bpy.ops.mesh.primitive_cube_add(location=(x,y,z)); o=bpy.context.object; o.name=name; o.scale=(width,length,h); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new('soft plate corners','BEVEL'); bevel.width=.075; bevel.segments=2; o.data.materials.append(SHELL)
    cone_between(name+'_rear',(x-width*.77,y-length*.82,z+h*.66),(x+width*.77,y-length*.82,z+h*.66),.018,.018,GROOVE,6)

# +Y is head direction and +Z dorsal/up; shallow S pose.
count=13; centers=[]
for i in range(count):
    t=i/(count-1); y=.95-i*.205; x=.11*math.sin(t*math.pi*1.15); z=.235-.035*t; centers.append((x,y,z))
    w=.265*(1-.22*t)+.015*math.sin(t*math.pi); plate('tergite_%02d'%i,x,y,z,w,.128,.09*(1-.1*t)); uv('sternite_%02d'%i,(x,y,z-.075),(w*.76,.12,.052),UNDER)
    if 1 <= i <= 11:
        for side in (-1,1):
            root=(x+side*w*.70,y-.01,z-.035); knee=(x+side*(w+.18),y-.09,z-.10); ankle=(x+side*(w+.28),y-.235,z-.14); tip=(x+side*(w+.34),y-.30,z-.16)
            tag='L' if side<0 else 'R'; cone_between('leg_%02d_%s_upper'%(i,tag),root,knee,.036,.027,LEG); cone_between('leg_%02d_%s_lower'%(i,tag),knee,ankle,.027,.017,LEG); cone_between('leg_%02d_%s_tarsus'%(i,tag),ankle,tip,.017,.005,TIP)

hx,hy,hz=centers[0]; box('head',(hx,hy+.19,hz+.015),(.285,.215,.14),HEAD,.04); box('head_shield',(hx,hy+.34,hz+.07),(.235,.12,.09),HEAD,.025)
# A hard shield and recessed side eyes prevent a friendly face-like front.
cone_between('shield_keel',(hx,hy+.25,hz+.145),(hx,hy+.43,hz+.135),.025,.013,GROOVE,6)
for side in (-1,1):
    cone_between('shield_ridge_'+str(side),(hx+side*.16,hy+.18,hz+.115),(hx+side*.20,hy+.41,hz+.105),.018,.008,GROOVE,6)
    box('eye_'+str(side),(hx+side*.287,hy+.205,hz+.067),(.007,.024,.011),EYE,.003)
    # paired mouthparts sit below the shield, with dark cutting tips.
    cone_between('mandible_'+str(side),(hx+side*.075,hy+.39,hz-.005),(hx+side*.145,hy+.49,hz-.065),.045,.018,HEAD,7)
    cone_between('mandible_tip_'+str(side),(hx+side*.145,hy+.49,hz-.065),(hx+side*.19,hy+.55,hz-.085),.020,.004,TIP,7)
for side in (-1,1):
    a=(hx+side*.11,hy+.36,hz+.045); b=(hx+side*.24,hy+.58,hz+.09); c=(hx+side*.34,hy+.78,hz+.04); d=(hx+side*.39,hy+.94,hz-.035)
    cone_between('antenna_base_'+str(side),a,b,.018,.012,HEAD,7); cone_between('antenna_mid_'+str(side),b,c,.012,.007,HEAD,7); cone_between('antenna_tip_'+str(side),c,d,.007,.002,TIP,7)
    r=(hx+side*.24,hy+.17,hz-.02); k=(hx+side*.39,hy+.02,hz-.10); q=(hx+side*.48,hy-.10,hz-.12)
    cone_between('forcipule_'+str(side),r,k,.04,.025,HEAD); cone_between('forcipule_tip_'+str(side),k,q,.025,.006,TIP)

tx,ty,tz=centers[-1]
for side in (-1,1):
    a=(tx+side*.14,ty-.12,tz); b=(tx+side*.38,ty-.34,tz+.025); c=(tx+side*.57,ty-.49,tz+.01)
    cone_between('terminal_leg_base_'+str(side),a,b,.045,.026,HEAD); cone_between('terminal_leg_tip_'+str(side),b,c,.026,.006,TIP)

# The lowest tarsus bound is z=.019486; the floor is deliberately coplanar.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,.019486)); bpy.context.object.name='contact_floor'; bpy.context.object.data.materials.append(mat('background',(.018,.020,.018),0,.72))
world=bpy.data.worlds.new('World'); bpy.context.scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs['Color'].default_value=(.009,.011,.010,1); world.node_tree.nodes['Background'].inputs['Strength'].default_value=.18
for loc,energy,size,color in [((3,3,5),1050,4,(1.0,.73,.48)),((-3,1,2),550,3,(.32,.52,1.0)),((0,-3,3),400,3,(.6,.8,.62))]:
    bpy.ops.object.light_add(type='AREA', location=loc); l=bpy.context.object; l.data.energy=energy; l.data.shape='DISK'; l.data.size=size; l.data.color=color; l.rotation_euler=(Vector((0,-.3,0))-l.location).to_track_quat('-Z','Y').to_euler()
target=Vector((0,-.25,.02))
bpy.ops.object.camera_add(); cam=bpy.context.object; cam.name='render_camera'; cam.data.lens=58; cam.data.sensor_width=36; bpy.context.scene.camera=cam
sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.eevee.taa_render_samples=16; sc.render.resolution_x=960; sc.render.resolution_y=720; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.view_settings.look='AgX - Medium High Contrast'
views={
    'centipede_top.png':(0,-.25,5.8),
    'centipede_side.png':(4.9,-.25,.72),
    'centipede_oblique.png':(3.1,3.35,2.55),
    'centipede_front.png':(1.65,4.35,.78),
}
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'centipede_preview.blend'))
for filename,loc in views.items():
    cam.location=loc; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); sc.render.filepath=os.path.join(OUT,filename)
    bpy.ops.render.render(write_still=True); print('PREVIEW_RENDERED',sc.render.filepath)
