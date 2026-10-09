# Fuentes y licencias de DeepTerra

El código original de DeepTerra se distribuye bajo la licencia MIT, copyright 2026 Armittach. Esta licencia no sustituye las licencias de bibliotecas ni de datos de terceros.

## Leaflet 1.9.4

Copyright (c) 2010-2023, Vladimir Agafonkin; copyright (c) 2010-2011, CloudMade.
Licencia BSD de 2 cláusulas. El texto completo se conserva en [vendor/LEAFLET-LICENSE.txt](dist/vendor/LEAFLET-LICENSE.txt).

## Mapa base

© OpenStreetMap contributors. Datos bajo Open Database License (ODbL), con las condiciones aplicables a los mapas publicados. Consulte https://www.openstreetmap.org/copyright y la política de uso de teselas https://operations.osmfoundation.org/policies/tiles/.

## MapTiler

© MapTiler. Mapas de calles y satélite, geocodificación y textura satelital de la vista 3D, sujetos a los términos de MapTiler (https://www.maptiler.com/copyright/ y https://www.maptiler.com/terms/). Su logo y créditos se muestran sobre el mapa mientras se usan sus mapas. Sin clave de MapTiler se usa OpenStreetMap y la búsqueda de Nominatim (https://operations.osmfoundation.org/policies/nominatim/).

## Elevación y grillas derivadas

Mapzen / Tilezen Terrain Tiles, codificación Terrarium, alojados en AWS Open Data. Los PNG de elevación y los umbrales de inundación incluidos en DeepTerra se derivan de estas teselas. Sus fuentes tienen licencias distintas según la región; no se consideran todas MIT o dominio público.

Se incluye la lista de atribuciones del proveedor en [terrain-attribution.md](dist/terrain-attribution.md), con los créditos de ArcticDEM, Geoscience Australia, Austria, Canadá, Copernicus, NOAA ETOPO1, INEGI, LINZ, Kartverket, Environment Agency y USGS.

Fuente y términos: https://github.com/tilezen/joerd/blob/master/docs/attribution.md
Descripción: https://www.mapzen.com/blog/elevation/

## NOAA y batimetría

NOAA ETOPO1 forma parte de las fuentes de la colección Tilezen. DeepTerra no ha incorporado directamente ETOPO 2022 ni modela actualmente la dinámica del océano a partir de batimetría.

Referencia de los modelos ETOPO: https://www.ncei.noaa.gov/products/etopo-global-relief-model

## Lucide 1.52.0
Iconos de Lucide, licencia ISC. Biblioteca y licencia incluidas en dist/vendor/. https://lucide.dev

## Three.js
Three.js 0.180.0 (MIT), copyright Three.js Authors. Bundled locally for the optional drone 3D view. Full license: dist/vendor/THREE-LICENSE.txt (vendor/THREE-LICENSE.txt from the published app). https://threejs.org/

## Geist y Geist Mono
Tipografías de Vercel, licencia SIL Open Font License 1.1. Se cargan desde Google Fonts; si no están disponibles, la interfaz usa la fuente del sistema. https://vercel.com/font


Copernicus DEM GLO-30 — fuente de elevación por defecto para la simulación y el relieve, servida como piezas Terrarium por Mapterhorn (https://mapterhorn.com). Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30. Mapzen/Tilezen Terrain Tiles (AWS) queda solo como comparación con ?relieve=aws.
