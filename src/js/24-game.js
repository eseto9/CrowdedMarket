/* =========================================================
   The game: the title screen (with a demo market running behind
   it), a run of days, the local authority loop (your moves, the
   AI, the clock), moving your bean, and what clicks and keys do.
   In single player this page is the authority: it runs
   CMSim.tick; a multiplayer host will do the same later.
   ========================================================= */
const CMG={on:false,s:null,init:null,me:'me',mems:[],log:[],queue:[],acc:0,lastFid:0,ctx:null,hover:null,goal:null,bell:0,demo:null,
  cfg:{name:'',col:BEAN_COLORS[5],diff:'normal'}};
function clean(s,n){return String(s==null?'':s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g,'').trim().slice(0,n||14);}
try{const c=JSON.parse(localStorage.getItem('cm.me')||'{}');if(typeof c.name==='string')CMG.cfg.name=clean(c.name);if(BEAN_COLORS.includes(c.col))CMG.cfg.col=c.col;if(CM_TUNE.AI.think[c.diff])CMG.cfg.diff=c.diff;}catch(e){}
const rivalCols=()=>Object.values(CM_TUNE.RIVALS).map(r=>r.col);   // colours the rivals wear, so yours can't clash
// your bean
const P={pos:new V3(),vel:new V3(),face:0,bean:null,dashT:0,dashCD:0,an:0,em:null,emAt:0};

/* ---------- the title screen ---------- */
{const wm=$('#wordmark');'Crowded Market'.split('').forEach((ch,i)=>{const s=document.createElement('span');s.textContent=ch===' '?' ':ch;s.style.animationDelay=(i*0.04)+'s';s.setAttribute('aria-hidden','true');wm.appendChild(s);});}
function titleRender(){
  $('#nameIn').value=CMG.cfg.name;
  if(rivalCols().includes(CMG.cfg.col))CMG.cfg.col=BEAN_COLORS.find(c=>!rivalCols().includes(c));
  const sw=$('#swatches');sw.textContent='';
  for(const c of BEAN_COLORS){if(rivalCols().includes(c))continue;   // the rivals' colours are taken
    const b=document.createElement('button');b.type='button';b.className='sw';b.style.background=c;b.setAttribute('aria-label','Colour '+c);b.setAttribute('aria-pressed',c===CMG.cfg.col);
    b.onclick=()=>{CMG.cfg.col=c;titleRender();};sw.appendChild(b);}
  for(const b of $('#diffSeg').children)b.setAttribute('aria-pressed',b.dataset.diff===CMG.cfg.diff);
  const best=bestRun();$('#bestRun').textContent=best?`🏆 Your best run: round ${best.round}, day ${best.day}`:'';$('#bestRun').hidden=!best;
}
$('#diffSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;CMG.cfg.diff=b.dataset.diff;titleRender();});
$('#nameIn').addEventListener('input',e=>{CMG.cfg.name=clean(e.target.value);});
$('#nameIn').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();gameStart();}});
$('#startBtn').addEventListener('click',()=>gameStart());
titleRender();

// behind the title: three shopkeepers trading on their own, so the board is alive
function demoStart(){
  const R=CM_TUNE.RIVALS;
  const s=CMSim.newState({seed:1+Math.floor(Math.random()*1e9),players:[{id:'d0',name:'Otto',col:'#4D96FF',ai:'undercutter'},
    {id:'d1',name:R.undercutter.name,col:R.undercutter.col,ai:'undercutter'},{id:'d2',name:R.hoarder.name,col:R.hoarder.col,ai:'hoarder'}]});
  CMG.demo={s,mems:s.order.map((id,i)=>CMAI.newMem(id,s.players[id].ai,'normal',77+i)),acc:0};
}
function demoFrame(dt,ts){
  const D=CMG.demo;if(!D)return;
  D.acc+=dt;let n=0;
  while(D.acc>=CM_TUNE.DT&&n<5){for(const m of D.mems)for(const a of CMAI.step(D.s,m))CMSim.applyAction(D.s,a);CMSim.tick(D.s);D.acc-=CM_TUNE.DT;n++;}
  if(n===5)D.acc=0;
  if(D.s.phase!=='day'){worldClear();demoStart();return;}
  worldSync(D.s,dt,ts);
}

/* ---------- a run ---------- */
function gameStart(){
  if(!$('#loading').hidden)return;   // the board isn't built yet
  audioInit();
  const cfg=CMG.cfg;cfg.name=clean($('#nameIn').value)||cfg.name||'Bean '+Math.floor(Math.random()*90+10);
  if(rivalCols().includes(cfg.col))cfg.col=BEAN_COLORS.find(c=>!rivalCols().includes(c));
  try{localStorage.setItem('cm.me',JSON.stringify(cfg));}catch(e){}
  CMG.demo=null;worldClear();
  const R=CM_TUNE.RIVALS,seed=1+Math.floor(Math.random()*2147483646);
  CMG.init={seed,diff:cfg.diff,players:[{id:'me',name:cfg.name,col:cfg.col},
    {id:'u',name:R.undercutter.name,col:R.undercutter.col,ai:'undercutter'},{id:'h',name:R.hoarder.name,col:R.hoarder.col,ai:'hoarder'}]};
  CMG.s=CMSim.newState(CMG.init);
  CMG.mems=CMG.s.order.filter(id=>CMG.s.players[id].ai).map((id,i)=>CMAI.newMem(id,CMG.s.players[id].ai,cfg.diff,seed+i+1));
  CMG.on=true;beginDay();
  feed(`🌅 A new run! Beat ${CMG.s.run.target} today to keep going.`,'big');
  feed('Stand at your stall: you sell to everyone in your ring. Click a supplier to send your runner for stock.');
  feed(`${R.undercutter.name} (next door) and ${R.hoarder.name} (across the street) will steal your customers if they can. Steal theirs!`,'rival');
  dayIntro();
}
// everything a morning needs: your bean at your stall, a clean HUD, a fresh log
function beginDay(){
  const s=CMG.s,me=s.players[CMG.me];
  Object.assign(CMG,{log:[],queue:[],acc:0,lastFid:0,goal:null,hover:null,ctx:null,bell:0,start:CMSim.clone(s)});
  if(P.bean)scene.remove(P.bean);
  WV.me=beanFor(me,DEFAULT_FIT,true);P.bean=WV.me.b;scene.add(P.bean);
  P.pos.set(me.x,0,me.z);P.vel.set(0,0,0);P.face=s.stalls[me.stall].z<0?0:Math.PI;P.dashT=P.dashCD=0;
  $('#title').hidden=true;$('#hud').hidden=false;hudReset();
  // the keys panel shows at the start of a run, then gets out of the way (H brings it back)
  clearTimeout(HUD.keysT);if(!HUD.keysHidden&&s.run.round===1&&s.run.day===1)HUD.keysT=setTimeout(()=>{if(CMG.on)$('#keys').hidden=true;},25000);
  else $('#keys').hidden=true;
}
function dayIntro(){
  const s=CMG.s,T=CM_TUNE,big=s.run.day===T.RUN.days;
  toast(`${big?'⭐ The big day':'🌅 Round '+s.run.round+', day '+s.run.day}\nTarget ${s.run.target}`,2400);sfx.chime();
}
function gameNextDay(){
  const next=CMSim.nextDay(CMG.s);if(!next)return;
  worldClear();CMG.s=next;CMG.mems.forEach(CMAI.newDay);beginDay();
  feed(`☀️ Round ${next.run.round}, ${next.run.day===CM_TUNE.RUN.days?'the big day':'day '+next.run.day}. Target: ${next.run.target}.`,'big');
  dayIntro();
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
  if(CMG.s&&CMG.s.phase==='day'&&!b.classList.contains('armed')){b.classList.add('armed');b.textContent='Tap again to give up';
    setTimeout(()=>{b.classList.remove('armed');b.textContent='🚪 Leave';},3000);return;}
  b.classList.remove('armed');b.textContent='🚪 Leave';gameExit(false);
});
$('#stanceSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setStance(b.dataset.stance);});
function setStance(k){if(!CMG.s||CMG.s.phase!=='day'||CMG.s.players[CMG.me].stance===k)return;cmAct({type:'stance',stance:k},()=>sfx.pop());}

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
  nostock:'You don’t have what they want',reach:'They’re out of your reach',already:'You just pitched them',busy:'They’re busy',gone:'They’ve gone',
  queue:'Your runners have enough to do',loyal:'They won’t switch again',yours:'They’re already yours'};
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
    G.re-=dt;if(G.re<=0){const c=s.cust.find(c=>c.id===G.t.id);if(!c||!['walk','browse','think','go'].includes(c.ph)){CMG.goal=null;return null;}
      G.path=CMNav.path(CMNav.boardGrid(),P.pos.x,P.pos.z,c.x,c.z);G.re=0.35;}}
  while(G.path.length&&Math.hypot(G.path[0][0]-P.pos.x,G.path[0][1]-P.pos.z)<0.25)G.path.shift();
  if(!G.path.length){CMG.goal=null;return null;}
  const [x,z]=G.path[0],d=Math.hypot(x-P.pos.x,z-P.pos.z);return {x:(x-P.pos.x)/d,z:(z-P.pos.z)/d};
}

/* ---------- what E does, what a click does ---------- */
const meNow=s=>Object.assign({},s.players[CMG.me],{x:P.pos.x,z:P.pos.z});   // you, where you are on screen right now
function stealLine(s,c){
  const d=CMSim.stealDeal(s,meNow(s),c),who=(s.players[c.deal.p]||{}).name||'someone';
  if(d.ok)return {ok:true,text:`Steal them from ${who}: ${icons(d.deal.items)} for 🪙${d.deal.total}`,sub:'+1 mult',tone:'good'};
  const why={reach:`Heading to ${who}. Get closer to steal them`,nostock:`Heading to ${who}. You haven’t got ${icons(c.deal.items)}`,loyal:`Heading to ${who}. They won’t switch again`}[d.reason];
  return why?{ok:false,text:why,tone:'bad',far:d.reason==='reach'}:null;
}
function custLine(s,c){
  if(c.ph==='go'&&c.deal&&c.deal.p!==CMG.me)return stealLine(s,c);
  if(!['walk','browse','think'].includes(c.ph))return null;
  const me=s.players[CMG.me],st=s.stalls[me.stall],want=`${icons(c.want)} for up to ${c.budget}`;
  if(!CMSim.inRing(s,me,c))return {text:`Wants ${want}, but they’re outside your ring`,tone:'bad',ok:false};
  const o=CMSim.offer(s,c,st);
  if(!o.ok&&o.reason==='nostock')return {text:`Wants ${want}. You have none of it!`,tone:'bad',ok:false};
  if(!o.ok)return {text:`Wants ${want}. Too pricey: try Bargain (1)`,tone:'bad',ok:false};
  return {text:`Pitch ${icons(o.items)} for 🪙${o.total}`,sub:c.kind==='list'&&o.full?'the whole list: ×2':`budget ${c.budget}`,tone:'good',ok:true};
}
function nearestCustomer(s){
  const T=CM_TUNE;let best=null,bd=Infinity;const hov=CMG.hover&&CMG.hover.kind==='cust'?CMG.hover.id:null;
  for(const c of s.cust){
    const stealable=c.ph==='go'&&c.deal&&c.deal.p!==CMG.me&&CMSim.stealDeal(s,meNow(s),c).ok;
    if(!stealable&&!['walk','browse','think'].includes(c.ph))continue;
    const d=Math.hypot(c.x-P.pos.x,c.z-P.pos.z);if(!stealable&&d>T.PITCH_RANGE)continue;
    const sc=c.id===hov?-2:stealable?d-100:d;if(sc<bd){bd=sc;best=c;}   // a steal comes first
  }
  return best;
}
function context(s){
  const T=CM_TUNE,me=s.players[CMG.me],mine=me.stall,st=s.stalls[mine],held=CMSim.carried(me),px=P.pos.x,pz=P.pos.z;
  for(const [g,sp] of Object.entries(s.sup)){
    if(Math.hypot(px-sp.x,pz-sp.z)>T.SUPPLIER_RANGE)continue;
    const G=T.GOODS[g],thing={kind:'sup',g};
    if(held>=CMSim.capOf(me))return {thing,text:'Your arms are full. Take it to your stall!',tone:'bad'};
    if(me.coins<G.cost)return {thing,text:`${G.icon} costs ${G.cost}. You only have ${me.coins} 🪙`,tone:'bad'};
    return {thing,act:'buy',key:'E',text:`Grab ${G.icon} yourself · 🪙${G.cost} each`,sub:`${held}/${CMSim.capOf(me)} · Shift+E: an armful`};
  }
  const at=CMSim.atStall({x:px,z:pz},st);
  if(at&&held)return {thing:{kind:'stall',i:mine},act:'shelve',key:'E',text:`Put ${held} thing${held>1?'s':''} on your shelf`,tone:'good'};
  const c=nearestCustomer(s);
  if(c){const l=custLine(s,c);if(l)return Object.assign({thing:{kind:'cust',id:c.id},act:l.ok?'cust':null,key:l.ok?'E':null},l);}
  if(at)return {text:'At your stall: everyone in your ring gets an offer',sub:'1 2 3: Bargain / Fair / Premium'};
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
  if(h.kind==='sup'){const G=T.GOODS[h.g],me=s.players[CMG.me],n=Math.min(CMSim.basketOf(me),Math.floor(me.coins/G.cost));
    return {text:`Click: send a runner for ${G.icon} ${G.name}`,sub:`${n} for 🪙${n*G.cost} · sells for ${s.stalls[me.stall].price[h.g]} · Shift+click: go yourself`,tone:n?'':'bad'};}
  if(h.kind==='stall'){const st=s.stalls[h.i],p=s.players[st.owner];
    if(!p)return {text:'An empty stall'};
    if(p.id!==CMG.me)return {text:`${p.name}’s stall · ${T.STANCES[p.stance].icon} ${T.STANCES[p.stance].name} prices`};
    return {text:CMSim.carried(s.players[CMG.me])?'Click: go and shelve what you’re carrying':'Click: back to your stall'};}
  if(h.kind==='cust'){const c=s.cust.find(c=>c.id===h.id);if(!c)return null;const l=custLine(s,c);if(!l)return null;
    return {text:(l.ok?'Click: ':'')+l.text,sub:l.sub,tone:l.tone};}
  return null;
}
function doThing(s,t,all){
  if(t.kind==='sup'){cmAct({type:'buy',item:t.g,n:all?CMSim.capOf(s.players[CMG.me]):1},()=>sfx.pop());return;}
  if(t.kind==='stall'){
    if(t.i!==s.players[CMG.me].stall){const p=s.players[s.stalls[t.i].owner];toast(p?`That’s ${p.name}’s stall`:'An empty stall',1100);return;}
    if(CMSim.carried(s.players[CMG.me]))cmAct({type:'shelve'},()=>{sfx.blip();burst(new V3(s.stalls[t.i].x,1.4,s.stalls[t.i].z),10);});
    return;
  }
  if(t.kind==='cust'){
    const c=s.cust.find(c=>c.id===t.id);if(!c)return;
    if(c.ph==='go')cmAct({type:'steal',cust:c.id},()=>{sfx.hint();P.em='point';P.emAt=Date.now();});
    else cmAct({type:'pitch',cust:c.id},()=>{sfx.tick();P.em='point';P.emAt=Date.now();});
  }
}
function sendRunner(s,g){
  cmAct({type:'order',item:g},()=>{sfx.blip();const sp=s.sup[g];burst(new V3(sp.x,1.5,sp.z),6);});
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
  if(h.kind==='sup'&&!shift){sendRunner(s,h.g);return;}   // a click sends a runner; Shift+click to go yourself
  if(h.kind==='stall'&&h.i!==s.players[CMG.me].stall){doThing(s,h);return;}
  if(h.kind==='cust'){
    const c=s.cust.find(c=>c.id===h.id);if(!c)return;
    if(c.ph==='go'&&c.deal&&c.deal.p!==CMG.me){const d=CMSim.stealDeal(s,meNow(s),c);
      if(d.ok){doThing(s,h);return;}
      if(d.reason==='reach'){walkTo(s,h,()=>doThing(CMG.s,h));return;}
      toast(WHY[d.reason]||'Can’t steal them',1100);sfx.thud();return;}
    if(Math.hypot(P.pos.x-c.x,P.pos.z-c.z)<=CM_TUNE.PITCH_RANGE){doThing(s,h);return;}
  }
  if(inReach(s,h))doThing(s,h,shift);else walkTo(s,h,()=>doThing(CMG.s,h,shift));
}
// the market's keys
function gameKey(e){
  if(e.code==='KeyE'){gameAct(e.shiftKey);return;}
  if(e.code==='Space'){gameDash();return;}
  if(e.code==='Tab'){$('#tab').hidden=false;if(CMG.s)tabRender(CMG.s);return;}
  if(e.code==='KeyH'){HUD.keysHidden=!HUD.keysHidden;$('#keys').hidden=HUD.keysHidden;try{localStorage.setItem('cm.keys',HUD.keysHidden?'0':'1');}catch(err){}return;}
  if(e.code==='KeyM'){toggleMute();return;}
  if(e.code==='Backspace'){e.preventDefault();cmAct({type:'cancel'},()=>sfx.pop());return;}
  const st={Digit1:'bargain',Digit2:'fair',Digit3:'premium'}[e.code];if(st){setStance(st);return;}
}
function gameKeyUp(e){if(e.code==='Tab')$('#tab').hidden=true;}

/* ---------- what happened: the feed, sounds, bubbles and score pops ---------- */
function onEvent(s,e){
  const T=CM_TUNE,who=id=>id===CMG.me?'You':(s.players[id]||{name:'?'}).name,mine=e.p===CMG.me;
  switch(e.k){
    case 'sale':{
      const st=s.stalls[s.players[e.p].stall];
      if(mine){
        sfx.coin();burst(new V3(st.x,1.6,st.z),e.full||e.stolen?40:14);
        const why=[e.full?'whole list':'',e.stolen?'stolen':'',e.lucky?'lucky!':''].filter(Boolean).join(' · ');
        scorePop(st.x,st.z,`+${e.gain}`,`${e.chips} × ${+e.mult.toFixed(1)}${why?' · '+why:''}`);
        feed(`🪙 ${icons(e.items)} for ${e.price}: ${e.chips}×${+e.mult.toFixed(1)} = +${e.gain}${e.bonus?` (+${e.bonus} coins list bonus)`:''}`,'me');
        if(e.streak===5||e.streak===10||e.streak===15)toast(`🔥 ${e.streak} in a row!`,1200);
        if(s.players[CMG.me].score>=s.run.target&&s.players[CMG.me].score-e.gain<s.run.target){toast('🎯 Target beaten!\nKeep going for coins',1800);sfx.fanfare();}
      }else feed(`${who(e.p)} sold ${icons(e.items)} for ${e.price}`,'rival');
      break;
    }
    case 'steal':
      if(mine){toast(`Stolen! ${icons(e.items)} for ${e.price}`,1200);feed(`🫳 You stole a customer from ${who(e.from)}`,'me');}
      else if(e.from===CMG.me){toast(`${who(e.p)} stole your customer!`,1400);sfx.sad();feed(`😾 ${who(e.p)} stole your customer`,'rival');}
      else feed(`${who(e.p)} stole a customer from ${who(e.from)}`,'rival');
      break;
    case 'streakLost':if(mine){toast(`Streak lost (${e.n})`,1100);sfx.thud();feed(`💨 Your ${e.n}-sale streak ended${e.why==='stolen'?': customer stolen':e.why==='soldout'?': sold out':': they went elsewhere'}`,'rival');}break;
    case 'order':if(mine)feed(`🏃 Order: ${icon(e.item)}`,'me');break;
    case 'fetched':if(mine)feed(`🏃 Runner bought ${icon(e.item)}×${e.n} for 🪙${e.cost}`,'me');break;
    case 'broke':if(mine){toast('Your runner couldn’t afford it',1300);sfx.thud();}break;
    case 'delivered':if(mine){sfx.blip();feed(`📦 ${icon(e.item)}×${e.n} on your shelf`,'me');}break;
    case 'stance':if(mine)feed(`${T.STANCES[e.stance].icon} ${T.STANCES[e.stance].name} prices`,'me');break;
    case 'pricey':if(mine){const c=s.cust.find(c=>c.id===e.cust);toast(c?`Too pricey!\nThey’ll spend up to ${c.budget}`:'Too pricey!',1500);sfx.thud();}break;
    case 'soldout':if(mine){toast('Sold out before they got there!',1500);sfx.thud();}break;
    case 'part':{const p=T.PARTS.find(p=>p.k===e.part);toast(`${p.icon} ${p.label}`,1500);feed(`${p.icon} ${p.label}: busier now!`,'big');bell();break;}
    case 'say':beanSay(e.p,e.text);feed(`${who(e.p)}: “${e.text}”`,'rival say');break;
    case 'close':{
      bell();feed('🔔 Closing time!','big');
      if(e.passed){sfx.fanfare();burst(new V3(P.pos.x,2,P.pos.z),80);}else sfx.sad();
      noteRun(s);   // the best run so far, kept in this browser
      recapShow(s);break;
    }
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
    if(s.day-s.t<=CM_TUNE.CLOSING_WARN&&!CMG.bell&&s.phase==='day'){CMG.bell=1;toast(`🔔 ${CM_TUNE.CLOSING_WARN} seconds left!`,1600);bell();}
  }
  animBean(P.bean,{an:P.an,em:P.em,emAt:P.emAt,hb:false},ts);
  for(const e of s.feed)if(e.id>CMG.lastFid){CMG.lastFid=e.id;onEvent(s,e);}
  CMG.hover=IN.mouse&&s.phase==='day'?hoverAt(s,IN.nx,IN.ny):null;
  CMG.ctx=s.phase==='day'?context(s):null;
  canvas.style.cursor=CMG.hover&&CMG.hover.kind!=='ground'?'pointer':'default';
  worldSync(s,dt,ts);
  const hl=CMG.hover&&CMG.hover.kind!=='ground'?hoverLine(s,CMG.hover):null;
  promptRender(hl||CMG.ctx);
  hudRender(s,dt);
}
