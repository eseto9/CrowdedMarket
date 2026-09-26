/* =========================================================
   The HUD: the score against today's target and your mult, the
   clock, coins and charms, your stall (stock, stance, runners),
   what E will do, the event feed, the Tab summary, and the end
   of each day (rewards and the shop, or the end of the run).
   It reads the game state; your choices go back through cmAct.
   ========================================================= */
// a small element with text (never HTML, so names can't inject anything)
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function btn(cls,text,on){const b=el('button',cls,text);b.type='button';b.addEventListener('click',on);return b;}
const icon=g=>CM_TUNE.GOODS[g].icon;
const icons=gs=>gs.map(icon).join('');
const clockText=secs=>{const s=Math.max(0,Math.ceil(secs));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const multOf=p=>1+Math.max(0,p.streak.n)*CMSim.streakStepOf(p);   // what your next sale's streak mult will be
const HUD={t:0,toastT:null,keysHidden:false,score:0};
try{HUD.keysHidden=localStorage.getItem('cm.keys')==='0';}catch(e){}

function toast(msg,ms){const e=$('#toast');e.textContent=msg;e.classList.add('on');clearTimeout(HUD.toastT);HUD.toastT=setTimeout(()=>e.classList.remove('on'),ms||1600);}
function feed(text,cls){
  const log=$('#feed'),d=el('div',cls||'',text);log.appendChild(d);
  while(log.children.length>50)log.firstChild.remove();log.scrollTop=log.scrollHeight;
}
function hudReset(){
  $('#feed').textContent='';$('#tab').hidden=true;$('#recap').hidden=true;$('#prompt').hidden=true;
  $('#goal').classList.remove('late','done');HUD.t=0;HUD.score=0;$('#keys').hidden=HUD.keysHidden;
}

function hudRender(s,dt){
  HUD.t-=dt;if(HUD.t>0)return;HUD.t=0.1;
  const T=CM_TUNE,me=s.players[CMG.me],left=s.day-s.t,part=T.PARTS.find(p=>p.k===s.part);
  // the goal: score / target, the clock, and your mult
  $('#runLbl').textContent=`Round ${s.run.round} · ${s.run.day===T.RUN.days?'Big day':'Day '+s.run.day}/${T.RUN.days}`;
  $('#part').textContent=`${part.icon} ${part.label}`;
  $('#time').textContent=clockText(left);
  const sc=$('#score');if(me.score!==HUD.score){sc.classList.remove('bump');void sc.offsetWidth;sc.classList.add('bump');HUD.score=me.score;}
  sc.textContent=me.score;$('#target').textContent=s.run.target;
  $('#goalFill').style.width=Math.min(100,100*me.score/s.run.target)+'%';
  $('#goal').classList.toggle('done',me.score>=s.run.target);
  $('#goal').classList.toggle('late',s.phase==='day'&&left<=T.CLOSING_WARN);
  const m=$('#mult'),mult=multOf(me);m.textContent=`×${+mult.toFixed(1)}`;m.classList.toggle('hot',me.streak.n>=2);
  $('#streak').textContent=me.streak.n?`🔥 ${me.streak.n} in a row`:'streak: none yet';
  // coins and charms
  $('#coins').textContent='🪙 '+me.coins;
  const ch=$('#charms');if(ch.dataset.k!==me.charms.join()){ch.dataset.k=me.charms.join();ch.textContent='';
    for(const k of me.charms){const C=T.CHARMS[k],e=el('span','slot',C.icon);e.title=`${C.name}: ${C.desc}`;ch.appendChild(e);}
    for(let i=me.charms.length;i<T.SHOP.slots;i++)ch.appendChild(el('span','slot empty',''));}
  // your stall: what's on it, your stance, your runners
  const st=s.stalls[me.stall],e=$('#stallGoods');e.textContent='';let any=false;
  for(const k of Object.keys(T.GOODS)){const n=st.stock[k]||0;if(!n)continue;any=true;e.append(el('span','g',`${icon(k)}×${n}`));}
  if(!any)e.appendChild(el('span','empty','Empty! Send a runner.'));
  for(const b of $('#stanceSeg').children)b.setAttribute('aria-pressed',b.dataset.stance===me.stance);
  const rn=$('#runners');rn.textContent='';
  s.runners.filter(r=>r.owner===CMG.me).forEach(r=>{
    const t=r.task==='idle'?'waiting':r.task==='out'?`→ ${icon(r.item)}`:`← ${icons(Object.keys(r.carry))||'empty'}`;
    rn.appendChild(el('span','run'+(r.task==='idle'?' idle':''),`🏃 ${t}`));});
  if(me.orders.length){const q=el('span','queue','next: '+icons(me.orders));q.title='Backspace cancels the last order';rn.appendChild(q);}
  const held=CMSim.carried(me);$('#arms').textContent=held?'Carrying '+Object.entries(me.carry).map(([k,n])=>icon(k)+'×'+n).join(' '):'';
  if(!$('#tab').hidden)tabRender(s);
}

// what E (or a click) would do right now, as a line at the bottom of the screen
function promptRender(ctx){
  const e=$('#prompt');
  if(!ctx||!ctx.text){e.hidden=true;return;}
  e.hidden=false;e.className='panel'+(ctx.tone?' '+ctx.tone:'');e.textContent='';
  if(ctx.key)e.appendChild(el('kbd',null,ctx.key));
  e.appendChild(el('span',null,ctx.text));
  if(ctx.sub)e.appendChild(el('span','sub',ctx.sub));
}

/* ---------- Tab: the whole market at a glance ---------- */
function tabRender(s){
  const T=CM_TUNE,e=$('#tab');e.textContent='';
  e.appendChild(el('h3',null,`🧺 The market · round ${s.run.round}, day ${s.run.day}`));
  const tb=el('table'),hd=el('tr');for(const h of['','Score','Sales','Stance','On the shelf'])hd.appendChild(el('th',null,h));tb.appendChild(hd);
  for(const id of s.order){
    const p=s.players[id],st=s.stalls[p.stall],tr=el('tr');
    const nm=el('td');const d=el('span','dot');d.style.background=p.col;nm.append(d,id===CMG.me?'You':p.name+(p.ai?` (${T.RIVALS[p.ai].title})`:''));
    const shelf=Object.keys(T.GOODS).filter(k=>st.stock[k]>0).map(k=>`${icon(k)}${st.stock[k]}@${st.price[k]}`).join('  ')||'—';
    tr.append(nm,el('td','cn',String(p.score)),el('td',null,String(p.st.sales)),el('td',null,T.STANCES[p.stance].icon+' '+T.STANCES[p.stance].name),el('td',null,shelf));tb.appendChild(tr);
  }
  e.appendChild(tb);
  e.appendChild(el('h3',null,'🗣️ Customers want'));
  const rq=el('div','reqs');
  for(const c of s.cust){if(c.ph==='leave')continue;rq.appendChild(el('span',(c.kind==='list'?'list ':'')+(c.ph==='go'?'go':''),`${icons(c.want)} ≤${c.budget}`));}
  if(!rq.children.length)rq.appendChild(el('span',null,'Nobody right now'));
  e.appendChild(rq);
}

/* ---------- the end of a day ---------- */
function recapShow(s){
  const T=CM_TUNE,R=s.result,me=s.players[CMG.me],body=$('#recapBody');body.textContent='';
  const nextRun={...s.run};nextRun.day++;if(nextRun.day>T.RUN.days){nextRun.day=1;nextRun.round++;}
  if(R.passed){
    body.appendChild(el('h2',null,`🎉 Target beaten!`));
    body.appendChild(el('p','sub',`${R.score} against ${R.target} · round ${s.run.round}, day ${s.run.day}`));
    const rw=el('div','rewards');
    const line=(a,b)=>{const r=el('div','rw');r.append(el('span',null,a),el('b',null,b));rw.appendChild(r);};
    line('Target beaten','+'+R.beat);if(R.over)line(`Beat it by ${Math.round((R.score/R.target-1)*100)}%`,'+'+R.over);
    if(R.interest)line('Interest on your coins','+'+R.interest);if(me.st.refund)line('Bargain Bin refund','+'+me.st.refund);
    line('Coins now','🪙 '+me.coins);
    body.appendChild(rw);
    body.appendChild(dayStats(me));
    body.appendChild(shopEl(s));
    const row=el('div','btnrow');
    row.append(btn('btn big',`☀️ ${nextRun.day===T.RUN.days?'The big day':'Day '+nextRun.day}${nextRun.day===1?' of round '+nextRun.round:''} · target ${CMSim.targetFor(nextRun)}`,()=>gameNextDay()),btn('btn alt','🏠 Title',()=>gameExit(false)));
    body.appendChild(row);
  }else{
    const best=bestRun();
    body.appendChild(el('h2',null,'💔 The run is over'));
    body.appendChild(el('p','sub',`${R.score} against a target of ${R.target}, on round ${s.run.round}, ${s.run.day===T.RUN.days?'the big day':'day '+s.run.day}.`));
    body.appendChild(dayStats(me));
    const br=el('p','best',best?`🏆 Best run: round ${best.round}, day ${best.day} · best day ${best.score}`:'');body.appendChild(br);
    const row=el('div','btnrow');row.append(btn('btn big','🔁 A new run',()=>{gameExit(true);gameStart();}),btn('btn alt','🏠 Title',()=>gameExit(false)));
    body.appendChild(row);
  }
  $('#recap').hidden=false;
}
function dayStats(p){
  const b=p.st.best,bits=[`${p.st.sales} sale${p.st.sales===1?'':'s'}`,`longest streak ${p.st.streakTop}`,`top mult ×${+p.st.multTop.toFixed(1)}`,
    b?`best sale ${icons(b.items)} ${b.chips}×${+b.mult.toFixed(1)} = ${b.gain}`:'',p.st.steals?`${p.st.steals} stolen`:'',p.st.stolen?`${p.st.stolen} stolen from you`:'',p.st.lists?`${p.st.lists} whole list${p.st.lists>1?'s':''}`:'',`${p.st.wasted} unsold`].filter(Boolean);
  return el('p','stats',bits.join(' · '));
}
// the shop between days: offers to buy, a reroll, and your charms (sell one for half)
function shopEl(s){
  const T=CM_TUNE,me=s.players[CMG.me],wrap=el('div','shop'),sh=s.shop;
  const head=el('div','shopHead');head.append(el('h3',null,'🛍️ The shop'),btn('btn alt reroll',`🎲 Reroll · 🪙${CMSim.rerollCost(s)}`,()=>shopDo({type:'reroll'})));
  head.lastChild.disabled=me.coins<CMSim.rerollCost(s);wrap.appendChild(head);
  const cards=el('div','cards');
  sh.offers.forEach((o,i)=>{
    const D=o.kind==='charm'?T.CHARMS[o.key]:o.kind==='staff'?T.STAFF[o.key]:T.UPGRADES[o.key];
    const card=el('div','card '+o.kind+(o.sold?' sold':''));
    const lvl=o.kind==='charm'?'Charm':o.kind==='staff'?`Staff${D.max>1?` · you have ${me.staff[o.key]||0}/${D.max}`:''}`:`Upgrade${D.max>1?` · level ${(me.ups[o.key]||0)+1}/${D.max}`:''}`;
    card.append(el('span','kind',lvl),el('span','ic',D.icon),el('b',null,D.name),el('span','desc',D.desc));
    const full=o.kind==='charm'&&me.charms.length>=T.SHOP.slots;
    const b=btn('btn',o.sold?'✓ Bought':full?'Slots full':`Buy · 🪙${o.cost}`,()=>shopDo({type:'shopBuy',i}));
    b.disabled=o.sold||full||me.coins<o.cost;card.appendChild(b);cards.appendChild(card);
  });
  wrap.appendChild(cards);
  const mine=el('div','mine');mine.appendChild(el('span','lbl',`Your charms (${me.charms.length}/${T.SHOP.slots})`));
  if(!me.charms.length)mine.appendChild(el('span','none','none yet'));
  for(const k of me.charms){const C=T.CHARMS[k],c=el('span','owned');c.title=C.desc;
    c.append(el('span',null,`${C.icon} ${C.name}`),btn('sell',`sell 🪙${Math.floor(C.cost*T.SHOP.sell)}`,()=>shopDo({type:'sellCharm',key:k})));mine.appendChild(c);}
  const staff=Object.entries(me.staff).filter(([,n])=>n).map(([k,n])=>`${T.STAFF[k].icon}${n>1?'×'+n:''}`).concat(Object.entries(me.ups).filter(([,n])=>n).map(([k,n])=>`${T.UPGRADES[k].icon}${n>1?'×'+n:''}`));
  if(staff.length)mine.appendChild(el('span','staff','Staff & upgrades: '+staff.join(' ')));
  wrap.appendChild(mine);
  return wrap;
}
function shopDo(a){
  const s=CMG.s;a.player=CMG.me;CMG.log.push([s.tick,a]);
  const r=CMSim.applyAction(s,a);
  if(r.ok){sfx.coin();if(a.type==='shopBuy')burst(new V3(P.pos.x,2,P.pos.z),24);recapShow(s);}
  else{toast({broke:'Not enough coins',slots:'Your charm slots are full: sell one first',owned:'You have that already'}[r.reason]||'Can’t do that',1400);sfx.thud();}
}

/* ---------- the best run, kept in this browser ---------- */
function bestRun(){try{const b=JSON.parse(localStorage.getItem('cm.best')||'null');return b&&typeof b.round==='number'?b:null;}catch(e){return null;}}
function noteRun(s){
  const me=s.players[CMG.me],b=bestRun(),mine={round:s.run.round,day:s.run.day,score:Math.max(me.score,b&&b.round===s.run.round&&b.day===s.run.day?b.score:0)};
  const better=!b||mine.round>b.round||(mine.round===b.round&&mine.day>b.day)||(mine.round===b.round&&mine.day===b.day&&mine.score>b.score);
  if(better)try{localStorage.setItem('cm.best',JSON.stringify(mine));}catch(e){}
  return better;
}
