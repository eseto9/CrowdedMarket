/* =========================================================
   The world in motion: shelves and price boards, customers and
   their request bubbles, the rival beans and everyone's runners,
   what they carry, score pops over your stall, and the rings
   that show what you're pointing at. It only reads the game
   state; nothing here changes it.
   ========================================================= */
const WV={cust:new Map(),beans:new Map(),runners:new Map(),stalls:[],pops:[],hover:null,target:null,me:null};
const CHAR_SCALE=1.3;   // beans and customers are drawn a little larger than life, so you can read them from up here

/* ---------- stalls: goods on the counter, a name plate and a price board ---------- */
function worldStalls(s){
  const T=CM_TUNE,keys=Object.keys(T.GOODS);
  if(!WV.stalls.length)BD.stalls.forEach((S,i)=>{
    const g=new THREE.Group();g.position.copy(S.g.position);scene.add(g);
    const slots=keys.map((k,j)=>{const sg=new THREE.Group();sg.position.set((j-(keys.length-1)/2)*0.58,0.9,0);sg.scale.setScalar(1.3);g.add(sg);return {k,g:sg,n:-1};});
    // above the awning: the price board, and the owner's name plate on top
    const board=cmSprite(1.15);board.position.set(0,3.0,0);g.add(board);
    const plate=cmSprite(1.1);plate.position.set(0,4.2,0);g.add(plate);
    WV.stalls.push({g,slots,plate,board,owner:undefined});
  });
  s.stalls.forEach((st,i)=>{
    const V=WV.stalls[i];
    if(st.owner!==V.owner){V.owner=st.owner;const p=s.players[st.owner];V.plate.visible=!!p;V.board.visible=!!p;
      if(p){cmText(V.plate,p.id===CMG.me?'You':p.name,'name',p.col);stallColour(i,p.col);}else stallColour(i,'#B9B0C9');}   // nobody's: shut
    for(const sl of V.slots){const n=st.owner?st.stock[sl.k]||0:0;
      if(n!==sl.n){sl.n=n;sl.g.clear();for(let j=0;j<Math.min(n,3);j++){const m=cmGoodMesh(sl.k);m.position.set(0,j*0.13,(j-1)*0.22);sl.g.add(m);}}}
    if(st.owner){const txt=keys.filter(k=>st.stock[k]>0).map(k=>`${T.GOODS[k].icon}${st.price[k]}`).join('  ');cmText(V.board,txt||'sold out','tag');}
  });
}

/* ---------- customers ---------- */
const CUST_CLOTHES=['#FF9F1C','#4D96FF','#3DDC97','#9B5DE5','#F15BB5','#2EC4B6','#FF5D73','#B08968','#6B4FC8'];
const CUST_HATS=[null,'#2B2040','#FFD23F','#FFFFFF',null,'#FF5D73'];
const CUST_SKIN=['#F5C9A0','#E0AC80','#C68A5E','#8D5A3B','#FBD9BC'];
function custMesh(c){
  const k=c.look,m=npc(CUST_CLOTHES[k%CUST_CLOTHES.length],CUST_HATS[(k>>4)%CUST_HATS.length],CUST_SKIN[(k>>8)%CUST_SKIN.length]);
  m.scale.setScalar(CHAR_SCALE*0.85);
  const bub=cmSprite(1.4/(CHAR_SCALE*0.85));bub.position.y=2.2;m.add(bub);
  m.position.set(c.x,0,c.z);m.rotation.y=c.dir>0?Math.PI/2:-Math.PI/2;scene.add(m);
  m.traverse(o=>{if(o.isMesh)o.userData.cust=c.id;});
  return {m,bub,face:m.rotation.y,walk:Math.random()*6};
}
// a request bubble: what they still want and the most they'll spend (a shopping list shows the lot, on blue).
// On their way to pay: whose deal it is; orange if you could steal them.
function custBubble(c,s){
  const icons=gs=>gs.map(g=>CM_TUNE.GOODS[g].icon).join('');
  if(c.ph==='think')return [`🤔 ${icons(c.want)}`,'think'];
  if(c.ph==='go'){
    const p=s.players[c.deal.p],me=s.players[CMG.me];
    if(!p||c.deal.p===CMG.me)return [`👍 ${icons(c.deal.items)} ${c.deal.total}`,'happy'];
    const can=me&&CMG.on&&CMSim.stealDeal(s,me,c).ok;
    return [`👉 ${p.name} ${icons(c.deal.items)}${c.deal.total}`,can?'steal':'think'];
  }
  if(c.ph==='buy')return ['🪙','happy'];
  if(c.ph==='leave')return c.happy?['😊','happy']:['😞','sad'];
  return [`${icons(c.want)} ≤${c.budget}`,c.kind==='list'?'list':'bubble'];
}
function worldCustomers(s,dt){
  const seen=new Set();
  for(const c of s.cust){
    seen.add(c.id);let v=WV.cust.get(c.id);if(!v){v=custMesh(c);WV.cust.set(c.id,v);}
    const m=v.m,k=damp(12,dt),ox=m.position.x,oz=m.position.z;
    m.position.x=lerp(m.position.x,c.x,k);m.position.z=lerp(m.position.z,c.z,k);
    const vx=m.position.x-ox,vz=m.position.z-oz,moving=Math.hypot(vx,vz)>0.003;
    if(moving)v.face=Math.atan2(vx,vz);
    else if(c.ph==='buy'&&c.deal){const st=s.stalls[c.deal.stall];v.face=Math.atan2(st.x-c.x,st.z-c.z);}
    else if(c.ph==='browse'&&c.at!=null){const st=s.stalls[c.at];v.face=Math.atan2(st.x-c.x,st.z-c.z);}
    m.rotation.y=angLerp(m.rotation.y,v.face,damp(8,dt));
    if(moving)v.walk+=dt*9;
    m.position.y=moving?Math.abs(Math.sin(v.walk))*0.06:0;
    const sw=moving?Math.sin(v.walk)*0.6:0;m.userData.arms[0].rotation.x=sw;m.userData.arms[1].rotation.x=-sw;
    const [txt,sty]=custBubble(c,s);cmText(v.bub,txt,sty);
    const o=inReachOfMine(s,c)?1:0.42;v.bub.material.opacity=lerp(v.bub.material.opacity,o,damp(8,dt));   // faded: out of your reach
  }
  for(const [id,v] of WV.cust)if(!seen.has(id)){scene.remove(v.m);WV.cust.delete(id);}
}

/* ---------- beans ---------- */
function apron(bean,col){
  const a=box(0.62,0.5,0.06,'#FFFFFF',{w:0.02});a.position.set(0,0.62,bodyR(0.62)+0.01);a.rotation.x=-0.12;
  a.add(at(box(0.3,0.16,0.02,col,{ol:false,shadow:false}),0,-0.05,0.04));bean.userData.body.add(a);
}
function crate(){
  const g=new THREE.Group();g.add(at(box(0.62,0.3,0.4,'#C8935E',{w:0.025}),0,0,0));
  const it=new THREE.Group();it.position.y=0.15;g.add(it);g.userData={items:it,key:null};g.visible=false;return g;
}
function fillCrate(cr,carry){
  const list=[];for(const [k,n] of Object.entries(carry))for(let i=0;i<n;i++)list.push(k);
  const key=list.join(',');if(cr.userData.key===key)return;cr.userData.key=key;
  const it=cr.userData.items;it.clear();
  list.slice(0,6).forEach((k,i)=>{const m=cmGoodMesh(k);m.scale.setScalar(0.7);m.position.set(((i%3)-1)*0.18,Math.floor(i/3)*0.12,(Math.floor(i/3)?0.06:-0.06));it.add(m);});
  cr.visible=list.length>0;
}
// arms out front holding the crate (after animBean has posed them)
function holdPose(bean){const a=bean.userData.arms;a[0].rotation.set(-1.25,0,-0.35);a[1].rotation.set(-1.25,0,0.35);}
function beanFor(p,fit,isMe){
  const b=makeBean(p.col,fit||DEFAULT_FIT,isMe?'':p.name);if(isMe)b.userData.tag.visible=false;apron(b,p.col);
  b.scale.setScalar(CHAR_SCALE);
  const cr=crate();cr.position.set(0,0.95,0.55);b.userData.rig.add(cr);
  const say=cmSprite(1.1/CHAR_SCALE);say.position.y=2.75;say.visible=false;b.add(say);
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.5,0.66,28),new THREE.MeshBasicMaterial({color:new THREE.Color(p.col),transparent:true,opacity:0.9,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.03;ring.renderOrder=3;b.add(ring);
  b.position.set(p.x,0,p.z);
  return {b,cr,say,sayT:0,face:0};
}
function worldRivals(s,dt,ts){
  for(const id of s.order){
    const p=s.players[id];if(!p.ai)continue;
    let v=WV.beans.get(id);if(!v){v=beanFor(p,CM_TUNE.RIVALS[p.ai].fit);WV.beans.set(id,v);}
    const b=v.b,k=damp(16,dt),ox=b.position.x,oz=b.position.z;
    b.position.x=lerp(b.position.x,p.x,k);b.position.z=lerp(b.position.z,p.z,k);
    const sp=Math.hypot(b.position.x-ox,b.position.z-oz)/Math.max(dt,1e-3);
    if(sp>0.5)v.face=Math.atan2(b.position.x-ox,b.position.z-oz);
    else{const st=s.stalls[p.stall];if(Math.hypot(p.x-st.x,p.z-st.z)<3.5)v.face=angLerp(v.face,st.z<0?Math.PI:0,damp(3,dt));}
    b.rotation.y=angLerp(b.rotation.y,v.face,damp(12,dt));
    animBean(b,{an:sp>0.5?1:0,hb:false},ts);
    fillCrate(v.cr,p.carry);if(v.cr.visible)holdPose(b);
    if(v.sayT>0){v.sayT-=dt;if(v.sayT<=0)v.say.visible=false;}
  }
}
/* ---------- runners: small beans in their owner's colour, a basket when they've got something ---------- */
function worldRunners(s,dt,ts){
  const seen=new Set();
  for(const r of s.runners){
    seen.add(r.id);let v=WV.runners.get(r.id);
    if(!v){const p=s.players[r.owner];const b=makeBean(p.col,DEFAULT_FIT,'');b.userData.tag.visible=false;b.scale.setScalar(CHAR_SCALE*0.72);
      const cr=crate();cr.position.set(0,0.95,0.55);b.userData.rig.add(cr);b.position.set(r.x,0,r.z);scene.add(b);v={b,cr,face:0};WV.runners.set(r.id,v);}
    const b=v.b,k=damp(16,dt),ox=b.position.x,oz=b.position.z;
    b.position.x=lerp(b.position.x,r.x,k);b.position.z=lerp(b.position.z,r.z,k);
    const sp=Math.hypot(b.position.x-ox,b.position.z-oz)/Math.max(dt,1e-3);
    if(sp>0.4)v.face=Math.atan2(b.position.x-ox,b.position.z-oz);
    b.rotation.y=angLerp(b.rotation.y,v.face,damp(12,dt));
    animBean(b,{an:sp>0.4?1:0,hb:false},ts);
    fillCrate(v.cr,r.carry);if(v.cr.visible)holdPose(b);
  }
  for(const [id,v] of WV.runners)if(!seen.has(id)){scene.remove(v.b);WV.runners.delete(id);}
}
// a sale's score floats up over your stall: "+30" and how it was made
function scorePop(x,z,big,small){
  const a=cmSprite(1.1),b=cmSprite(0.62);cmText(a,big,'pop');cmText(b,small,'popSmall');
  a.position.set(x,3.4,z);b.position.set(x,2.8,z);scene.add(a,b);WV.pops.push({a,b,t:0});
}
function popsTick(dt){
  for(let i=WV.pops.length-1;i>=0;i--){const q=WV.pops[i];q.t+=dt;
    q.a.position.y+=dt*1.2;q.b.position.y+=dt*1.2;const o=Math.max(0,1-Math.max(0,q.t-0.9)/0.6);q.a.material.opacity=q.b.material.opacity=o;
    if(q.t>1.5){scene.remove(q.a,q.b);WV.pops.splice(i,1);}}
}
function beanSay(id,text){const v=WV.beans.get(id);if(!v)return;cmText(v.say,text,'say');v.say.visible=true;v.sayT=3.2;}

/* ---------- your sale range: customers inside this circle round your till can be pitched ---------- */
function reachZone(s){
  const me=s.players[CMG.me];if(!me){if(WV.zone)WV.zone.visible=false;return;}
  if(!WV.zone){
    const r=CM_TUNE.STALL_REACH,g=new THREE.Group();
    const fill=new THREE.Mesh(new THREE.CircleGeometry(r,64),new THREE.MeshBasicMaterial({transparent:true,opacity:0.13,depthWrite:false}));
    const edge=new THREE.Mesh(new THREE.RingGeometry(r-0.14,r,96),new THREE.MeshBasicMaterial({transparent:true,opacity:0.75,depthWrite:false}));
    for(const m of[fill,edge]){m.rotation.x=-Math.PI/2;m.renderOrder=1;g.add(m);}
    fill.position.y=0.03;edge.position.y=0.035;g.userData={fill,edge};scene.add(g);WV.zone=g;
  }
  const pa=CMSim.payAt(s.stalls[me.stall]),z=WV.zone;
  z.visible=true;z.position.set(pa.x,0,pa.z);z.scale.setScalar(CMSim.reachOf(me)/CM_TUNE.STALL_REACH);   // the bigger awning makes it bigger
  z.userData.fill.material.color.set(me.col);z.userData.edge.material.color.set(me.col);
}
const inReachOfMine=(s,c)=>{const me=s.players[CMG.me];if(!me)return true;const pa=CMSim.payAt(s.stalls[me.stall]);return Math.hypot(c.x-pa.x,c.z-pa.z)<=CMSim.reachOf(me);};

/* ---------- pointing: a ring under whatever the mouse is on, and one under what E would do ---------- */
const HOVER_RING=(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(0.62,0.82,32),new THREE.MeshBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.9,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.renderOrder=4;m.visible=false;scene.add(m);return m;})();
const TARGET_RING=(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(0.62,0.86,32),new THREE.MeshBasicMaterial({color:0xFFD23F,transparent:true,opacity:0.95,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.renderOrder=5;m.visible=false;scene.add(m);return m;})();
function thingPos(s,t){
  if(!t)return null;
  if(t.kind==='cust'){const v=WV.cust.get(t.id);return v?v.m.position:null;}
  if(t.kind==='sup'){const sp=s.sup[t.g];return {x:sp.x,z:sp.z};}
  if(t.kind==='stall'){const st=s.stalls[t.i];return CMSim.post(st);}
  if(t.kind==='ground')return t;
  return null;
}
function ringAt(ring,s,t,scale,ts){
  const p=thingPos(s,t);if(!p||t.kind==='ground'){ring.visible=false;return;}
  ring.visible=true;ring.position.set(p.x,0.05,p.z);
  const r=t.kind==='sup'?2.1:t.kind==='stall'?1.3:1;ring.scale.setScalar(r*scale*(1+0.06*Math.sin(ts*6)));
}

function worldSync(s,dt,ts){
  worldStalls(s);reachZone(s);worldCustomers(s,dt);worldRivals(s,dt,ts);worldRunners(s,dt,ts);popsTick(dt);
  if(P.bean){const me=s.players[CMG.me];fillCrate(WV.me.cr,me?me.carry:{});if(WV.me.cr.visible)holdPose(P.bean);}
  ringAt(HOVER_RING,s,CMG.hover,1,ts);
  ringAt(TARGET_RING,s,CMG.ctx&&CMG.ctx.thing,1,ts);
  if(CMG.hover&&CMG.ctx&&CMG.ctx.thing&&CMG.hover.kind===CMG.ctx.thing.kind&&CMG.hover.id===CMG.ctx.thing.id&&CMG.hover.g===CMG.ctx.thing.g)HOVER_RING.visible=false;
}
function worldClear(){
  for(const v of WV.cust.values())scene.remove(v.m);WV.cust.clear();
  for(const v of WV.beans.values())scene.remove(v.b);WV.beans.clear();
  for(const V of WV.stalls){V.owner=undefined;V.plate.visible=V.board.visible=false;for(const sl of V.slots){sl.n=-1;sl.g.clear();}}
  HOVER_RING.visible=TARGET_RING.visible=false;if(WV.zone)WV.zone.visible=false;
  for(const v of WV.runners.values())scene.remove(v.b);WV.runners.clear();
  for(const q of WV.pops)scene.remove(q.a,q.b);WV.pops=[];
}
