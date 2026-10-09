import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {worldPoint,latLng,tileWindow,tileSpan,terrainSampler,flooded,cancelDrop,moveDrone,planTerrainWindow} from '../dist/drone-math.mjs';

test('Coordinates round-trip, including wrapped longitude and polar edges',()=>{
  for(const [lat,lng] of [[-29.95,-71.34],[0,179.999],[85,0],[-85,-179.999]]){
    const result=latLng(worldPoint(lat,lng));assert.ok(Math.abs(result.lat-lat)<1e-7);assert.ok(Math.abs(result.lng-lng)<1e-7);
  }
  const tiles=tileWindow(worldPoint(0,179.999));assert.equal(tiles.length,9);assert.ok(tiles.some(t=>t.x===0&&t.ux===16384));
  assert.ok(tileWindow(worldPoint(85.05112878,0)).every(t=>t.y>=0));
  assert.ok(tileSpan(-30)<tileSpan(0));
});
test('A below-sea-level basin stays dry until the connecting barrier is exceeded',()=>{
  const scope={};vm.runInNewContext(fs.readFileSync(new URL('../dist/flood-model.js',import.meta.url),'utf8'),scope);
  const dem=new Float32Array(25).fill(20),spill=new Float32Array(25).fill(1000);
  for(let i=0;i<5;i++){dem[i]=-10;spill[i]=0;}dem[12]=-5;
  const model=scope.DeepTerraFlood.solve(dem,spill,5);
  assert.equal(model.threshold[12],20);assert.equal(model.sea[12],0);
  assert.equal(flooded(10,dem[12],model.threshold[12],model.sea[12]),false);
  assert.equal(flooded(20,dem[12],model.threshold[12],model.sea[12]),false);
  assert.equal(flooded(21,dem[12],model.threshold[12],model.sea[12]),true);
  assert.equal(flooded(0,-10,0,1),true);
});
test('Terrain interpolation is continuous across tile boundaries',()=>{
  const make=(x,height)=>({coords:{z:14,x,y:10},dem:new Float32Array(65536).fill(height),threshold:new Float32Array(65536).fill(20),sea:new Uint8Array(65536)});
  const sample=terrainSampler([make(20,10),make(21,30)]);
  assert.equal(sample({x:21,y:10.5}).ground,20);
  assert.ok(Math.abs(sample({x:21-1e-9,y:10.5}).ground-sample({x:21+1e-9,y:10.5}).ground)<0.001);
  assert.equal(sample({x:21.5,y:10.5}).threshold,20);
});
test('Dock margin, recent return and non-drags cancel deployment',()=>{
  const base={homeX:100,homeY:100,now:1000,dragged:true};
  assert.equal(cancelDrop({...base,x:170,y:100}),true);
  assert.equal(cancelDrop({...base,x:220,y:100,lastNearHome:900}),true);
  assert.equal(cancelDrop({...base,x:220,y:100,lastNearHome:500}),false);
  assert.equal(cancelDrop({...base,x:300,y:100,dragged:false}),true);
});
test('Flight has a configured real speed, no diagonal boost, and bounded travel',()=>{
  const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
  const one=moveDrone({x:0,z:0},{forward:1,right:0,yaw:0,speed:20,dt:0.05,bounds});
  const diagonal=moveDrone({x:0,z:0},{forward:1,right:1,yaw:0,speed:20,dt:0.05,bounds});
  assert.equal(one.z,-1);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-1)<1e-10);
  const edge=moveDrone({x:100,z:0},{forward:0,right:1,yaw:0,speed:200,dt:5,bounds});assert.equal(edge.x,100);assert.equal(edge.limited,true);
});
test('Moving terrain window reuses six blocks, loads three and releases three',()=>{
  const records=tileWindow({x:20.5,y:10.5}).map(coords=>({coords}));
  const plan=planTerrainWindow({x:21.1,y:10.5},records);
  assert.equal(plan.keep.length,6);assert.equal(plan.missing.length,3);assert.equal(plan.remove.length,3);
  assert.equal(plan.keep.length+plan.missing.length,9);
  const crossed=planTerrainWindow({x:16384.1,y:10.5},tileWindow({x:16383.5,y:10.5}).map(coords=>({coords})));
  assert.equal(crossed.keep.length,6);assert.ok(crossed.missing.every(c=>c.x===1));
});

test('Extended five-by-five terrain window retains twenty blocks per crossing',()=>{const records=tileWindow({x:20.5,y:10.5},2).map(coords=>({coords}));const plan=planTerrainWindow({x:21.1,y:10.5},records,2);assert.equal(records.length,25);assert.equal(plan.keep.length,20);assert.equal(plan.missing.length,5);assert.equal(plan.remove.length,5);});

const terrainQualityContext=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../dist/terrain-quality.js',import.meta.url),'utf8'),terrainQualityContext);const quality=terrainQualityContext.DeepTerraTerrainQuality;
test('A negative strip in high mountains is repaired only when parent data corroborates it',()=>{const dem=new Float32Array(65536).fill(8271);dem.fill(-515,183*256,184*256);const parent=new Float32Array(65536).fill(8270),coords={z:14,x:12148,y:6863},parentCoords={z:13,x:6074,y:3431};assert.equal(quality.repair(dem,parent,coords,parentCoords),256);assert.equal(dem[183*256+132],8270);assert.equal(dem[182*256+132],8271);});
test('Ocean depths and corroborated negative terrain are left unchanged',()=>{const coords={z:14,x:12148,y:6863},parentCoords={z:13,x:6074,y:3431},ocean=new Float32Array(65536).fill(-5000);assert.equal(quality.suspects(ocean).length,0);const pit=new Float32Array(65536).fill(6000);pit.fill(-400,183*256,184*256);const parent=new Float32Array(65536).fill(-400);assert.equal(quality.repair(pit,parent,coords,parentCoords),0);assert.equal(pit[183*256+132],-400);});
