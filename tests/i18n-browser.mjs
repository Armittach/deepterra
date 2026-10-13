// Idiomas (español / inglés), sin red:
// - Sin elección guardada, el idioma sale del país aproximado (/api/geo): Chile → español, EE. UU. → inglés,
//   aunque el navegador diga otra cosa (y sin geo, el idioma del navegador).
// - Elegir en Ajustes cambia todo al instante, se guarda y gana sobre el país al recargar.
// - En inglés no queda texto en español a la vista (ni en atributos de accesibilidad), incluido lo que la app
//   escribe después (punto seleccionado, guía, dron); los números usan el formato inglés (1,000.5).
// - Volver a español restaura los textos originales. El dron (mando del teléfono) también queda en inglés.
// PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node tests/i18n-browser.mjs
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {terrariumTile} from './fake-terrain.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const PORT=8799,BASE='http://127.0.0.1:'+PORT+'/';
const server=spawn(process.execPath,[fileURLToPath(new URL('../serve.mjs',import.meta.url))],{env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
await new Promise(r=>setTimeout(r,500));
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const cors={'Access-Control-Allow-Origin':'*'};
let failures=0;const check=(name,fn)=>{try{fn();console.log('ok  ',name);}catch(e){failures++;console.log('FAIL',name,'\n     ',e.message.split('\n').slice(0,200).join('\n      '));}};

async function open({locale='es-CL',country='CL',env='production',query='',guide=false,store=null,viewport={width:1280,height:800}}={}){
  const context=await browser.newContext({viewport,locale});
  await context.addInitScript(([guide,store])=>{try{if(!guide)localStorage.setItem('deepterra-guia','vista');localStorage.setItem('deepterra-guia-dron','vista');if(store)localStorage.setItem('deepterra-idioma',store);}catch{}},[guide,store]);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/map-config.js*',r=>r.fulfill({contentType:'text/javascript',body:`window.DEEPTERRA_MAP_CONFIG={env:'${env}'};`}));
  await page.route('**/api/geo',r=>country===null?r.abort():r.fulfill({contentType:'application/json',body:JSON.stringify({country})}));
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**',r=>{const [z,x,y]=new URL(r.request().url()).pathname.split('/').slice(-3).map(s=>parseInt(s));r.fulfill({contentType:'image/png',headers:cors,body:terrariumTile(z,x,y)}).catch(()=>{});});
  await page.route(/mapterhorn|openstreetmap|maptiler|nominatim|^https:\/\/fonts\./,r=>r.abort());
  await page.goto(BASE+query);
  await page.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready,null,{timeout:60000});
  await page.waitForTimeout(400);
  return {context,page,errors};
}
const lang=page=>page.evaluate(()=>({lang:DeepTerraI18n.lang,html:document.documentElement.lang,title:document.title}));
// Textos (visibles u ocultos) y atributos que aún parecen español.
const leftovers=page=>page.evaluate(()=>{
  const es=/[áéíóúñ¿¡]|\b(de|del|el|la|los|las|para|con|una?|que|se|sin|al|por|tu|mapa|agua|nivel|cerrar|abrir|mostrar|subida|altura|terreno|suelo|velocidad|volar|bajar|subir|ayuda|ajustes|guía)\b/i;
  const skip=el=>!el||el.closest('script,style,svg,[data-no-i18n]');
  const out=new Set(),w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  for(let n=w.nextNode();n;n=w.nextNode()){const s=n.data.trim();if(s&&es.test(s)&&!skip(n.parentElement))out.add(s.slice(0,90));}
  for(const el of document.body.querySelectorAll('[aria-label],[title],[placeholder],[alt],[aria-valuetext]'))for(const a of ['aria-label','title','placeholder','alt','aria-valuetext']){const v=el.getAttribute(a);if(v&&es.test(v)&&!skip(el))out.add('@'+a+': '+v.slice(0,90));}
  return [...out];
});
// Términos propios, nombres y créditos en otro idioma que no se traducen.
const allowed=/^(DeepTerra|Copernicus|Produced using|© |Mapzen|Mapterhorn|Nominatim|Leaflet|Lucide|Three\.js|Geist|WASD|Esc|H|km²)/;

try{
  {const {context,page}=await open({locale:'es-CL',country:'US'});const l=await lang(page);
   check('país EE. UU. con navegador en español → inglés',()=>{assert.equal(l.lang,'en');assert.equal(l.html,'en');assert.equal(l.title,'DeepTerra · Flood simulator');});await context.close();}
  {const {context,page}=await open({locale:'en-US',country:'CL'});const l=await lang(page);
   check('país Chile con navegador en inglés → español',()=>{assert.equal(l.lang,'es');assert.match(l.title,/Simulador de inundación/);});await context.close();}
  {const {context,page}=await open({locale:'en-GB',country:null});const l=await lang(page);
   check('sin país (geo falla): idioma del navegador',()=>assert.equal(l.lang,'en'));await context.close();}
  {const {context,page}=await open({locale:'en-US',country:'US',store:'es'});const l=await lang(page);
   check('elección guardada gana sobre el país',()=>assert.equal(l.lang,'es'));await context.close();}

  // Inglés completo y guía abierta.
  {const {context,page,errors}=await open({locale:'en-US',country:'US',guide:true});
   await page.waitForTimeout(800);
   let left=(await leftovers(page)).filter(s=>!allowed.test(s));
   const welcomeTitle=await page.locator('#welcomeTitle').textContent().catch(()=>null);
   check('bienvenida en inglés',()=>assert.equal(welcomeTitle,'Welcome to DeepTerra'));
   await page.locator('[data-welcome=guide]').click();await page.waitForTimeout(300);
   left=left.concat((await leftovers(page)).filter(s=>!allowed.test(s)));
   const tourCount=await page.locator('#tourCount').textContent().catch(()=>null);
   check('guía en inglés',()=>assert.equal(tourCount,'Step 1 of 7'));
   await page.keyboard.press('Escape');await page.waitForTimeout(200);
   // Punto seleccionado: textos que escribe la app.
   const box=await page.locator('#map').boundingBox();await page.mouse.click(box.x+box.width*.6,box.y+box.height*.5);await page.waitForTimeout(500);
   left=left.concat((await leftovers(page)).filter(s=>!allowed.test(s)));
   const area=await page.evaluate(()=>document.getElementById('areaFull')?.textContent||'');
   check('sin textos en español a la vista (inglés)',()=>assert.deepEqual([...new Set(left)],[],JSON.stringify([...new Set(left)],null,1)));
   check('números en formato inglés',()=>assert.doesNotMatch(area,/\d\.\d{3}(?!\d)/,area));
   check('sin errores de página',()=>assert.deepEqual(errors,[]));
   // Cambiar a español desde Ajustes y volver.
   await page.keyboard.press('Escape');
   await page.evaluate(()=>document.getElementById('settingsPanel').hidden=false);
   await page.click('[data-lang-choice=es]');await page.waitForTimeout(300);
   const es=await page.evaluate(()=>({lang:DeepTerraI18n.lang,saved:localStorage.getItem('deepterra-idioma'),settings:document.getElementById('settingsTitle').textContent,play:document.getElementById('play').getAttribute('aria-label'),pressed:document.querySelector('[data-lang-choice=es]').getAttribute('aria-pressed')}));
   check('Ajustes → Español: cambia, se guarda y restaura',()=>{assert.equal(es.lang,'es');assert.equal(es.saved,'es');assert.equal(es.settings,'Ajustes');assert.match(es.play,/simulación/);assert.equal(es.pressed,'true');});
   await page.click('[data-lang-choice=en]');await page.waitForTimeout(300);
   const en=await page.evaluate(()=>({settings:document.getElementById('settingsTitle').textContent,saved:localStorage.getItem('deepterra-idioma')}));
   check('Ajustes → English',()=>{assert.equal(en.settings,'Settings');assert.equal(en.saved,'en');});
   await page.reload();await page.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready,null,{timeout:60000});
   const after=await lang(page);check('recarga: inglés guardado',()=>assert.equal(after.lang,'en'));
   await context.close();}
  // Dron en inglés (teléfono en vertical, mando).
  {const {context,page,errors}=await open({locale:'en-US',country:'US',viewport:{width:412,height:760}});
   await page.evaluate(()=>window.dispatchEvent(new CustomEvent('deepterra:fly-to',{detail:{lat:52.1,lng:4.7}})));
   await page.waitForFunction(()=>document.body.classList.contains('drone-active'),null,{timeout:20000});await page.waitForTimeout(2500);
   await page.evaluate(()=>DeepTerraTour.start('drone'));await page.waitForTimeout(300);
   const droneTour=await page.locator('#tourTitle').textContent().catch(()=>'');
   check('guía del dron en inglés (mando)',()=>assert.equal(droneTour,'Flying joystick'));
   const left=(await leftovers(page)).filter(s=>!allowed.test(s));
   const heading=await page.locator('#droneHeading').textContent().catch(()=>'');
   check('dron sin textos en español (inglés)',()=>assert.deepEqual(left,[],JSON.stringify(left,null,1)));
   check('rumbo con letras inglesas',()=>assert.doesNotMatch(heading,/\b(SO|O|NO)\b/,heading));
   check('dron sin errores',()=>assert.deepEqual(errors,[]));
   await context.close();}
}finally{await browser.close();server.kill();}
if(failures){console.log(failures+' fallas');process.exit(1);}
console.log('Todo bien');
