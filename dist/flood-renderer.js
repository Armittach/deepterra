(function(scope){'use strict';
class FloodRenderer{
 constructor(){this.canvas=document.createElement('canvas');this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false,depth:false,stencil:false});this.records=[];this.versions=[];this.lost=false;if(!this.gl)throw Error('WebGL unavailable');this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true});this.canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.init()});this.init()}
 init(){const gl=this.gl,vertex='attribute vec2 a_position; varying vec2 v_uv; uniform vec4 u_rect; void main(){gl_Position=vec4(a_position,0.0,1.0);v_uv=u_rect.xy+vec2((a_position.x+1.0)*0.5,(1.0-a_position.y)*0.5)*u_rect.zw;}',fragment=`precision highp float;
 varying vec2 v_uv; uniform sampler2D u_ground; uniform sampler2D u_spill; uniform vec2 u_size; uniform float u_level; uniform float u_target; uniform float u_progress; uniform float u_water; uniform float u_depthColors; uniform float u_opacity; uniform float u_relief; uniform float u_contour; uniform sampler2D u_prev; uniform sampler2D u_fade; uniform vec2 u_slots;
 float meters(vec3 rgb){return dot(rgb*255.0,vec3(256.0,1.0,1.0/256.0))-32768.0;}
 vec2 tileClamp(vec2 uv){vec2 tile=floor(v_uv*u_size/256.0)*256.0;return clamp(uv,(tile+0.5)/u_size,(tile+255.5)/u_size);}
 bool wet(vec2 uv){vec4 s=texture2D(u_spill,tileClamp(uv));return s.a>0.5||u_level>meters(s.rgb)+0.00001;}
 // Umbral y suelo interpolados (bilineal) entre los 4 datos vecinos del mismo bloque: la orilla avanza de
 // forma continua dentro de cada celda, como un líquido, en vez de pintar celdas enteras de una vez.
 float limitAt(vec2 uv){vec4 s=texture2D(u_spill,tileClamp(uv));return s.a>0.5?-1.0:min(meters(s.rgb),u_target+20.0);}
 vec2 smoothField(vec2 uv){vec2 p=uv*u_size-0.5,b=floor(p),f=p-b,t=1.0/u_size;vec2 c00=(b+0.5)*t,c10=c00+vec2(t.x,0.0),c01=c00+vec2(0.0,t.y),c11=c00+t;
  float l=mix(mix(limitAt(c00),limitAt(c10),f.x),mix(limitAt(c01),limitAt(c11),f.x),f.y);
  float g=mix(mix(meters(texture2D(u_ground,tileClamp(c00)).rgb),meters(texture2D(u_ground,tileClamp(c10)).rgb),f.x),mix(meters(texture2D(u_ground,tileClamp(c01)).rgb),meters(texture2D(u_ground,tileClamp(c11)).rgb),f.x),f.y);return vec2(l,g);}
 vec3 depthColor(float d){if(d<10.0)return vec3(103.0,232.0,249.0)/255.0;if(d<50.0)return vec3(56.0,189.0,248.0)/255.0;if(d<100.0)return vec3(59.0,130.0,246.0)/255.0;if(d<500.0)return vec3(139.0,92.0,246.0)/255.0;if(d<1000.0)return vec3(217.0,70.0,239.0)/255.0;return vec3(244.0,114.0,182.0)/255.0;}
 void main(){vec4 spill=texture2D(u_spill,v_uv);vec4 groundSample=texture2D(u_ground,v_uv);bool sea=spill.a>0.5;vec2 field=smoothField(v_uv);float threshold=meters(spill.rgb);float ground=field.y;if(!sea&&threshold<u_target+20.0)threshold=field.x;vec4 color=vec4(0.0);
 // Transición: si los datos del bloque cambiaron hace poco, lo que recién pasa a inundado aparece de a poco, de lo más hondo a lo más bajo.
 float fade=texture2D(u_fade,(floor(v_uv*u_size/256.0)+0.5)/u_slots).r;if(fade<0.999&&u_level>threshold&&meters(texture2D(u_prev,v_uv).rgb)>=u_level){float depth=u_level-threshold;if(depth<(1.0-fade)*max(1.0,u_level))threshold=u_level;}
 if(u_water>0.5&&!sea&&u_level>threshold+0.00001){float depth=max(0.0,u_level-ground);float k=min(1.0,depth/max(1.0,u_target));vec3 rgb=u_depthColors>0.5?depthColor(depth):vec3(72.0-k*24.0,215.0-k*145.0,230.0)/255.0;float alpha=min(220.0,115.0+80.0*u_progress+min(25.0,depth*3.0))/255.0*u_opacity;
 // Orilla suave: en los primeros centímetros de agua el borde se funde (como agua poco profunda), sin escalones.
 alpha*=smoothstep(0.0,max(0.04,u_target*0.003),u_level-threshold);
 if(u_contour>0.5){vec2 dx=vec2(1.0/u_size.x,0.0),dy=vec2(0.0,1.0/u_size.y);float coverage=(float(wet(v_uv-dx))+float(wet(v_uv+dx))+float(wet(v_uv-dy))+float(wet(v_uv+dy)))*0.25;alpha*=0.55+0.45*coverage;
 if(u_contour>0.5&&coverage<1.0){rgb=vec3(255.0,235.0,153.0)/255.0;alpha=245.0/255.0*(0.7+0.3*coverage);}}
 color=vec4(rgb,alpha);}
 else if(u_water>0.5&&sea&&u_progress>0.0){color=vec4(28.0/255.0,148.0/255.0,190.0/255.0,u_progress*35.0/255.0*u_opacity);}
 else if(u_relief>0.5&&!sea){float light=(groundSample.a*255.0-128.0)/255.0;color=vec4(light>0.0?vec3(246.0,239.0,219.0)/255.0:vec3(17.0,31.0,37.0)/255.0,abs(light));}
 gl_FragColor=color;}`;
 const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader};this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(this.program,'a_position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);this.uniforms={};for(const name of ['ground','spill','size','level','target','progress','water','depthColors','opacity','relief','contour','prev','fade','slots','rect'])this.uniforms[name]=gl.getUniformLocation(this.program,'u_'+name);this.textures=[gl.createTexture(),gl.createTexture(),gl.createTexture(),gl.createTexture()];gl.uniform1i(this.uniforms.ground,0);gl.uniform1i(this.uniforms.spill,1);gl.uniform1i(this.uniforms.prev,2);gl.uniform1i(this.uniforms.fade,3);this.fadeStart=[];this.fadeBytes=null;this.records=[];this.versions=[];this.width=0;this.height=0;this.slotMap=new Map();this.slotRecords=[];this.groundVersions=[]}
 encode(value,out,i){let v=Math.max(0,Math.min(65535.996,Number.isFinite(value)?value+32768:65535));let whole=Math.floor(v);out[i]=Math.floor(whole/256);out[i+1]=whole%256;out[i+2]=Math.min(255,Math.round((v-whole)*256));out[i+3]=0}
 upload(record,slot,cols,groundChanged=true){const gl=this.gl,x=slot%cols*256,y=Math.floor(slot/cols)*256;
if(groundChanged){if(record.groundBytesDem!==record.dem){const ground=new Uint8Array(256*256*4),shade=DeepTerraVisuals.prepare(record);for(let i=0;i<record.dem.length;i++){this.encode(record.dem[i],ground,i*4);ground[i*4+3]=shade[i]}record.groundBytes=ground;record.groundBytesDem=record.dem}gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,256,256,gl.RGBA,gl.UNSIGNED_BYTE,record.groundBytes)}
const before=this.versions[slot]!==null&&record.spillBytes&&record.spillBytesThreshold!==record.threshold?record.spillBytes:null;
if(record.spillBytesThreshold!==record.threshold||record.spillBytesSea!==record.sea){const spill=new Uint8Array(256*256*4);for(let i=0;i<record.threshold.length;i++){this.encode(record.threshold[i],spill,i*4);spill[i*4+3]=record.sea[i]?255:0}record.spillBytes=spill;record.spillBytesThreshold=record.threshold;record.spillBytesSea=record.sea}gl.activeTexture(gl.TEXTURE0+1);gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,256,256,gl.RGBA,gl.UNSIGNED_BYTE,record.spillBytes);
// Datos anteriores del bloque (para la transición); en la primera subida, los mismos de ahora.
gl.activeTexture(gl.TEXTURE0+2);gl.bindTexture(gl.TEXTURE_2D,this.textures[2]);gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,256,256,gl.RGBA,gl.UNSIGNED_BYTE,before||record.spillBytes);this.fadeStart[slot]=before?performance.now():-Infinity}

 render(records,state){if(this.lost)return false;records=Array.from(records).filter(r=>r.live&&r.threshold&&r.dem);if(!records.length)return true;const gl=this.gl,maxCols=Math.floor(Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS))/256);if(records.length>maxCols*maxCols)return false;
if(records.length>this.slotRecords.length){const cols=Math.min(maxCols,Math.ceil(Math.sqrt(Math.max(16,records.length*1.5)))),rows=Math.min(maxCols,Math.ceil(Math.max(16,records.length*1.5)/cols));this.cols=cols;this.canvas.width=this.width=cols*256;this.canvas.height=this.height=rows*256;gl.useProgram(this.program);for(let j=0;j<3;j++){gl.activeTexture(gl.TEXTURE0+j);gl.bindTexture(gl.TEXTURE_2D,this.textures[j]);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.width,this.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null)}gl.activeTexture(gl.TEXTURE0+3);gl.bindTexture(gl.TEXTURE_2D,this.textures[3]);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);this.rows=rows;this.fadeBytes=new Uint8Array(cols*rows*4).fill(255);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,this.fadeBytes);this.fadeStart=new Array(cols*rows).fill(-Infinity);this.slotMap.clear();this.slotRecords=new Array(cols*rows).fill(null);this.versions=new Array(cols*rows).fill(null);this.groundVersions=new Array(cols*rows).fill(null)}
const current=new Set(records);for(const [r,slot] of this.slotMap)if(!current.has(r)){this.slotMap.delete(r);this.slotRecords[slot]=null;this.versions[slot]=null;this.groundVersions[slot]=null}
// Subir un bloque cuesta varios ms (codificar 2 × 65.536 celdas): se suben los que quepan en ~8 ms
// (al menos uno) y el resto queda pendiente (this.pending) para el próximo cuadro. Un bloque sin subir
// conserva lo que ya mostraba su lienzo.
const deadline=performance.now()+8,waiting=new Set();let uploaded=0;this.pending=false;
// Primero los bloques que aún no tienen nada en la GPU (si no, se verían congelados).
records.sort((a,b)=>(this.slotMap.has(a)?1:0)-(this.slotMap.has(b)?1:0));
for(const r of records){let slot=this.slotMap.get(r);if(slot===undefined){slot=this.slotRecords.indexOf(null);this.slotRecords[slot]=r;this.slotMap.set(r,slot)}if(this.versions[slot]!==r.threshold||this.groundVersions[slot]!==r.dem){if(uploaded&&performance.now()>deadline){waiting.add(r);this.pending=true;continue}this.upload(r,slot,this.cols,this.groundVersions[slot]!==r.dem);this.versions[slot]=r.threshold;this.groundVersions[slot]=r.dem;uploaded++}}
// Avance de cada transición (0 = recién cambiado, 255 = terminado): una textura chica, una celda por bloque.
const now=performance.now();let fading=false;for(let k=0;k<this.fadeStart.length;k++){const f=Math.max(0,Math.min(1,(now-this.fadeStart[k])/FloodRenderer.FADE_MS));if(f<1)fading=true;this.fadeBytes[k*4]=Math.round(f*255)}
gl.activeTexture(gl.TEXTURE0+3);gl.bindTexture(gl.TEXTURE_2D,this.textures[3]);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,this.cols,this.rows,gl.RGBA,gl.UNSIGNED_BYTE,this.fadeBytes);if(fading)this.pending=true;
// Resolución de salida: hasta 4 píxeles por dato (pantallas de alta densidad o mapa ampliado sobre zoom 15),
// con un tope de píxeles para no cargar la GPU; los datos siguen en 256 × 256 por bloque.
const limit=Math.min(gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0],gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),gl.getParameter(gl.MAX_TEXTURE_SIZE)),want=Math.max(1,Math.min(4,state.renderScale||1)),budget=Math.sqrt(14e6/(records.length*65536));
const S=Math.max(1,Math.floor(Math.min(want,budget,Math.min(limit,4096)/Math.max(this.width,this.height))*2)/2);
let S2=S;if(this.canvas.width!==Math.round(this.width*S2)||this.canvas.height!==Math.round(this.height*S2)){this.canvas.width=Math.round(this.width*S2);this.canvas.height=Math.round(this.height*S2)}
// El navegador puede dar un búfer de dibujo más chico que el lienzo pedido: entonces se baja la escala hasta que calce.
while(S2>1&&(gl.drawingBufferWidth<this.canvas.width||gl.drawingBufferHeight<this.canvas.height)){S2=Math.max(1,S2-.5);this.canvas.width=Math.round(this.width*S2);this.canvas.height=Math.round(this.height*S2)}
const outS=Math.round(256*S2);this.scale=S2;
gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.BLEND);gl.uniform2f(this.uniforms.size,this.width,this.height);gl.uniform2f(this.uniforms.slots,this.cols,this.rows);gl.uniform1f(this.uniforms.level,state.height*state.progress);gl.uniform1f(this.uniforms.target,state.height);gl.uniform1f(this.uniforms.progress,state.progress);gl.uniform1f(this.uniforms.water,state.showWater?1:0);gl.uniform1f(this.uniforms.depthColors,state.depthColors?1:0);gl.uniform1f(this.uniforms.opacity,state.waterOpacity);gl.uniform1f(this.uniforms.relief,state.showRelief?1:0);gl.uniform1f(this.uniforms.contour,state.showContour?1:0);
// Solo se dibujan los bloques en uso (el atlas puede ser mucho más grande que lo visible, p. ej. tras acercar).
const cw=this.canvas.width,ch=this.canvas.height;
for(const r of records){const slot=this.slotMap.get(r);if(slot===undefined||this.versions[slot]===null)continue;const col=slot%this.cols,row=Math.floor(slot/this.cols);
 gl.viewport(col*outS,ch-(row+1)*outS,outS,outS);gl.uniform4f(this.uniforms.rect,col*256/this.width,row*256/this.height,256/this.width,256/this.height);gl.drawArrays(gl.TRIANGLES,0,6)}
gl.viewport(0,0,cw,ch);if(gl.getError()!==gl.NO_ERROR)return false;
// Un bloque que espera su subida se sigue dibujando con sus datos anteriores (el agua sigue subiendo en él);
// solo se salta si nunca se subió (su espacio en la GPU aún no tiene datos).
this.skipped=[];for(const r of records){const slot=this.slotMap.get(r);if(waiting.has(r)&&this.versions[slot]===null){this.skipped.push(r);continue}const out=outS;if(r.canvas.width!==out){r.canvas.width=r.canvas.height=out}const ctx=r.canvas.getContext('2d');ctx.clearRect(0,0,out,out);ctx.drawImage(this.canvas,slot%this.cols*out,Math.floor(slot/this.cols)*out,out,out,0,0,out,out)}return true}

}
// Duración de la transición cuando cambian los datos de un bloque (ms).
FloodRenderer.FADE_MS=700;
scope.DeepTerraFloodRenderer=FloodRenderer;
})(typeof self!=='undefined'?self:globalThis);
