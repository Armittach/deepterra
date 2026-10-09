# Contribuir a DeepTerra

¡Gracias por tu interés! DeepTerra es un simulador visual y educativo de subida del nivel del mar, publicado bajo licencia [MIT](LICENSE).

## Cómo empezar

1. Haz un fork y crea una rama desde `main`.
2. Sirve la app localmente: `python3 -m http.server 8000 --directory dist` (o `npm run dev`).
3. Opcional: crea `dist/map-config.js` con tu clave de MapTiler (ver README). Nunca subas claves al repositorio.
4. Ejecuta las pruebas: `npm install && npm test` (y `npm run test:browser` si tocas la interfaz o el dron).
5. Abre un pull request explicando qué cambia y por qué; incluye capturas si hay cambios visuales.

## Pautas

- JavaScript sin compilación: los archivos de `dist/` se sirven tal cual.
- Mantén la app usable en escritorio y móvil.
- No agregues dependencias de servicios de pago ni claves en el código.
- Respeta las atribuciones de mapas y datos (THIRD_PARTY_NOTICES.md).
- Al contribuir aceptas que tu aporte se publique bajo la licencia MIT del proyecto.

## Reportar problemas

Abre un issue con los pasos para reproducirlo, el navegador y, si aplica, las coordenadas y el nivel del agua.
