"""
Headless Blender rigging script - Bimble TV 3D pipeline.

Cinevva/Mesh2Motion denemeleri (2026-09-05) ya "basik" (dusuk-poly) mesh
gerektiriyordu ya da rig animasyonda bozuluyordu. Bu script Blender'i
"--background --python" ile CLI'dan calistirip YUKSEK-poly (790K vertex,
dokulu) Bimble mesh'ini dogrudan rigliyor - poligon siniri yok, ucretsiz,
tek seferlik kurulum sonrasi tekrar kullanilabilir.

Kullanim:
    blender --background --python rig_bimble.py -- \
        --input C:/path/bimble_hi.glb \
        --output C:/path/bimble_rigged.glb

Yaklasim:
    1. GLB'yi import et.
    2. Mesh'in bounding box'indan orana gore (T-pose/A-pose varsayimiyla)
       basit bir biped iskelet olustur (kalca->omurga->kafa, 2x bacak,
       2x kol) - Bimble'in oranlarina gore yuzde/fraksiyon olarak.
    3. Armature'a "Automatic Weights" (heat-map) ile parent et.
    4. Birkac basit keyframe animasyonu uret (idle, walk) - toddler
       temposunda (yavas), bizim kontrolumuzde.
    5. GLB olarak export et (skin+animasyon dahil).
"""
import bpy
import sys
import argparse
import math
import numpy as np


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--fps", type=int, default=30)
    return p.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.armatures):
        bpy.data.armatures.remove(block)


def import_mesh(path):
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("GLB icinde mesh bulunamadi")
    # Birden fazla mesh parcasi varsa tek objede birlestir (armature'a
    # tek parent icin gerekli).
    if len(meshes) > 1:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.join()
    mesh_obj = bpy.context.view_layer.objects.active
    return mesh_obj


def build_armature(mesh_obj):
    # Mesh'in dunya-uzayi bounding box'i - Blender import sonrasi Z-up.
    corners = [mesh_obj.matrix_world @ v.co for v in mesh_obj.data.vertices]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    height = max_z - min_z
    width = max_x - min_x
    cx = (min_x + max_x) / 2
    cy = (min_y + max_y) / 2
    print(f"DEBUG bbox x=[{min_x:.3f},{max_x:.3f}] y=[{min_y:.3f},{max_y:.3f}] "
          f"z=[{min_z:.3f},{max_z:.3f}] height={height:.3f} width={width:.3f} "
          f"mesh_obj.location={tuple(mesh_obj.location)} "
          f"mesh_obj.scale={tuple(mesh_obj.scale)}")

    def pt(frac_h, frac_w=0.0, y=None):
        return (
            cx + frac_w * (width / 2),
            cy if y is None else y,
            min_z + frac_h * height,
        )

    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm_obj = bpy.context.object
    arm_obj.name = "BimbleArmature"
    ebones = arm_obj.data.edit_bones
    ebones.remove(ebones[0])  # varsayilan tek kemigi sil

    def add_bone(name, head, tail, parent=None, connect=False):
        b = ebones.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = parent
            b.use_connect = connect
        return b

    # Govde: kalca (root) -> omurga -> kafa-tabani -> kafa-tepesi
    # NOT (2026-09-05): head bonu 0.68'den basliyordu ama Bimble'in yanak/
    # agiz bolgesi gorsel olarak daha asagida (~0.55-0.60) - o bolgedeki
    # vertexler en yakin kemik olarak SPINE'a atanip agiz kafayla degil
    # govdeyle hareket ediyordu ("agiz havada asili kaliyor"). Siniri
    # asagi cektik.
    hips = add_bone("hips", pt(0.30), pt(0.55))
    spine = add_bone("spine", pt(0.55), pt(0.58), hips, True)
    head = add_bone("head", pt(0.58), pt(1.0), spine, True)
    print(f"DEBUG hips.head={tuple(hips.head)} hips.tail={tuple(hips.tail)} "
          f"head.head={tuple(head.head)} head.tail={tuple(head.tail)} "
          f"arm_obj.matrix_world={arm_obj.matrix_world}")

    # Bacaklar: kalca -> diz -> ayak (asagi dogru, govdenin biraz disinda)
    for side, sign in (("L", 1), ("R", -1)):
        thigh = add_bone(f"thigh.{side}", pt(0.30, 0.18 * sign), pt(0.14, 0.18 * sign), hips)
        add_bone(f"shin.{side}", pt(0.14, 0.18 * sign), pt(0.0, 0.18 * sign), thigh, True)

    # Kollar: govde-ust yaninda -> disari -> el (Bimble kollari govdeden
    # yatay/hafif asagi cikiyor, T-pose'a yakin).
    for side, sign in (("L", 1), ("R", -1)):
        upper = add_bone(
            f"upper_arm.{side}",
            pt(0.58, 0.35 * sign),
            pt(0.52, 0.62 * sign),
            spine,
        )
        add_bone(f"hand.{side}", pt(0.52, 0.62 * sign), pt(0.50, 0.85 * sign), upper, True)

    bone_defs = [(b.name, tuple(b.head), tuple(b.tail)) for b in ebones]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj, bone_defs


def point_segment_dist_sq(points, a, b):
    """points: (N,3) numpy array. a,b: (3,) bone head/tail. Vektorize edilmis
    en yakin nokta-segment mesafesi (karesi, sqrt gerekmiyor - sadece siralama icin)."""
    ab = b - a
    ab_len_sq = float(np.dot(ab, ab))
    if ab_len_sq < 1e-12:
        diff = points - a
        return np.einsum("ij,ij->i", diff, diff)
    t = np.clip(np.einsum("ij,j->i", points - a, ab) / ab_len_sq, 0.0, 1.0)
    proj = a + np.outer(t, ab)
    diff = points - proj
    return np.einsum("ij,ij->i", diff, diff)


def assign_weights(mesh_obj, arm_obj, bone_defs):
    """Blender'in 'Automatic Weights' (heat-solver) bu mesh'te (muhtemelen
    AI-uretimi mesh'in bozuk/non-manifold topolojisi yuzunden) TAMAMEN
    basarisiz oluyordu (0/790965 vertex agirlik aldi - 2026-09-05 bulgusu).
    Heat-solver'a bagimli kalmadan, kemik SEGMENTINE en yakin 2 kemigi
    ters-mesafe agirlikla harmanlayan basit/saglam bir skinning uyguluyoruz.
    """
    n = len(mesh_obj.data.vertices)
    coords = np.empty(n * 3, dtype=np.float64)
    mesh_obj.data.vertices.foreach_get("co", coords)
    coords = coords.reshape(n, 3)
    mw = np.array(mesh_obj.matrix_world)
    world_coords = coords @ mw[:3, :3].T + mw[:3, 3]

    names = [d[0] for d in bone_defs]
    dist_sq = np.stack([
        point_segment_dist_sq(world_coords, np.array(head), np.array(tail))
        for _, head, tail in bone_defs
    ], axis=1)  # (N, num_bones)

    order = np.argsort(dist_sq, axis=1)
    nearest2 = order[:, :2]
    d0 = np.take_along_axis(dist_sq, nearest2[:, 0:1], axis=1)[:, 0]
    d1 = np.take_along_axis(dist_sq, nearest2[:, 1:2], axis=1)[:, 0]
    d0 = np.sqrt(np.maximum(d0, 1e-9))
    d1 = np.sqrt(np.maximum(d1, 1e-9))
    w0 = d1 / (d0 + d1)
    w1 = 1.0 - w0

    for bone_idx, name in enumerate(names):
        mesh_obj.vertex_groups.new(name=name)

    QUANT = 20  # agirligi %5'lik kovalara yuvarlayip cagri sayisini azalt
    for slot, weight_col in ((0, w0), (1, w1)):
        bone_col = nearest2[:, slot]
        q = np.round(weight_col * QUANT).astype(np.int32)
        for bone_idx in range(len(names)):
            vg = mesh_obj.vertex_groups[bone_idx]
            mask_bone = bone_col == bone_idx
            if not np.any(mask_bone):
                continue
            for qv in np.unique(q[mask_bone]):
                w = qv / QUANT
                if w <= 0.0:
                    continue
                idx = np.nonzero(mask_bone & (q == qv))[0]
                vg.add(idx.tolist(), float(w), "REPLACE")

    mod = mesh_obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    mesh_obj.parent = arm_obj
    mesh_obj.matrix_parent_inverse = arm_obj.matrix_world.inverted()

    total_with_weight = sum(1 for v in mesh_obj.data.vertices if len(v.groups) > 0)
    print(f"DEBUG vertices_with_any_weight={total_with_weight}/{n}")


def make_action(arm_obj, name, fps, duration_sec, pose_fn):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    # KRITIK: pose bone'larin varsayilan rotation_mode'u QUATERNION - bu
    # mod acikken rotation_euler'e yazip keyframe'lemek SESSIZCE HICBIR
    # ETKI yapmiyor (2026-09-05 bulgusu: butun eksenlerde buyuk aci
    # denendi, sifir gorsel hareket cikti). Euler kullanacaksak mod'u
    # ONCE XYZ'ye almak sart.
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"
    action = bpy.data.actions.new(name)
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action
    n_frames = int(duration_sec * fps)
    for frame in range(n_frames + 1):
        bpy.context.scene.frame_set(frame)
        t = frame / n_frames if n_frames else 0
        pose_fn(arm_obj.pose.bones, t)
        for pb in arm_obj.pose.bones:
            pb.keyframe_insert(data_path="rotation_euler", frame=frame)
            pb.keyframe_insert(data_path="location", frame=frame)
    action.use_fake_user = True
    bpy.ops.object.mode_set(mode="OBJECT")
    return action


def reset_pose(bones):
    for pb in bones:
        pb.rotation_euler = (0, 0, 0)


def idle_pose(bones, t):
    reset_pose(bones)
    # Yavas nefes-alma sallanmasi (toddler temposunda, ~2.5sn dongude yumusak).
    sway = math.sin(t * 2 * math.pi) * 0.05
    bones["spine"].rotation_euler[0] = sway
    bones["upper_arm.L"].rotation_euler[2] = sway * 0.6
    bones["upper_arm.R"].rotation_euler[2] = -sway * 0.6


def walk_pose(bones, t):
    reset_pose(bones)
    # Toddler temposunda yuruyus (2026-09-05: "sallanma/titreme var, gercek
    # yuruyus yok" geri bildirimi sonrasi genlik buyutuldu + kalca yanal
    # agirlik-aktarimi (sway) ve karsi-donusu eklendi - saf sinus tek
    # eksende buyumek yerine "yuruyor" hissi vermesi icin bunlar sart).
    phase = t * 2 * math.pi
    swing = math.sin(phase) * 0.65
    lift_l = max(0.0, math.sin(phase)) ** 1.3
    lift_r = max(0.0, -math.sin(phase)) ** 1.3
    bones["thigh.L"].rotation_euler[0] = swing
    bones["thigh.R"].rotation_euler[0] = -swing
    bones["shin.L"].rotation_euler[0] = lift_l * 1.1
    bones["shin.R"].rotation_euler[0] = lift_r * 1.1
    bones["upper_arm.L"].rotation_euler[0] = -swing * 0.55
    bones["upper_arm.R"].rotation_euler[0] = swing * 0.55
    # Agirlik-aktarimi: kalca yana kaysın (o an basan bacagin ustune) +
    # hafif dondur, govde tersine hafif dondur (kontr-rotasyon) - gercek
    # yuruyuste govde/kalca birbirine ters doner, bu olmadan "kayma" gibi
    # gorunuyordu.
    hip_sway = math.sin(phase) * 0.035
    bones["hips"].location[0] = hip_sway
    bones["hips"].rotation_euler[1] = math.sin(phase) * 0.12
    bones["spine"].rotation_euler[1] = -math.sin(phase) * 0.08
    bones["spine"].rotation_euler[2] = swing * 0.1
    bones["hips"].location[2] = abs(math.sin(phase * 2)) * 0.02


def main():
    args = parse_args()
    clear_scene()
    mesh_obj = import_mesh(args.input)
    arm_obj, bone_defs = build_armature(mesh_obj)
    assign_weights(mesh_obj, arm_obj, bone_defs)

    bpy.context.scene.render.fps = args.fps
    make_action(arm_obj, "Idle", args.fps, 2.5, idle_pose)
    make_action(arm_obj, "Walk", args.fps, 2.4, walk_pose)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=True,
        export_force_sampling=True,
        export_nla_strips=False,
    )
    print(f"OK: exported {args.output}")


if __name__ == "__main__":
    main()
