import {DRONE_ZOOM, RETURN_RADIUS, cancelDrop, clamp, worldPoint, latLng, tileSpan, tileWindow, terrainSampler, flooded, moveDrone, planTerrainWindow} from './drone-math.mjs';

const bridge = window.DeepTerraDroneBridge;
// Relieve propio con imágenes satelitales de MapTiler (si hay maptilerKey).
const $ = id => document.getElementById(id);
const dock = $('droneDock'), button = $('droneButton'), placeholder = $('dronePlaceholder');
const hint = $('droneDragHint'), view = $('droneView'), canvas = $('droneCanvas');
const speedInput = $('droneSpeed'), altitudeInput = $('droneAltitude'), fixedInput = $('droneFixedAltitude'), climbInput = $('droneClimb');
const warning = $('droneWarning'), readout = $('droneCoords'), loading = $('droneLoading');
let gesture = null, placement = false, session = null, sequence = 0, suppressClickUntil = 0;
// mode 'terrain': altura sobre el relieve. mode 'fixed': altitud constante sobre el nivel del mar inicial.
let options = {speed: 300, climb: 150, altitude: 60, mode: 'terrain', fixed: 600};
let lastFlight = {y: null, ground: 0};
const MAX_FIXED = 9000, MAX_SPEED = 1000;
// Ventana de terreno: 7×7 bloques (radio 3). Se entra con los 5×5 centrales y el anillo
// exterior se carga después, con menos detalle, para ver más lejos sin cargar más al inicio.
const VIEW_RADIUS = 3, START_RADIUS = 2;
// Anillos lejanos con menos detalle a medida que se alejan. Cada nivel se recorta donde ya hay
// uno más detallado. Zoom 12: 5×5 bloques de 4×4 (≈ ±21 km). Zoom 10: 7×7 bloques de 16×16
// (≈ ±120 km; ±85 km en pantallas táctiles, 5×5). Se cargan en orden, en segundo plano.
const TOUCH = matchMedia('(pointer:coarse)').matches;
// Equipos modestos (poca memoria, pocos núcleos o GPU básica) parten con el anillo exterior más chico.
function deviceTier(){
  const memory=navigator.deviceMemory||8,cores=navigator.hardwareConcurrency||8;let gpu='';
  try{const gl=document.createElement('canvas').getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');gpu=ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)):'';gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
  if(memory<=4||cores<=4||/Mali-(?:[T4]|G[1-5]\d\b)|Adreno \(TM\) [1-5]\d\d\b|PowerVR|SwiftShader|llvmpipe|HD Graphics [2-5]\d{2,3}\b/i.test(gpu))return 'low';
  return TOUCH?'mid':'high';
}
// ?alcance=completo desactiva el ajuste automático (pruebas y equipos donde se quiera forzar).
const FULL_REACH = new URLSearchParams(location.search).get('alcance')==='completo';
const TIER = FULL_REACH ? 'high' : deviceTier();
const FAR_LEVELS = [{zoom: 12, radius: 2, segments: 32}, {zoom: 10, radius: {low: 1, mid: 2, high: 3}[TIER], segments: 24}];
const EARTH_DIAMETER = 12742000;
let home = {x: 0, y: 0}, threePromise;
const keys = new Set();
let verticalInput=0,verticalPointer=null;
function resetAltitudeStick(){verticalInput=0;verticalPointer=null;const el=$('droneAltitudeStick');el.style.setProperty('--altitude-offset','0px');el.setAttribute('aria-valuenow','0');el.setAttribute('aria-valuetext','Detenido');}
const sticks={move:{x:0,y:0},look:{x:0,y:0}};
function resetSticks(){resetAltitudeStick();for(const stick of Object.values(sticks)){stick.x=stick.y=0;}document.querySelectorAll('.stick-knob').forEach(el=>el.style.transform='translate(-50%,-50%)');}
const fmt = number => Number(number).toLocaleString('es-CL', {maximumFractionDigits: 1});

function positionDock() {
  if (gesture || session) return;
  const baseY = window.innerHeight / 2 + 34;
  const bar = document.querySelector('.playback').getBoundingClientRect();
  const y = Math.max(70, Math.min(baseY, bar.top - 56));
  dock.style.top = y + 'px';
  const box = dock.getBoundingClientRect();
  home = {x: box.left + box.width / 2, y: box.top + box.height / 2};
  button.disabled = !bridge.snapshot().ready;
}
function setHint(text) { hint.textContent = text; hint.hidden = !text; }
function finishPlacement() {
  placement = false;
  document.body.classList.remove('drone-placement');
  placeholder.hidden = true;
  setHint('');
}
function cancelGesture() {
  if (!gesture) {finishPlacement(); return;}
  const previous = gesture;
  gesture = null;
  button.style.transform = '';
  dock.classList.remove('dragging', 'returning');
  placeholder.hidden = true;
  if (button.hasPointerCapture(previous.id)) button.releasePointerCapture(previous.id);
  bridge.unlockMap();
  suppressClickUntil = performance.now() + 500;
  setHint('');
  positionDock();
}
button.addEventListener('pointerdown', event => {
  if (!bridge.snapshot().ready || gesture || session || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault(); event.stopPropagation();
  finishPlacement(); positionDock();
  gesture = {id: event.pointerId, startX: event.clientX, startY: event.clientY, dragged: false, leftHome: false, lastNearHome: -Infinity};
  button.setPointerCapture(event.pointerId);
  bridge.lockMap();
  dock.classList.add('dragging'); placeholder.hidden = false;
  setHint('Arrastra el dron al mapa · vuelve al círculo o pulsa Esc para cancelar');
});
button.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  event.preventDefault();
  const distance = Math.hypot(event.clientX - home.x, event.clientY - home.y);
  gesture.dragged ||= Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 8;
  if (distance > RETURN_RADIUS + 24) gesture.leftHome = true;
  if (gesture.leftHome && distance <= RETURN_RADIUS) gesture.lastNearHome = performance.now();
  button.style.transform = `translate(${event.clientX - home.x}px, ${event.clientY - home.y}px)`;
  dock.classList.toggle('returning', distance <= RETURN_RADIUS);
  // Returning near the dock after leaving it snaps home before pointer release.
  if (gesture.leftHome && distance <= RETURN_RADIUS) cancelGesture();
});
button.addEventListener('pointerup', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  const previous = gesture;
  const cancelled = cancelDrop({x:event.clientX, y:event.clientY, homeX:home.x, homeY:home.y,
    lastNearHome:previous.lastNearHome, now:performance.now(), dragged:previous.dragged});
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const valid = element?.closest('#map');
  const point = valid ? bridge.mapPoint(event.clientX, event.clientY) : null;
  cancelGesture();
  if (!cancelled && point) openDrone(point);
  else if (!previous.dragged) beginPlacement();
});
button.addEventListener('pointercancel', cancelGesture);
button.addEventListener('lostpointercapture', () => {if (gesture) cancelGesture();});
button.addEventListener('contextmenu', event => event.preventDefault());
button.addEventListener('click', event => {
  event.preventDefault();
  if (performance.now() < suppressClickUntil || session) return;
  beginPlacement();
});
function beginPlacement() {
  if (!bridge.snapshot().ready) return;
  placement = true;
  document.body.classList.add('drone-placement');
  placeholder.hidden = false;
  setHint('Elige un punto del mapa · Enter usa el centro · Esc cancela');
}
document.addEventListener('click', event => {
  if (!placement || !event.target.closest('#map')) return;
  event.preventDefault(); event.stopPropagation();
  const point = bridge.mapPoint(event.clientX, event.clientY);
  finishPlacement(); openDrone(point);
}, true);

const WATER_VERTEX = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vCell;varying vec3 vWorld;
void main(){vCell=vec2(uv.x,1.0-uv.y);vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;
vec2 d=world.xz-cameraPosition.xz;world.y-=dot(d,d)/${EARTH_DIAMETER}.0;
gl_Position=projectionMatrix*viewMatrix*world;
#include <logdepthbuf_vertex>
}`;
const WATER_FRAGMENT = `#include <logdepthbuf_pars_fragment>
uniform sampler2D terrainData;uniform float level;uniform float opacity;
uniform float visibleWater;uniform float depthColors;uniform float contour;uniform vec4 coreRect;uniform float clipCore;varying vec2 vCell;varying vec3 vWorld;
bool wet(vec2 p){vec4 cell=texture2D(terrainData,clamp(p,vec2(0.5/256.0),vec2(255.5/256.0)));return cell.b>0.5||level>cell.g+0.00001;}
vec3 depthColor(float d){if(d<10.0)return vec3(103.,232.,249.)/255.;if(d<50.0)return vec3(56.,189.,248.)/255.;if(d<100.0)return vec3(59.,130.,246.)/255.;if(d<500.0)return vec3(139.,92.,246.)/255.;if(d<1000.0)return vec3(217.,70.,239.)/255.;return vec3(244.,114.,182.)/255.;}
void main(){
#include <logdepthbuf_fragment>
if(clipCore>0.5&&vWorld.x>coreRect.x&&vWorld.x<coreRect.y&&vWorld.z>coreRect.z&&vWorld.z<coreRect.w)discard;
vec4 cell=texture2D(terrainData,vCell);bool sea=cell.b>0.5;
if(visibleWater<0.5||opacity<0.001||(!sea&&level<=cell.g+0.00001))discard;
float depth=max(0.0,level-cell.r);vec3 rgb=depthColors>0.5&&!sea?depthColor(depth):vec3(0.12,0.56,0.68);
if(contour>0.5&&!sea){vec2 dx=vec2(1.0/256.0,0.0),dy=vec2(0.0,1.0/256.0);if(!wet(vCell-dx)||!wet(vCell+dx)||!wet(vCell-dy)||!wet(vCell+dy))rgb=vec3(1.0,0.92,0.6);}
gl_FragColor=vec4(rgb,0.85*opacity);}`;

function textureData(THREE, record) {
  const values = new Float32Array(256 * 256 * 4);
  for (let i = 0; i < record.dem.length; i++) {
    values[i * 4] = record.dem[i];
    values[i * 4 + 1] = Number.isFinite(record.threshold[i]) ? record.threshold[i] : 65536;
    values[i * 4 + 2] = record.sea[i]; values[i * 4 + 3] = 1;
  }
  const texture = new THREE.DataTexture(values, 256, 256, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}
function terrainImagery(current,coords){
  const key=String(window.DEEPTERRA_MAP_CONFIG?.maptilerKey||'').trim();
  if(!key)return Promise.resolve(null);
  current.imageryCache??=new Map();
  const id=coords.z+'/'+coords.x+'/'+coords.y;
  if(current.imageryCache.has(id))return current.imageryCache.get(id);
  const task=(async()=>{try{
    const signal=AbortSignal.any([current.controller.signal,AbortSignal.timeout(15000)]);
    const response=await fetch('https://api.maptiler.com/maps/satellite-v4/'+id+'.jpg?key='+encodeURIComponent(key),{signal});
    if(!response.ok)throw new Error('Imagery unavailable');
    const bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY'});
    if(current.disposed){bitmap.close();return null;}
    const texture=new current.THREE.Texture(bitmap);texture.colorSpace=current.THREE.SRGBColorSpace;texture.needsUpdate=true;texture.anisotropy=Math.min(4,current.renderer.capabilities.getMaxAnisotropy());return texture;
  }catch{if(!current.disposed)current.imageryFailures=(current.imageryFailures||0)+1;return null;}})();
  current.imageryCache.set(id,task);
  if(current.imageryCache.size>160){const keep=new Set([...current.records,...current.levels.flatMap(l=>l.records)].map(r=>r.coords.z+'/'+r.coords.x+'/'+r.coords.y));for(const [old,promise] of current.imageryCache){if(current.imageryCache.size<=160)break;if(!keep.has(old)){current.imageryCache.delete(old);promise.then(t=>{t?.image?.close?.();t?.dispose();});}}}
  return task;
}
// Curvatura terrestre: a 100 km el suelo cae ~785 m respecto de un plano tangente.
function curveEarth(material){
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\n{vec4 cw=modelMatrix*vec4(transformed,1.0);vec2 cd=cw.xz-cameraPosition.xz;transformed.y-=dot(cd,cd)/'+EARTH_DIAMETER+'.0;}');};
  material.customProgramCacheKey=()=>'deepterra-curve';
  return material;
}
// Faldón: una franja que baja desde el borde de cada bloque y tapa las grietas entre bloques vecinos
// o de distinto nivel de detalle (cada uno muestrea su propio borde y las alturas no calzan exacto).
function addSkirt(THREE,geometry,segments,depth){
  const row=segments+1,ring=[];
  for(let x=0;x<segments;x++)ring.push(x);
  for(let y=0;y<segments;y++)ring.push(y*row+segments);
  for(let x=segments;x>0;x--)ring.push(segments*row+x);
  for(let y=segments;y>0;y--)ring.push(y*row);
  const base=geometry.attributes.position.count,extra=ring.length;
  const positions=geometry.attributes.position,half=Math.abs(positions.getX(segments)),inset=Math.min(0.02,depth*0.5/half);
  for(const name of ['position','normal','uv','color']){
    const attr=geometry.attributes[name];if(!attr)continue;
    const size=attr.itemSize,array=new Float32Array((base+extra)*size);array.set(attr.array);
    ring.forEach((v,k)=>{for(let c=0;c<size;c++)array[(base+k)*size+c]=attr.array[v*size+c];
      // Baja y se mete un poco bajo su propio bloque: así el faldón vecino no queda en el mismo plano.
      if(name==='position'){const o=(base+k)*size;array[o]*=1-inset;array[o+2]*=1-inset;array[o+1]-=depth;}});
    geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
  }
  const index=[...geometry.index.array];
  for(let k=0;k<extra;k++){const a=ring[k],b=ring[(k+1)%extra],sa=base+k,sb=base+(k+1)%extra;index.push(a,sa,b,b,sa,sb);}
  geometry.setIndex(index);
}
let reversedDepth=null;
function supportsReversedDepth(){
  if(reversedDepth===null){const gl=document.createElement('canvas').getContext('webgl2');reversedDepth=Boolean(gl?.getExtension('EXT_clip_control'));gl?.getExtension('WEBGL_lose_context')?.loseContext();}
  return reversedDepth;
}
function tileSegments(record,origin){
  const ring=Math.max(Math.abs(record.coords.ux-Math.floor(origin.x)),Math.abs(record.coords.y-Math.floor(origin.y)));
  return ring<=1?128:ring===2?64:24;
}
// A tile built while a neighbour was missing has approximate edges; rebuild it once the neighbour exists.
function hasAllNeighbors(current,record){
  const keys=current.recordKeys;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&!keys.has((record.coords.ux+dx)+'/'+(record.coords.y+dy)))return false;
  return true;
}
function buildTile(current, record, level = null) {
  const {THREE, span, origin, sample, scene} = current;
  const far = Boolean(level), ux = record.coords.ux, f = far ? level.factor : 1, size = span * f;
  const segments=far?level.segments:tileSegments(record,origin);
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3), color = new THREE.Color();
  const low = new THREE.Color('#597b59'), high = new THREE.Color('#ae9b78');
  for (let i = 0; i < positions.count; i++) {
    const gx = i % (segments+1), gy = Math.floor(i / (segments+1));
    const index = Math.min(255,Math.floor(gy*256/segments))*256+Math.min(255,Math.floor(gx*256/segments));
    const cell = far ? {ground:record.dem[index], sea:record.sea[index]} : sample({x:ux + gx / segments, y:record.coords.y + gy / segments});
    const ground = cell?.ground ?? record.dem[index];
    // Fondo marino solo visual entre -1 y -40 m: a 0 m parpadearía con el agua, y los valores
    // erróneos del mar (hasta -16.000 m junto a la costa) formaban muros oscuros en la orilla.
    // No cambia elevaciones ni umbrales de inundación.
    positions.setY(i, cell?.sea ? clamp(ground,-40,-1) : ground);
    color.copy(low).lerp(high, clamp(Math.max(0,ground)/1800,0,1));
    if (ground < 0) color.set('#405e64');
    if (ground > 3500) color.lerp(new THREE.Color('#eef4f3'),clamp((ground-3500)/1800,0,1));
    colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));
  geometry.computeVertexNormals();addSkirt(THREE,geometry,segments,Math.max(30,size*0.02));geometry.computeBoundingSphere();
  const material = curveEarth(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
  if (far) {material.clippingPlanes = level.clip; material.clipIntersection = true;}
  const terrain = new THREE.Mesh(geometry, material);
  const x = ((ux + 0.5)*f - origin.x)*span, z = ((record.coords.y+0.5)*f-origin.y)*span;
  terrain.position.set(x,0,z);scene.add(terrain);
  const texture = textureData(THREE,record);
  const waterMaterial = new THREE.ShaderMaterial({vertexShader:WATER_VERTEX,fragmentShader:WATER_FRAGMENT,
    uniforms:{...current.uniforms,terrainData:{value:texture},clipCore:{value:far?1:0},coreRect:far?level.rect:{value:new THREE.Vector4()}},side:THREE.DoubleSide,transparent:true,depthWrite:false});
  // El agua se subdivide igual que el relieve para que la curvatura terrestre las doble por igual
  // (con un solo cuadro por bloque, a 100 km el fondo marino asomaba sobre el agua).
  const waterSegments=far?level.segments:4,waterGeometry = new THREE.PlaneGeometry(size,size,waterSegments,waterSegments);waterGeometry.rotateX(-Math.PI/2);
  const water = new THREE.Mesh(waterGeometry,waterMaterial);water.position.set(x,0,z);scene.add(water);
  const item={terrain,water,texture,version:record.gpuVersion,disposed:false,segments,span,far,factor:f,complete:!far&&hasAllNeighbors(current,record)};
  item.imageryReady=terrainImagery(current,record.coords).then(image=>{if(image&&!item.disposed&&!current.disposed){terrain.material.map=image;terrain.material.vertexColors=false;terrain.material.color.set('#ffffff');terrain.material.needsUpdate=true;}});
  (far?level.tiles:current.tiles).set(record,item);
  view.dataset.tilesBuilt=String((Number(view.dataset.tilesBuilt)||0)+1);
}
function refreshTile(current, record, item) {
  if (!item || item.version === record.gpuVersion) return;
  const values = item.texture.image.data;
  for (let i=0;i<record.threshold.length;i++) {
    values[i*4+1]=Number.isFinite(record.threshold[i])?record.threshold[i]:65536;
    values[i*4+2]=record.sea[i];
  }
  item.texture.needsUpdate=true;item.version=record.gpuVersion;
}
function disposeTile(current,item) {
  item.disposed=true;current.scene.remove(item.terrain,item.water);
  item.terrain.geometry.dispose();item.terrain.material.dispose();
  item.water.geometry.dispose();item.water.material.dispose();item.texture.dispose();
}
function updateTerrainScene(current,point) {
  // Rebase locally after each window shift to preserve precision and meter scale.
  current.origin={...point};current.position={x:0,z:0};current.span=tileSpan(latLng(point).lat);
  current.sample=terrainSampler(current.records);
  const xs=current.records.map(r=>r.coords.ux),ys=current.records.map(r=>r.coords.y),margin=current.span/128;
  current.bounds={minX:(Math.min(...xs)-point.x)*current.span+margin,maxX:(Math.max(...xs)+1-point.x)*current.span-margin,
    minZ:(Math.min(...ys)-point.y)*current.span+margin,maxZ:(Math.max(...ys)+1-point.y)*current.span-margin};
  current.recordKeys=new Set(current.records.map(r=>r.coords.ux+'/'+r.coords.y));
  // Reuse meshes that keep their detail level and had all neighbours: only move them.
  // Only new tiles, tiles that change ring or that gained a neighbour are rebuilt.
  const wanted=new Set(current.records);
  for(const [record,item] of current.tiles){
    if(!wanted.has(record)||item.segments!==tileSegments(record,point)||!item.complete){disposeTile(current,item);current.tiles.delete(record);continue;}
    const x=(record.coords.ux+0.5-point.x)*current.span,z=(record.coords.y+0.5-point.y)*current.span,scale=current.span/item.span;
    item.terrain.position.set(x,0,z);item.terrain.scale.set(scale,1,scale);item.water.position.set(x,0,z);item.water.scale.set(scale,1,scale);
  }
  for(const record of current.records)if(!current.tiles.has(record))buildTile(current,record);
  placeLevels(current,point);
  current.lowestSourceZoom=Math.min(...current.records.map(r=>r.dem.sourceZoom??DRONE_ZOOM));
  setViewDistance(current);
  current.windowCenter=Math.floor(point.x)+'/'+Math.floor(point.y);
  view.dataset.terrainWindows=String((Number(view.dataset.terrainWindows)||0)+1);
  view.dataset.terrainBlocks=String(current.records.length);
}
// Cada nivel lejano no se dibuja dentro del rectángulo cubierto por el nivel interior.
function recordsRect(records,factor,point,span){
  const xs=records.map(r=>r.coords.ux),ys=records.map(r=>r.coords.y);
  return [(Math.min(...xs)*factor-point.x)*span,((Math.max(...xs)+1)*factor-point.x)*span,(Math.min(...ys)*factor-point.y)*span,((Math.max(...ys)+1)*factor-point.y)*span];
}
function placeLevels(current,point){
  const {span}=current;let inner=recordsRect(current.records,1,point,span);
  // El relieve lejano entra ~45 m bajo el nivel interior y queda unos metros más abajo: así tapa
  // la grieta del borde sin asomar encima. El agua se recorta justo en el borde (sin superponerse).
  const margin=span*0.02;
  current.levels.forEach((level,index)=>level.drop=2*(index+1));
  for(const level of current.levels){
    const [minX,maxX,minZ,maxZ]=inner;level.rect.value.set(minX,maxX,minZ,maxZ);
    const [a,b,c,d]=level.clip;
    a.normal.set(-1,0,0);a.constant=minX+margin;b.normal.set(1,0,0);b.constant=-(maxX-margin);c.normal.set(0,0,-1);c.constant=minZ+margin;d.normal.set(0,0,1);d.constant=-(maxZ-margin);
    for(const [record,item] of level.tiles){
      const x=((record.coords.ux+0.5)*level.factor-point.x)*span,z=((record.coords.y+0.5)*level.factor-point.y)*span,scale=span/item.span;
      item.terrain.position.set(x,-level.drop,z);item.terrain.scale.set(scale,1,scale);item.water.position.set(x,item.water.position.y,z);item.water.scale.set(scale,1,scale);
    }
    if(!level.records.length)break;
    inner=recordsRect(level.records,level.factor,point,span);
  }
}
function setViewDistance(current){
  const loaded=current.levels.filter(level=>level.tiles.size).at(-1);
  const reach=loaded?loaded.radius*loaded.factor+loaded.factor/2:VIEW_RADIUS+0.5;
  current.scene.fog.near=current.span*(loaded?Math.min(reach*0.25,12):2.2);current.scene.fog.far=current.span*(loaded?reach:reach+2);
  current.camera.far=current.span*(reach+3)+15000;current.camera.updateProjectionMatrix();
}
async function streamLevel(current,point,index) {
  const level=current.levels[index],inner=index?current.levels[index-1]:null;
  if(level.disabled)return;
  const innerReady=inner?inner.records.length>=(2*inner.radius+1)**2:current.records.length>=(2*VIEW_RADIUS+1)**2;
  if(!innerReady||current.streaming||current.levels.some(l=>l.streaming)||performance.now()<level.retryAfter)return;
  const levelPoint={x:point.x/level.factor,y:point.y/level.factor},center=Math.floor(levelPoint.x)+'/'+Math.floor(levelPoint.y);
  if(center===level.center)return;
  const plan=planTerrainWindow(levelPoint,level.records,level.radius,level.zoom);
  if(!plan.missing.length){
    if(plan.remove.length){const removed=new Set(plan.remove);
      for(const [record,item] of level.tiles)if(removed.has(record)){disposeTile(current,item);level.tiles.delete(record);}
      level.records=plan.keep;bridge.releaseDroneTerrain(plan.remove);placeLevels(current,current.origin);setViewDistance(current);
      view.dataset['farBlocks'+level.zoom]=String(level.records.length);}
    level.center=center;return;
  }
  level.streaming=true;let added=[];
  try{
    added=await bridge.loadDroneTerrain(plan.missing,current.controller.signal);
    if(session!==current||current.disposed){bridge.releaseDroneTerrain(added);return;}
    const removed=new Set(plan.remove);
    for(const [record,item] of level.tiles)if(removed.has(record)){disposeTile(current,item);level.tiles.delete(record);}
    level.records=[...plan.keep,...added];
    bridge.releaseDroneTerrain(plan.remove);
    // Se construyen de a pocos por cuadro para no congelar el vuelo.
    for(let i=0;i<added.length;i++){
      if(i&&i%4===0){await new Promise(requestAnimationFrame);if(session!==current||current.disposed)return;}
      buildTile(current,added[i],level);placeLevels(current,current.origin);
    }
    setViewDistance(current);
    level.center=center;
    view.dataset['farBlocks'+level.zoom]=String(level.records.length);
  }catch(error){
    if(added.length)bridge.releaseDroneTerrain(added);
    if(session===current&&error.name!=='AbortError')level.retryAfter=performance.now()+8000;
  }finally{level.streaming=false;}
}
async function streamTerrain(current,point) {
  const center=Math.floor(point.x)+'/'+Math.floor(point.y);
  if(current.streaming||center===current.windowCenter||performance.now()<(current.retryAfter||0))return;
  const plan=planTerrainWindow(point,current.records,VIEW_RADIUS);
  if(!plan.missing.length){current.windowCenter=center;return;}
  current.streaming=true;current.streamError=false;
  let added=[];
  try {
    added=await bridge.loadDroneTerrain(plan.missing,current.controller.signal);
    if(session!==current||current.disposed){bridge.releaseDroneTerrain(added);return;}
    const actual={x:current.origin.x+current.position.x/current.span,y:current.origin.y+current.position.z/current.span};
    current.records=[...plan.keep,...added];
    updateTerrainScene(current,actual);
    current.windowCenter=center;
    bridge.releaseDroneTerrain(plan.remove);
  }catch(error){
    if(added.length)bridge.releaseDroneTerrain(added);
    if(session===current&&error.name!=='AbortError'){current.streamError=true;current.retryAfter=performance.now()+5000;}
  }finally{current.streaming=false;}
}
async function openDrone(point) {
  if (session || !bridge.snapshot().ready) return;
  finishPlacement(); bridge.closePanels();
  const current = {id:++sequence,controller:new AbortController(),records:[],tiles:new Map(),levels:[],position:{x:0,z:0},yaw:0,pitch:-0.18,lastTime:0,lastReadout:0,perf:{start:0,frames:0,time:0},frame:null,disposed:false,look:null,limited:false};
  view.dataset.tier=TIER;session=current;document.body.classList.add('drone-active');view.hidden=false;setFlightSettings(false);view.focus();
  loading.hidden=false;view.classList.add('is-loading');setLoadingError(false);$('droneLoadingText').textContent='Cargando relieve y conexión del agua…';$('droneRetry').hidden=true;
  warning.textContent='';readout.textContent='Preparando terreno…';$('droneUnderwater').hidden=true;
  try {
    threePromise ||= import('./vendor/three.module.min.js');
    const THREE=await threePromise;if(session!==current)return;
    current.THREE=THREE;
    // Precisión de profundidad hasta ~120 km: Z invertido si la GPU lo permite (sin costo), si no, logarítmica.
    current.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,...(supportsReversedDepth()?{reversedDepthBuffer:true}:{logarithmicDepthBuffer:true})});
    current.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    current.renderer.outputColorSpace=THREE.SRGBColorSpace;current.renderer.localClippingEnabled=true;
    current.levels=FAR_LEVELS.map(level=>({...level,disabled:false,factor:2**(DRONE_ZOOM-level.zoom),records:[],tiles:new Map(),center:null,streaming:false,retryAfter:0,
      clip:[new THREE.Plane(),new THREE.Plane(),new THREE.Plane(),new THREE.Plane()],rect:{value:new THREE.Vector4()}}));
    current.renderer.debug.onShaderError=()=>{current.shaderError=true;};
    canvas.addEventListener('webglcontextlost',onContextLost);
    current.scene=new THREE.Scene();current.scene.background=new THREE.Color('#9dc3d0');
    current.origin=worldPoint(point.lat,point.lng);current.span=tileSpan(point.lat);
    current.scene.fog=new THREE.Fog('#9dc3d0',current.span*2.2,current.span*(VIEW_RADIUS+2.5));
    current.camera=new THREE.PerspectiveCamera(65,1,0.5,current.span*(VIEW_RADIUS+4)+15000);
    current.scene.add(new THREE.HemisphereLight(0xe5f6ff,0x53616a,1.4));
    const sun=new THREE.DirectionalLight(0xfff4e5,1.5);sun.position.set(-1000,2000,-800);current.scene.add(sun);
    current.uniforms={level:{value:0},opacity:{value:1},visibleWater:{value:1},depthColors:{value:0},contour:{value:0}};
    const tiles=tileWindow(current.origin,START_RADIUS);
    // Match the map's detail level. The 3D view and 2D tiles share one FloodNetwork.
    bridge.prepareMap(point,DRONE_ZOOM);
    current.records=await bridge.loadDroneTerrain(tiles,current.controller.signal,count=>{
      if(session===current)$('droneLoadingText').textContent=`Cargando relieve y agua · ${count}/${tiles.length} bloques`;
    });
    if(session!==current)return;
    view.dataset.terrainWindows='0';updateTerrainScene(current,current.origin);
    current.windowCenter=null; // carga el anillo exterior en segundo plano
    $('droneLoadingText').textContent='Preparando imágenes del terreno…';
    await Promise.all([...current.tiles.values()].map(item=>item.imageryReady));
    if(session!==current)return;
    view.dataset.texturedTiles=String([...current.tiles.values()].filter(item=>item.terrain.material.map).length);
    const overOcean=current.sample(current.origin)?.sea;
    let best=overOcean?-Infinity:Infinity;
    for(let i=0;i<16;i++){const angle=i*Math.PI/8,probe=current.sample({x:current.origin.x+Math.sin(angle)*0.3,y:current.origin.y-Math.cos(angle)*0.3});
      if(probe&&(overOcean?probe.ground>best:probe.ground<best)){best=probe.ground;current.yaw=angle;}}
    current.lowestSourceZoom=Math.min(...current.records.map(r=>r.dem.sourceZoom??DRONE_ZOOM));
    resize();current.lastTime=performance.now()-40;current.frame=requestAnimationFrame(render);
  } catch(error) {
    if(session!==current||error.name==='AbortError')return;
    console.error('Drone scene:',error);
    bridge.releaseDroneTerrain(current.records);current.records=[];
    $('droneLoadingText').textContent=current.renderer?'No se pudo cargar el terreno. Puedes reintentar o volver al mapa.':'La vista 3D requiere WebGL 2. Puedes seguir usando el mapa.';
    $('droneRetry').hidden=!current.renderer;
  }
}
function onContextLost(event) {
  event.preventDefault();if(!session)return;
  bridge.pause();keys.clear();loading.hidden=false;
  $('droneLoadingText').textContent='Se perdió la vista 3D. Vuelve al mapa y abre el dron otra vez.';
  $('droneRetry').hidden=true;
  if(session.frame)cancelAnimationFrame(session.frame);
}
function resize() {
  positionDock();if(!session?.renderer)return;
  view.style.setProperty('--flight-bar',(window.innerHeight-document.querySelector('.playback').getBoundingClientRect().top)+'px');
  session.renderer.setSize(view.clientWidth,view.clientHeight,false);
  session.camera.aspect=view.clientWidth/view.clientHeight;session.camera.updateProjectionMatrix();
}
function render(now) {
  const current=session;if(!current?.sample||current.disposed)return;
  if(now-current.lastTime<1000/30){current.frame=requestAnimationFrame(render);return;}
  const interval=now-current.lastTime,dt=Math.min(interval/1000,0.05);current.lastTime=now;
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))-sticks.move.y;
  const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+sticks.move.x;
  current.yaw+=sticks.look.x*1.6*dt;current.pitch=clamp(current.pitch-sticks.look.y*1.2*dt,-1.45,1.45);
  const previousPosition=current.position;
  current.position=moveDrone(current.position,{forward,right,yaw:current.yaw,speed:options.speed,dt,bounds:current.bounds});
  const actualSpeed=Math.hypot(current.position.x-previousPosition.x,current.position.z-previousPosition.z)/Math.max(.001,dt);
  const point={x:current.origin.x+current.position.x/current.span,y:current.origin.y+current.position.z/current.span};
  streamTerrain(current,point);for(let i=0;i<current.levels.length;i++)streamLevel(current,point,i);
  const sample=current.sample(point);if(!sample){closeDrone();return;}
  let ground=sample.sea?0:sample.ground;
  if(keys.has('KeyQ')||keys.has('KeyE')||verticalInput) {
    const climb=clamp(Number(keys.has('KeyE'))-Number(keys.has('KeyQ'))+verticalInput,-1,1)*options.climb*dt;
    // En altitud fija se parte de la altura real del dron: si va rozando el suelo, bajar no hace nada
    // y subir lo eleva de inmediato (antes el valor seguía bajando bajo tierra sin efecto visible).
    if(options.mode==='fixed'){const floor=ground+2;options.fixed=clamp(Math.max(options.fixed,floor)+climb,Math.max(2,floor),MAX_FIXED);fixedInput.value=options.fixed.toFixed(1);}
    else{options.altitude=clamp(options.altitude+climb,2,2000);altitudeInput.value=options.altitude.toFixed(1);}
  }
  // En altitud fija el dron no baja del relieve: lo sobrevuela a 2 m como mínimo.
  const y=options.mode==='fixed'?Math.max(options.fixed,ground+2):ground+options.altitude;
  lastFlight={y,ground};
  const snapshot=bridge.snapshot();
  current.camera.position.set(current.position.x,y,current.position.z);
  current.camera.rotation.set(current.pitch,-current.yaw,0,'YXZ');
  current.uniforms.level.value=snapshot.level;current.uniforms.opacity.value=snapshot.waterOpacity;
  current.uniforms.visibleWater.value=Number(snapshot.showWater);current.uniforms.depthColors.value=Number(snapshot.depthColors);
  current.uniforms.contour.value=Number(snapshot.showContour);
  for(const tiles of [current.tiles,...current.levels.map(l=>l.tiles)])for(const [record,item] of tiles){refreshTile(current,record,item);item.water.position.y=snapshot.level;}
  const isWet=flooded(snapshot.level,sample.ground,sample.threshold,sample.sea);
  const underwater=isWet&&y<snapshot.level;
  $('droneUnderwater').hidden=!underwater;
  current.renderer.render(current.scene,current.camera);
  adaptReach(current,now,interval);
  if(!current.shaderError&&view.classList.contains('is-loading')){loading.hidden=true;view.classList.remove('is-loading');}
  if(current.shaderError){onContextLost({preventDefault(){}});$('droneLoadingText').textContent='Este dispositivo no pudo dibujar el agua 3D. Vuelve al mapa.';return;}
  if(now-current.lastReadout>150){current.lastReadout=now;const ll=latLng(point);
    readout.textContent=`${ll.lat.toFixed(5)}°, ${ll.lng.toFixed(5)}°`;
    $('droneHeightValue').textContent=fmt(y-ground)+' m';$('droneSeaValue').textContent=fmt(y)+' m';
    $('droneSpeedValue').textContent=fmt(actualSpeed)+' m/s';$('droneGroundValue').textContent=fmt(sample.ground)+' m';
    $('droneGroundValue').previousElementSibling.textContent=sample.sea?'Fondo · mar':'Terreno · mar';$('droneGroundValue').previousElementSibling.dataset.short=sample.sea?'Fondo':'Terreno';
    $('droneWaterValue').textContent='+'+fmt(snapshot.level)+' m';$('droneClearanceValue').textContent=isWet?fmt(y-snapshot.level)+' m':'Sin agua';
    const heading=((current.yaw*180/Math.PI)%360+360)%360,cardinal=['N','NE','E','SE','S','SO','O','NO'][Math.round(heading/45)%8];
    $('droneHeading').textContent=cardinal+' · '+String(Math.round(heading)%360).padStart(3,'0')+'°';
    window.dispatchEvent(new CustomEvent('deepterra:drone-telemetry',{detail:{altitude:y,level:snapshot.level,ground:sample.ground,sea:Boolean(sample.sea),heading}}));
    warning.textContent=current.streamError?'No se pudo ampliar el terreno. Reintentando…':current.position.limited?'Esperando terreno para continuar el vuelo…':current.streaming?'Cargando más terreno y conexión del agua…':current.lowestSourceZoom<DRONE_ZOOM?'Se usa parte del terreno de menor resolución.':'';
    warning.hidden=!warning.textContent;
  }
  current.frame=requestAnimationFrame(render);
}
// Si el vuelo baja de ~18 cuadros por segundo de forma sostenida, se achica el anillo más lejano
// (y si hace falta, se quita). Solo se mide con todo cargado y nunca vuelve a crecer en el vuelo.
function adaptReach(current,now,interval){
  if(FULL_REACH)return;
  const perf=current.perf;
  const settled=!loading.hidden||current.streaming||current.levels.some(l=>l.streaming||(!l.disabled&&l.center===null));
  if(settled||document.hidden){perf.start=now;perf.frames=0;perf.time=0;return;}
  perf.frames++;perf.time+=Math.min(interval,250);
  if(now-perf.start<4000)return;
  const average=perf.time/perf.frames;perf.start=now;perf.frames=0;perf.time=0;
  if(average<=55)return;
  const level=[...current.levels].reverse().find(l=>!l.disabled);if(!level)return;
  if(level.radius>1){level.radius--;level.center=null;}
  else{level.disabled=true;for(const item of level.tiles.values())disposeTile(current,item);level.tiles.clear();
    bridge.releaseDroneTerrain(level.records);level.records=[];view.dataset['farBlocks'+level.zoom]='0';placeLevels(current,current.origin);setViewDistance(current);}
  view.dataset.farRadius=current.levels.map(l=>l.disabled?0:l.radius).join(',');
}
function closeDrone() {
  const current=session;if(!current)return;
  session=null;current.disposed=true;current.controller.abort();keys.clear();resetSticks();
  if(current.frame)cancelAnimationFrame(current.frame);
  canvas.removeEventListener('webglcontextlost',onContextLost);
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  bridge.releaseDroneTerrain(current.records);for(const level of current.levels)bridge.releaseDroneTerrain(level.records);
  for(const item of current.tiles.values())disposeTile(current,item);
  for(const level of current.levels)for(const item of level.tiles.values())disposeTile(current,item);
  if(current.sample)bridge.prepareMap(latLng({x:current.origin.x+current.position.x/current.span,y:current.origin.y+current.position.z/current.span}),DRONE_ZOOM);
  // Reuse the canvas context on the next entry. Forcing context loss here
  // would make a quick second drop fail before the browser restores it.
  for(const task of current.imageryCache?.values()||[])task.then(texture=>{texture?.image?.close?.();texture?.dispose();});
  current.renderer?.dispose();
  view.hidden=true;document.body.classList.remove('drone-active');
  setFlightSettings(false);
  positionDock();bridge.refreshMap();button.focus();
}
$('droneExit').addEventListener('click',closeDrone);
$('droneCancelLoad').addEventListener('click',closeDrone);
$('droneRetry').addEventListener('click',()=>{if(!session)return;const point=latLng(session.origin);closeDrone();openDrone(point);});
function setFlightSettings(open){if(open)setFilter(false);$('droneSettings').hidden=!open;$('droneSettingsToggle').setAttribute('aria-expanded',String(open));if(!open&&document.activeElement?.closest('#droneSettings'))document.activeElement.blur();}
$('droneShowTelemetry').addEventListener('change',event=>view.classList.toggle('hide-telemetry',!event.target.checked));
$('droneShowJoysticks').addEventListener('change',event=>{view.classList.toggle('hide-joysticks',!event.target.checked);resetSticks();keys.delete('KeyQ');keys.delete('KeyE');});
$('droneSettingsToggle').addEventListener('click',()=>setFlightSettings($('droneSettings').hidden));
$('droneSettingsClose').addEventListener('click',()=>{setFlightSettings(false);view.focus();});
function setAltitudeMode(mode){
  if(mode===options.mode)return;
  // Al cambiar de modo se conserva la altura actual del dron: no salta.
  if(lastFlight.y!==null){if(mode==='fixed')options.fixed=clamp(Math.round(lastFlight.y),2,MAX_FIXED);else options.altitude=clamp(Math.round(lastFlight.y-lastFlight.ground),2,2000);}
  options.mode=mode;fixedInput.value=options.fixed;altitudeInput.value=options.altitude;
  $('droneSettings').dataset.altMode=mode;
  for(const button of document.querySelectorAll('[data-alt-mode]'))button.setAttribute('aria-pressed',String(button.dataset.altMode===mode));
  for(const input of [fixedInput,altitudeInput])input.dispatchEvent(new Event('deepterra:sync'));
}
for(const button of document.querySelectorAll('[data-alt-mode]'))button.addEventListener('click',()=>setAltitudeMode(button.dataset.altMode));
for(const [input,key,min,max] of [[speedInput,'speed',1,MAX_SPEED],[climbInput,'climb',1,MAX_SPEED],[altitudeInput,'altitude',2,2000],[fixedInput,'fixed',2,MAX_FIXED]]) {
  input.addEventListener('input',()=>{const value=Number(input.value);if(input.value!==''&&Number.isFinite(value))options[key]=clamp(value,min,max);});
  input.addEventListener('change',()=>{options[key]=clamp(Number(input.value)||options[key],min,max);input.value=options[key];});
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.dispatchEvent(new Event('change'));input.blur();}});
}
document.addEventListener('keydown',event=>{
  if(event.key==='Escape') {
    if(gesture||placement){event.preventDefault();event.stopImmediatePropagation();cancelGesture();finishPlacement();}
    else if(session){event.preventDefault();event.stopImmediatePropagation();closeDrone();}
    return;
  }
  if(placement&&event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();finishPlacement();openDrone(bridge.center());return;}
  if(!session)return;
  const editing=event.target.closest('input,textarea,select,[contenteditable="true"],[role="slider"]');
  if(editing||event.altKey||event.ctrlKey||event.metaKey)return;
  if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){
    event.preventDefault();event.stopPropagation();keys.add(event.code);
  }
},true);
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();if(session)session.look=null;cancelGesture();finishPlacement();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(session)bridge.pause();}});
canvas.addEventListener('pointerdown',event=>{
  if(!session?.sample||event.isPrimary===false||event.button!==0)return;
  event.preventDefault();view.focus();session.look={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!session?.look||event.pointerId!==session.look.id)return;
  const dx=event.clientX-session.look.x,dy=event.clientY-session.look.y;
  session.yaw+=dx*.0035;session.pitch=clamp(session.pitch-dy*.0035,-1.45,1.45);
  session.look.x=event.clientX;session.look.y=event.clientY;
});
const releaseLook=()=>{if(session)session.look=null;};
canvas.addEventListener('pointerup',releaseLook);canvas.addEventListener('pointercancel',releaseLook);canvas.addEventListener('lostpointercapture',releaseLook);
for(const [id,kind] of [['droneMoveStick','move'],['droneLookStick','look']]){
 const el=$(id),knob=el.querySelector('.stick-knob');let pointer=null;
 const update=event=>{const box=el.getBoundingClientRect(),radius=box.width*.32,dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2,norm=Math.max(radius,Math.hypot(dx,dy));sticks[kind].x=dx/norm;sticks[kind].y=dy/norm;knob.style.transform=`translate(calc(-50% + ${dx/norm*radius}px),calc(-50% + ${dy/norm*radius}px))`;};
 el.addEventListener('pointerdown',event=>{if(pointer!==null||!session?.sample)return;event.preventDefault();event.stopPropagation();pointer=event.pointerId;el.setPointerCapture(pointer);update(event);});
 el.addEventListener('pointermove',event=>{if(pointer!==event.pointerId)return;event.preventDefault();update(event);});
 const release=event=>{if(pointer!==event.pointerId)return;pointer=null;sticks[kind].x=sticks[kind].y=0;knob.style.transform='translate(-50%,-50%)';};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,release);
 for(const type of ['contextmenu','selectstart','dragstart'])el.addEventListener(type,event=>event.preventDefault());
 el.addEventListener('touchstart',event=>event.preventDefault(),{passive:false});
}
window.addEventListener('blur',resetSticks);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetSticks();});
const altitudeStick=$('droneAltitudeStick');
function setAltitudeInput(value){verticalInput=Math.abs(value)<.08?0:clamp(value,-1,1);altitudeStick.style.setProperty('--altitude-offset',(-verticalInput*30)+'px');altitudeStick.setAttribute('aria-valuenow',String(Math.round(verticalInput*100)));altitudeStick.setAttribute('aria-valuetext',verticalInput>0?'Subiendo':verticalInput<0?'Bajando':'Detenido');}
altitudeStick.addEventListener('pointerdown',event=>{if(verticalPointer!==null||!session?.sample)return;event.preventDefault();event.stopPropagation();verticalPointer={id:event.pointerId,y:event.clientY};altitudeStick.setPointerCapture(event.pointerId);});
altitudeStick.addEventListener('pointermove',event=>{if(verticalPointer?.id!==event.pointerId)return;event.preventDefault();setAltitudeInput((verticalPointer.y-event.clientY)/30);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])altitudeStick.addEventListener(type,event=>{if(verticalPointer?.id===event.pointerId)resetAltitudeStick();});
for(const type of ['contextmenu','selectstart','dragstart'])altitudeStick.addEventListener(type,event=>event.preventDefault());
altitudeStick.addEventListener('touchstart',event=>event.preventDefault(),{passive:false});
altitudeStick.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','Home'].includes(event.key)){event.preventDefault();setAltitudeInput(event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:0);}});
altitudeStick.addEventListener('keyup',resetAltitudeStick);altitudeStick.addEventListener('blur',resetAltitudeStick);
window.addEventListener('resize',resize);
window.addEventListener('deepterra:frame',positionDock);
positionDock();

// "Volar aquí" from the inspection card opens the drone at that point.
window.addEventListener('deepterra:fly-to',event=>{if(event.detail)openDrone(event.detail);});
window.addEventListener('deepterra:portrait-required',()=>{keys.clear();resetSticks();cancelGesture();finishPlacement();});
