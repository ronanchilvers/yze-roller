# Bundle Analysis Baseline

This document records the bundle analysis baseline after enabling manual chunking and the bundle visualizer.

## How to Generate

Run:

- `npq-hero run analyze`

This builds with `--mode analyze` and writes the report to:

- `dist/bundle-stats.html`

## Baseline (analyze build)

From the latest analyze build:

- `dist/index.html` — 1.17 kB (gzip: 0.59 kB)
- `dist/assets/index-D_TDbBsO.css` — 5.72 kB (gzip: 1.85 kB)
- `dist/assets/DiceTray3D-CLyA3uAR.js` — 12.57 kB (gzip: 5.16 kB)
- `dist/assets/cannon-es-_bXOrp7B.js` — 84.40 kB (gzip: 24.57 kB)
- `dist/assets/index-DCyFouLv.js` — 148.44 kB (gzip: 48.46 kB)
- `dist/assets/three-DSu9_x9b.js` — 863.10 kB (gzip: 234.21 kB)

## Notes

- `three` and `cannon-es` are now split into their own chunks via `manualChunks`.
- The Three.js chunk remains the largest payload; future optimization work should focus there.
- The visual report in `dist/bundle-stats.html` provides a detailed dependency breakdown.

## Next Steps

- Re-run after any dependency or import changes to track progress.
- Consider additional tree-shaking or selective imports for Three.js modules.