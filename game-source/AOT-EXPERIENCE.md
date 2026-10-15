# Attack on Titan picture entrance

Updated 14 October 2026 at the user's request. The active AoT entrance now uses the approved generated concept artwork instead of the Blender render.

The artwork preserves the cinematic wall, closed gate, lanterns, outpost and foreground gear. Baked-in mockup text/buttons and the Titan were removed with the built-in image tool. Actual HTML title and controls remain readable, clickable and localized.

Select Attack on Titan or open /?home=1&theme=attack-on-titan. Tap the gate itself or Enter the gate to start a 4.15-second entry sequence: the two photographed wooden leaves swing inward, reveal a textured stone passage, and the view moves through the arch before returning focus to the real room form. Reduced motion skips the sequence. Skip to room and Escape return immediately. The sequence pauses while the tab is hidden, resumes when visible, and exits immediately if reduced motion is enabled during travel. Sound-on adds original synthesized wood creak and low rumble. Back and Escape return immediately. The lobby can reopen the artwork while waiting. Sound is an original, quiet synthesized drone and starts muted.

## Active assets

- public/assets/aot/outpost-art.webp: 852 x 1846 pixels, 327,652 bytes.
- src/aot-entrance.mjs and public/aot-entrance.js: lightweight entrance controller; the gate transition uses lightweight DOM/CSS transforms and a separate sharp close-up image.
- public/assets/aot/passage.webp: 971 x 1619 pixels, 359,504 bytes, generated stone passage artwork.
- AOT-PASSAGE-SOURCE.json: built-in generation provenance and exact prompt.
- public/aot-portal.css: scoped, responsive entrance layout.
- AOT-ART-SOURCE.json: built-in image edit provenance and exact final prompt.

The active AoT entrance downloads no GLB, uses no WebGL canvas, and has no fake drag-to-spin hint. All Blender source files, GLBs, and the previous 3D module remain on disk for later work.

## Changed files for the picture switch

- Added src/aot-entrance.mjs, public/aot-entrance.js and public/assets/aot/outpost-art.webp.
- Updated public/app.js, public/index.html, public/aot-portal.css and build.mjs.
- Regenerated the ignored src/public-files.json and dist/server/index.js.
- Updated test/aot-portal.test.mjs, this document, and added AOT-ART-SOURCE.json.
- The source PNG is also saved locally as ../attack-on-titan-background.png.

## Checks

Browser checks pass at 390 x 844, 320 x 568 (Georgian, reduced motion), 844 x 390, and 1440 x 960. Checked image loading, no GLB/WebGL requests, 48px tap targets, sound, controls, room-form focus, real room creation, lobby reopening, Escape, image-load failure recovery, and Dark's five-year timeline. The Worker asset test and existing AoT/Dark game tests pass. Actual screenshots and the report are in ../aot-blender/renders/art-* and ../aot-blender/art-browser-checks.json.

Physical iPhone Safari has not been tested.

## Gate animation update

Changed src/aot-entrance.mjs, public/aot-entrance.js, public/aot-portal.css, public/app.js, public/index.html, build.mjs, test/aot-portal.test.mjs and this document. Added public/assets/aot/passage.webp and AOT-PASSAGE-SOURCE.json. Regenerated the ignored Worker asset bundle and deployment output. The source PNG is ../attack-on-titan-passage.png.

Gate checks pass at 390 x 844, 320 x 568 with reduced motion, 844 x 390 and 1440 x 960. Verified both door rotations, camera approach, room-form focus, Skip, Escape, direct door tapping, tab-visibility pause/resume, and changing reduced motion during entry. Screenshots and the report are in ../aot-blender/renders/gate-* and ../aot-blender/gate-browser-checks.json. No Blender files were changed for this animation.

## Loading and mobile review

The entrance now waits for the passage image before opening the doors. Missing artwork goes directly to the room; a slow image gets a visible preparation message and Skip control, with a four-second timeout. Disposing the entrance cancels that timeout, so it cannot close a later visit. Landscape controls respect left/right notch insets and the bottom home indicator.

Changed src/aot-entrance.mjs, public/aot-portal.css, generated public/aot-entrance.js, public/app.js and public/index.html cache versions, and this document. No artwork or Blender files changed.

## Performance optimization

The passage is rasterized at its maximum display size on resize and animated with transforms/opacity. It no longer changes width, height, left and top every frame. Portrait phones skip the obscured background blur layer; permanent world-layer promotion is limited to travel. Public static responses use build-derived content ETags and 304 validation, keeping game API responses unchanged. The AoT URL sends an artwork preload header to start its main image before app initialization.

Three local Edge runs at 390 x 844, DPR 3 and 4x CPU throttling: layout counts 544/550/540 before, 5/5/5 after. Average main-thread TaskDuration fell from 1.998 seconds to 0.883 seconds. This is a controlled desktop comparison, not a physical iPhone benchmark or FPS guarantee. Browser repeat-load checks transferred 300 bytes of response overhead per image instead of their 687,156 combined body bytes.

All 26 Worker/game tests pass, including new static-cache tests. Browser checks cover gate travel at four sizes, reduced motion, Skip, delayed/failed image loading, timeout cleanup and return navigation. Before/after reports: ../aot-blender/perf-baseline.json and perf-optimized.json.

Changed src/aot-entrance.mjs, public/aot-portal.css, generated public/aot-entrance.js, public/app.js, public/index.html, build.mjs, src/worker.mjs, test/static-cache.test.mjs and this document. Source artwork and Blender files are preserved.
