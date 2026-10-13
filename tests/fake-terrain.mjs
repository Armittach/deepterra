// Terreno sintético para pruebas de navegador: piezas Terrarium (PNG) generadas al vuelo, coherentes entre
// zooms. Costa recta en lon 4.5° (Países Bajos, donde la grilla global también tiene océano): al oeste mar a
// −20 m; al este una llanura que sube despacio, con lomas suaves, una cresta de 6 m y una cuenca detrás
// (para que el agua tenga que "descubrir" caminos entre piezas vecinas, como en la realidad).
import zlib from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, {level: 1})), chunk('IEND', Buffer.alloc(0))]);
}

export const COAST_LON = 4.5;
/** Elevación en metros. */
export function elevation(lon, lat) {
  const km = (lon - COAST_LON) * 111.32 * Math.cos(lat * Math.PI / 180), ny = (lat - 52.3) * 111.32;
  if (km < 0) return Math.max(-20, km * 2);
  let h = km * 0.12 + 1.6 * Math.sin(km / 3.1) * Math.cos(ny / 4.3) + 0.8 * Math.sin(ny / 1.7 + km / 2.3);
  h += 6 * Math.exp(-(((km - 14) / 1.2) ** 2));           // cresta
  h -= 5 * Math.exp(-(((km - 20) / 3) ** 2 + (ny / 6) ** 2)); // cuenca detrás de la cresta
  return Math.max(0.2, h);
}
const cache = new Map();
export function terrariumTile(z, x, y, size = 256) {
  const key = z + '/' + x + '/' + y + '/' + size; if (cache.has(key)) return cache.get(key);
  const rgb = Buffer.alloc(size * size * 3), n = 2 ** z;
  for (let py = 0; py < size; py++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + (py + 0.5) / size) / n))) * 180 / Math.PI;
    for (let px = 0; px < size; px++) {
      const lon = (x + (px + 0.5) / size) / n * 360 - 180, v = elevation(lon, lat) + 32768, i = (py * size + px) * 3;
      rgb[i] = Math.floor(v / 256); rgb[i + 1] = Math.floor(v) % 256; rgb[i + 2] = Math.floor((v % 1) * 256);
    }
  }
  const out = png(size, size, rgb); cache.set(key, out); if (cache.size > 600) cache.delete(cache.keys().next().value); return out;
}
