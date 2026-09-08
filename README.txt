TripToon - Mode-Aware Zoom + Smooth Transitions

Changes:
1. Plane and ship keep the current map zoom.
2. Car and train automatically zoom about 3x closer.
3. Camera transitions between legs are damped/smoothed to avoid snapping.
4. Vehicle motion uses smoothstep easing, making departure/arrival feel softer.
5. Existing distance-weighted trip timing remains unchanged.
6. Existing PNG filenames remain:
   - plane.png
   - mobil.png
   - kereta.png
   - kapal.png

Replace your existing app.js with the app.js in this ZIP.
