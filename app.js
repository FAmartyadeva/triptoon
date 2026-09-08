const WIDTH = 1080;
const HEIGHT = 1920;

// Keep the geographic map itself close to a 2:1 world-map ratio inside the 9:16 video.
const MAP = { x: 0, y: 0, width: 1080, height: 1080 };
const SCREEN = { width: WIDTH, height: HEIGHT };
const CAMERA_CENTER_Y = 980;

const cities = [
  ['Jakarta','Indonesia',106.8456,-6.2088],['Bali','Indonesia',115.1889,-8.4095],['Surabaya','Indonesia',112.7521,-7.2575],
  ['Singapore','Singapore',103.8198,1.3521],['Kuala Lumpur','Malaysia',101.6869,3.1390],['Bangkok','Thailand',100.5018,13.7563],
  ['Ho Chi Minh City','Vietnam',106.6297,10.8231],['Hanoi','Vietnam',105.8342,21.0278],['Manila','Philippines',120.9842,14.5995],
  ['Hong Kong','China',114.1694,22.3193],['Shenzhen','China',114.0579,22.5431],['Shanghai','China',121.4737,31.2304],
  ['Beijing','China',116.4074,39.9042],['Seoul','South Korea',126.9780,37.5665],['Tokyo','Japan',139.6503,35.6762],
  ['Osaka','Japan',135.5023,34.6937],['Kyoto','Japan',135.7681,35.0116],['Sydney','Australia',151.2093,-33.8688],
  ['Melbourne','Australia',144.9631,-37.8136],['Perth','Australia',115.8605,-31.9505],['Dubai','UAE',55.2708,25.2048],
  ['Doha','Qatar',51.5310,25.2854],['Istanbul','Türkiye',28.9784,41.0082],['Athens','Greece',23.7275,37.9838],
  ['Rome','Italy',12.4964,41.9028],['Paris','France',2.3522,48.8566],['London','United Kingdom',-0.1276,51.5072],
  ['Amsterdam','Netherlands',4.9041,52.3676],['Berlin','Germany',13.4050,52.5200],['Zurich','Switzerland',8.5417,47.3769],
  ['Madrid','Spain',-3.7038,40.4168],['New York','USA',-74.0060,40.7128],['Los Angeles','USA',-118.2437,34.0522],
  ['San Francisco','USA',-122.4194,37.7749],['Miami','USA',-80.1918,25.7617],['Toronto','Canada',-79.3832,43.6532],
  ['Vancouver','Canada',-123.1207,49.2827],['Mexico City','Mexico',-99.1332,19.4326],['Rio de Janeiro','Brazil',-43.1729,-22.9068],
  ['São Paulo','Brazil',-46.6333,-23.5505],['Buenos Aires','Argentina',-58.3816,-34.6037],['Cape Town','South Africa',18.4241,-33.9249],
  ['Johannesburg','South Africa',28.0473,-26.2041],['Cairo','Egypt',31.2357,30.0444],['Nairobi','Kenya',36.8219,-1.2921],
  ['Mumbai','India',72.8777,19.0760],['Delhi','India',77.1025,28.7041],['Bengaluru','India',77.5946,12.9716],
  ['Moscow','Russia',37.6173,55.7558],['Reykjavik','Iceland',-21.9426,64.1466],['Honolulu','USA',-157.8583,21.3069],
  ['Auckland','New Zealand',174.7633,-36.8485],['Santiago','Chile',-70.6693,-33.4489],['Lima','Peru',-77.0428,-12.0464]
].map(([name,country,lon,lat]) => ({name,country,lon,lat}));
cities.sort((a,b)=>a.country.localeCompare(b.country) || a.name.localeCompare(b.name));

const modes = {
  plane: {label:'Plane', emoji:'✈️'},
  car: {label:'Car', emoji:'🚗'},
  train: {label:'Train', emoji:'🚆'},
  ship: {label:'Ship', emoji:'🚢'}
};

let stops = [
  {city:'Jakarta',mode:'plane',duration:3},
  {city:'Singapore',mode:'plane',duration:20},
  {city:'Tokyo',mode:'plane',duration:0}
];
let progress = 0;
let playing = false;
let raf = null;
let animationToken = 0;

const stopsEl = document.getElementById('stops');
const routesEl = document.getElementById('routes');
const markersEl = document.getElementById('markers');
const vehicleEl = document.getElementById('vehicle');
const subtitleEl = document.getElementById('subtitle');
const journeyTitleEl = document.getElementById('journeyTitle');
const durationEl = document.getElementById('duration');
const durationLabelEl = document.getElementById('durationLabel');
if(durationEl){
  const legacyDurationWrap=durationEl.closest('.duration-control') || durationEl.parentElement;
  if(legacyDurationWrap) legacyDurationWrap.style.display='none';
}
const landEl = document.getElementById('continents');
const graticuleEl = document.getElementById('graticule');

function cityByName(name){ return cities.find(c => c.name === name); }
function project(lon,lat){
  // Web Mercator projection: closer to the geometry users are familiar with
  // from modern map applications. Clamp near the poles to avoid infinity.
  const maxLat=85.05112878;
  const clampedLat=Math.max(-maxLat,Math.min(maxLat,lat));
  const xNorm=(lon+180)/360;
  const latRad=clampedLat*Math.PI/180;
  const yNorm=(1-Math.log(Math.tan(latRad)+1/Math.cos(latRad))/Math.PI)/2;
  return {
    x: MAP.x + xNorm*MAP.width,
    y: MAP.y + yNorm*MAP.height
  };
}

// ---------- MODE-SPECIFIC ROUTE ENGINE ----------
// The map geometry and the transport network are separate concerns.
// Plane = great-circle-like visual path.
// Ship = maritime waypoint graph through logical sea corridors/chokepoints.
// Car/train = terrestrial corridor graph fallback (coarse, not street/rail level).

const PORT_APPROACHES = {
  'Tokyo':            {lon:140.2, lat:35.0},
  'Singapore':        {lon:103.75,lat:1.15},
  'Hong Kong':        {lon:114.35,lat:22.15},
  'Shanghai':         {lon:122.0, lat:31.0},
  'Manila':           {lon:120.7, lat:14.3},
  'Ho Chi Minh City': {lon:107.0, lat:10.2},
  'Sydney':           {lon:151.5, lat:-34.0},
  'Melbourne':        {lon:145.2, lat:-38.2},
  'Perth':            {lon:115.5, lat:-32.2},
  'Dubai':            {lon:55.0,  lat:25.0},
  'Doha':             {lon:51.3,  lat:25.2},
  'Mumbai':           {lon:72.5,  lat:18.8},
  'Istanbul':         {lon:29.1,  lat:40.8},
  'Athens':           {lon:23.5,  lat:37.7},
  'Rome':             {lon:12.0,  lat:41.6},
  'London':           {lon:1.6,   lat:51.0},
  'Cape Town':        {lon:18.0,  lat:-34.5},
  'Rio de Janeiro':   {lon:-43.0, lat:-23.2},
  'São Paulo':        {lon:-46.0, lat:-24.2},
  'Buenos Aires':     {lon:-57.5, lat:-35.0},
  'Miami':            {lon:-79.8, lat:25.4},
  'New York':         {lon:-73.4, lat:40.3},
  'Los Angeles':      {lon:-118.8,lat:33.6},
  'San Francisco':    {lon:-123.0,lat:37.5},
  'Vancouver':        {lon:-124.0,lat:49.1},
  'Lima':             {lon:-77.4, lat:-12.3},
  'Honolulu':         {lon:-158.2,lat:21.0},
  'Auckland':         {lon:174.5, lat:-37.1}
};

function seaEndpoint(city){
  return PORT_APPROACHES[city.name] || city;
}

const MARITIME_NODES = {
  // East / Southeast Asia
  japan_south:        {lon:141.5, lat:33.5},
  east_china_sea:     {lon:128.0, lat:26.0},
  philippine_sea:     {lon:132.0, lat:17.0},
  south_china_sea:    {lon:114.0, lat:12.0},
  malacca_east:       {lon:103.0, lat:1.2},
  malacca_west:       {lon:99.0,  lat:5.5},

  // Indian Ocean / Suez
  bay_of_bengal:      {lon:88.0,  lat:7.0},
  sri_lanka_south:    {lon:80.0,  lat:4.0},
  indian_central:     {lon:70.0,  lat:-8.0},
  arabian_sea:        {lon:62.0,  lat:11.0},
  gulf_of_aden:       {lon:48.0,  lat:12.0},
  bab_el_mandeb:      {lon:43.2,  lat:12.5},
  red_sea_south:      {lon:39.5,  lat:18.0},
  red_sea_mid:        {lon:36.5,  lat:23.5},
  red_sea_north:      {lon:34.0,  lat:27.5},
  suez_south:         {lon:32.55, lat:29.7},
  suez_north:         {lon:32.35, lat:31.4},

  // Mediterranean / Europe
  east_med:           {lon:27.0,  lat:34.0},
  central_med:        {lon:16.0,  lat:36.0},
  west_med:           {lon:3.0,   lat:37.0},
  gibraltar_east:     {lon:-4.5,  lat:36.0},
  gibraltar_west:     {lon:-8.0,  lat:35.5},
  iberia_atlantic:    {lon:-12.0, lat:41.0},
  bay_of_biscay:      {lon:-8.0,  lat:45.5},
  english_channel:    {lon:-3.0,  lat:49.5},

  // Africa / South Atlantic
  mozambique_channel: {lon:42.0,  lat:-20.0},
  cape_indian:        {lon:24.0,  lat:-36.0},
  cape_atlantic:      {lon:16.0,  lat:-36.0},
  namibia_offshore:   {lon:8.0,   lat:-25.0},
  south_atlantic_e:   {lon:-5.0,  lat:-15.0},
  south_atlantic_mid: {lon:-25.0, lat:-10.0},
  brazil_offshore:    {lon:-38.0, lat:-15.0},
  equatorial_atl:     {lon:-35.0, lat:5.0},
  north_atlantic_e:   {lon:-20.0, lat:35.0},
  north_atlantic_mid: {lon:-40.0, lat:30.0},
  north_atlantic_w:   {lon:-60.0, lat:30.0},

  // Caribbean / Panama
  caribbean_east:     {lon:-64.0, lat:17.0},
  caribbean_west:     {lon:-76.0, lat:16.0},
  panama_atlantic:    {lon:-79.7, lat:9.5},
  panama_pacific:     {lon:-80.2, lat:7.4},

  // Pacific Americas
  east_pacific_eq:    {lon:-90.0,  lat:2.0},
  mexico_pacific:     {lon:-105.0, lat:17.0},
  baja_offshore:      {lon:-116.0, lat:27.0},
  california_south:   {lon:-119.0, lat:33.0},
  california_north:   {lon:-124.5, lat:39.0},
  pacific_nw:         {lon:-128.0, lat:48.0},

  // Central / North Pacific
  hawaii_west:        {lon:-160.0, lat:20.0},
  north_pacific_mid:  {lon:-170.0, lat:35.0},
  bering_south:       {lon:175.0,  lat:52.0},

  // South Pacific
  south_pacific_e:    {lon:-120.0, lat:-25.0},
  south_pacific_mid:  {lon:-160.0, lat:-30.0},
  nz_north:           {lon:175.0,  lat:-35.0},
  australia_south:    {lon:135.0,  lat:-40.0},
  australia_west:     {lon:112.0,  lat:-30.0}
};

const MARITIME_EDGES = [
  // Asia to Malacca
  ['japan_south','east_china_sea'],
  ['japan_south','philippine_sea'],
  ['east_china_sea','south_china_sea'],
  ['philippine_sea','south_china_sea'],
  ['south_china_sea','malacca_east'],
  ['malacca_east','malacca_west'],

  // Malacca to Indian Ocean
  ['malacca_west','bay_of_bengal'],
  ['bay_of_bengal','sri_lanka_south'],
  ['sri_lanka_south','indian_central'],
  ['indian_central','arabian_sea'],
  ['arabian_sea','gulf_of_aden'],

  // Suez corridor
  ['gulf_of_aden','bab_el_mandeb'],
  ['bab_el_mandeb','red_sea_south'],
  ['red_sea_south','red_sea_mid'],
  ['red_sea_mid','red_sea_north'],
  ['red_sea_north','suez_south'],
  ['suez_south','suez_north'],
  ['suez_north','east_med'],
  ['east_med','central_med'],
  ['central_med','west_med'],
  ['west_med','gibraltar_east'],
  ['gibraltar_east','gibraltar_west'],
  ['gibraltar_west','iberia_atlantic'],
  ['iberia_atlantic','bay_of_biscay'],
  ['bay_of_biscay','english_channel'],

  // Around Africa
  ['indian_central','mozambique_channel'],
  ['mozambique_channel','cape_indian'],
  ['cape_indian','cape_atlantic'],
  ['cape_atlantic','namibia_offshore'],
  ['namibia_offshore','south_atlantic_e'],
  ['south_atlantic_e','south_atlantic_mid'],
  ['south_atlantic_mid','brazil_offshore'],
  ['brazil_offshore','equatorial_atl'],

  // Atlantic network
  ['equatorial_atl','north_atlantic_mid'],
  ['north_atlantic_mid','north_atlantic_e'],
  ['north_atlantic_e','gibraltar_west'],
  ['equatorial_atl','caribbean_east'],
  ['caribbean_east','caribbean_west'],
  ['caribbean_west','panama_atlantic'],
  ['north_atlantic_w','caribbean_east'],
  ['north_atlantic_mid','north_atlantic_w'],

  // *** Critical Cape Town -> Panama route ***
  ['south_atlantic_mid','equatorial_atl'],
  ['equatorial_atl','caribbean_east'],

  // Panama Canal into Pacific
  ['panama_atlantic','panama_pacific'],
  ['panama_pacific','east_pacific_eq'],
  ['east_pacific_eq','mexico_pacific'],
  ['mexico_pacific','baja_offshore'],
  ['baja_offshore','california_south'],
  ['california_south','california_north'],
  ['california_north','pacific_nw'],

  // Pacific routes
  ['east_pacific_eq','south_pacific_e'],
  ['south_pacific_e','south_pacific_mid'],
  ['south_pacific_mid','nz_north'],
  ['nz_north','australia_south'],
  ['australia_south','australia_west'],
  ['australia_west','indian_central'],

  ['california_south','hawaii_west'],
  ['hawaii_west','north_pacific_mid'],
  ['north_pacific_mid','bering_south'],
  ['bering_south','japan_south']
];

function geoDistanceKm(a,b){
  const R=6371, rad=d=>d*Math.PI/180;
  const dLat=rad(b.lat-a.lat), dLon=rad(b.lon-a.lon);
  const la1=rad(a.lat), la2=rad(b.lat);
  const h=Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}

function nearestMaritimeNode(point){
  let best=null,bestD=Infinity;
  for(const [id,n] of Object.entries(MARITIME_NODES)){
    const d=geoDistanceKm(point,n);
    if(d<bestD){bestD=d;best=id;}
  }
  return best;
}

function maritimeAdjacency(){
  const adj={};
  for(const id of Object.keys(MARITIME_NODES)) adj[id]=[];
  for(const [a,b] of MARITIME_EDGES){
    const w=geoDistanceKm(MARITIME_NODES[a],MARITIME_NODES[b]);
    adj[a].push([b,w]); adj[b].push([a,w]);
  }
  return adj;
}

const MARITIME_ADJ = maritimeAdjacency();

function shortestMaritimePath(startId,endId){
  const dist={}, prev={}, q=[];
  for(const id of Object.keys(MARITIME_NODES)) dist[id]=Infinity;
  dist[startId]=0;
  q.push([0,startId]);

  while(q.length){
    q.sort((a,b)=>a[0]-b[0]);
    const [d,u]=q.shift();
    if(d!==dist[u]) continue;
    if(u===endId) break;
    for(const [v,w] of MARITIME_ADJ[u]){
      const nd=d+w;
      if(nd<dist[v]){
        dist[v]=nd;
        prev[v]=u;
        q.push([nd,v]);
      }
    }
  }

  const ids=[];
  let cur=endId;
  while(cur){
    ids.push(cur);
    if(cur===startId) break;
    cur=prev[cur];
  }
  ids.reverse();
  return ids;
}

function shipRoutePoints(a,b){
  // IMPORTANT: animate from offshore approaches, not city centres on land.
  const seaA=seaEndpoint(a);
  const seaB=seaEndpoint(b);
  const startNode=nearestMaritimeNode(seaA);
  const endNode=nearestMaritimeNode(seaB);
  const ids=shortestMaritimePath(startNode,endNode);

  const mids=ids.map(id=>MARITIME_NODES[id]);

  // Deduplicate very close points so the ship does not jitter near ports.
  const pts=[seaA,...mids,seaB];
  const out=[];
  for(const p of pts){
    if(!out.length || geoDistanceKm(out[out.length-1],p)>35) out.push(p);
  }
  return out;
}

function routeForMode(a,b,mode){
  if(mode==='ship'){
    const pts=shipRoutePoints(a,b);
    const poly=polylinePath(pts);
    return {
      kind:'polyline',
      d:poly.d,
      points:poly.points,
      distanceKm:pts.slice(0,-1).reduce((s,p,i)=>s+geoDistanceKm(p,pts[i+1]),0)
    };
  }

  const base=curvePathBase(a,b,mode);
  return {
    kind:'quadratic',
    ...base,
    distanceKm:geoDistanceKm(a,b)
  };
}

function unwrapProjectedPoints(points){
  if(!points.length) return points;
  const out=[{...points[0]}];
  for(let i=1;i<points.length;i++){
    let p={...points[i]};
    const prev=out[i-1];
    while(p.x-prev.x > MAP.width/2) p.x-=MAP.width;
    while(p.x-prev.x < -MAP.width/2) p.x+=MAP.width;
    out.push(p);
  }
  return out;
}

function polylinePath(points){
  const projected=unwrapProjectedPoints(points.map(p=>project(p.lon,p.lat)));
  const d=projected.map((p,i)=>(i?'L':'M')+` ${p.x} ${p.y}`).join(' ');
  return {points:projected,d};
}

function shipRoutePoints(a,b){
  const startNode=nearestMaritimeNode(a);
  const endNode=nearestMaritimeNode(b);
  const ids=shortestMaritimePath(startNode,endNode);
  const mids=ids.map(id=>MARITIME_NODES[id]);

  // For nearby coastal endpoints avoid absurd detours through the global graph.
  const direct=geoDistanceKm(a,b);
  const graphLength=[a,...mids,b].slice(0,-1).reduce((sum,p,i)=>{
    const arr=[a,...mids,b];
    return sum+geoDistanceKm(arr[i],arr[i+1]);
  },0);

  if(graphLength > direct*2.3 && direct < 2500){
    return [a,b];
  }
  return [a,...mids,b];
}

function routeForMode(a,b,mode){
  if(mode==='ship'){
    const pts=shipRoutePoints(a,b);
    const poly=polylinePath(pts);
    return {
      kind:'polyline',
      d:poly.d,
      points:poly.points,
      distanceKm:pts.slice(0,-1).reduce((s,p,i)=>s+geoDistanceKm(p,pts[i+1]),0)
    };
  }

  // Existing quadratic curve remains the visual route for plane/car/train.
  const base=curvePathBase(a,b,mode);
  return {
    kind:'quadratic',
    ...base,
    distanceKm:geoDistanceKm(a,b)
  };
}

function polylinePoint(points,t){
  if(!points || points.length<2) return {x:0,y:0};
  const lengths=[], totalObj={v:0};
  for(let i=0;i<points.length-1;i++){
    const dx=points[i+1].x-points[i].x, dy=points[i+1].y-points[i].y;
    const len=Math.hypot(dx,dy); lengths.push(len); totalObj.v+=len;
  }
  let target=t*totalObj.v;
  for(let i=0;i<lengths.length;i++){
    if(target<=lengths[i] || i===lengths.length-1){
      const local=lengths[i] ? target/lengths[i] : 0;
      return {
        x:points[i].x+(points[i+1].x-points[i].x)*local,
        y:points[i].y+(points[i+1].y-points[i].y)*local
      };
    }
    target-=lengths[i];
  }
  return {...points[points.length-1]};
}

function polylineTangent(points,t){
  if(!points || points.length<2) return {x:1,y:0};
  const eps=0.002;
  const p1=polylinePoint(points,Math.max(0,t-eps));
  const p2=polylinePoint(points,Math.min(1,t+eps));
  return {x:p2.x-p1.x,y:p2.y-p1.y};
}

function curvePathBase(a,b,mode){
  const p1=project(a.lon,a.lat), p2=project(b.lon,b.lat);
  let dx=p2.x-p1.x, dy=p2.y-p1.y;
  // For long international routes, pick the visually shorter horizontal wrap.
  if(Math.abs(dx) > MAP.width/2){
    dx += dx > 0 ? -MAP.width : MAP.width;
  }
  const end={x:p1.x+dx,y:p2.y};
  const bend=mode==='plane'?0.20:mode==='ship'?0.13:0.045;
  const cx=(p1.x+end.x)/2-dy*bend, cy=(p1.y+end.y)/2+dx*bend;
  return {p1,p2:end,c:{x:cx,y:cy},d:`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${end.x} ${end.y}`};
}
function qPoint(p1,c,p2,t){const mt=1-t;return{x:mt*mt*p1.x+2*mt*t*c.x+t*t*p2.x,y:mt*mt*p1.y+2*mt*t*c.y+t*t*p2.y};}
function qTangent(p1,c,p2,t){return{x:2*(1-t)*(c.x-p1.x)+2*t*(p2.x-c.x),y:2*(1-t)*(c.y-p1.y)+2*t*(p2.y-c.y)};}
function getResolved(){return stops.map(s=>({...s,data:cityByName(s.city)})).filter(s=>s.data);}

function haversineKm(a,b){
  const R=6371;
  const toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const lat1=toRad(a.lat), lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}

function getSegments(){
  const r=getResolved();
  const segments=r.slice(0,-1).map((s,i)=>{
    const to=r[i+1].data;
    const route=routeForMode(s.data,to,s.mode);
    return {
      from:s.data,
      to,
      mode:s.mode,
      durationSec:legDurationSeconds(s),
      distanceKm:route.distanceKm,
      ...route
    };
  });
  const totalDuration=segments.reduce((sum,seg)=>sum+seg.durationSec,0) || 1;
  let cumulative=0;
  return segments.map(seg=>{
    const startShare=cumulative/totalDuration;
    cumulative+=seg.durationSec;
    const endShare=cumulative/totalDuration;
    return {...seg,startShare,endShare,share:endShare-startShare};
  });
}

function segmentProgress(seg,overallProgress){
  if(overallProgress<=seg.startShare) return 0;
  if(overallProgress>=seg.endShare) return 1;
  return (overallProgress-seg.startShare)/Math.max(seg.share,1e-9);
}

function activeSegmentAt(segments,overallProgress){
  if(!segments.length) return null;
  const p=Math.max(0,Math.min(0.999999999,overallProgress));
  const idx=Math.max(0,segments.findIndex(seg=>p<seg.endShare));
  const seg=segments[idx<0?segments.length-1:idx];
  return {seg,idx:idx<0?segments.length-1:idx,t:segmentProgress(seg,p)};
}
function esc(s){return String(s).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function legDurationSeconds(stop){
  const raw=Number(stop?.duration);
  return Number.isFinite(raw) ? Math.max(0.5,Math.min(300,raw)) : 5;
}
function getDurationSeconds(){
  return Math.max(0.5,stops.slice(0,-1).reduce((sum,s)=>sum+legDurationSeconds(s),0));
}

function renderWorld(){
  // Actual Natural Earth country boundaries are bundled in world-data.js.
  // No map/API request is made at runtime. We still draw three copies so
  // routes crossing the International Date Line remain visually continuous.
  const copies=[-MAP.width,0,MAP.width];
  const lineParts=[];
  for(const offset of copies){
    for(let lon=-150; lon<=150; lon+=30){
      const a=project(lon,-82), b=project(lon,82);
      lineParts.push(`<line x1="${a.x+offset}" y1="${a.y}" x2="${b.x+offset}" y2="${b.y}"/>`);
    }
    for(let lat=-60; lat<=60; lat+=30){
      const a=project(-180,lat), b=project(180,lat);
      lineParts.push(`<line x1="${a.x+offset}" y1="${a.y}" x2="${b.x+offset}" y2="${b.y}"/>`);
    }
  }
  graticuleEl.innerHTML=lineParts.join('');

  const palette={
    'Asia':['#b9dc79','#a8d272','#c8e28a'],
    'Europe':['#c5dc88','#b8d47e','#d1e59a'],
    'Africa':['#d8df88','#cdd77b','#e2e59a'],
    'North America':['#afd383','#bedb90','#a2cb78'],
    'South America':['#a8d47c','#bada87','#95c870'],
    'Oceania':['#d6df8a','#c8d77c','#e1e698'],
    'Seven seas (open ocean)':['#b7d786']
  };
  const underlay=[];
  const fills=[];
  const borders=[];

  for(const offset of copies){
    WORLD_COUNTRIES.forEach((country,idx)=>{
      const colors=palette[country.c] || ['#bdd782','#aaca78','#cddf91'];
      const fill=colors[idx%colors.length];

      country.p.forEach(poly=>{
        const pts=poly.map(([lon,lat])=>{
          const p=project(lon,lat);
          return `${p.x+offset},${p.y}`;
        }).join(' ');

        // Thick land-coloured underlay closes tiny SVG anti-aliasing seams.
        underlay.push(
          `<polygon points="${pts}" fill="#b8d77f" stroke="#b8d77f" stroke-width="2.4" stroke-linejoin="round"/>`
        );

        // Country fill itself has no stroke, so neighbouring fills meet cleanly.
        fills.push(
          `<polygon points="${pts}" fill="${fill}" stroke="none"/>`
        );

        // Border line is drawn separately above all fills.
        borders.push(
          `<polyline points="${pts}" fill="none" stroke="#76956f" stroke-width="0.55" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
        );
      });
    });
  }

  landEl.innerHTML=underlay.join('')+fills.join('')+borders.join('');
}

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

function visualScaleForMode(mode){
  // Car/train camera is ~3x closer, so shrink map-bound UI by 3x
  // to preserve roughly the same apparent on-screen size.
  return (mode==='car' || mode==='train') ? (1/3) : 1;
}

function cameraState(segments){
  if(!segments.length){
    return {x:MAP.width/2,y:MAP.height/2,scale:9.45};
  }

  const active=activeSegmentAt(segments,progress);
  const {seg,t}=active;
  const pt=seg.kind==='polyline'?polylinePoint(seg.points,t):qPoint(seg.p1,seg.c,seg.p2,t);

  // Base zoom by transport mode.
  // Plane/ship keep the current wider framing.
  // Car/train zoom in about 3x closer.
  const modeMultiplier = (seg.mode==='car' || seg.mode==='train') ? 3 : 1;

  const d=Math.max(1,seg.distanceKm);
  const baseScale=clamp((6.25-Math.log10(d)*0.95)*3,9.0,14.7);
  const targetScale=baseScale*modeMultiplier;

  // Look slightly ahead so the destination stays visible.
  const aheadT=clamp(t+0.14,0,1);
  const ahead=seg.kind==='polyline'?polylinePoint(seg.points,aheadT):qPoint(seg.p1,seg.c,seg.p2,aheadT);
  const targetX=pt.x*0.72+ahead.x*0.28;
  const targetY=pt.y*0.72+ahead.y*0.28;

  // Smooth camera transition between legs.
  // Blend in/out around the start and end of each segment.
  const smoothstep=x=>x*x*(3-2*x);
  const edge=0.12;
  let blend=1;

  if(t<edge){
    blend=smoothstep(t/edge);
  }else if(t>1-edge){
    blend=smoothstep((1-t)/edge);
  }

  // Keep a little damping so the camera does not "snap" when the active leg changes.
  if(!cameraState.prev){
    cameraState.prev={x:targetX,y:targetY,scale:targetScale};
  }

  const follow=0.10 + 0.18*blend;
  cameraState.prev.x += (targetX-cameraState.prev.x)*follow;
  cameraState.prev.y += (targetY-cameraState.prev.y)*follow;
  cameraState.prev.scale += (targetScale-cameraState.prev.scale)*follow;

  return {
    x:cameraState.prev.x,
    y:cameraState.prev.y,
    scale:cameraState.prev.scale
  };
}

function applyCamera(segments){
  const camera=document.getElementById('camera');
  if(!camera) return;
  const c=cameraState(segments);
  // SVG transform order is evaluated right-to-left. This centers the chosen
  // geographic point in the phone frame, then zooms around it.
  camera.setAttribute('transform',`translate(${SCREEN.width/2} ${CAMERA_CENTER_Y}) scale(${c.scale}) translate(${-c.x} ${-c.y})`);
}

function renderControls(){
  stopsEl.innerHTML='';
  stops.forEach((s,i)=>{
    const card=document.createElement('div'); card.className='stop-card';
    const options=cities.map(c=>`<option value="${esc(c.name)}" ${c.name===s.city?'selected':''}>${esc(c.country)}, ${esc(c.name)}</option>`).join('');
    const modeButtons=i<stops.length-1?`<div class="mode-row">${Object.entries(modes).map(([key,m])=>`<button class="mode ${s.mode===key?'active':''}" data-mode="${key}">${m.emoji} ${m.label}</button>`).join('')}</div>`:'';
    const durationInput=i<stops.length-1?`<label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;font-weight:700;color:#17384a">To next city <input class="leg-duration" type="number" min="0.5" max="300" step="0.5" value="${legDurationSeconds(s)}" style="width:72px;padding:7px 8px;border:1px solid #bdd2d8;border-radius:9px"> sec</label>`:'';
    card.innerHTML=`<div class="stop-index">${i+1}</div><div class="stop-fields"><select>${options}</select>${modeButtons}${durationInput}</div><button class="icon-btn" ${stops.length<=2?'disabled':''}>✕</button>`;
    card.querySelector('select').addEventListener('change',e=>{stops[i].city=e.target.value;reset();});
    card.querySelectorAll('.mode').forEach(btn=>btn.addEventListener('click',()=>{stops[i].mode=btn.dataset.mode;renderControls();reset();}));
    const legDurationInput=card.querySelector('.leg-duration');
    if(legDurationInput) legDurationInput.addEventListener('change',e=>{
      stops[i].duration=Math.max(0.5,Math.min(300,Number(e.target.value)||5));
      renderControls(); reset();
    });
    card.querySelector('.icon-btn').addEventListener('click',()=>{if(stops.length>2){stops.splice(i,1);renderControls();reset();}});
    stopsEl.appendChild(card);
  });
}

const VEHICLE_ASSETS = {
  plane: {src:'./plane.png', width:36, height:36, rotationOffset:90},
  car: {src:'./mobil.png', width:27, height:27, rotationOffset:90},
  train: {src:'./kereta.png', width:33, height:33, rotationOffset:90},
  ship: {src:'./kapal.png', width:35, height:35, rotationOffset:90}
};

function vehicleMarkup(mode){
  const asset = VEHICLE_ASSETS[mode] || VEHICLE_ASSETS.plane;
  const x = -asset.width / 2;
  const y = -asset.height / 2;
  return `<image href="${asset.src}" x="${x}" y="${y}" width="${asset.width}" height="${asset.height}" preserveAspectRatio="xMidYMid meet"/>`;
}

function renderMap(){
  const resolved=getResolved(), segments=getSegments();
  subtitleEl.textContent=`${resolved.length} STOPS • ${getDurationSeconds()}s TOTAL`;
  if(journeyTitleEl) journeyTitleEl.textContent=resolved.map(s=>s.data.name).join(' → ');
  routesEl.innerHTML=''; markersEl.innerHTML='';

  // Apply the follow-camera before drawing. Routes may intentionally use an
  // unwrapped x coordinate (e.g. Singapore -> Vancouver); the repeated world
  // copies keep the geography continuous underneath them.
  applyCamera(segments);

  segments.forEach(seg=>{
    const amount=segmentProgress(seg,progress);
    const vs=visualScaleForMode(seg.mode);
    const outerW=(2.5*vs).toFixed(3);
    const midW=(1.25*vs).toFixed(3);
    const innerW=(1.5*vs).toFixed(3);
    const dashA=(12*vs).toFixed(3);
    const dashB=(10*vs).toFixed(3);
    routesEl.insertAdjacentHTML('beforeend',`<path d="${seg.d}" fill="none" stroke="#ffffff" stroke-width="${outerW}" stroke-linecap="round" opacity=".82"/><path d="${seg.d}" fill="none" stroke="#1e4256" stroke-width="${midW}" stroke-linecap="round" stroke-dasharray="${dashA} ${dashB}" opacity=".38"/><path d="${seg.d}" fill="none" stroke="#17384a" stroke-width="${innerW}" stroke-linecap="round" pathLength="1" stroke-dasharray="${amount} 1"/>`);
  });

  // Repeat labels/markers horizontally too, so labels remain attached to land
  // when the camera crosses the date line.
  const activeForVisuals=segments.length?activeSegmentAt(segments,progress):null;
  const activeModeForVisuals=activeForVisuals?activeForVisuals.seg.mode:'plane';
  const labelScale=visualScaleForMode(activeModeForVisuals);

  for(const s of resolved){
    const p=project(s.data.lon,s.data.lat);
    for(const offset of [-MAP.width,0,MAP.width]){
      markersEl.insertAdjacentHTML('beforeend',`<g transform="translate(${p.x+offset} ${p.y}) scale(${labelScale})"><circle r="2.4" fill="#17384a"/><circle r="0.9" fill="#ffffff"/><rect x="-15" y="4" width="30" height="9" rx="4.5" fill="#ffffff" fill-opacity=".94" stroke="#bdd2d8" stroke-width="0.35"/><text x="0" y="10.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="4.4" font-weight="700" fill="#17384a">${esc(s.data.name)}</text></g>`);
    }
  }

  const legTitle=document.getElementById('legTitle');
  const legDistance=document.getElementById('legDistance');
  const legMode=document.getElementById('legMode');
  const timeOverlay=document.getElementById('timeOverlay');
  const progressBar=document.getElementById('progressBar');
  if(timeOverlay) timeOverlay.textContent=`${Math.round(progress*getDurationSeconds())}s / ${getDurationSeconds()}s`;
  if(progressBar) progressBar.setAttribute('width',String(896*progress));

  if(!segments.length){ vehicleEl.innerHTML=''; return; }
  const active=activeSegmentAt(segments,progress);
  const seg=active.seg, t=active.t;
  const motionT=t*t*(3-2*t);
  if(legTitle) legTitle.textContent=`${seg.from.name} → ${seg.to.name}`;
  if(legDistance) legDistance.textContent=`~ ${Math.round(seg.distanceKm).toLocaleString()} km`;
  if(legMode) legMode.textContent=({plane:'✈',car:'🚗',train:'🚆',ship:'🚢'})[seg.mode] || '✈';

  const pt=seg.kind==='polyline'?polylinePoint(seg.points,motionT):qPoint(seg.p1,seg.c,seg.p2,motionT), tan=seg.kind==='polyline'?polylineTangent(seg.points,motionT):qTangent(seg.p1,seg.c,seg.p2,motionT);
  const angle=Math.atan2(tan.y,tan.x)*180/Math.PI;
  let sprite=document.getElementById('vehicleSprite');
  if(!sprite || sprite.dataset.mode!==seg.mode){
    vehicleEl.innerHTML=`<g id="vehicleSprite" data-mode="${seg.mode}">${vehicleMarkup(seg.mode)}</g>`;
    sprite=document.getElementById('vehicleSprite');
  }
  // Do NOT wrap the vehicle back into the base tile. The camera and repeated
  // map tiles follow its continuous x coordinate naturally.
  const rotationOffset=(VEHICLE_ASSETS[seg.mode] || VEHICLE_ASSETS.plane).rotationOffset || 0;
  const vehicleVisualScale=visualScaleForMode(seg.mode);
  sprite.setAttribute('transform',`translate(${pt.x} ${pt.y}) rotate(${angle + rotationOffset}) scale(${vehicleVisualScale})`);
}

function animate(){
  cameraState.prev=null;
  animationToken += 1;
  const token=animationToken;
  if(raf) cancelAnimationFrame(raf);
  playing=true;
  progress=0;
  renderMap();
  const start=performance.now();
  const total=getDurationSeconds()*1000;
  const tick=now=>{
    if(token!==animationToken) return;
    progress=Math.max(0,Math.min(1,(now-start)/total));
    renderMap();
    if(progress<1){ raf=requestAnimationFrame(tick); }
    else { playing=false; raf=null; }
  };
  raf=requestAnimationFrame(tick);
}

function reset(){
  cameraState.prev=null;
  animationToken += 1;
  if(raf) cancelAnimationFrame(raf);
  raf=null; progress=0; playing=false; renderMap();
}

async function exportWebM(){
  if(!window.MediaRecorder){alert('Your browser does not support MediaRecorder. Try Chrome or Edge.');return;}
  reset();
  const svg=document.getElementById('mapSvg');
  const canvas=document.createElement('canvas'); canvas.width=540; canvas.height=960;
  const ctx=canvas.getContext('2d'); const stream=canvas.captureStream(30); const chunks=[];
  let recorder;
  try{recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});}catch{recorder=new MediaRecorder(stream);}
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const total=getDurationSeconds()*1000, start=performance.now();
  recorder.start(250);
  await new Promise(resolve=>{
    const frame=now=>{
      progress=Math.max(0,Math.min(1,(now-start)/total)); renderMap();
      const xml=new XMLSerializer().serializeToString(svg);
      const blob=new Blob([xml],{type:'image/svg+xml'}), url=URL.createObjectURL(blob), img=new Image();
      img.onload=()=>{
        ctx.clearRect(0,0,540,960); ctx.drawImage(img,0,0,540,960); URL.revokeObjectURL(url);
        if(progress<1) requestAnimationFrame(frame); else resolve();
      };
      img.onerror=()=>{URL.revokeObjectURL(url); resolve();};
      img.src=url;
    };
    requestAnimationFrame(frame);
  });
  await new Promise(r=>setTimeout(r,80));
  recorder.stop();
  await new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
  const out=new Blob(chunks,{type:recorder.mimeType || 'video/webm'}), url=URL.createObjectURL(out), a=document.createElement('a');
  a.href=url; a.download='triptoon.webm'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),3000);
  reset();
}

document.getElementById('addStop').addEventListener('click',()=>{stops.push({city:'Paris',mode:'plane'});renderControls();reset();});
document.getElementById('playBtn').addEventListener('click',animate);
document.getElementById('resetBtn').addEventListener('click',reset);
document.getElementById('exportBtn').addEventListener('click',exportWebM);
// Overall duration is calculated automatically from per-leg durations.


renderWorld();
renderControls();
renderMap();
