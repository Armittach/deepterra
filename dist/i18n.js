/* DeepTerra · idiomas (español e inglés).
   La interfaz se escribe en español; en inglés se traduce el texto que se ve (nodos de texto y los
   atributos aria-label, title, placeholder, alt y aria-valuetext) con este diccionario y unas reglas para
   los textos con números. Un observador traduce también lo que la app escribe después (paneles, avisos,
   carga del dron). Los números usan el formato del idioma (DeepTerraI18n.locale).
   Idioma: el que elija la persona en Ajustes (se guarda en este navegador); si no eligió, según el país
   aproximado (/api/geo: países de habla hispana → español) y, mientras tanto, el idioma del navegador.
   Para agregar textos (p. ej. desde una extensión): DeepTerraI18n.add({'Texto en español':'English text'});
   textos con partes variables: DeepTerraI18n.addRule(/^Hola (.+)$/,'Hello $1'). Lo marcado con data-no-i18n no se traduce. */
(()=>{
  'use strict';
  const KEY='deepterra-idioma';
  const SPANISH=new Set(['AR','BO','CL','CO','CR','CU','DO','EC','ES','GQ','GT','HN','MX','NI','PA','PE','PR','PY','SV','UY','VE']);
  const store={get(){try{return localStorage.getItem(KEY);}catch{return null;}},set(v){try{localStorage.setItem(KEY,v);}catch{}}};
  const fromQuery=(()=>{try{const q=new URLSearchParams(location.search).get('lang');return q==='en'||q==='es'?q:null;}catch{return null;}})();
  const saved=store.get();
  let lang=fromQuery||(saved==='en'||saved==='es'?saved:(/^es\b/i.test(navigator.language||'')?'es':'en'));
  const chosen=Boolean(fromQuery||saved==='en'||saved==='es');

  const dict=new Map(Object.entries({
    // Página y barra superior
    'DeepTerra · Simulador de inundación':'DeepTerra · Flood simulator',
    'DeepTerra · Simulador de inundación y subida del nivel del mar':'DeepTerra · Sea level rise and flood simulator',
    'Mapa interactivo y gratuito: sube el nivel del mar en cualquier lugar del mundo y mira qué zonas quedarían bajo el agua, en el mapa o volando en 3D con un dron.':'Free interactive map: raise the sea level anywhere on Earth and see which areas would end up underwater — on the map or flying a 3D drone.',
    'DeepTerra: mapa de una costa con el mar subiendo':'DeepTerra: map of a coastline with the water rising',
    'Mapa mundial de inundación, desplazable y ampliable':'World flood map, pannable and zoomable',
    'Información de DeepTerra':'About DeepTerra',
    'Buscar un lugar o coordenadas':'Search a place or coordinates',
    'Cerrar búsqueda':'Close search','Resultados':'Results','Buscar un lugar':'Search a place',
    // Capas
    'Capas del mapa':'Map layers','Capas':'Layers','Cerrar capas':'Close layers','Agua':'Water',
    'Mostrar el agua':'Show water','Colorear según profundidad':'Color by depth','Borde de la zona inundada':'Flood edge',
    'Transparencia del agua':'Water transparency','Terreno':'Terrain','Sombras del relieve':'Hillshade',
    'Mapa base':'Base map','Elegir mapa base':'Choose base map','Estándar':'Standard','Satélite':'Satellite',
    'No se pudo cargar el satélite. Inténtalo de nuevo en un momento.':'Couldn’t load the satellite map. Try again in a moment.',
    'Pantalla completa':'Full screen','Salir de pantalla completa':'Exit full screen',
    // Ajustes
    'Ajustes y ayuda':'Settings and help','Ajustes':'Settings','Cerrar ajustes':'Close settings','Pantalla':'Display',
    'Ocultar botones y paneles':'Hide buttons and panels','Datos del punto bajo el mouse':'Data for the point under the mouse',
    'Ayuda':'Help','Ver la guía de nuevo':'See the tour again','Atajos de teclado':'Keyboard shortcuts','Espacio':'Space',
    'Reproducir o pausar la animación':'Play or pause the animation','Ocultar o mostrar botones y paneles':'Hide or show buttons and panels',
    'Volar el dron; Q baja y E sube':'Fly the drone; Q goes down and E goes up','Cerrar un panel o volver al mapa':'Close a panel or go back to the map',
    'Sobre DeepTerra':'About DeepTerra','Cómo se calcula':'How it’s calculated','Datos, créditos y licencias':'Data, credits and licenses',
    // Herramientas
    'Herramientas del mapa':'Map tools','Acercar':'Zoom in','Alejar':'Zoom out','Ir a mi ubicación':'Go to my location',
    'Transparencia':'Transparency','Transparencia del agua: toca para abrir o mantén y desliza':'Water transparency: tap to open, or hold and slide',
    'Ver en 3D con el dron':'See it in 3D with the drone','· arrástralo al mapa':'· drag it onto the map',
    'Ver en 3D con el dron: arrástralo al mapa o pulsa para elegir un lugar':'See it in 3D with the drone: drag it onto the map or tap to pick a place',
    'Arrastra el dron al mapa para verlo en 3D':'Drag the drone onto the map to see it in 3D',
    'Este navegador no permite obtener la ubicación.':'This browser can’t get your location.',
    'Buscando tu ubicación…':'Finding your location…',
    'No se pudo obtener tu ubicación. Revisa los permisos del navegador.':'Couldn’t get your location. Check your browser’s permissions.',
    // Búsqueda
    'Escribe coordenadas (lat, lon), por ejemplo -33.45, -70.66.':'Type coordinates (lat, lon), for example 40.71, -74.01.',
    'Coordenadas (latitud, longitud)':'Coordinates (latitude, longitude)','Pulsa Enter para buscar.':'Press Enter to search.',
    'Buscando…':'Searching…','Sin resultados. Prueba con otro nombre o con coordenadas (lat, lon).':'No results. Try another name or coordinates (lat, lon).',
    'No se pudo buscar. Revisa tu conexión o escribe coordenadas (lat, lon).':'Search failed. Check your connection or type coordinates (lat, lon).',
    'No se pudo ubicar ese lugar. Inténtalo de nuevo.':'Couldn’t find that place. Try again.',
    // Dron
    'Vista 3D del dron, con simulación sincronizada':'Drone 3D view, synced with the simulation',
    'Relieve y agua en 3D. Arrastra para mirar y usa WASD o flechas para volar':'Terrain and water in 3D. Drag to look around and use WASD or the arrow keys to fly',
    'Volver al mapa':'Back to the map','Mapa':'Map','Rumbo':'Heading','Ajustes de vuelo y capas':'Flight settings and layers','Altitud':'Altitude',
    'Telemetría del dron':'Drone telemetry','Altura sobre el suelo':'Height above ground','Altitud sobre el mar':'Altitude above sea level',
    'Sobre el agua':'Above water','Altitud del suelo':'Ground altitude','Subida del mar':'Sea-level rise','Velocidad':'Speed',
    'mover':'move','bajar':'down','subir':'up','Arrastra para mirar':'Drag to look around',
    'Ajustes de vuelo':'Flight settings','Cerrar ajustes de vuelo':'Close flight settings','Velocidad máxima':'Top speed',
    'Velocidad máxima, en m/s':'Top speed, in m/s','Velocidad al subir o bajar':'Climb and descent speed','Velocidad al subir o bajar, en m/s':'Climb and descent speed, in m/s',
    'Cómo mantiene la altura':'How it keeps its height','Sigue el suelo':'Follow the ground','Altura fija':'Fixed altitude',
    'Altura sobre el suelo, en metros':'Height above ground, in meters','Altitud sobre el mar, en metros':'Altitude above sea level, in meters',
    'Capas del agua':'Water layers','Mostrar datos de vuelo':'Show flight data','Mostrar controles táctiles':'Show touch controls',
    'El dron sube y baja siguiendo el suelo. Sobre el océano, la altura se mide desde el nivel normal del mar.':'The drone rises and falls with the ground. Over the ocean, height is measured from normal sea level.',
    'El dron vuela siempre a la misma altura sobre el nivel normal del mar. Si el suelo es más alto, pasa 2 m por encima.':'The drone always flies at the same altitude above normal sea level. If the ground is higher, it passes 2 m above it.',
    'Cómo se controla':'Controls',
    'WASD o flechas: avanzar y girar. Q baja y E sube. Arrastra la vista para mirar alrededor. En el celular usa los dos joysticks y el control de altura. Enter o Espacio: reproducir o pausar. Esc: volver al mapa.':'WASD or arrow keys: move and turn. Q goes down and E goes up. Drag the view to look around. On a phone, use the two joysticks and the height control. Enter or Space: play or pause. Esc: back to the map.',
    'Cargando relieve y conexión del agua…':'Loading terrain and water connections…','Reintentar':'Retry',
    'Mando del dron y reproductor':'Drone controller and player','Abrir el reproductor y los datos':'Open the player and data','Cerrar el reproductor y los datos':'Close the player and data',
    'Nivel':'Level','Reproducir la inundación':'Play the flood','Pausar la inundación':'Pause the flood','Repetir la inundación':'Replay the flood',
    'Subida actual del mar':'Current sea-level rise','Cuánto sube el mar':'How much the sea rises','Otro':'Other','Otra subida':'Other rise',
    'Otra subida del mar, en metros':'Other sea-level rise, in meters','Duración de la animación':'Animation length','Otra duración':'Other length',
    'Otra duración de la animación, en segundos (de 1 a 3.600)':'Other animation length, in seconds (1 to 3,600)',
    'Datos de vuelo':'Flight data','Altura':'Height','Suelo':'Ground','Nivel del mar':'Sea level','Joystick de movimiento':'Movement joystick',
    'Volar':'Fly','Vel.':'Spd.','Sobre':'Above','el':'the','agua':'water','Joystick de cámara':'Camera joystick','Mirar':'Look',
    'Toca y arrastra a la izquierda para volar · a la derecha para mirar':'Touch and drag on the left to fly · on the right to look',
    'Control de altura':'Height control','Altura del dron':'Drone height','Subir (mantén presionado)':'Up (hold)','Subir':'Up',
    'Bajar (mantén presionado)':'Down (hold)','Bajar':'Down','Subir o bajar el dron':'Raise or lower the drone','Mostrar interfaz (H)':'Show interface (H)',
    'Arrastra el dron al mapa · vuelve al círculo o pulsa Esc para cancelar':'Drag the drone onto the map · move back to the circle or press Esc to cancel',
    'Elige un punto del mapa · Enter usa el centro · Esc cancela':'Pick a point on the map · Enter uses the center · Esc cancels',
    'Preparando terreno…':'Preparing terrain…','Preparando imágenes del terreno…':'Preparing terrain imagery…',
    'No se pudo cargar el terreno. Puedes reintentar o volver al mapa.':'Couldn’t load the terrain. You can retry or go back to the map.',
    'La vista 3D requiere WebGL 2. Puedes seguir usando el mapa.':'The 3D view needs WebGL 2. You can keep using the map.',
    'Se perdió la vista 3D. Vuelve al mapa y abre el dron otra vez.':'The 3D view was lost. Go back to the map and open the drone again.',
    'Este dispositivo no pudo dibujar el agua 3D. Vuelve al mapa.':'This device couldn’t draw the 3D water. Go back to the map.',
    'Fondo marino':'Seafloor','Sin agua':'No water','No se pudo ampliar el terreno. Reintentando…':'Couldn’t load more detail. Retrying…',
    'Esperando terreno para continuar el vuelo…':'Waiting for terrain to keep flying…','Cargando más terreno y conexión del agua…':'Loading more terrain and water connections…',
    'Se usa parte del terreno de menor resolución.':'Some terrain is shown at lower resolution.','Cargando más terreno…':'Loading more terrain…',
    'No se pudo cargar la vista 3D':'Couldn’t load the 3D view',
    // Menú de información
    'Simulador de inundación ·':'Flood simulator ·','Simulador de inundación':'Flood simulator','Cerrar información':'Close',
    'Secciones':'Sections','Datos y créditos':'Data and credits','Nivel actual':'Current level','Tierra cubierta':'Land covered',
    'Es una simulación aproximada, hecha para explorar y aprender. Solo usa la altura del terreno: no predice tsunamis, marejadas ni daños. No sirve para saber si una casa o terreno en particular está en riesgo, ni para decidir una evacuación; para eso, sigue a las autoridades de tu zona.':'This is an approximate simulation, made for exploring and learning. It only uses ground elevation: it doesn’t predict tsunamis, storm surges or damage. It can’t tell you whether a specific home or property is at risk, or whether to evacuate; for that, follow your local authorities.',
    'El agua sube de forma pareja desde 0 m hasta la subida del escenario, durante lo que dura la animación. Por ejemplo, con 100 m y 60 s, a los 30 s el agua va en +50 m.':'The water rises evenly from 0 m to the scenario’s rise over the length of the animation. For example, with 100 m and 60 s, at 30 s the water is at +50 m.',
    'Un lugar se inunda solo si el agua puede llegar a él desde el océano, avanzando por terreno más bajo que el nivel del agua. Por eso, un valle bajo el nivel del mar pero rodeado de cerros sigue seco hasta que el agua pasa por encima de esos cerros.':'A place floods only if water can reach it from the ocean, moving across ground lower than the water level. That’s why a valley below sea level but surrounded by hills stays dry until the water spills over those hills.',
    '«Sobre el agua» es la altura del suelo menos lo que subió el mar. Un valor negativo no siempre significa inundación: puede haber una barrera natural que no deja pasar el agua.':'“Above water” is the ground height minus how much the sea has risen. A negative value doesn’t always mean flooding: a natural barrier may keep the water out.',
    'La animación solo sirve para mostrar el escenario: no representa la velocidad real con que sube el mar. No se consideran corrientes, mareas, olas, el fondo marino ni los edificios.':'The animation only shows the scenario: it doesn’t reflect how fast the sea actually rises. Currents, tides, waves, the seafloor and buildings aren’t taken into account.',
    'Al acercarte se carga una elevación más detallada, y el resultado puede cambiar un poco. Barreras pequeñas, como muros o diques, pueden no aparecer. La tierra cubierta es una estimación para todo el mundo.':'As you zoom in, more detailed elevation loads and the result may change slightly. Small barriers, like walls or levees, may not show up. Land covered is a worldwide estimate.',
    'Cargando elevación…':'Loading elevation…',
    '· mapas estándar y satélite, búsqueda de lugares y textura satelital de la vista 3D.':'· standard and satellite maps, place search and the satellite texture of the 3D view.',
    '· mapa base y datos bajo ODbL; búsqueda con':'· base map and data under the ODbL; search with','cuando MapTiler no está disponible.':'when MapTiler isn’t available.',
    '· elevación para la simulación, vía':'· elevation for the simulation, via',
    '. Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. La Unión Europea, la ESA, el DLR y Airbus no asumen responsabilidad por el uso de estos datos.':'. Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The European Union, ESA, DLR and Airbus accept no liability for the use of this data.',
    '· elevación terrestre y oceánica, alojada en AWS Open Data, para la simulación, el relieve sombreado y el relieve del dron.':'· land and ocean elevation, hosted on AWS Open Data, for the simulation, the hillshade and the drone terrain.',
    'Todas las fuentes de elevación':'All elevation sources','· biblioteca del mapa;':'· map library;','licencia BSD de 2 cláusulas':'2-clause BSD license',
    '· iconos;':'· icons;','licencia ISC':'ISC license','· vista 3D del dron;':'· drone 3D view;','licencia MIT':'MIT license',
    '· tipografía, incluida en la app;':'· typeface, bundled with the app;','licencia SIL Open Font':'SIL Open Font License','· código de la aplicación;':'· app code;',
    'Límites del modelo':'Model limits',
    'Con el mapa alejado, el mundo se calcula en cuadros de unos 39 km de lado (en el ecuador). Al acercarte se usa elevación más detallada, hasta el nivel de zoom 15; si te acercas más, la imagen se amplía pero no gana precisión.':'With the map zoomed out, the world is computed in squares about 39 km across (at the equator). As you zoom in, more detailed elevation is used, up to zoom level 15; beyond that, the image is enlarged but doesn’t gain precision.',
    'El mapa cubre desde 85° S hasta 85° N, sin los polos. La subida máxima es 8.848,86 m, la altura del Everest; los niveles muy altos son escenarios imaginarios.':'The map covers 85° S to 85° N, without the poles. The maximum rise is 8,848.86 m, the height of Everest; very high levels are imaginary scenarios.',
    'Fuentes, licencias y créditos completos':'Full sources, licenses and credits','Privacidad y condiciones':'Privacy and terms','Código en GitHub':'Code on GitHub',
    '· MIT · Armittach':'· MIT · Armittach',
    // Punto seleccionado
    'Punto seleccionado':'Selected point','Copiar coordenadas':'Copy coordinates','Coordenadas copiadas':'Coordinates copied',
    'No se pudieron copiar las coordenadas':'Couldn’t copy the coordinates','Cerrar punto seleccionado':'Close selected point',
    'Altitud del terreno':'Ground elevation','Volar aquí':'Fly here','Océano':'Ocean','Bajo el agua':'Under water','En seco':'Dry',
    'Sin inundar':'Not flooded','bajo el nivel, pero el agua no llega':'below the level, but the water can’t reach it',
    'Elevación global aproximada':'Approximate global elevation','Elevación de menor resolución ampliada':'Lower-resolution elevation, enlarged',
    'grilla global':'global grid',
    // Reproductor y escenario
    'Controles de simulación':'Simulation controls','Profundidad del agua sobre el terreno, en metros':'Water depth above ground, in meters',
    'Profundidad del agua':'Water depth','Reproducir simulación':'Play simulation','Pausar simulación':'Pause simulation','Reiniciar simulación':'Restart simulation',
    'Volver a 0 m':'Back to 0 m','Escenario':'Scenario','estimación mundial':'worldwide estimate',
    'Elige cuánto sube el mar y cuánto dura la animación.':'Choose how much the sea rises and how long the animation lasts.',
    'Cerrar escenario':'Close scenario','Menos metros':'Fewer meters','Subida del mar, en metros':'Sea-level rise, in meters','Más metros':'More meters',
    'Ejemplos de subida':'Example rises','Everest · 8.848,86 m':'Everest · 8,848.86 m','1.000 m':'1,000 m',
    'Duración de la animación, en segundos':'Animation length, in seconds',
    'Es lo que dura la animación en pantalla, no el tiempo real que tardaría en subir el mar.':'It’s how long the animation lasts on screen, not how long the sea would really take to rise.',
    'Aplicar':'Apply','Aplicar y reproducir':'Apply and play',
    'Mostrar u ocultar los datos del punto':'Show or hide point data','Mueve el mouse al mapa':'Move the mouse over the map',
    'Plegar los datos del punto bajo el mouse':'Collapse point data','Desplegar los datos del punto bajo el mouse':'Expand point data',
    // Mapa y avisos
    'Cargando mapa':'Loading map','Parte del detalle no está disponible; se usa elevación de menor resolución.':'Some detail isn’t available; lower-resolution elevation is used.',
    'No se pudo cargar la elevación. Recarga la página.':'Couldn’t load the elevation. Reload the page.','La conexión del terreno tardó demasiado':'The terrain connection took too long',
    'África':'Africa','Europa':'Europe','Asia':'Asia','Sudamérica':'South America','Norteamérica':'North America','Oceanía':'Oceania',
    // Guía
    'Sube el nivel del mar':'Raise the sea level',
    'Mira qué zonas del mundo quedarían bajo el agua si el nivel del mar subiera. Es una simulación aproximada, para explorar y aprender.':'See which parts of the world would end up under water if the sea level rose. It’s an approximate simulation, for exploring and learning.',
    'Arrastra la barra para elegir cuánto sube el mar, o pulsa reproducir para ver cómo avanza la inundación. En «Escenario» eliges la subida máxima y cuánto dura la animación.':'Drag the bar to choose how much the sea rises, or press play to watch the flood spread. In “Scenario” you choose the maximum rise and how long the animation lasts.',
    'Toca un punto del mapa':'Tap a point on the map','Verás su altura y si queda bajo el agua con el nivel actual.':'You’ll see its elevation and whether it’s under water at the current level.',
    'Muestra u oculta el agua, colorea según la profundidad, marca el borde de la zona inundada y cambia el mapa de fondo.':'Show or hide the water, color it by depth, outline the flooded area and change the base map.',
    'Míralo en 3D con el dron':'See it in 3D with the drone',
    'Arrastra el dron a cualquier lugar del mapa para volar sobre él. También puedes tocar un punto y elegir «Volar aquí».':'Drag the drone anywhere on the map to fly over it. You can also tap a point and choose “Fly here”.',
    'Busca un lugar':'Search for a place','Escribe una ciudad, una dirección o coordenadas (latitud, longitud) para ir directo ahí.':'Type a city, an address or coordinates (latitude, longitude) to go straight there.',
    'Aquí puedes ocultar los botones, ver cómo se calcula la simulación, los créditos y volver a ver esta guía.':'Here you can hide the buttons, see how the simulation is calculated, the credits, and see this tour again.',
    'Bienvenido a DeepTerra':'Welcome to DeepTerra','Iniciar guía':'Start the tour','Cerrar':'Close',
    'Mira qué zonas del mundo quedarían bajo el agua si el nivel del mar subiera, en el mapa o volando con un dron.':'See which parts of the world would end up under water if the sea level rose, on the map or flying a drone.',
    'Sube el mar y mira cómo avanza el agua':'Raise the sea and watch the water spread','Toca cualquier punto para ver su altura':'Tap any point to see its elevation',
    'Vuela en 3D sobre el relieve':'Fly in 3D over the terrain','Es una simulación aproximada, para explorar y aprender.':'It’s an approximate simulation, for exploring and learning.',
    'Elige el escenario':'Choose the scenario','Herramientas del mapa':'Map tools','Ver la guía del dron':'See the drone tour',
    'Arrastra la barra para elegir cuánto sube el mar, o pulsa reproducir para ver cómo avanza la inundación. ↺ vuelve a 0 m.':'Drag the bar to choose how much the sea rises, or press play to watch the flood spread. ↺ goes back to 0 m.',
    'Aquí eliges la subida máxima del mar (hasta la altura del Everest) y cuánto dura la animación. «Aplicar y reproducir» la inicia de inmediato.':'Here you choose the maximum sea-level rise (up to the height of Everest) and how long the animation lasts. “Apply and play” starts it right away.',
    'Verás su altura y si queda bajo el agua con el nivel actual. Si está bajo el nivel pero el agua no llega, también te lo dice.':'You’ll see its elevation and whether it’s under water at the current level. If it’s below the level but the water can’t reach it, it tells you that too.',
    'Acerca o aleja, ve a tu ubicación y cambia la transparencia del agua para ver lo que queda debajo.':'Zoom in or out, go to your location and change the water’s transparency to see what lies beneath.',
    'Aquí cambias el idioma, ocultas los botones, ves cómo se calcula la simulación y los créditos, y vuelves a ver esta guía.':'Here you change the language, hide the buttons, see how the simulation is calculated and the credits, and see this tour again.',
    'Cambia la velocidad, elige si el dron sigue el suelo o vuela a una altura fija, y ajusta las capas del agua.':'Change the speed, choose whether the drone follows the ground or flies at a fixed altitude, and adjust the water layers.',
    'Con este botón o con Esc vuelves al mapa. Puedes volver a ver esta guía desde los ajustes de vuelo.':'This button or Esc takes you back to the map. You can see this tour again from the flight settings.',
    'Con este botón vuelves al mapa. Puedes volver a ver esta guía desde los ajustes de vuelo.':'This button takes you back to the map. You can see this tour again from the flight settings.',
    'Mira alrededor':'Look around','Arrastra la vista con el mouse para mirar hacia cualquier lado.':'Drag the view with the mouse to look in any direction.',
    'Vuela con el teclado':'Fly with the keyboard','W A S D o las flechas avanzan y giran. Q baja y E sube.':'W A S D or the arrow keys move and turn. Q goes down and E goes up.',
    'Altura sobre el suelo, sobre el agua y sobre el mar, la subida del mar y la velocidad, al instante.':'Height above the ground, above the water and above sea level, the sea-level rise and the speed, live.',
    'La inundación sigue aquí':'The flood is here too','Reproduce, pausa o arrastra el nivel como en el mapa: el agua sube alrededor del dron. Enter o Espacio reproduce o pausa.':'Play, pause or drag the level as on the map: the water rises around the drone. Enter or Space plays or pauses.',
    'Vuela y mira tocando':'Fly and look by touch','Toca y arrastra en la mitad izquierda para volar, y en la derecha para mirar. Los controles aparecen donde pones el dedo.':'Touch and drag on the left half to fly, and on the right half to look. The controls appear where you put your finger.',
    'Subir y bajar':'Up and down','Mantén presionado para subir o bajar el dron.':'Hold to raise or lower the drone.','Reproductor':'Player',
    'Reproduce la inundación y mira los metros y los datos de vuelo. Desliza la pestaña hacia arriba para elegir la subida y la duración.':'Play the flood and see the meters and flight data. Slide the tab up to choose the rise and the length.',
    'Joystick para volar':'Flying joystick','Muévelo para avanzar, retroceder y girar.':'Move it to go forward, back and turn.',
    'Joystick para mirar':'Looking joystick','Muévelo para mirar hacia arriba, abajo y a los lados.':'Move it to look up, down and to the sides.',
    'Mantén presionado o desliza para cambiar la altura del dron.':'Hold or slide to change the drone’s height.','Reproductor y datos':'Player and data',
    'Pulsa ▶ para ver subir el agua. Desliza la rayita hacia arriba para elegir la subida, la duración y ver los datos de vuelo.':'Press ▶ to watch the water rise. Slide the small bar up to choose the rise and the length and see the flight data.',
    'Omitir guía':'Skip tour','Atrás':'Back','Siguiente':'Next','Empezar':'Start','Listo':'Done',
    // Rumbo (letras del compás)
    'SO':'SW','O':'W','NO':'NW'
  }));
  const cardinal={N:'N',NE:'NE',E:'E',SE:'SE',S:'S',SO:'SW',O:'W',NO:'NW'};
  const tr=s=>dict.has(s)?dict.get(s):translate(s);
  // Textos con números o partes variables (la parte variable se traduce si se puede).
  const rules=[
    [/^Bienvenido a DeepTerra v(\d+)$/,'Welcome to DeepTerra v$1'],
    [/^Paso (\d+) de (\d+)$/,'Step $1 of $2'],
    [/^(.+) · (\d+) %$/,(m,a,p)=>tr(a)+' · '+p+' %'],
    [/^Cargando relieve y agua · (\d+)\/(\d+) bloques$/,'Loading terrain and water · $1/$2 tiles'],
    [/^Muestreo del terreno · ≈ (.+) m\/celda en esta latitud(.*)$/,(m,v,rest)=>'Terrain sampling · ≈ '+v+' m/cell at this latitude'+rest.replace(' · grilla global',' · global grid').replace(' · precisión según el dato fuente',' · precision depends on the source data').replace(' · ampliación visual',' · enlarged view')],
    [/^(Inundado|Bajo el agua) · (.+)$/,(m,w,v)=>(w==='Inundado'?'Flooded':'Under water')+' · '+v],
    [/^Terreno (.+)$/,'Terrain $1'],[/^Sobre el agua (.+)$/,'Above water $1'],
    [/^(.+) m de profundidad$/,'$1 m deep'],[/^(.+) m sobre el agua$/,'$1 m above water'],
    [/^(.+ m) de (.+ m)$/,'$1 of $2'],
    [/^Otra duración \(ahora (.+)\)$/,'Other length (now $1)'],[/^Ahora: (.+)$/,'Now: $1'],[/^Ir a (.+)$/,'Go to $1'],
    [/^(N|NE|E|SE|S|SO|O|NO) · (\d+°)$/,(m,c,d)=>cardinal[c]+' · '+d],
    [/^(grilla global|relieve z(\d+))( ampliado)?( · fondo marino (.+))?$/,(m,a,z,up,sf,src)=>(z?'terrain z'+z:'global grid')+(up?' enlarged':'')+(sf?' · seafloor '+tr(src):'')],
    [/^agua \+(.+)$/,'water +$1']
  ];
  function translate(s){for(const [re,rep] of rules){if(re.test(s))return s.replace(re,rep);}return null;}
  // Traduce un texto conservando los espacios de los bordes; null si no hay traducción.
  function t(s){
    if(lang!=='en'||typeof s!=='string'||!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(s))return s;
    const k=s.trim();if(!k)return s;
    const v=dict.has(k)?dict.get(k):translate(k);
    return v==null?s:s.replace(k,v);
  }

  /* ---------- Traducción del documento ---------- */
  const ATTRS=['aria-label','title','placeholder','alt','aria-valuetext'];
  const texts=new Map(),attrs=new Map();// nodo → {orig, written} (para volver al español)
  // Texto ya traducido que llega como nuevo (p. ej. una copia de un elemento): se recupera su español.
  let reverse=null,reverseFor=-1,dictVersion=0;
  const original=v=>{if(lang!=='en'||typeof v!=='string')return v;if(reverseFor!==dictVersion){reverseFor=dictVersion;reverse=new Map();for(const [k,e] of dict)if(!reverse.has(e))reverse.set(e,k);}const k=v.trim();return k&&reverse.has(k)?v.replace(k,reverse.get(k)):v;};
  const skip=n=>{const el=n.nodeType===1?n:n.parentElement;return !el||el.closest('script,style,svg,[data-no-i18n]');};
  function doText(n){
    if(skip(n))return;let rec=texts.get(n);
    if(!rec||n.data!==rec.written){rec={orig:original(n.data),written:null};texts.set(n,rec);}
    const out=lang==='en'?t(rec.orig):rec.orig;
    if(out!==n.data){rec.written=out;n.data=out;}else rec.written=n.data;
  }
  function doAttrs(el){
    if(el.closest('script,style,[data-no-i18n]'))return;
    for(const a of ATTRS){if(!el.hasAttribute(a))continue;const v=el.getAttribute(a);let m=attrs.get(el);if(!m){m={};attrs.set(el,m);}
      let rec=m[a];if(!rec||v!==rec.written){rec=m[a]={orig:original(v),written:null};}
      const out=lang==='en'?t(rec.orig):rec.orig;if(out!==v){rec.written=out;el.setAttribute(a,out);}else rec.written=v;}
  }
  function walk(root){
    if(root.nodeType===3){doText(root);return;}
    if(root.nodeType!==1)return;
    if(root.closest('script,style,[data-no-i18n]'))return;
    doAttrs(root);
    const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeType===1&&(n.matches('script,style,svg,[data-no-i18n]'))?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    for(let n=w.nextNode();n;n=w.nextNode()){if(n.nodeType===3)doText(n);else doAttrs(n);}
  }
  let observer=null;
  function observe(){
    if(observer||!document.body)return;
    observer=new MutationObserver(list=>{
      for(const m of list){
        if(m.type==='characterData')doText(m.target);
        else if(m.type==='attributes')doAttrs(m.target);
        else for(const n of m.addedNodes)walk(n);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  }
  function applyDocument(){
    document.documentElement.lang=lang;
    const title=document.querySelector('title');if(title){if(!title.dataset.es)title.dataset.es=title.textContent;title.textContent=lang==='en'?t(title.dataset.es):title.dataset.es;}
    // Datos para buscadores y vista previa al compartir, en el idioma de la página.
    for(const m of document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[property="og:image:alt"],meta[name="twitter:title"],meta[name="twitter:description"]')){
      if(!m.dataset.es)m.dataset.es=m.getAttribute('content')||'';m.setAttribute('content',lang==='en'?t(m.dataset.es):m.dataset.es);
    }
    const loc=document.querySelector('meta[property="og:locale"]'),alt=document.querySelector('meta[property="og:locale:alternate"]');
    if(loc)loc.setAttribute('content',lang==='en'?'en_US':'es_CL');if(alt)alt.setAttribute('content',lang==='en'?'es_CL':'en_US');
    // Con ?lang= la dirección canónica es la de ese idioma; sin él, la raíz.
    const canon=document.querySelector('link[rel="canonical"]'),url='https://deepterra.app/'+(fromQuery?'?lang='+fromQuery:'');
    if(canon)canon.setAttribute('href',url);const ogu=document.querySelector('meta[property="og:url"]');if(ogu)ogu.setAttribute('content',url);
    if(document.body)walk(document.body);
    for(const [n,rec] of texts){if(!n.isConnected)texts.delete(n);}
  }

  const listeners=new Set();
  function set(next,{save=false}={}){
    if(next!=='en'&&next!=='es')return;
    if(save){store.set(next);userChose=true;}
    if(next===lang){syncButtons();return;}
    lang=next;applyDocument();syncButtons();
    for(const fn of listeners){try{fn(lang);}catch{}}
    try{dispatchEvent(new CustomEvent('deepterra:lang',{detail:lang}));}catch{}
  }
  let userChose=chosen;
  function syncButtons(){for(const b of document.querySelectorAll('[data-lang-choice]'))b.setAttribute('aria-pressed',String(b.dataset.langChoice===lang));}

  window.DeepTerraI18n={
    get lang(){return lang;},
    get locale(){return lang==='en'?'en-US':'es-CL';},
    t,set,
    addRule(re,rep){rules.unshift([re,rep]);if(lang==='en'&&document.body)walk(document.body);},
    add(entries){for(const [k,v] of Object.entries(entries||{}))dict.set(k,v);dictVersion++;if(lang==='en'&&document.body)walk(document.body);},
    onChange(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  };

  function start(){
    document.documentElement.lang=lang;applyDocument();observe();syncButtons();
    document.addEventListener('click',e=>{const b=e.target.closest?.('[data-lang-choice]');if(b)set(b.dataset.langChoice,{save:true});});
    // Sin elección guardada: idioma según el país aproximado (no se guarda: se vuelve a calcular en cada visita).
    if(!userChose)fetch('/api/geo',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(geo=>{
      if(userChose||!geo?.country)return;set(SPANISH.has(geo.country)?'es':'en');
    }).catch(()=>{});
  }
  document.documentElement.lang=lang;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
