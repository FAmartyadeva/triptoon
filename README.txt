TripToon - Maritime V3 / Sea Collision Avoidance + Perfect Route Sync

Fix 1 — Ship stays on water:
- Every ship segment is now checked against the actual bundled country polygons.
- If a segment crosses land, the engine inserts additional water waypoints.
- The route may bend several times around coastlines/islands.
- Existing offshore port approach points and global maritime chokepoint graph remain.

Fix 2 — Vehicle and route animation synchronized:
- The moving vehicle and the completed route line now use the exact same eased progress.
- The completed line is constructed geometrically up to the vehicle's current position.
- This removes the previous mismatch at short/long user-entered durations.

No paid API and no runtime routing request.

Replace:
- app.js
- world-data.js
