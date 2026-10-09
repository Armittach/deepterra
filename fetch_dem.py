import urllib.request,concurrent.futures,io,json,math
from PIL import Image
from pathlib import Path
p=Path(__file__).resolve().parent / 'dist'; z=12;x0=1235;y0=2403;n=4

def get(t):
 x,y=t
 for i in range(3):
  try:
   req=urllib.request.Request(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',headers={'User-Agent':'DeepTerra educational terrain viewer'})
   return x,y,Image.open(io.BytesIO(urllib.request.urlopen(req,timeout=30).read())).convert('RGB')
  except Exception:
   if i==2: raise
m=Image.new('RGB',(n*256,n*256))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 for x,y,im in ex.map(get,[(x,y) for x in range(x0,x0+n) for y in range(y0,y0+n)]):m.paste(im,((x-x0)*256,(y-y0)*256))
m=m.resize((512,512),Image.Resampling.NEAREST);m.save(p/'dem.png')
meta={'z':z,'x0':x0,'y0':y0,'tiles':n,'size':512,'source':'Mapzen / Tilezen Terrain Tiles, AWS Open Data','downloaded':'2026-10-06'}
(p/'terrain.json').write_text(json.dumps(meta));print('Downloaded all 16 real elevation tiles')
