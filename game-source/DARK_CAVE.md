# Blender cave in the original Dark scene

Only the cave entrance and passage replace the procedural cave. The original
forest, ground, camera, five years, UI, introduction, audio, triquetra inertia,
flashlight and wormhole remain. The original surrounding boulders remain, too.
After the camera enters the cave, its passage dissolves into the existing
wormhole so the Blender tunnel walls do not obscure the travel animation.

The source is `art/winden-soft-contact.blend`, which is never overwritten by
either export script. Its 12 cliff blocks, 9 fractured exterior pieces and
vaulted passage are combined into one browser mesh. Other Blender objects,
lights, fog, props, trees and camera are excluded. The source's scanned mineral,
moss and wet-contact shaders are baked into color, normal and roughness maps.
The existing year palettes tint those maps without replacing them.

| Asset | Geometry | Download | Textures |
| --- | ---: | ---: | --- |
| `public/assets/dark/winden-cave.glb` | 184,178 triangles | 4.17 MB | 2K color/normal, 1K roughness |
| `public/assets/dark/winden-cave-mobile.glb` | 84,946 triangles | 1.91 MB | 1K color/normal/roughness |

Both files contain `BlenderCave`, `CaveMouth`, `CaveFloor`, and `CaveRoof` nodes,
one material (`Cave · baked approved stone and moss`), three embedded WebP
textures, and no animations. glTF up is +Y; the entrance faces +Z. Named anchors
fit the opening to the existing scene without moving its camera. Meshopt
compression and the decoder are local to the site. The hosted worker permits
WebAssembly compilation for that decoder; JavaScript eval remains blocked.

The cave is loaded only when the Dark portal opens. Loading progress comes from
downloaded bytes. Phones use the smaller model. A failed model download falls
back to the original procedural cave. Closing the portal cancels loading and
disposes mesh geometry, materials and textures. Existing reduced-motion,
visibility pause and adaptive rendering behavior is retained.

To rebuild from the unchanged Blender source:

```text
blender --background art/winden-soft-contact.blend --python tools/export-dark-cave.py
node tools/optimize-dark-cave.mjs
node build.mjs
```

Blender's source meshes and high-detail project files remain in `art/`. They
are not shipped to the browser. The baked materials retain the source project's
Poly Haven CC0 texture scans.
