# TripToon V7 — Fullscreen Map

A zero-paid-API travel animation MVP.

## V7 changes
- The map now fills the entire 9:16 video frame.
- Route/vehicle rendering is clipped to the video frame, so it can no longer visually escape a smaller map card.
- Replaced hand-drawn continent silhouettes with bundled Natural Earth low-resolution country boundaries.
- Country shapes are rendered locally from `world-data.js`; there is no runtime map API call.
- Camera continues to follow the active leg.
- Leg timing remains proportional to Haversine distance.
- Updated journey overlay, route styling, vehicle artwork, and bottom status card.

## Run locally
Open `index.html` directly in Chrome/Edge, or serve the folder with any static server.

## Deploy
Upload all files in this folder to the root of your GitHub repository and deploy as a static project on Vercel.

Files:
- `index.html`
- `styles.css`
- `app.js`
- `world-data.js`

No npm install, build command, API key, Google Maps, Mapbox, or routing API is required.
