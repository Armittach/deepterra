import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
try{
 for(const {touch,canvasFallback} of [{touch:false,canvasFallback:false},{touch:true,canvasFallback:false},{touch:true,canvasFallback:true}]){
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1280,height:800},isMobile:touch,hasTouch:touch});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.DRONE_TEST_URL||'http://192.168.1.100:8777');
  await page.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready);
  await page.evaluate(()=>DeepTerraDroneBridge.prepareMap({lat:-29.95,lng:-71.35},14));
  await page.waitForFunction(()=>visibleTiles().some(r=>r.coords.z===14)&&visibleTiles().filter(r=>r.coords.z===14).every(r=>!r.provisional&&!r.loading),null,{timeout:90000});
  if(canvasFallback)await page.evaluate(()=>{gpuRenderer=null;repaint();});
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/**',async route=>{await new Promise(resolve=>setTimeout(resolve,700));try{await route.continue()}catch{}});
  await page.evaluate(()=>{
   state.height=600;state.duration=3600;state.progress=.8;continuePlayback();
   window.navProbe={frames:0,hidden:0,empty:0,provisional:0};
   window.navTimer=setInterval(()=>{const p=window.navProbe,records=visibleTiles();p.frames++;if(Number(getComputedStyle(map.getPane('flood')).opacity)<.99)p.hidden++;if(records.some(r=>r.provisional))p.provisional++;
    if(records.length&&!records.some(r=>{const ctx=r.canvas.getContext('2d');return [32,96,160,224].some(x=>ctx.getImageData(x,128,1,1).data[3]>0)})){const fullEmpty=records.every(r=>{const data=r.canvas.getContext('2d').getImageData(0,0,256,256).data;for(let i=3;i<data.length;i+=4)if(data[i])return false;return true});if(fullEmpty){p.empty++;p.firstEmpty ||= records.map(r=>({coords:r.coords,source:r.dem.sourceZoom,provisional:r.provisional,wet:r.sea.some((v,i)=>v||currentLevel()>r.threshold[i]),min:r.dem.reduce((a,b)=>Math.min(a,b),Infinity)}));}}
   },40);
  });
  for(const zoom of [15,13,14,12,14]){
   await page.evaluate(z=>map.setZoom(z,{animate:true}),zoom);await page.waitForTimeout(450);
   await page.evaluate(()=>map.panBy([85,45],{animate:true,duration:.15}));await page.waitForTimeout(250);
   await page.evaluate(()=>map.panBy([-75,-40],{animate:true,duration:.15}));await page.waitForTimeout(250);
  }
  await page.waitForFunction(()=>visibleTiles().filter(r=>r.coords.z===14).every(r=>!r.provisional&&!r.loading),null,{timeout:90000});
  const result=await page.evaluate(()=>{clearInterval(window.navTimer);pause();return window.navProbe});
  console.log(touch?(canvasFallback?'Touch Canvas':'Touch GPU'):'Desktop GPU',result);
  const snapshot=await page.evaluate(()=>DeepTerraDroneBridge.snapshot());assert.equal(snapshot.height,600);assert.equal(snapshot.duration,3600);assert.ok(snapshot.progress>=.8);
 assert.ok(result.frames>20);assert.ok(result.provisional>0,'Must exercise pending detail loads');assert.equal(result.hidden,0,'Water layer must stay visible throughout navigation');assert.equal(result.empty,0,'Loaded or preview overlays must retain pixels');assert.equal(errors.length,0,errors.join('\n'));
  await context.close();
 }
 console.log('PASS: animated water stays visible during delayed terrain loads, pans and zooms on desktop and touch.');
}finally{await browser.close()}
