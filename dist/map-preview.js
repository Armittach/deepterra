/* Mapa base: Calles o Satélite de MapTiler con maptilerKey (map-config.js, generado en el despliegue).
   El selector solo aparece cuando la clave funciona; si falta o MapTiler no responde, queda
   OpenStreetMap sin selector ni aviso. */
(()=>{
  const config=window.DEEPTERRA_MAP_CONFIG||{};
  const slot=document.getElementById('baseMapSlot')||document.getElementById('filterOptions');
  const credits=document.createElement('div');credits.className='preview-credits';document.body.append(credits);
  function link(href,text){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener';a.textContent=text;return a;}
  function makeGroup(cards){
    const group=document.createElement('section');group.className='panel-section base-map-options';group.setAttribute('aria-label','Mapa base');
    group.innerHTML=`<h3 class="eyebrow">Mapa base</h3>
<div class="base-map-cards" role="group" aria-label="Elegir mapa base">${cards.map(([id,thumb,label],i)=>
  `<button type="button" data-map="${id}" aria-pressed="${i===0}"><span class="base-map-thumb ${thumb}" aria-hidden="true"></span>${label}</button>`).join('')}</div>
<output class="base-map-status" role="status"></output>`;
    slot.append(group);return group;
  }
  maptilerBasemap();

  /* ---------- MapTiler con OpenStreetMap de respaldo ---------- */
  function maptilerBasemap(){
    const key=String(config.maptilerKey||'').trim();
    const group=makeGroup([['streets','streets-thumb','Calles'],['hybrid','satellite-thumb','Satélite']]);group.hidden=true;
    // Plan Free de MapTiler: su logo, enlazado a su web, debe verse mientras se usan sus mapas.
    const logo=document.createElement('a');logo.className='maptiler-logo';logo.href='https://www.maptiler.com';logo.target='_blank';logo.rel='noopener';logo.hidden=true;
    const status=group.querySelector('output'),buttons=[...group.querySelectorAll('[data-map]')];
    const osmLayer=baseMap;let active=baseMap,pending=null,generation=0;
    // MapTiler exige mostrar "© MapTiler © OpenStreetMap contributors" sobre el mapa.
    // El resto de los créditos (elevación, bibliotecas) está en Información › Datos y créditos.
    function mark(style){for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.map===style));}
    function setCredits(withMaptiler){
      credits.replaceChildren(...(withMaptiler?[link('https://www.maptiler.com/copyright/','© MapTiler'),' ']:[]),link('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors'));
      // El logo se agrega solo al usar MapTiler: sin clave no se pide nada a sus servidores.
      if(withMaptiler&&!logo.isConnected){logo.innerHTML='<img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" height="20">';document.body.append(logo);}
      logo.hidden=!withMaptiler;
    }
    setCredits(false);
    function choose(style){
      const version=++generation;if(pending){map.removeLayer(pending);pending=null;}
      const next=L.tileLayer('https://api.maptiler.com/maps/'+(style==='hybrid'?'hybrid-v4':'streets-v4')+'/{z}/{x}/{y}.png?key='+encodeURIComponent(key),{tileSize:512,zoomOffset:-1,minZoom:1,maxNativeZoom:19,maxZoom:19,keepBuffer:2,updateWhenIdle:false});pending=next;
      group.setAttribute('aria-busy','true');mark(style);status.textContent='';
      next.on('load',()=>{if(version!==generation)return;if(pending===next){if(active!==next)map.removeLayer(active);active=next;pending=null;}group.removeAttribute('aria-busy');setCredits(true);group.hidden=false;});
      next.on('tileerror',()=>{if(version!==generation||pending!==next)return;
        // Si MapTiler no responde, se mantiene el mapa anterior (OpenStreetMap la primera vez).
        generation++;map.removeLayer(next);pending=null;group.removeAttribute('aria-busy');
        mark(active===osmLayer?'streets':(active.options.deepterraStyle||'streets'));
        if(style==='hybrid')status.textContent='No se pudo cargar el satélite. Inténtalo de nuevo en un momento.';});
      next.options.deepterraStyle=style;next.addTo(map);
    }
    for(const button of buttons)button.onclick=()=>choose(button.dataset.map);
    if(key)choose('streets');
  }

})();
