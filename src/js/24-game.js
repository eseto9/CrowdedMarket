/* =========================================================
   The game: the title screen (with a demo market running behind
   it), starting and ending a day, the local authority loop (your
   moves, the AI, the clock), moving your bean, and what clicks
   and keys do. In single player this page is the authority: it
   runs CMSim.tick; a multiplayer host will do the same later.
   ========================================================= */
const CMG={on:false,s:null,init:null,me:'me',mems:[],log:[],queue:[],acc:0,lastFid:0,ctx:null,hover:null,goal:null,bell:0,demo:null,
  cfg:{name:'',col:BEAN_COLORS[5],diff:'normal'}};
try{const c=JSON.parse(localStorage.getItem('cm.me')||'{}');if(typeof c.name==='string')CMG.cfg.name=clean(c.name);if(BEAN_COLORS.includes(c.col))CMG.cfg.col=c.col;if(CM_TUNE.AI.think[c.diff])CMG.cfg.diff=c.diff;}catch(e){}
function clean(s,n){return String(s==null?'':s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g,'').trim().slice(0,n||14);}
// your bean
const P={pos:new V3(),vel:new V3(),face:0,bean:null,dashT:0,dashCD:0,an:0,em:null,emAt:0};

/* ---------- the title screen ---------- */
{const wm=$('#wordmark');'Crowded Market'.split('').forEach((ch,i)=>{const s=document.createElement('span');s.textContent=ch===' '?' ':ch;s.style.animationDelay=(i*0.04)+'s';s.setAttribute('aria-hidden','true');wm.appendChild(s);});}
function titleRender(){
  $('#nameIn').value=CMG.cfg.name;
  const sw=$('#swatches');sw.textContent='';
  for(const c of BEAN_COLORS){if(Object.values(CM_TUNE.RIVALS).some(r=>r.col===c))continue;   // the rivals' colours are taken
    const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;b.setAttribute('aria-label','Colour '+c);b.setAttribute('aria-pressed',c===CMG.cfg.col);
    b.onclick=()=>{CMG.cfg.col=c;titleRender();};sw.appendChild(b);}
  for(const b of $('#diffSeg').children)b.setAttribute('aria-pressed',b.dataset.diff===CMG.cfg.diff);
}
$('#diffSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;CMG.cfg.diff=b.dataset.diff;titleRender();});
$('#nameIn').addEventListener('input',e=>{CMG.cfg.name=clean(e.target.value);});
$('#nameIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();gameStart();}});
$('#startBtn').addEventListener('click',()=>gameStart());
titleRender();

// behind the title: two shopkeepers trading on their own, so the board is alive
function demoStart(){
  const R=CM_TUNE.RIVALS.undercutter;
  const s=CMSim.newState({seed:1+Math.floor(Math.random()*1e9),players:[{id:'d1',name:R.name,col:R.col,ai:'undercutter'},{id:'d2',name:'Otto',col:'#4D96FF',ai:'undercutter'}]});
  CMG.demo={s,mems:s.order.map((id,i)=>CMAI.newMem(id,'undercutter','normal',77+i)),acc:0};
}
function demoFrame(dt,ts){
  const D=CMG.demo;if(!D)return;
  D.acc+=dt;let n=0;
  while(D.acc>=CM_TUNE.DT&&n<5){for(const m of D.mems)for(const a of CMAI.step(D.s,m))CMSim.applyAction(D.s,a);CMSim.tick(D.s);D.acc-=CM_TUNE.DT;n++;}
  if(n===5)D.acc=0;
  if(D.s.phase!=='day'){worldClear();demoStart();return;}
  worldSync(D.s,dt,ts);
}

/* ---------- a trading day ---------- */
function gameStart(){
  if(!$('#loading').hidden)return;   // the board isn't built yet
  audioInit();
  const cfg=CMG.cfg;cfg.name=clean($('#nameIn').value)||cfg.name||'Bean '+Math.floor(Math.random()*90+10);
  try{localStorage.setItem('cm.me',JSON.stringify(cfg));}catch(e){}
  CMG.demo=null;worldClear();
  const R=CM_TUNE.RIVALS.undercutter;
  const seed=1+Math.floor(Math.random()*2147483646);
  CMG.init={seed,diff:cfg.diff,players:[{id:'me',name:cfg.name,col:cfg.col},{id:'u',name:R.name,col:R.col,ai:'undercutter'}]};
  CMG.s=CMSim.newState(CMG.init);
  CMG.mems=CMG.s.order.filter(id=>CMG.s.players[id].ai).map((id,i)=>CMAI.newMem(id,CMG.s.players[id].ai,cfg.diff,seed+i+1));
  Object.assign(CMG,{log:[],queue:[],acc:0,lastFid:0,goal:null,hover:null,ctx:null,bell:0,on:true});
  const me=CMG.s.players.me;
  WV.me=beanFor(me,DEFAULT_FIT,true);P.bean=WV.me.b;scene.add(P.bean);
  P.pos.set(me.x,0,me.z);P.vel.set(0,0,0);P.face=CMG.s.stalls[me.stall].z<0?0:Math.PI;P.dashT=P.dashCD=0;
  $('#title').hidden=true;$('#hud').hidden=false;hudReset();
  feed('🌅 Morning! Your stall has your name over it.','big');
  feed(`${R.name} (${R.title}) runs the stall next to yours.`,'rival');
  feed('Fetch stock from the suppliers round the edge, shelve it, then pitch to customers.');
  toast('🌅 Morning!\nThe market is open',2200);sfx.chime();
  // the keys panel shows for the start of the day, then gets out of the way (H brings it back)
  clearTimeout(HUD.keysT);if(!HUD.keysHidden)HUD.keysT=setTimeout(()=>{if(CMG.on)$('#keys').hidden=true;},25000);
}
function gameExit(again){
  CMG.on=false;CMG.s=null;CMG.goal=null;
  worldClear();
  if(P.bean){scene.remove(P.bean);P.bean=null;WV.me=null;}
  $('#hud').hidden=true;$('#recap').hidden=true;
  if(!again){$('#title').hidden=false;titleRender();demoStart();}
}
$('#exitBtn').addEventListener('click',()=>{
  const b=$('#exitBtn');
  if(CMG.s&&CMG.s.phase==='day'&&!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Tap again to leave';
    setTimeout(()=>{b.classList.remove('armed');b.textContent='🚪 Leave';},3000);return;}
  b.classList.remove('armed');b.textContent='🚪 Leave';gameExit(false);
});

// one step of the simulation: where you are, then what you did since the last step, the AI's moves, the clock
function gameStep(){
  const s=CMG.s;
  const act=a=>{CMG.log.push([s.tick,a]);return CMSim.applyAction(s,a);};
  act({type:'move',player:CMG.me,x:Math.round(P.pos.x*100)/100,z:Math.round(P.pos.z*100)/100});
  for(const q of CMG.queue.splice(0)){
    const r=act(q.a);
    if(r.ok){if(q.ok)q.ok(r);}
    else if(r.reason!=='pricey'&&WHY[r.reason]){toast(WHY[r.reason],1200);sfx.thud();}
  }
  for(const m of CMG.mems)for(const a of CMAI.step(s,m))act(a);
  CMSim.tick(s);
}
// your own actions wait for the next step, so they're judged from where you've just moved to
const WHY={far:'Too far away',full:'Your arms are full!',broke:'Not enough coins',empty:'Nothing to shelve',shelffull:'The shelf is full',
  nostock:'You don’t have that on your shelf',reach:'They’re too far from your stall',already:'You just pitched them',busy:'They’re busy',gone:'They’ve gone',belowcost:'Can’t sell below cost'};
function cmAct(a,ok){
  const s=CMG.s;if(!s||s.phase!=='day')return;
  a.player=CMG.me;CMG.queue.push({a,ok});
}

/* ---------- moving your bean ---------- */
function gameDash(){
  if(!CMG.on||P.dashCD>0)return;
  P.dashT=CM_TUNE.DASH.time;P.dashCD=CM_TUNE.DASH.cool;sfx.zoom();
  const f=new V3(Math.sin(P.face),0,Math.cos(P.face));burst(new V3(P.pos.x-f.x*0.5,0.2,P.pos.z-f.z*0.5),4);
}
function playerTick(dt){
  const T=CM_TUNE,s=CMG.s;
  P.dashT=Math.max(0,P.dashT-dt);P.dashCD=Math.max(0,P.dashCD-dt);
  let dir=s.phase==='day'?keyDir():null;
  if(dir)CMG.goal=null;   // the keys take over from a click-to-walk
  else if(CMG.goal)dir=goalDir(s,dt);
  const speed=P.dashT>0?T.DASH.speed:T.WALK;
  if(P.dashT>0&&!dir)dir={x:Math.sin(P.face),z:Math.cos(P.face)};
  const tx=dir?dir.x*speed:0,tz=dir?dir.z*speed:0,k=damp(P.dashT>0?30:16,dt);
  P.vel.x=lerp(P.vel.x,tx,k);P.vel.z=lerp(P.vel.z,tz,k);
  const [x,z]=CMSim.collide(P.pos.x+P.vel.x*dt,P.pos.z+P.vel.z*dt);
  P.pos.x=x;P.pos.z=z;
  const hs=Math.hypot(P.vel.x,P.vel.z);
  if(hs>0.5)P.face=angLerp(P.face,Math.atan2(P.vel.x,P.vel.z),damp(14,dt));
  P.an=P.dashT>0?2:hs>0.8?1:0;
  P.bean.position.set(P.pos.x,0,P.pos.z);P.bean.rotation.y=P.face;
}
// click-to-walk: follow a path to the thing, and do the thing when close enough
function thingPoint(s,t){
  if(t.kind==='sup')return s.sup[t.g];
  if(t.kind==='stall')return CMSim.post(s.stalls[t.i]);
  if(t.kind==='cust'){const c=s.cust.find(c=>c.id===t.id);return c?{x:c.x,z:c.z}:null;}
  return t;
}
function inReach(s,t){
  const T=CM_TUNE,px=P.pos.x,pz=P.pos.z;
  if(t.kind==='sup'){const sp=s.sup[t.g];return Math.hypot(px-sp.x,pz-sp.z)<=T.SUPPLIER_RANGE-0.3;}
  if(t.kind==='stall'){const b=CMSim.post(s.stalls[t.i]);return Math.hypot(px-b.x,pz-b.z)<=0.6;}
  if(t.kind==='cust'){const c=s.cust.find(c=>c.id===t.id);return !!c&&Math.hypot(px-c.x,pz-c.z)<=T.PITCH_RANGE-0.4;}
  return Math.hypot(px-t.x,pz-t.z)<=0.25;
}
function walkTo(s,t,then){
  const p=thingPoint(s,t);if(!p)return;
  CMG.goal={t,then,path:CMNav.path(CMNav.boardGrid(),P.pos.x,P.pos.z,p.x,p.z),re:0};
}
function goalDir(s,dt){
  const G=CMG.goal;
  if(inReach(s,G.t)){CMG.goal=null;if(G.then)G.then();return null;}
  if(G.t.kind==='cust'){   // they keep walking: re-plan now and then
    G.re-=dt;if(G.re<=0){const p=thingPoint(s,G.t);if(!p||!(['walk','browse','think'].includes((s.cust.find(c=>c.id===G.t.id)||{}).ph))){CMG.goal=null;return null;}
      G.path=CMNav.path(CMNav.boardGrid(),P.pos.x,P.pos.z,p.x,p.z);G.re=0.35;}}
  while(G.path.length&&Math.hypot(G.path[0][0]-P.pos.x,G.path[0][1]-P.pos.z)<0.25)G.path.shift();
  if(!G.path.length){CMG.goal=null;return null;}
  const [x,z]=G.path[0],d=Math.hypot(x-P.pos.x,z-P.pos.z);return {x:(x-P.pos.x)/d,z:(z-P.pos.z)/d};
}

/* ---------- what E does, what a click does ---------- */
function nearestCustomer(s){
  const T=CM_TUNE;let best=null,bd=Infinity;
  const hov=CMG.hover&&CMG.hover.kind==='cust'?CMG.hover.id:null;
  for(const c of s.cust){
    if(c.ph!=='walk'&&c.ph!=='browse'&&c.ph!=='think')continue;
    const d=Math.hypot(c.x-P.pos.x,c.z-P.pos.z);if(d>T.PITCH_RANGE)continue;
    const sc=c.id===hov?-1:d;if(sc<bd){bd=sc;best=c;}
  }
  return best;
}
function custLine(s,c){
  const T=CM_TUNE,st=s.stalls[s.players[CMG.me].stall],w=c.want[0],G=T.GOODS[w.item],have=st.stock[w.item]||0,price=st.price[w.item];
  const pa=CMSim.payAt(st);
  if(Math.hypot(c.x-pa.x,c.z-pa.z)>T.STALL_REACH)return {text:`Wants ${G.icon} (up to ${w.max}), but they’re too far from your stall`,tone:'bad',ok:false};
  if(!have)return {text:`Wants ${G.icon} ${G.name} (up to ${w.max}). You have none!`,tone:'bad',ok:false};
  if(price>w.max)return {text:`Wants ${G.icon} up to ${w.max}. Yours is ${price}: too pricey`,tone:'bad',ok:true};
  return {text:`Pitch ${G.icon} for 🪙${price}`,sub:`they’ll pay up to ${w.max}`,tone:'good',ok:true};
}
function context(s){
  const T=CM_TUNE,me=s.players[CMG.me],mine=me.stall,st=s.stalls[mine],held=CMSim.carried(me),px=P.pos.x,pz=P.pos.z;
  for(const [g,sp] of Object.entries(s.sup)){
    if(Math.hypot(px-sp.x,pz-sp.z)>T.SUPPLIER_RANGE)continue;
    const G=T.GOODS[g],thing={kind:'sup',g};
    if(held>=T.CARRY)return {thing,text:'Your arms are full. Take it to your stall!',tone:'bad'};
    if(me.coins<G.cost)return {thing,text:`${G.icon} costs ${G.cost}. You only have ${me.coins} 🪙`,tone:'bad'};
    return {thing,act:'buy',key:'E',text:`Buy ${G.icon} ${G.name} · 🪙${G.cost} each`,sub:`${held}/${T.CARRY} carried · Shift+E: an armful`};
  }
  const at=CMSim.atStall({x:px,z:pz},st);
  if(at&&held)return {thing:{kind:'stall',i:mine},act:'shelve',key:'E',text:`Put ${held} thing${held>1?'s':''} on your shelf`,tone:'good'};
  const c=nearestCustomer(s);
  if(c){const l=custLine(s,c);return Object.assign({thing:{kind:'cust',id:c.id},act:l.ok?'pitch':null,key:l.ok?'E':null},l);}
  if(at)return {thing:{kind:'stall',i:mine},text:'Your stall. Fetch stock round the edges, then pitch to passing customers.'};
  return null;
}
// what the pointer is on: a customer, a supplier, a stall, or just the ground
function hoverAt(s,nx,ny){
  const id=custAt(nx,ny);if(id){const c=s.cust.find(c=>c.id===id);if(c&&c.ph!=='leave')return {kind:'cust',id};}
  const g=groundAt(nx,ny);if(!g)return null;
  for(const [k,sp] of Object.entries(CM_TUNE.SUPPLIERS)){const [x0,x1,z0,z1]=sp.prop;
    if(Math.hypot(g.x-sp.x,g.z-sp.z)<1.8||(g.x>x0-0.4&&g.x<x1+0.4&&g.z>z0-0.4&&g.z<z1+0.4))return {kind:'sup',g:k};}
  const B=CM_TUNE.BOARD;
  for(let i=0;i<s.stalls.length;i++){const st=s.stalls[i],b=CMSim.post(st);
    if((Math.abs(g.x-st.x)<B.stall.w/2+0.6&&Math.abs(g.z-st.z)<B.stall.d/2+0.6)||Math.hypot(g.x-b.x,g.z-b.z)<0.9)return {kind:'stall',i};}
  return {kind:'ground',x:g.x,z:g.z};
}
function hoverLine(s,h){
  const T=CM_TUNE;if(!h)return null;
  if(h.kind==='sup'){const G=T.GOODS[h.g];return {text:`Click: go to ${T.SUPPLIERS[h.g].name} (${G.icon} ${G.cost} each)`};}
  if(h.kind==='stall'){const st=s.stalls[h.i],p=s.players[st.owner];
    if(!p)return {text:'An empty stall'};
    if(p.id!==CMG.me)return {text:`${p.name}’s stall`};
    return {text:CMSim.carried(s.players[CMG.me])?'Click: go and shelve what you’re carrying':'Click: back to your stall'};}
  if(h.kind==='cust'){const c=s.cust.find(c=>c.id===h.id);if(!c)return null;const l=custLine(s,c);return {text:(l.ok?'Click to pitch · ':'')+l.text,tone:l.tone};}
  return null;
}
function doThing(s,t,all){
  const T=CM_TUNE;
  if(t.kind==='sup')cmAct({type:'buy',item:t.g,n:all?T.CARRY:1},()=>sfx.pop());
  else if(t.kind==='stall'){
    if(t.i!==s.players[CMG.me].stall){const p=s.players[s.stalls[t.i].owner];toast(p?`That’s ${p.name}’s stall`:'An empty stall',1100);return;}
    if(CMSim.carried(s.players[CMG.me]))cmAct({type:'shelve'},()=>{sfx.blip();burst(new V3(s.stalls[t.i].x,1.4,s.stalls[t.i].z),10);});
  }
  else if(t.kind==='cust')cmAct({type:'pitch',cust:t.id},()=>{sfx.tick();P.em='point';P.emAt=Date.now();});
}
function gameAct(all){
  const s=CMG.s;if(!s||s.phase!=='day')return;
  const ctx=CMG.ctx;if(!ctx)return;
  if(ctx.act)doThing(s,ctx.thing,all);
  else if(ctx.text&&ctx.tone==='bad'){toast(ctx.text.split('. ')[0],1300);sfx.thud();}
}
function gameClick(nx,ny,shift){
  const s=CMG.s;if(!s||s.phase!=='day')return;
  const h=hoverAt(s,nx,ny);if(!h)return;
  if(h.kind==='ground'){if(!CMSim.blocked(h.x,h.z))walkTo(s,h);return;}
  if(h.kind==='stall'&&h.i!==s.players[CMG.me].stall){doThing(s,h);return;}
  if(inReach(s,h)||(h.kind==='sup'&&Math.hypot(P.pos.x-s.sup[h.g].x,P.pos.z-s.sup[h.g].z)<=CM_TUNE.SUPPLIER_RANGE)||(h.kind==='cust'&&(()=>{const c=s.cust.find(c=>c.id===h.id);return c&&Math.hypot(P.pos.x-c.x,P.pos.z-c.z)<=CM_TUNE.PITCH_RANGE;})()))doThing(s,h,shift);
  else walkTo(s,h,()=>doThing(CMG.s,h,shift));
}
// the market's keys
function gameKey(e){
  if(e.code==='KeyE'){gameAct(e.shiftKey);return;}
  if(e.code==='Space'){gameDash();return;}
  if(e.code==='Tab'){$('#tab').hidden=false;if(CMG.s)tabRender(CMG.s);return;}
  if(e.code==='KeyH'){HUD.keysHidden=!HUD.keysHidden;$('#keys').hidden=HUD.keysHidden;try{localStorage.setItem('cm.keys',HUD.keysHidden?'0':'1');}catch(err){}return;}
  if(e.code==='KeyM'){toggleMute();return;}
  if(/^Digit[1-5]$/.test(e.code)){P.em=['wave','point','dance','shrug','cheer'][+e.code.slice(5)-1];P.emAt=Date.now();}
}
function gameKeyUp(e){if(e.code==='Tab')$('#tab').hidden=true;}

/* ---------- what happened: the feed, sounds and bubbles ---------- */
function onEvent(s,e){
  const T=CM_TUNE,who=id=>id===CMG.me?'You':(s.players[id]||{name:'?'}).name,mine=e.p===CMG.me,cls=mine?'me':'rival';
  switch(e.k){
    case 'sale':{
      const st=s.stalls[s.players[e.p].stall];
      if(mine){sfx.coin();burst(new V3(st.x,1.6,st.z),16);feed(`🪙 Sold ${icon(e.item)} for ${e.price}`,'me');}
      else feed(`${who(e.p)} sold ${icon(e.item)} for ${e.price}`,'rival');
      break;
    }
    case 'undercut':feed(mine?`You dropped ${icon(e.item)} to ${e.price}`:`${who(e.p)} dropped ${icon(e.item)} to ${e.price}`,cls);if(!mine)sfx.tick();break;
    case 'price':if(mine)feed(`${icon(e.item)} is now ${e.price}`,'me');break;
    case 'buy':feed(mine?`Bought ${icon(e.item)}×${e.n} for 🪙${e.cost}`:`${who(e.p)} stocked up on ${icon(e.item)}`,cls);break;
    case 'shelve':if(mine)feed(`Shelved ${e.n} thing${e.n>1?'s':''}`,'me');break;
    case 'pricey':if(mine){const c=s.cust.find(c=>c.id===e.cust);toast(c?`Too pricey!\nThey’ll pay up to ${c.want[0].max}`:'Too pricey!',1500);sfx.thud();}break;
    case 'chose':{
      const c=s.cust.find(c=>c.id===e.cust);
      if(mine){toast(`They’ll take it!\n${icon(e.item)} for ${e.price}`,1300);sfx.hint();}
      else if(c&&c.pitched[CMG.me]!=null){feed(`Lost a customer to ${who(e.p)} (${icon(e.item)} ${e.price})`,'rival');sfx.sad();}
      break;
    }
    case 'soldout':if(mine){toast('Sold out before they got there!',1500);sfx.thud();}break;
    case 'part':{const p=T.PARTS.find(p=>p.k===e.part);toast(`${p.icon} ${p.label}`,1800);feed(`${p.icon} ${p.label}: busier now!`,'big');bell();break;}
    case 'say':beanSay(e.p,e.text);feed(`${who(e.p)}: “${e.text}”`,'rival say');break;
    case 'close':bell();sfx.fanfare();feed('🔔 Closing time!','big');burst(new V3(P.pos.x,2,P.pos.z),60);recapShow(s);break;
  }
}
function bell(){[1568,1175,1568,1175].forEach((f,i)=>tone(f,0.9,'sine',0.12,i*0.28));}

/* ---------- every frame ---------- */
function gameFrame(dt,ts){
  const s=CMG.s;if(!s)return;
  if(s.phase==='day'){
    playerTick(dt);
    CMG.acc+=dt;let n=0;
    while(CMG.acc>=CM_TUNE.DT&&n<5){gameStep();CMG.acc-=CM_TUNE.DT;n++;}
    if(n===5)CMG.acc=0;   // a long hitch: skip ahead rather than race to catch up
    if(CM_TUNE.DAY-s.t<=30&&!CMG.bell){CMG.bell=1;toast('🔔 30 seconds\nuntil closing!',1800);bell();}
  }
  animBean(P.bean,{an:P.an,em:P.em,emAt:P.emAt,hb:false},ts);
  for(const e of s.feed)if(e.id>CMG.lastFid){CMG.lastFid=e.id;onEvent(s,e);}
  CMG.hover=IN.mouse&&s.phase==='day'?hoverAt(s,IN.nx,IN.ny):null;
  CMG.ctx=s.phase==='day'?context(s):null;
  canvas.style.cursor=CMG.hover&&CMG.hover.kind!=='ground'?'pointer':'default';
  worldSync(s,dt,ts);
  const hl=!CMG.ctx||!CMG.ctx.act?hoverLine(s,CMG.hover):null;
  promptRender(hl&&(!CMG.ctx||CMG.hover.kind!=='ground')?hl:CMG.ctx);
  hudRender(s,dt);
}
