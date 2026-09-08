const WIDTH = 1080;
const HEIGHT = 1920;

// Keep the geographic map itself close to a 2:1 world-map ratio inside the 9:16 video.
const MAP = { x: 0, y: 0, width: 1080, height: 540 };
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

const modes = {
  plane: {label:'Plane', emoji:'✈️'},
  car: {label:'Car', emoji:'🚗'},
  train: {label:'Train', emoji:'🚆'},
  ship: {label:'Ship', emoji:'🚢'}
};

let stops = [
  {city:'Jakarta',mode:'plane'},
  {city:'Singapore',mode:'plane'},
  {city:'Tokyo',mode:'plane'}
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
const landEl = document.getElementById('continents');
const graticuleEl = document.getElementById('graticule');

function cityByName(name){ return cities.find(c => c.name === name); }
function project(lon,lat){
  return {
    x: MAP.x + ((lon + 180) / 360) * MAP.width,
    y: MAP.y + ((90 - lat) / 180) * MAP.height
  };
}
function curvePath(a,b,mode){
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
    return {
      from:s.data,
      to,
      mode:s.mode,
      distanceKm:haversineKm(s.data,to),
      ...curvePath(s.data,to,s.mode)
    };
  });
  const totalDistance=segments.reduce((sum,seg)=>sum+seg.distanceKm,0) || 1;
  let cumulative=0;
  return segments.map(seg=>{
    const startShare=cumulative/totalDistance;
    cumulative+=seg.distanceKm;
    const endShare=cumulative/totalDistance;
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
function getDurationSeconds(){
  const raw=Number(durationEl.value);
  return Number.isFinite(raw) ? Math.max(2, Math.min(60, raw)) : 12;
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
  const parts=[];
  for(const offset of copies){
    WORLD_COUNTRIES.forEach((country,idx)=>{
      const colors=palette[country.c] || ['#bdd782','#aaca78','#cddf91'];
      const fill=colors[idx%colors.length];
      country.p.forEach(poly=>{
        const pts=poly.map(([lon,lat])=>{
          const p=project(lon,lat);
          return `${p.x+offset},${p.y}`;
        }).join(' ');
        parts.push(`<polygon points="${pts}" fill="${fill}" stroke="#71966e" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`);
      });
    });
  }
  landEl.innerHTML=parts.join('');
}

function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

function cameraState(segments){
  if(!segments.length){
    return {x:MAP.width/2,y:MAP.height/2,scale:3.15};
  }
  const active=activeSegmentAt(segments,progress);
  const {seg,t}=active;
  const pt=qPoint(seg.p1,seg.c,seg.p2,t);

  // Camera zoom is based on leg length: local trips are closer, long-haul
  // flights pull back slightly, but the map always occupies most of 9:16.
  const d=Math.max(1,seg.distanceKm);
  const scale=clamp(6.25-Math.log10(d)*0.95,3.0,4.9);

  // Follow the vehicle but look a little ahead along the current leg so the
  // destination remains visible and movement feels intentional.
  const aheadT=clamp(t+0.14,0,1);
  const ahead=qPoint(seg.p1,seg.c,seg.p2,aheadT);
  const x=pt.x*0.72+ahead.x*0.28;
  const y=pt.y*0.72+ahead.y*0.28;
  return {x,y,scale};
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
    const options=cities.map(c=>`<option value="${esc(c.name)}" ${c.name===s.city?'selected':''}>${esc(c.name)} — ${esc(c.country)}</option>`).join('');
    const modeButtons=i<stops.length-1?`<div class="mode-row">${Object.entries(modes).map(([key,m])=>`<button class="mode ${s.mode===key?'active':''}" data-mode="${key}">${m.emoji} ${m.label}</button>`).join('')}</div>`:'';
    card.innerHTML=`<div class="stop-index">${i+1}</div><div class="stop-fields"><select>${options}</select>${modeButtons}</div><button class="icon-btn" ${stops.length<=2?'disabled':''}>✕</button>`;
    card.querySelector('select').addEventListener('change',e=>{stops[i].city=e.target.value;reset();});
    card.querySelectorAll('.mode').forEach(btn=>btn.addEventListener('click',()=>{stops[i].mode=btn.dataset.mode;renderControls();reset();}));
    card.querySelector('.icon-btn').addEventListener('click',()=>{if(stops.length>2){stops.splice(i,1);renderControls();reset();}});
    stopsEl.appendChild(card);
  });
}

function vehicleMarkup(mode){
  const icons = {
    plane: `
      <image
        href="./assets/plane.png"
        x="-72"
        y="-72"
        width="144"
        height="144"
        preserveAspectRatio="xMidYMid meet"
      />
    `,
    car: '<rect x="-32" y="-11" width="64" height="27" rx="9" fill="#f4f8fa" stroke="#18394c" stroke-width="3"/><path d="M-20 -11 L-9 -27 H14 L27 -11 Z" fill="#e94242" stroke="#18394c" stroke-width="3"/><circle cx="-20" cy="19" r="8" fill="#18394c"/><circle cx="21" cy="19" r="8" fill="#18394c"/>',
    train: '<rect x="-29" y="-29" width="58" height="54" rx="11" fill="#f4f8fa" stroke="#18394c" stroke-width="3"/><rect x="-20" y="-18" width="15" height="14" rx="2" fill="#79c6ed"/><rect x="5" y="-18" width="15" height="14" rx="2" fill="#79c6ed"/><path d="M-24 11 H24" stroke="#e94242" stroke-width="5"/><circle cx="-17" cy="30" r="7" fill="#18394c"/><circle cx="17" cy="30" r="7" fill="#18394c"/>',
    ship: '<path d="M-37 8 H37 L25 30 H-25 Z" fill="#f4f8fa" stroke="#18394c" stroke-width="3"/><rect x="-11" y="-24" width="28" height="32" rx="3" fill="#e94242" stroke="#18394c" stroke-width="3"/><rect x="-4" y="-16" width="13" height="9" fill="#cfeaf7"/>'
  };

  // Plane uses a transparent PNG asset; other modes keep their vector icons.
  if(mode === 'plane') return icons.plane;
  return `<circle r="49" fill="#ffffff" fill-opacity=".96" stroke="#18394c" stroke-width="3"/>${icons[mode] || icons.plane}`;
}

function renderMap(){
  const resolved=getResolved(), segments=getSegments();
  subtitleEl.textContent=`${resolved.length} STOPS • ${getDurationSeconds()} SECONDS`;
  if(journeyTitleEl) journeyTitleEl.textContent=resolved.map(s=>s.data.name).join(' → ');
  routesEl.innerHTML=''; markersEl.innerHTML='';

  // Apply the follow-camera before drawing. Routes may intentionally use an
  // unwrapped x coordinate (e.g. Singapore -> Vancouver); the repeated world
  // copies keep the geography continuous underneath them.
  applyCamera(segments);

  segments.forEach(seg=>{
    const amount=segmentProgress(seg,progress);
    routesEl.insertAdjacentHTML('beforeend',`<path d="${seg.d}" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity=".82"/><path d="${seg.d}" fill="none" stroke="#1e4256" stroke-width="5" stroke-linecap="round" stroke-dasharray="12 10" opacity=".38"/><path d="${seg.d}" fill="none" stroke="#17384a" stroke-width="6" stroke-linecap="round" pathLength="1" stroke-dasharray="${amount} 1"/>`);
  });

  // Repeat labels/markers horizontally too, so labels remain attached to land
  // when the camera crosses the date line.
  for(const s of resolved){
    const p=project(s.data.lon,s.data.lat);
    for(const offset of [-MAP.width,0,MAP.width]){
      markersEl.insertAdjacentHTML('beforeend',`<g transform="translate(${p.x+offset} ${p.y})"><circle r="9" fill="#17384a"/><circle r="3.5" fill="#ffffff"/><rect x="-55" y="14" width="110" height="31" rx="15.5" fill="#ffffff" fill-opacity=".94" stroke="#bdd2d8" stroke-width="1"/><text x="0" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#17384a">${esc(s.data.name)}</text></g>`);
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
  if(legTitle) legTitle.textContent=`${seg.from.name} → ${seg.to.name}`;
  if(legDistance) legDistance.textContent=`~ ${Math.round(seg.distanceKm).toLocaleString()} km`;
  if(legMode) legMode.textContent=({plane:'✈',car:'🚗',train:'🚆',ship:'🚢'})[seg.mode] || '✈';

  const pt=qPoint(seg.p1,seg.c,seg.p2,t), tan=qTangent(seg.p1,seg.c,seg.p2,t);
  const angle=Math.atan2(tan.y,tan.x)*180/Math.PI;
  let sprite=document.getElementById('vehicleSprite');
  if(!sprite || sprite.dataset.mode!==seg.mode){
    vehicleEl.innerHTML=`<g id="vehicleSprite" data-mode="${seg.mode}">${vehicleMarkup(seg.mode)}</g>`;
    sprite=document.getElementById('vehicleSprite');
  }
  // Do NOT wrap the vehicle back into the base tile. The camera and repeated
  // map tiles follow its continuous x coordinate naturally.
  sprite.setAttribute('transform',`translate(${pt.x} ${pt.y}) rotate(${angle})`);
}

function animate(){
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
durationEl.addEventListener('input',()=>{
  durationLabelEl.textContent=`${getDurationSeconds()}s`;
  // If the user changes duration while playing, restart immediately with the new duration.
  if(playing) animate();
});

renderWorld();
renderControls();
renderMap();
