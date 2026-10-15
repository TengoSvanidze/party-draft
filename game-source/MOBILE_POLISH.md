# Mobile presentation pass

The home page now uses swipeable theme cards. The Dark scene retains the approved Blender cave, five years, original audio, introduction, inertia and wormhole. Its portrait layout uses a compact heading, bottom timeline, one entry action and a native dialog for secondary controls. Safe-area insets and dynamic viewport height keep controls away from iPhone browser chrome. Name fields use 16px text to avoid focus zoom.

The default scene uses charcoal, muted mustard and restrained blue. Year changes interpolate lighting and material tints. Procedural ground and bark relief, scattered-stone contact shading, a soft rim light and sharper adaptive rendering improve depth. A brief ripple responds to touching/spinning the triquetra. Reduced motion disables the ripple and animated transitions. The original Blender materials, GLBs and .blend files remain untouched.

## Verification

- Existing 23 game tests passed.
- Browser checks: 320×568, 375×667, 390×844, 430×932, 844×390 and 1440×960; English and Georgian.
- Verified viewport width, primary touch-target bounds, dialog dismissal/focus return, all years, reduced motion, audio, inertia, replay, wormhole, cleanup and room creation.
- Visual review of home, Dark scene, controls sheet and wormhole screenshots.
- These are desktop browser mobile emulations, not physical iPhone Safari or a hardware frame-rate certification. The renderer still adapts resolution for slower GPUs.

## Changed and added files

- `public/app.js`: theme carousel markup, selection positioning and bundle version.
- `public/style.css`: home typography, cards, form touch sizing.
- `public/dark-portal.css`: portrait/landscape layout, safe areas, control sheet and palette.
- `public/index.html`: asset cache versions.
- `src/dark-portal.mjs`: dialog controls, page-scroll lifecycle and touch ripple.
- `src/dark-scene.mjs`: lighting, surfaces, contact shading, era blending and render resolution.
- `src/dark-config.mjs`: default palette and era caption.
- `src/dark-surfaces.mjs`: generated seamless surface relief and terrain coloring.
- `public/dark-portal.js`: generated browser bundle.
- `src/public-files.json`: generated Worker asset registry.
- `MOBILE_POLISH.md`: this record.
