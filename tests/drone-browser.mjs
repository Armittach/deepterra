// Local regression tests run in a separate, disposable browser profile.
// Start the local server first: npm run dev. Then: npm run test:browser.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output=process.env.DRONE_TEST_OUTPUT || path.resolve('test-results');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launchPersistentContext(path.join(output,'browser-profile'),{channel:process.env.DRONE_TEST_CHANNEL || 'chrome',headless:true,
  viewport:{width:1280,height:800},args:['--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage();
page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&/Shader Error|Drone scene|THREE.WebGLProgram/.test(message.text()))errors.push(message.text());});
const url=process.env.DRONE_TEST_URL || 'http://localhost:8766';
try{
  await page.goto(url);await page.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready);
  assert.deepEqual(await page.evaluate(()=>{const renderer=new DeepTerraFloodRenderer(),canvas=document.createElement('canvas');canvas.width=canvas.height=256;const record={live:true,coords:{z:14,x:4944,y:9618},canvas,dem:new Float32Array(65536).fill(10),threshold:new Float32Array(65536).fill(15),sea:new Uint8Array(65536)},state={height:20,progress:.5,showWater:true,showRelief:false,showContour:false,depthColors:false,waterOpacity:1};const ok=renderer.render([record],state),dry=canvas.getContext('2d').getImageData(128,128,1,1).data[3];state.progress=1;const wetOk=renderer.render([record],state),wet=canvas.getContext('2d').getImageData(128,128,1,1).data[3];return [ok,dry,wetOk,wet>0]}),[true,0,true,true]);
  await page.evaluate(()=>window.DeepTerraDroneBridge.prepareMap({lat:-29.95,lng:-71.35},14));
  // Cancel outstanding detail downloads with rapid zooms, then return to the same tiles.
  await page.waitForTimeout(120);
  await page.evaluate(()=>window.DeepTerraDroneBridge.prepareMap({lat:-29.95,lng:-71.35},13));
  await page.waitForTimeout(120);
  await page.evaluate(()=>window.DeepTerraDroneBridge.prepareMap({lat:-29.95,lng:-71.35},14));
  await page.waitForFunction(()=>{const records=visibleTiles().filter(r=>r.coords.z===14);return records.length>0&&records.every(r=>!r.provisional&&!r.loading);},null,{timeout:90000});
  assert.equal(await page.evaluate(()=>getComputedStyle(map.getPane('flood')).opacity),'1');
  console.log('Rapid zoom cancellation recovered all visible map blocks.');
  const button=page.getByRole('button',{name:'Explorar con dron:',exact:false});
  await button.waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('droneButton').disabled);
  const dockBefore=await button.boundingBox();
  await page.locator('#transparencyControl').evaluate(control=>control.style.setProperty('--water-value','100%'));
  await page.evaluate(()=>window.dispatchEvent(new Event('deepterra:frame')));
  assert.equal((await button.boundingBox()).y,dockBefore.y);
  await page.locator('#transparencyControl').evaluate(control=>control.style.setProperty('--water-value','0%'));
  const home=await button.boundingBox(),homeX=home.x+22,homeY=home.y+22;
  // Return into the forgiving dock radius: snap back, no 3D scene.
  await page.mouse.move(homeX,homeY);await page.mouse.down();await page.mouse.move(homeX-200,homeY-50,{steps:12});
  await page.mouse.move(homeX-60,homeY,{steps:12});await page.mouse.up();
  assert.equal(await page.locator('#droneView').isVisible(),false);
  assert.equal(await page.locator('#dronePlaceholder').isVisible(),false);
  // Actual drag-and-drop from the dock onto a coastal map position.
  await page.mouse.move(homeX,homeY);await page.mouse.down();await page.mouse.move(640,400,{steps:16});await page.mouse.up();
  await page.locator('#droneView').waitFor({state:'visible'});
  assert.equal(await page.locator('#droneLoading').isVisible(),true);
  assert.equal(await page.locator('#droneLoading').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(7, 25, 33)');
  await page.locator('#droneLoading').waitFor({state:'hidden',timeout:90000});
  await page.waitForFunction(()=>document.getElementById('droneCoords').textContent.includes('°'));
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:path.join(output,'drone-desktop.png')});
  console.log('Loaded coastal scene and saved desktop screenshot.');
  // Shared water controls: updating the level and progress must update the drone.
  // Height and duration live in the Escenario panel of the simulation dock.
  await page.locator('#scenarioToggle').click();
  await page.getByRole('spinbutton',{name:'Altura máxima en metros'}).fill('120');
  await page.getByRole('spinbutton',{name:'Altura máxima en metros'}).press('Tab');
  await page.locator('#scenarioClose').click();
  await page.locator('#time').evaluate(input=>{input.value='50';input.dispatchEvent(new Event('input',{bubbles:true}));});
  console.log('Water controls applied:',await page.evaluate(()=>window.DeepTerraDroneBridge.snapshot()));
  await page.waitForFunction(()=>document.getElementById('droneWaterValue').textContent.includes('+60 m'));
  assert.equal(await page.evaluate(()=>window.DeepTerraDroneBridge.snapshot().level),60);
  console.log('Shared water state verified.');
  // Editable speed and height, and controlled flight.
  assert.equal(await page.locator('.cursor-info').isVisible(),false);
  assert.equal(await page.locator('#droneSettings').isVisible(),false);
  await page.locator('#droneSettingsToggle').click();
  assert.equal(await page.locator('.drone-joystick-option').isVisible(),false);
  console.log('Setting drone speed.');
  await page.getByLabel('Velocidad · m/s',{exact:true}).fill('40');
  console.log('Setting drone altitude.');
  await page.getByLabel('Altura sobre terreno · m',{exact:true}).fill('100');
  await page.locator('#droneSettingsClose').click();
  console.log('Focusing drone viewport.');
  await page.locator('#droneView').focus();
  const before=await page.locator('#droneCoords').textContent();
  console.log('Drone options applied; starting flight check.');
  await page.keyboard.down('w');await page.waitForFunction(text=>document.getElementById('droneCoords').textContent!==text,before,{timeout:8000});await page.keyboard.up('w');
  console.log('Flight movement verified.');
  await page.locator('#droneSettingsToggle').click();
  await page.getByLabel('Velocidad · m/s',{exact:true}).fill('500');
  assert.equal(await page.getByLabel('Velocidad · m/s',{exact:true}).inputValue(),'500');
  await page.locator('#droneSettingsClose').click();
  await page.locator('#droneView').focus();
  await page.keyboard.down('w');
  try {await page.waitForFunction(()=>Number(document.getElementById('droneView').dataset.terrainWindows)>=2,null,{timeout:45000});}
  finally {await page.keyboard.up('w');}
  assert.ok(await page.locator('#droneView').evaluate(view=>Number(view.dataset.terrainBlocks)<=49));
  assert.equal(await page.evaluate(()=>window.DeepTerraDroneBridge.snapshot().level),60);
  console.log('Continuous terrain window and shared water verified.');
  await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.DeepTerraDroneBridge.snapshot().playing),true);
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>window.DeepTerraDroneBridge.snapshot().playing),false);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#droneView').isVisible(),false);
  console.log('Keyboard playback and exit verified.');
  assert.equal(await page.evaluate(()=>window.DeepTerraDroneBridge.snapshot().height),120);
  // Keyboard placement and cancelling a load restore the dock immediately.
  await page.evaluate(()=>{const original=DeepTerraDroneBridge.loadDroneTerrain;window.originalDroneLoad=original;DeepTerraDroneBridge.loadDroneTerrain=async(...args)=>{await new Promise(resolve=>setTimeout(resolve,1500));return original(...args)};});
  await button.click();await page.keyboard.press('Enter');await page.locator('#droneView').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Volver al mapa',exact:true}).first().click();
  assert.equal(await page.locator('#droneView').isVisible(),false);
  await page.evaluate(()=>{DeepTerraDroneBridge.loadDroneTerrain=window.originalDroneLoad;delete window.originalDroneLoad;});
  console.log('Load cancellation verified.');
  // An actual touch context, not just a narrower desktop viewport.
  const mobileContext=await browser.browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const mobile=await mobileContext.newPage();mobile.setDefaultTimeout(15000);
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(url);await mobile.waitForFunction(()=>window.DeepTerraDroneBridge?.snapshot().ready);
  await mobile.evaluate(()=>window.DeepTerraDroneBridge.prepareMap({lat:-29.95,lng:-71.35},14));
  await mobile.locator('#scenarioToggle').tap();
  for(const [id,value,key] of [['height','600','height'],['duration','120','duration']]){
    const input=mobile.locator('#'+id);assert.equal(await input.getAttribute('enterkeyhint'),'go');
    await input.tap();await input.fill(value);await input.press('Enter');
    assert.equal(await mobile.evaluate(()=>DeepTerraDroneBridge.snapshot().playing),false);
    assert.equal(await mobile.evaluate(key=>DeepTerraDroneBridge.snapshot()[key],key),Number(value));
    assert.equal(await input.evaluate(el=>el===document.activeElement),false);
  }
  await mobile.locator('#duration').tap();await mobile.locator('#duration').fill('90');
  await mobile.locator('#scenarioClose').tap();
  await mobile.locator('#play').tap();
  assert.equal(await mobile.evaluate(()=>DeepTerraDroneBridge.snapshot().playing),true);
  assert.equal(await mobile.evaluate(()=>document.activeElement.id),'play');
  const enteringProgress=await mobile.evaluate(()=>DeepTerraDroneBridge.snapshot().progress);
  await mobile.locator('#droneButton').tap();
  // Touch placement uses a map tap; it does not require a hardware keyboard.
  await mobile.locator('#map').tap({position:{x:195,y:300}});
  await mobile.locator('#droneLoading').waitFor({state:'hidden',timeout:90000});
  await mobile.waitForFunction(()=>document.getElementById('droneCoords').textContent.includes('°'));
  assert.equal(await mobile.evaluate(()=>DeepTerraDroneBridge.snapshot().playing),true);
  assert.ok(await mobile.evaluate(()=>DeepTerraDroneBridge.snapshot().progress)>enteringProgress);
  // In touch flight the dock collapses into the simulation pill.
  assert.equal(await mobile.locator('.playback').isVisible(),false);
  await mobile.locator('.sim-pill-play').tap();
  assert.equal(await mobile.evaluate(()=>DeepTerraDroneBridge.snapshot().playing),false);
  assert.equal(await mobile.getByRole('group',{name:'Joystick de movimiento',exact:true}).isVisible(),true);
  assert.equal(await mobile.locator('.cursor-info').isVisible(),false);
  assert.equal(await mobile.locator('#droneSettings').isVisible(),false);
  await mobile.locator('#droneSettingsToggle').tap();
  assert.equal(await mobile.locator('#droneSpeed').inputValue(),'300');
  await mobile.locator('#droneSpeed').fill('1500');await mobile.locator('#droneSpeed').press('Enter');
  assert.equal(await mobile.locator('#droneSpeed').inputValue(),'1000');
  await mobile.locator('#droneAltitude').fill('3000');await mobile.locator('#droneAltitude').press('Enter');
  assert.equal(await mobile.locator('#droneAltitude').inputValue(),'2000');
  await mobile.locator('#droneAltitude').fill('60');await mobile.locator('#droneAltitude').press('Enter');
  await mobile.locator('#droneSettingsClose').tap();
  const heightTouch=await mobileContext.newCDPSession(mobile);
  for(const direction of [1,-1]){
    const before=Number(await mobile.locator('#droneAltitude').inputValue()),box=await mobile.locator('#droneAltitudeStick').boundingBox();
    await heightTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:box.x+22,y:box.y+53}]});
    await heightTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:box.x+22,y:box.y+53-direction*30}]});
    await mobile.waitForTimeout(500);await heightTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await mobile.locator('#droneAltitudeStick').getAttribute('aria-valuenow'),'0');
    const after=Number(await mobile.locator('#droneAltitude').inputValue());assert.ok((after-before)*direction>0);
    await mobile.waitForTimeout(200);assert.equal(Number(await mobile.locator('#droneAltitude').inputValue()),after);
  }
  await heightTouch.detach();
  const forward=mobile.getByRole('group',{name:'Joystick de movimiento',exact:true});
  assert.equal(await forward.evaluate(el=>getComputedStyle(el).userSelect),'none');
  const start=await mobile.locator('#droneCoords').textContent();
  const touch=await mobileContext.newCDPSession(mobile),fbox=await forward.boundingBox();
  const lookBox=await mobile.getByRole('group',{name:'Joystick de cámara',exact:true}).boundingBox();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:fbox.x+54,y:fbox.y+22},{id:2,x:lookBox.x+85,y:lookBox.y+54}]});
  await mobile.waitForTimeout(1500);
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touch.detach();
  assert.ok(await mobile.locator('#droneMoveStick .stick-knob').evaluate(el=>el.style.transform.includes('-50%')));
  assert.equal(await mobile.locator('#droneLookStick .stick-knob').evaluate(el=>el.style.transform),'translate(-50%, -50%)');
  assert.notEqual(await mobile.locator('#droneCoords').textContent(),start);
  assert.equal(await mobile.evaluate(()=>window.getSelection().toString()),'');
  await mobile.waitForFunction(()=>document.getElementById('droneSpeedValue').textContent==='0 m/s',null,{timeout:8000});
  const stickLabel=await mobile.locator('#droneMoveStick .stick-label').boundingBox(),telemetry=await mobile.locator('.drone-telemetry').boundingBox();
  // Compact telemetry sits between the two joysticks.
  const moveBox=await mobile.locator('#droneMoveStick').boundingBox(),lookStickBox=await mobile.locator('#droneLookStick').boundingBox();
  assert.ok(telemetry.x>=moveBox.x+moveBox.width&&telemetry.x+telemetry.width<=lookStickBox.x);
  await mobile.locator('#droneSettingsToggle').tap();
  await mobile.locator('#droneShowTelemetry').setChecked(false,{force:true});
  assert.equal(await mobile.locator('.drone-telemetry').isVisible(),false);
  assert.equal(await mobile.locator('#droneCoords').isVisible(),false);
  await mobile.locator('#droneShowJoysticks').setChecked(false,{force:true});
  assert.equal(await mobile.locator('#droneMoveStick').isVisible(),false);
  assert.equal(await mobile.locator('#droneAltitudeStick').isVisible(),false);
  await mobile.locator('#droneShowTelemetry').setChecked(true,{force:true});
  await mobile.locator('#droneShowJoysticks').setChecked(true,{force:true});
  await mobile.locator('#droneSettingsClose').tap();
  assert.equal(await mobile.locator('.drone-telemetry').isVisible(),true);
  assert.equal(await mobile.locator('#droneMoveStick').isVisible(),true);
  await mobile.screenshot({path:path.join(output,'drone-mobile.png')});
  const panel=await mobile.locator('.drone-telemetry').boundingBox();
  assert.ok(panel.x>=0&&panel.x+panel.width<=390);
  await mobile.locator('#simPill').tap({position:{x:120,y:22}});
  const bar=await mobile.locator('.playback').boundingBox();assert.ok(bar.y<844&&bar.y+bar.height<=844);
  await mobile.locator('#simPill').tap({position:{x:120,y:22}});
  assert.equal(await mobile.locator('.playback').isVisible(),false);
  await mobile.locator('#droneExit').tap();
  const orientation=await mobileContext.newCDPSession(mobile);
  await mobile.locator('#scenarioToggle').tap();
  await mobile.locator('#height').tap();
  await orientation.send('Emulation.setDeviceMetricsOverride',{width:390,height:300,screenWidth:390,screenHeight:844,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
  assert.equal(await mobile.locator('#portraitGuard').isVisible(),false,'Keyboard resize must not be treated as screen rotation');
  await mobile.locator('#height').press('Enter');
  await orientation.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,screenWidth:844,screenHeight:390,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'landscapePrimary',angle:90}});
  await mobile.locator('#portraitGuard').waitFor({state:'visible'});
  await orientation.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,screenWidth:390,screenHeight:844,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
  await mobile.locator('#portraitGuard').waitFor({state:'hidden'});
  await orientation.detach();await mobileContext.close();
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Passed: dock cancellation, coastal 3D load, water sync, editable drone, flight, keyboard, exit and responsive layout.');
}catch(error){console.error('Browser regression failed:',error.message);throw error;}
finally{await browser.close();}

