# Dron 3D · prototipo local

Rama: `feature/drone-3d`. No está fusionada con `main` ni publicada en GitHub Pages. El flujo de Pages solo permite publicar `main`, incluso cuando se ejecuta manualmente.

## Abrir

Con Node.js instalado, desde esta carpeta:

```sh
node serve.mjs
```

Abrir http://localhost:8766. También puede utilizarse `python -m http.server 8766 --directory dist`. Hace falta Internet para descargar la elevación detallada y el mapa base. Three.js, Lucide, Leaflet y las grillas globales están incluidos localmente.

## Abrir desde el celular

Ejecuta `Iniciar-DeepTerra-Red.cmd` y abre `http://192.168.1.100:8777/` desde un celular conectado al mismo router. Esta dirección corresponde a este PC y puede cambiar si el router le asigna otra IP. Mantén el servidor y el PC encendidos. El puerto solo se habilita para la red privada local.

## Colocar el dron

El botón redondo con icono de dron está debajo de la gota de transparencia. Arrástralo y suéltalo sobre el mapa. Durante el arrastre queda un círculo punteado en su lugar. Al devolverlo a menos de 86 píxeles de su centro, regresa a su posición y no abre la vista. Escape también cancela. Hay una tolerancia adicional de 240 ms para una devolución reciente.

También se puede pulsar el botón y después tocar un punto del mapa. Con teclado, pulsar el botón y Enter elige el centro. Una liberación sobre un control, fuera del mapa o después de perder el foco cancela el arrastre.

## Volar

| Acción | Control |
| --- | --- |
| Avanzar, retroceder y desplazarse lateralmente | WASD o flechas |
| Mirar alrededor | Arrastrar la vista con mouse o dedo |
| Bajar o subir | Q / E, o cambiar la altura |
| Velocidad | Campo de 1 a 1.000 m/s; inicial 300 m/s |
| Altura | Campo de 2 a 2000 m sobre el terreno; inicial 60 m |
| Iniciar o pausar la simulación | Enter, Espacio o Play de la barra inferior |
| Volver al mapa | Escape o X |

La altura sigue el relieve mientras se vuela. Sobre el océano se mide desde el nivel del mar inicial, no desde el fondo marino ni desde el agua que va subiendo. El agua puede alcanzar al dron; la pantalla indica cuándo está bajo el agua. La velocidad diagonal se normaliza y el vuelo se detiene al perder el foco para evitar teclas atascadas. En móvil hay dos joysticks analógicos simultáneos: el izquierdo desplaza el dron y el derecho gira la cámara. Regresan al centro al soltar, cancelar o perder el foco.

Al entrar se conserva el estado de reproducción y su progreso; si está en Play, sigue avanzando durante la carga y el vuelo. La barra inferior permanece visible. Al salir se conservan altura máxima, duración, progreso y estado de reproducción. El mapa vuelve a la posición actual del dron con el mismo detalle usado por el dron.

## Relieve y agua sincronizados

La vista usa los mismos bloques Terrarium y la misma instancia `DeepTerraFloodNetwork` del mapa. No calcula otra inundación por separado: reutiliza la elevación, las cotas de conexión con el océano, las barreras y las actualizaciones entre bloques. El agua se dibuja en una celda solo si es océano o si el nivel supera su cota de conexión, con la misma tolerancia que el mapa. Una depresión aislada no se llena solo por estar debajo del nivel simulado.

El nivel del agua, la transparencia, los colores de profundidad y el contorno se leen del estado común. Los umbrales detallados que siguen actualizándose se copian a las texturas 3D. Los controles de capas se eligen en el mapa antes de entrar. La geometría visual interpola el terreno entre muestras, y se conserva la clasificación de inundación original por celda.

## Alcance del prototipo

- Área de hasta 7 × 7 bloques alrededor del punto elegido, a nivel de detalle 14. Se entra con los 5 × 5 centrales y el anillo exterior se carga después, con menos detalle (24 segmentos por lado). En Coquimbo abarca aproximadamente 14,8 km por lado. Alrededor se cargan, en orden y en segundo plano, dos anillos lejanos con menos detalle: nivel 12 (bloques de 4 × 4 de nivel 14) en una ventana de 5 × 5, unos 42 km por lado en Coquimbo, y nivel 10 (bloques de 16 × 16) en una ventana de 7 × 7, unos 235 km por lado, es decir, alrededor de 100 km de visión en cada dirección (5 × 5 y unos 85 km en pantallas táctiles; 3 × 3 en equipos modestos, según memoria, núcleos y GPU). Si el vuelo baja de unos 18 cuadros por segundo de forma sostenida, el anillo más lejano se achica y, si hace falta, se quita. Cada anillo se recorta donde ya hay uno más detallado y usa la misma simulación de agua. El relieve se curva según la Tierra (a 100 km el suelo cae unos 785 m) y la profundidad usa Z invertido (o logarítmica si la GPU no lo admite) para evitar parpadeos a distancia. La ventana se desplaza durante el vuelo: conserva los bloques compartidos, carga los nuevos y libera los anteriores. Si la descarga se retrasa, el dron espera en el borde disponible.
- Malla de 128 segmentos por lado en los bloques cercanos, 64 en el segundo anillo y 24 en el exterior, con muestras de elevación de 256 × 256. La resolución real y precisión dependen de la fuente y pueden ser menores; se informa si se utilizan bloques de menor resolución.
- Proyección local en metros, con corrección de escala por latitud y soporte del cruce de 180°. La cobertura es la misma Mercator del mapa, sin polos.
- Requiere WebGL 2; el mapa 2D conserva su alternativa Canvas. No hay modelos de edificios, árboles, colisiones con objetos ni dinámica de olas o corrientes.
- Relieve esquemático coloreado, sin fotografía ni texturas urbanas. El océano se dibuja incluso con progreso cero. Los fondos oceánicos exactamente a cero se bajan 1 m únicamente en la malla visual para evitar parpadeo; los datos de inundación no cambian.
- Objetivo de 30 FPS, resolución de pantalla limitada a 1,5×. La fluidez y el rendimiento móvil deben comprobarse en los dispositivos que se usarán.

## Pruebas

Sin instalar dependencias:

```sh
node --test tests/drone.test.mjs
```

Las pruebas cubren proyección, límites polares, cruce de 180°, continuidad del terreno entre bloques, depresiones aisladas, umbrales de inundación, cancelación del arrastre, velocidad diagonal y límites del vuelo.

Para la prueba automatizada de navegador local, instalar las dependencias de desarrollo con `npm install`, abrir `npm run dev` en otra terminal y ejecutar `npm run test:browser`. Usa una instalación local de Chrome y un perfil descartable en `test-results/`, sin utilizar cuentas ni perfiles personales. Puede elegirse Edge con `DRONE_TEST_CHANNEL=msedge` o un puerto distinto con `DRONE_TEST_URL`.

La prueba abre una costa real de Coquimbo, comprueba devolución al placeholder, drag-and-drop, carga de relieve, estado común del agua, parámetros, vuelo, Enter/Espacio, salida, nueva entrada, cancelación de carga y controles en un contexto táctil de 390 × 844. Guarda capturas de escritorio y móvil. La prueba de conectividad de cuencas utiliza datos deterministas y el cálculo real de DeepTerra.

## Archivos nuevos

- `dist/drone.js`: interacción, vista 3D, controles, materiales y recursos.
- `dist/drone-math.mjs`: proyección, muestreo, límites y reglas de cancelación.
- `dist/ui.css`: estilos del botón, la vista 3D, la telemetría y los controles táctiles (junto con el resto de la interfaz).
- `dist/vendor/three.*.min.js` y `THREE-LICENSE.txt`: Three.js 0.180.0, MIT.
- `tests/`: pruebas unitarias y de navegador.
- `serve.mjs`: servidor de archivos para las pruebas locales.

Para integrar más adelante, revisar el prototipo y crear una solicitud de cambios. No se requiere revertir ningún despliegue porque la web pública no se sustituye.

La capa permanece visible al navegar, como en main: cada bloque utiliza el terreno ya disponible mientras llega su detalle. Los bloques anteriores se mantienen hasta que el reemplazo está calculado y pintado, antes de marcarlo como listo. No se oculta la capa completa durante las descargas. Las descargas canceladas por un cambio de zoom se reanudan si el bloque vuelve a ser visible. El renderizador también verifica los límites de tamaño y errores de GPU para recurrir a Canvas cuando corresponde.

La entrada 3D muestra una pantalla opaca con indicador animado, progreso por bloques y cancelación hasta dibujar el primer fotograma completo.

`tests/map-navigation-browser.mjs` reproduce navegación animada con descargas retrasadas durante la reproducción, en escritorio y contexto táctil, con GPU y con Canvas. Verifica que la capa conserve opacidad y píxeles durante todos los muestreos, incluidos bloques provisionales.

En móvil, mantener las flechas de altura sube o baja el dron hasta soltar; la velocidad de ascenso/descenso se ajusta en Ajustes de vuelo (1 a 1.000 m/s; inicial 150 m/s) y la altura a 2.000 m. Ir/Enter confirma cada campo y quita su foco sin reproducir. Play quita el foco de los campos antes de iniciar o pausar, para cerrar el teclado.

La pantalla de vuelo muestra coordenadas del dron, rumbo, altura sobre terreno, altitud sobre el mar, velocidad de desplazamiento, cota del terreno, nivel simulado del agua y distancia vertical al agua. La velocidad indicada es el movimiento actual, no el límite configurado. El engranaje abre los ajustes, cerrados de inicio. La barra de simulación oculta solo en 3D los datos del cursor del mapa.

La telemetría se sitúa justo encima de la barra, con coordenadas incluidas. Arriba permanecen el rumbo y las coordenadas. En móvil la telemetría se sitúa encima de los joysticks y estos encima de la barra. En ajustes hay interruptores independientes para ocultar telemetría (incluidos rumbo y coordenadas) y controles táctiles (joysticks y flechas de altura). Ocultar controles detiene el movimiento de esos controles. La selección se conserva entre entradas al dron durante la misma sesión.

La opción de joysticks se oculta en dispositivos con puntero preciso. En móvil se intenta fijar la orientación vertical. Si el navegador lo rechaza, una pantalla bloquea el uso en horizontal y ofrece intentar fijar vertical en pantalla completa. Se utiliza la orientación física de la pantalla, para no bloquear cuando se abre el teclado. Restricciones: https://www.w3.org/TR/screen-orientation/ .

Estar bajo el agua no muestra un aviso de error. Se conserva la información de altura y distancia al agua, así como la apariencia submarina.

El control de altura móvil es un deslizador vertical proporcional a la derecha de la telemetría. Arrastrar hacia arriba asciende; hacia abajo desciende. Soltar, cancelar o perder foco devuelve el control al centro y detiene el movimiento vertical. La telemetría se centra por columna.

Elevación: se detectó una franja anómala en los PNG Terrarium originales alrededor del Everest (z14, x12146–12150, y6863). Valores negativos aislados entre terreno superior a 2.000 m se reemplazan solo si el bloque padre confirma terreno alto y concuerda con los vecinos. Los demás valores, incluidos fondos oceánicos y depresiones corroboradas, no cambian. El DEM saneado alimenta tanto iluminación y malla como el cálculo compartido de inundación. Es una aproximación local de menor resolución; no recupera una medición nueva.
