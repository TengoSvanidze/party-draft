# DARK: interactive welcome experience

The DARK category now uses the finished forest-cave Blender render as the background for room setup, joining and the waiting lobby. The earlier interactive introduction's source remains in the project; it no longer interrupts room setup.

## Integration

The existing app is vanilla browser ESM, built with esbuild and served by the existing Worker. Routing stays query-string based; fonts stay Segoe UI/system fonts. Selecting DARK shows the cinematic background behind the existing forms without a blocking introduction. Other themes do not request the background or the three.js bundle.

The waiting screen displays the actual number of drafters, updates as friends join, and is removed when the match starts. DARK invitations include `theme=dark`, so joining friends see the forest before entering their names. The image stays mounted across lobby updates. Forms retain entered names when changing language or switching between hosting and joining. The game rules, live room API and other categories are unchanged.

The backdrop comes from `art/winden-soft-contact-final.png`, rendered from the completed scene at 1920 × 1080 and 256 Cycles samples. It is a rendered background with subtle cursor parallax, not the high-poly Blender model running on a phone. `tools/build-dark-loading.mjs` generates 960/1920px AVIF and WebP variants. The largest AVIF is approximately 83 KB. Reduced motion disables parallax and the waiting animation. All listeners and pending animation frames are removed when leaving the waiting screen.

Loading-screen files: `public/dark-waiting.js`, `public/dark-waiting.css`, `public/assets/dark/winden-loading-*`, `public/app.js`, `public/index.html`, `build.mjs`, and `tools/build-dark-loading.mjs`. The existing game tests pass; the workspace browser check `work/dark-waiting-browser-check.mjs` verifies desktop/mobile joining, three live slots, narrator setup, match-start cleanup, Georgian, reduced motion and other-theme isolation.

## Retained interactive introduction source

- Click to begin unlocks Web Audio. Enter without intro stays silent. Mute works independently of game sound effects.
- The original 35-second introduction mirrors the actual 3D scene through a custom shader. Cards appear at 0, 7, 14, and 24 seconds; seconds 30–35 dissolve back into the cave.
- Skip or Escape enters the scene. A localStorage flag remembers a completed/skipped intro. Replay remains available. Storage-denied browsing still works.
- Timeline buttons, left/right arrows, or a horizontal swipe outside the cave select 1921, 1953, 1986, 2019, or 2052.
- Drag and release the triquetra to throw it; exponential friction slows its angular momentum consistently across frame rates. Grabbing a spinning knot stops it. A stationary tap starts it. Spin/stop and Reset view buttons are also available. Space spins/stops, R resets, F toggles the flashlight, and +/- approach or retreat when the canvas is focused. Mouse wheel moves the camera along the path. Reduced motion permits direct rotation but disables inertia.
- The knot has its own hit target, separate from the cave entrance. Click the cave, use the explicit cave button, or focus the canvas and press Enter to travel. Back/Escape returns from the arrival screen.
- Tilt is opt-in and requests platform permission when required. Touch, mouse and keyboard remain available if tilt is unavailable.
- Reduced motion skips the default intro and wormhole, removes drift, rain, flicker, grain and glitch animation. A manual Motion control is also available.

## Rendering and sound

The environment is modeled in Blender using `art/build_winden.py`, saved as editable `art/winden.blend`, and exported as `public/assets/dark/winden.glb`. The geometry and PBR maps are original and generated in code. No third-party models, footage, show logos, samples or music are fetched. DARK is plain typographic text. The score is an original C-minor progression synthesized with oscillators and filtered noise.

The reference-guided environment uses a low limestone shelf, a recessed dark passage, a dry dirt gully, mossy banks, roots, curled leaf litter, tall trunks and a weathered ochre chair. The supplied reference is not used as a background image. Geometry is batched by material with embedded WebP albedo, normal and roughness maps. Shadowed lighting grounds the objects. Bloom, vignette, color separation, ink and mirror effects share one post-process pass. Resolution is capped and adapts to sustained slow frames. Rendering/audio pause off screen or in a hidden tab. Performance depends on the GPU; 60 fps is a target, not a guarantee for every device. Physical-phone performance still needs user review.

Dispose cancels animation/timers and in-progress model downloads, aborts event listeners, disconnects observers, closes Web Audio, and disposes geometry, materials, textures, depth and color render targets, shadow maps and the WebGL renderer/context. Unsupported/lost WebGL provides a direct route to the room form. Embedded model textures use the DOM image loader to work with the existing image policy; there is no CSP relaxation or WebAssembly decoder.

## Files

- `src/dark-portal.mjs`: UI, interaction, lifecycle and accessibility.
- `src/dark-blender-scene.mjs`: Blender model loading, lighting, picking, particles, shader and adaptive rendering.
- `src/dark-motion.mjs`, `test/dark-motion.test.mjs`: frame-rate-independent inertia and its regression checks.
- `art/build_winden.py`, `art/optimize-winden.mjs`, `art/winden.blend`, `art/textures/`, `art/README.md`: editable scene and reproducible original asset pipeline.
- `public/assets/dark/winden.glb`: optimized browser environment.
- `src/dark-audio.mjs`: original score, ambience and sound cleanup.
- `src/dark-config.mjs`: eras, intro timing and seen-state helpers.
- `public/dark-portal.css`: scoped hero styles and reduced-motion/mobile variants.
- `public/app.js`: lazy home/lobby entry and exit to the existing site.
- `public/index.html`: scoped stylesheet link.
- `build.mjs`, `package.json`, `package-lock.json`: build route and pinned three.js dependency.
- `src/worker.mjs`: binary asset response using the same existing security policy.
- Generated: `public/dark-portal.js`, `src/public-files.json`, `dist/server/index.js`.

Build with `npm run build`. Existing game tests: `npm test`. The workspace browser check is `work/dark-portal-browser-check.mjs` and uses the existing local preview server. It exercises the real 35-second intro, sound, all eras, keyboard travel, replay, cleanup, room creation, lobby updates, Georgian/mobile/reduced motion and other-theme isolation.

References: [three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html), [DeviceOrientation permission](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).
