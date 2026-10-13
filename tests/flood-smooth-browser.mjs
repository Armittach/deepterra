// Animación del agua sin saltos (mapa 2D, PC y celular), con terreno sintético (tests/fake-terrain.mjs).
// Mide, mientras sube el agua: (1) «saltos de datos»: zonas que se inundan de golpe porque su umbral de
// inundación cambió en medio de la animación; (2) bloques del mapa que no se redibujan (agua congelada);
// (3) ritmo de cuadros. Se corre: PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node tests/flood-smooth-browser.mjs
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {terrariumTile} from './fake-terrain.mjs';
const require = createRequire(import.meta.url), {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PORT = 8797, BASE = 'http://127.0.0.1:' + PORT + '/?relieve=aws', BASE_COP = 'http://127.0.0.1:' + PORT + '/';
const server = spawn(process.execPath, [fileURLToPath(new URL('../serve.mjs', import.meta.url))], {env: {...process.env, PORT: String(PORT)}, stdio: 'ignore'});
await new Promise(r => setTimeout(r, 500));
const cors = {'Access-Control-Allow-Origin': '*'};
const VIEW = {lat: 52.3, lng: 4.72};
const browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
let failures = 0;
async function scenario(name, fn) { if (process.env.ONLY && !name.includes(process.env.ONLY)) return; try { await fn(); console.log('ok -', name); } catch (e) { failures++; console.error('FALLA -', name, '\n', e.message); } }

async function open({viewport = {width: 1280, height: 800}, mobile = false, latency = 120, copernicus = false, dpr = 1} = {}) {
  const context = await browser.newContext({locale:'es-CL',viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: dpr});
  await context.addInitScript(() => { try { localStorage.setItem('deepterra-guia', 'vista'); localStorage.setItem('deepterra-guia-dron', 'vista'); } catch {} });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/map-config.js*', r => r.fulfill({contentType: 'text/javascript', body: "window.DEEPTERRA_MAP_CONFIG={env:'production'};"}));
  await page.route('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/**', async r => {
    const [z, x, y] = new URL(r.request().url()).pathname.split('/').slice(-3).map(s => parseInt(s));
    await new Promise(res => setTimeout(res, latency * (0.5 + Math.random())));
    r.fulfill({contentType: 'image/png', headers: cors, body: terrariumTile(z, x, y)}).catch(() => {});
  });
  await page.route('https://tiles.mapterhorn.com/**', async r => {
    if (!copernicus) return r.abort();
    const [z, x, y] = new URL(r.request().url()).pathname.replace('.webp', '').split('/').slice(-3).map(s => parseInt(s));
    r.fulfill({contentType: 'image/png', headers: cors, body: terrariumTile(z, x, y, 512)}).catch(() => {});
  });
  await page.route(/openstreetmap|maptiler|nominatim|^https:\/\/fonts\./, r => r.abort());
  await page.goto(copernicus ? BASE_COP : BASE);
  await page.waitForFunction(() => window.DeepTerraDroneBridge?.snapshot().ready, null, {timeout: 60000});
  return {context, page, errors};
}

/** Instala el medidor en la página: cada ~100 ms compara datos y lienzos de los bloques visibles. */
async function installProbe(page) {
  await page.evaluate(() => {
    const probe = window.__probe = {samples: [], pops: [], frames: [], stale: 0, staleMax: 0, last: new Map(), running: true};
    let lastT = performance.now();
    const wetData = (r, level) => { let n = 0; const t = r.threshold, s = r.sea; for (let i = 0; i < 65536; i++) if (!s[i] && level > t[i] + 1e-5) n++; return n; };
    function tick(now) {
      if (!probe.running) return;
      probe.frames.push(now - lastT); lastT = now;
      if (!probe.nextAt || now >= probe.nextAt) {
        probe.nextAt = now + 100;
        const level = currentLevel(), z = Math.min(TERRAIN_MAX_ZOOM, map.getZoom());
        let wet = 0, popped = 0, staleNow = 0, shown = 0;
        for (const r of visibleTiles()) {
          if (!r.threshold || r.coords.z !== z) continue;
          const prev = probe.last.get(r);
          if (prev && prev.threshold !== r.threshold && state.playing) {
            // Píxeles que pasan a mojados solo porque cambió el umbral (no porque subió el agua).
            let n = 0; for (let i = 0; i < 65536; i++) if (!r.sea[i] && level > r.threshold[i] + 1e-5 && !(prev.level > prev.threshold[i] + 1e-5) && !(level > prev.threshold[i] + 1e-5)) n++;
            if (n) probe.pops.push({at: level, px: n, tile: r.coords.z + '/' + r.coords.x + '/' + r.coords.y});
          }
          probe.last.set(r, {threshold: r.threshold, level});
          wet += wetData(r, level);
          // Lienzo: debe mostrar agua donde los datos dicen que hay (tolerancia por el borde y el contorno).
          if (state.playing && r.canvas) {
            const px = r.canvas.getContext('2d').getImageData(0, 0, 256, 256).data; let drawn = 0;
            // Se cuenta el agua dibujada en tierra (la orilla poco profunda es más transparente).
            for (let i = 3; i < px.length; i += 16) if (px[i] > 8 && !r.sea[(i - 3) >> 2]) drawn++;
            shown += drawn * 4;
            const expect = wetData(r, level) / 4;
            if (expect > 400 && drawn < expect * 0.7) staleNow++;
          }
        }
        probe.stale += staleNow; probe.staleMax = Math.max(probe.staleMax, staleNow);
        probe.samples.push({level, wet, shown, playing: state.playing});
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
async function play(page, {height = 12, duration = 12} = {}) {
  await page.evaluate(([h, d]) => { $('height').value = h; $('duration').value = d; parameterChange(); state.progress = 0; continuePlayback(); }, [height, duration]);
  await page.waitForFunction(() => !state.playing && state.progress >= 1, null, {timeout: (duration + 60) * 1000});
  return page.evaluate(() => { window.__probe.running = false; const p = window.__probe; return {pops: p.pops, stale: p.stale, staleMax: p.staleMax, samples: p.samples, frames: p.frames}; });
}
function report(name, r) {
  const popPx = r.pops.reduce((a, p) => a + p.px, 0), totalWet = r.samples.at(-1)?.wet || 1;
  const frames = r.frames.slice(5).sort((a, b) => a - b), p95 = frames[Math.floor(frames.length * 0.95)] || 0;
  // Mayor salto entre muestras seguidas, relativo al área final.
  // Salto visible: lo que aparece en pantalla entre muestras, menos lo esperable por la subida del agua sola.
  let maxJump = 0; const totalShown = Math.max(1, ...r.samples.map(s => s.shown));
  for (let i = 2; i < r.samples.length; i++) { const d = r.samples[i].shown - r.samples[i - 1].shown, prevD = Math.max(0, r.samples[i - 1].shown - r.samples[i - 2].shown); maxJump = Math.max(maxJump, (d - 2 * prevD) / totalShown); }
  console.log(`  ${name}: saltos de datos ${r.pops.length} (${(popPx / totalWet * 100).toFixed(1)} % del área final) · mayor salto visible ${(maxJump * 100).toFixed(1)} % · bloques congelados ${r.stale} (máx ${r.staleMax}) · cuadro p95 ${p95.toFixed(0)} ms`);
  return {popShare: popPx / totalWet, maxJump, stale: r.stale, samples: r.samples};
}
// Lo que se ve debe seguir a los datos: un bloque congelado deja mucha agua sin dibujar.
function smooth(r, max = 0.15) {
  // Se mide el atraso sostenido (8 muestras seguidas, ≥ 0,8 s): una transición corta de datos nuevos es esperable.
  const lags = r.samples.map(s => s.playing && s.wet > 20000 ? (s.wet - s.shown) / s.wet : 0);
  let lag = 0; for (let i = 0; i + 8 <= lags.length; i++) lag = Math.max(lag, Math.min(...lags.slice(i, i + 8)));
  if (process.env.DEBUG_LAG) console.log(r.samples.map(s => s.level.toFixed(1) + ':' + s.wet + '/' + s.shown).join(' '));
  console.log('    agua sin dibujar (peor tramo sostenido): ' + (lag * 100).toFixed(1) + ' %');
  assert.ok(lag < max, 'El agua dibujada no debe quedarse atrás de la simulación (' + (lag * 100).toFixed(1) + ' %)');
}
const settle = page => page.waitForFunction(() => { const z = Math.min(TERRAIN_MAX_ZOOM, map.getZoom()), r = visibleTiles().filter(r => r.coords.z === z); return r.length && r.every(r => !r.provisional && !r.loading); }, null, {timeout: 90000});

try {
  await scenario('Relieve de Copernicus al acercarse (zoom 15): interpolado, sin escalones de celdas enteras', async () => {
    const {context, page, errors} = await open({copernicus: true});
    await page.evaluate(v => map.setView(v, 15, {animate: false}), VIEW); await settle(page);
    const r = await page.evaluate(() => {
      const t = visibleTiles().find(r => r.coords.z === 15 && !r.provisional); let same = 0, n = 0;
      for (let y = 0; y < 256; y++) for (let x = 0; x < 255; x++) { const i = y * 256 + x; if (t.sea[i]) continue; n++; if (t.dem[i] === t.dem[i + 1]) same++; }
      return {same: same / Math.max(1, n), n};
    });
    console.log('    celdas vecinas con la misma altura: ' + (r.same * 100).toFixed(1) + ' % (con escalones serían ≥ 75 %)');
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.ok(r.n > 1000 && r.same < 0.2, 'El relieve ampliado debe ser continuo');
    await context.close();
  });
  await scenario('Pantalla retina y mucho zoom (13 a 18): el agua se dibuja completa y nítida, sin bloques', async () => {
    const {context, page, errors} = await open({viewport: {width: 1440, height: 900}, dpr: 2, copernicus: true});
    for (const z of [13, 15, 16, 17, 18]) {
      await page.evaluate(([v, z]) => map.setView(v, z, {animate: false}), [VIEW, z]); await settle(page); await page.evaluate(() => floodNetwork.settled());
      const r = await page.evaluate(async () => {
        $('height').value = 10; $('duration').value = 60; parameterChange(); state.progress = .45; repaint(); await new Promise(r => setTimeout(r, 900)); repaint();
        const lvl = currentLevel(); let wet = 0, shown = 0, dry = 0;
        for (const r of visibleTiles()) { const w = r.canvas.width, k = w / 256, px = r.canvas.getContext('2d').getImageData(0, 0, w, w).data;
          for (let y = 2; y < 256; y += 4) for (let x = 2; x < 256; x += 4) { const i = y * 256 + x; if (r.sea[i]) continue; const j = ((Math.floor((y + .5) * k)) * w + Math.floor((x + .5) * k)) * 4 + 3;
            if (lvl > r.threshold[i] + 0.3) { wet++; if (px[j] > 8) shown++; } else if (lvl < r.threshold[i] - 0.3 && px[j] > 8) dry++; } }
        return {wet, shown, dry, scale: gpuRenderer.scale, buffer: gpuRenderer.gl.drawingBufferWidth === gpuRenderer.canvas.width};
      });
      console.log('    zoom ' + z + ': agua ' + r.shown + '/' + r.wet + ' · agua de más ' + r.dry + ' · escala ' + r.scale);
      assert.ok(r.buffer, 'el lienzo de dibujo calza con el búfer');
      assert.ok(r.wet === 0 || r.shown / r.wet > 0.97, 'zoom ' + z + ': debe verse el agua');
      assert.ok(r.dry <= Math.max(5, r.wet * 0.01), 'zoom ' + z + ': no debe haber agua donde está seco');
    }
    assert.equal(errors.length, 0, errors.join('\n'));
    await context.close();
  });
  await scenario('Al alejar el mapa, lo ya calculado se ve inundado de inmediato (no aparece de golpe al cargar)', async () => {
    const {context, page, errors} = await open({latency: 2500});
    await page.evaluate(v => map.setView(v, 14, {animate: false}), VIEW); await settle(page); await page.evaluate(() => floodNetwork.settled());
    await page.evaluate(() => { $('height').value = 10; $('duration').value = 10; parameterChange(); state.progress = 0.5; repaint(); });
    const old = await page.evaluate(() => { const b = map.getBounds(); return [b.getWest(), b.getEast(), b.getSouth(), b.getNorth()]; });
    // Solo dentro de lo que se veía antes de alejar (lo que ya estaba calculado).
    const wetNow = () => page.evaluate(([w, e, so, no]) => { const lvl = currentLevel(); let n = 0; for (const r of visibleTiles()) if (r.coords.z === 13 && r.threshold) for (let i = 0; i < 65536; i += 7) { const p = map.unproject([r.coords.x * 256 + (i % 256) + .5, r.coords.y * 256 + (i >> 8) + .5], 13); if (p.lng < w || p.lng > e || p.lat < so || p.lat > no) continue; if (!r.sea[i] && lvl > r.threshold[i]) n++; } return n; }, old);
    await page.evaluate(v => map.setView(v, 13, {animate: false}), VIEW); await page.waitForTimeout(200);
    const before = await wetNow(); await settle(page); await page.evaluate(() => floodNetwork.settled()); const after = await wetNow();
    console.log('    agua al alejar: vista previa ' + before + ' → final ' + after + ' (' + (before / Math.max(1, after) * 100).toFixed(0) + ' %)');
    assert.equal(errors.length, 0, errors.join('\n'));
    assert.ok(after > 0 && before / after > 0.85, 'La vista previa debe mostrar la mayor parte del agua antes de que carguen los datos');
    await context.close();
  });
  for (const [label, opts] of [['PC', {}], ['celular', {viewport: {width: 412, height: 760}, mobile: true}]]) {
    await scenario(label + ': reproducir con el mapa ya cargado', async () => {
      const {context, page, errors} = await open(opts);
      await page.evaluate(v => map.setView(v, 11, {animate: false}), VIEW); await settle(page);
      await page.evaluate(() => floodNetwork.settled());
      await installProbe(page); const r = report(label + ' cargado', await play(page));
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.ok(r.popShare < 0.01, 'Con el mapa cargado no debe haber zonas que se inunden de golpe');
      smooth(r);
      assert.ok(r.stale <= 2, 'Ningún bloque debe quedar congelado (' + r.stale + ')');
      await context.close();
    });
    await scenario(label + ': reproducir apenas se abre la zona (aún cargando)', async () => {
      const {context, page, errors} = await open({...opts, latency: 400});
      await page.evaluate(v => map.setView(v, 11, {animate: false}), VIEW);
      await installProbe(page); const r = report(label + ' cargando', await play(page));
      assert.equal(errors.length, 0, errors.join('\n'));
      smooth(r);
      await context.close();
    });
    await scenario(label + ': mover el mapa mientras sube el agua', async () => {
      const {context, page, errors} = await open(opts);
      await page.evaluate(v => map.setView(v, 11, {animate: false}), VIEW); await settle(page); await page.evaluate(() => floodNetwork.settled());
      await installProbe(page);
      const run = play(page, {duration: 14});
      for (let i = 0; i < 4; i++) { await page.waitForTimeout(2500); await page.evaluate(i => map.panBy([i % 2 ? -260 : 260, 90], {animate: false}), i); }
      const r = report(label + ' moviendo', await run);
      assert.equal(errors.length, 0, errors.join('\n'));
      smooth(r, 0.2);
      await context.close();
    });
    await scenario(label + ': datos que llegan tarde aparecen de a poco, no de golpe', async () => {
      const {context, page, errors} = await open(opts);
      await page.evaluate(v => map.setView(v, 11, {animate: false}), VIEW); await settle(page); await page.evaluate(() => floodNetwork.settled());
      // Agua a 8 m, en pausa. Luego, a un bloque visible le llegan datos nuevos: una zona seca pasa a inundable.
      const counts = await page.evaluate(async () => {
        $('height').value = 10; $('duration').value = 10; parameterChange(); state.progress = 0.8; repaint();
        const r = visibleTiles().find(r => r.coords.z === 11 && r.threshold.some((t, i) => !r.sea[i] && t > 9));
        const region = []; for (let i = 0; i < 65536; i++) if (!r.sea[i] && r.threshold[i] > 9) region.push(i);
        const next = r.threshold.slice(); for (const i of region) next[i] = Math.min(next[i], 1 + (i % 256) / 64);
        const shownIn = () => { const px = r.canvas.getContext('2d').getImageData(0, 0, 256, 256).data; let n = 0; for (const i of region) if (px[i * 4 + 3] > 8) n++; return n / region.length; };
        const out = [shownIn()];
        r.networkEntry.threshold = next; r.networkEntry.version++; floodNetwork.assign(r.networkEntry, r);
        const t0 = performance.now();
        for (const at of [0, 200, 400, 1000]) { await new Promise(res => setTimeout(res, Math.max(0, t0 + at - performance.now()))); repaint(); out.push(shownIn()); }
        return out;
      });
      console.log('    zona nueva visible: antes ' + counts.map(c => (c * 100).toFixed(0) + ' %').join(' → '));
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.ok(counts[0] < 0.02, 'Antes del cambio la zona está seca');
      assert.ok(counts[1] < 0.6, 'Justo al llegar los datos no debe aparecer todo de golpe');
      assert.ok(counts[4] > 0.95, 'Al terminar la transición la zona debe verse inundada');
      assert.ok(counts[2] <= counts[3] + 0.01 && counts[3] <= counts[4] + 0.01, 'Debe ir apareciendo de forma pareja');
      await context.close();
    });
    await scenario(label + ': dron — el agua sube pareja y los datos nuevos aparecen de a poco', async () => {
      const {context, page, errors} = await open(opts);
      page.on('console', m => { if (m.type() === 'error' && /Shader Error|Drone scene|THREE.WebGLProgram/.test(m.text())) errors.push(m.text()); });
      await page.evaluate(v => map.setView(v, 11, {animate: false}), VIEW); await settle(page);
      await page.evaluate(v => window.dispatchEvent(new CustomEvent('deepterra:fly-to', {detail: v})), VIEW);
      await page.locator('#droneLoading').waitFor({state: 'hidden', timeout: 120000});
      const out = await page.evaluate(async () => {
        $('height').value = 10; $('duration').value = 8; parameterChange(); state.progress = 0; continuePlayback();
        await new Promise(r => setTimeout(r, 2500));
        const tiles = DeepTerraDroneDebug.water().filter(t => t.record.networkEntry && t.record.threshold.some((v, i) => !t.record.sea[i] && v > 6));
        if (!tiles.length) { const all = DeepTerraDroneDebug.water(); return {error: "sin bloques: " + all.length + " con red " + all.filter(t => t.record.networkEntry).length}; }
        const {record, item} = tiles[0], e = record.networkEntry, next = e.threshold.slice();
        for (let i = 0; i < next.length; i++) if (!e.sea[i] && next[i] > 6) next[i] = 0.5;
        e.threshold = next; e.version++; for (const r of e.records) floodNetwork.assign(e, r);
        const fades = []; const t0 = performance.now();
        while (performance.now() - t0 < 1600) { await new Promise(r => requestAnimationFrame(r)); fades.push(+item.water.material.uniforms.fade.value.toFixed(2)); }
        const frames = []; let last = performance.now();
        for (let k = 0; k < 20; k++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); frames.push(n - last); last = n; }
        return {fades, level: currentLevel(), p50: frames.sort((a, b) => a - b)[10]};
      });
      assert.ok(!out.error, out.error);
      console.log('    transición del dron (fade): ' + out.fades.join(' → ') + ' · cuadro p50 ' + out.p50.toFixed(0) + ' ms');
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.ok(out.fades.some(f => f > 0.05 && f < 0.95), 'El agua nueva del dron debe aparecer con una transición');
      assert.equal(out.fades.at(-1), 1, 'La transición debe terminar');
      await context.close();
    });
  }
} finally { await browser.close(); server.kill(); }
if (failures) { console.error(failures + ' escenario(s) con fallas'); process.exit(1); }
console.log('Todo bien');
