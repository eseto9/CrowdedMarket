/* =========================================================
   The board: one screen of Market Street built from CM_TUNE's
   map. Cobbled street across the middle, stalls above and below
   it, shops along the top, the harbour quay along the bottom,
   suppliers round the edges. Everything here stands still.
   ========================================================= */
const BD={stalls:[],sup:{},water:null};

function paveTex(base,line,n){
  const t=canvasTex(128,128,(x,W,H)=>{x.fillStyle=base;x.fillRect(0,0,W,H);x.strokeStyle=line;x.lineWidth=3;
    const s=W/n;for(let j=0;j<n;j++)for(let i=0;i<n;i++)x.strokeRect(i*s+(j%2?s/2:0),j*s,s,s);});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
function flat(w,d,mat,x,z,y){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.x=-Math.PI/2;m.position.set(x,y||0,z);m.receiveShadow=true;scene.add(m);return m;}

function buildGround(){
  const B=CM_TUNE.BOARD;
  flat(200,140,M('#86D25F'),0,0,-0.02);
  // the square: pale paving between the shops and the quay
  const pave=paveTex('#EADBC3','#D6C3A5',4);pave.repeat.set((B.x1-B.x0+4)/2.5,(B.z1-B.z0+1)/2.5);
  flat(B.x1-B.x0+4,B.z1-B.z0+1,MT(pave),0,(B.z0+B.z1)/2-0.5,0.005);
  // the street: cobbles right across, off both edges of the screen
  const cob=paveTex('#D8C0A0','#B99B77',6);cob.repeat.set(80/2,(B.street.z1-B.street.z0)/2);
  flat(80,B.street.z1-B.street.z0,MT(cob),0,0,0.01);
  for(const z of[B.street.z0,B.street.z1]){const k=box(80,0.14,0.3,'#C9B79C',{ol:false,shadow:false});k.position.set(0,0.07,z);scene.add(k);}
}

// the harbour along the bottom: a stone quay, water, a little pier and boats
function buildHarbour(){
  const B=CM_TUNE.BOARD;
  const edge=box(80,0.5,0.6,'#B8A58A',{w:0.03});edge.position.set(0,0.05,B.z1+0.3);scene.add(edge);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(200,60),new THREE.MeshToonMaterial({color:'#4FB6D8',gradientMap:gradTex,transparent:true,opacity:0.95}));
  water.rotation.x=-Math.PI/2;water.position.set(0,-0.35,B.z1+30.6);scene.add(water);BD.water=water;
  const plank=canvasTex(64,256,(x,W,H)=>{x.fillStyle='#C9A071';x.fillRect(0,0,W,H);x.fillStyle='#B48859';for(let i=0;i<16;i++)x.fillRect(0,i*16,W,3);});
  plank.wrapS=plank.wrapT=THREE.RepeatWrapping;plank.repeat.set(1,3);
  const pier=mk(new THREE.BoxGeometry(3.4,0.25,8),0,{mat:MT(plank)});pier.position.set(-1.2,0.02,B.z1+4.6);scene.add(pier);
  for(const z of[B.z1+2,B.z1+5,B.z1+8])for(const s of[-1,1])scene.add(at(cyl(0.16,0.16,1.4,'#8B5E3C',6),-1.2+1.6*s,-0.4,z));
  const boat=(x,z,col,ry)=>{const g=new THREE.Group();g.add(scl(at(box(1.6,0.6,3.6,col),0,0.1,0),1,1,1));g.add(at(box(1.3,0.12,3.2,'#F6E7C8',{ol:false}),0,0.42,0));
    g.add(at(cyl(0.06,0.06,2.6,'#8B5E3C',6),0,1.5,-0.3));const sail=mk(prismGeo(1.4,2,0.05),'#FFFFFF');sail.position.set(0,0.5,-0.3);sail.rotation.y=Math.PI/2;g.add(sail);
    g.position.set(x,-0.25,z);g.rotation.y=ry;scene.add(g);return g;};
  BD.boats=[boat(4.6,B.z1+4.4,'#FF5D73',0.1),boat(-8,B.z1+5.2,'#4D96FF',-0.2),boat(13,B.z1+4.2,'#FFD23F',0.3)];
}

// shops along the top, fronts facing the street
function shop(x,w,body,roof,label,labCol,door){
  const B=CM_TUNE.BOARD,d=6,z=B.z0-0.2-d/2;const g=new THREE.Group();
  g.add(at(box(w,4.2,d,body),0,2.1,0));
  const r=mk(prismGeo(w+0.6,2.2,d+0.6),roof);r.position.y=4.2;g.add(r);
  g.add(at(box(1.3,2.1,0.2,'#8A5A44',{w:0.03}),door,1.05,d/2+0.02));
  g.add(at(box(w*0.34,1.4,0.15,'#BFE9FF',{w:0.03}),door<0?w*0.18:-w*0.18,1.7,d/2+0.02));
  const aw=mk(new THREE.BoxGeometry(w*0.42,0.12,1.2),0,{mat:MT(stripeTex(roof,'#FFFFFF',8))});aw.position.set(door<0?w*0.18:-w*0.18,2.75,d/2+0.55);aw.rotation.x=0.35;g.add(aw);
  const s=signBox(label,w*0.7,0.8,labCol,'#2B2040');s.position.set(0,3.55,d/2+0.1);g.add(s);
  g.position.set(x,0,z);scene.add(g);return g;
}
function buildShops(){
  shop(-20.5,7,'#E3D5FF','#6B4FC8','Frock & Roll','#FFD23F',1.5);
  shop(-10.2,8,'#FFD6DC','#E84A6F','Knead to Know','#FFF3D6',-1.8);   // the bakery: its door is the bread supplier
  shop(-1.4,7.5,'#CFE4FF','#3F6FB5','Curl Up & Dye','#FFFFFF',1.8);
  shop(7.4,7.5,'#FFF0B3','#F29D38','Just Toying','#FF5D73',-1.6);
  shop(17.8,8,'#F7D9C4','#B25A2E','Pots & Kettles','#FFF3D6',-2);   // the pottery
  // off the ends, more town
  shop(-30,8,'#C9F2E1','#2F9E8F','The Codfather','#FFFFFF',1.5);
  shop(29,8,'#FFE0F0','#D65DB1','Petal Pushers','#FFFFFF',-1.5);
}

// trees, bushes and flower beds round the edges
function tree(x,z,s){const g=new THREE.Group();g.add(at(cyl(0.22,0.3,1.6,'#8B5E3C',7),0,0.8,0));g.add(at(sph(1.3,'#4CB85A',10,8),0,2.3,0));g.add(at(sph(0.9,'#5FCB6B',9,7),0.5,2.9,0.3));
  g.position.set(x,0,z);g.scale.setScalar(s||1);scene.add(g);}
function buildGreenery(){
  for(const [x,z,s] of [[-27,-9,1],[-28.5,-3.5,0.9],[-27.5,4.5,1.1],[-28,10,0.9],[27,-8.5,1],[28.5,-3.2,1.1],[27.5,4,0.9],[28,10.5,1],[-26,13.5,0.8],[26,13.5,0.8]])tree(x,z,s);
  for(const [x,z] of [[-24.6,-5.5],[-24.6,5.5],[24.6,-5.5],[24.6,5.5]]){const b=sph(0.7,'#4CB85A',8,6);b.position.set(x,0.45,z);b.scale.set(1,0.7,1.6);scene.add(b);}
}

// lamp posts, planters and a bench (the things in CM_TUNE.BOARD.posts and .boxes)
function buildFurniture(){
  const B=CM_TUNE.BOARD;
  for(const [x,z,r] of B.posts){
    const g=new THREE.Group();
    if(r<0.4){g.add(at(cyl(0.08,0.12,3,'#3B3F58',6),0,1.5,0));g.add(at(sph(0.28,'#FFF3C4',8,6),0,3.1,0));}
    else{g.add(at(cyl(r,r*0.85,0.7,'#C8703F',10),0,0.35,0));g.add(at(sph(r*0.95,'#4CB85A',8,6),0,0.9,0));
      for(let i=0;i<4;i++)g.add(at(sph(0.15,['#FF5D73','#FFD23F','#F15BB5','#9B5DE5'][i],5,4,{w:0.02}),Math.cos(i*1.6)*r*0.6,1.25,Math.sin(i*1.6)*r*0.6));}
    g.position.set(x,0,z);scene.add(g);
  }
  for(const [x0,x1,z0,z1] of B.boxes){const g=new THREE.Group();const w=x1-x0,d=z1-z0;
    g.add(at(box(w,0.12,d,'#C8935E'),0,0.5,0));g.add(at(box(w,0.5,0.1,'#C8935E'),0,0.8,-d/2));
    for(const s of[-1,1])g.add(at(box(0.1,0.5,d,'#3B3F58',{ol:false}),s*(w/2-0.2),0.25,0));
    g.position.set((x0+x1)/2,0,(z0+z1)/2);scene.add(g);}
}

/* ---------- stalls ---------- */
// row: -1 above the street (front faces the camera), 1 below it (we see its back, so its awning is see-through)
function stallMesh(x,z,a,b,closed){
  const T=CM_TUNE,B=T.BOARD,w=B.stall.w,d=B.stall.d,row=z<0?-1:1,g=new THREE.Group();
  g.add(at(box(w,0.9,d,closed?'#A98B6E':'#C8935E'),0,0.45,0));
  for(const sx of[-1,1])for(const sz of[-1,1])g.add(at(cyl(0.07,0.07,2.6,'#8B5E3C',6),(w/2-0.1)*sx,1.3,(d/2-0.05)*sz));
  const see=row>0;
  const mat=MT(stripeTex(a,b,8),see?{transparent:true,opacity:0.38,depthWrite:false}:undefined);
  const aw=mk(new THREE.BoxGeometry(w+0.5,0.12,d+0.9),0,{mat,ol:!see});aw.position.set(0,2.65,0);aw.rotation.x=0.14*row;g.add(aw);
  if(closed){   // shutters down and a sign
    g.add(at(box(w-0.2,0.8,0.08,'#8B6B4E',{w:0.02}),0,1.3,-row*(d/2-0.05)));
    const s=signBox('Closed',1.5,0.4,'#FFFFFF','#6B5F86');s.position.set(0,0.62,-row*(d/2+0.06));if(row>0)s.rotation.y=Math.PI;g.add(s);
  }
  g.position.set(x,0,z);scene.add(g);return g;
}
function buildStalls(){
  const B=CM_TUNE.BOARD;
  for(const d of B.closed)stallMesh(d.x,d.z,'#B9B0C9','#FFFFFF',true);
  B.stalls.forEach((d,i)=>{
    const g=stallMesh(d.x,d.z,'#FFD23F','#FFFFFF',false);   // recoloured for its owner when the day starts
    BD.stalls.push({g,d,row:d.z<0?-1:1,aw:g.children.find(m=>m.geometry&&m.geometry.parameters&&m.geometry.parameters.width===B.stall.w+0.5)});
  });
}
function stallColour(i,col){
  const S=BD.stalls[i];if(!S||!S.aw)return;
  const see=S.row>0;S.aw.material=MT(stripeTex(col,'#FFFFFF',8),see?{transparent:true,opacity:0.38,depthWrite:false}:undefined);
}

/* ---------- suppliers: a prop, a ring to stand in and a marker ---------- */
function cmGoodMesh(g){
  const o={w:0.02};const G=new THREE.Group();
  if(g==='fish'){G.add(scl(at(sph(0.13,'#8FB7D6',8,6,o),0,0.09,0),2.1,0.6,0.8));G.add(rot(at(cone(0.1,0.15,'#6E97BA',3,o),-0.32,0.09,0),0,0,Math.PI/2));}
  else if(g==='bread'){G.add(rot(at(cyl(0.09,0.09,0.55,'#E8B26A',8,o),0,0.09,0),0,0,Math.PI/2));}
  else if(g==='flowers'){G.add(at(cyl(0.025,0.025,0.36,'#4CB85A',5,{ol:false}),0,0.18,0));for(let i=0;i<3;i++)G.add(at(sph(0.08,['#F15BB5','#FFD23F','#9B5DE5'][i],6,4,o),Math.cos(i*2.1)*0.08,0.4,Math.sin(i*2.1)*0.08));}
  else if(g==='fruit'){G.add(at(sph(0.13,'#E8323F',8,6,o),0,0.13,0));G.add(at(cyl(0.012,0.012,0.08,'#5B3A29',4,{ol:false}),0,0.27,0));}
  else if(g==='cheese'){G.add(at(cyl(0.18,0.18,0.13,'#FFD23F',10,o),0,0.065,0));}
  else if(g==='teapot'){G.add(scl(at(sph(0.14,'#2EC4B6',10,8,o),0,0.13,0),1,0.85,1));G.add(rot(at(cyl(0.02,0.04,0.16,'#2EC4B6',5,{ol:false}),0.17,0.17,0),0,0,-0.9));G.add(at(sph(0.04,'#2EC4B6',5,4,{ol:false}),0,0.26,0));}
  return G;
}
const PROPS={
  bread(w,d){const g=new THREE.Group();g.add(at(box(w,0.6,d*0.8,'#B5793A'),0,0.3,0));for(let i=0;i<5;i++){const b=cmGoodMesh('bread');b.position.set(-w/2+0.25+i*(w-0.5)/4,0.62,0);b.rotation.y=Math.PI/2+0.2*i;g.add(b);}return g;},
  teapot(w,d){const g=new THREE.Group();
    g.add(at(cyl(0.95,1.15,1.6,'#C8703F',12),w/2-1.2,0.8,0));g.add(at(cone(1,0.9,'#B25A2E',12),w/2-1.2,2.05,0));g.add(at(cyl(0.18,0.2,0.9,'#8A4A2A',8),w/2-1.2,2.7,0));
    g.add(at(box(0.6,0.35,0.05,'#FF9F1C',{ol:false,shadow:false}),w/2-1.2,0.55,1.16));
    g.add(at(box(1.2,0.1,d*0.8,'#8B5E3C'),-w/2+0.6,0.85,0));for(const s of[-1,1])g.add(at(cyl(0.05,0.05,0.85,'#5B3A29',5,{ol:false}),-w/2+0.6+0.45*s,0.42,0));
    for(let i=0;i<3;i++){const t=cmGoodMesh('teapot');t.position.set(-w/2+0.6,0.9,-0.7+i*0.7);g.add(t);}return g;},
  flowers(w,d){const g=new THREE.Group();g.add(at(box(w*0.9,0.6,d*0.8,'#6BA3D6'),0,0.75,0));
    for(const s of[-1,1])g.add(rot(at(cyl(0.35,0.35,0.12,'#2B2040',12),w*0.5*s,0.35,d*0.2),0,0,Math.PI/2));
    for(let i=0;i<8;i++){const f=cmGoodMesh('flowers');f.scale.setScalar(1.5);f.position.set(-w*0.3+(i%2)*w*0.6*0.5+0.1,1.05,-d*0.32+Math.floor(i/2)*d*0.2);g.add(f);}
    const aw=mk(new THREE.BoxGeometry(w,0.1,d),0,{mat:MT(stripeTex('#F15BB5','#FFFFFF',8))});aw.position.set(0,2.1,0);g.add(aw);
    for(const s of[-1,1])g.add(at(cyl(0.04,0.04,1.3,'#8B5E3C',6,{ol:false}),w*0.4*s,1.4,-d*0.4));return g;},
  fruit(w,d){const g=new THREE.Group();g.add(at(box(w*0.9,0.8,d*0.85,'#B5793A'),0,0.4,0));
    const cols=['#E8323F','#FF9F1C','#FFE14D','#3E9E4A'];for(let i=0;i<8;i++){const f=cmGoodMesh('fruit');f.children[0].material=M(cols[i%4]);f.position.set(-w*0.25+(i%2)*w*0.4,0.8,-d*0.3+Math.floor(i/2)*d*0.2);g.add(f);}
    const aw=mk(new THREE.BoxGeometry(w,0.1,d),0,{mat:MT(stripeTex('#3DDC97','#FFFFFF',8))});aw.position.set(0,2.1,0);g.add(aw);
    for(const s of[-1,1])g.add(at(cyl(0.04,0.04,1.3,'#8B5E3C',6,{ol:false}),w*0.4*s,1.4,-d*0.4));return g;},
  cheese(w,d){const g=new THREE.Group();g.add(at(box(w*0.85,0.8,d*0.9,'#FFFFFF'),0,0.85,0));g.add(at(box(w*0.86,0.2,d*0.91,'#4D96FF',{ol:false}),0,1.0,0));
    for(const s of[-1,1])g.add(rot(at(cyl(0.35,0.35,0.12,'#2B2040',12),w*0.45*s,0.35,d*0.3),0,0,Math.PI/2));
    for(let i=0;i<3;i++){const c=cmGoodMesh('cheese');c.scale.setScalar(1.5);c.position.set(0,1.27,-d*0.3+i*d*0.3);g.add(c);}return g;},
  fish(w,d){const g=new THREE.Group();g.add(at(box(w,0.45,d,'#E6F7FF'),0,0.22,0));for(let i=0;i<3;i++){const f=cmGoodMesh('fish');f.position.set(0,0.45,-d/3+i*d/3);f.rotation.y=Math.PI/2*0.2;g.add(f);}
    g.add(at(box(0.8,0.55,0.7,'#B5793A'),-w/2-0.9,0.28,-0.1));return g;},
};
// text on a sprite: bubbles, signs and price boards. world:false keeps the same size on screen.
const CM_STYLES={
  bubble:{bg:'#FFFFFF',fg:'#2B2040',r:26,tail:true},
  think:{bg:'#FFF3D6',fg:'#2B2040',r:26,tail:true},
  happy:{bg:'#3DDC97',fg:'#2B2040',r:26,tail:true},
  sad:{bg:'#C9BEE8',fg:'#2B2040',r:26,tail:true},
  tag:{bg:'#FFD23F',fg:'#2B2040',r:16},
  say:{bg:'#2B2040',fg:'#FFFFFF',r:26,tail:true},
  sign:{bg:'#FFF3D6',fg:'#2B2040',r:18},
  name:{bg:'#2B2040',fg:'#FFFFFF',r:30},
};
function cmSprite(h){
  const c=document.createElement('canvas');c.width=64;c.height=64;
  const m=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false});
  const s=new THREE.Sprite(m);s.renderOrder=20;s.userData={c,key:'',h};s.center.set(0.5,0);return s;
}
function cmText(s,text,style,col){
  const key=text+'|'+style+'|'+(col||'');if(s.userData.key===key)return;s.userData.key=key;
  const st=CM_STYLES[style]||CM_STYLES.bubble,c=s.userData.c,H=96,pad=28,tail=st.tail?18:0,dot=col?34:0;
  let x=c.getContext('2d');if(!x)return;
  const font='900 50px Nunito, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';x.font=font;
  const w=Math.min(1400,Math.ceil(x.measureText(text).width)+pad*2+dot);
  c.width=w+8;c.height=H+tail+8;x=c.getContext('2d');x.font=font;
  x.fillStyle=st.bg;x.strokeStyle='#2B2040';x.lineWidth=6;
  rrect(x,4,4,w,H,st.r);x.fill();x.stroke();
  if(tail){x.beginPath();x.moveTo(c.width/2-14,H+2);x.lineTo(c.width/2,H+tail+2);x.lineTo(c.width/2+14,H+2);x.closePath();x.fill();x.stroke();x.fillRect(c.width/2-12,H-4,24,6);}
  if(col){x.fillStyle=col;x.beginPath();x.arc(4+pad+10,4+H/2,13,0,TAU);x.fill();x.lineWidth=4;x.stroke();}
  x.fillStyle=st.fg;x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2+dot/2,4+H/2+2);
  const m=s.material;m.map.dispose();m.map=new THREE.CanvasTexture(c);m.needsUpdate=true;
  const hh=s.userData.h;s.scale.set(hh*c.width/c.height,hh,1);
}
function buildSuppliers(){
  for(const [g,sp] of Object.entries(CM_TUNE.SUPPLIERS)){
    const G=CM_TUNE.GOODS[g],[x0,x1,z0,z1]=sp.prop;
    const prop=PROPS[g](x1-x0,z1-z0);prop.position.set((x0+x1)/2,0,(z0+z1)/2);scene.add(prop);
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.25,1.55,40),new THREE.MeshBasicMaterial({color:0xFFD23F,transparent:true,opacity:0.85,depthWrite:false}));
    ring.rotation.x=-Math.PI/2;ring.position.set(sp.x,0.04,sp.z);ring.renderOrder=2;scene.add(ring);
    const mark=cmSprite(1.35);cmText(mark,`${G.icon} ${G.cost}`,'sign');mark.position.set(sp.x,2.4,sp.z);scene.add(mark);
    BD.sup[g]={prop,ring,mark};
  }
}

function buildBoard(){
  buildGround();buildHarbour();buildShops();buildGreenery();buildFurniture();buildStalls();buildSuppliers();
}
function boardTick(t){
  if(BD.water)BD.water.position.y=-0.35+Math.sin(t*0.8)*0.04;
  if(BD.boats)BD.boats.forEach((b,i)=>{b.rotation.z=Math.sin(t*1.1+i)*0.05;b.position.y=-0.25+Math.sin(t*0.9+i*2)*0.06;});
  for(const k in BD.sup){const r=BD.sup[k].ring;r.material.opacity=0.6+0.25*Math.sin(t*2.4);}
}
