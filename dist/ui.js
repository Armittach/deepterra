/* DeepTerra · comportamiento de la interfaz. La simulación vive en app.js; aquí solo se
   conectan los controles nuevos con los mismos elementos y el estado compartido. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const body=document.body,bridge=window.DeepTerraDroneBridge;
  const playback=$('simulationPlayback'),heightInput=$('height'),durationInput=$('duration'),time=$('time');
  const fmt=(n,d=1)=>Number(n).toLocaleString(window.DeepTerraI18n?.locale||'es-CL',{maximumFractionDigits:d});
  const mobile=matchMedia('(max-width: 640px)');
  // Paneles como hojas (con velo detrás): celular en vertical y teléfono en horizontal.
  const sheets=matchMedia('(max-width: 640px), (orientation: landscape) and (max-height: 500px)');
  const fire=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
  // Aviso genérico de la interfaz (lo usa el panel de desarrollo para registrar gestos y paneles).
  // Versión visible (menú): sale de version.js.
  if(window.DEEPTERRA_VERSION)for(const el of document.querySelectorAll('.app-version'))el.textContent='v'+window.DEEPTERRA_VERSION;
  const uiLog=msg=>{try{dispatchEvent(new CustomEvent('deepterra:ui',{detail:msg}));}catch{}};
  /* Toque inmediato (pantallas táctiles): el botón actúa al levantar el dedo, sin esperar el «click» del
     navegador. Si un panel se está abriendo o cerrando, el botón se mueve bajo el dedo y el navegador
     descarta el click (por eso había que esperar ~1 s). El dedo queda «capturado» por el botón y el click
     nativo que llegue después se ignora para no actuar dos veces. */
  function fastTap(el){
    if(!el)return;let down=null;
    el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||e.button>0)return;down={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};try{el.setPointerCapture(e.pointerId);}catch{}});
    el.addEventListener('pointerup',e=>{const d=down;down=null;if(!d||e.pointerId!==d.id||el.disabled)return;
      if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>14||performance.now()-d.t>800)return;
      el.__fastAt=performance.now();el.click();});
    el.addEventListener('pointercancel',()=>{down=null;});
    el.addEventListener('click',e=>{if(e.isTrusted&&el.__fastAt&&performance.now()-el.__fastAt<800){el.__fastAt=0;e.preventDefault();e.stopImmediatePropagation();}},true);
  }
  /* Barras del nivel en pantallas táctiles (mapa y dron): la barra no reacciona sola al tocarla (pointer-events:none
     en ui.css); este gesto decide qué hacer. Un toque corto la mueve a ese punto; mantener presionado no hace nada;
     deslizar a lo largo de la barra la arrastra; deslizar en el otro sentido se deja al panel (abrir o cerrar).
     host: el panel que recibe el toque; release(): cancela el arrastre del panel cuando la barra se queda el gesto. */
  const coarse=matchMedia('(pointer:coarse)');
  function gestureRange(input,host,release){
    let g=null,eatClickUntil=0;
    const along=(e,vertical)=>vertical?-(e.clientY-g.y0):e.clientX-g.x0,across=(e,vertical)=>vertical?e.clientX-g.x0:e.clientY-g.y0;
    function setAt(x,y){
      const r=input.getBoundingClientRect(),f=g.vertical?(r.bottom-y)/r.height:(x-r.left)/r.width;
      const v=(Math.max(0,Math.min(1,f))*100).toFixed(1);if(input.value!==v){input.value=v;fire(input,'input');}
    }
    host.addEventListener('pointerdown',e=>{
      eatClickUntil=0;// un toque nuevo: el bloqueo del anterior ya no aplica
      // Los botones cercanos (▶, volver a 0…) tienen prioridad sobre la zona de toque ampliada de la barra.
      g=null;if(!coarse.matches||e.button>0||e.target.closest('button,a,select,textarea,input:not([type=range])')||input.disabled||input.closest('[inert]')||!input.getClientRects().length||getComputedStyle(input).visibility==='hidden')return;
      const r=input.getBoundingClientRect(),vertical=input.getAttribute('aria-orientation')==='vertical',pad=14;
      if(e.clientX<r.left-pad||e.clientX>r.right+pad||e.clientY<r.top-pad||e.clientY>r.bottom+pad)return;
      g={id:e.pointerId,x0:e.clientX,y0:e.clientY,t0:e.timeStamp,vertical,mode:null};
    },true);
    host.addEventListener('pointermove',e=>{
      if(!g||e.pointerId!==g.id)return;
      if(!g.mode){
        const a=Math.abs(along(e,g.vertical)),c=Math.abs(across(e,g.vertical));
        if(Math.max(a,c)<8)return;
        if(a<=c){g=null;uiLog('Barra del nivel: gesto vertical → panel');return;}// en el otro sentido: lo maneja el panel
        g.mode='scrub';release();uiLog('Barra del nivel: arrastre');try{host.setPointerCapture(e.pointerId);}catch{}
      }
      e.preventDefault();e.stopPropagation();setAt(e.clientX,e.clientY);
    },true);
    host.addEventListener('pointerup',e=>{
      if(!g||e.pointerId!==g.id)return;
      if(!g.mode&&e.timeStamp-g.t0<500){setAt(g.x0,g.y0);uiLog('Barra del nivel: toque → '+input.value+' %');}// toque corto: mueve; mantener presionado: nada
      else if(!g.mode)uiLog('Barra del nivel: mantenido, sin acción');
      else if(g.mode)e.stopPropagation();
      // El toque fue de la barra (también si se mantuvo presionado): el clic que sigue no abre el panel ni toca lo de debajo.
      eatClickUntil=performance.now()+400;
      g=null;
    },true);
    host.addEventListener('pointercancel',()=>{g=null;},true);
    host.addEventListener('click',e=>{if(performance.now()<eatClickUntil){eatClickUntil=0;e.preventDefault();e.stopPropagation();uiLog('Clic ignorado: era de la barra del nivel');}},true);
  }

  /* Barra del nivel del mar: vertical a la derecha en el mapa (pantallas medianas y grandes con
     altura suficiente); horizontal abajo en el celular, en pantallas bajas y en la vista del dron
     (ahí va unida a los datos de vuelo). */
  const verticalFits=matchMedia('(min-width: 641px) and (min-height: 520px)');
  function syncLevelLayout(){
    // Diseño A: la barra del nivel va siempre abajo, en horizontal (la regla vertical quedó en desuso).
    const vertical=false&&verticalFits.matches&&!body.classList.contains('drone-active');
    if(vertical!==body.classList.contains('level-vertical'))body.classList.toggle('level-vertical',vertical);
    if(time.getAttribute('aria-orientation')!==(vertical?'vertical':'horizontal'))time.setAttribute('aria-orientation',vertical?'vertical':'horizontal');
    syncDock();
  }
  /* Medida del dock (solo cuando va abajo), para colocar la hoja de inspección y la telemetría. */
  function syncDock(){document.documentElement.style.setProperty('--dock-h',(body.classList.contains('level-vertical')?0:playback.offsetHeight)+'px');}
  new ResizeObserver(syncDock).observe(playback);
  verticalFits.addEventListener('change',syncLevelLayout);
  new MutationObserver(syncLevelLayout).observe(body,{attributes:true,attributeFilter:['class']});
  syncLevelLayout();

  /* Velo detrás de las hojas del celular (abajo en vertical, a un lado en horizontal). */
  const scrim=document.createElement('div');scrim.className='sheet-scrim';scrim.hidden=true;document.body.append(scrim);
  function syncScrim(){scrim.hidden=!(sheets.matches&&(!panel.hidden||!$('filterOptions').hidden||!$('settingsPanel').hidden));}
  scrim.addEventListener('click',()=>{setScenario(false);if(!$('filterOptions').hidden)setFilter(false);setSettings(false,false);});

  /* ---------- Escenario ---------- */
  const panel=$('scenarioPanel'),toggle=$('scenarioToggle');
  /* En el celular en vertical el escenario se abre dentro del panel de abajo, igual que el mando del dron:
     el panel crece con una animación corta y sigue al dedo al arrastrar la rayita (--sp: 0 cerrado, 1 abierto). */
  let scenOpen=false,sheetP=0,sheetAnim=0,sheetDrag=null,sheetSuppress=0;
  const scenarioOpen=()=>scenOpen,sheetMode=()=>sheets.matches,sheetReduce=matchMedia('(prefers-reduced-motion: reduce)');
  // Alto que ocupa el escenario abierto: todo su contenido, sin pasar del 88 % de la pantalla con los controles.
  function measureSheet(){
    if(panel.hidden||!sheetMode())return;
    const room=window.innerHeight*.88-playback.querySelector('.playback-controls').offsetHeight-40;
    panel.style.setProperty('--sh',Math.round(Math.max(60,Math.min(panel.scrollHeight,room)))+'px');
    // Si todo cabe (no hay que desplazar por dentro), las opciones también sirven para deslizar y cerrar.
    panel.classList.toggle('fits',panel.scrollHeight<=room);
  }
  function setSheetP(p){
    sheetP=p;playback.style.setProperty('--sp',p.toFixed(4));
    const others=!$('filterOptions').hidden||!$('settingsPanel').hidden;scrim.style.opacity=others?'':String(p);
  }
  function finishClose(){if(!scenOpen){panel.hidden=true;scrim.style.opacity='';syncScrim();}}
  function animateSheet(target){
    cancelAnimationFrame(sheetAnim);const done=()=>{panel.classList.remove('is-moving');if(!target)finishClose();};
    if(!sheetMode()||sheetReduce.matches||sheetP===target){setSheetP(target);done();return;}
    panel.classList.add('is-moving');const from=sheetP,start=performance.now(),ms=Math.max(120,240*Math.abs(target-from));
    const step=now=>{const t=Math.min(1,(now-start)/ms),e=1-Math.pow(1-t,3);setSheetP(from+(target-from)*e);if(t<1)sheetAnim=requestAnimationFrame(step);else done();};
    sheetAnim=requestAnimationFrame(step);
  }
  function setScenario(open,focus=true){
    if(open!==scenOpen){
      scenOpen=open;toggle.setAttribute('aria-expanded',String(open));playback.classList.toggle('scenario-open',open);uiLog('Panel Escenario '+(open?'abierto':'cerrado'));
      if(open){panel.hidden=false;measureSheet();if(!$('filterOptions').hidden)setFilter(false);setSettings(false,false);if($('parameters').classList.contains('open'))$('closeMenu').click();if(focus&&!sheets.matches)heightInput.focus();}
      else if(panel.contains(document.activeElement)){document.activeElement.blur();if(focus)toggle.focus({preventScroll:true});}
      syncScrim();
    }
    animateSheet(open?1:0);
  }
  toggle.addEventListener('click',()=>setScenario(!scenarioOpen()));
  // El escenario se abre y se cierra con clic en el botón de metros y tiempo (no al pasar el mouse).
  // Arrastre de la hoja: la rayita del panel de abajo (abre) y la rayita o el título de la hoja (cierra).
  // Un toque en la rayita abre o cierra; al soltar decide un gesto rápido o cuánto se recorrió (35 %).
  // Se arrastra desde cualquier parte de la tarjeta (también sobre los botones: un toque sigue siendo un toque),
  // salvo la barra del nivel y los campos. Abierta, sobre las opciones solo si caben (si no, ahí se desplaza por dentro).
  function sheetDown(e){
    if(!sheetMode()||sheetDrag||e.button>0||e.target.closest('input,select,textarea'))return;
    if(scenOpen&&e.target.closest('.scenario-panel')&&!panel.classList.contains('fits'))return;
    sheetDrag={id:e.pointerId,el:e.currentTarget,handle:Boolean(e.target.closest('.sheet-handle')),x0:e.clientX,y0:e.clientY,p0:scenOpen?sheetP:0,from:scenOpen,active:false,samples:[{y:e.clientY,t:e.timeStamp}]};
  }
  function sheetMove(e){
    const d=sheetDrag;if(!d||e.pointerId!==d.id)return;const dy=e.clientY-d.y0;
    if(!d.active){
      if(Math.abs(dy)<6||Math.abs(dy)<=Math.abs(e.clientX-d.x0))return;
      d.active=true;cancelAnimationFrame(sheetAnim);panel.classList.add('is-moving');
      if(panel.hidden){panel.hidden=false;setSheetP(0);scrim.hidden=false;}measureSheet();
      try{d.el.setPointerCapture(e.pointerId);}catch{}
    }
    e.preventDefault();setSheetP(Math.max(0,Math.min(1,d.p0-dy/Math.max(120,parseFloat(panel.style.getPropertyValue('--sh'))||300))));
    d.samples.push({y:e.clientY,t:e.timeStamp});if(d.samples.length>5)d.samples.shift();
  }
  function sheetUp(e){
    const d=sheetDrag;if(!d||e.pointerId!==d.id)return;sheetDrag=null;
    if(!d.active){if(e.type==='pointerup'&&d.handle)setScenario(!scenOpen,false);return;}
    sheetSuppress=performance.now()+400;
    const a=d.samples[0],b=d.samples.at(-1),v=(b.y-a.y)/Math.max(1,b.t-a.t);
    // Más sensible que antes: basta un gesto corto (o un cuarto del recorrido) para abrir o cerrar.
    const open=v<-.3?true:v>.3?false:d.from?sheetP>.75:sheetP>.25;
    if(open!==scenOpen)setScenario(open,false);else animateSheet(open?1:0);
  }
  // El bloqueo del clic tras un arrastre vale solo para ese gesto: en el teléfono el navegador no suele mandar ese clic,
  // y sin esto se comería el siguiente toque (p. ej. ▶ justo después de cerrar el panel).
  playback.addEventListener('pointerdown',()=>{sheetSuppress=0;},true);
  playback.addEventListener('pointerdown',sheetDown);playback.addEventListener('pointermove',sheetMove);
  for(const t of ['pointerup','pointercancel'])playback.addEventListener(t,sheetUp);
  window.addEventListener('resize',measureSheet);
  gestureRange(time,playback,()=>{sheetDrag=null;});
  playback.addEventListener('click',e=>{if(performance.now()<sheetSuppress){e.preventDefault();e.stopPropagation();uiLog('Clic ignorado: tras deslizar el panel');}},true);
  // También tocar los metros o los segundos abre o cierra el escenario.
  document.querySelector('.playback .readout').addEventListener('click',()=>{if(sheets.matches)setScenario(!scenarioOpen(),false);});
  $('scenarioClose').addEventListener('click',()=>setScenario(false));
  document.addEventListener('pointerdown',e=>{if(scenarioOpen()&&!sheets.matches&&!panel.contains(e.target)&&!toggle.contains(e.target))setScenario(false,false);});
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
  // «Aplicar» guarda los metros y la duración sin reproducir; «Aplicar y reproducir» además arranca.
  $('scenarioApplyOnly').addEventListener('click',()=>{fire(heightInput,'change');fire(durationInput,'change');setScenario(false,false);});
  $('scenarioApply').addEventListener('click',()=>{
    fire(heightInput,'change');fire(durationInput,'change');setScenario(false,false);
    if(!bridge.snapshot().playing)$('play').click();
  });
  // Celular: «Otro» muestra el campo para escribir cualquier valor (como el mando del dron).
  panel.querySelectorAll('[data-other]').forEach(b=>b.addEventListener('click',()=>{
    const field=b.closest('.field'),on=!field.classList.contains('custom-on');field.classList.toggle('custom-on',on);
    if(on)(b.dataset.other==='height'?heightInput:durationInput).focus({preventScroll:true});measureSheet();
  }));
  panel.querySelectorAll('[data-height],[data-duration]').forEach(b=>b.addEventListener('click',()=>{b.closest('.field').classList.remove('custom-on');measureSheet();}));
  function syncScenario(s){
    $('scenarioSummary').textContent=fmt(s.height,2)+' m · '+(s.duration>=120&&s.duration%60===0?fmt(s.duration/60)+' min':fmt(s.duration,0)+' s');
    panel.querySelectorAll('[data-height]').forEach(b=>b.setAttribute('aria-pressed',String(Math.abs(Number(b.dataset.height)-s.height)<.005)));
    panel.querySelectorAll('[data-duration]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.duration)===s.duration)));
    const hPreset=[...panel.querySelectorAll('[data-height]')].some(b=>b.getAttribute('aria-pressed')==='true'),dPreset=[...panel.querySelectorAll('[data-duration]')].some(b=>b.getAttribute('aria-pressed')==='true');
    panel.querySelector('[data-other=height]').setAttribute('aria-pressed',String(!hPreset));panel.querySelector('[data-other=duration]').setAttribute('aria-pressed',String(!dPreset));
    if(!hPreset)heightInput.closest('.field').classList.add('custom-on');if(!dPreset)durationInput.closest('.field').classList.add('custom-on');
  }

  /* ---------- Reproducción ---------- */
  $('restart').addEventListener('click',()=>{time.value='0';fire(time,'input');});
  const scale=[...playback.querySelectorAll('.scale span')];
  let lastScale='';
  function sync(){
    const s=bridge.snapshot();
    time.style.setProperty('--progress',(s.progress*100).toFixed(2)+'%');
    const valueText='+'+fmt(s.level)+' m de '+fmt(s.height,2)+' m';if(time.getAttribute('aria-valuetext')!==valueText)time.setAttribute('aria-valuetext',valueText);
    const key=s.height+(window.DeepTerraI18n?.lang||'');if(key!==lastScale){lastScale=key;scale.forEach((el,i)=>{const v=s.height*i/4;el.textContent=fmt(v,v<10?1:0)+(i===0||i===4?' m':'');});}
    syncScenario(s);
    syncMando(s);
    const v=Math.round((1-s.waterOpacity)*100);
    for(const id of ['layerTransparency','droneTransparency']){const r=$(id);if(Number(r.value)!==v)r.value=v;r.style.setProperty('--fill',v+'%');$(id+'Value').textContent=v+' %';}
  }
  window.addEventListener('deepterra:frame',sync);
  // Pausar o reproducir no siempre redibuja: se sincroniza también cuando cambia el botón (íconos del mando y opciones).
  new MutationObserver(sync).observe($('play'),{attributes:true,attributeFilter:['aria-pressed','aria-label','disabled']});

  /* ---------- Capas ---------- */
  $('filterClose').addEventListener('click',()=>{setFilter(false);});
  for(const id of ['layerTransparency','droneTransparency'])$(id).addEventListener('input',e=>{const t=$('waterTransparency');t.value=e.target.value;fire(t,'input');sync();});
  new MutationObserver(()=>{if(!$('filterOptions').hidden){setScenario(false,false);setSettings(false,false);}syncScrim();}).observe($('filterOptions'),{attributes:true,attributeFilter:['hidden']});

  /* ---------- Ajustes (engranaje junto a Capas): pantalla, ayuda e información ---------- */
  const settings=$('settingsPanel'),settingsToggle=$('settingsToggle');
  const settingsOpen=()=>!settings.hidden;
  function setSettings(open,focus=true){
    if(open===settingsOpen())return;
    settings.hidden=!open;settingsToggle.setAttribute('aria-expanded',String(open));
    if(open){if(!$('filterOptions').hidden)setFilter(false);setScenario(false,false);if($('parameters').classList.contains('open'))$('closeMenu').click();if(focus)$('settingsClose').focus({preventScroll:true});}
    else if(settings.contains(document.activeElement)){document.activeElement.blur();if(focus)settingsToggle.focus({preventScroll:true});}
    syncScrim();
  }
  settingsToggle.addEventListener('click',()=>setSettings(!settingsOpen()));
  $('settingsClose').addEventListener('click',()=>setSettings(false));
  document.addEventListener('pointerdown',e=>{if(settingsOpen()&&!settings.contains(e.target)&&!settingsToggle.contains(e.target)&&!scrim.contains(e.target))setSettings(false,false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&settingsOpen()){e.preventDefault();e.stopImmediatePropagation();setSettings(false);}},true);
  for(const el of [settings,settingsToggle]){L.DomEvent.disableClickPropagation(el);L.DomEvent.disableScrollPropagation(el);}
  /* «Cómo se calcula» y «Datos y créditos» abren el panel de información en esa pestaña. */
  for(const b of settings.querySelectorAll('[data-info-tab]'))b.addEventListener('click',()=>{
    setSettings(false,false);if(!$('parameters').classList.contains('open'))$('menuToggle').click();selectTab($(b.dataset.infoTab));
  });
  $('tourRestart').addEventListener('click',()=>{setSettings(false,false);window.DeepTerraTour?.start();});
  $('droneTourStart')?.addEventListener('click',()=>{$('droneSettingsClose')?.click();setTimeout(()=>window.DeepTerraTour?.start('drone'),50);});

  /* ---------- Datos del punto bajo el mouse (escritorio) ----------
     Dos preferencias distintas, guardadas en este navegador: mostrar la caja o no (Ajustes) y, si se
     muestra, abierta o plegada (flecha de la propia caja). Empieza plegada. */
  const store={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
  const cursorInfo=$('cursorInfo'),cursorToggle=$('cursorInfoToggle'),cursorSwitch=$('showCursorInfo');
  function setCursorInfoShown(shown,save){body.classList.toggle('cursor-info-off',!shown);cursorSwitch.checked=shown;if(save)store.set('deepterra-cursor-info',shown?'on':'off');}
  function setCursorInfoOpen(open,save){cursorInfo.classList.toggle('open',open);$('cursorInfoBody').hidden=!open;cursorToggle.setAttribute('aria-expanded',String(open));
    cursorToggle.setAttribute('aria-label',open?'Plegar los datos del punto bajo el mouse':'Desplegar los datos del punto bajo el mouse');if(save)store.set('deepterra-cursor-info-open',open?'1':'0');}
  setCursorInfoShown(store.get('deepterra-cursor-info')!=='off',false);
  setCursorInfoOpen(store.get('deepterra-cursor-info-open')==='1',false);
  cursorSwitch.addEventListener('change',()=>setCursorInfoShown(cursorSwitch.checked,true));
  cursorToggle.addEventListener('click',()=>setCursorInfoOpen(!cursorInfo.classList.contains('open'),true));
  L.DomEvent.disableClickPropagation(cursorInfo);L.DomEvent.disableScrollPropagation(cursorInfo);
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
  /* Escritorio y tableta: solo la lupa. Se despliega al pasar el mouse (con margen invisible alrededor
     y una pausa antes de cerrarse, para no exigir puntería), al tocarla o al llegar con el teclado.
     Sigue abierta mientras tenga el foco o texto; se pliega al salir si está vacía. */
  let hovering=false,collapseTimer=null;
  function setExpanded(open){if(open)clearTimeout(collapseTimer);form.classList.toggle('expanded',open);}
  function maybeCollapse(delay){clearTimeout(collapseTimer);collapseTimer=setTimeout(()=>{if(!hovering&&!form.contains(document.activeElement)&&!input.value.trim()){results.hidden=true;setExpanded(false);}},delay);}
  form.addEventListener('pointerenter',e=>{if(e.pointerType!=='mouse')return;hovering=true;setExpanded(true);});
  form.addEventListener('pointerleave',e=>{if(e.pointerType!=='mouse')return;hovering=false;maybeCollapse(300);});
  form.addEventListener('focusin',()=>setExpanded(true));
  form.addEventListener('focusout',()=>maybeCollapse(150));
  // Tocar o pulsar la lupa (o el margen) lleva el foco al campo, que despliega la barra.
  form.addEventListener('click',e=>{if(e.target===form||e.target.closest('.search>.lucide'))input.focus();});
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
  // Extensión opcional (DeepTerraExtensions.search): otro buscador reemplaza a MapTiler y Nominatim.
  const provider=window.DeepTerraExtensions?.search;
  let typingTimer=null,searchAbort=null,currentItems=[],keyDenied=false;
  function parseCoords(q){const m=q.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);if(!m)return null;const lat=Number(m[1]),lng=Number(m[2]);return Math.abs(lat)<=85&&Math.abs(lng)<=180?{lat,lng}:null;}
  function goToCoords(c){goTo(c.lat,c.lng);map.once('moveend',()=>map.fire('click',{latlng:L.latLng(c.lat,c.lng)}));}
  function render(items,message){currentItems=items;showResults(items,message);provider?.decorate?.(results,items);}
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
  async function providerSearch(q,seq){
    searchAbort?.abort();searchAbort=new AbortController();
    const items=await provider.search(q,{signal:searchAbort.signal,center:map.getCenter().wrap()});return seq===searchSeq?items:null;
  }
  const coordsHint='Escribe coordenadas (lat, lon), por ejemplo -33.45, -70.66.';
  async function runSearch(q,{fromEnter=false}={}){
    const seq=++searchSeq;
    const coords=parseCoords(q);
    if(coords){render([{name:'Ir a '+coords.lat+', '+coords.lng,detail:'Coordenadas (latitud, longitud)',coords}]);return;}
    if(provider&&(!provider.available()||keyDenied)){render([],provider.unavailable+' '+coordsHint);return;}
    const nominatim=!provider&&(!geoKey||keyDenied);
    if(nominatim&&!fromEnter){render([],'Pulsa Enter para buscar.');return;}
    if(!currentItems.length)render([],'Buscando…');
    try{
      const items=await (provider?providerSearch(q,seq):nominatim?nominatimSearch(q,seq):maptilerSearch(q,seq));
      if(items===null||seq!==searchSeq)return;
      render(items,items.length?'':'Sin resultados. Prueba con otro nombre o con coordenadas (lat, lon).');
    }catch(err){if(err.name==='AbortError'||seq!==searchSeq)return;
      if(denied(err)&&!nominatim){keyDenied=true;
        if(provider){render([],provider.unavailable+' '+coordsHint);return;}
        if(fromEnter){runSearch(q,{fromEnter});return;}
        render([],'Pulsa Enter para buscar.');return;}
      render([],'No se pudo buscar. Revisa tu conexión o escribe coordenadas (lat, lon).');}
  }
  async function pick(item){
    if(item.coords){goToCoords(item.coords);return;}
    input.value=item.name;
    if(!item.ref){goTo(item.lat,item.lng,item.bounds);return;}
    // Resultado de una extensión que se ubica al elegirlo.
    const seq=++searchSeq;
    try{const place=await provider.locate(item);if(seq!==searchSeq)return;results.hidden=true;goTo(place.lat,place.lng,place.bounds);}
    catch{if(seq===searchSeq)render([],'No se pudo ubicar ese lugar. Inténtalo de nuevo.');}
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

  /* ---------- Dron: mando del celular y de pantallas angostas ----------
     Un solo panel abajo (index.html, #droneMando). Cerrado: joysticks en los extremos y, al centro,
     reproducir, nivel y tres datos. La rayita de arriba (o deslizar sobre el centro) lo abre: --p va
     de 0 (cerrado) a 1 (abierto) siguiendo el dedo y el CSS interpola fondo, esquinas y alto con ese
     valor; el centro cerrado se desvanece y aparecen el reproductor, el escenario y todos los datos. */
  const mando=$('droneMando'),handle=$('droneMandoHandle'),more=$('droneMandoMore'),moreInner=more.firstElementChild;
  const mandoClosed=mando.querySelector('.mando-closed'),mandoGrid=mando.querySelector('.mando-center .mando-grid');
  const mandoPlays=[...mando.querySelectorAll('.mando-play')],mandoIcons=[...mando.querySelectorAll('.mando-play-icon')];
  const mandoPlay=$('mandoPlay'),mandoTime=$('mandoTime'),mandoLevel=$('mandoLevel'),mandoLevels=[...mando.querySelectorAll('.mando-level')];
  const mandoScale=[...mando.querySelectorAll('.mando-scale span')],mandoStats=[...mando.querySelectorAll('[data-of]')];
  const mandoHeight=$('mandoHeight'),mandoOther=$('mandoOther'),mandoOtherField=$('mandoOtherField');
  const mandoDuration=$('mandoDuration'),mandoDurOther=$('mandoDurOther'),mandoDurField=$('mandoDurField');
  const elevation=document.querySelector('.drone-elevation'),droneTop=document.querySelector('.drone-topbar');
  const droneView=$('droneView'),mandoRow=mando.querySelector('.mando-row'),mandoCenter=mando.querySelector('.mando-center');
  const mandoScrub=$('mandoScrub'),moveStick=$('droneMoveStick'),lookStick=$('droneLookStick'),mandoPlayRow=mando.querySelector('.mando-play-row'),mandoRange=$('mandoRange');
  const mandoMedia=matchMedia('(pointer:coarse), (max-width:640px)'),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp01=v=>Math.max(0,Math.min(1,v)),px=name=>parseFloat(getComputedStyle(mando).getPropertyValue(name))||0;
  let mandoP=0,mandoOpen=false,mandoAnim=0,mandoIconName='',mandoKey='',drag=null,suppressClickUntil=0;
  const droneOn=()=>body.classList.contains('drone-active')&&mandoMedia.matches;
  /* Teléfono en horizontal (mismo corte que ui.css): clase drone-land en el body. La pestaña del mando va
     pegada al borde de abajo y los joysticks salen de ella: quedan sueltos en la vista, invisibles, y
     aparecen donde se toca (sticks-dynamic, drone.js). Al volver a vertical regresan al mando. */
  const landMedia=matchMedia('(orientation:landscape) and (max-height:500px)');
  const landOn=()=>droneOn()&&landMedia.matches;
  function syncLand(){
    const on=landOn();
    if(on!==body.classList.contains('drone-land'))body.classList.toggle('drone-land',on);
    const dynamic=on&&!body.classList.contains('ui-hidden')&&!droneView.classList.contains('hide-joysticks');
    if(dynamic!==droneView.classList.contains('sticks-dynamic'))droneView.classList.toggle('sticks-dynamic',dynamic);
    if(on&&moveStick.parentElement!==droneView)droneView.insertBefore(moveStick,mando),droneView.insertBefore(lookStick,mando);
    else if(!on&&moveStick.parentElement===droneView){mandoRow.insertBefore(moveStick,mandoCenter);mandoRow.append(lookStick);}
  }
  /* Leyenda de profundidad en el dron (celular): copia de la del mapa (#depthLegend, que vive en la barra
     del nivel, oculta en el dron del celular). Se muestra con «Colorear según profundidad». */
  const droneLegend=$('depthLegend').cloneNode(true);
  droneLegend.id='droneDepthLegend';droneLegend.classList.add('drone-depth-legend');
  $('droneView').insertBefore(droneLegend,mando);
  const syncDroneLegend=()=>{droneLegend.hidden=!$('depthColors').checked;if(droneOn())layoutMando();};
  $('depthColors').addEventListener('change',syncDroneLegend);droneLegend.hidden=!$('depthColors').checked;
  /* Alto de lo que se revela al abrir (con tope: si la pantalla es baja, se desplaza por dentro).
     En horizontal, el mando abierto no pasa del 70 % del alto de la pantalla. En vertical, si se ve la
     leyenda de profundidad (encima del mando), se le deja su lugar bajo la barra superior. */
  function measureMando(){
    if(!droneOn())return;
    const box=mando.getBoundingClientRect(),bottom=window.innerHeight-box.bottom;
    let room=window.innerHeight-bottom-(droneTop.getBoundingClientRect().bottom+12)-px('--row1')-2;
    if(!landMedia.matches&&!droneLegend.hidden)room-=droneLegend.offsetHeight+8;
    if(window.innerWidth>window.innerHeight)room=Math.min(room,window.innerHeight*.7-px('--row1')-2);
    if(landMedia.matches){
      // Pestaña en horizontal: ancho abierto = el de la fila de abajo, con un mínimo para el escenario.
      const rowW=mandoPlayRow.offsetWidth+px('--row-pad'),maxW=window.innerWidth-2*Math.max(12,px('--land-gap'));
      mando.style.setProperty('--w0',Math.ceil(rowW)+'px');mando.style.setProperty('--w1',Math.floor(Math.min(maxW,Math.max(rowW,px('--w-open'))))+'px');
      // Sin pasar del 70 % del alto ni tapar la barra de arriba.
      const fixed=mando.offsetHeight-more.offsetHeight;
      room=Math.min(window.innerHeight*.7,window.innerHeight-droneTop.getBoundingClientRect().bottom-6)-fixed;
    }
    mando.style.setProperty('--more-h',Math.max(0,Math.min(moreInner.offsetHeight,room))+'px');
    // Si todo cabe (sin desplazar por dentro), las opciones también sirven para deslizar y cerrar (como en el mapa).
    mando.classList.toggle('more-fits',moreInner.offsetHeight<=room);
  }
  /* Recorrido del dedo que equivale a abrir del todo. */
  const mandoTravel=()=>Math.max(60,parseFloat(mando.style.getPropertyValue('--more-h'))-(landMedia.matches?0:px('--h0')-2-px('--row1')));
  /* Control de altura: sube lo necesario para no quedar bajo el mando; si no cabe, se oculta. */
  function tuckElevation(){
    if(!droneOn()){elevation.style.transform='';elevation.classList.remove('is-tucked');document.documentElement.style.removeProperty('--drone-mando-space');return;}
    const top=mando.getBoundingClientRect().top,natural=elevation.offsetTop,h=elevation.offsetHeight;
    // En horizontal el control de altura va sobre el joystick «Mirar», al lado de la tarjeta: nunca se cruzan.
    const shift=landMedia.matches?0:Math.max(0,natural+h+12-top),fits=natural-shift>=droneTop.getBoundingClientRect().bottom+12;
    elevation.style.transform=shift&&fits?`translateY(${-shift}px)`:'';elevation.classList.toggle('is-tucked',!fits);
    // Espacio que ocupa el mando abajo (otros paneles, como el de desarrollo, se quedan encima).
    document.documentElement.style.setProperty('--drone-mando-space',Math.round(window.innerHeight-top+8)+'px');
  }
  function setMandoP(p){mandoP=p;mando.style.setProperty('--p',p.toFixed(4));tuckElevation();}
  function setMando(open,instant=false){
    if(open!==mandoOpen)uiLog('Panel del dron '+(open?'abierto':'cerrado'));
    cancelAnimationFrame(mandoAnim);mandoOpen=open;
    handle.setAttribute('aria-expanded',String(open));handle.setAttribute('aria-label',open?'Cerrar el reproductor y los datos':'Abrir el reproductor y los datos');
    // En horizontal la fila de abajo (reproducir, nivel y datos) sigue a la vista y se usa abierta o cerrada.
    more.inert=mandoGrid.inert=!open;mandoClosed.inert=open&&!landMedia.matches;if(!open){mando.classList.remove('is-open');showOther(false);showDurOther(false);}
    measureMando();
    const target=open?1:0,from=mandoP,done=()=>{mando.classList.remove('is-moving');mando.classList.toggle('is-open',open);setMandoP(target);};
    if(instant||reduceMotion.matches||!droneOn()||from===target){done();return;}
    // Animación corta (~220 ms) con salida suave desde donde quedó el dedo.
    mando.classList.add('is-moving');const start=performance.now(),ms=Math.max(120,220*Math.abs(target-from));
    const step=now=>{const t=Math.min(1,(now-start)/ms),e=1-Math.pow(1-t,3);setMandoP(from+(target-from)*e);if(t<1)mandoAnim=requestAnimationFrame(step);else done();};
    mandoAnim=requestAnimationFrame(step);
  }
  // Arrastre: la rayita o el centro del panel (nunca los joysticks ni los deslizadores).
  // Abierto, el área de datos y escenario puede desplazarse por dentro: ahí no se arrastra.
  function canDrag(target){
    if(target.closest('.drone-stick,input,.mando-other'))return false;
    return !mandoOpen||Boolean(target.closest('.mando-handle,.mando-row'))||(mando.classList.contains('more-fits')&&Boolean(target.closest('.mando-more')));
  }
  mando.addEventListener('pointerdown',()=>{suppressClickUntil=0;},true);// (igual que en el mapa: solo para el mismo gesto)
  mando.addEventListener('pointerdown',e=>{
    if(drag||e.button>0||!canDrag(e.target))return;
    e.stopPropagation();measureMando();
    drag={id:e.pointerId,x0:e.clientX,y0:e.clientY,p0:mandoP,from:mandoOpen,active:false,samples:[{y:e.clientY,t:e.timeStamp}]};
  });
  mando.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dy=e.clientY-drag.y0;
    if(!drag.active){
      if(Math.abs(dy)<8||Math.abs(dy)<=Math.abs(e.clientX-drag.x0))return;
      drag.active=true;cancelAnimationFrame(mandoAnim);mando.classList.remove('is-open');mando.classList.add('is-moving');
      try{mando.setPointerCapture(e.pointerId);}catch{}
    }
    e.preventDefault();setMandoP(clamp01(drag.p0-dy/mandoTravel()));
    drag.samples.push({y:e.clientY,t:e.timeStamp});if(drag.samples.length>5)drag.samples.shift();
  });
  function endDrag(e){
    if(!drag||e.pointerId!==drag.id)return;
    const d=drag;drag=null;if(!d.active)return;
    suppressClickUntil=performance.now()+400;
    // Al soltar: un gesto rápido decide; si no, cuánto se recorrió (35 % abre, 35 % cierra).
    const a=d.samples[0],b=d.samples.at(-1),v=(b.y-a.y)/Math.max(1,b.t-a.t);
    setMando(v<-.5?true:v>.5?false:d.from?mandoP>.65:mandoP>.35);
  }
  for(const type of ['pointerup','pointercancel'])mando.addEventListener(type,endDrag);
  gestureRange(mandoTime,mando,()=>{drag=null;});gestureRange(mandoScrub,mando,()=>{drag=null;});
  mando.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();uiLog('Clic ignorado: tras deslizar el mando');}},true);
  handle.addEventListener('click',()=>setMando(!mandoOpen));
  // Tocar los metros o los datos (no ▶ ni la barra del nivel) también abre el reproductor; en horizontal, abre o cierra.
  mandoClosed.addEventListener('click',e=>{if(e.composedPath().some(n=>n instanceof Element&&n.matches('button,input')))return;// (composedPath: al tocar ▶ su ícono cambia y el original ya no está en la página)
    if(!mandoOpen)setMando(true);else if(landMedia.matches)setMando(false);});
  // Esc cierra primero el mando abierto (después, Esc vuelve al mapa).
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mandoOpen&&droneOn()){e.preventDefault();e.stopImmediatePropagation();setMando(false);handle.focus({preventScroll:true});}},true);

  /* Reproductor del mando: usa los mismos controles de la simulación. */
  for(const b of mandoPlays)b.addEventListener('click',()=>$('play').click());
  for(const el of [$('play'),$('restart'),$('scenarioToggle'),$('scenarioApply'),$('scenarioApplyOnly'),$('scenarioClose'),...mandoPlays])fastTap(el);
  mandoTime.addEventListener('input',()=>{time.value=mandoTime.value;fire(time,'input');});
  // Barra fina de la pestaña en horizontal: mueve el mismo nivel (canDrag ignora los input: no abre la pestaña).
  mandoScrub.addEventListener('input',()=>{time.value=mandoScrub.value;fire(time,'input');});
  function fitLevel(){
    mandoLevel.style.fontSize='';if(landMedia.matches)return;
    const room=mandoLevel.parentElement.clientWidth-mandoPlay.offsetWidth-6,w=mandoLevel.scrollWidth;
    if(room>0&&w>room)mandoLevel.style.fontSize=Math.max(11,Math.floor(16*room/w))+'px';
  }
  function syncMando(s){
    const level='+'+fmt(s.level)+' m';
    if(mandoLevel.textContent!==level){const fit=mandoLevel.textContent.length!==level.length;for(const el of mandoLevels)el.textContent=level;if(fit&&droneOn())fitLevel();}
    const value=(s.progress*100).toFixed(1);for(const r of [mandoTime,mandoScrub])if(document.activeElement!==r)r.value=value;
    const fill=(s.progress*100).toFixed(2)+'%';mandoTime.style.setProperty('--fill',fill);mandoScrub.style.setProperty('--fill',fill);mando.style.setProperty('--fill',fill);
    mandoTime.disabled=mandoScrub.disabled=time.disabled;for(const b of mandoPlays)b.disabled=$('play').disabled;
    const valueText=level+' de '+fmt(s.height,2)+' m';if(mandoTime.getAttribute('aria-valuetext')!==valueText){mandoTime.setAttribute('aria-valuetext',valueText);mandoScrub.setAttribute('aria-valuetext',valueText);}
    // is-playing: la inundación se está reproduciendo (las opciones siguen a la vista; se esconden solo mientras
    // se mueve un joystick, ver sticks-held en ui.css).
    if(s.playing!==mando.classList.contains('is-playing'))mando.classList.toggle('is-playing',s.playing);
    // data-icon: el CSS rellena solo reproducir y pausa (el ícono de repetir es de trazo: relleno sería una mancha).
    const icon=s.playing?'Pause':s.progress>=1?'RotateCcw':'Play';
    if(icon!==mandoIconName){mandoIconName=icon;mandoIcons.forEach(el=>setIcon(el,icon));for(const b of mandoPlays){b.dataset.icon=icon;b.setAttribute('aria-label',s.playing?'Pausar la inundación':s.progress>=1?'Repetir la inundación':'Reproducir la inundación');}}
    const key=s.height+'|'+s.duration;if(key===mandoKey)return;mandoKey=key;
    // Escala bajo el deslizador: 0, ¼, ½, ¾ y la subida máxima (como la barra del mapa).
    mandoScale.forEach((el,i)=>{const v=s.height*i/4;el.textContent=fmt(v,v<10?1:0)+(i===0||i===4?' m':'');});
    mandoRange.textContent='0 – '+fmt(s.height,2)+' m';
    // Espacio fijo para el nivel más largo («+49,9 m»): la pestaña horizontal no se ensancha al reproducir.
    {const d=String(Math.floor(s.height)).length;mando.style.setProperty('--lvl-w',(d+(d>3?1:0)+5)+'ch');if(droneOn())measureMando();}
    let preset=false;
    for(const b of mando.querySelectorAll('[data-height]')){const on=Math.abs(Number(b.dataset.height)-s.height)<.005;preset||=on;b.setAttribute('aria-pressed',String(on));}
    mandoOther.setAttribute('aria-pressed',String(!preset));mandoOther.title=preset?'Otra subida':'Ahora: '+fmt(s.height,2)+' m';
    let durPreset=false;
    for(const b of mando.querySelectorAll('[data-duration]')){const on=Number(b.dataset.duration)===s.duration;durPreset||=on;b.setAttribute('aria-pressed',String(on));}
    // Duración libre: si no es un atajo, el botón «Otro» muestra el valor (p. ej. «45 s»).
    const durText=durPreset?'Otro':durLabel(s.duration);
    if(mandoDurOther.textContent!==durText)mandoDurOther.textContent=durText;
    mandoDurOther.setAttribute('aria-pressed',String(!durPreset));
    mandoDurOther.setAttribute('aria-label',durPreset?'Otra duración':'Otra duración (ahora '+durLabel(s.duration)+')');
  }
  // 45 → «45 s»; 180 → «3 min»; 150 → «150 s».
  function durLabel(v){return v>=120&&v%60===0?fmt(v/60)+' min':fmt(v)+' s';}
  /* Escenario rápido: los mismos campos del panel «Escenario» del mapa (subida y duración). */
  mando.querySelectorAll('[data-height]').forEach(b=>b.addEventListener('click',()=>setValue(heightInput,b.dataset.height)));
  mando.querySelectorAll('[data-duration]').forEach(b=>b.addEventListener('click',()=>setValue(durationInput,b.dataset.duration)));
  // «Otro»: un campo en el mismo lugar para escribir los metros exactos.
  function showOther(on){
    mandoOther.hidden=on;mandoOtherField.hidden=!on;mandoOther.setAttribute('aria-expanded',String(on));
    if(on){mandoHeight.value=heightInput.value;mandoHeight.focus({preventScroll:true});mandoHeight.select();}
  }
  function applyOther(){
    if(mandoOtherField.hidden)return;
    const v=Number(mandoHeight.value);if(mandoHeight.value!==''&&Number.isFinite(v))setValue(heightInput,String(Math.max(0,Math.min(8848.86,v))));
    showOther(false);
  }
  mandoOther.addEventListener('click',()=>showOther(true));
  mandoHeight.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();applyOther();mandoOther.focus({preventScroll:true});}});
  mandoHeight.addEventListener('blur',applyOther);
  // «Otro» de la duración: cualquier cantidad de segundos (de 1 a 3.600, como el panel «Escenario»). Enter o
  // «Listo» del teclado la aplican; un valor vacío o inválido no cambia nada.
  function showDurOther(on){
    mandoDurOther.hidden=on;mandoDurField.hidden=!on;mandoDurOther.setAttribute('aria-expanded',String(on));
    if(on){mandoDuration.value=durationInput.value;mandoDuration.focus({preventScroll:true});mandoDuration.select();}
  }
  function applyDurOther(){
    if(mandoDurField.hidden)return;
    const v=Number(String(mandoDuration.value).replace(',','.'));
    if(mandoDuration.value!==''&&Number.isFinite(v)&&v>0)setValue(durationInput,String(Math.max(1,Math.min(3600,Math.round(v)))));
    showDurOther(false);
  }
  mandoDurOther.addEventListener('click',()=>showDurOther(true));
  mandoDuration.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();applyDurOther();mandoDurOther.focus({preventScroll:true});}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();mandoDuration.value='';showDurOther(false);mandoDurOther.focus({preventScroll:true});}});
  mandoDuration.addEventListener('blur',applyDurOther);
  /* Datos del mando: tres en el cerrado y todos en el abierto (copias de la telemetría de drone.js;
     sin decimales si son largos, para que quepan entre los joysticks). */
  const compact=t=>t.replace(/^(-?\d{1,3}(?:\.\d{3})+|-?\d{3,}),\d/,'$1');
  window.addEventListener('deepterra:drone-telemetry',()=>{for(const el of mandoStats){const t=compact($(el.dataset.of).textContent);if(el.textContent!==t)el.textContent=t;}});
  function layoutMando(){syncLand();if(!droneOn()){if(mandoOpen||mandoP)setMando(false,true);tuckElevation();return;}mandoClosed.inert=mandoOpen&&!landMedia.matches;measureMando();setMandoP(mandoP);fitLevel();}
  mandoMedia.addEventListener('change',layoutMando);landMedia.addEventListener('change',layoutMando);window.addEventListener('resize',layoutMando);
  new ResizeObserver(()=>{if(droneOn()){measureMando();tuckElevation();}}).observe(moreInner);
  new MutationObserver(layoutMando).observe(body,{attributes:true,attributeFilter:['class']});
  $('droneView').addEventListener('change',e=>{if(e.target.id==='droneShowTelemetry'||e.target.id==='droneShowJoysticks')requestAnimationFrame(layoutMando);});
  more.inert=mandoGrid.inert=true;

  /* Primera vez en horizontal: una pista corta de cómo se usan los joysticks (se va a los 3 s o al tocar). */
  const stickHint=$('droneStickHint');let hintTimer=0,hintDone=store.get('deepterra-drone-sticks-hint')==='1';
  function hideStickHint(){clearTimeout(hintTimer);if(stickHint.hidden)return;stickHint.classList.remove('visible');setTimeout(()=>{if(!stickHint.classList.contains('visible'))stickHint.hidden=true;},reduceMotion.matches?0:400);}
  function maybeStickHint(){
    if(hintDone||!droneView.classList.contains('sticks-dynamic')||droneView.classList.contains('is-loading'))return;
    hintDone=true;store.set('deepterra-drone-sticks-hint','1');
    stickHint.hidden=false;requestAnimationFrame(()=>stickHint.classList.add('visible'));hintTimer=setTimeout(hideStickHint,3000);
  }
  window.addEventListener('deepterra:drone-telemetry',maybeStickHint);
  droneView.addEventListener('pointerdown',hideStickHint,true);
  new MutationObserver(()=>{if(!body.classList.contains('drone-land'))hideStickHint();}).observe(body,{attributes:true,attributeFilter:['class']});

  /* Pantalla completa (teléfono en horizontal): se oculta si el navegador no lo permite (p. ej. Safari del iPhone). */
  const fsButtons=[$('droneFullscreen'),$('mapFullscreen')],fsRoot=document.documentElement;
  const fsElement=()=>document.fullscreenElement||document.webkitFullscreenElement||null;
  const fsSupported=Boolean(fsRoot.requestFullscreen||fsRoot.webkitRequestFullscreen)&&(document.fullscreenEnabled??document.webkitFullscreenEnabled)!==false;
  for(const b of fsButtons)b.hidden=!fsSupported;
  let fsIcon='';
  function syncFullscreen(){
    const on=Boolean(fsElement()),label=on?'Salir de pantalla completa':'Pantalla completa',icon=on?'Minimize':'Maximize';
    for(const b of fsButtons){b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(on));}
    if(icon!==fsIcon){fsIcon=icon;for(const b of fsButtons)setIcon(b.firstElementChild,icon);}
  }
  for(const b of fsButtons)b.addEventListener('click',()=>{
    try{
      if(fsElement()){const exit=document.exitFullscreen||document.webkitExitFullscreen;Promise.resolve(exit?.call(document)).catch(()=>{});}
      else{const request=fsRoot.requestFullscreen||fsRoot.webkitRequestFullscreen;Promise.resolve(request?.call(fsRoot,{navigationUI:'hide'})).catch(()=>{});}
    }catch{}
  });
  for(const type of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(type,()=>{syncFullscreen();requestAnimationFrame(layoutMando);});
  if(fsSupported)syncFullscreen();

  /* Créditos en horizontal (drone-land): MapTiler (logo y texto) abajo a la izquierda y OpenStreetMap abajo a la
     derecha, en las esquinas libres junto a la pestaña. --corner-w = ancho libre de cada esquina; --mt-logo-w =
     ancho del logo (el texto va a su derecha). Si una esquina es muy angosta, suben sobre la pestaña. */
  const credits=document.querySelector('.preview-credits'),root=document.documentElement;
  /* Mapa en horizontal: Capas y Ajustes pasan a la columna de herramientas de la derecha (Capas arriba, Ajustes
     abajo; en medio ubicación, transparencia y el dron). Al volver a vertical o entrar al dron, vuelven a su lugar. */
  const landTools=[$('filterToggle'),$('settingsToggle')].map(el=>({el,parent:el.parentNode,next:el.nextSibling}));
  function arrangeLandTools(on){
    const bar=document.querySelector('.toolbar');
    if(on){bar.prepend(landTools[0].el);bar.append(landTools[1].el);}
    else for(const t of landTools)t.parent.insertBefore(t.el,t.next);
  }
  function placeCredits(){
    // (Solo si cambia: classList.remove siempre reescribe el atributo y el MutationObserver de abajo se dispararía sin fin.)
    // map-land: mapa (no el dron) con el teléfono en horizontal; los créditos van a los lados de la pestaña.
    if(credits)root.style.setProperty('--credits-w',credits.offsetWidth+'px');
    const mapLand=landMedia.matches&&!body.classList.contains('drone-active');
    if(mapLand!==body.classList.contains('map-land')){body.classList.toggle('map-land',mapLand);arrangeLandTools(mapLand);}
    if(mapLand){
      const logo=document.querySelector('.maptiler-logo'),logoW=logo&&!logo.hidden?logo.offsetWidth:0;
      const room=Math.floor((window.innerWidth-playback.offsetWidth)/2-10-8);
      root.style.setProperty('--corner-w',Math.max(0,room)+'px');root.style.setProperty('--mt-logo-w',logoW+'px');
      if((room<72)!==body.classList.contains('credits-lifted'))body.classList.toggle('credits-lifted',room<72);
      return;
    }
    if(!body.classList.contains('drone-land')){if(body.classList.contains('credits-lifted'))body.classList.remove('credits-lifted');return;}
    const logo=document.querySelector('.maptiler-logo'),logoW=logo&&!logo.hidden?logo.offsetWidth:0;
    // Ancho de la pestaña cerrada (abierta puede ser más ancha: se usa la cerrada como referencia).
    if(!mandoOpen&&!mandoP)closedTabW=mando.offsetWidth;
    const inset=Math.max(10,px('--sl')||10),room=Math.floor((window.innerWidth-(closedTabW||mando.offsetWidth))/2-inset-8);
    root.style.setProperty('--corner-w',Math.max(0,room)+'px');root.style.setProperty('--mt-logo-w',logoW+'px');
    if((room<72)!==body.classList.contains('credits-lifted'))body.classList.toggle('credits-lifted',room<72);
  }
  let closedTabW=0;
  if(credits)new ResizeObserver(placeCredits).observe(credits);
  new ResizeObserver(placeCredits).observe(mando);
  document.addEventListener('load',e=>{if(e.target.closest?.('.maptiler-logo'))placeCredits();},true);
  window.addEventListener('resize',placeCredits);new MutationObserver(placeCredits).observe(body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('deepterra:close-panels',()=>{setScenario(false,false);setSettings(false,false);});
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
    // Límites leídos en cada uso: drone.js puede cambiar data-max según los ajustes.
    const target=$(range.dataset.target),lim=()=>{const min=Number(range.dataset.min),max=Number(range.dataset.max);return {min,max,a:Math.sqrt(min),b:Math.sqrt(max)};};
    const toValue=t=>{const {a,b}=lim();return Math.round(Math.pow(a+t*(b-a),2));},toPos=v=>{const {min,max,a,b}=lim();return Math.round((Math.sqrt(Math.max(min,Math.min(max,v)))-a)/(b-a)*1000);};
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
    if(hidden){if(!$('filterOptions').hidden)setFilter(false);setScenario(false,false);setSettings(false,false);if(!$('droneSettings').hidden)$('droneSettingsClose').click();if(document.activeElement&&document.activeElement!==body)document.activeElement.blur();}
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
  function showTip(){if(tipShown||!bridge.snapshot().ready||matchMedia('(pointer:coarse)').matches||body.classList.contains('tour-open'))return;tipShown=true;try{sessionStorage.setItem('deepterra-drone-tip','1');}catch{}body.classList.add('show-drone-tip');setTimeout(()=>body.classList.remove('show-drone-tip'),6000);}
  window.addEventListener('deepterra:frame',showTip);

  sheets.addEventListener('change',syncScrim);
  sync();
})();
