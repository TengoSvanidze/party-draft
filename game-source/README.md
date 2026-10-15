# Party Draft finished source

Source for the released Party Draft game, including the optimized Attack on Titan entrance, door opening and passage animation.

Install Node.js 22 or newer. From this directory run:

```sh
npm ci
npm run build
npm test
```

The build generates `dist/server/index.js`, a Cloudflare Worker requiring the D1 binding `DB`. Database migrations are in `drizzle/`. Deploy through a compatible Worker host and bind your database. Secrets, local databases, dependencies and generated bundles are excluded from this source snapshot.

The GitHub Pages frontend is published from `../docs/` and connects to the existing Party Draft backend. Blender assets remain preserved locally; the active Attack on Titan entrance uses the approved artwork and a lightweight CSS/DOM transition.

All 26 game and Worker tests passed for this release. The optimization measurements and implementation notes are documented in `AOT-EXPERIENCE.md`.
