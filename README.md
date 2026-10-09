# DeepTerra

Simulador visual global de inundación por subida hipotética del nivel del mar, desarrollado con JavaScript, Leaflet, Canvas y WebGL. Funciona en navegadores de escritorio y móviles.

DeepTerra es código abierto (MIT) y acepta contribuciones: lee [CONTRIBUTING.md](CONTRIBUTING.md). La versión alojada en [deepterra.app](https://deepterra.app) ofrece además **DeepTerra Pro** (mapas, búsqueda y 3D fotorrealista de Google), que no forma parte de este repositorio.

## Funciones

- Mapa mundial con navegación táctil, desplazamiento y zoom dinámico.
- Nivel del agua desde 0 hasta 8.848,86 metros y duración configurable.
- Reproducción y pausa con un único botón; barra para recorrer la simulación y consultar la subida actual en metros.
- Filtros de agua, profundidad, relieve, contorno de inundación y transparencia del agua.
- Control de transparencia mediante un botón deslizante en el borde derecho.
- Inspección de coordenadas, altitud y profundidad al tocar un punto. La información permanece anclada al lugar y permite navegar sin desplazar automáticamente el mapa.
- Indicador bajo el cursor: coordenadas, altitud original, cota respecto del nivel simulado y estado de inundación. En móvil se actualiza al tocar el mapa.
- Botón para copiar las coordenadas del pin; ayuda y enlace a GitHub en el menú izquierdo.
- Renderizado con un objetivo de 30 FPS, WebGL cuando está disponible y alternativa Canvas 2D.
- Vista de dron 3D sobre el relieve simulado (ver [DRONE_PROTOTYPE.md](DRONE_PROTOTYPE.md)).
- Búsqueda de lugares con MapTiler, o Nominatim si no hay clave.
- Elevación cargada por bloques, solicitudes compartidas, prioridad a los bloques visibles y cancelación de cargas de niveles de zoom anteriores.

## Ejecutar localmente

No requiere Node.js, npm ni compilación. Con Python 3 instalado:

```bash
git clone https://github.com/Armittach/deepterra.git
cd deepterra
python3 -m http.server 8000 --directory dist
```

Abrir <http://localhost:8000>. En Windows, puede utilizarse `py` en lugar de `python3`.

### Clave de MapTiler (opcional)

Sin clave, el mapa base es OpenStreetMap y la búsqueda usa Nominatim (al pulsar Enter). Con una clave gratuita de [MapTiler](https://cloud.maptiler.com/) se activan los mapas de calles y satélite y la búsqueda mientras se escribe. Crea `dist/map-config.js` (está en `.gitignore`, nunca lo subas):

```js
window.DEEPTERRA_MAP_CONFIG={maptilerKey:'TU_CLAVE'};
```

Restringe la clave a tus dominios (por ejemplo `localhost`) en el panel de MapTiler.

Se necesita conexión a Internet para cargar el mapa y los bloques de elevación (Copernicus GLO-30 vía Mapterhorn). Los datos globales iniciales están incluidos. Usa un servidor HTTP: abrir `index.html` directamente con `file://` puede impedir la carga de los workers y otros recursos.

## Cómo funciona

El nivel simulado se calcula como `altura máxima × progreso`. La duración controla el tiempo de reproducción del escenario, no el tiempo físico de una inundación o un tsunami.

Para cada celda se calcula la menor cota que permite conectarla con el océano siguiendo el terreno y las barreras de ese camino. El terreno se colorea cuando el nivel del agua supera esa cota. Los bloques vecinos intercambian información de sus bordes para mantener la conexión entre áreas.

Durante la carga se conserva una representación provisional del agua. Los datos detallados y sus umbrales de inundación se actualizan juntos. Al cambiar de zoom se reutilizan los cálculos disponibles.

## Estructura

| Archivo | Función |
| --- | --- |
| `dist/index.html` | Estructura de la interfaz. |
| `dist/ui.css` | Estilos de la interfaz: escritorio, móvil y vista del dron. |
| `dist/ui.js` | Escenario, búsqueda, pestañas, herramientas del mapa y paneles. |
| `dist/map-preview.js` | Mapa base: MapTiler (calles o satélite) con OpenStreetMap de respaldo. |
| `dist/drone.js`, `dist/drone-math.mjs` | Vista de dron 3D (Three.js). |
| `dist/app.js` | Mapa, controles, carga de elevación y reproducción. |
| `dist/flood-model.js` | Cálculo de conectividad y umbrales de inundación. |
| `dist/flood-network.js` | Conexión entre bloques de terreno. |
| `dist/flood-worker.js` | Cálculos fuera del hilo principal. |
| `dist/flood-renderer.js` | Renderizado WebGL. |
| `dist/flood-visuals.js` | Relieve y preparación visual del terreno. |
| `dist/global-dem.png`, `dist/global-spill.png` | Elevación mundial inicial y cotas de conexión. |
| `dist/global-terrain.json` | Metadatos de la grilla global. |
| `dist/vendor/` | Leaflet, Lucide y Three.js con sus licencias. |
| `fetch_dem.py` | Descarga opcional de los datos regionales de la primera versión. |

Los archivos `dist/dem.png` y `dist/terrain.json` conservan los datos regionales originales. La app actual utiliza los datos globales y carga el detalle dinámicamente.

## Datos y límites

- Mapa base: [MapTiler](https://www.maptiler.com/copyright/) y [OpenStreetMap](https://www.openstreetmap.org/copyright).
- Elevación: Copernicus DEM GLO-30 vía Mapterhorn (Terrarium, 512 px, hasta zoom 12). Mapzen / Tilezen Terrain Tiles (AWS Open Data) solo para comparar con `?relieve=aws`. La grilla global inicial incluida sigue derivada de Terrain Tiles.
- La grilla global inicial tiene aproximadamente 39 km por celda en el ecuador.
- Zoom del mapa hasta nivel 19; elevación hasta nivel 15. El zoom adicional amplía los datos disponibles y no aumenta su precisión.
- La cobertura Mercator llega aproximadamente a 85° norte y sur; no incluye los polos.
- La resolución y precisión efectivas dependen del dato fuente. El resultado puede cambiar al cargar mayor detalle y puede omitir barreras pequeñas.
- El objetivo de 30 FPS depende del dispositivo y de la carga. Los saltos grandes de zoom pueden mostrar una transición antes de recuperar el detalle.

Es una herramienta educativa de escenarios hipotéticos. No calcula propagación de olas, corrientes, fricción, mareas, edificios, tiempos de llegada ni daños. Los niveles extremos son ficticios. No debe usarse para decisiones de evacuación ni para evaluar el riesgo de una vivienda.

## Publicar en un servidor

Servir el contenido completo de `dist/` con cualquier servidor de archivos estáticos. Mantener sus rutas relativas y todos los archivos PNG, JavaScript y `vendor/`. El repositorio no contiene credenciales ni configuración privada del alojamiento original.

## Descargar los datos regionales opcionales

```bash
python3 -m pip install -r requirements.txt
python3 fetch_dem.py
```

Este script actualiza solo los datos regionales originales; no regenera la grilla global ni los umbrales mundiales.

## Dependencias de terceros

Leaflet 1.9.4, Lucide y Three.js están incluidos en `dist/vendor/` con sus licencias. Las atribuciones del mapa y la elevación también aparecen en la aplicación.

## Licencias

El código original se publica bajo [MIT](LICENSE), copyright 2026 Armittach. Las bibliotecas y los datos mantienen sus propias licencias y créditos: [fuentes y licencias](THIRD_PARTY_NOTICES.md), [atribuciones de elevación](dist/terrain-attribution.md) y [licencia de Leaflet](dist/vendor/LEAFLET-LICENSE.txt). Los datos de OpenStreetMap son ODbL y las fuentes de elevación tienen condiciones según la región.

La cota actual del indicador es `elevación del terreno − altura máxima × progreso`. El estado depende de la conexión con el océano; una cota negativa en una depresión aislada no equivale a inundación.

## GitHub Pages
El flujo `.github/workflows/pages.yml` publica `dist/` al actualizar `main`. En Settings → Pages, seleccionar GitHub Actions como origen. Dirección: https://armittach.github.io/deepterra/

Para la búsqueda y los mapas de MapTiler, agrega el secreto `MAPTILER_API_KEY` en Settings → Secrets and variables → Actions (restringido al dominio de Pages).

## Pruebas

```bash
npm install
npm test              # lógica del dron
npm run test:browser  # pruebas en navegador (Playwright)
```
