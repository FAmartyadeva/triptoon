const WIDTH = 1080;
const HEIGHT = 1920;

// Keep the geographic map itself close to a 2:1 world-map ratio inside the 9:16 video.
const MAP = { x: 60, y: 450, width: 960, height: 480 };

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

// Deliberately simplified coastlines, stored locally as lon/lat points.
// Unlike the old version, these are projected into a true world-map viewport,
// so the globe is not vertically stretched by the 9:16 video canvas.
const landShapes = [
  // North America
  [[-168,72],[-150,70],[-140,60],[-130,55],[-125,49],[-124,40],[-117,32],[-107,25],[-97,20],[-88,18],[-82,24],[-80,30],[-74,40],[-67,45],[-61,53],[-70,60],[-82,64],[-95,70],[-110,72],[-125,72],[-145,75]],
  // Greenland
  [[-73,82],[-25,82],[-20,70],[-35,60],[-50,59],[-60,66],[-68,75]],
  // South America
  [[-81,12],[-72,10],[-62,6],[-52,3],[-45,-5],[-39,-15],[-43,-23],[-50,-30],[-54,-40],[-65,-55],[-73,-51],[-75,-38],[-79,-22],[-81,-8]],
  // Europe + Asia
  [[-10,36],[-9,44],[-5,50],[5,55],[18,58],[30,60],[40,67],[60,72],[85,75],[110,72],[135,65],[160,60],[177,52],[170,45],[150,43],[140,36],[130,32],[121,24],[112,19],[105,10],[98,7],[90,20],[80,22],[72,18],[61,22],[50,28],[42,34],[35,40],[28,43],[20,39],[12,42],[4,43]],
  // Scandinavia
  [[5,55],[10,64],[18,71],[28,72],[32,66],[25,59],[18,56]],
  // Africa
  [[-17,36],[-5,37],[10,35],[25,32],[34,28],[40,15],[50,10],[43,-5],[38,-18],[31,-30],[20,-35],[10,-34],[2,-26],[-5,-12],[-12,5],[-17,20]],
  // Arabian peninsula
  [[35,31],[48,30],[56,24],[52,15],[44,12],[39,20]],
  // India
  [[68,24],[78,31],[88,25],[84,16],[77,7],[72,12]],
  // Australia
  [[113,-10],[129,-11],[144,-10],[153,-20],[151,-34],[140,-39],[125,-35],[115,-27]],
  // New Zealand
  [[166,-34],[178,-37],[174,-47],[168,-45]],
  // Japan
  [[130,33],[136,36],[141,42],[145,44],[143,36],[138,33]],
  // Indonesia main silhouette
  [[95,5],[105,2],[115,-4],[126,-3],[135,-5],[141,-8],[132,-10],[120,-8],[110,-7],[100,-6]],
  // UK / Ireland
  [[-10,50],[-7,58],[-2,59],[1,52],[-4,50]],
  // Madagascar
  [[46,-13],[50,-18],[49,-26],[45,-24]],
  // Iceland
  [[-25,63],[-13,64],[-14,68],[-22,67]]
];

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
  const lineParts=[];
  for(let lon=-150; lon<=150; lon+=30){
    const a=project(lon,-75), b=project(lon,75);
    lineParts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
  }
  for(let lat=-60; lat<=60; lat+=30){
    const a=project(-180,lat), b=project(180,lat);
    lineParts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
  }
  graticuleEl.innerHTML=lineParts.join('');
  landEl.innerHTML=landShapes.map(shape=>{
    const pts=shape.map(([lon,lat])=>{const p=project(lon,lat);return `${p.x},${p.y}`;}).join(' ');
    return `<polygon points="${pts}"/>`;
  }).join('');
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
    plane: '<path d="M-34 2 L-8 -5 L7 -34 L17 -34 L12 -4 L35 3 L35 10 L11 7 L16 30 L7 30 L-7 8 L-34 9 Z" fill="#24303a"/>',
    car: '<rect x="-29" y="-10" width="58" height="24" rx="8" fill="#24303a"/><path d="M-18 -10 L-8 -24 H13 L25 -10 Z" fill="#24303a"/><circle cx="-18" cy="17" r="8" fill="#24303a"/><circle cx="19" cy="17" r="8" fill="#24303a"/>',
    train: '<rect x="-28" y="-27" width="56" height="50" rx="10" fill="#24303a"/><rect x="-19" y="-17" width="14" height="13" rx="2" fill="#eef6f7"/><rect x="5" y="-17" width="14" height="13" rx="2" fill="#eef6f7"/><circle cx="-17" cy="28" r="7" fill="#24303a"/><circle cx="17" cy="28" r="7" fill="#24303a"/>',
    ship: '<path d="M-34 8 H34 L23 27 H-22 Z" fill="#24303a"/><rect x="-10" y="-22" width="26" height="30" rx="3" fill="#24303a"/><rect x="-3" y="-15" width="12" height="8" fill="#eef6f7"/>'
  };
  return `<circle r="43" fill="#fff" stroke="#24303a" stroke-width="4" opacity=".96"/>${icons[mode] || icons.plane}`;
}

function renderMap(){
  const resolved=getResolved(), segments=getSegments();
  subtitleEl.textContent=`TRIPTOON • ${resolved.length} STOPS`;
  routesEl.innerHTML=''; markersEl.innerHTML='';
  segments.forEach(seg=>{
    const amount=segmentProgress(seg,progress);
    routesEl.insertAdjacentHTML('beforeend',`<path d="${seg.d}" fill="none" stroke="#ffffff" stroke-width="14" stroke-linecap="round" opacity=".75"/><path d="${seg.d}" fill="none" stroke="#586b75" stroke-width="7" stroke-linecap="round" stroke-dasharray="16 14" opacity=".42"/><path d="${seg.d}" fill="none" stroke="#203742" stroke-width="8" stroke-linecap="round" pathLength="1" stroke-dasharray="${amount} 1"/>`);
  });
  resolved.forEach(s=>{
    const p=project(s.data.lon,s.data.lat);
    markersEl.insertAdjacentHTML('beforeend',`<g transform="translate(${p.x} ${p.y})"><circle r="13" fill="#203742"/><circle r="5" fill="#f8fbfb"/><rect x="-70" y="19" width="140" height="42" rx="21" fill="#ffffff" stroke="#b8c6c9"/><text x="0" y="47" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#203742">${esc(s.data.name)}</text></g>`);
  });

  if(!segments.length){ vehicleEl.innerHTML=''; return; }
  const active=activeSegmentAt(segments,progress);
  const seg=active.seg, t=active.t;
  const pt=qPoint(seg.p1,seg.c,seg.p2,t), tan=qTangent(seg.p1,seg.c,seg.p2,t);
  const angle=Math.atan2(tan.y,tan.x)*180/Math.PI;
  let sprite=document.getElementById('vehicleSprite');
  if(!sprite || sprite.dataset.mode!==seg.mode){
    vehicleEl.innerHTML=`<g id="vehicleSprite" data-mode="${seg.mode}">${vehicleMarkup(seg.mode)}</g>`;
    sprite=document.getElementById('vehicleSprite');
  }
  // Wrap the sprite if a route crosses the international date line.
  let vx=pt.x;
  while(vx < MAP.x) vx += MAP.width;
  while(vx > MAP.x+MAP.width) vx -= MAP.width;
  sprite.setAttribute('transform',`translate(${vx} ${pt.y}) rotate(${angle})`);
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
