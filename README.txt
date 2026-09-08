TripToon - Logical Maritime Routing

Major change:
- Ship routes no longer use airplane-like direct curves.
- Ship mode now uses a local maritime waypoint graph.
- The graph includes major global sea corridors/chokepoints such as:
  Malacca Strait, Indian Ocean, Gulf of Aden, Bab-el-Mandeb,
  Red Sea, Suez Canal, Mediterranean, Gibraltar, Cape of Good Hope,
  Panama and North Pacific/Bering alternatives.
- Dijkstra shortest-path routing selects a logical maritime corridor.
- Plane keeps the aerial curve.
- Car/train architecture remains separate and can next be upgraded to dedicated road/rail graphs.

No paid API or runtime map request is introduced.
Replace app.js from this ZIP.
