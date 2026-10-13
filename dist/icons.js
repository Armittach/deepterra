/* Lucide 1.52.0 — licensed in vendor/LUCIDE-LICENSE.txt */
/* Dron propio (cuadricóptero visto de frente: hélices, brazos, cuerpo y patas), con el mismo trazo
   que Lucide (24×24, puntas redondas). Reemplaza al «drone» de Lucide, que visto desde arriba no se
   reconoce bien. Diseño original de DeepTerra, misma licencia que el resto de la app. */
const DRONE_ICON = [
  ['path', {d: 'M2 6.5h7M15 6.5h7'}],
  ['path', {d: 'M5.5 6.5v4h3M18.5 6.5v4h-3'}],
  ['rect', {x: '8.5', y: '8.5', width: '7', height: '5.5', rx: '2'}],
  ['path', {d: 'm10 14-2 4M14 14l2 4M6 18h4M14 18h4'}]
];
// lucide.icons viene congelado: se reemplaza por una copia que trae el dron propio (app.js y
// drone.js leen lucide.icons.Drone) y se pasa explícitamente a createIcons.
lucide.icons = Object.freeze({...lucide.icons, Drone: DRONE_ICON});
function setIcon(target, name) {
  const icon = lucide.icons[name];
  if (!icon) throw new Error('Unknown icon: ' + name);
  // Si ya muestra ese ícono no se reemplaza: cambiar el dibujo bajo el dedo hace que el navegador pierda el clic.
  if (target.__icon === name && target.firstElementChild) return;
  target.__icon = name;
  target.replaceChildren(lucide.createElement(icon, {class:'lucide',width:22,height:22,'stroke-width':1.8,'aria-hidden':'true',focusable:'false'}));
}
lucide.createIcons({icons:lucide.icons,attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});
