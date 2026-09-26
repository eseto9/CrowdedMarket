/* =========================================================
   Wanderbeans
   (Copied from Whereabouts, the co-op I spy game on the same island.)
   ========================================================= */
const BEAN_COLORS=['#FF5D73','#FF9F1C','#FFD23F','#3DDC97','#2EC4B6','#4D96FF','#9B5DE5','#F15BB5'];
// Outfits: a top and bottoms (any cloth color and pattern), shoes, one extra, and something to ride.
// Everything not in the starter set is sold in the shop (see PRICES).
const CLOTH_COLORS=['#FFFFFF','#2B2040','#FF5D73','#FF9F1C','#FFD23F','#3DDC97','#4D96FF','#9B5DE5'];
const TOPS=[['none','Nothing',''],['tee','Tee','👕'],['hoodie','Hoodie','🧥'],['sweater','Sweater','🧶'],['raincoat','Raincoat','☔'],['puffer','Puffer jacket','🧣'],
  ['hawaii','Flower shirt','🌺'],['varsity','Varsity jacket','🏈'],['tux','Tuxedo','🤵'],['cape','Hero cape','🦸'],['space','Space suit','🧑‍🚀'],['armor','Knight armor','🛡️'],['dino','Dino suit','🦖'],['detective','Detective coat','🕵️'],['ninja','Ninja suit','🥷']];
const BOTTOMS=[['none','Nothing',''],['shorts','Shorts','🩳'],['pants','Pants','👖'],['skirt','Skirt','👗'],['overalls','Overalls','🧑‍🌾'],['tutu','Tutu','🩰'],['hula','Grass skirt','🌴']];
const SHOES=[['plain','Bare feet',''],['sneakers','Sneakers','👟'],['boots','Boots','🥾'],['flippers','Flippers','🤿'],['cowboy','Cowboy boots','🤠'],['bunny','Bunny slippers','🐰'],
  ['rollers','Roller skates','🛼'],['glow','Light-up sneakers','✨'],['rocket','Rocket boots','🚀'],['gold','Golden sneakers','🌟']];
const PATTERNS=[['solid','Plain'],['stripes','Stripes'],['dots','Dots'],['checks','Checks'],['stars','Stars'],['rainbow','Rainbow']];
const EXTRAS=[['none','None',''],['scarf','Scarf','🧣'],['bowtie','Bow tie','🎀'],['glasses','Glasses','👓'],['shades','Cool shades','😎'],['backpack','Backpack','🎒'],['floatie','Duck floatie','🦆'],
  ['balloon','Balloon','🎈'],['guitar','Guitar','🎸'],['wings','Fairy wings','🧚'],['jetpack','Jetpack','🔥'],['medal','Gold medal','🏅'],['buddy','Ghost buddy','👻'],
  ['crown','Crown','👑'],['party','Party hat','🥳'],['cap','Backwards cap','🧢'],['tail','Squirrel tail','🐿️']];
// things to ride (the Ride button): speed, and how high it carries you
const RIDES=[['board','Hoverboard','🛹'],['bike','Bike','🚲'],['carpet','Magic carpet','🧞'],['cloud','Cloud','☁️'],['rocket','Rocket','🚀'],['ufo','Flying saucer','🛸'],['dragon','Dragon','🐉']];
// base: where the ride sits under the bean's feet
const RIDE_INFO={board:{speed:13.5,lift:0.34,base:-0.1},bike:{speed:12,lift:0.7,base:-0.12},carpet:{speed:14,lift:0.62,base:-0.03},cloud:{speed:12.5,lift:0.72,base:-0.08},rocket:{speed:17,lift:0.78,base:-0.2},ufo:{speed:15,lift:0.72,base:-0.08},dragon:{speed:16,lift:0.95,base:-0.3}};
// ride tricks (double-tap Ride, or T): a hop plus a flip, roll or spin, turning about a point py up (and pz along)
const TRICKS={board:{dur:0.85,hop:1.5,ry:TAU,brz:TAU},bike:{dur:1.3,hop:0.3,wheelie:0.6,pz:-0.75},carpet:{dur:1.0,hop:1.2,rz:TAU,py:1.2,fancy:1},
  cloud:{dur:1.1,hop:1.7,rx:-TAU,py:1.2,fancy:1},rocket:{dur:1.4,hop:3.4,rx:-TAU,py:1.4,fancy:1},ufo:{dur:1.2,hop:1.2,ry:2*TAU,fancy:1},dragon:{dur:1.4,hop:2.8,rx:-TAU,py:1.3,fancy:1}};
const TK_V=new V3(),TK_W=new V3();
const rideOf=fit=>RIDE_INFO[fit&&fit.r]?fit.r:'board';
const rideLift=fit=>RIDE_INFO[rideOf(fit)].lift;
const DEFAULT_FIT={t:'tee',tc:6,tp:'solid',b:'shorts',bc:1,bp:'solid',s:'plain',sc:1,x:'none',r:'board'};
function safeFit(f){
  f=f&&typeof f==='object'?f:{};
  const one=(list,v,d)=>list.some(o=>o[0]===v)?v:d;
  const ci=(v,d)=>Number.isInteger(v)&&v>=0&&v<CLOTH_COLORS.length?v:d;
  const oldStripy=f.t==='stripes'; // saves from before patterns had a "Stripy" top
  return {t:oldStripy?'sweater':one(TOPS,f.t,'none'),tc:ci(f.tc,0),tp:oldStripy?'stripes':one(PATTERNS,f.tp,'solid'),
    b:one(BOTTOMS,f.b,'none'),bc:ci(f.bc,0),bp:one(PATTERNS,f.bp,'solid'),s:one(SHOES,f.s,'plain'),sc:ci(f.sc,1),x:one(EXTRAS,f.x,'none'),r:one(RIDES,f.r,'board')};
}
// the bean's egg-shaped body: radius at height y (rounded bottom, slightly wider low down, a dome on top)
const BODY_TOP=1.55;
const bodyR=y=>y<0.25?0.52*Math.sqrt(Math.max(0,1-((0.25-y)/0.25)**2)):y<1.02?lerp(0.52,0.48,smooth(0.25,1.02,y)):0.48*Math.sqrt(Math.max(0,1-((y-1.02)/0.53)**2));
// the white face and its expressions, drawn once and shared by every bean
const FACE={W:256,H:160,tex:{}};
function faceTex(kind){
  if(FACE.tex[kind])return FACE.tex[kind];
  const t=canvasTex(FACE.W,FACE.H,(x,W,H)=>{
    x.fillStyle='#FFFFFF';x.beginPath();x.ellipse(W/2,H/2,W/2-3,H/2-3,0,0,TAU);x.fill();
    const ink='#1D1533',ex=[84,172],ey=76;
    x.fillStyle='rgba(255,128,160,0.55)';for(const bx of[50,206]){x.beginPath();x.ellipse(bx,108,20,11,0,0,TAU);x.fill();}
    const eye=(cx)=>{x.fillStyle=ink;x.beginPath();x.ellipse(cx,ey,20,26,0,0,TAU);x.fill();x.fillStyle='#FFFFFF';x.beginPath();x.arc(cx-6,ey-10,7.5,0,TAU);x.fill();x.beginPath();x.arc(cx+7,ey+8,3,0,TAU);x.fill();};
    const arcEye=(cx,up)=>{x.strokeStyle=ink;x.lineWidth=7;x.lineCap='round';x.beginPath();if(up)x.arc(cx,ey+8,14,Math.PI*1.15,Math.PI*1.85);else x.arc(cx,ey-6,14,Math.PI*0.15,Math.PI*0.85);x.stroke();};
    const chevron=(cx,d)=>{x.strokeStyle=ink;x.lineWidth=7;x.lineCap=x.lineJoin='round';x.beginPath();x.moveTo(cx-12*d,ey-12);x.lineTo(cx+10*d,ey);x.lineTo(cx-12*d,ey+12);x.stroke();};
    const heart=(cx)=>{x.fillStyle='#FF3B5C';x.beginPath();x.moveTo(cx,ey+16);x.bezierCurveTo(cx-26,ey-2,cx-14,ey-24,cx,ey-10);x.bezierCurveTo(cx+14,ey-24,cx+26,ey-2,cx,ey+16);x.fill();};
    const openMouth=(w,h)=>{x.fillStyle='#C8324F';x.beginPath();x.moveTo(128-w,112);x.quadraticCurveTo(128,112-h*0.25,128+w,112);x.quadraticCurveTo(128,112+h*1.6,128-w,112);x.fill();
      x.fillStyle='#FF8FA8';x.beginPath();x.ellipse(128,112+h*0.62,w*0.55,h*0.32,0,0,TAU);x.fill();};
    const smile=()=>{x.strokeStyle=ink;x.lineWidth=6;x.lineCap='round';x.beginPath();x.arc(128,104,13,Math.PI*0.2,Math.PI*0.8);x.stroke();};
    if(kind==='laugh'){arcEye(ex[0],true);arcEye(ex[1],true);openMouth(22,19);}
    else if(kind==='wink'){chevron(ex[0],1);chevron(ex[1],-1);openMouth(20,16);}
    else if(kind==='love'){heart(ex[0]);heart(ex[1]);openMouth(14,12);}
    else if(kind==='wow'){eye(ex[0]);eye(ex[1]);x.fillStyle='#C8324F';x.beginPath();x.ellipse(128,116,9,12,0,0,TAU);x.fill();}
    else if(kind==='huh'){eye(ex[0]);eye(ex[1]);x.strokeStyle=ink;x.lineWidth=6;x.lineCap='round';x.beginPath();x.moveTo(114,118);x.quadraticCurveTo(121,110,128,116);x.quadraticCurveTo(135,122,142,114);x.stroke();}
    else if(kind==='smile'){eye(ex[0]);eye(ex[1]);smile();}
    else{eye(ex[0]);eye(ex[1]);openMouth(19,15);}
  });
  FACE.tex[kind]=t;return t;
}
function faceMesh(){
  // a patch of sphere over the front of the head, a touch proud of the body so the white shows
  const g=new THREE.SphereGeometry(0.5,22,12,Math.PI/2-0.97,1.94,Math.PI*0.24,Math.PI*0.35);
  const m=new THREE.Mesh(g,new THREE.MeshToonMaterial({map:faceTex('happy'),gradientMap:gradTex,transparent:true,alphaTest:0.5}));
  m.position.y=1.02;m.scale.z=1.06;m.userData.kind='happy';return m;
}
function setFace(u,kind){if(u.face&&u.face.userData.kind!==kind){u.face.userData.kind=kind;u.face.material.map=faceTex(kind);}}
// the second color of a pattern: ink on light cloth, white on everything else
function patAlt(col){const c=new THREE.Color(col);return (0.299*c.r+0.587*c.g+0.114*c.b)>0.72?'#2B2040':'#FFFFFF';}
const RAINBOW=['#FF5D73','#FF9F1C','#FFD23F','#3DDC97','#4D96FF','#9B5DE5'];
function starPath(x,cx,cy,r){x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.45:r;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}x.closePath();}
const patCache=new Map();
function clothMat(col,pat,side){
  const k=col+'|'+(pat||'solid')+'|'+(side||0);if(patCache.has(k))return patCache.get(k);
  let m;
  if(!pat||pat==='solid')m=side?new THREE.MeshToonMaterial({color:col,gradientMap:gradTex,side}):M(col);
  else{
    const alt=patAlt(col);
    const t=canvasTex(64,64,(x,W,H)=>{
      x.fillStyle=col;x.fillRect(0,0,W,H);x.fillStyle=alt;
      if(pat==='stripes'){x.fillRect(0,0,W,H/4);x.fillRect(0,H/2,W,H/4);}
      else if(pat==='dots'){for(const[px,py]of[[16,16],[48,48]]){x.beginPath();x.arc(px,py,8,0,TAU);x.fill();}}
      else if(pat==='checks'){x.globalAlpha=0.55;x.fillRect(0,0,W/2,H/2);x.fillRect(W/2,H/2,W/2,H/2);}
      else if(pat==='stars'){x.fillStyle='#FFD23F';for(const[px,py]of[[16,18],[48,50]]){starPath(x,px,py,11);x.fill();}}
      else if(pat==='rainbow'){RAINBOW.forEach((c,i)=>{x.fillStyle=c;x.fillRect(0,i*H/6,W,H/6+1);});}
      else if(pat==='hawaii'){for(const[px,py,c]of[[14,16,'#FFFFFF'],[46,42,'#FFD23F'],[30,58,'#FF8FBF']]){x.fillStyle=c;for(let i=0;i<5;i++){const a=i/5*TAU;x.beginPath();x.arc(px+Math.cos(a)*6,py+Math.sin(a)*6,5,0,TAU);x.fill();}x.fillStyle='#FF9F1C';x.beginPath();x.arc(px,py,3,0,TAU);x.fill();}
        x.fillStyle='rgba(61,220,151,0.8)';x.beginPath();x.ellipse(50,12,9,4,0.6,0,TAU);x.fill();x.beginPath();x.ellipse(10,44,9,4,-0.5,0,TAU);x.fill();}
    });
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(pat==='hawaii'?5:10,pat==='rainbow'?1:pat==='hawaii'?0.8:1.5);
    m=MT(t,side?{side}:undefined);
  }
  patCache.set(k,m);return m;
}
// add a child to a squashed foot, in world-ish units (undoes the foot's own squash)
function onFoot(f,m,x,y,z,sx,sy,sz){const k=f.scale;m.position.set(x,y/k.y,z/k.z);m.scale.set(sx/k.x,sy/k.y,sz/k.z);f.add(m);return m;}
// beans stand on two stubby legs this high, so shoes and trouser legs show
const LEG_LIFT=0.24;
const darker=(c,k)=>new THREE.Color(c).multiplyScalar(k||0.82).getStyle();

/* ---------- garment pieces ---------- */
// a garment hugging the body from y0 to y1 (flare widens the hem); smooth, with a rolled hem
function shell(y0,y1,mat,flare,hemCol){
  const pts=[];const n=14,off=0.03;
  for(let i=0;i<=n;i++){const y=lerp(y0,y1,i/n);pts.push(new THREE.Vector2(bodyR(y)+off+(flare||0)*(1-i/n)**2,y));}
  const g=new THREE.Group();g.add(mk(new THREE.LatheGeometry(pts,32),null,{mat,ol:false}));
  if(hemCol!==false)g.add(ring(y0+0.015,bodyR(y0+0.015)+off+(flare||0),0.028,hemCol||mat));
  return g;
}
// a rolled edge around the body at height y
function ring(y,r,tube,matOrCol){
  const t=new THREE.Mesh(new THREE.TorusGeometry(r,tube,6,32),matOrCol&&matOrCol.isMaterial?matOrCol:M(matOrCol));
  t.rotation.x=Math.PI/2;t.position.y=y;return t;   // trims don't cast shadows: tiny ones striped the cloth
}
const neck=(col,thick)=>ring(0.86,bodyR(0.86)+0.02,thick||0.035,col);
// sleeves are puffy capsules over the arm: short ones cap the shoulder, long ones stop at the wrist with a cuff
function sleeves(arms,mat,long,cuffCol){
  for(const a of arms){
    const s=mk(new THREE.CapsuleGeometry(long?0.18:0.2,long?0.2:0.12,5,12),null,{mat,w:0.018});s.position.y=long?-0.2:-0.12;a.add(s);
    if(long){const c=new THREE.Mesh(new THREE.TorusGeometry(0.165,0.035,6,16),cuffCol&&cuffCol.isMaterial?cuffCol:M(cuffCol||'#FFFFFF'));c.rotation.x=Math.PI/2;c.position.y=-0.44;a.add(c);}
  }
}
// a flat patch that sits on the body's surface at height y, facing front (dz=1) or back (dz=-1)
function patch(body,w,h,y,col,dz,o){const m=box(w,h,0.05,col,Object.assign({w:0.015},o||{}));m.position.set(0,y,(bodyR(y)+0.04)*(dz||1));body.add(m);return m;}

/* ---------- dressing up ---------- */
// returns parts that animate: {wings, fx:[(t,st)=>...]}
function dressBean(body,arms,feet,fit,col){
  const tc=CLOTH_COLORS[fit.tc],bc=CLOTH_COLORS[fit.bc],sc=CLOTH_COLORS[fit.sc];const out={wings:[],fx:[]};
  const trim=darker(tc);
  if(fit.t==='cape'){
    const cape=new THREE.Mesh(new THREE.CylinderGeometry(0.56,0.8,0.95,24,1,true,Math.PI*0.62,Math.PI*0.76),clothMat(tc,fit.tp,THREE.DoubleSide));
    cape.position.y=0.5;cape.castShadow=true;body.add(cape);
    body.add(ring(0.9,bodyR(0.9)+0.03,0.05,'#FFD23F'));
    body.add(at(sph(0.07,'#FFD23F',8,6,{w:0.015}),0,0.88,bodyR(0.88)+0.07));
  }else if(fit.t==='puffer'){
    // quilted puffs stacked up the body, a zip down the front, puffy sleeves
    for(let i=0;i<5;i++){const y=0.42+i*0.1;body.add(ring(y,bodyR(y)+0.02,0.065,clothMat(tc,fit.tp)));}
    body.add(shell(0.38,0.86,clothMat(tc,fit.tp),0,false));
    patch(body,0.03,0.42,0.63,'#C8D4E0',1,{ol:false});
    sleeves(arms,clothMat(tc,fit.tp),true,trim);body.add(neck(trim,0.06));
  }else if(fit.t==='dino'){
    const mat=clothMat(tc,fit.tp);
    body.add(shell(0.16,0.88,mat,0.01,trim));
    sleeves(arms,mat,true,trim);
    const belly=mk(new THREE.SphereGeometry(0.3,12,10),'#FFF3C4',{ol:false});belly.scale.set(1,1.3,0.35);belly.position.set(0,0.5,bodyR(0.5)+0.01);body.add(belly);
    // spikes from the top of the head down the back, and a tail
    for(let i=0;i<7;i++){const y=1.45-i*0.18,r=y>1.02?0.48*Math.sqrt(Math.max(0,1-((y-1.02)/0.53)**2)):bodyR(y);
      const sp=cone(0.09-i*0.004,0.22,'#FFD23F',4,{w:0.015});sp.position.set(0,y,-r-0.04);sp.rotation.x=-Math.PI/2+(y>1.02?-0.5:0);body.add(sp);}
    const tail=cone(0.2,0.8,tc,8,{w:0.022});tail.material=mat;tail.rotation.x=-Math.PI/2-0.35;tail.position.set(0,0.32,-0.78);body.add(tail);
    out.fx.push((t,st)=>{tail.rotation.y=Math.sin(t*(st.an?9:2.5))*0.35;});
  }else if(fit.t==='space'){
    const white=M('#F4F6FB');
    body.add(shell(0.24,0.88,white,0,'#C8D4E0'));
    sleeves(arms,white,true,tc);body.add(neck('#C8D4E0',0.05));
    const panel=patch(body,0.34,0.22,0.64,'#5B6B8C',1);
    [['#FF5D73',-0.1],['#FFD23F',0],['#3DDC97',0.1]].forEach(([c,x])=>{const b=sph(0.03,c,6,5,{ol:false});b.position.set(x,0.03,0.04);panel.add(b);});
    const bar=box(0.22,0.04,0.02,tc,{ol:false});bar.position.set(0,-0.06,0.035);panel.add(bar);
    for(const s of[-1,1]){const tank=cyl(0.1,0.1,0.5,'#C8D4E0',10,{w:0.02});tank.position.set(0.14*s,0.72,-bodyR(0.72)-0.1);body.add(tank);body.add(at(sph(0.1,tc,8,6,{ol:false}),0.14*s,0.98,-bodyR(0.98)-0.1));}
    body.add(ring(0.4,bodyR(0.4)+0.05,0.04,tc));
  }else if(fit.t==='armor'){
    const steel=M('#C9D2E3'),dark=M('#8C97AE');
    body.add(shell(0.28,0.86,steel,0,dark));
    const plate=mk(new THREE.SphereGeometry(0.34,14,10),null,{mat:steel,w:0.02});plate.scale.set(1.1,1.2,0.42);plate.position.set(0,0.62,bodyR(0.62)-0.05);body.add(plate);
    const crest=box(0.16,0.2,0.05,tc,{w:0.015});crest.position.set(0,0.64,bodyR(0.64)+0.1);body.add(crest);
    for(const a of arms){const p=mk(new THREE.SphereGeometry(0.22,12,8,0,TAU,0,Math.PI/2),null,{mat:steel,w:0.02});p.position.y=-0.04;a.add(p);
      const s=mk(new THREE.CapsuleGeometry(0.176,0.2,5,12),null,{mat:dark,w:0.02});s.position.y=-0.22;a.add(s);}
    body.add(ring(0.4,bodyR(0.4)+0.05,0.045,'#8B5E3C'));body.add(neck(dark,0.05));
  }else if(fit.t==='detective'){
    // a long belted trench coat with a turned-up collar, whatever the top color; a magnifying glass in hand
    const coat=M('#C9A46A'),dk=M('#9C7A45');
    body.add(shell(0.14,0.86,coat,0.07,dk));sleeves(arms,coat,true,dk);
    body.add(ring(0.5,bodyR(0.5)+0.06,0.04,darker(tc,0.7)));body.add(at(box(0.1,0.08,0.04,'#FFD23F',{w:0.01}),0,0.5,bodyR(0.5)+0.1));
    for(const s of[-1,1]){const c=box(0.22,0.22,0.03,'#C9A46A',{w:0.012});c.position.set(0.13*s,0.86,bodyR(0.86)+0.04);c.rotation.set(-0.5,0,s*0.55);body.add(c);
      for(let i=0;i<2;i++)body.add(at(sph(0.025,'#5B3A29',5,4,{ol:false}),0.1*s,0.72-i*0.14,bodyR(0.72-i*0.14)+0.045));}
    const glass=new THREE.Group();glass.add(mk(new THREE.TorusGeometry(0.11,0.025,6,18),'#5B3A29',{ol:false}));
    const lens=new THREE.Mesh(new THREE.CircleGeometry(0.1,18),new THREE.MeshBasicMaterial({color:'#CFF4FF',transparent:true,opacity:0.55,side:THREE.DoubleSide}));glass.add(lens);
    glass.add(at(cyl(0.025,0.025,0.22,'#5B3A29',6,{ol:false}),0,-0.2,0));glass.position.set(0,-0.62,0.08);glass.rotation.y=Math.PI/2;arms[1].add(glass);
  }else if(fit.t==='ninja'){
    // a dark suit, a belt in your top color and a headband whose tails flutter as you run
    const suit=M('#2B2040'),bc_=tc==='#2B2040'?'#FF5D73':tc,band=M(bc_);
    body.add(shell(0.16,0.88,suit,0,false));sleeves(arms,suit,true,band);
    body.add(ring(0.46,bodyR(0.46)+0.05,0.05,band));
    body.add(ring(1.3,0.43,0.045,band));
    const tails=[];for(const s of[-1,1]){const t=box(0.07,0.34,0.02,bc_,{ol:false});t.geometry.translate(0,-0.17,0);t.position.set(0.05*s,1.3,-0.44);t.rotation.set(0.9,0,0.25*s);body.add(t);tails.push(t);}
    out.fx.push((t,st)=>{tails.forEach((b,i)=>{b.rotation.x=0.9+(st.an||st.hb?0.5:0)+Math.sin(t*(st.an?14:3)+i)*0.18;});});
  }else if(fit.t!=='none'){
    const mat=clothMat(tc,fit.t==='hawaii'?'hawaii':fit.tp);
    const y0=fit.t==='raincoat'?0.3:fit.t==='tux'?0.36:fit.t==='tee'||fit.t==='hawaii'?0.46:0.4;
    body.add(shell(y0,0.86,mat,fit.t==='raincoat'?0.08:fit.t==='tux'?0.03:0,fit.t==='sweater'||fit.t==='varsity'?trim:undefined));
    const long=fit.t!=='tee'&&fit.t!=='hawaii';
    if(fit.t==='varsity'){const alt=patAlt(tc);sleeves(arms,M(alt),true,M(tc));body.add(ring(0.42,bodyR(0.42)+0.045,0.045,alt));body.add(neck(alt,0.05));
      const t=canvasTex(64,64,(x,W,H)=>{x.fillStyle=alt;x.fillRect(0,0,W,H);x.fillStyle=tc;x.font='900 52px "Lilita One", sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('W',W/2,H/2+3);});
      const lt=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.04),[M(alt),M(alt),M(alt),M(alt),MT(t),M(alt)]);lt.position.set(0.17,0.66,bodyR(0.66)+0.02);lt.rotation.y=0.3;outline(lt,0.012);body.add(lt);}
    else sleeves(arms,mat,long,fit.t==='sweater'?trim:fit.t==='tux'?'#FFFFFF':mat);
    if(fit.t==='tee')body.add(neck(trim,0.03));
    if(fit.t==='hawaii'){for(const s of[-1,1]){const c=box(0.16,0.2,0.03,'#FFFFFF',{w:0.012});c.position.set(0.1*s,0.82,bodyR(0.82)+0.03);c.rotation.set(-0.3,0,s*0.5);body.add(c);}
      for(let i=0;i<3;i++)body.add(at(sph(0.022,'#FFFFFF',5,4,{ol:false}),0,0.7-i*0.12,bodyR(0.7-i*0.12)+0.035));}
    if(fit.t==='sweater')body.add(neck(trim,0.06));
    if(fit.t==='hoodie'){
      // a hood lying round the back of the neck, a pouch pocket and drawstrings
      const hood=new THREE.Mesh(new THREE.TorusGeometry(0.42,0.12,8,24,Math.PI*1.25),mat);hood.rotation.set(Math.PI/2-0.25,0,Math.PI*0.125+Math.PI);hood.position.set(0,0.93,-0.05);hood.castShadow=true;body.add(hood);
      const pk=mk(new THREE.CylinderGeometry(bodyR(0.56)+0.045,bodyR(0.56)+0.045,0.2,24,1,true,-0.55,1.1),null,{mat:M(trim),ol:false,shadow:false});pk.position.y=0.56;pk.material=new THREE.MeshToonMaterial({color:trim,gradientMap:gradTex,side:THREE.DoubleSide});body.add(pk);
      for(const s of[-1,1])body.add(at(cyl(0.016,0.016,0.2,'#FFFFFF',5,{ol:false}),0.09*s,0.77,bodyR(0.77)+0.05));
      body.add(neck(trim,0.04));
    }
    if(fit.t==='raincoat'){
      body.add(neck(trim,0.06));
      for(let i=0;i<3;i++)body.add(at(sph(0.035,'#2B2040',6,5,{ol:false}),0,0.76-i*0.16,bodyR(0.76-i*0.16)+0.045));
      for(const s of[-1,1]){const f=box(0.2,0.16,0.03,tc,{w:0.012});f.position.set(0.14*s,0.83,bodyR(0.83)+0.03);f.rotation.set(-0.35,0,s*0.6);body.add(f);}
    }
    if(fit.t==='tux'){
      patch(body,0.22,0.44,0.64,'#FFFFFF');
      for(const s of[-1,1]){const l=box(0.1,0.4,0.03,darker(tc,0.7),{w:0.012});l.position.set(0.15*s,0.68,bodyR(0.68)+0.05);l.rotation.z=0.28*s;body.add(l);
        body.add(rot(at(cone(0.06,0.11,'#2B2040',8,{ol:false}),0.06*s,0.84,bodyR(0.84)+0.07),0,0,s*Math.PI/2));}
      body.add(at(sph(0.035,'#2B2040',6,5,{ol:false}),0,0.84,bodyR(0.84)+0.08));
      for(let i=0;i<2;i++)body.add(at(sph(0.022,'#2B2040',6,5,{ol:false}),0,0.66-i*0.14,bodyR(0.66-i*0.14)+0.075));
    }
  }
  // bottoms
  if(fit.b!=='none'){
    const mat=clothMat(bc,fit.bp);
    if(fit.b==='skirt')body.add(shell(0.22,0.52,mat,0.1));
    else if(fit.b==='tutu'){body.add(shell(0.36,0.54,mat,0.3));body.add(shell(0.4,0.56,clothMat(patAlt(bc)==='#FFFFFF'?'#FFFFFF':bc,'solid'),0.2,false));}
    else if(fit.b==='hula'){
      const n=30;for(let i=0;i<n;i++){const a=i/n*TAU,r=bodyR(0.45)+0.05;const b=cone(0.045,0.36,i%2?'#6CC05A':'#4E9E3E',3,{ol:false});b.position.set(Math.cos(a)*r,0.3,Math.sin(a)*r);b.rotation.set(Math.PI+Math.sin(a)*0.18,0,-Math.cos(a)*0.18);body.add(b);}
      body.add(ring(0.5,bodyR(0.5)+0.05,0.05,'#FF8FBF'));for(let i=0;i<5;i++){const a=-0.6+i*0.3;body.add(at(sph(0.05,['#FFD23F','#FF5D73','#FFFFFF'][i%3],6,5,{ol:false}),Math.sin(a)*(bodyR(0.5)+0.1),0.5,Math.cos(a)*(bodyR(0.5)+0.1)));}
    }
    else{
      body.add(shell(0.16,0.52,mat,0,darker(bc)));
      if(fit.b==='pants'||fit.b==='overalls')for(const f of feet){onFoot(f,mk(new THREE.CylinderGeometry(0.16,0.17,0.3,12),null,{mat,ol:false}),0,0.22,-0.03,1,1,1);onFoot(f,new THREE.Mesh(new THREE.TorusGeometry(0.165,0.03,6,16),M(darker(bc))),0,0.08,-0.03,1,1,1).rotation.x=Math.PI/2;}
      if(fit.b==='shorts')for(const f of feet)onFoot(f,mk(new THREE.CylinderGeometry(0.165,0.17,0.12,12),null,{mat,ol:false}),0,0.31,-0.03,1,1,1);
      if(fit.b==='overalls'){
        const bib=mk(new THREE.CylinderGeometry(bodyR(0.66)+0.04,bodyR(0.66)+0.04,0.32,24,1,true,-0.6,1.2),null,{mat:new THREE.MeshToonMaterial({color:bc,gradientMap:gradTex,side:THREE.DoubleSide}),ol:false});bib.position.y=0.66;body.add(bib);
        const pk=box(0.18,0.1,0.02,darker(bc),{ol:false});pk.position.set(0,0.68,bodyR(0.68)+0.05);body.add(pk);
        for(const s of[-1,1]){body.add(at(cyl(0.035,0.035,0.02,'#FFD23F',8,{ol:false}),0.16*s,0.8,bodyR(0.8)+0.05).rotateX(Math.PI/2));
          const st=mk(new THREE.TorusGeometry(0.5,0.028,4,20,Math.PI*0.62),bc,{ol:false});st.rotation.set(0,Math.PI/2,Math.PI/2+0.35);st.position.set(0.16*s,0.64,0.02);body.add(st);}
      }
    }
  }
  // shoes (bare feet are just the bean's own feet)
  const sole=(f,c)=>onFoot(f,sph(0.21,c,12,6,{w:0.02}),0,-0.06,0.01,1.06,0.3,1.4);
  for(const f of feet){
    if(fit.s==='sneakers'||fit.s==='glow'){sole(f,'#FFFFFF');onFoot(f,sph(0.1,'#FFFFFF',10,6,{w:0.015}),0,0,0.2,1.05,0.75,1);
      for(let i=0;i<3;i++)onFoot(f,box(0.13,0.025,0.03,'#FFFFFF',{ol:false}),0,0.085,0.08-i*0.07,1,1,1);
      if(fit.s==='glow'){const gm=new THREE.MeshBasicMaterial({color:'#7CF4FF'});const gl=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.03,6,20),gm);onFoot(f,gl,0,-0.05,0.01,1.05,1,1.4).rotation.x=Math.PI/2;
        out.fx.push(t=>{gm.color.setHSL((t*0.4+f.position.x)%1,1,0.6);});}}
    else if(fit.s==='boots'){sole(f,'#5B3A29');onFoot(f,cyl(0.17,0.18,0.26,sc,10,{w:0.022}),0,0.17,-0.04,1,1,1);onFoot(f,cyl(0.185,0.185,0.05,'#5B3A29',10,{ol:false}),0,0.3,-0.04,1,1,1);}
    else if(fit.s==='cowboy'){sole(f,'#5B3A29');onFoot(f,cyl(0.18,0.17,0.3,sc,10,{w:0.022}),0,0.2,-0.05,1,1,1);onFoot(f,box(0.2,0.12,0.12,'#5B3A29',{w:0.015}),0,-0.08,-0.2,1,1,1);
      onFoot(f,cone(0.12,0.2,sc,8,{w:0.015}),0,0,0.3,1,1,1).rotation.x=Math.PI/2;const sp=onFoot(f,cyl(0.06,0.06,0.02,'#FFD23F',5,{ol:false}),0,0,-0.3,1,1,1);sp.rotation.x=Math.PI/2;}
    else if(fit.s==='bunny'){onFoot(f,sph(0.22,'#FFFFFF',12,8,{w:0.022}),0,0.02,0.02,1.1,0.8,1.3);
      for(const s of[-1,1]){const e=onFoot(f,cap(0.045,0.2,'#FFFFFF',{w:0.012}),0.07*s,0.2,0.1,1,1,1);e.rotation.set(-0.5,0,0.3*s);onFoot(f,cap(0.022,0.14,'#FFB3C7',{ol:false}),0.07*s,0.21,0.13,1,1,1).rotation.set(-0.5,0,0.3*s);}
      for(const s of[-1,1])onFoot(f,sph(0.025,'#1D1533',4,3,{ol:false}),0.06*s,0.1,0.24,1,1,1);onFoot(f,sph(0.03,'#FF8FA8',4,3,{ol:false}),0,0.07,0.27,1,1,1);}
    else if(fit.s==='rocket'){sole(f,'#8C97AE');onFoot(f,cyl(0.17,0.19,0.26,'#C9D2E3',10,{w:0.022}),0,0.17,-0.04,1,1,1);onFoot(f,cyl(0.19,0.19,0.05,sc,10,{ol:false}),0,0.28,-0.04,1,1,1);
      const fl=new THREE.Mesh(new THREE.ConeGeometry(0.1,0.35,8),new THREE.MeshBasicMaterial({color:'#FF9F1C'}));onFoot(f,fl,0,-0.2,-0.12,1,1,1).rotation.x=Math.PI;
      out.fx.push((t,st)=>{const on=st.an===3||st.hb;fl.visible=on||Math.sin(t*3)>0.6;const k=0.7+0.3*Math.sin(t*40+f.position.x*9);fl.scale.set(k/f.scale.x,(on?1.4:0.6)*k/f.scale.y,k/f.scale.z);});}
    else if(fit.s==='gold'){sole(f,'#FFFFFF');onFoot(f,sph(0.1,'#FFFFFF',10,6,{w:0.015}),0,0,0.2,1.05,0.75,1);
      for(let i=0;i<3;i++)onFoot(f,box(0.13,0.025,0.03,'#FFFFFF',{ol:false}),0,0.085,0.08-i*0.07,1,1,1);
      const sp=new THREE.Mesh(new THREE.OctahedronGeometry(0.07),new THREE.MeshBasicMaterial({color:'#FFFBE0'}));onFoot(f,sp,0.14,0.2,0.1,1,1,1);
      out.fx.push(t=>{const k=Math.max(0.001,Math.sin(t*3+f.position.x*7));sp.scale.set(k/f.scale.x,k/f.scale.y,k/f.scale.z);sp.rotation.y=t*4;});}
    else if(fit.s==='flippers')onFoot(f,sph(0.2,sc,10,6,{w:0.018}),0,-0.04,0.28,1.25,0.22,2);
    else if(fit.s==='rollers'){
      onFoot(f,box(0.3,0.05,0.5,'#FFFFFF',{w:0.015}),0,-0.07,0.02,1,1,1);
      for(const z of[-0.16,0.18])onFoot(f,cyl(0.07,0.07,0.24,'#FFD23F',10,{w:0.015}),0,-0.14,z,1,1,1).rotation.z=Math.PI/2;
    }
  }
  // extras
  if(fit.x==='scarf'){
    body.add(ring(0.86,bodyR(0.86)+0.04,0.075,clothMat('#FF5D73','stripes')));
    body.add(rot(at(box(0.14,0.34,0.06,'#FF5D73',{w:0.02}),0.2,0.7,bodyR(0.7)+0.08),0,0,0.12));
  }else if(fit.x==='bowtie'){
    for(const s of[-1,1])body.add(rot(at(cone(0.07,0.13,'#FF5D73',8,{w:0.02}),0.07*s,0.82,bodyR(0.82)+0.06),0,0,s*Math.PI/2));
    body.add(at(sph(0.04,'#E0435A',8,6,{w:0.015}),0,0.82,bodyR(0.82)+0.08));
  }else if(fit.x==='backpack'){
    body.add(at(box(0.5,0.5,0.22,'#FFD23F',{w:0.03}),0,0.72,-bodyR(0.72)-0.08));
    body.add(at(box(0.3,0.18,0.08,'#FF9F1C',{w:0.02}),0,0.62,-bodyR(0.62)-0.22));
    for(const s of[-1,1])body.add(at(box(0.07,0.36,0.03,'#2B2040',{ol:false}),0.22*s,0.7,bodyR(0.7)+0.03));
  }else if(fit.x==='glasses'){
    for(const s of[-1,1])body.add(at(mk(new THREE.TorusGeometry(0.1,0.022,6,18),'#2B2040',{ol:false,shadow:false}),0.14*s,1.17,0.54));
    body.add(at(box(0.1,0.022,0.022,'#2B2040',{ol:false,shadow:false}),0,1.18,0.55));
  }else if(fit.x==='shades'){
    for(const s of[-1,1]){const l=mk(new THREE.CylinderGeometry(0.1,0.1,0.03,16),'#1D1533',{ol:false,shadow:false});l.scale.set(1.2,1,0.85);l.rotation.x=Math.PI/2;l.position.set(0.14*s,1.16,0.545);body.add(l);
      body.add(at(box(0.05,0.02,0.02,'#FFFFFF',{ol:false,shadow:false}),0.11*s,1.19,0.565));}
    body.add(at(box(0.36,0.03,0.03,'#1D1533',{ol:false,shadow:false}),0,1.2,0.55));
  }else if(fit.x==='medal'){
    for(const s of[-1,1])body.add(rot(at(box(0.06,0.24,0.02,s<0?'#4D96FF':'#FF5D73',{ol:false}),0.06*s,0.78,bodyR(0.78)+0.05),0,0,-0.35*s));
    body.add(rot(at(cyl(0.1,0.1,0.035,'#FFD23F',16,{w:0.015}),0,0.64,bodyR(0.64)+0.07),Math.PI/2,0,0));
  }else if(fit.x==='floatie'){
    body.add(rot(at(mk(new THREE.TorusGeometry(0.6,0.14,10,28),'#FFD23F',{w:0.03}),0,0.46,0),Math.PI/2,0,0));
    body.add(at(sph(0.17,'#FFD23F',12,10,{w:0.025}),0,0.7,0.62));
    for(const s of[-1,1])body.add(at(sph(0.035,'#1D1533',6,5,{ol:false}),0.07*s,0.75,0.76));
    body.add(rot(at(cone(0.06,0.14,'#FF9F1C',8,{w:0.015}),0,0.68,0.8),Math.PI/2,0,0));
  }else if(fit.x==='balloon'){
    // held out to the side: string from the right hand up to the balloon
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new V3(0.62,0.6,0.1),new V3(0.85,1.6,0.05)]),new THREE.LineBasicMaterial({color:0x2B2040})));
    const b=sph(0.26,'#FF5D73',12,10,{w:0.025});b.scale.y=1.15;b.position.set(0.87,1.9,0.05);body.add(b);
    body.add(at(cone(0.05,0.07,'#FF5D73',6,{ol:false}),0.87,1.6,0.05));
    out.fx.push(t=>{b.position.y=1.9+Math.sin(t*1.7)*0.05;});
  }else if(fit.x==='guitar'){
    const g=new THREE.Group();g.add(scl(at(sph(0.2,'#C8793C',12,8),0,0,0),1,1,0.35));g.add(scl(at(sph(0.15,'#C8793C',12,8),0,0.24,0),1,1,0.35));
    g.add(at(cyl(0.05,0.05,0.02,'#5B3A29',10,{ol:false}),0,0.04,-0.075).rotateX(Math.PI/2));g.add(at(box(0.07,0.5,0.04,'#5B3A29',{w:0.012}),0,0.6,0));g.add(at(box(0.11,0.12,0.05,'#2B2040',{ol:false}),0,0.88,0));
    g.position.set(0,0.66,-bodyR(0.66)-0.1);g.rotation.z=0.6;body.add(g);
    for(const s of[-1,1])body.add(at(box(0.05,0.34,0.02,'#8B5E3C',{ol:false}),0.2*s,0.72,bodyR(0.72)+0.03));
  }else if(fit.x==='jetpack'){
    const flames=[];
    for(const s of[-1,1]){body.add(at(cyl(0.12,0.12,0.5,'#C9D2E3',12,{w:0.02}),0.15*s,0.72,-bodyR(0.72)-0.13));body.add(at(cone(0.12,0.16,'#FF5D73',12,{w:0.02}),0.15*s,1.05,-bodyR(0.72)-0.13));
      body.add(at(cyl(0.07,0.1,0.1,'#5B6B8C',10,{ol:false}),0.15*s,0.42,-bodyR(0.72)-0.13));
      const fl=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.4,8),new THREE.MeshBasicMaterial({color:'#FFB21A'}));fl.rotation.x=Math.PI;fl.position.set(0.15*s,0.2,-bodyR(0.72)-0.13);body.add(fl);flames.push(fl);}
    for(const s of[-1,1])body.add(at(box(0.06,0.36,0.02,'#2B2040',{ol:false}),0.22*s,0.72,bodyR(0.72)+0.03));
    out.fx.push((t,st)=>{const on=st.an===3||st.hb;flames.forEach((f,i)=>{f.visible=on;const k=0.8+0.25*Math.sin(t*35+i*2);f.scale.set(k,k*1.3,k);});});
  }else if(fit.x==='buddy'){
    // a little ghost pal that floats round your shoulder
    const pal=new THREE.Group();const gb=mk(new THREE.CapsuleGeometry(0.14,0.12,4,10),'#F4F6FB',{w:0.015});pal.add(gb);
    for(const s of[-1,1])pal.add(at(sph(0.025,'#1D1533',4,3,{ol:false}),0.05*s,0.06,0.13));pal.add(at(sph(0.02,'#FF8FA8',4,3,{ol:false}),0,0.0,0.14));
    const tails=[];for(let i=0;i<3;i++){const c=cone(0.05,0.12,'#F4F6FB',6,{ol:false});c.rotation.x=Math.PI;c.position.set(-0.07+i*0.07,-0.2,0);pal.add(c);tails.push(c);}
    body.add(pal);
    out.fx.push(t=>{const a=t*1.1;pal.position.set(Math.cos(a)*0.85,1.35+Math.sin(t*2.4)*0.12,Math.sin(a)*0.5);pal.rotation.y=-a+Math.PI/2;tails.forEach((c,i)=>{c.rotation.z=Math.sin(t*6+i)*0.3;});});
  }else if(fit.x==='crown'){
    const c=new THREE.Group();c.add(mk(new THREE.CylinderGeometry(0.3,0.27,0.18,16,1,true),null,{mat:new THREE.MeshToonMaterial({color:'#FFD23F',gradientMap:gradTex,side:THREE.DoubleSide}),w:0.015}));
    for(let i=0;i<6;i++){const a=i/6*TAU;c.add(at(cone(0.06,0.16,'#FFD23F',4,{w:0.012}),Math.sin(a)*0.29,0.16,Math.cos(a)*0.29));c.add(at(sph(0.03,'#FFFFFF',5,4,{ol:false}),Math.sin(a)*0.29,0.25,Math.cos(a)*0.29));}
    for(const [a,cc] of[[0,'#FF3B5C'],[Math.PI/3,'#4D96FF'],[-Math.PI/3,'#3DDC97']])c.add(at(sph(0.045,cc,6,5,{ol:false}),Math.sin(a)*0.31,0.01,Math.cos(a)*0.31));
    c.position.set(0.03,1.5,0);c.rotation.z=-0.12;body.add(c);
  }else if(fit.x==='party'){
    const h=new THREE.Group(),m=mk(new THREE.ConeGeometry(0.2,0.5,14),null,{mat:clothMat('#9B5DE5','stars'),w:0.015});m.position.y=0.25;h.add(m);
    h.add(at(sph(0.08,'#FFD23F',8,6,{w:0.012}),0,0.52,0));h.add(rot(at(new THREE.Mesh(new THREE.TorusGeometry(0.19,0.03,6,16),M('#FF5D73')),0,0.02,0),Math.PI/2,0,0));
    h.position.set(-0.12,1.44,0);h.rotation.z=0.3;body.add(h);
    out.fx.push(t=>{h.rotation.z=0.3+Math.sin(t*2.4)*0.05;});
  }else if(fit.x==='cap'){
    const cp=new THREE.Group();cp.add(mk(new THREE.SphereGeometry(0.46,18,8,0,TAU,0,Math.PI/2),'#FF5D73',{w:0.015}));cp.add(at(scl(sph(0.2,'#FFFFFF',10,6,{ol:false}),1,0.75,0.3),0,0.2,0.39));
    const brim=mk(new THREE.CylinderGeometry(0.27,0.27,0.03,16,1,false,Math.PI/2,Math.PI),'#C8324F',{w:0.012});brim.scale.set(1,1,1.35);brim.position.set(0,0.01,-0.38);cp.add(brim);
    cp.add(at(sph(0.05,'#FFFFFF',6,5,{ol:false}),0,0.45,0));
    cp.position.set(0,1.16,0);cp.rotation.x=-0.1;body.add(cp);
  }else if(fit.x==='tail'){
    // a big fluffy tail curling up behind you, swishing as you go
    const tail=new THREE.Group();tail.position.set(0,0.3,-bodyR(0.3)-0.02);body.add(tail);
    const segs=[];let parent=tail;
    for(let i=0;i<6;i++){const g=new THREE.Group();g.position.y=i?0.2:0;const r=0.13+i*0.035;
      g.add(at(sph(r,i>3?'#E8A45C':'#C8793C',10,8,{w:0.02}),0,0.1,0));parent.add(g);segs.push(g);parent=g;}
    out.fx.push((t,st)=>{const sp=st.an?9:2.2;segs.forEach((g,i)=>{g.rotation.x=-0.45+(i>2?0.35:0)+Math.sin(t*sp-i*0.6)*0.08;g.rotation.z=Math.sin(t*sp*0.7-i*0.5)*0.12;});});
  }else if(fit.x==='wings'){
    const wm=new THREE.MeshToonMaterial({color:'#BDEBFF',gradientMap:gradTex,transparent:true,opacity:0.85,side:THREE.DoubleSide});
    for(const s of[-1,1]){
      const piv=new THREE.Group();piv.position.set(0.1*s,0.9,-bodyR(0.9)+0.02);body.add(piv);
      for(const[y,sz]of[[0.12,0.34],[-0.16,0.24]]){const w=new THREE.Mesh(new THREE.SphereGeometry(sz,12,8),wm);w.scale.set(1.3,0.8,0.08);w.position.set(0.3*s,y,0);w.rotation.z=0.4*s;piv.add(w);}
      piv.userData.s=s;out.wings.push(piv);
    }
  }
  return out;
}

/* ---------- rides ---------- */
function rideMesh(kind){
  const g=new THREE.Group();const fx=[];
  if(kind==='bike'){
    const wheels=[];for(const z of[-0.62,0.62]){const w=new THREE.Group();w.position.set(0,-0.08,z);w.add(rot(mk(new THREE.TorusGeometry(0.34,0.05,6,20),'#2B2040',{w:0.015}),0,Math.PI/2,0));
      for(let i=0;i<3;i++){const sp=box(0.02,0.66,0.02,'#C8D4E0',{ol:false});sp.rotation.x=i*Math.PI/3;w.add(sp);}g.add(w);wheels.push(w);}
    const frame=(a,b,c)=>{const d=new V3().subVectors(b,a),m=cyl(0.035,0.035,d.length(),'#FF5D73',6,{w:0.012});m.position.copy(a).add(b).multiplyScalar(0.5);m.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());g.add(m);};
    const P0=new V3(0,-0.08,-0.62),P1=new V3(0,0.28,-0.12),P2=new V3(0,0.3,0.44),P3=new V3(0,-0.08,0.62),P4=new V3(0,-0.05,0);
    frame(P0,P1);frame(P1,P2);frame(P2,P3);frame(P1,P4);frame(P4,P0);frame(P4,P2);
    g.add(at(box(0.28,0.07,0.36,'#2B2040',{w:0.015}),0,0.36,-0.14));g.add(at(box(0.7,0.04,0.04,'#2B2040',{ol:false}),0,0.72,0.5));frame(P2,new V3(0,0.72,0.5));
    g.add(at(box(0.22,0.14,0.18,'#8B5E3C',{w:0.015}),0,0.62,0.66));
    g.scale.setScalar(1.2);
    fx.push((t,moving)=>{wheels.forEach(w=>{if(moving)w.rotation.x=t*12;});});
  }else if(kind==='carpet'){
    const t=canvasTex(64,96,(x,W,H)=>{x.fillStyle='#8E2DA8';x.fillRect(0,0,W,H);x.strokeStyle='#FFD23F';x.lineWidth=4;x.strokeRect(5,5,W-10,H-10);x.fillStyle='#FF5D73';
      for(const [cx,cy] of[[32,48],[32,20],[32,76]]){x.beginPath();x.moveTo(cx,cy-9);x.lineTo(cx+9,cy);x.lineTo(cx,cy+9);x.lineTo(cx-9,cy);x.fill();}x.fillStyle='#3DDCC4';for(let i=0;i<6;i++)x.fillRect(10+i*8,10,4,4);});
    const geo=new THREE.PlaneGeometry(1.2,1.9,6,12);geo.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(geo,new THREE.MeshToonMaterial({map:t,gradientMap:gradTex,side:THREE.DoubleSide}));m.castShadow=true;g.add(m);
    for(const z of[-0.97,0.97])for(let i=0;i<5;i++)g.add(at(cone(0.03,0.12,'#FFD23F',4,{ol:false}),-0.48+i*0.24,0,z*1.03));
    const p=geo.attributes.position,base=p.array.slice();
    fx.push(t=>{for(let i=0;i<p.count;i++){const z=base[i*3+2],x=base[i*3];p.setY(i,Math.sin(z*3.2-t*5)*0.06+Math.sin(x*4+t*3)*0.02);}p.needsUpdate=true;});
  }else if(kind==='cloud'){
    for(const [x,y,z,r] of[[0,0,0,0.45],[0.38,-0.05,0.2,0.34],[-0.38,-0.05,-0.15,0.36],[0.12,-0.08,-0.48,0.32],[-0.15,-0.08,0.5,0.3],[0.3,0.05,-0.3,0.28]]){const s=sph(r,'#FFFFFF',10,8,{w:0.02});s.position.set(x,y-0.1,z);s.scale.y=0.7;g.add(s);}
    fx.push(t=>{g.rotation.y=Math.sin(t*0.8)*0.1;});
  }else if(kind==='rocket'){
    const r=new THREE.Group();r.rotation.x=Math.PI/2;g.add(r);r.position.y=-0.12;
    r.add(at(cyl(0.3,0.3,1.4,'#F4F6FB',16,{w:0.02}),0,0,0));r.add(at(cone(0.3,0.5,'#FF5D73',16,{w:0.02}),0,0.95,0));
    r.add(at(cyl(0.31,0.31,0.12,'#FF5D73',16,{ol:false}),0,-0.3,0));
    for(let i=0;i<3;i++){const f=box(0.05,0.36,0.34,'#FF5D73',{w:0.015});const a=i/3*TAU+Math.PI/2;f.position.set(Math.cos(a)*0.34,-0.55,Math.sin(a)*0.34);f.rotation.y=-a;r.add(f);}
    r.add(at(cyl(0.12,0.12,0.02,'#7CF4FF',12,{ol:false}),0.24,0.3,0.18).rotateZ(Math.PI/2));
    const fl=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.7,10),new THREE.MeshBasicMaterial({color:'#FF9F1C'}));fl.rotation.x=Math.PI;fl.position.y=-1.05;r.add(fl);
    const fl2=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.45,10),new THREE.MeshBasicMaterial({color:'#FFF07A'}));fl2.rotation.x=Math.PI;fl2.position.y=-0.95;r.add(fl2);
    fx.push((t,moving)=>{const k=(moving?1:0.5)*(0.8+0.25*Math.sin(t*30));fl.scale.set(1,k,1);fl2.scale.set(1,k,1);r.rotation.z=Math.sin(t*2)*0.05;});
  }else if(kind==='ufo'){
    const d=sph(0.8,'#C9D2E3',20,10,{w:0.025});d.scale.set(1,0.24,1);d.position.y=-0.12;g.add(d);
    const ring_=new THREE.Mesh(new THREE.TorusGeometry(0.78,0.04,6,32),new THREE.MeshBasicMaterial({color:'#7CF4FF'}));ring_.rotation.x=Math.PI/2;ring_.position.y=-0.12;g.add(ring_);
    const lights=[];for(let i=0;i<8;i++){const a=i/8*TAU;const l=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),new THREE.MeshBasicMaterial({color:'#FFD23F'}));l.position.set(Math.cos(a)*0.62,-0.18,Math.sin(a)*0.62);g.add(l);lights.push(l);}
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.55,0.8,16,1,true),new THREE.MeshBasicMaterial({color:'#B6FFF5',transparent:true,opacity:0.25,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=-0.6;g.add(beam);
    fx.push(t=>{lights.forEach((l,i)=>{l.material.color.setHSL(((t*0.5+i/8)%1),1,0.6);});d.rotation.y=t*1.5;});
  }else if(kind==='dragon'){
    // a friendly green dragon: you sit on its back between flapping wings
    const d=new THREE.Group();d.position.y=-0.25;g.add(d);
    const sk='#3DBE6C',bel='#FFE38A';
    const bodyM=sph(0.55,sk,14,10,{w:0.03});bodyM.scale.set(0.9,0.75,1.5);d.add(bodyM);
    const belly=sph(0.5,bel,12,8,{ol:false});belly.scale.set(0.75,0.6,1.3);belly.position.y=-0.1;d.add(belly);
    const neckG=new THREE.Group();neckG.position.set(0,0.2,0.7);d.add(neckG);
    neckG.add(rot(at(cyl(0.18,0.26,0.7,sk,10,{w:0.025}),0,0.25,0.12),0.5,0,0));
    const head=new THREE.Group();head.position.set(0,0.62,0.35);neckG.add(head);
    head.add(scl(sph(0.3,sk,12,10,{w:0.025}),1,0.85,1.2));head.add(at(scl(sph(0.2,sk,10,8,{w:0.02}),1,0.7,1.1),0,-0.06,0.3));
    for(const s of[-1,1]){head.add(at(sph(0.08,'#FFFFFF',8,6,{w:0.012}),0.16*s,0.1,0.2));head.add(at(sph(0.045,'#1D1533',6,5,{ol:false}),0.18*s,0.11,0.26));
      head.add(rot(at(cone(0.06,0.22,'#FFE38A',6,{w:0.012}),0.12*s,0.3,-0.12),-0.5,0,-0.3*s));head.add(at(sph(0.025,'#1D1533',4,3,{ol:false}),0.07*s,-0.02,0.5));}
    for(let i=0;i<5;i++)d.add(rot(at(cone(0.08,0.2,'#FFD23F',4,{w:0.012}),0,0.42-i*0.02,0.45-i*0.32),-0.2,0,0));
    const tail=new THREE.Group();tail.position.set(0,0,-0.8);d.add(tail);
    tail.add(rot(at(cone(0.24,1.1,sk,10,{w:0.025}),0,0.05,-0.5),-Math.PI/2-0.15,0,0));tail.add(rot(at(cone(0.14,0.22,'#FFD23F',4,{w:0.012}),0,0.2,-1.05),-Math.PI/2,0,0));
    const wm=new THREE.MeshToonMaterial({color:'#7FE0A0',gradientMap:gradTex,side:THREE.DoubleSide});
    const wings=[];for(const s of[-1,1]){const piv=new THREE.Group();piv.position.set(0.35*s,0.3,0.1);d.add(piv);
      const shp=new THREE.Shape();shp.moveTo(0,0.25);shp.lineTo(1.25,0.35);shp.lineTo(1.0,-0.05);shp.lineTo(0.75,0.1);shp.lineTo(0.5,-0.2);shp.lineTo(0.25,0);shp.lineTo(0,-0.25);
      const w=new THREE.Mesh(new THREE.ShapeGeometry(shp),wm);w.rotation.x=-Math.PI/2;w.scale.x=s;w.castShadow=true;piv.add(w);
      const bone=cyl(0.035,0.035,1.25,sk,5,{ol:false});bone.rotation.z=Math.PI/2;bone.position.set(0.62*s,0.01,-0.3);piv.add(bone);wings.push([piv,s]);}
    for(const [x,z] of[[-0.3,0.45],[0.3,0.45],[-0.3,-0.45],[0.3,-0.45]])d.add(at(scl(sph(0.13,sk,8,6,{w:0.02}),1,1.2,1),x,-0.42,z));
    fx.push((t,moving)=>{const sp=moving?7:3;wings.forEach(([p,s])=>{p.rotation.z=s*(0.15+Math.sin(t*sp)*(moving?0.55:0.3));});tail.rotation.y=Math.sin(t*2.5)*0.35;neckG.rotation.x=Math.sin(t*sp)*0.05;head.rotation.y=Math.sin(t*0.9)*0.25;d.position.y=-0.25+Math.sin(t*sp)*0.06;});
  }else{
    const deck=mk(new THREE.CylinderGeometry(0.5,0.5,0.1,20),'#FF5D73',{w:0.03});deck.scale.set(0.95,1,1.9);g.add(deck);
    const stripe=mk(new THREE.CylinderGeometry(0.5,0.5,0.02,20),'#FFFFFF',{ol:false});stripe.scale.set(0.3,1,1.8);stripe.position.y=0.055;g.add(stripe);
    const glow=new THREE.Mesh(new THREE.CircleGeometry(0.46,20),new THREE.MeshBasicMaterial({color:'#7CF4FF',transparent:true,opacity:0.8}));glow.rotation.x=Math.PI/2;glow.scale.set(0.9,1.8,1);glow.position.y=-0.06;g.add(glow);
    for(const z of[-0.6,0.6])g.add(at(cyl(0.12,0.16,0.08,'#2B2040',10,{ol:false}),0,-0.08,z));
  }
  g.userData.fx=fx;return g;
}
function nameTag(text,col){
  const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');
  if(x){x.font='900 30px Nunito, sans-serif';const w=Math.min(250,x.measureText(text).width+44);
    x.fillStyle='rgba(43,32,64,0.88)';rrect(x,(256-w)/2,8,w,48,24);x.fill();
    x.fillStyle=col;x.beginPath();x.arc((256-w)/2+20,32,8,0,TAU);x.fill();
    x.fillStyle='#FFFFFF';x.textAlign='left';x.textBaseline='middle';x.fillText(text,(256-w)/2+34,34);}
  const t=new THREE.CanvasTexture(c);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));
  s.scale.set(2.4,0.6,1);s.renderOrder=20;return s;
}
let beanSeq=0;
function makeBean(col,fitIn,name,into){
  const fit=safeFit(fitIn);
  // the rig holds everything but the name tag, so a ride trick can flip it all together
  const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);const body=new THREE.Group();rig.add(body);
  // an egg-shaped body with a white face, chunky arms and stubby feet
  const prof=[];for(let i=0;i<=22;i++){const y=BODY_TOP*i/22;prof.push(new THREE.Vector2(Math.max(bodyR(y),i===0||i===22?0:0.02),y));}
  const skin=mk(new THREE.LatheGeometry(prof,28),col,{w:0.035});body.add(skin);
  const face=faceMesh();body.add(face);
  const arms=[];
  for(const s of[-1,1]){const p=new THREE.Group();p.position.set(0.44*s,0.92,0.02);
    const a=mk(new THREE.CapsuleGeometry(0.15,0.3,5,10),col,{w:0.04});a.position.y=-0.27;p.add(a);p.rotation.z=0.3*s;body.add(p);arms.push(p);}
  body.position.y=LEG_LIFT;
  // legs swing from the hip, so a step lifts the foot and plants it again
  const bare=fit.s==='plain',footCol=bare?col:fit.s==='gold'?'#FFC52E':CLOTH_COLORS[fit.sc];
  const hips=[],feet=[];
  for(const s of[-1,1]){const hip=new THREE.Group();hip.position.set(0.22*s,0.42,0.06);rig.add(hip);hips.push(hip);
    const f=mk(new THREE.SphereGeometry(0.21,12,8),footCol,{w:0.03});f.scale.set(1.05,0.66,1.35);f.position.set(0,-0.3,0.02);hip.add(f);feet.push(f);
    onFoot(f,cyl(0.13,0.14,0.3,col,10,{w:0.022}),0,0.2,-0.03,1,1,1);}   // stubby leg
  // (the old spyglass antenna is gone; these stay so older code that turns it has something to turn)
  const ant=new THREE.Group(),scope=new THREE.Group();
  const dressed=dressBean(body,arms,feet,fit,col);
  // the ride, tucked away until you hop on
  const ride=rideMesh(rideOf(fit));ride.visible=false;ride.position.y=-0.2;rig.add(ride);
  const tag=nameTag(name||'',col);tag.position.y=2.55;g.add(tag);
  g.userData={rig,body,arms,feet,hips,ant,scope,face,board:ride,rideKind:rideOf(fit),tag,id:beanSeq++,col,fit,name,wings:dressed.wings,fx:dressed.fx,phase:0,lastT:0};
  (into||scene).add(g);return g;
}
function animBean(b,st,t){
  const u=b.userData;let bob=0,sq=1+0.025*Math.sin(t*2.5+u.id),sw=0,armA=0.25,spin=0,sway=0,lean=0;
  const dt=clamp(t-(u.lastT||t),0,0.1);u.lastT=t;
  const riding=!!st.hb,walking=!riding&&(st.an===1||st.an===2);
  // walking: a steady stride clock drives the legs, a side-to-side waddle, a bounce on each step and swinging arms
  if(walking){u.phase+=dt*(st.an===2?13:10);}
  const ph=u.phase,stride=walking?(st.an===2?0.7:0.55):0;
  for(let i=0;i<2;i++){
    const s=i?-1:1,hip=u.hips[i],f=u.feet[i];
    if(riding&&u.rideKind==='bike'){hip.rotation.x=-1.1+Math.sin(t*9+i*Math.PI)*0.45;hip.position.y=0.42;f.rotation.x=0.9;}
    else if(riding){hip.rotation.x=0;hip.position.y=0.42;f.rotation.x=0;}
    else{const a=Math.sin(ph+i*Math.PI);hip.rotation.x=-a*stride;
      // lift the foot while it swings forward, keep it flat on the ground while it pushes back
      hip.position.y=0.42+(walking?Math.max(0,Math.cos(ph+i*Math.PI))*0.1:0);f.rotation.x=-hip.rotation.x*0.8;}
    void s;
  }
  if(walking){bob=Math.abs(Math.sin(ph))*0.07;sway=Math.sin(ph)*0.07;lean=0.08;sw=Math.sin(ph)*0.75;sq=1+0.035*Math.cos(ph*2);}
  let mood=st.an===3?'wow':'happy';
  if(st.an===3){sq=1.13;armA=1.3;}
  if(riding){armA=u.rideKind==='bike'?0.6:0.55;if(u.rideKind==='bike')lean=0.3;}
  let a0x=sw,a0z=-armA,a1x=-sw,a1z=armA;
  if(riding&&u.rideKind==='bike'){a0x=a1x=-0.9;}
  const age=(Date.now()-(st.emAt||0))/1000;
  if(st.em&&age<2.8){
    if(st.em==='wave'){a1x=0;a1z=2.7+0.35*Math.sin(age*14);}
    else if(st.em==='point'){a1x=-1.55;a1z=0.15;}
    else if(st.em==='dance'){spin=age*8;a0z=-2.3+Math.sin(age*10)*0.3;a1z=2.3-Math.sin(age*10)*0.3;bob=Math.abs(Math.sin(age*10))*0.2;}
    else if(st.em==='shrug'){a0z=-1.3;a1z=1.3;a0x=a1x=-0.4;sq=0.94;}
    else if(st.em==='cheer'||st.em==='yay'){spin=age*11;bob=Math.abs(Math.sin(age*7))*0.7;a0z=-2.8;a1z=2.8;}
    mood={wave:'laugh',point:'wink',dance:'love',shrug:'huh',cheer:'laugh',yay:'laugh'}[st.em]||mood;
  }
  setFace(u,mood);
  // the ride
  const moving=riding&&(st.mv!==undefined?st.mv:true);
  if(u.board){u.board.visible=riding;if(riding){u.board.rotation.z=Math.sin(t*2.2+u.id)*0.05;u.board.position.y=RIDE_INFO[u.rideKind].base+(u.rideKind==='bike'?0:Math.sin(t*3+u.id)*0.04);
    for(const f of u.board.userData.fx)f(t,moving);}}
  u.body.position.y=LEG_LIFT+bob;
  const k=1/Math.sqrt(sq);u.body.scale.set(k,sq,k);
  u.body.rotation.set(lean,spin,sway);
  u.arms[0].rotation.set(a0x,0,a0z);u.arms[1].rotation.set(a1x,0,a1z);
  for(const w of u.wings)w.rotation.y=w.userData.s*(0.35+0.3*Math.sin(t*(st.an?9:4)+u.id));
  for(const f of u.fx)f(t,st);
  // ride tricks
  const rig=u.rig,tr=riding&&st.tk?TRICKS[u.rideKind]:null,ta=tr?(Date.now()-st.tk)/1000:9;
  if(tr&&ta>=0&&ta<tr.dur){
    if(u.lastTk!==st.tk){u.lastTk=st.tk;if(b.parent===scene){const p=b.position;burst(new V3(p.x,p.y+1.2,p.z),tr.fancy?60:30);}}
    const f=ta/tr.dur,e=f*f*(3-2*f),h=tr.hop*Math.sin(Math.PI*f);
    rig.rotation.set(tr.wheelie?-tr.wheelie*Math.min(1,Math.sin(Math.PI*f)*2.5):(tr.rx||0)*e,(tr.ry||0)*e,(tr.rz||0)*e);
    TK_V.set(0,tr.py||0,tr.pz||0);TK_W.copy(TK_V).applyEuler(rig.rotation);rig.position.set(TK_V.x-TK_W.x,TK_V.y-TK_W.y+h,TK_V.z-TK_W.z);
    if(tr.brz)u.board.rotation.z+=tr.brz*e;
    setFace(u,'laugh');if(u.rideKind!=='bike'){u.arms[0].rotation.set(0,0,-2.5);u.arms[1].rotation.set(0,0,2.5);}
  }else if(rig.position.y||rig.position.z||rig.rotation.x||rig.rotation.y||rig.rotation.z){rig.position.set(0,0,0);rig.rotation.set(0,0,0);}
}
