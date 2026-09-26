/* =========================================================
   The HUD: clock, coins, your stall, what E will do, the event
   feed, the Tab summary and the end-of-day recap. It reads the
   game state; your choices go back through cmAct.
   ========================================================= */
// a small element with text (never HTML, so names can't inject anything)
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
const icon=g=>CM_TUNE.GOODS[g].icon;
const clockText=secs=>{const s=Math.max(0,Math.ceil(secs));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const HUD={t:0,coins:{},toastT:null,keysHidden:false};
try{HUD.keysHidden=localStorage.getItem('cm.keys')==='0';}catch(e){}

function toast(msg,ms){const e=$('#toast');e.textContent=msg;e.classList.add('on');clearTimeout(HUD.toastT);HUD.toastT=setTimeout(()=>e.classList.remove('on'),ms||1600);}
function feed(text,cls){
  const log=$('#feed'),d=el('div',cls||'',text);log.appendChild(d);
  while(log.children.length>50)log.firstChild.remove();log.scrollTop=log.scrollHeight;
}
function hudReset(){
  $('#feed').textContent='';$('#tab').hidden=true;$('#recap').hidden=true;$('#prompt').hidden=true;
  $('#clock').classList.remove('late');HUD.coins={};HUD.t=0;$('#scores').textContent='';$('#keys').hidden=HUD.keysHidden;
}

function hudRender(s,dt){
  HUD.t-=dt;if(HUD.t>0)return;HUD.t=0.1;
  const T=CM_TUNE,left=T.DAY-s.t,part=T.PARTS.find(p=>p.k===s.part);
  $('#part').textContent=`${part.icon} ${part.label}`;
  $('#time').textContent=clockText(left);
  $('#barFill').style.width=(100*s.t/T.DAY)+'%';
  $('#clock').classList.toggle('late',s.phase==='day'&&left<=30);
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
  const held=CMSim.carried(me),arms=el('div','arms'+(held>=T.CARRY?' full':''));
  arms.append('Carrying: ',el('b',null,held?Object.entries(me.carry).map(([k,n])=>icon(k)+'×'+n).join(' ')+` (${held}/${T.CARRY})`:`nothing (0/${T.CARRY})`));
  e.appendChild(arms);
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
  e.appendChild(el('h3',null,'🧺 The market'));
  const tb=el('table'),hd=el('tr');for(const h of['','Coins','Sales','On the shelf'])hd.appendChild(el('th',null,h));tb.appendChild(hd);
  for(const id of s.order.slice().sort((a,b)=>s.players[b].coins-s.players[a].coins)){
    const p=s.players[id],st=s.stalls[p.stall],tr=el('tr');
    const nm=el('td');const d=el('span','dot');d.style.background=p.col;
    nm.append(d,id===CMG.me?'You':p.name+(p.ai?` (${T.RIVALS[p.ai].title})`:''));
    const shelf=Object.keys(T.GOODS).filter(k=>st.stock[k]>0).map(k=>`${icon(k)}${st.stock[k]}@${st.price[k]}`).join('  ')||'—';
    tr.append(nm,el('td','cn','🪙'+p.coins),el('td',null,String(p.st.sales)),el('td',null,shelf));tb.appendChild(tr);
  }
  e.appendChild(tb);
  e.appendChild(el('h3',null,'🗣️ Customers want'));
  const rq=el('div','reqs');
  for(const c of s.cust){if(c.ph==='leave')continue;const w=c.want[0];rq.appendChild(el('span',c.ph==='think'?'think':c.ph==='go'||c.ph==='buy'?'go':'',`${icon(w.item)} ≤${w.max}`));}
  if(!rq.children.length)rq.appendChild(el('span',null,'Nobody right now'));
  e.appendChild(rq);
}

/* ---------- the closing bell ---------- */
function recapShow(s){
  const R=s.recap,body=$('#recapBody');body.textContent='';
  const mine=R.rows.findIndex(r=>r.id===CMG.me);
  body.appendChild(el('h2',null,mine===0?'🏆 You win the day!':'🔔 The market is closed'));
  body.appendChild(el('p','sub',mine===0?'Most coins at the closing bell.':`You came ${['first','second','third','fourth'][mine]}. Leftover stock is worth nothing now.`));
  const ol=el('ol','rank');
  R.rows.forEach((r,i)=>{
    const li=el('li',r.id===CMG.me?'me':'');
    li.appendChild(el('span','pl',['🥇','🥈','🥉','🎗️'][i]||''));
    const nm=el('span','nm');const d=el('span','dot');d.style.background=r.col;nm.append(d,r.id===CMG.me?'You':r.name);li.appendChild(nm);
    li.appendChild(el('span','cn','🪙'+r.coins));
    const bits=[`${r.sales} sale${r.sales===1?'':'s'}`,r.best?`best ${icon(r.best.item)} for ${r.best.price}`:'no sales',`${r.undercuts} undercut${r.undercuts===1?'':'s'}`,
      r.haggle?`biggest haggle win ${r.haggle}`:'',r.sabotage?`sabotage 🪙${r.sabotage}`:'',`${r.wasted} unsold`].filter(Boolean);
    li.appendChild(el('span','st',bits.join(' · ')));
    ol.appendChild(li);
  });
  body.appendChild(ol);
  if(R.titles.length){const tl=el('ul','titles');for(const t of R.titles){const p=s.players[t.p];const li=el('li');li.append(el('b',null,t.title),`${t.p===CMG.me?'You':p.name}: ${t.why}`);tl.appendChild(li);}body.appendChild(tl);}
  const row=el('div','btnrow');
  const again=el('button','btn','🔁 Trade another day');again.type='button';again.onclick=()=>{gameExit(true);gameStart();};
  const back=el('button','btn alt','🏠 Title');back.type='button';back.onclick=()=>gameExit(false);
  row.append(again,back);body.appendChild(row);
  $('#recap').hidden=false;
}
