TripToon - Maritime Routing V2 + Seamless Country Borders

Fixes:
1. Cape Town -> Los Angeles can now route logically through:
   South Atlantic -> Caribbean -> Panama Canal -> Eastern Pacific -> California.
2. Ship routes start/end from offshore approach points, not city-centre coordinates on land.
3. Maritime graph was expanded substantially across Atlantic, Indian and Pacific oceans.
4. Ship routes use multiple sea waypoints and may bend many times instead of drawing a straight line.
5. Country rendering now uses a land underlay + separate fills + separate border strokes.
   This removes the visible blue gaps between neighbouring countries caused by SVG anti-aliasing.

Runtime API cost remains zero.

Replace:
- app.js
- world-data.js (included for consistency)
