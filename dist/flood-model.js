/* Minimum sea-connected water level for each terrain cell. */
(function(scope){'use strict';
function solve(dem,globalSpill,n=256){const size=n*n,threshold=new Float32Array(size);threshold.fill(Infinity);const sea=new Uint8Array(size),queue=new Int32Array(size);let head=0,tail=0;const around=(i,visit)=>{let x=i%n,y=i/n|0;if(x)visit(i-1);if(x<n-1)visit(i+1);if(y)visit(i-n);if(y<n-1)visit(i+n)};for(let i=0;i<size;i++)if(dem[i]<=0&&globalSpill[i]===0){sea[i]=1;queue[tail++]=i}while(head<tail){let i=queue[head++];around(i,j=>{if(!sea[j]&&dem[j]<=0){sea[j]=1;queue[tail++]=j}})}
let heapIndex=new Int32Array(size),heapHeight=new Float64Array(size),heapLength=0;
function push(i,h){if(heapLength===heapIndex.length){const indices=new Int32Array(heapLength*2),heights=new Float64Array(heapLength*2);indices.set(heapIndex);heights.set(heapHeight);heapIndex=indices;heapHeight=heights}let pos=heapLength++;while(pos){const p=(pos-1)>>1;if(heapHeight[p]<=h)break;heapIndex[pos]=heapIndex[p];heapHeight[pos]=heapHeight[p];pos=p}heapIndex[pos]=i;heapHeight[pos]=h}
let poppedIndex=0,poppedHeight=0;
function pop(){poppedIndex=heapIndex[0];poppedHeight=heapHeight[0];const length=--heapLength;if(!length)return;const lastIndex=heapIndex[length],lastHeight=heapHeight[length];let p=0;while(p*2+1<length){let c=p*2+1;if(c+1<length&&heapHeight[c+1]<heapHeight[c])c++;if(heapHeight[c]>=lastHeight)break;heapIndex[p]=heapIndex[c];heapHeight[p]=heapHeight[c];p=c}heapIndex[p]=lastIndex;heapHeight[p]=lastHeight}
function seed(i,h){h=Math.max(0,h,dem[i]);if(h<threshold[i]){threshold[i]=h;push(i,h)}}
for(let i=0;i<size;i++)if(sea[i])threshold[i]=0;
for(let i=0;i<size;i++)if(sea[i])around(i,j=>{if(!sea[j])seed(j,dem[j])});
for(let k=0;k<n;k++)for(const i of [k,(n-1)*n+k,k*n,k*n+n-1])seed(i,globalSpill[i]);
while(heapLength){pop();const i=poppedIndex,h=poppedHeight;if(h!==threshold[i])continue;around(i,j=>seed(j,h))}
return {threshold,sea}}
scope.DeepTerraFlood={solve};
})(typeof self!=='undefined'?self:globalThis);
