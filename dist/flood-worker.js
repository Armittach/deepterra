importScripts('flood-model.js?v=20261006-26');
onmessage=e=>{const {id,dem,spill}=e.data;try{const result=DeepTerraFlood.solve(new Float32Array(dem),new Float32Array(spill));postMessage({id,threshold:result.threshold.buffer,sea:result.sea.buffer},[result.threshold.buffer,result.sea.buffer])}catch(error){postMessage({id,error:error.message})}};
