/* =========================================================
   The HUD: clock, coins, your stall, what E will do, the event
   feed, the price panel, the Tab summary, and the end of each
   day (results, upgrades for tomorrow, the week's winner). It
   reads the game state; your choices go back through cmAct.
   ========================================================= */
// a small element with text (never HTML, so names can't inject anything)
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
function btn(cls,text,on){const b=el('button',cls,text);b.type='button';b.addEventListener('click',on);return b;}
const icon=g=>CM_TUNE.GOODS[g].icon;
const icons=gs=>gs.map(icon).join('');
const clockText=secs=>{const s=Math.max(0,Math.ceil(secs));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const HUD={t:0,coins:{},toastT:null,keysHidden:false};
const warnAt=s=>Math.min(30,s.day*CM_TUNE.CLOSING_WARN);   // seconds left when closing time is announced
try{HUD.keysHidden=localStorage.getItem('cm.keys')==='0';}catch(e){}

function toast(msg,ms){const e=$('#toast');e.textContent=msg;e.classList.add('on');clearTimeout(HUD.toastT);HUD.toastT=setTimeout(()=>e.classList.remove('on'),ms||1600);}
function feed(text,cls){
  const log=$('#feed'),d=el('div',cls||'',text);log.appendChild(d);
  while(log.children.length>50)log.firstChild.remove();log.scrollTop=log.scrollHeight;
}
function hudReset(){
  $('#feed').textContent='';$('#tab').hidden=true;$('#recap').hidden=true;$('#prompt').hidden=true;pricesOpen(false);
  $('#clock').classList.remove('late');HUD.coins={};HUD.t=0;$('#scores').textContent='';$('#keys').hidden=HUD.keysHidden;
}

function hudRender(s,dt){
  HUD.t-=dt;if(HUD.t>0)return;HUD.t=0.1;
  const T=CM_TUNE,left=s.day-s.t,part=T.PARTS.find(p=>p.k===s.part);
  $('#part').textContent=`${part.icon} ${part.label} · Day ${s.week.n}/${s.week.of}`;
  $('#time').textContent=clockText(left);
  $('#barFill').style.width=(100*s.t/s.day)+'%';
  $('#clock').classList.toggle('late',s.phase==='day'&&left<=warnAt(s));
  // coins: you first, then everyone by coins
  const box=$('#scores'),rows=s.order.slice().sort((a,b)=>(a===CMG.me?-1:b===CMG.me?1:s.players[b].coins-s.players[a].coins));
  if(box.children.length!==rows.length){box.textContent='';for(const id of rows){const r=el('div','row'+(id===CMG.me?' me':''));r.dataset.id=id;
    const d=el('span','dot');d.style.background=s.players[id].col;r.append(d,el('span','nm'),el('span','cn'));box.appendChild(r);}}
  for(const r of box.children){const p=s.players[r.dataset.id];r.querySelector('.nm').textContent=p.id===CMG.me?'You':p.name;
    const cn=r.querySelector('.cn');const was=HUD.coins[p.id];cn.textContent='🪙 '+p.coins;
    if(was!=null&&p.coins>was){cn.classList.remove('bump');void cn.offsetWidth;cn.classList.add('bump');}HUD.coins[p.id]=p.coins;}
  // your stall and your arms
  const me=s.players[CMG.me],st=s.stalls[me.stall],e=$('#stall');e.textContent='';
  e.appendChild(el('h3',null,'🧺 Your stall'));
  const g=el('div','goods');let any=false;
  for(const k of Object.keys(T.GOODS)){const n=st.stock[k]||0;if(!n)continue;any=true;
    g.append(el('span',null,icon(k)+' '+T.GOODS[k].name),el('span','n','×'+n),el('span','pr','🪙'+st.price[k]));}
  if(!any)g.appendChild(el('span','empty','Empty! Fetch some stock.'));
  e.appendChild(g);
  const held=CMSim.carried(me),cap=CMSim.capOf(me),arms=el('div','arms'+(held>=cap?' full':''));
  arms.append('Carrying: ',el('b',null,held?Object.entries(me.carry).map(([k,n])=>icon(k)+'×'+n).join(' ')+` (${held}/${cap})`:`nothing (0/${cap})`));
  e.appendChild(arms);
  if(!$('#tab').hidden)tabRender(s);
  pricesRender(s);
  $('#tPrices').hidden=!CMSim.atStall(P.pos,st)||s.phase!=='day';
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

/* ---------- the price panel: −/+ per good, and "Beat" to go one under the cheapest rival ---------- */
const PR={rows:null};
function pricesOpen(on){
  const e=$('#prices');if(on===undefined)on=e.hidden;
  e.hidden=!on;if(on){PR.rows=null;HUD.t=0;sfx.pop();}
}
function cheapestRival(s,g){let best=null;for(const st of s.stalls){const o=st.owner;if(!o||o===CMG.me||!(st.stock[g]>0))continue;if(!best||st.price[g]<best.price)best={price:st.price[g],name:s.players[o].name};}return best;}
function pricesRender(s){
  const e=$('#prices');if(e.hidden||!s)return;
  const T=CM_TUNE,me=s.players[CMG.me],st=s.stalls[me.stall],at=CMSim.atStall(P.pos,st)&&s.phase==='day';
  const set=(g,v)=>{v=clamp(v,T.GOODS[g].cost,T.PRICE_MAX);if(v!==st.price[g])cmAct({type:'setPrice',item:g,price:v},()=>sfx.tick());};
  if(!PR.rows){   // built once each time it opens; values are updated in place so taps aren't lost
    e.textContent='';
    const hd=el('div','prHead');hd.append(el('h3',null,'🏷️ Your prices'),btn('prClose','✕',()=>pricesOpen(false)));e.appendChild(hd);
    e.appendChild(el('p','prNote',''));
    const list=el('div','prList');PR.rows={};
    for(const g of Object.keys(T.GOODS)){
      const r=el('div','prRow'),G=T.GOODS[g];
      const name=el('span','prName',`${G.icon} ${G.name}`),n=el('span','prN'),val=el('b','prVal'),info=el('span','prInfo');
      const minus=btn('prBtn','−',()=>set(g,st.price[g]-1)),plus=btn('prBtn','+',()=>set(g,st.price[g]+1));
      const beat=btn('prBeat','Beat',()=>{const c=cheapestRival(s,g);if(c)set(g,c.price-1);});
      r.append(name,n,minus,val,plus,beat,info);list.appendChild(r);PR.rows[g]={r,n,val,info,minus,plus,beat};
    }
    e.appendChild(list);
  }
  e.querySelector('.prNote').textContent=at?'Cheaper than everyone gets the sale. Never below cost.':'Walk back to your stall to change prices.';
  e.classList.toggle('away',!at);
  for(const [g,R] of Object.entries(PR.rows)){
    const G=T.GOODS[g],n=st.stock[g]||0,c=cheapestRival(s,g),war=s.wars[g]&&[s.wars[g].a,s.wars[g].b].includes(CMG.me);
    R.r.classList.toggle('empty',!n);R.r.classList.toggle('war',!!war);
    R.n.textContent=n?'×'+n:'—';R.val.textContent='🪙'+st.price[g];
    R.info.textContent=`cost ${G.cost}`+(c?` · ${c.name} ${c.price}`:'')+(war?' · 🔥 war':'');
    R.minus.disabled=!at||st.price[g]<=G.cost;R.plus.disabled=!at||st.price[g]>=T.PRICE_MAX;
    R.beat.disabled=!at||!c||c.price-1<G.cost||c.price-1>=st.price[g];
  }
}

/* ---------- Tab: the whole market at a glance ---------- */
function tabRender(s){
  const T=CM_TUNE,e=$('#tab');e.textContent='';
  e.appendChild(el('h3',null,`🧺 The market · day ${s.week.n} of ${s.week.of}`));
  const tb=el('table'),hd=el('tr');for(const h of['','Coins','Sales','On the shelf'])hd.appendChild(el('th',null,h));tb.appendChild(hd);
  for(const id of s.order.slice().sort((a,b)=>s.players[b].coins-s.players[a].coins)){
    const p=s.players[id],st=s.stalls[p.stall],tr=el('tr');
    const nm=el('td');const d=el('span','dot');d.style.background=p.col;
    nm.append(d,(id===CMG.me?'You':p.name+(p.ai?` (${T.RIVALS[p.ai].title})`:''))+Object.keys(p.ups).map(k=>' '+T.UPGRADES[k].icon).join(''));
    const shelf=Object.keys(T.GOODS).filter(k=>st.stock[k]>0).map(k=>`${icon(k)}${st.stock[k]}@${st.price[k]}`).join('  ')||'—';
    tr.append(nm,el('td','cn','🪙'+p.coins),el('td',null,String(p.st.sales)),el('td',null,shelf));tb.appendChild(tr);
  }
  e.appendChild(tb);
  if(Object.keys(s.wars).length)e.appendChild(el('p','wars','🔥 Price war on '+Object.keys(s.wars).map(icon).join(' ')+': more customers want it, and margins are thin.'));
  e.appendChild(el('h3',null,'🗣️ Customers want'));
  const rq=el('div','reqs');
  for(const c of s.cust){if(c.ph==='leave')continue;rq.appendChild(el('span',(c.kind==='list'?'list ':'')+(c.ph==='think'?'think':c.ph==='go'||c.ph==='buy'?'go':''),`${icons(c.want)} ≤${c.budget}`));}
  if(!rq.children.length)rq.appendChild(el('span',null,'Nobody right now'));
  e.appendChild(rq);
}

/* ---------- the end of a day: results, then upgrades for tomorrow, or the week's winner ---------- */
function recapShow(s){
  const T=CM_TUNE,R=s.recap,body=$('#recapBody');body.textContent='';
  const mine=R.rows.findIndex(r=>r.id===CMG.me),last=R.last;
  body.appendChild(el('h2',null,last?(mine===0?'🏆 You win the week!':'🔔 The market week is over'):`🔔 Day ${s.week.n} of ${s.week.of} is over`));
  body.appendChild(el('p','sub',last?(mine===0?'Most coins after three days of trading.':`You came ${['first','second','third','fourth'][mine]} for the week.`)
    :'Coins carry over to tomorrow. Unsold stock doesn’t.'));
  const ol=el('ol','rank');
  R.rows.forEach((r,i)=>{
    const li=el('li',r.id===CMG.me?'me':'');
    li.appendChild(el('span','pl',['🥇','🥈','🥉','🎗️'][i]||''));
    const nm=el('span','nm');const d=el('span','dot');d.style.background=r.col;nm.append(d,r.id===CMG.me?'You':r.name);li.appendChild(nm);
    li.appendChild(el('span','cn','🪙'+r.coins));
    const today=r.coins-(CMG.dayStart[r.id]??T.START_COINS);
    const bits=[`today ${today>=0?'+':''}${today}`,`${r.sales} sale${r.sales===1?'':'s'}`,r.best?`best ${icons(r.best.items)} for ${r.best.price}`:'no sales',
      r.bonus?`list bonuses ${r.bonus}`:'',`${r.undercuts} undercut${r.undercuts===1?'':'s'}`,r.haggle?`biggest haggle win ${r.haggle}`:'',r.sabotage?`sabotage 🪙${r.sabotage}`:'',`${r.wasted} unsold`].filter(Boolean);
    li.appendChild(el('span','st',bits.join(' · ')));
    ol.appendChild(li);
  });
  body.appendChild(ol);
  if(R.titles.length){const tl=el('ul','titles');for(const t of R.titles){const p=s.players[t.p];const li=el('li');li.append(el('b',null,t.title),`${t.p===CMG.me?'You':p.name}: ${t.why}`);tl.appendChild(li);}body.appendChild(tl);}
  if(!last)body.appendChild(shopEl(s));
  const row=el('div','btnrow');
  if(last)row.append(btn('btn','🔁 A new week',()=>{gameExit(true);gameStart();}),btn('btn alt','🏠 Title',()=>gameExit(false)));
  else row.append(btn('btn big','☀️ Open for day '+(s.week.n+1),()=>gameNextDay()),btn('btn alt','🏠 Title',()=>gameExit(false)));
  body.appendChild(row);
  $('#recap').hidden=false;
}
// the upgrade shop between days
function shopEl(s){
  const T=CM_TUNE,me=s.players[CMG.me],wrap=el('div','shop');
  wrap.appendChild(el('h3',null,'🛠️ Upgrades for tomorrow'));
  const cards=el('div','cards');
  for(const [k,U] of Object.entries(T.UPGRADES)){
    const owned=!!me.ups[k],card=el('div','card'+(owned?' owned':''));
    card.append(el('span','ic',U.icon),el('b',null,U.name),el('span','desc',U.desc));
    const rivals=s.order.filter(id=>id!==CMG.me&&s.players[id].ups[k]).map(id=>s.players[id].name);
    if(rivals.length)card.appendChild(el('span','who',rivals.join(' and ')+' has one'));
    const b=btn('btn'+(owned?' alt':''),owned?'✓ Yours':`Buy · 🪙${U.cost}`,()=>{
      const a={type:'upgrade',player:CMG.me,kind:k};CMG.log.push([s.tick,a]);const r=CMSim.applyAction(s,a);
      if(r.ok){sfx.coin();burst(new V3(P.pos.x,2,P.pos.z),20);recapShow(s);}else{toast(r.reason==='broke'?'Not enough coins':'Can’t buy that',1200);sfx.thud();}
    });
    b.disabled=owned||me.coins<U.cost;card.appendChild(b);cards.appendChild(card);
  }
  wrap.appendChild(cards);
  wrap.appendChild(el('p','note',`You have 🪙${me.coins}. Keep some back: tomorrow’s stock costs coins too.`));
  return wrap;
}
