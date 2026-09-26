/* =========================================================
   CROWDED MARKET — engine: renderer, the board camera, toon
   materials with ink outlines, and small mesh helpers (the same
   look as Whereabouts, whose Wanderbeans live on here).
   ========================================================= */
const $=s=>document.querySelector(s);
const V3=THREE.Vector3;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
const damp=(k,dt)=>1-Math.exp(-k*dt);
const angLerp=(a,b,t)=>{const d=((b-a+Math.PI)%TAU+TAU)%TAU-Math.PI;return a+d*t;};
const pick=a=>a[Math.floor(Math.random()*a.length)];

const canvas=$('#c');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}
catch(e){$('#nogl').hidden=false;$('#loading').hidden=true;return;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color('#9FD8E8');

/* ---------- the camera: fixed, tilted down over the whole board ---------- */
const camera=new THREE.PerspectiveCamera(30,window.innerWidth/window.innerHeight,1,400);
const CAM={tilt:57*Math.PI/180,target:new V3(0,0,0.6)};
// back the camera off until the whole board (with a margin) is on screen, whatever the window's shape
function fitCamera(){
  const B=CM_TUNE.BOARD,pts=[];
  for(const x of[B.x0-0.6,B.x1+0.6])for(const z of[B.z0-1.6,B.z1+1])for(const y of[0,2.4])pts.push(new V3(x,y,z));
  const dir=new V3(0,Math.sin(CAM.tilt),Math.cos(CAM.tilt));
  const fits=d=>{camera.position.copy(CAM.target).addScaledVector(dir,d);camera.lookAt(CAM.target);camera.updateMatrixWorld();
    return pts.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<=0.98&&q.y<=0.9&&q.y>=-0.98;});};
  let lo=10,hi=300;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(fits(m))hi=m;else lo=m;}
  fits(hi);
}

/* ---------- lights: a warm morning ---------- */
const hemi=new THREE.HemisphereLight(0xCFE2FF,0xF6B98C,0.72);
scene.add(hemi);
const SUN_DIR=new V3(-0.45,0.8,0.4).normalize();
const sun=new THREE.DirectionalLight(0xFFE8C0,1.0);
sun.position.copy(SUN_DIR).multiplyScalar(80);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
{const c=sun.shadow.camera;c.left=-40;c.right=40;c.top=40;c.bottom=-40;c.near=10;c.far=200;}
sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;
scene.add(sun,sun.target);

/* ---------- toon materials + ink outlines ---------- */
const gradTex=(()=>{
  const d=new Uint8Array([112,112,112,255, 188,188,188,255, 255,255,255,255]);
  const t=new THREE.DataTexture(d,3,1,THREE.RGBAFormat);
  t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;
})();
const matCache=new Map();
function M(color){
  const k=String(color);
  if(!matCache.has(k))matCache.set(k,new THREE.MeshToonMaterial({color,gradientMap:gradTex}));
  return matCache.get(k);
}
function MT(map,extra){return new THREE.MeshToonMaterial(Object.assign({map,gradientMap:gradTex},extra||{}));}
const INK=new THREE.MeshBasicMaterial({color:0x2B2040,side:THREE.BackSide});
const GOLD=new THREE.MeshBasicMaterial({color:0xFFD23F,side:THREE.BackSide});

function outline(mesh,w){
  const g=mesh.geometry;
  if(!g.boundingBox)g.computeBoundingBox();
  const s=new V3(),c=new V3();
  g.boundingBox.getSize(s);g.boundingBox.getCenter(c);
  const o=new THREE.Mesh(g,INK);
  const sx=(s.x+2*w)/Math.max(s.x,1e-3),sy=(s.y+2*w)/Math.max(s.y,1e-3),sz=(s.z+2*w)/Math.max(s.z,1e-3);
  o.scale.set(s.x<1e-3?1:sx,s.y<1e-3?1:sy,s.z<1e-3?1:sz);
  o.position.set(c.x*(1-o.scale.x),c.y*(1-o.scale.y),c.z*(1-o.scale.z));
  o.userData.isOutline=true;
  o.raycast=()=>{};
  mesh.add(o);
  return o;
}
function mk(geo,color,opt){
  opt=opt||{};
  const m=new THREE.Mesh(geo,opt.mat||M(color));
  if(!geo.boundingBox)geo.computeBoundingBox();
  const s=new V3();geo.boundingBox.getSize(s);
  m.castShadow=opt.shadow!==undefined?opt.shadow:Math.max(s.x,s.y,s.z)>0.45;
  m.receiveShadow=true;
  if(opt.ol!==false)outline(m,opt.w!==undefined?opt.w:0.045);
  return m;
}
const box=(w,h,d,c,o)=>mk(new THREE.BoxGeometry(w,h,d),c,o);
const cyl=(rt,rb,h,c,seg,o)=>mk(new THREE.CylinderGeometry(rt,rb,h,seg||10),c,o);
const sph=(r,c,ws,hs,o)=>mk(new THREE.SphereGeometry(r,ws||10,hs||8),c,o);
const cone=(r,h,c,seg,o)=>mk(new THREE.ConeGeometry(r,h,seg||10),c,o);
const cap=(r,l,c,o)=>mk(new THREE.CapsuleGeometry(r,l,4,10),c,o);
function at(m,x,y,z){m.position.set(x,y,z);return m;}
function rot(m,x,y,z){m.rotation.set(x||0,y||0,z||0);return m;}
function scl(m,x,y,z){m.scale.set(x,y===undefined?x:y,z===undefined?x:z);return m;}
function grp(){const g=new THREE.Group();for(const c of arguments)g.add(c);return g;}
function prismGeo(w,h,d){
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.lineTo(-w/2,0);
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return g;
}
function canvasTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d');if(x)draw(x,w,h);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}
function rrect(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}
function signTex(text,bg,fg,w,h){
  return canvasTex(w||512,h||128,(x,W,H)=>{
    x.fillStyle=bg;x.fillRect(0,0,W,H);
    x.strokeStyle='#2B2040';x.lineWidth=10;x.strokeRect(5,5,W-10,H-10);
    x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';
    let fs=H*0.52;x.font=`${fs}px "Lilita One", "Arial Rounded MT Bold", sans-serif`;
    while(x.measureText(text).width>W*0.86&&fs>10){fs-=2;x.font=`${fs}px "Lilita One", sans-serif`;}
    x.fillText(text,W/2,H/2+3);
  });
}
function stripeTex(a,b,n){
  return canvasTex(128,32,(x,W,H)=>{const sw=W/n;for(let i=0;i<n;i++){x.fillStyle=i%2?b:a;x.fillRect(i*sw,0,sw+1,H);}});
}
function signBox(text,w,h,bg,fg){
  const t=signTex(text,bg,fg,512,Math.round(512*h/w));
  const side=M(bg);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,0.15),[side,side,side,side,MT(t),side]);
  m.castShadow=true;outline(m,0.04);return m;
}

/* ---------- little bursts of confetti (sales, the closing bell, ride tricks) ---------- */
const FX={bits:[],geo:new THREE.BoxGeometry(0.12,0.12,0.02),mats:['#FF5D73','#FFD23F','#3DDC97','#4D96FF','#F15BB5','#FF9F1C'].map(c=>new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}))};
function burst(p,n){
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(FX.geo,pick(FX.mats));m.position.copy(p);scene.add(m);
    const a=Math.random()*TAU,s=2+Math.random()*4;
    FX.bits.push({m,v:new V3(Math.cos(a)*s,5+Math.random()*5,Math.sin(a)*s),spin:new V3(Math.random()*9,Math.random()*9,0),life:1.4+Math.random()*0.6});
  }
}
function fxTick(dt){
  for(let i=FX.bits.length-1;i>=0;i--){const b=FX.bits[i];b.life-=dt;b.v.y-=14*dt;b.m.position.addScaledVector(b.v,dt);
    b.m.rotation.x+=b.spin.x*dt;b.m.rotation.y+=b.spin.y*dt;
    if(b.life<=0||b.m.position.y<-0.5){scene.remove(b.m);FX.bits.splice(i,1);}}
}
