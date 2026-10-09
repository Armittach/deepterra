/* Lucide 1.52.0 — licensed in vendor/LUCIDE-LICENSE.txt */
function setIcon(target, name) {
  const icon = lucide.icons[name];
  if (!icon) throw new Error('Unknown icon: ' + name);
  target.replaceChildren(lucide.createElement(icon, {class:'lucide',width:22,height:22,'stroke-width':1.8,'aria-hidden':'true',focusable:'false'}));
}
lucide.createIcons({attrs:{'aria-hidden':'true',focusable:'false','stroke-width':1.8}});
