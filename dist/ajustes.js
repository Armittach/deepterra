/* Ajustes de la vista dron. Cambia los números y guarda; al recargar la página se usan los nuevos.
   Si un valor no es un número o se sale del rango [mín – máx], se usa el valor por omisión o el límite
   más cercano (el panel dev, sección «Dron», muestra los ajustes activos y lo que se corrigió).
   Guía: docs/ajustes.md */
window.DeepTerraAjustes = Object.freeze({
  dron: {
    // Distancia de dibujo: hasta dónde se ve el terreno, en km. [20 – 150] · por omisión 80.
    // Más lejos = más datos y más trabajo para la tarjeta gráfica. Los equipos modestos se limitan solos
    // (~40 km en equipos básicos, ~85 km en celulares y tablets).
    distanciaDibujoKm: 80,
    // Velocidad con la que parte el dron, en m/s. [1 – velocidadMaxima] · por omisión 300.
    velocidadInicial: 300,
    // Velocidad máxima que se puede elegir en «Ajustes de vuelo», en m/s. [50 – 3000] · por omisión 1000.
    velocidadMaxima: 1000,
    // Velocidad de subida y bajada (Q/E o control de altura), en m/s. [1 – velocidadMaxima] · por omisión 150.
    subida: 150,
    // Altura inicial sobre el terreno, en m. [2 – 2000] · por omisión 60.
    alturaInicial: 60,
    // Altitud inicial en el modo «altitud fija» (sobre el nivel del mar), en m. [2 – alturaFijaMax] · por omisión 600.
    alturaFijaInicial: 600,
    // Altitud máxima del modo «altitud fija», en m. [500 – 20000] · por omisión 9000.
    alturaFijaMax: 9000,
    // Campo de visión de la cámara, en grados (más = más «gran angular»). [40 – 100] · por omisión 65.
    campoVision: 65,
    // Cuadros por segundo máximos. [15 – 144] · por omisión 30. Más = más fluido, pero más calor y batería.
    cuadrosMaximos: 30,
    // Nitidez máxima en pantallas de alta densidad (1 = normal, 2 = máxima). [0,5 – 2] · por omisión 1,5.
    resolucionMaxima: 1.5,
    // Sensibilidad al mirar arrastrando con el ratón o el dedo (1 = normal). [0,2 – 3] · por omisión 1.
    sensibilidadMirar: 1
  },
  niebla: {
    // Dónde empieza la bruma, como fracción de la distancia de dibujo (0,25 = a un cuarto). [0 – 0,9] · por omisión 0,25.
    inicio: 0.25,
    // Dónde la bruma tapa todo, como fracción de la distancia de dibujo (1 = justo en el límite). [0,5 – 1] · por omisión 1.
    fin: 1
  },
  carga: {
    // Espera máxima de la pantalla de carga una vez listo el relieve, en segundos: después se muestra
    // la vista aunque falte detalle (que sigue llegando). [2 – 30] · por omisión 8.
    esperaMaximaS: 8,
    // Duración del fundido al aparecer la vista, en milisegundos (0 = sin fundido). [0 – 3000] · por omisión 600.
    fundidoMs: 600
  }
});
