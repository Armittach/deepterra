# DeepTerra

**¿Y si el mar subiera? Muévelo tú y mira qué pasaría.**

DeepTerra es un mapa del mundo en el que puedes subir el nivel del mar, metro a metro, y ver qué zonas quedarían bajo el agua. Funciona directamente en el navegador, en el computador o en el celular.

## Qué puedes hacer

- **Subir el mar**: elige una altura, dale a reproducir y mira cómo avanza el agua.
- **Recorrer todo el planeta**: acerca, aleja y toca cualquier punto para ver su altitud y si quedaría inundado.
- **Buscar lugares**: escribe una ciudad, un lugar o unas coordenadas y viaja hasta ahí.
- **Volar en dron**: arrastra el dron al mapa y explora el relieve y el agua en 3D.
- **Ajustar la vista**: cambia la transparencia del agua y muestra u oculta capas como la profundidad o el relieve.

> DeepTerra es una herramienta educativa de escenarios hipotéticos. No simula olas, mareas ni edificios, y **no debe usarse para decisiones de evacuación** ni para evaluar el riesgo de una vivienda.

## Pruébalo en tu computador

Solo necesitas [Python 3](https://www.python.org/) y conexión a Internet:

```bash
git clone https://github.com/Armittach/deepterra.git
cd deepterra
python3 -m http.server 8000 --directory dist
```

Luego abre <http://localhost:8000> en tu navegador. (En Windows puedes usar `py` en lugar de `python3`).

### Opcional: mapas de calles y satélite

Sin hacer nada más, DeepTerra usa el mapa de OpenStreetMap. Si quieres mapas de calles y satélite, y búsqueda mientras escribes, consigue una clave gratuita en [MapTiler](https://cloud.maptiler.com/) y crea el archivo `dist/map-config.js` con:

```js
window.DEEPTERRA_MAP_CONFIG={maptilerKey:'TU_CLAVE'};
```

Ese archivo está ignorado por git, así que tu clave no se sube al repositorio.

## Créditos

DeepTerra existe gracias a datos y herramientas abiertas:

- Mapas: [MapTiler](https://www.maptiler.com/copyright/) y [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright)
- Búsqueda: [Nominatim](https://nominatim.org/)
- Elevación: Copernicus DEM GLO-30 vía [Mapterhorn](https://mapterhorn.com), y Mapzen / Tilezen Terrain Tiles en AWS Open Data
- Bibliotecas: [Leaflet](https://leafletjs.com/), [Three.js](https://threejs.org/) y [Lucide](https://lucide.dev/)
- Tipografía: [Geist](https://vercel.com/font)

Los detalles están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) y [dist/terrain-attribution.md](dist/terrain-attribution.md).

## Licencia

[MIT](LICENSE) © 2026 Armittach
