// Shared, testable rules for the local drone scene. Coordinates are meters.
export const EARTH_CIRCUMFERENCE = 40075016.686;
export const TILE_SIZE = 256;
export const FLOOD_EPSILON = 0.00001;
export const DRONE_ZOOM = 14;
export const RETURN_RADIUS = 86;
export const RETURN_GRACE_MS = 240;

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const modulo = (value, size) => ((value % size) + size) % size;
export function worldPoint(lat, lng, zoom = DRONE_ZOOM) {
  const latitude = clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180;
  const total = 2 ** zoom;
  return {x: modulo((lng + 180) / 360, 1) * total,
    y: clamp((1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * total, 0, total - 1e-8)};
}
export function latLng(point, zoom = DRONE_ZOOM) {
  const total = 2 ** zoom;
  return {lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * point.y / total))) * 180 / Math.PI,
    lng: modulo(point.x / total * 360, 360) - 180};
}
export function tileSpan(latitude, zoom = DRONE_ZOOM) {
  return EARTH_CIRCUMFERENCE * Math.cos(latitude * Math.PI / 180) / 2 ** zoom;
}
export function tileWindow(point, radius = 1, zoom = DRONE_ZOOM) {
  const total = 2 ** zoom, records = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const ux = Math.floor(point.x) + dx, y = Math.floor(point.y) + dy;
    if (y >= 0 && y < total) records.push({z: zoom, x: modulo(ux, total), y, ux});
  }
  return records;
}
export function flooded(level, ground, threshold, sea) {
  return Boolean(sea) || level > threshold + FLOOD_EPSILON;
}
export const tileKey = coords => coords.z + '/' + coords.ux + '/' + coords.y;
export function planTerrainWindow(point, records, radius = 1, zoom = DRONE_ZOOM) {
  const desired=tileWindow(point,radius,zoom),wanted=new Set(desired.map(tileKey));
  const existing=new Map(records.map(record=>[tileKey(record.coords),record]));
  return {desired,missing:desired.filter(coords=>!existing.has(tileKey(coords))),
    keep:records.filter(record=>wanted.has(tileKey(record.coords))),
    remove:records.filter(record=>!wanted.has(tileKey(record.coords)))};
}
export function cancelDrop({x, y, homeX, homeY, lastNearHome = -Infinity, now, dragged}) {
  return !dragged || Math.hypot(x - homeX, y - homeY) <= RETURN_RADIUS || now - lastNearHome <= RETURN_GRACE_MS;
}
export function moveDrone(position, {forward, right, yaw, speed, dt, bounds}) {
  const norm = Math.max(1, Math.hypot(forward, right));
  const distance = speed * Math.min(Math.max(dt, 0), 0.05) / norm;
  const x = position.x + (Math.sin(yaw) * forward + Math.cos(yaw) * right) * distance;
  const z = position.z + (-Math.cos(yaw) * forward + Math.sin(yaw) * right) * distance;
  return {x: clamp(x, bounds.minX, bounds.maxX), z: clamp(z, bounds.minZ, bounds.maxZ),
    limited: x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ};
}
// Sample across tile edges at cell centers, including the antimeridian.
export function terrainSampler(records, zoom = DRONE_ZOOM) {
  const total = 2 ** zoom;
  const byKey = new Map(records.map(r => [r.coords.x + '/' + r.coords.y, r]));
  const read = (gx, gy, field) => {
    const tx = Math.floor(gx / TILE_SIZE), ty = Math.floor(gy / TILE_SIZE);
    const record = byKey.get(modulo(tx, total) + '/' + ty);
    if (!record) return null;
    const index = modulo(gy, TILE_SIZE) * TILE_SIZE + modulo(gx, TILE_SIZE);
    return {value: record[field][index], record, index};
  };
  return (point) => {
    const px = point.x * TILE_SIZE - 0.5, py = point.y * TILE_SIZE - 0.5;
    const x = Math.floor(px), y = Math.floor(py), fx = px - x, fy = py - y;
    const cells = [read(x, y, 'dem'), read(x + 1, y, 'dem'), read(x, y + 1, 'dem'), read(x + 1, y + 1, 'dem')];
    const available = cells.find(Boolean);
    if (!available) return null;
    const heights = cells.map(cell => (cell || available).value);
    const ground = heights[0] * (1 - fx) * (1 - fy) + heights[1] * fx * (1 - fy) + heights[2] * (1 - fx) * fy + heights[3] * fx * fy;
    const nearest = read(Math.floor(point.x * TILE_SIZE), Math.floor(point.y * TILE_SIZE), 'dem') || available;
    return {ground, threshold: nearest.record.threshold[nearest.index], sea: Boolean(nearest.record.sea[nearest.index])};
  };
}

// Ajustes editables (dist/ajustes.js → window.DeepTerraAjustes). Cada entrada: [por omisión, mínimo, máximo].
// Un valor que falta, no es número o se sale del rango se reemplaza (por omisión) o se recorta (al rango).
export const DRONE_SETTINGS = Object.freeze({
  dron: {distanciaDibujoKm: [80, 20, 150], velocidadInicial: [300, 1, 3000], velocidadMaxima: [1000, 50, 3000],
    subida: [150, 1, 3000], alturaInicial: [60, 2, 2000], alturaFijaInicial: [600, 2, 20000], alturaFijaMax: [9000, 500, 20000],
    campoVision: [65, 40, 100], cuadrosMaximos: [30, 15, 144], resolucionMaxima: [1.5, 0.5, 2], sensibilidadMirar: [1, 0.2, 3]},
  niebla: {inicio: [0.25, 0, 0.9], fin: [1, 0.5, 1]},
  carga: {esperaMaximaS: [8, 2, 30], fundidoMs: [600, 0, 3000]}
});
// Devuelve {values, issues}: values congelado con todos los grupos del esquema; issues = textos de lo corregido.
export function parseSettings(raw, schema = DRONE_SETTINGS) {
  const values = {}, issues = [];
  for (const [group, entries] of Object.entries(schema)) {
    values[group] = {};
    for (const [key, [fallback, min, max]] of Object.entries(entries)) {
      const given = raw?.[group]?.[key];let value = fallback;
      if (given !== undefined) {
        const number = typeof given === 'string' && given.trim() !== '' ? Number(given.replace(',', '.')) : given;
        if (typeof number !== 'number' || !Number.isFinite(number)) issues.push(group + '.' + key + ': no es un número, se usa ' + fallback);
        else {value = clamp(number, min, max);if (value !== number) issues.push(group + '.' + key + ': fuera de rango, se usa ' + value);}
      }
      values[group][key] = value;
    }
  }
  return {values, issues};
}
// Ajustes del dron con las reglas entre valores (velocidades ≤ máxima, altitud fija ≤ su máximo, niebla).
export function droneSettings(raw) {
  const {values, issues} = parseSettings(raw, DRONE_SETTINGS), d = values.dron, n = values.niebla;
  d.velocidadInicial = Math.min(d.velocidadInicial, d.velocidadMaxima);d.subida = Math.min(d.subida, d.velocidadMaxima);
  d.alturaFijaInicial = Math.min(d.alturaFijaInicial, d.alturaFijaMax);n.inicio = Math.min(n.inicio, n.fin - 0.05);
  for (const group of Object.values(values)) Object.freeze(group);
  return {values: Object.freeze(values), issues};
}
// Alcance de un nivel de terreno (en bloques del zoom del dron, desde el centro): radio·factor + medio bloque.
export const levelReach = (radius, factor) => radius * factor + factor / 2;
// Tope del anillo lejano (zoom 10) según el equipo: ±40 km (low), ±85 km (mid), ±120 km (high) aprox.
export const TIER_FAR_RADIUS = Object.freeze({low: 1, mid: 2, high: 3});
// Radio del anillo lejano para ver `distanceKm`: el menor que llega a esa distancia (0 = no hace falta,
// basta el nivel interior que llega a innerReach bloques), con el tope del equipo.
export function farRadius(distanceKm, span, factor, innerReach, tier = 'high') {
  const need = distanceKm * 1000 / span;
  const radius = need <= innerReach ? 0 : Math.ceil((need - factor / 2) / factor);
  return clamp(radius, 0, TIER_FAR_RADIUS[tier] ?? TIER_FAR_RADIUS.high);
}
// Niebla y plano lejano de la cámara (m): la niebla se cierra en la distancia de dibujo (o antes, si el
// terreno cargado no llega). reach = alcance del terreno cargado (m); loaded = ya hay anillos lejanos.
export function viewDistance({reach, span, limitKm, start, end, loaded}) {
  const limit = limitKm * 1000;
  if (!loaded) {const far = Math.min(limit, reach + 2 * span) * end;return {near: Math.min(2.2 * span, far * 0.9), far, camera: far * 1.05 + 3000};}
  const distance = Math.min(limit, reach), far = distance * end;
  return {near: distance * start, far, camera: far * 1.05 + 3000};
}
