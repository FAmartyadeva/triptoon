TripToon update - Smaller Car + More Accurate World Map

Changes:
1. Car sprite reduced from 33x33 to 27x27 SVG units so its apparent size is closer to the train.
2. Map projection changed from simple equirectangular projection to Web Mercator.
3. Country geometry, city markers, routes and vehicles all use the same projection.
4. Country borders use thinner rounded joins for a cleaner cartographic look.
5. world-data.js is bundled locally; no runtime map API is required.
6. Per-leg duration, alphabetical Country/City selector, custom PNG vehicles, mode-aware zoom and smooth transitions are preserved.

Replace app.js AND world-data.js with the files in this ZIP.
