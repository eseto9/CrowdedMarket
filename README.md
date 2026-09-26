# Crowded Market

Run a stall on a busy island market street, seen from above. Stock up at the suppliers round
the edge, price it right, pitch to customers and have the most coins when the closing bell
rings. Single player against AI shopkeepers, built so it can go multiplayer later.

How it plays and how it's built: [DESIGN.md](DESIGN.md).

```
src/index.html       page template (markup; <!-- @styles --> and <!-- @app --> markers)
src/css/NN-*.css     styles, concatenated in filename order
src/js/NN-*.js       game code, concatenated in filename order inside one IIFE
  01–04              engine, Wanderbeans, townsfolk and audio (from Whereabouts)
  10–12              tuning, simulation and AI: plain JS, no browser (they also run in Node)
  20–30              the board, the world in motion, HUD, input, the game loop, boot
tests/               `npm test`: the simulation and AI, no browser needed
tools/build.mjs      → dist/crowded-market.html (one file) and docs/index.html (GitHub Pages)
tools/dev-server.mjs local test server with live reload and source maps
```

The JS files are consecutive slices of one closure, not ES modules: every top-level name is
visible to every file, and the number prefix sets load order.

```
npm run dev     # http://localhost:5179   (add ?play to go straight into a day)
npm test        # simulation and AI tests
npm run build   # dist/crowded-market.html + docs/index.html
```

## GitHub Pages

`docs/index.html` is the whole game in one file. With Pages set to deploy from the `main`
branch, `/docs` folder, it's served at `https://<you>.github.io/CrowdedMarket/`.
Run `npm run build` before committing so `docs/` matches `src/`.
