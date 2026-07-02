#!/usr/bin/env python3
"""
Bake position map từ mannequin.glb — nền tảng cho 3D-distance brush (ADR-001).

Với mỗi texel (u,v) trên texture 512x512: tìm tam giác UV chứa texel đó,
nội suy barycentric vị trí bind-pose (x,y,z) của 3 đỉnh -> texel biết
"mình nằm ở đâu trên cơ thể 3D". Brush 3D chỉ cần so khoảng cách thật,
không còn khái niệm biên UV -> không còn gì để "cắt xén" (root cause đã đo).

Output:
- position_map.bin : Float32Array [512*512*3], texel không phủ UV = NaN
- position_map.meta.json : kích thước, bounding box, thống kê coverage

Cùng phương pháp rasterize-từng-tam-giác đã dùng để tạo paint_region_mask.png
(xem comment trong paintRegistry.ts) — pipeline đã quen thuộc với dự án.
"""
import json
import struct
import numpy as np
from pygltflib import GLTF2

GLB_PATH = "/home/claude/chameleon-hide-seek/client/public/models/mannequin.glb"
OUT_BIN = "/home/claude/chameleon-hide-seek/client/public/textures/position_map.bin"
OUT_META = "/home/claude/chameleon-hide-seek/client/public/textures/position_map.meta.json"
SIZE = 512  # khớp CANVAS_SIZE trong paintRegistry.ts

def read_accessor(g, accessor_idx, blob):
    acc = g.accessors[accessor_idx]
    bv = g.bufferViews[acc.bufferView]
    comp_type = {5120: np.int8, 5121: np.uint8, 5122: np.int16,
                 5123: np.uint16, 5125: np.uint32, 5126: np.float32}[acc.componentType]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc.type]
    offset = (bv.byteOffset or 0) + (acc.byteOffset or 0)
    arr = np.frombuffer(blob, dtype=comp_type, count=acc.count * ncomp, offset=offset)
    return arr.reshape(acc.count, ncomp)

def main():
    g = GLTF2().load(GLB_PATH)
    blob = g.binary_blob()
    prim = g.meshes[0].primitives[0]

    # Mesh nén Draco (KHR_draco_mesh_compression) — accessor không có bufferView,
    # phải decode buffer nén rồi map attribute theo id trong extension.
    import DracoPy
    ext = prim.extensions["KHR_draco_mesh_compression"]
    bv = g.bufferViews[ext["bufferView"]]
    draco_bytes = blob[(bv.byteOffset or 0):(bv.byteOffset or 0) + bv.byteLength]
    mesh = DracoPy.decode(draco_bytes)

    pos = np.asarray(mesh.points, dtype=np.float64)          # bind-pose POSITION
    tris = np.asarray(mesh.faces, dtype=np.int64)
    # TEXCOORD_0: DracoPy trả attribute phụ qua id — tìm theo unique_id khớp ext["attributes"]
    uv = None
    tex_attr_id = ext["attributes"]["TEXCOORD_0"]
    for attr in getattr(mesh, "attributes", []):
        if getattr(attr, "unique_id", None) == tex_attr_id:
            uv = np.asarray(attr.data, dtype=np.float64).reshape(-1, 2)
            break
    if uv is None and hasattr(mesh, "tex_coord") and mesh.tex_coord is not None and len(mesh.tex_coord):
        uv = np.asarray(mesh.tex_coord, dtype=np.float64).reshape(-1, 2)
    assert uv is not None, "Không tìm được TEXCOORD_0 trong dữ liệu Draco"
    assert len(uv) == len(pos), f"UV count {len(uv)} != POSITION count {len(pos)}"
    print(f"Mesh (Draco decoded): {len(pos)} vertices, {len(tris)} tris")

    # position map: (SIZE, SIZE, 3), hàng 0 = v gần 1 (đỉnh ảnh) — khớp quy ước
    # canvas trong paintRegistry.ts: cy = (1 - v) * CANVAS_SIZE
    pmap = np.full((SIZE, SIZE, 3), np.nan, dtype=np.float32)

    for tri in tris:
        a, b, c = tri
        # toạ độ texel của 3 đỉnh (x = u*SIZE, y = (1-v)*SIZE)
        pts = np.array([
            [uv[a][0] * SIZE, (1 - uv[a][1]) * SIZE],
            [uv[b][0] * SIZE, (1 - uv[b][1]) * SIZE],
            [uv[c][0] * SIZE, (1 - uv[c][1]) * SIZE],
        ])
        xmin = max(0, int(np.floor(pts[:, 0].min())))
        xmax = min(SIZE - 1, int(np.ceil(pts[:, 0].max())))
        ymin = max(0, int(np.floor(pts[:, 1].min())))
        ymax = min(SIZE - 1, int(np.ceil(pts[:, 1].max())))
        if xmax < xmin or ymax < ymin:
            continue

        # barycentric trên lưới texel trong bbox
        x0, y0 = pts[0]; x1, y1 = pts[1]; x2, y2 = pts[2]
        denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(denom) < 1e-12:
            continue
        xs = np.arange(xmin, xmax + 1) + 0.5
        ys = np.arange(ymin, ymax + 1) + 0.5
        gx, gy = np.meshgrid(xs, ys)
        w0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / denom
        w1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / denom
        w2 = 1 - w0 - w1
        eps = -1e-6  # nới nhẹ để texel sát cạnh tam giác không bị bỏ trống
        inside = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
        if not inside.any():
            continue
        interp = (w0[..., None] * pos[a] + w1[..., None] * pos[b] + w2[..., None] * pos[c])
        region = pmap[ymin:ymax + 1, xmin:xmax + 1]
        region[inside] = interp[inside].astype(np.float32)

    covered = ~np.isnan(pmap[:, :, 0])
    print(f"Coverage: {covered.sum()} / {SIZE*SIZE} texel ({covered.mean()*100:.1f}%)")

    finite = pmap[covered]
    bbox_min = finite.min(axis=0).tolist()
    bbox_max = finite.max(axis=0).tolist()
    print(f"Bind-pose bbox: min={bbox_min}, max={bbox_max}")

    pmap.tofile(OUT_BIN)
    meta = {
        "size": SIZE,
        "channels": 3,
        "dtype": "float32",
        "layout": "row-major, y=0 là đỉnh ảnh (v gần 1), khớp canvas paintRegistry",
        "coverage_pct": round(float(covered.mean() * 100), 2),
        "bbox_min": bbox_min,
        "bbox_max": bbox_max,
        "source": "mannequin.glb mesh[0] POSITION (bind-pose, chưa skin)",
    }
    with open(OUT_META, "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"Đã ghi: {OUT_BIN} ({SIZE*SIZE*3*4/1024/1024:.1f} MB) + meta")

if __name__ == "__main__":
    main()
