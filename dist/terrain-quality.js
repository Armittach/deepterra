/* Conservative repair of isolated negative strips in high mountain terrain. */
(function(scope){'use strict';
function suspects(dem,n=256){const result=[];for(let i=0;i<dem.length;i++){if(dem[i]>=0)continue;const x=i%n,y=Math.floor(i/n);let estimate=null;for(let d=1;d<=3&&estimate===null;d++){for(const [a,b] of [[y>=d?i-d*n:-1,y+d<n?i+d*n:-1],[x>=d?i-d:-1,x+d<n?i+d:-1]]){if(a<0||b<0)continue;const low=Math.min(dem[a],dem[b]),high=Math.max(dem[a],dem[b]);if(low>2000&&high-low<1500&&low-dem[i]>3000){estimate=(dem[a]+dem[b])/2;break;}}}if(estimate!==null)result.push({index:i,estimate});}return result;}
function repair(dem,parent,coords,parentCoords,candidates=suspects(dem)){const factor=2**(coords.z-parentCoords.z),ox=(coords.x%factor)*256/factor,oy=(coords.y%factor)*256/factor;let count=0;for(const {index,estimate} of candidates){const x=ox+((index%256)+.5)/factor-.5,y=oy+(Math.floor(index/256)+.5)/factor-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;const at=(px,py)=>parent[Math.max(0,Math.min(255,py))*256+Math.max(0,Math.min(255,px))];const value=at(x0,y0)*(1-fx)*(1-fy)+at(x0+1,y0)*fx*(1-fy)+at(x0,y0+1)*(1-fx)*fy+at(x0+1,y0+1)*fx*fy;if(value>2000&&Math.abs(value-estimate)<1000&&value-dem[index]>3000){dem[index]=value;count++;}}dem.repairedPixels=count;return count;}
// Costuras de la fuente: donde se unen los bloques de 1° × 1° (latitud o longitud enteras) algunos
// datos traen una franja angosta hundida miles de metros. Solo se revisa una banda de ~90 m a cada
// lado de esas líneas y solo se rellenan los hundimientos de más de 100 m bajo la interpolación
// entre ambos bordes. También se rellenan hoyos de un píxel más de 100 m bajo sus cuatro vecinos.
function seams(dem,coords,n=256){
  const z=coords.z,total=2**z,lat=py=>Math.atan(Math.sinh(Math.PI*(1-2*(coords.y+py/n)/total)))*180/Math.PI,lon=px=>(coords.x+px/n)/total*360-180;
  const pixel=40075016.7*Math.cos(lat(n/2)*Math.PI/180)/(n*total),band=Math.max(3,Math.min(12,Math.ceil(90/pixel)));let count=0;
  // Junto al borde del bloque se usa el único lado disponible.
  const fix=(at,crossing)=>{const a=crossing-band-1,b=crossing+band+1,lo=Math.max(0,a+1),hi=Math.min(n-1,b-1);
    for(let o=0;o<n;o++){const A=a>=0?dem[at(a,o)]:null,B=b<n?dem[at(b,o)]:null;if(A===null&&B===null)continue;
      for(let k=lo;k<=hi;k++){const i=at(k,o),L=A===null?B:B===null?A:A+(B-A)*(k-a)/(b-a);if(dem[i]<L-100){dem[i]=L;count++;}}}};
  for(let p=0;p<n;p++){
    if(Math.floor(lat(p))!==Math.floor(lat(p+1)))fix((k,o)=>k*n+o,p);
    if(Math.floor(lon(p))!==Math.floor(lon(p+1)))fix((k,o)=>o*n+k,p);
  }
  count+=lines(dem,n);
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=y*n+x,a=dem[i-1],b=dem[i+1],u=dem[i-n],v=dem[i+n];if(dem[i]<Math.min(a,b,u,v)-100){dem[i]=(a+b+u+v)/4;count++;}}
  dem.seamPixels=count;return count;
}
// Franjas rectas en cualquier lugar (uniones de otras fuentes que no caen en grados enteros): una fila
// o columna que va más de 100 m bajo el terreno a ~13 píxeles a ambos lados, de forma continua en al
// menos 96 píxeles en línea recta. Ningún cañón real es así de recto y alineado a la grilla.
function lines(dem,n=256,reach=13,run=96){
  let count=0;
  for(const vertical of [false,true]){
    const at=vertical?(k,o)=>o*n+k:(k,o)=>k*n+o,bad=new Uint8Array(n*n);
    for(let k=0;k<n;k++){let start=-1;
      for(let o=0;o<=n;o++){let flag=false;
        if(o<n){const a=k>=reach?dem[at(k-reach,o)]:null,b=k+reach<n?dem[at(k+reach,o)]:null,ref=a===null?b:b===null?a:Math.min(a,b);flag=ref!==null&&dem[at(k,o)]<ref-100;}
        if(flag&&start<0)start=o;
        if(!flag&&start>=0){if(o-start>=run)for(let j=start;j<o;j++)bad[at(k,j)]=1;start=-1;}
      }
    }
    for(let o=0;o<n;o++)for(let k=0;k<n;){
      if(!bad[at(k,o)]){k++;continue;}
      let e=k;while(e+1<n&&bad[at(e+1,o)])e++;
      const A=k>0?dem[at(k-1,o)]:null,B=e<n-1?dem[at(e+1,o)]:null;
      if(A!==null||B!==null)for(let j=k;j<=e;j++){dem[at(j,o)]=A===null?B:B===null?A:A+(B-A)*(j-k+1)/(e-k+2);count++;}
      k=e+1;
    }
  }
  return count;
}
scope.DeepTerraTerrainQuality={suspects,repair,seams,lines};
})(typeof self!=='undefined'?self:globalThis);
