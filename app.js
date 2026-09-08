const WIDTH = 1080;
const HEIGHT = 1920;

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
  ['Mumbai','India',72.8777,19.0760],['Delhi','India',77.1025,28.7041],['Bengaluru','India',77.5946,12.9716]
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
const durationEl = document.getElementById('duration');
const durationLabelEl = document.getElementById('durationLabel');

function cityByName(name){ return cities.find(c => c.name === name); }
function project(lon,lat){ return {x:((lon+180)/360)*WIDTH, y:((90-lat)/180)*HEIGHT}; }
function curvePath(a,b,mode){
  const p1=project(a.lon,a.lat), p2=project(b.lon,b.lat);
  const dx=p2.x-p1.x, dy=p2.y-p1.y;
  const bend=mode==='plane'?0.25:mode==='ship'?0.18:0.08;
  const cx=(p1.x+p2.x)/2-dy*bend, cy=(p1.y+p2.y)/2+dx*bend;
  return {p1,p2,c:{x:cx,y:cy},d:`M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`};
}
function qPoint(p1,c,p2,t){const mt=1-t;return{x:mt*mt*p1.x+2*mt*t*c.x+t*t*p2.x,y:mt*mt*p1.y+2*mt*t*c.y+t*t*p2.y};}
function qTangent(p1,c,p2,t){return{x:2*(1-t)*(c.x-p1.x)+2*t*(p2.x-c.x),y:2*(1-t)*(c.y-p1.y)+2*t*(p2.y-c.y)};}

function getResolved(){return stops.map(s=>({...s,data:cityByName(s.city)})).filter(s=>s.data);}
function getSegments(){const r=getResolved();return r.slice(0,-1).map((s,i)=>({from:s.data,to:r[i+1].data,mode:s.mode,...curvePath(s.data,r[i+1].data,s.mode)}));}
function esc(s){return String(s).replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

function renderControls(){
  stopsEl.innerHTML='';
  stops.forEach((s,i)=>{
    const card=document.createElement('div'); card.className='stop-card';
    const options=cities.map(c=>`<option value="${esc(c.name)}" ${c.name===s.city?'selected':''}>${esc(c.name)} — ${esc(c.country)}</option>`).join('');
    const modeButtons=i<stops.length-1?`<div class="mode-row">${Object.entries(modes).map(([key,m])=>`<button class="mode ${s.mode===key?'active':''}" data-mode="${key}">${m.emoji} ${m.label}</button>`).join('')}</div>`:'';
    card.innerHTML=`<div class="stop-index">${i+1}</div><div class="stop-fields"><select>${options}</select>${modeButtons}</div><button class="icon-btn" ${stops.length<=2?'disabled':''}>✕</button>`;
    card.querySelector('select').addEventListener('change',e=>{stops[i].city=e.target.value;renderMap();});
    card.querySelectorAll('.mode').forEach(btn=>btn.addEventListener('click',()=>{stops[i].mode=btn.dataset.mode;renderControls();renderMap();}));
    card.querySelector('.icon-btn').addEventListener('click',()=>{if(stops.length>2){stops.splice(i,1);renderControls();renderMap();}});
    stopsEl.appendChild(card);
  });
}

function vehicleMarkup(mode){
  const icons = {
    plane: '<path d="M-34 2 L-8 -5 L7 -34 L17 -34 L12 -4 L35 3 L35 10 L11 7 L16 30 L7 30 L-7 8 L-34 9 Z" fill="#3e332b"/>',
    car: '<rect x="-29" y="-10" width="58" height="24" rx="8" fill="#3e332b"/><path d="M-18 -10 L-8 -24 H13 L25 -10 Z" fill="#3e332b"/><circle cx="-18" cy="17" r="8" fill="#3e332b"/><circle cx="19" cy="17" r="8" fill="#3e332b"/>',
    train: '<rect x="-28" y="-27" width="56" height="50" rx="10" fill="#3e332b"/><rect x="-19" y="-17" width="14" height="13" rx="2" fill="#fffaf1"/><rect x="5" y="-17" width="14" height="13" rx="2" fill="#fffaf1"/><circle cx="-17" cy="28" r="7" fill="#3e332b"/><circle cx="17" cy="28" r="7" fill="#3e332b"/>',
    ship: '<path d="M-34 8 H34 L23 27 H-22 Z" fill="#3e332b"/><rect x="-10" y="-22" width="26" height="30" rx="3" fill="#3e332b"/><rect x="-3" y="-15" width="12" height="8" fill="#fffaf1"/>'
  };
  return `<circle r="47" fill="#fffaf1" stroke="#3e332b" stroke-width="5"/>${icons[mode] || icons.plane}`;
}

function renderMap(){
  const resolved=getResolved(), segments=getSegments();
  subtitleEl.textContent=`TRIPTOON • ${resolved.length} STOPS`;
  routesEl.innerHTML=''; markersEl.innerHTML='';
  segments.forEach((seg,i)=>{
    const amount=Math.max(0,Math.min(1,progress*segments.length-i));
    routesEl.insertAdjacentHTML('beforeend',`<path d="${seg.d}" fill="none" stroke="#8d745a" stroke-width="10" stroke-linecap="round" stroke-dasharray="18 18" opacity=".35"/><path d="${seg.d}" fill="none" stroke="#3e332b" stroke-width="8" stroke-linecap="round" pathLength="1" stroke-dasharray="${amount} 1"/>`);
  });
  resolved.forEach(s=>{
    const p=project(s.data.lon,s.data.lat);
    markersEl.insertAdjacentHTML('beforeend',`<g transform="translate(${p.x} ${p.y})"><circle r="16" fill="#3e332b"/><circle r="7" fill="#f3eadb"/><rect x="-74" y="24" width="148" height="48" rx="24" fill="#fffaf1" stroke="#c8b59a"/><text x="0" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#3a2c22">${esc(s.data.name)}</text></g>`);
  });

  if(!segments.length){
    vehicleEl.innerHTML='';
    return;
  }

  const scaled=Math.min(progress,0.999999)*segments.length;
  const idx=Math.min(segments.length-1,Math.floor(scaled));
  const t=scaled-idx, seg=segments[idx];
  const pt=qPoint(seg.p1,seg.c,seg.p2,t), tan=qTangent(seg.p1,seg.c,seg.p2,t);
  const angle=Math.atan2(tan.y,tan.x)*180/Math.PI;

  let sprite=document.getElementById('vehicleSprite');
  const desiredMode=seg.mode;
  if(!sprite || sprite.dataset.mode!==desiredMode){
    vehicleEl.innerHTML=`<g id="vehicleSprite" data-mode="${desiredMode}">${vehicleMarkup(desiredMode)}</g>`;
    sprite=document.getElementById('vehicleSprite');
  }
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
  const total=Math.max(1000,Number(durationEl.value)*1000);
  const tick=now=>{
    if(token!==animationToken) return;
    progress=Math.min(1,(now-start)/total);
    renderMap();
    if(progress<1){
      raf=requestAnimationFrame(tick);
    }else{
      playing=false;
      raf=null;
    }
  };
  raf=requestAnimationFrame(tick);
}
function reset(){
  animationToken += 1;
  if(raf) cancelAnimationFrame(raf);
  raf=null;
  progress=0;
  playing=false;
  renderMap();
}

async function exportWebM(){
  if(!window.MediaRecorder){alert('Your browser does not support MediaRecorder. Try Chrome or Edge.');return;}
  const svg=document.getElementById('mapSvg');
  const canvas=document.createElement('canvas'); canvas.width=540; canvas.height=960;
  const ctx=canvas.getContext('2d'); const stream=canvas.captureStream(30); const chunks=[];
  let recorder;
  try{recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9'});}catch{recorder=new MediaRecorder(stream);}
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const total=Number(durationEl.value)*1000, start=performance.now();
  recorder.start();
  await new Promise(resolve=>{
    const frame=now=>{
      progress=Math.min(1,(now-start)/total);renderMap();
      requestAnimationFrame(()=>{
        const xml=new XMLSerializer().serializeToString(svg);
        const blob=new Blob([xml],{type:'image/svg+xml'}), url=URL.createObjectURL(blob), img=new Image();
        img.onload=()=>{ctx.clearRect(0,0,540,960);ctx.drawImage(img,0,0,540,960);URL.revokeObjectURL(url);if(progress<1)requestAnimationFrame(frame);else resolve();};
        img.src=url;
      });
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
  const out=new Blob(chunks,{type:'video/webm'}), url=URL.createObjectURL(out), a=document.createElement('a');
  a.href=url;a.download='triptoon.webm';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}

document.getElementById('addStop').addEventListener('click',()=>{stops.push({city:'Paris',mode:'plane'});renderControls();renderMap();});
document.getElementById('playBtn').addEventListener('click',animate);
document.getElementById('resetBtn').addEventListener('click',reset);
document.getElementById('exportBtn').addEventListener('click',exportWebM);
durationEl.addEventListener('input',()=>durationLabelEl.textContent=`${durationEl.value}s`);

renderControls();renderMap();
