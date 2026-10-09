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
