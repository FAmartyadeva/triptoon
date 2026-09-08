# TripToon

TripToon is a zero-paid-API animated travel map MVP.

## What it does
- Uses an embedded SVG world map
- Uses an embedded local city database
- Lets users create multi-city trips
- Supports plane, car, train, and ship animations
- Draws animated routes
- Shows a vertical 9:16 preview
- Exports WebM in-browser
- Makes no calls to Google Maps, Mapbox, HERE, or paid routing APIs

## Run locally
No installation is required.

Option A: double-click `index.html`.

Option B, recommended if your browser blocks a local feature:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy on Vercel
This project is static. Import the GitHub repository into Vercel and deploy with Framework Preset set to `Other`. No build command is required.

## Files
- `index.html` — page structure and embedded SVG map
- `styles.css` — design
- `app.js` — city data, route logic, animation, and WebM export

## Important MVP limitation
Car/train/ship routes are stylized curves between city coordinates, not real road/rail/sea routing. That is intentional so the app remains completely API-free.
