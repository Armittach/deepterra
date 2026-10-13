// Guía del dron (tour.js, sin red, relieve simulado), en escritorio, teléfono vertical (mando) y horizontal:
// - La primera vez que se entra al dron aparece sola cuando termina de cargar, y se recuerda.
// - Cada paso queda dentro de la pantalla, destaca un control visible y su cuadro no lo tapa.
// - Esc la cierra sin salir del dron; «Ver la guía del dron» en los ajustes de vuelo la abre de nuevo.
// PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node tests/drone-tour-browser.mjs   (SHOTS=carpeta para capturas)
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {terrariumTile} from './fake-terrain.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const PORT=8806,BASE='http://127.0.0.1:'+PORT+'/',SHOTS=process.env.SHOTS||'';
const server=spawn(process.execPath,[fileURLToPath(new URL('../serve.mjs',import.meta.url))],{env:{...process.env,PORT:String(PORT)},stdio:'ignore'});
await new Promise(r=>setTimeout(r,500));
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const cors={'Access-Control-Allow-Origin':'*'};
const box=(page,sel)=>page.locator(sel).first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom};});
const overlap=(a,b)=>a.x<b.right-1&&b.x<a.right-1&&a.y<b.bottom-1&&b.y<a.bottom-1;
const cases=[['escritorio',{width:1280,height:800},false,6],['vertical',{width:412,height:760},true,6],['horizontal',{width:852,height:320},true,5]];
try{
  for(const [name,viewport,mobile,count] of cases){
    const context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile,locale:'es-CL'});
    await context.addInitScript(()=>{try{localStorage.setItem('deepterra-guia','vista');localStorage.setItem('deepterra-drone-sticks-hint','1');}catch{}});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/map-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"window.DEEPTERRA_MAP_CONFIG={env:'production'};"}));
    await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**',r=>{const [z,x,y]=new URL(r.request().url()).pathname.split('/').slice(-3).map(s=>parseInt(s));r.fulfill({contentType:'image/png',headers:cors,body:terrariumTile(z,x,y)}).catch(()=>{});});
    await page.route(/mapterhorn|openstreetmap|maptiler|nominatim|^https:\/\/fonts\./,r=>r.abort());
    await page.goto(BASE);await page.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready,null,{timeout:60000});
    await page.addStyleTag({content:'.tour-spot{transition:none!important}'});
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('deepterra:fly-to',{detail:{lat:52.1,lng:4.7}})));
    await page.locator('.tour-pop').waitFor({state:'visible',timeout:60000});
    assert.equal(await page.evaluate(()=>document.body.classList.contains('drone-active')),true);
    assert.equal(await page.locator('#tourCount').innerText(),'Paso 1 de '+count,name+': cantidad de pasos');
    for(let i=0;i<count;i++){
      const pop=await box(page,'.tour-pop'),spot=await page.locator('.tour-spot').evaluate(el=>el.classList.contains('none')?null:(r=>({x:r.left,y:r.top,right:r.right,bottom:r.bottom}))(el.getBoundingClientRect()));
      assert.ok(pop.x>=0&&pop.y>=0&&pop.right<=viewport.width+.5&&pop.bottom<=viewport.height+.5,name+' paso '+(i+1)+' dentro: '+JSON.stringify(pop));
      const title=await page.locator('#tourTitle').innerText();
      // El teclado (WASD) solo se ve en pantallas anchas; si no, el cuadro va al centro.
      if(title!=='Vuela con el teclado')assert.ok(spot,name+' paso '+(i+1)+': destaca un control visible');
      if(spot)assert.ok(!overlap(pop,spot),name+' paso '+(i+1)+': el cuadro no tapa lo destacado '+JSON.stringify({pop,spot}));
      if(SHOTS)await page.screenshot({path:`${SHOTS}/dron-${name}-${i+1}.png`});
      if(i<count-1)await page.locator('[data-tour=next]').click();
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.tour').count(),0);
    assert.equal(await page.evaluate(()=>document.body.classList.contains('drone-active')),true,name+': Esc cierra la guía, no el dron');
    assert.equal(await page.evaluate(()=>localStorage.getItem('deepterra-guia-dron')),'vista');
    await page.locator('#droneSettingsToggle').click();await page.locator('#droneTourStart').scrollIntoViewIfNeeded();await page.locator('#droneTourStart').click();
    await page.locator('.tour-pop').waitFor({state:'visible'});assert.equal(await page.locator('#tourCount').innerText(),'Paso 1 de '+count);
    await page.locator('[data-tour=skip]').click();assert.equal(await page.locator('.tour').count(),0);
    assert.deepEqual(errors,[]);await context.close();console.log(name+': guía del dron ok');
  }
}finally{await browser.close();server.kill();}
console.log('PASS: guía del dron.');
