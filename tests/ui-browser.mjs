// Interfaz: guía paso a paso, búsqueda compacta, panel de Ajustes, datos bajo el mouse y barra del
// nivel vertical. Sin red externa: PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node tests/ui-browser.mjs
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const PORT=8793,BASE='http://127.0.0.1:'+PORT+'/';
const server=spawn(process.execPath,[fileURLToPath(new URL('../serve.mjs',import.meta.url))],{env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
await new Promise(r=>setTimeout(r,500));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
async function open({viewport={width:1440,height:900},mobile=false,seen=false}={}){
  const context=await browser.newContext({locale:'es-CL',viewport,isMobile:mobile,hasTouch:mobile});
  if(seen)await context.addInitScript(()=>{try{localStorage.setItem('deepterra-guia','vista');localStorage.setItem('deepterra-guia-dron','vista')}catch{}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/map-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.DEEPTERRA_MAP_CONFIG={env:'production'};"}));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(BASE);await page.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready,null,{timeout:20000});
  return {context,page,errors};
}
const box=(page,sel)=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,right:r.right,bottom:r.bottom};});
const inside=(b,vw,vh)=>b.x>=0&&b.y>=0&&b.right<=vw+.5&&b.bottom<=vh+.5;
try{
  // Escritorio, primera visita: aparece la bienvenida (logo, «Iniciar guía» y «Cerrar»); «Iniciar guía» abre la
  // guía, que avanza, retrocede, se cierra con Esc y se recuerda.
  {const {context,page,errors}=await open();
    const wcard=page.locator('.welcome-card');await wcard.waitFor({state:'visible',timeout:5000});
    assert.equal(await wcard.getAttribute('role'),'dialog');assert.equal(await page.locator('.tour-pop').count(),0,'la bienvenida no es parte de la guía');
    assert.equal(await page.locator('.welcome-logo svg').count(),1,'con el logo');
    assert.match(await page.locator('#welcomeTitle').innerText(),/Bienvenido a DeepTerra/);
    assert.ok(inside(await box(page,'.welcome-card'),1440,900),'bienvenida dentro de la pantalla');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.welcome),'guide','el foco va a «Iniciar guía»');
    await page.keyboard.press('h');assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-hidden')),false,'H no actúa con la bienvenida abierta');
    await page.locator('[data-welcome=guide]').click();assert.equal(await page.locator('.welcome').count(),0);
    const pop=page.locator('.tour-pop');await pop.waitFor({state:'visible',timeout:5000});
    assert.equal(await pop.getAttribute('role'),'dialog');assert.equal(await pop.getAttribute('aria-modal'),'true');
    assert.match(await page.locator('#tourCount').innerText(),/Paso 1 de 7/);
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.tour),'next','el foco va al botón principal');
    assert.equal(await page.locator('[data-tour=skip]').isVisible(),true,'«Omitir guía» siempre a mano');
    // El recuadro destaca la barra del nivel y el cuadro de texto no la tapa.
    // El recuadro llega con una transición de 0,3 s (con WebGL por software los cuadros van lentos).
    await page.waitForFunction(()=>{const a=document.querySelector('.tour-spot').getBoundingClientRect(),b=document.getElementById('simulationPlayback').getBoundingClientRect();return a.left<=b.left&&a.right>=b.right&&a.top<=b.top;},null,{timeout:5000}).catch(()=>{});
    const spot=await box(page,'.tour-spot'),bar=await box(page,'#simulationPlayback'),card=await box(page,'.tour-pop');
    assert.ok(spot.x<=bar.x&&spot.right>=bar.right&&spot.y<=bar.y,'recuadro sobre la barra'+JSON.stringify({spot,bar}));
    assert.ok(card.right<=bar.x||card.x>=bar.right||card.bottom<=bar.y||card.y>=bar.bottom,'el cuadro no tapa la barra');
    assert.equal(await page.locator('[data-tour=back]').isVisible(),false,'sin «Atrás» en el primer paso');
    await page.locator('[data-tour=next]').click();assert.match(await page.locator('#tourCount').innerText(),/Paso 2 de 7/);
    await page.keyboard.press('ArrowRight');assert.match(await page.locator('#tourCount').innerText(),/Paso 3 de 7/);
    await page.locator('[data-tour=back]').click();assert.match(await page.locator('#tourCount').innerText(),/Paso 2 de 7/);
    // Mientras está abierta, las teclas de la app no actúan (H no oculta la interfaz).
    await page.keyboard.press('h');assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-hidden')),false);
    for(let i=0;i<9;i++){assert.ok(inside(await box(page,'.tour-pop'),1440,900),'cuadro dentro de la pantalla');if(await page.locator('#tourCount').innerText()==='Paso 7 de 7')break;await page.locator('[data-tour=next]').click();}
    assert.equal(await page.locator('[data-tour=next]').innerText(),'Listo');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.tour').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('deepterra-guia')),'vista');
    await page.reload();await page.waitForFunction(()=>DeepTerraDroneBridge.snapshot().ready);await page.waitForTimeout(1500);
    assert.equal(await page.locator('.tour').count(),0,'no vuelve a salir sola');
    // Se vuelve a ver desde Ajustes; «Omitir guía» la cierra.
    await page.locator('#settingsToggle').click();await page.locator('#tourRestart').click();
    await page.locator('.tour-pop').waitFor();assert.match(await page.locator('#tourCount').innerText(),/Paso 1 de 7/);
    assert.equal(await page.locator('#settingsPanel').isHidden(),true);
    await page.locator('[data-tour=skip]').click();assert.equal(await page.locator('.tour').count(),0);
    // «Cerrar» en la bienvenida la cierra sin abrir la guía.
    await page.evaluate(()=>DeepTerraTour.welcome());await page.locator('[data-welcome=close]').click();
    assert.equal(await page.locator('.welcome, .tour').count(),0);
    assert.deepEqual(errors,[]);await context.close();console.log('bienvenida y guía: primera visita, pasos, Esc, recuerdo y volver a verla');}

  // Escritorio (diseño A): barra del nivel abajo al centro, escenario con clic, búsqueda compacta y Ajustes.
  {const {context,page,errors}=await open({seen:true});
    assert.equal(await page.evaluate(()=>document.body.classList.contains('level-vertical')),false,'sin regla vertical');
    assert.equal(await page.locator('#time').getAttribute('aria-orientation'),'horizontal');
    const bar=await box(page,'#simulationPlayback'),tools=await box(page,'.toolbar');
    assert.ok(Math.abs(bar.x+bar.w/2-720)<4&&bar.bottom>=900-40&&bar.w<=770&&bar.h<120,'barra baja abajo al centro: '+JSON.stringify(bar));
    assert.ok(tools.right>=1440-30,'herramientas al borde derecho');
    const t=await box(page,'#time');assert.ok(t.w>t.h*3,'deslizador horizontal');
    await page.locator('#time').focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');
    assert.ok(Number(await page.locator('#time').inputValue())>0,'ArrowUp sube el nivel');
    assert.match(await page.locator('#time').getAttribute('aria-valuetext'),/^\+[\d,.]+ m de 10 m$/);
    // «Volver a 0 m» visible con el panel cerrado, y funciona.
    assert.equal(await page.locator('#restart').isVisible(),true);
    await page.locator('#restart').click();assert.equal(Number(await page.locator('#time').inputValue()),0,'↺ vuelve a 0 m');
    // Tierra cubierta siempre visible; el escenario no se abre al pasar el mouse, sí con clic, y su botón no se mueve.
    assert.equal(await page.locator('.playback .stat').isVisible(),true,'tierra cubierta visible');
    const toggle=await box(page,'#scenarioToggle');await page.mouse.move(toggle.x+toggle.w/2,toggle.y+toggle.h/2);await page.waitForTimeout(500);
    assert.equal(await page.locator('#scenarioPanel').isHidden(),true,'pasar el mouse no lo abre');
    assert.match(await page.locator('#scenarioToggle').innerText(),/Escenario/i);
    await page.locator('#scenarioToggle').click();await page.locator('#scenarioPanel').waitFor();
    const after=await box(page,'#scenarioToggle');assert.ok(Math.abs(after.x-toggle.x)<1,'el botón no se corre al abrir: '+toggle.x+' → '+after.x);
    const panel=await box(page,'#scenarioPanel');assert.ok(Math.abs(panel.bottom-bar.y)<3&&Math.abs(panel.w-bar.w)<4,'el escenario crece desde la barra: '+JSON.stringify(panel));
    assert.equal(await page.locator('#scenarioApplyOnly').isVisible(),true);assert.equal(await page.locator('#scenarioApply').isVisible(),true);
    // Con el escenario abierto, un clic en el mapa solo lo cierra (no abre el punto).
    await page.mouse.click(400,300);assert.equal(await page.locator('#scenarioPanel').isHidden(),true);
    assert.equal(await page.locator('.inspection-popup').count(),0,'no se abre el punto');
    await page.mouse.click(400,300);await page.locator('.inspection-popup').waitFor();
    await page.mouse.click(1000,560);await page.waitForTimeout(300);assert.equal(await page.locator('.inspection-popup').count(),0,'el segundo clic cierra el punto: '+JSON.stringify(await page.evaluate(()=>({sel:!!selected,open:panelOpenAtPress,ids:['scenarioPanel','settingsPanel','filterOptions','searchResults'].filter(id=>!document.getElementById(id).hidden)}))));
    // Profundidad del agua: dentro de la barra, arriba.
    await page.evaluate(()=>{depthColors.click();});await page.locator('#depthLegend').waitFor();
    const legend=await box(page,'#depthLegend'),bar2=await box(page,'#simulationPlayback');
    assert.ok(legend.y>=bar2.y-1&&legend.bottom<=bar2.bottom&&legend.y<bar2.y+30,'leyenda dentro de la barra, arriba: '+JSON.stringify({legend,bar2}));
    await page.evaluate(()=>{depthColors.click();});
    await page.keyboard.press('Home');await page.evaluate(()=>document.activeElement.blur());

    // Búsqueda: solo la lupa; se abre al pasar el mouse (también por el margen) y se cierra con pausa.
    const form=await box(page,'#searchForm');assert.ok(form.w<=50,'plegada: '+form.w);
    await page.mouse.move(form.right+10,form.y+form.h/2);await page.waitForTimeout(350);
    assert.ok((await box(page,'#searchForm')).w>300,'se despliega con el mouse cerca');
    await page.mouse.move(700,600);await page.waitForTimeout(150);
    assert.ok((await box(page,'#searchForm')).w>300,'no se cierra al instante');
    await page.waitForTimeout(600);assert.ok((await box(page,'#searchForm')).w<=50,'se pliega al salir');
    await page.keyboard.press('/');await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'searchInput');assert.ok((await box(page,'#searchForm')).w>300,'con el teclado');
    await page.keyboard.type('Valpo');await page.mouse.click(700,600);await page.waitForTimeout(700);
    assert.ok((await box(page,'#searchForm')).w>300,'con texto sigue abierta');
    await page.locator('#searchInput').fill('');await page.locator('#searchInput').focus();await page.mouse.click(700,600);await page.waitForTimeout(700);
    assert.ok((await box(page,'#searchForm')).w<=50,'vacía y sin foco se pliega');

    // Ajustes: engranaje a la derecha de Capas; Capas solo tiene capas del mapa.
    const layersBtn=await box(page,'#filterToggle'),gear=await box(page,'#settingsToggle');
    assert.ok(gear.x>=layersBtn.right&&Math.abs(gear.y-layersBtn.y)<2,'engranaje a la derecha de Capas');
    assert.equal(await page.locator('#filterOptions #hideUi').count(),0);
    assert.equal(await page.locator('#settingsPanel #hideUi').count(),1);
    await page.locator('#settingsToggle').click();
    assert.equal(await page.locator('#settingsPanel').isVisible(),true);assert.equal(await page.locator('#settingsToggle').getAttribute('aria-expanded'),'true');
    await page.locator('#filterToggle').click();
    assert.equal(await page.locator('#settingsPanel').isHidden(),true,'abrir Capas cierra Ajustes');
    await page.locator('#settingsToggle').click();assert.equal(await page.locator('#filterOptions').isHidden(),true,'abrir Ajustes cierra Capas');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#settingsPanel').isHidden(),true);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsToggle','el foco vuelve al engranaje');
    // «Ocultar botones y paneles» desde Ajustes, y H sigue funcionando.
    await page.locator('#settingsToggle').click();await page.locator('label[for=hideUi]').click();
    assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-hidden')),true);
    assert.equal(await page.locator('.map-actions').isVisible(),false);
    await page.keyboard.press('h');assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-hidden')),false);
    await page.keyboard.press('h');assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-hidden')),true);
    await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.body.classList.contains('ui-hidden')),false);
    // «Cómo se calcula» abre la información en esa pestaña; la guía antigua ya no existe.
    await page.locator('#settingsToggle').click();await page.locator('[data-info-tab=tabData]').click();
    await page.locator('#parameters.open').waitFor();assert.equal(await page.locator('#panelData').isVisible(),true);
    assert.equal(await page.locator('#panelGuide').count(),0);
    await page.keyboard.press('Escape');

    // Telemetría del cursor desactivada: no se ve ni aparece su interruptor en Ajustes.
    await page.mouse.move(700,450);await page.mouse.move(705,455);
    assert.equal(await page.locator('.cursor-info').isVisible(),false);
    assert.equal(await page.locator('label[for=showCursorInfo]').isVisible(),false);

    // Icono del dron propio (cuadricóptero) en el botón y en «Volar aquí».
    const droneIcon=sel=>page.locator(sel).evaluate(svg=>[...svg.children].map(n=>n.getAttribute('d')||n.tagName).join('|'));
    assert.match(await droneIcon('#droneButton svg'),/^M2 6\.5h7M15 6\.5h7\|/);
    await page.mouse.click(600,450);await page.locator('.inspect-fly').waitFor();
    assert.equal(await droneIcon('.inspect-fly svg'),await droneIcon('#droneButton svg'));
    assert.deepEqual(errors,[]);await context.close();console.log('escritorio: barra abajo, escenario con clic, ↺, leyenda en la barra, búsqueda, Ajustes e icono del dron');}

  // Pantalla baja (1280×480): el nivel sigue horizontal abajo.
  {const {context,page,errors}=await open({viewport:{width:1280,height:480},seen:true});
    assert.equal(await page.evaluate(()=>document.body.classList.contains('level-vertical')),false);
    assert.equal(await page.locator('#time').getAttribute('aria-orientation'),'horizontal');
    assert.deepEqual(errors,[]);await context.close();console.log('pantalla baja: nivel horizontal');}

  // Teléfono (390×844): guía dentro de la pantalla, nivel horizontal abajo y Ajustes como hoja inferior.
  {const {context,page,errors}=await open({viewport:{width:390,height:844},mobile:true});
    await page.locator('.welcome-card').waitFor({state:'visible',timeout:5000});
    {const w=await box(page,'.welcome-card');assert.ok(inside(w,390,844),'bienvenida dentro: '+JSON.stringify(w));}
    await page.locator('[data-welcome=guide]').tap();
    await page.locator('.tour-pop').waitFor({state:'visible',timeout:5000});
    for(let i=0;i<9;i++){const b=await box(page,'.tour-pop');assert.ok(inside(b,390,844),'paso '+(i+1)+' dentro: '+JSON.stringify(b));
      const label=await page.locator('#tourCount').innerText();if(label==='Paso 7 de 7')break;await page.locator('[data-tour=next]').tap();}
    await page.locator('[data-tour=next]').tap();assert.equal(await page.locator('.tour').count(),0);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('level-vertical')),false);
    const bar=await box(page,'#simulationPlayback');assert.ok(bar.bottom>800&&bar.w>350,'barra abajo');
    await page.locator('#settingsToggle').tap();const sheet=await box(page,'#settingsPanel');
    assert.ok(Math.round(sheet.bottom)===844&&sheet.w===390,'hoja inferior: '+JSON.stringify(sheet));
    assert.equal(await page.locator('label[for=showCursorInfo]').isVisible(),false,'sin mouse no se ofrece');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(errors,[]);await context.close();console.log('teléfono: guía, nivel horizontal y Ajustes');}
}finally{await browser.close();server.kill();}
