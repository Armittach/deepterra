/* Display-only terrain lighting; sea connectivity stays in flood-model.js. */
(function(scope){'use strict';
function prepare(record){if(record.shadeDem===record.dem&&record.shade)return record.shade;const dem=record.dem,n=256,shade=new Uint8Array(dem.length),z=record.coords.z,lat=Math.atan(Math.sinh(Math.PI*(1-2*(record.coords.y+.5)/2**z))),cell=Math.max(.1,40075016.686*Math.cos(lat)/(256*2**z));
for(let i=0;i<dem.length;i++){const x=i%n,y=i>>8,l=dem[x?i-1:i],r=dem[x<255?i+1:i],t=dem[y?i-256:i],b=dem[y<255?i+256:i],dx=(r-l)/(cell*(x===0||x===255?1:2)),dy=(b-t)/(cell*(y===0||y===255?1:2)),norm=Math.sqrt(dx*dx+dy*dy+1);const nx=-dx/norm,ny=-dy/norm,nz=1/norm;
const nw=Math.max(0,-.5*nx-.5*ny+Math.SQRT1_2*nz),west=Math.max(0,-Math.SQRT1_2*nx+Math.SQRT1_2*nz),ne=Math.max(0,.5*nx-.5*ny+Math.SQRT1_2*nz),light=.5*nw+.3*west+.2*ne;shade[i]=Math.round(128+255*Math.max(-.48,Math.min(.23,(light-Math.SQRT1_2)*1.35)))}record.shadeDem=dem;record.shade=shade;return shade}
scope.DeepTerraVisuals={prepare};
})(typeof self!=='undefined'?self:globalThis);
