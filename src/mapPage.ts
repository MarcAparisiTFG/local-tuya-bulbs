// El mapa grande de la pestaña Sitios: la zona de casa, la ruta de casa a cada sitio con su color y su tiempo, y
// encima el tráfico de TomTom (si hay clave). Es una página propia que la app mete en un WebView (o un iframe en el
// navegador); no depende de nada de React Native, así que también la puede servir el puente.

export type MapRoute = {
  name: string;
  lat: number;
  lon: number;
  /** la ruta en coche, [lat, lon] */
  shape?: [number, number][];
  label: string;
  color: string;
  logo?: string;
};

/** Un color por sitio, en el orden en que se añadieron. */
export const ROUTE_COLORS = ['#5B2EC4', '#E4572E', '#0E9F8E', '#E09A10', '#2F6FED', '#C2368F', '#6A8D00'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** `pad`: lo que tapan los paneles flotantes de la app, para encuadrar las rutas en el hueco que queda */
export function mapHtml({ home, routes, tomtomKey, pad }: { home: { lat: number; lon: number }; routes: MapRoute[]; tomtomKey?: string | null; pad?: { top: number; bottom: number } }): string {
  const data = JSON.stringify({
    home,
    key: tomtomKey ?? null,
    pad: pad ?? { top: 60, bottom: 60 },
    routes: routes.map((r) => ({ ...r, name: esc(r.name), label: esc(r.label), logo: r.logo?.startsWith('data:image/') ? r.logo : undefined })),
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#m{margin:0;height:100%;background:#F4F0FA;font-family:-apple-system,system-ui,sans-serif}
.leaflet-container{background:#E9E4F2}
.tag{display:inline-flex;align-items:center;gap:6px;background:#fff;color:#17131F;font-weight:700;font-size:13px;padding:6px 10px 6px 8px;border-radius:14px;white-space:nowrap;box-shadow:0 4px 14px rgba(40,20,80,.18);transform:translate(-50%,-140%)}
.tag i{width:10px;height:10px;border-radius:5px;display:inline-block}
.tag img{width:18px;height:18px;border-radius:5px;object-fit:contain;background:#fff}
.tag b{font-weight:800}
.home{background:#17131F;color:#fff}
.dot{width:14px;height:14px;border-radius:7px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:translate(-50%,-50%)}
.leaflet-control-attribution{font-size:9px;opacity:.7}
</style></head><body><div id="m"></div><script>
const D=${data};
const m=L.map('m',{zoomControl:false,attributionControl:true,zoomSnap:0.25});
// con clave de TomTom, su mapa y la capa de tráfico; sin ella, el de OpenStreetMap (CARTO ya pide clave)
if(D.key){
  L.tileLayer('https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key='+D.key,{maxZoom:18,attribution:'© TomTom'}).addTo(m);
  const flow=()=>'https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key='+D.key+'&t='+Date.now();
  const f=L.tileLayer(flow(),{maxZoom:18,opacity:0.85,zIndex:3}).addTo(m);
  // las carreteras se vuelven a pedir cada cuarto de hora (cada vez son unas pocas teselas)
  setInterval(()=>f.setUrl(flow()),900000);
}else{
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
}
const pts=[[D.home.lat,D.home.lon]];
const tag=(lat,lon,html,cls)=>L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<span class="tag '+(cls||'')+'">'+html+'</span>',iconSize:[0,0]}),zIndexOffset:1000}).addTo(m);
const dot=(lat,lon,color)=>L.marker([lat,lon],{icon:L.divIcon({className:'',html:'<div class="dot" style="background:'+color+'"></div>',iconSize:[0,0]})}).addTo(m);
D.routes.forEach((r)=>{
  if(r.shape&&r.shape.length>1){
    // la ruta con un borde blanco, para que se lea encima del tráfico
    L.polyline(r.shape,{color:'#fff',weight:9,opacity:0.9,lineCap:'round',lineJoin:'round'}).addTo(m);
    L.polyline(r.shape,{color:r.color,weight:5,opacity:0.95,lineCap:'round',lineJoin:'round'}).addTo(m);
    r.shape.forEach((p)=>pts.push(p));
  }
  dot(r.lat,r.lon,r.color);
  tag(r.lat,r.lon,'<i style="background:'+r.color+'"></i>'+(r.logo?'<img src="'+r.logo+'">':'')+r.name+' · <b>'+r.label+'</b>');
  pts.push([r.lat,r.lon]);
});
dot(D.home.lat,D.home.lon,'#17131F');
tag(D.home.lat,D.home.lon,'Casa','home');
// se encuadra cuando el mapa ya tiene su tamaño (dentro de la app tarda un instante)
const frame=()=>{m.invalidateSize();m.fitBounds(pts,{paddingTopLeft:[50,D.pad.top],paddingBottomRight:[50,D.pad.bottom],maxZoom:14});setTimeout(spread,50);};
// las etiquetas de sitios cercanos se pisan: de arriba abajo, la que choca con otra sube hasta que cabe, con una
// rayita hasta su punto
function spread(){
  const items=[...document.querySelectorAll('.tag')].map((t)=>{t.style.transform='';return t;}).map((t)=>({t,r:t.getBoundingClientRect(),dy:0}));
  items.sort((a,b)=>b.r.top-a.r.top);
  for(let pass=0;pass<12;pass++){
    let moved=false;
    for(let i=1;i<items.length;i++)for(let j=0;j<i;j++){
      const a=items[j],b=items[i];
      const at=a.r.top-a.dy,ab=a.r.bottom-a.dy,bt=b.r.top-b.dy,bb=b.r.bottom-b.dy;
      if(b.r.left<a.r.right+4&&b.r.right>a.r.left-4&&bt<ab+4&&bb>at-4){b.dy+=bb-at+4;moved=true;}
    }
    if(!moved)break;
  }
  // con transform y no con margen: a un elemento en línea el margen apenas lo mueve
  items.forEach((x)=>{if(x.dy)x.t.style.transform='translate(-50%,calc(-140% - '+x.dy+'px))';});
}
m.on('zoomend moveend',spread);
frame();setTimeout(frame,250);addEventListener('resize',frame);
</script></body></html>`;
}
