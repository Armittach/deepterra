/* DeepTerra · comportamiento de la interfaz. La simulación vive en app.js; aquí solo se
   conectan los controles nuevos con los mismos elementos y el estado compartido. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const body=document.body,bridge=window.DeepTerraDroneBridge;
  const playback=$('simulationPlayback'),heightInput=$('height'),durationInput=$('duration'),time=$('time');
  const fmt=(n,d=1)=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:d});
  const mobile=matchMedia('(max-width: 640px)');
  const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));

  /* Medida del dock, para colocar la hoja de inspección y la telemetría. */
  new ResizeObserver(()=>document.documentElement.style.setProperty('--dock-h',playback.offsetHeight+'px')).observe(playback);

  /* Velo para hojas inferiores en móvil. */
  const scrim=document.createElement('div');scrim.className='sheet-scrim';scrim.hidden=true;document.body.append(scrim);
  function syncScrim(){scrim.hidden=!(mobile.matches&&(scenarioOpen()||!$('filterOptions').hidden));}
  scrim.addEventListener('click',()=>{setScenario(false);if(!$('filterOptions').hidden)setFilter(false);});

  /* ---------- Escenario ---------- */
  const panel=$('scenarioPanel'),toggle=$('scenarioToggle');
  const scenarioOpen=()=>!panel.hidden;
  function setScenario(open,focus=true){
    if(open===scenarioOpen())return;
    panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));playback.classList.toggle('scenario-open',open);
    if(open){if(!$('filterOptions').hidden)setFilter(false);if($('parameters').classList.contains('open'))$('closeMenu').click();if(focus&&!mobile.matches)heightInput.focus();}
    else if(panel.contains(document.activeElement)){document.activeElement.blur();if(focus)toggle.focus({preventScroll:true});}
    syncScrim();
  }
  toggle.addEventListener('click',()=>setScenario(!scenarioOpen()));
  $('scenarioClose').addEventListener('click',()=>setScenario(false));
  document.addEventListener('pointerdown',e=>{if(scenarioOpen()&&!mobile.matches&&!panel.contains(e.target)&&!toggle.contains(e.target))setScenario(false,false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&scenarioOpen()){e.preventDefault();e.stopImmediatePropagation();setScenario(false);}},true);
  function setValue(input,value){input.value=value;fire(input,'input');fire(input,'change');}
  panel.querySelectorAll('[data-height]').forEach(b=>b.addEventListener('click',()=>setValue(heightInput,b.dataset.height)));
  panel.querySelectorAll('[data-duration]').forEach(b=>b.addEventListener('click',()=>setValue(durationInput,b.dataset.duration)));
  panel.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{
    const v=Number(heightInput.value)||0,dir=Number(b.dataset.step);
    const step=v+(dir<0?-.001:0)<10?1:v+(dir<0?-.001:0)<100?10:v+(dir<0?-.001:0)<1000?50:250;
    const next=dir>0?Math.floor(v/step+1e-9)*step+step:Math.ceil(v/step-1e-9)*step-step;
    setValue(heightInput,String(Math.max(0,Math.min(8848.86,Math.round(next*100)/100))));
  }));
  $('scenarioApply').addEventListener('click',()=>{
    fire(heightInput,'change');fire(durationInput,'change');setScenario(false,false);
    if(!bridge.snapshot().playing)$('play').click();
  });
  function syncScenario(s){
    $('scenarioSummary').textContent=fmt(s.height,2)+' m · '+(s.duration>=120&&s.duration%60===0?fmt(s.duration/60)+' min':fmt(s.duration,0)+' s');
    panel.querySelectorAll('[data-height]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(Number(b.dataset.height)-s.height)<.005)));
    panel.querySelectorAll('[data-duration]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.duration)===s.duration)));
  }

  /* ---------- Reproducción ---------- */
  $('restart').addEventListener('click',()=>{time.value='0';fire(time,'input');});
  const scale=[...playback.querySelectorAll('.scale span')];
  let lastScale='';
  function sync(){
    const s=bridge.snapshot();
    time.style.setProperty('--progress',(s.progress*100).toFixed(2)+'%');
    const key=s.height+'';if(key!==lastScale){lastScale=key;scale.forEach((el,i)=>{const v=s.height*i/4;el.textContent=fmt(v,v<10?1:0)+(i===0||i===4?' m':'');});}
    syncScenario(s);
    $('simPillLevel').textContent='+'+fmt(s.level)+' m';$('simPillFill').style.width=(s.progress*100).toFixed(1)+'%';
    const playing=s.playing;if(simPlaying!==playing){simPlaying=playing;setIcon(simPlay,playing?'Pause':'Play');simPlay.setAttribute('aria-label',playing?'Pausar':'Reproducir');}
    const v=Math.round((1-s.waterOpacity)*100);
    for(const id of ['layerTransparency','droneTransparency']){const r=$(id);if(Number(r.value)!==v)r.value=v;r.style.setProperty('--fill',v+'%');$(id+'Value').textContent=v+' %';}
  }
  window.addEventListener('deepterra:frame',sync);

  /* ---------- Capas ---------- */
  $('filterClose').addEventListener('click',()=>{setFilter(false);});
  for(const id of ['layerTransparency','droneTransparency'])$(id).addEventListener('input',e=>{const t=$('waterTransparency');t.value=e.target.value;fire(t,'input');sync();});
  new MutationObserver(()=>{if(!$('filterOptions').hidden)setScenario(false,false);syncScrim();}).observe($('filterOptions'),{attributes:true,attributeFilter:['hidden']});
  L.DomEvent.disableClickPropagation(playback);L.DomEvent.disableScrollPropagation(playback);

  /* ---------- Información: pestañas ---------- */
  const tabs=[...document.querySelectorAll('.tabs [role=tab]')];
  function selectTab(tab,focus){for(const t of tabs){const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;$(t.getAttribute('aria-controls')).hidden=!on;}if(focus)tab.focus();}
  tabs.forEach((t,i)=>{t.addEventListener('click',()=>selectTab(t));t.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectTab(tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length],true);}});});

  /* ---------- Zoom y ubicación ---------- */
  $('zoomIn').addEventListener('click',()=>map.zoomIn());
  $('zoomOut').addEventListener('click',()=>map.zoomOut());
  $('locateMe').addEventListener('click',()=>{
    if(!navigator.geolocation){notify('Este navegador no permite obtener la ubicación.',true);return;}
    notify('Buscando tu ubicación…',false,true);
    navigator.geolocation.getCurrentPosition(p=>{$('status').hidden=true;map.setView([p.coords.latitude,p.coords.longitude],Math.max(map.getZoom(),12));},
      ()=>notify('No se pudo obtener tu ubicación. Revisa los permisos del navegador.',true),{enableHighAccuracy:false,timeout:10000,maximumAge:60000});
  });
  for(const el of [document.querySelector('.toolbar'),document.querySelector('.topbar')]){L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el);}

  /* ---------- Búsqueda ---------- */
  const form=$('searchForm'),input=$('searchInput'),results=$('searchResults'),topbar=document.querySelector('.topbar');
  let searchSeq=0;
  function openSearch(open){topbar.classList.toggle('search-open',open);$('searchToggle').setAttribute('aria-expanded',String(open));if(open)input.focus();else{results.hidden=true;input.blur();}}
  $('searchToggle').addEventListener('click',()=>openSearch(true));
  $('searchClose').addEventListener('click',()=>{input.value='';openSearch(false);});
  function goTo(lat,lng,bounds){
    results.hidden=true;input.blur();if(mobile.matches)openSearch(false);
    if(bounds)map.fitBounds(bounds,{maxZoom:12,animate:true});else map.setView([lat,lng],Math.max(map.getZoom(),10));
  }
  function showResults(items,message){
    results.replaceChildren();
    if(message){const li=document.createElement('li');li.className='empty';li.textContent=message;results.append(li);}
    for(const item of items){const li=document.createElement('li'),b=document.createElement('button'),name=document.createElement('span'),detail=document.createElement('small');
      b.type='button';b.setAttribute('role','option');name.textContent=item.name;detail.textContent=item.detail;b.append(name,detail);b.addEventListener('click',()=>pick(item));li.append(b);results.append(li);}
    results.hidden=false;
  }
  /* Búsqueda: MapTiler (misma clave del mapa) con resultados mientras se escribe. Sin clave, o si
     MapTiler la rechaza, se usa Nominatim, cuyas condiciones solo permiten buscar al pulsar Enter. */
  const config=window.DEEPTERRA_MAP_CONFIG||{};
  const geoKey=String(config.maptilerKey||'').trim();
  let typingTimer=null,searchAbort=null,currentItems=[],keyDenied=false;
  function parseCoords(q){const m=q.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);if(!m)return null;const lat=Number(m[1]),lng=Number(m[2]);return Math.abs(lat)<=85&&Math.abs(lng)<=180?{lat,lng}:null;}
  function goToCoords(c){goTo(c.lat,c.lng);map.once('moveend',()=>map.fire('click',{latlng:L.latLng(c.lat,c.lng)}));}
  function render(items,message){currentItems=items;showResults(items,message);}
  function httpError(label,r){const error=new Error(label+' '+r.status);error.status=r.status;return error;}
  const denied=err=>err.status===400||err.status===401||err.status===403;
  async function maptilerSearch(q,seq){
    searchAbort?.abort();searchAbort=new AbortController();
    const c=map.getCenter(),url='https://api.maptiler.com/geocoding/'+encodeURIComponent(q)+'.json?autocomplete=true&fuzzyMatch=true&limit=6&language=es&proximity='+c.lng.toFixed(3)+','+c.lat.toFixed(3)+'&key='+encodeURIComponent(geoKey);
    const r=await fetch(url,{signal:searchAbort.signal});if(!r.ok)throw httpError('MapTiler',r);
    const data=await r.json();if(seq!==searchSeq)return null;
    return (data.features||[]).map(f=>{const b=f.bbox;const rest=(f.place_name||'').startsWith(f.text)?f.place_name.slice(f.text.length).replace(/^,\s*/,''):f.place_name;
      return {name:f.text||f.place_name,detail:rest||'',lat:f.center[1],lng:f.center[0],bounds:b&&b.length===4&&(b[0]!==b[2]||b[1]!==b[3])?[[b[1],b[0]],[b[3],b[2]]]:null};});
  }
  async function nominatimSearch(q,seq){
    const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=es&q='+encodeURIComponent(q),{headers:{'Accept':'application/json'}});if(!r.ok)throw httpError('Nominatim',r);
    const data=await r.json();if(seq!==searchSeq)return null;
    return data.map(d=>{const parts=d.display_name.split(', ');const b=d.boundingbox?.map(Number);return {name:parts[0],detail:parts.slice(1).join(', '),lat:Number(d.lat),lng:Number(d.lon),bounds:b&&b.length===4?[[b[0],b[2]],[b[1],b[3]]]:null};});
  }
  const coordsHint='Escribe coordenadas (lat, lon), por ejemplo -33.45, -70.66.';
  async function runSearch(q,{fromEnter=false}={}){
    const seq=++searchSeq;
    const coords=parseCoords(q);
    if(coords){render([{name:'Ir a '+coords.lat+', '+coords.lng,detail:'Coordenadas (latitud, longitud)',coords}]);return;}
    const nominatim=!geoKey||keyDenied;
    if(nominatim&&!fromEnter){render([],'Pulsa Enter para buscar.');return;}
    if(!currentItems.length)render([],'Buscando…');
    try{
      const items=await (nominatim?nominatimSearch(q,seq):maptilerSearch(q,seq));
      if(items===null||seq!==searchSeq)return;
      render(items,items.length?'':'Sin resultados. Prueba con otro nombre o con coordenadas (lat, lon).');
    }catch(err){if(err.name==='AbortError'||seq!==searchSeq)return;
      if(denied(err)&&!nominatim){keyDenied=true;
        if(fromEnter){runSearch(q,{fromEnter});return;}
        render([],'Pulsa Enter para buscar.');return;}
      render([],'No se pudo buscar. Revisa tu conexión o escribe coordenadas (lat, lon).');}
  }
  async function pick(item){
    if(item.coords){goToCoords(item.coords);return;}
    input.value=item.name;
    goTo(item.lat,item.lng,item.bounds);
  }
  input.addEventListener('input',()=>{
    clearTimeout(typingTimer);const q=input.value.trim();
    if(q.length<2){searchSeq++;searchAbort?.abort();currentItems=[];results.hidden=true;return;}
    typingTimer=setTimeout(()=>runSearch(q),220);
  });
  input.addEventListener('focus',()=>{if(currentItems.length&&input.value.trim().length>=2)results.hidden=false;});
  form.addEventListener('submit',async e=>{
    e.preventDefault();clearTimeout(typingTimer);const q=input.value.trim();if(!q)return;
    if(currentItems.length&&!results.hidden&&currentItems[0]){pick(currentItems[0]);return;}
    await runSearch(q,{fromEnter:true});
    if(currentItems[0]?.coords)pick(currentItems[0]);
  });
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!results.hidden)results.hidden=true;else openSearch(false);}
    if(e.key==='ArrowDown'&&!results.hidden){e.preventDefault();results.querySelector('button')?.focus();}});
  results.addEventListener('keydown',e=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'&&i<buttons.length-1){e.preventDefault();buttons[i+1].focus();}if(e.key==='ArrowUp'){e.preventDefault();(i>0?buttons[i-1]:input).focus();}if(e.key==='Escape'){results.hidden=true;input.focus();}});
  document.addEventListener('pointerdown',e=>{if(!form.contains(e.target))results.hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey||body.classList.contains('drone-active'))return;if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;e.preventDefault();if(mobile.matches)openSearch(true);else input.focus();});

  /* ---------- Dron ---------- */
  const simPlay=document.querySelector('.sim-pill-play');let simPlaying=null;
  $('simPill').addEventListener('click',e=>{
    if(simPlay.contains(e.target)){$('play').click();return;}
    const open=!body.classList.contains('sim-open');body.classList.toggle('sim-open',open);$('simPill').setAttribute('aria-expanded',String(open));
  });
  new MutationObserver(()=>{if(!body.classList.contains('drone-active')&&body.classList.contains('sim-open')){body.classList.remove('sim-open');$('simPill').setAttribute('aria-expanded','false');}}).observe(body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('deepterra:close-panels',()=>setScenario(false,false));
  const compass=$('compassTape'),tape=$('droneTape'),tapeScale=tape.querySelector('.tape-scale');
  const cardinals={0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SO',270:'O',315:'NO'};
  let lastHeading=null;
  function drawCompass(heading){
    if(lastHeading!==null&&Math.abs(heading-lastHeading)<.5)return;lastHeading=heading;
    const width=compass.clientWidth||360,pxPerDeg=width/120,parts=[];
    for(let d=Math.ceil((heading-60)/15)*15;d<=heading+60;d+=15){const n=((d%360)+360)%360,x=width/2+(d-heading)*pxPerDeg;
      parts.push(cardinals[n]!==undefined?`<span class="${n%90===0?'major':''}" style="left:${x.toFixed(1)}px">${cardinals[n]}</span>`:`<span style="left:${x.toFixed(1)}px">${n}</span>`);}
    compass.innerHTML=parts.join('');
  }
  window.addEventListener('deepterra:drone-telemetry',e=>{
    const {altitude,level,ground,heading}=e.detail;drawCompass(heading);
    const top=Math.max(50,altitude,level,ground)*1.25,bottom=Math.min(0,ground,level),span=top-bottom||1,f=v=>Math.max(0,Math.min(1,(v-bottom)/span));
    tape.style.setProperty('--water',f(level).toFixed(4));tape.style.setProperty('--ground',f(ground).toFixed(4));tape.style.setProperty('--drone',f(altitude).toFixed(4));
    tape.querySelector('.tape-water-label').textContent='agua +'+fmt(level,0);tape.querySelector('.tape-drone-label').textContent=fmt(altitude,0)+' m';
    const step=[10,25,50,100,250,500,1000,2500][[10,25,50,100,250,500,1000,2500].findIndex(s=>span/s<=5)]??5000,ticks=[];
    for(let v=Math.ceil(bottom/step)*step;v<=top;v+=step)if(f(v)<.88)ticks.push(`<span style="bottom:${(f(v)*100).toFixed(2)}%">${fmt(v,0)}</span>`);
    tapeScale.innerHTML=ticks.join('');
  });

  /* Ajustes de vuelo: deslizadores con escala de raíz cuadrada (más precisión en valores bajos)
     sincronizados con los campos numéricos que usa drone.js. */
  const ranges=[...document.querySelectorAll('.sqrt-range')].map(range=>{
    const target=$(range.dataset.target),min=Number(range.dataset.min),max=Number(range.dataset.max),a=Math.sqrt(min),b=Math.sqrt(max);
    const toValue=t=>Math.round(Math.pow(a+t*(b-a),2)),toPos=v=>Math.round((Math.sqrt(Math.max(min,Math.min(max,v)))-a)/(b-a)*1000);
    const paint=()=>range.style.setProperty('--fill',(range.value/10)+'%');
    const pull=()=>{if(document.activeElement===range)return;const v=Number(target.value);if(Number.isFinite(v)){range.value=toPos(v);paint();}};
    range.addEventListener('input',()=>{target.value=toValue(range.value/1000);fire(target,'input');paint();});
    range.addEventListener('change',()=>fire(target,'change'));
    target.addEventListener('change',pull);target.addEventListener('input',pull);target.addEventListener('deepterra:sync',pull);pull();
    return pull;
  });
  /* Filtros de agua dentro de los ajustes de vuelo (en 3D no se cambia el mapa base). */
  const mirrors=[...document.querySelectorAll('[data-mirror]')];
  const pullMirrors=()=>{for(const m of mirrors)m.checked=$(m.dataset.mirror).checked;};
  for(const m of mirrors){m.addEventListener('change',()=>{const source=$(m.dataset.mirror);source.checked=m.checked;fire(source,'change');});$(m.dataset.mirror).addEventListener('change',pullMirrors);}
  new MutationObserver(()=>{if(!$('droneSettings').hidden){pullMirrors();ranges.forEach(f=>f());}}).observe($('droneSettings'),{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('deepterra:drone-telemetry',()=>ranges.forEach(f=>f()));

  /* Ocultar interfaz (mapa y dron, escritorio y móvil). H alterna; Esc o el botón del ojo la muestran. */
  const uiToggles=[...document.querySelectorAll('[data-ui-toggle]')];
  function setUiHidden(hidden){
    if(hidden===body.classList.contains('ui-hidden'))return;
    if(hidden){if(!$('filterOptions').hidden)setFilter(false);setScenario(false,false);if(!$('droneSettings').hidden)$('droneSettingsClose').click();if(document.activeElement&&document.activeElement!==body)document.activeElement.blur();}
    body.classList.toggle('ui-hidden',hidden);$('showUi').hidden=!hidden;for(const t of uiToggles)t.checked=hidden;
    if(hidden&&body.classList.contains('drone-active'))$('droneView').focus();
  }
  for(const t of uiToggles)t.addEventListener('change',()=>setUiHidden(t.checked));
  $('showUi').addEventListener('click',()=>setUiHidden(false));
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input:not([type=checkbox]):not([type=range]),textarea,select,[contenteditable="true"]'))return;
    if(e.key==='h'||e.key==='H'){e.preventDefault();setUiHidden(!body.classList.contains('ui-hidden'));}
    else if(e.key==='Escape'&&body.classList.contains('ui-hidden')){e.preventDefault();e.stopImmediatePropagation();setUiHidden(false);}
  },true);

  /* Sugerencia del dron la primera vez. */
  let tipShown=false;try{tipShown=sessionStorage.getItem('deepterra-drone-tip')==='1';}catch{}
  function showTip(){if(tipShown||!bridge.snapshot().ready||matchMedia('(pointer:coarse)').matches)return;tipShown=true;try{sessionStorage.setItem('deepterra-drone-tip','1');}catch{}body.classList.add('show-drone-tip');setTimeout(()=>body.classList.remove('show-drone-tip'),6000);}
  window.addEventListener('deepterra:frame',showTip);

  mobile.addEventListener('change',syncScrim);
  sync();
})();
