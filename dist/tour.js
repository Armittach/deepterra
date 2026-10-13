/* DeepTerra · bienvenida y guía paso a paso. En la primera visita aparece la bienvenida (panel al centro
   con el logo, «Iniciar guía» o «Cerrar»); la guía se puede volver a ver desde Ajustes › «Ver la guía de nuevo». Destaca cada control con un recuadro y un cuadro de texto al lado.
   Cerrar u omitir la guía queda guardado en este navegador (localStorage).
   Extensión opcional: window.DeepTerraExtensions.tourSteps (lista de pasos, o función que la
   devuelve) agrega pasos antes del último. Cada paso: {target: selector o lista de selectores,
   title, text}. Sin target visible, el cuadro aparece al centro. */
(()=>{
  'use strict';
  const STORE='deepterra-guia';
  const $=id=>document.getElementById(id);
  const body=document.body,bridge=window.DeepTerraDroneBridge;
  const narrow=matchMedia('(max-width: 640px)');

  const coreSteps=()=>[
    {target:['#simulationPlayback'],title:'Sube el nivel del mar',text:'Arrastra la barra para elegir cuánto sube el mar, o pulsa reproducir para ver cómo avanza la inundación. ↺ vuelve a 0 m.'},
    {target:['#scenarioToggle'],title:'Elige el escenario',text:'Aquí eliges la subida máxima del mar (hasta la altura del Everest) y cuánto dura la animación. «Aplicar y reproducir» la inicia de inmediato.'},
    {target:['#map'],title:'Toca un punto del mapa',text:'Verás su altura y si queda bajo el agua con el nivel actual. Si está bajo el nivel pero el agua no llega, también te lo dice.',inset:true},
    {target:['#filterToggle'],title:'Capas del mapa',text:'Muestra u oculta el agua, colorea según la profundidad, marca el borde de la zona inundada y cambia el mapa de fondo.'},
    {target:['#transparencyControl','.toolbar .tool-group'],title:'Herramientas del mapa',text:'Acerca o aleja, ve a tu ubicación y cambia la transparencia del agua para ver lo que queda debajo.'},
    {target:['#droneButton'],title:'Míralo en 3D con el dron',text:'Arrastra el dron a cualquier lugar del mapa para volar sobre él. También puedes tocar un punto y elegir «Volar aquí».'},
    {target:['#settingsToggle'],title:'Ajustes y ayuda',text:'Aquí cambias el idioma, ocultas los botones, ves cómo se calcula la simulación y los créditos, y vuelves a ver esta guía.'}
  ];
  /* Guía del dron: según el modo de la pantalla (teclado y mouse, mando del celular en vertical o en horizontal). */
  const mandoMedia=matchMedia('(pointer:coarse), (max-width:640px)');
  const droneMode=()=>body.classList.contains('drone-land')?'land':mandoMedia.matches?'mando':'desk';
  const droneSteps=()=>{
    const mode=droneMode(),end=[
      {target:['#droneSettingsToggle'],title:'Ajustes de vuelo',text:'Cambia la velocidad, elige si el dron sigue el suelo o vuela a una altura fija, y ajusta las capas del agua.'},
      {target:['#droneExit'],title:'Volver al mapa',text:mode==='desk'?'Con este botón o con Esc vuelves al mapa. Puedes volver a ver esta guía desde los ajustes de vuelo.':'Con este botón vuelves al mapa. Puedes volver a ver esta guía desde los ajustes de vuelo.'}];
    if(mode==='desk')return [
      {target:['#droneCanvas'],title:'Mira alrededor',text:'Arrastra la vista con el mouse para mirar hacia cualquier lado.',inset:true},
      {target:['.drone-keys'],title:'Vuela con el teclado',text:'W A S D o las flechas avanzan y giran. Q baja y E sube.'},
      {target:['.drone-telemetry'],title:'Datos de vuelo',text:'Altura sobre el suelo, sobre el agua y sobre el mar, la subida del mar y la velocidad, al instante.'},
      {target:['#simulationPlayback'],title:'La inundación sigue aquí',text:'Reproduce, pausa o arrastra el nivel como en el mapa: el agua sube alrededor del dron. Enter o Espacio reproduce o pausa.'},
      ...end];
    if(mode==='land')return [
      {target:['#droneCanvas'],title:'Vuela y mira tocando',text:'Toca y arrastra en la mitad izquierda para volar, y en la derecha para mirar. Los controles aparecen donde pones el dedo.',inset:true},
      {target:['.drone-elevation'],title:'Subir y bajar',text:'Mantén presionado para subir o bajar el dron.'},
      {target:['#droneMando'],title:'Reproductor',text:'Reproduce la inundación y mira los metros y los datos de vuelo. Desliza la pestaña hacia arriba para elegir la subida y la duración.'},
      ...end];
    return [
      {target:['#droneMoveStick'],title:'Joystick para volar',text:'Muévelo para avanzar, retroceder y girar.'},
      {target:['#droneLookStick'],title:'Joystick para mirar',text:'Muévelo para mirar hacia arriba, abajo y a los lados.'},
      {target:['.drone-elevation'],title:'Subir y bajar',text:'Mantén presionado o desliza para cambiar la altura del dron.'},
      {target:['#droneMandoHandle','#droneMando'],title:'Reproductor y datos',text:'Pulsa ▶ para ver subir el agua. Desliza la rayita hacia arriba para elegir la subida, la duración y ver los datos de vuelo.'},
      ...end];
  };
  const DRONE_STORE='deepterra-guia-dron';
  let set='map';
  function steps(){
    if(set==='drone')return droneSteps();
    const list=coreSteps();
    let extra=window.DeepTerraExtensions?.tourSteps;
    try{if(typeof extra==='function')extra=extra();}catch{extra=null;}
    if(Array.isArray(extra)&&extra.length)list.splice(list.length-1,0,...extra.filter(s=>s&&s.title&&s.text));
    return list;
  }

  let root=null,spot=null,pop=null,current=0,list=[],returnFocus=null;
  const visible=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
  function targetOf(step){for(const sel of [].concat(step.target||[])){const el=document.querySelector(sel);if(visible(el))return el;}return null;}

  function build(){
    root=document.createElement('div');root.className='tour';
    root.innerHTML=`<div class="tour-spot"></div>
<section class="tour-pop panel" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourText">
  <div class="tour-meta"><span class="tour-count" id="tourCount"></span><div class="tour-progress" aria-hidden="true"></div></div>
  <h2 id="tourTitle"></h2>
  <p id="tourText"></p>
  <div class="tour-actions">
    <button type="button" class="tour-skip" data-tour="skip">Omitir guía</button>
    <button type="button" class="btn" data-tour="back">Atrás</button>
    <button type="button" class="btn btn-primary" data-tour="next">Siguiente</button>
  </div>
</section>`;
    spot=root.querySelector('.tour-spot');pop=root.querySelector('.tour-pop');
    root.querySelector('[data-tour=skip]').addEventListener('click',()=>close());
    root.querySelector('[data-tour=back]').addEventListener('click',()=>go(current-1));
    root.querySelector('[data-tour=next]').addEventListener('click',()=>current>=list.length-1?close():go(current+1));
    // El mapa no recibe clics ni rueda mientras la guía está abierta.
    for(const type of ['pointerdown','click','wheel','dblclick','contextmenu'])root.addEventListener(type,e=>e.stopPropagation());
    body.append(root);
  }

  function place(){
    if(!root)return;
    const step=list[current],target=targetOf(step),pad=step.inset?-40:6,vw=innerWidth,vh=innerHeight,m=12;
    let rect=null;
    if(target){const r=target.getBoundingClientRect();
      rect={left:Math.max(4,r.left-pad),top:Math.max(4,r.top-pad),right:Math.min(vw-4,r.right+pad),bottom:Math.min(vh-4,r.bottom+pad)};
      if(step.inset){// Zona central del mapa, sin tapar los paneles (en horizontal, a la izquierda del cuadro).
        rect=vw>vh&&vh<500?{left:vw*.14,top:vh*.24,right:Math.min(vw*.48,vw-pop.offsetWidth-2*m-8),bottom:vh*.62}:{left:vw*.3,top:vh*.32,right:vw*.7,bottom:vh*.58};}
      Object.assign(spot.style,{left:rect.left+'px',top:rect.top+'px',width:(rect.right-rect.left)+'px',height:(rect.bottom-rect.top)+'px'});
      spot.classList.remove('none');
    }else{Object.assign(spot.style,{left:vw/2+'px',top:vh/2+'px',width:'0px',height:'0px'});spot.classList.add('none');}
    pop.style.left=pop.style.top=pop.style.right=pop.style.bottom='';
    const pw=pop.offsetWidth,ph=pop.offsetHeight;
    if(!rect){pop.style.left=Math.max(m,(vw-pw)/2)+'px';pop.style.top=Math.max(m,(vh-ph)/2)+'px';return;}
    if(narrow.matches){// Celular: el cuadro va arriba o abajo, en el lado con más espacio libre.
      const above=rect.top,below=vh-rect.bottom;
      pop.style.left=m+'px';pop.style.top=(below>=ph+2*m||below>=above?Math.min(vh-ph-m,rect.bottom+m):Math.max(m,rect.top-ph-m))+'px';return;}
    // Escritorio: a un lado del control (izquierda, derecha, abajo o arriba), dentro de la pantalla.
    const room={left:rect.left-m,right:vw-rect.right-m,below:vh-rect.bottom-m,above:rect.top-m};
    const clampX=x=>Math.min(vw-pw-m,Math.max(m,x)),clampY=y=>Math.min(vh-ph-m,Math.max(m,y));
    let x,y;
    if(room.below>=ph+m&&rect.bottom-rect.top<vh*.5){x=clampX(rect.right-pw);if(rect.left<vw/2)x=clampX(rect.left);y=rect.bottom+m;}
    else if(room.left>=pw+m){x=rect.left-m-pw;y=clampY((rect.top+rect.bottom)/2-ph/2);}
    else if(room.right>=pw+m){x=rect.right+m;y=clampY((rect.top+rect.bottom)/2-ph/2);}
    else if(room.above>=ph+m){x=clampX((rect.left+rect.right)/2-pw/2);y=rect.top-m-ph;}
    // Pantallas muy bajas: si arriba casi cabe, se pega más al borde (márgenes de 4 px) antes de tapar el control.
    else if(rect.top-8>=ph){x=clampX((rect.left+rect.right)/2-pw/2);y=Math.max(4,rect.top-4-ph);}
    else{x=clampX((vw-pw)/2);y=clampY(rect.bottom+m);}
    pop.style.left=x+'px';pop.style.top=y+'px';
  }

  function go(i){
    current=Math.max(0,Math.min(list.length-1,i));const step=list[current],last=current===list.length-1;
    $('tourCount').textContent='Paso '+(current+1)+' de '+list.length;
    const bar=root.querySelector('.tour-progress');bar.replaceChildren(...list.map((_,j)=>{const s=document.createElement('span');if(j<=current)s.className='on';return s;}));
    $('tourTitle').textContent=step.title;$('tourText').textContent=step.text;
    root.querySelector('[data-tour=back]').hidden=current===0;
    root.querySelector('[data-tour=next]').textContent=last?'Listo':'Siguiente';
    root.querySelector('[data-tour=skip]').hidden=last;
    root.dataset.step=String(current);
    place();
    root.querySelector('[data-tour=next]').focus({preventScroll:true});
  }

  function start(which){
    if(root||welcomeRoot)return;
    set=which==='drone'?'drone':'map';
    if((set==='drone')!==body.classList.contains('drone-active'))return;
    if(body.classList.contains('ui-hidden'))$('showUi').click();
    bridge?.closePanels?.();body.classList.remove('show-drone-tip');
    returnFocus=document.activeElement;list=steps();build();root.dataset.set=set;
    body.classList.add('tour-open');go(0);
  }
  function close(){
    if(!root)return;
    try{localStorage.setItem(set==='drone'?DRONE_STORE:STORE,'vista');if(set==='drone')localStorage.setItem('deepterra-drone-sticks-hint','1');}catch{}
    root.remove();root=spot=pop=null;body.classList.remove('tour-open');
    const back=returnFocus?.isConnected&&returnFocus!==body&&returnFocus.offsetParent?returnFocus:$(set==='drone'?'droneView':'settingsToggle');
    back?.focus({preventScroll:true});
  }

  /* ---------- Bienvenida (primera visita) ---------- */
  let welcomeRoot=null;
  const WAVE='M-26 36'+'q6.43-5 12.85 0t12.85 0'.repeat(1)+' 12.85 0'.repeat(8)+'V70H-26z';
  function welcome(){
    if(welcomeRoot||root)return;
    if(body.classList.contains('drone-active'))return;
    if(body.classList.contains('ui-hidden'))$('showUi').click();
    bridge?.closePanels?.();body.classList.remove('show-drone-tip');
    returnFocus=document.activeElement;
    const major=String(window.DEEPTERRA_VERSION||'2').split('.')[0],version=String(window.DEEPTERRA_VERSION||'');
    welcomeRoot=document.createElement('div');welcomeRoot.className='welcome';
    welcomeRoot.innerHTML=`<section class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle" aria-describedby="welcomeText">
  <svg class="welcome-rings" viewBox="0 0 400 400" aria-hidden="true"><g fill="none" stroke="currentColor"><path d="M200 40c95 0 165 62 165 155 0 100-75 170-170 170C100 365 35 292 35 200 35 105 105 40 200 40z"/><path d="M203 85c70 0 118 46 118 112 0 72-52 124-122 124-68 0-118-52-118-118 0-70 52-118 122-118z"/><path d="M205 130c45 0 75 30 75 70 0 46-33 78-78 78-43 0-75-33-75-75 0-44 33-73 78-73z"/></g></svg>
  <div class="welcome-logo" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><defs><clipPath id="welcomeClip"><circle cx="32" cy="32" r="26"/></clipPath></defs><g clip-path="url(#welcomeClip)"><path class="welcome-wave" d="${WAVE}" fill="#38bdf8"/></g><circle cx="32" cy="32" r="26" stroke="#5eead4" stroke-width="4"/></svg></div>
  <div class="welcome-body">
    <p class="welcome-kicker"><span>Simulador de inundación</span><span class="welcome-version">v${version||major}</span></p>
    <h2 id="welcomeTitle">Bienvenido a DeepTerra</h2>
    <p id="welcomeText" class="welcome-text">Mira qué zonas del mundo quedarían bajo el agua si el nivel del mar subiera, en el mapa o volando con un dron.</p>
    <ul class="welcome-points">
      <li><i data-lucide="waves" aria-hidden="true"></i><span>Sube el mar y mira cómo avanza el agua</span></li>
      <li><i data-lucide="map-pin" aria-hidden="true"></i><span>Toca cualquier punto para ver su altura</span></li>
      <li><i data-lucide="plane" aria-hidden="true"></i><span>Vuela en 3D sobre el relieve</span></li>
    </ul>
    <p class="welcome-note">Es una simulación aproximada, para explorar y aprender.</p>
    <div class="welcome-actions">
      <button type="button" class="btn btn-primary" data-welcome="guide"><i data-lucide="signpost" aria-hidden="true"></i>Iniciar guía</button>
      <button type="button" class="btn" data-welcome="close">Cerrar</button>
    </div>
  </div>
</section>`;
    welcomeRoot.querySelector('[data-welcome=guide]').addEventListener('click',()=>{closeWelcome(false);start('map');});
    welcomeRoot.querySelector('[data-welcome=close]').addEventListener('click',()=>closeWelcome(true));
    welcomeRoot.addEventListener('click',e=>{if(e.target===welcomeRoot)closeWelcome(true);});
    for(const type of ['pointerdown','click','wheel','dblclick','contextmenu'])welcomeRoot.addEventListener(type,e=>e.stopPropagation());
    body.append(welcomeRoot);body.classList.add('tour-open');
    try{lucide.createIcons({icons:lucide.icons,root:welcomeRoot,attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});}catch{}
    welcomeRoot.querySelector('[data-welcome=guide]').focus({preventScroll:true});
  }
  function closeWelcome(restoreFocus){
    if(!welcomeRoot)return;
    try{localStorage.setItem(STORE,'vista');}catch{}
    welcomeRoot.remove();welcomeRoot=null;body.classList.remove('tour-open');
    if(restoreFocus){const back=returnFocus?.isConnected&&returnFocus!==body&&returnFocus.offsetParent?returnFocus:$('settingsToggle');back?.focus({preventScroll:true});}
  }

  // Teclado: se captura en window, antes que los atajos de la app (H, /, Espacio…).
  window.addEventListener('keydown',e=>{
    if(welcomeRoot){
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeWelcome(true);return;}
      if(e.key==='Tab'){const f=[...welcomeRoot.querySelectorAll('button')],i=f.indexOf(document.activeElement);
        if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}else if(i<0){e.preventDefault();f[0].focus();}return;}
      if(e.key!=='Enter'&&e.key!==' ')e.stopPropagation();
      return;
    }
    if(!root)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
    if(e.key==='Tab'){const f=[...pop.querySelectorAll('button')].filter(b=>!b.hidden),i=f.indexOf(document.activeElement);
      if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}else if(i<0){e.preventDefault();f[0].focus();}
      return;}
    if(e.key==='ArrowRight'&&!e.target.closest('input')){e.preventDefault();if(current<list.length-1)go(current+1);}
    else if(e.key==='ArrowLeft'&&!e.target.closest('input')){e.preventDefault();go(current-1);}
    e.stopPropagation();
  },true);
  addEventListener('resize',()=>place());

  // Primera visita: espera a que el mapa esté listo y que no haya otra cosa en pantalla.
  let seen=true;try{seen=localStorage.getItem(STORE)!==null;}catch{}
  if(!seen){
    const timer=setInterval(()=>{
      if(!bridge?.snapshot().ready)return;
      clearInterval(timer);
      setTimeout(()=>{if(body.classList.contains('drone-active'))return;welcome();},700);
    },300);
  }

  // Primera vez en el dron: guía del dron cuando terminó de cargar (no si está abierta otra guía).
  let droneSeen=true;try{droneSeen=localStorage.getItem(DRONE_STORE)!==null;}catch{}
  if(!droneSeen){
    const loading=$('droneLoading');let wait=0;
    new MutationObserver(()=>{
      if(droneSeen||wait)return;
      if(!body.classList.contains('drone-active'))return;
      wait=setInterval(()=>{
        if(!body.classList.contains('drone-active')){clearInterval(wait);wait=0;return;}
        if(loading&&!loading.hidden)return;
        clearInterval(wait);wait=0;
        setTimeout(()=>{if(droneSeen||root||welcomeRoot||!body.classList.contains('drone-active'))return;droneSeen=true;start('drone');},600);
      },300);
    }).observe(body,{attributes:true,attributeFilter:['class']});
  }
  // Al salir del dron con su guía abierta, se cierra.
  new MutationObserver(()=>{if(root&&set==='drone'&&!body.classList.contains('drone-active'))close();}).observe(body,{attributes:true,attributeFilter:['class']});
  addEventListener('deepterra:drone-tour',()=>start('drone'));

  window.DeepTerraTour=Object.freeze({start,close,welcome,closeWelcome:()=>closeWelcome(true),isOpen:()=>Boolean(root||welcomeRoot)});
})();
