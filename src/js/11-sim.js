/* =========================================================
   The simulation
   All game state is one plain, JSON-safe object. It only ever
   changes through applyAction(state, action) (players and AI
   alike) and tick(state) (the authority's clock: customers,
   runners, timers, closing). No browser, no THREE: the tests run
   this in Node, and a multiplayer host will run it later.
   Randomness comes from state.rng, so a start state plus the list
   of [tick, action] pairs replays a day exactly (see replay()).
   A run is rounds of three days, each with a score target:
   nextDay(state) carries coins, charms and staff into the next.
   ========================================================= */
const CMSim=(()=>{
  const T=CM_TUNE,B=T.BOARD,R=T.RUN;
  const r2=v=>Math.round(v*100)/100;
  const dist=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
  // mulberry32, its whole state kept in s.rng
  function rnd(s){let t=(s.rng=(s.rng+0x6D2B79F5)>>>0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  const between=(s,[a,b])=>a+rnd(s)*(b-a);
  const intIn=(s,[a,b])=>a+Math.floor(rnd(s)*(b-a+1));
  function weighted(s,list){let sum=0;for(const [,w] of list)sum+=w;let r=rnd(s)*sum;for(const [k,w] of list){r-=w;if(r<0)return k;}return list[list.length-1][0];}
  const partAt=(t,day)=>{let p=T.PARTS[0];for(const x of T.PARTS)if(t>=x.f*day)p=x;return p.k;};
  const carried=p=>Object.values(p.carry).reduce((a,b)=>a+b,0);
  const has=(p,k)=>p.charms.includes(k);
  const charmsOf=p=>p.charms.map(k=>T.CHARMS[k]);
  // what staff, upgrades and charms add up to
  const capOf=()=>T.CARRY;
  const reachOf=p=>T.STALL_REACH+(p.ups.awning||0)*T.UPGRADES.awning.reach+charmsOf(p).reduce((a,c)=>a+(c.reach||0),0);
  const runnersOf=p=>1+(p.staff.runner||0);
  const basketOf=p=>T.RUNNER.basket+(p.ups.basket||0)*T.UPGRADES.basket.basket;
  const runSpeedOf=p=>T.RUNNER.speed*(1+(p.ups.legs||0)*T.UPGRADES.legs.speed);
  const streakStepOf=p=>charmsOf(p).reduce((a,ch)=>ch.streakStep?Math.max(a,ch.streakStep):a,T.SCORE.streakStep);
  const priceFor=(p,g)=>Math.max(T.GOODS[g].cost+1,T.GOODS[g].list+T.STANCES[p.stance].d);
  const side=st=>st.z<0?-1:1;   // -1: the row above the street, 1: below it
  // where the owner stands (street side, beside the till), where a customer pays, where runners wait (behind)
  const post=st=>({x:st.x+B.post.dx,z:side(st)*B.post.z});
  const payAt=st=>({x:st.x+B.pay.dx,z:side(st)*B.pay.z});
  const backOf=(st,i)=>({x:st.x-1.2+(i||0)*1.2,z:st.z+side(st)*1.55});
  const atStall=(p,st)=>{const b=post(st);return dist(p.x,p.z,st.x,st.z)<=T.STALL_RANGE||dist(p.x,p.z,b.x,b.z)<=T.STALL_RANGE;};
  const targetFor=run=>Math.round(R.targets[run.day-1]*Math.pow(R.grow,run.round-1)/10)*10;

  /* ---------- the map: what's in the way ---------- */
  const BOXES=(()=>{
    const out=[],w=B.stall.w/2,d=B.stall.d/2;
    for(const st of B.stalls.concat(B.closed))out.push([st.x-w,st.x+w,st.z-d,st.z+d]);
    for(const b of B.boxes)out.push(b);
    for(const sp of Object.values(T.SUPPLIERS))out.push(sp.prop);
    return out;
  })();
  /** Could a bean of radius r stand at (x,z)? */
  function blocked(x,z,r){
    r=r==null?T.BEAN_R:r;
    if(x<B.x0+r||x>B.x1-r||z<B.z0+r||z>B.z1-r)return true;
    for(const [x0,x1,z0,z1] of BOXES)if(x>x0-r&&x<x1+r&&z>z0-r&&z<z1+r){
      const cx=Math.max(x0,Math.min(x1,x)),cz=Math.max(z0,Math.min(z1,z));if(Math.hypot(x-cx,z-cz)<r)return true;}
    for(const [px,pz,pr] of B.posts)if(Math.hypot(x-px,z-pz)<pr+r)return true;
    return false;
  }
  /** Push a bean at (x,z) out of anything it overlaps; returns [x,z]. */
  function collide(x,z){
    const r=T.BEAN_R;
    x=Math.max(B.x0+r,Math.min(B.x1-r,x));z=Math.max(B.z0+r,Math.min(B.z1-r,z));
    for(const [x0,x1,z0,z1] of BOXES){
      const cx=Math.max(x0,Math.min(x1,x)),cz=Math.max(z0,Math.min(z1,z)),dx=x-cx,dz=z-cz,d=Math.hypot(dx,dz);
      if(d>=r)continue;
      if(d>1e-4){x=cx+dx/d*r;z=cz+dz/d*r;}
      else{const l=x-x0,rr=x1-x,t=z-z0,b=z1-z,m=Math.min(l,rr,t,b);if(m===l)x=x0-r;else if(m===rr)x=x1+r;else if(m===t)z=z0-r;else z=z1+r;}
    }
    for(const [px,pz,pr] of B.posts){const dx=x-px,dz=z-pz,d=Math.hypot(dx,dz),m=pr+r;if(d<m&&d>1e-4){x=px+dx/d*m;z=pz+dz/d*m;}}
    return [x,z];
  }

  /* ---------- a new day ---------- */
  // the same random opening stock for every stall, so it's fair
  function openingMix(s){
    const M=T.START_MIX,pool=M.pool.slice(),mix={},kinds=intIn(s,M.kinds);
    for(let i=0;i<kinds&&pool.length;i++){const g=pool.splice(Math.floor(rnd(s)*pool.length),1)[0];mix[g]=intIn(s,M.each);}
    return mix;
  }
  function setPrices(s,p){const st=s.stalls[p.stall];for(const g in T.GOODS)st.price[g]=priceFor(p,g);}
  const freshStats=()=>({sales:0,earned:0,spent:0,best:null,steals:0,stolen:0,lists:0,wasted:0,bonus:0,streakTop:0,multTop:1});
  // a morning: every stall stocked with the mix and priced, runners home, scores at zero
  function openDay(s){
    s.mix=openingMix(s);s.runners=[];
    for(const id of s.order){
      const p=s.players[id],st=s.stalls[p.stall],b=post(st);
      Object.assign(p,{x:b.x,z:b.z,mt:0,carry:{},score:0,streak:{n:0,last:-99},orders:[],st:freshStats()});
      st.stock=Object.assign({},s.mix);setPrices(s,p);
      for(let i=0;i<runnersOf(p);i++){const h=backOf(st,i);s.runners.push({id:p.id+'.'+i,owner:p.id,i,x:h.x,z:h.z,task:'idle',item:null,carry:{},path:[],wait:0});}
    }
  }
  /** The first day of a run. o: {seed, diff, players:[{id,name,col,ai}]} (the first player without ai is you). */
  function newState(o){
    const seed=((o&&o.seed)>>>0)||1;
    const run={round:1,day:1,target:0};run.target=targetFor(run);
    const s={v:2,seed,rng:seed,tick:0,t:0,day:T.DAY,run,phase:'day',part:'morning',diff:(o&&o.diff)||'normal',
      players:{},order:[],stalls:[],sup:{},cust:[],runners:[],mix:{},nextCust:1,nid:1,feed:[],fid:1,result:null,shop:null};
    B.stalls.forEach((d,i)=>s.stalls.push({id:i,owner:null,x:d.x,z:d.z,stock:{},price:{}}));
    for(const [k,v] of Object.entries(T.SUPPLIERS))s.sup[k]={x:v.x,z:v.z};
    ((o&&o.players)||[]).slice(0,s.stalls.length).forEach((q,i)=>{
      const Rv=q.ai?T.RIVALS[q.ai]:null;
      s.stalls[i].owner=q.id;
      s.players[q.id]={id:q.id,name:String(q.name||'Bean').slice(0,14),col:q.col||'#FFD23F',ai:q.ai||null,stall:i,
        coins:Rv?Rv.coins:R.startCoins,stance:Rv?Rv.stance:'fair',charms:[],staff:{},ups:Object.assign({},Rv?Rv.ups:{})};
      s.order.push(q.id);
    });
    openDay(s);
    return s;
  }
  /** The next day of the run, once today's target is beaten: coins, charms, staff and upgrades carry over. */
  function nextDay(prev){
    if(!prev||prev.phase!=='closed')return null;
    const s=JSON.parse(JSON.stringify(prev)),run=s.run;
    run.day++;if(run.day>R.days){run.day=1;run.round++;}
    run.target=targetFor(run);
    s.seed=(Math.imul(prev.seed^0x9E3779B9,run.round*7+run.day)>>>0)||1;s.rng=s.seed;
    Object.assign(s,{tick:0,t:0,phase:'day',part:'morning',cust:[],nextCust:1,nid:1,feed:[],fid:1,result:null,shop:null});
    for(const id of s.order){const p=s.players[id];if(p.ai)p.coins=Math.max(p.coins,T.RIVALS[p.ai].coins);}   // rivals never go broke
    openDay(s);
    return s;
  }

  function ev(s,k,data){
    s.feed.push(Object.assign({id:s.fid++,t:s.t,k},data));
    if(s.feed.length>T.FEED_MAX)s.feed.splice(0,s.feed.length-T.FEED_MAX);
  }
  const ok=extra=>Object.assign({ok:true},extra);
  const no=reason=>({ok:false,reason});
  const goodOk=g=>Object.prototype.hasOwnProperty.call(T.GOODS,g);
  const custById=(s,id)=>s.cust.find(c=>c.id===id);
  const loseStreak=(s,p,why)=>{if(p.streak.n>1)ev(s,'streakLost',{p:p.id,n:p.streak.n,why});p.streak.n=0;};

  /** What a stall can sell this customer right now: the most things they want that fit their budget. */
  function offer(s,c,st){
    const have=c.want.filter(g=>st.stock[g]>0);
    if(!have.length)return {ok:false,reason:'nostock'};
    have.sort((a,b)=>st.price[a]-st.price[b]||(a<b?-1:1));
    const items=[];let total=0;
    for(const g of have)if(total+st.price[g]<=c.budget){items.push(g);total+=st.price[g];}
    if(!items.length)return {ok:false,reason:'pricey'};
    return {ok:true,items,total,full:items.length===c.want.length};
  }
  // put a pitch in: shared by the pitch action and auto-selling at your stall
  function addPitch(s,c,p,auto){
    c.pitched[p.id]=s.t;c.pitches.push({p:p.id,at:s.t});
    if(c.ph!=='think'){c.ph='think';c.until=r2(s.t+T.DECIDE);}
    ev(s,'pitch',{p:p.id,cust:c.id,auto:!!auto});
  }
  const pitchable=c=>c.ph==='walk'||c.ph==='browse'||c.ph==='think';
  const inRing=(s,p,c)=>{const pa=payAt(s.stalls[p.stall]);return dist(c.x,c.z,pa.x,pa.z)<=reachOf(p);};
  /** Could p steal this customer right now? Returns the deal they'd get, or why not. */
  function stealDeal(s,p,c){
    if(!c||c.ph!=='go'||!c.deal)return {ok:false,reason:'busy'};
    if(c.deal.p===p.id)return {ok:false,reason:'yours'};
    if((c.steals||0)>=T.STEAL.max)return {ok:false,reason:'loyal'};
    if(!inRing(s,p,c)&&dist(p.x,p.z,c.x,c.z)>T.PITCH_RANGE)return {ok:false,reason:'reach'};   // in your ring, or walk up to them
    const st=s.stalls[p.stall];
    if(!c.deal.items.every(g=>st.stock[g]>0))return {ok:false,reason:'nostock'};
    const off=(p.staff.haggler?0:T.STEAL.off);
    const prices=Object.assign({},c.deal.prices);
    const top=c.deal.items.slice().sort((a,b)=>prices[b]-prices[a])[0];prices[top]=Math.max(1,prices[top]-off);   // the coin off comes off the dearest thing
    return {ok:true,deal:{p:p.id,stall:st.id,items:c.deal.items.slice(),prices,total:c.deal.items.reduce((a,g)=>a+prices[g],0),full:c.deal.full,stolen:true,from:c.deal.p}};
  }

  /* ---------- actions ---------- */
  const ACT={
    // where a bean is: players report their own. Capped at dash speed, kept on the board.
    move(s,p,a){
      let x=+a.x,z=+a.z;if(!Number.isFinite(x)||!Number.isFinite(z))return no('bad');
      const max=T.DASH.speed*T.MOVE_SLACK*Math.max(0,s.t-p.mt)+0.3,d=dist(p.x,p.z,x,z);
      let clamped=false;
      if(d>max){x=p.x+(x-p.x)*max/d;z=p.z+(z-p.z)*max/d;clamped=true;}
      [x,z]=collide(x,z);
      p.x=r2(x);p.z=r2(z);p.mt=s.t;return ok({clamped});
    },
    // fetching stock yourself (quicker for something urgent, but your stall's unattended)
    buy(s,p,a){
      const g=a.item;if(!goodOk(g))return no('bad');
      const sp=s.sup[g];if(dist(p.x,p.z,sp.x,sp.z)>T.SUPPLIER_RANGE)return no('far');
      const cost=T.GOODS[g].cost,room=capOf(p)-carried(p);
      if(room<=0)return no('full');
      const n=Math.min(Math.max(1,Math.floor(+a.n||1)),room,Math.floor(p.coins/cost));
      if(n<=0)return no('broke');
      p.coins-=n*cost;p.carry[g]=(p.carry[g]||0)+n;p.st.spent+=n*cost;
      ev(s,'buy',{p:p.id,item:g,n,cost:n*cost});
      return ok({n});
    },
    shelve(s,p){
      const st=s.stalls[p.stall];
      if(!atStall(p,st))return no('far');
      if(!carried(p))return no('empty');
      const n=stockUp(st,p.carry);if(!n)return no('shelffull');
      ev(s,'shelve',{p:p.id,n});return ok({n});
    },
    // send a runner for a basket of something (it pays at the supplier)
    order(s,p,a){
      const g=a.item;if(!goodOk(g))return no('bad');
      if(p.orders.length>=T.RUNNER.queue)return no('queue');   // a few orders can wait for a free runner
      p.orders.push(g);ev(s,'order',{p:p.id,item:g});return ok();
    },
    cancel(s,p){if(!p.orders.length)return no('empty');const g=p.orders.pop();ev(s,'cancel',{p:p.id,item:g});return ok();},
    // your whole stall's prices, one tap
    stance(s,p,a){if(!T.STANCES[a.stance])return no('bad');if(p.stance===a.stance)return ok({same:true});p.stance=a.stance;setPrices(s,p);ev(s,'stance',{p:p.id,stance:a.stance});return ok();},
    pitch(s,p,a){
      const c=custById(s,a.cust);if(!c)return no('gone');
      if(!pitchable(c))return no('busy');
      if(dist(p.x,p.z,c.x,c.z)>T.PITCH_RANGE)return no('far');
      if(!inRing(s,p,c))return no('reach');
      const last=c.pitched[p.id];if(last!=null&&s.t-last<T.REPITCH)return no('already');
      const o=offer(s,c,s.stalls[p.stall]);
      if(!o.ok){if(o.reason==='pricey'){c.pitched[p.id]=s.t;ev(s,'pricey',{p:p.id,cust:c.id});}return no(o.reason);}
      addPitch(s,c,p,false);
      return ok();
    },
    // a customer on their way to someone else: a coin less and they're yours
    steal(s,p,a){
      const c=custById(s,a.cust);if(!c)return no('gone');
      const d=stealDeal(s,p,c);if(!d.ok)return no(d.reason);
      const from=s.players[c.deal.p];
      c.deal=d.deal;c.steals=(c.steals||0)+1;p.st.steals++;
      if(from){from.st.stolen++;loseStreak(s,from,'stolen');}
      ev(s,'steal',{p:p.id,from:from?from.id:null,cust:c.id,items:d.deal.items,price:d.deal.total});
      return ok();
    },
    // between days: the shop
    shopBuy(s,p,a){
      const o=s.shop&&s.shop.offers[a.i];if(!o||o.sold)return no('bad');
      if(p.coins<o.cost)return no('broke');
      if(o.kind==='charm'){if(p.charms.length>=T.SHOP.slots)return no('slots');if(has(p,o.key))return no('owned');p.charms.push(o.key);}
      else if(o.kind==='staff'){if((p.staff[o.key]||0)>=T.STAFF[o.key].max)return no('owned');p.staff[o.key]=(p.staff[o.key]||0)+1;}
      else{if((p.ups[o.key]||0)>=T.UPGRADES[o.key].max)return no('owned');p.ups[o.key]=(p.ups[o.key]||0)+1;}
      p.coins-=o.cost;o.sold=true;ev(s,'bought',{p:p.id,kind:o.kind,key:o.key,cost:o.cost});return ok();
    },
    reroll(s,p){
      const cost=rerollCost(s);if(p.coins<cost)return no('broke');
      p.coins-=cost;s.shop.rerolls++;s.shop.offers=shopOffers(s,p);ev(s,'reroll',{p:p.id,cost});return ok();
    },
    sellCharm(s,p,a){
      const i=p.charms.indexOf(a.key);if(i<0)return no('bad');
      p.charms.splice(i,1);const back=Math.floor(T.CHARMS[a.key].cost*T.SHOP.sell);p.coins+=back;ev(s,'sold',{p:p.id,key:a.key,coins:back});return ok({coins:back});
    },
    // a speech bubble; nothing else changes
    say(s,p,a){const text=String(a.text||'').slice(0,40);if(!text)return no('bad');ev(s,'say',{p:p.id,text});return ok();},
  };
  const BETWEEN=new Set(['shopBuy','reroll','sellCharm']);
  function applyAction(s,a){
    if(!a||typeof a!=='object'||!Object.prototype.hasOwnProperty.call(ACT,a.type))return no('unknown');
    const p=s.players[a.player];if(!p)return no('noplayer');
    if(BETWEEN.has(a.type)){if(s.phase!=='closed'||!s.shop)return no('closed');}
    else if(s.phase!=='day')return no('closed');
    const r=ACT[a.type](s,p,a);
    if(r.ok&&typeof a.say==='string'&&a.say)ev(s,'say',{p:p.id,text:a.say.slice(0,40)});
    return r;
  }
  // put what you're holding on the shelf (as much as fits); returns how many
  function stockUp(st,from){
    let n=0;
    for(const g of Object.keys(from)){
      const put=Math.min(from[g],T.SHELF_MAX-(st.stock[g]||0));if(put<=0)continue;
      st.stock[g]=(st.stock[g]||0)+put;from[g]-=put;n+=put;if(!from[g])delete from[g];
    }
    return n;
  }

  /* ---------- the shop ---------- */
  const rerollCost=s=>T.SHOP.reroll+s.shop.rerolls*T.SHOP.rerollUp;
  function shopOffers(s,p){
    const pool=[];
    for(const [k,c] of Object.entries(T.CHARMS))if(!has(p,k))pool.push({kind:'charm',key:k,cost:c.cost,w:3});
    for(const [k,c] of Object.entries(T.STAFF))if((p.staff[k]||0)<c.max)pool.push({kind:'staff',key:k,cost:c.cost,w:1});
    for(const [k,c] of Object.entries(T.UPGRADES))if((p.ups[k]||0)<c.max)pool.push({kind:'upgrade',key:k,cost:c.cost,w:1});
    const out=[];
    while(out.length<T.SHOP.offers&&pool.length){
      const i=pool.indexOf(weighted(s,pool.map(o=>[o,o.w])));const o=pool.splice(i,1)[0];out.push({kind:o.kind,key:o.key,cost:o.cost,sold:false});
    }
    return out;
  }

  /* ---------- scoring: chips × mult ---------- */
  function score(s,p,c,items,price,stolen,full){
    const S=T.SCORE,part=s.part;
    // the hot streak: every sale adds to it; losing a customer you pitched to (or having one stolen) resets it
    const step=streakStepOf(p);
    p.streak.n++;p.streak.last=s.t;
    let chips=price,mult=1+(p.streak.n-1)*step,x=1;
    const listX=full&&c.kind==='list'?charmsOf(p).reduce((a,ch)=>ch.listX?Math.max(a,ch.listX):a,S.listX):1;
    if(stolen)mult+=S.stealMult;
    const lucky=has(p,'lucky')&&rnd(s)<T.CHARMS.lucky.chance;
    for(const ch of charmsOf(p)){
      const n=ch.item?items.filter(g=>g===ch.item).length:1;if(!n)continue;
      if(ch.when==='morning'&&part!=='morning')continue;
      if(ch.when==='evening'&&part!=='evening')continue;
      if(ch.when==='steal'&&!stolen)continue;
      if(ch.when==='lucky'&&!lucky)continue;
      if(ch.chips)chips+=ch.chips*n;
      if(ch.mult)mult+=ch.mult;
      if(ch.xmult)x*=ch.xmult;
    }
    mult=Math.round(mult*listX*x*100)/100;
    const gain=Math.round(chips*mult);
    p.score+=gain;
    if(p.streak.n>p.st.streakTop)p.st.streakTop=p.streak.n;
    if(mult>p.st.multTop)p.st.multTop=mult;
    return {chips,mult,gain,lucky,listX};
  }

  /* ---------- customers ---------- */
  function spawn(s){
    const S=T.STREET,dir=rnd(s)<0.5?1:-1,kind=weighted(s,Object.entries(T.CUST_MIX[s.part]));
    const weights=()=>Object.entries(T.GOODS).map(([k,g])=>[k,g.weight]);
    let want,budget;
    if(kind==='list'){
      const n=intIn(s,T.LIST.items);want=[];
      while(want.length<n){const g=weighted(s,weights().filter(([k])=>!want.includes(k)));want.push(g);}
      budget=Math.round(want.reduce((a,g)=>a+T.GOODS[g].list,0)*between(s,T.LIST.mult));
    }else{
      want=[weighted(s,weights())];
      budget=Math.round(T.GOODS[want[0]].list*between(s,T.BUDGET_MULT));
    }
    const lane=r2((rnd(s)*2-1)*S.lane);
    const c={id:'c'+s.nid++,kind,x:dir>0?S.x0:S.x1,z:lane,lane,dir,born:s.t,ph:'walk',until:0,
      want,budget,got:[],pitches:[],pitched:{},looked:[],deal:null,steals:0,look:Math.floor(rnd(s)*1e6)};
    s.cust.push(c);ev(s,'arrive',{cust:c.id,kind,want:want.slice(),budget});
  }
  function stepTo(o,x,z,speed){
    const d=dist(o.x,o.z,x,z),k=speed*T.DT;
    if(d<=k){o.x=r2(x);o.z=r2(z);return true;}
    o.x=r2(o.x+(x-o.x)*k/d);o.z=r2(o.z+(z-o.z)*k/d);return false;
  }
  // after the pitching window: the offer covering the most of their list, then the cheapest, then the earliest pitch.
  // Everyone else who pitched lost them: their streaks end.
  function decide(s,c){
    let best=null;
    for(const pt of c.pitches){
      const p=s.players[pt.p];if(!p)continue;const st=s.stalls[p.stall],o=offer(s,c,st);if(!o.ok)continue;
      if(!best||o.items.length>best.items.length||(o.items.length===best.items.length&&o.total<best.total))
        best={p:p.id,stall:st.id,items:o.items,prices:Object.fromEntries(o.items.map(g=>[g,st.price[g]])),total:o.total,full:o.full};
    }
    const losers=new Set(c.pitches.map(pt=>pt.p));c.pitches=[];
    if(best){losers.delete(best.p);c.deal=best;c.ph='go';ev(s,'chose',{cust:c.id,p:best.p,items:best.items,price:best.total});}
    else{c.ph='walk';ev(s,'pass',{cust:c.id});}
    for(const id of losers)loseStreak(s,s.players[id],'lost');
  }
  function sell(s,c){
    const d=c.deal,st=s.stalls[d.stall],p=s.players[d.p];c.deal=null;
    const items=p?d.items.filter(g=>st.stock[g]>0):[];
    if(!items.length){c.ph='walk';if(p)loseStreak(s,p,'soldout');ev(s,'soldout',{cust:c.id,p:d.p,items:d.items});return;}
    let price=0;for(const g of items){st.stock[g]--;price+=d.prices[g];}
    const full=d.full&&items.length===d.items.length;
    const bonus=full&&c.kind==='list'?Math.max(1,Math.round(price*T.LIST_BONUS)):0;
    const piggy=charmsOf(p).reduce((a,ch)=>a+(ch.coin||0),0);
    const sc=score(s,p,c,items,price,!!d.stolen,full);
    p.coins+=price+bonus+piggy;p.st.sales++;p.st.earned+=price+bonus+piggy;p.st.bonus+=bonus;if(bonus)p.st.lists++;
    if(!p.st.best||sc.gain>p.st.best.gain)p.st.best={items:items.slice(),gain:sc.gain,chips:sc.chips,mult:sc.mult};
    c.want=c.want.filter(g=>!items.includes(g));c.got.push(...items);c.budget=Math.max(0,c.budget-price);
    if(!c.want.length||c.budget<=0){c.ph='leave';c.happy=true;}else c.ph='walk';   // a list may carry on to other stalls
    ev(s,'sale',{p:p.id,cust:c.id,items,price,bonus,coin:piggy,chips:sc.chips,mult:sc.mult,gain:sc.gain,streak:p.streak.n,stolen:!!d.stolen,full:full&&c.kind==='list',lucky:sc.lucky});
  }
  function updateCustomer(s,c){
    const S=T.STREET;
    if(pitchable(c)&&s.t-c.born>T.CUST_LIFE){c.ph='leave';c.happy=c.got.length>0;ev(s,'giveup',{cust:c.id});}
    switch(c.ph){
      case 'walk':{
        c.x=r2(c.x+c.dir*T.CUST_SPEED*T.DT);
        if(Math.abs(c.z-c.lane)>0.01)c.z=r2(c.z+Math.sign(c.lane-c.z)*Math.min(Math.abs(c.lane-c.z),T.CUST_SPEED*T.DT));
        if((c.dir>0&&c.x>=S.x1)||(c.dir<0&&c.x<=S.x0)){c.gone=true;ev(s,'left',{cust:c.id});break;}
        // a stall with something they want catches their eye: they stop for a look
        for(const st of s.stalls){
          if(!st.owner||c.looked.includes(st.id)||!c.want.some(g=>st.stock[g]>0))continue;
          if(Math.abs(c.x-st.x)<T.BROWSE_NEAR&&(c.dir>0?c.x<st.x:c.x>st.x)){c.looked.push(st.id);c.ph='browse';c.until=r2(s.t+T.BROWSE);c.at=st.id;break;}
        }
        break;
      }
      case 'browse':if(s.t>=c.until)c.ph='walk';break;
      case 'think':if(s.t>=c.until)decide(s,c);break;
      case 'go':{const pa=payAt(s.stalls[c.deal.stall]);if(stepTo(c,pa.x,pa.z,T.CUST_GO_SPEED)){c.ph='buy';c.until=r2(s.t+T.BUY_TIME);}break;}
      case 'buy':if(s.t>=c.until)sell(s,c);break;
      case 'leave':{
        const ex=c.dir>0?S.x1:S.x0;
        if(stepTo(c,ex,c.lane,T.CUST_SPEED*1.3))c.gone=true;
        break;
      }
    }
  }
  // standing at your stall sells for you: anyone in your ring gets pitched, joining any other pitches
  // in the deciding window (the order stalls go in each tick takes turns, so ties are shared)
  function autoSell(s){
    const n=s.stalls.length;
    for(const c of s.cust){
      if(!pitchable(c))continue;
      for(let k=0;k<n;k++){
        const st=s.stalls[(s.tick+k)%n],p=st.owner&&s.players[st.owner];if(!p||!atStall(p,st))continue;
        if(!inRing(s,p,c))continue;
        const last=c.pitched[p.id];if(last!=null&&s.t-last<T.REPITCH)continue;
        if(!offer(s,c,st).ok){c.pitched[p.id]=s.t;continue;}
        addPitch(s,c,p,true);
      }
    }
  }

  /* ---------- runners ---------- */
  function walkPath(r,speed){
    let left=speed*T.DT;
    while(left>0&&r.path.length){
      const [tx,tz]=r.path[0],d=Math.hypot(tx-r.x,tz-r.z);
      if(d<=left){r.x=r2(tx);r.z=r2(tz);left-=d;r.path.shift();}
      else{r.x=r2(r.x+(tx-r.x)*left/d);r.z=r2(r.z+(tz-r.z)*left/d);left=0;}
    }
    return !r.path.length;
  }
  const route=(r,x,z)=>{r.path=CMNav.path(CMNav.boardGrid(),r.x,r.z,x,z).map(q=>[q[0],q[1]]);};
  function updateRunner(s,r){
    const p=s.players[r.owner],st=s.stalls[p.stall],speed=runSpeedOf(p);
    if(r.task==='idle'){
      if(!p.orders.length)return;
      r.item=p.orders.shift();r.task='out';const sp=s.sup[r.item];route(r,sp.x,sp.z);
      ev(s,'runner',{p:p.id,r:r.id,item:r.item});return;
    }
    if(r.task==='out'){
      if(!walkPath(r,speed))return;
      if(r.wait<T.RUNNER.buyTime){r.wait=r2(r.wait+T.DT);return;}
      r.wait=0;
      const G=T.GOODS[r.item],n=Math.min(basketOf(p),Math.floor(p.coins/G.cost),T.SHELF_MAX-(st.stock[r.item]||0));
      if(n>0){p.coins-=n*G.cost;p.st.spent+=n*G.cost;r.carry={[r.item]:n};ev(s,'fetched',{p:p.id,r:r.id,item:r.item,n,cost:n*G.cost});}
      else ev(s,'broke',{p:p.id,r:r.id,item:r.item});
      r.task='back';const h=backOf(st,r.i);route(r,h.x,h.z);return;
    }
    if(r.task==='back'){
      if(!walkPath(r,speed))return;
      const n=stockUp(st,r.carry);r.carry={};
      if(n)ev(s,'delivered',{p:p.id,r:r.id,item:r.item,n});
      r.task='idle';r.item=null;
    }
  }

  /* ---------- the clock ---------- */
  function tick(s){
    if(s.phase!=='day')return;
    s.tick++;s.t=Math.round(s.tick*T.DT*1000)/1000;
    const part=partAt(s.t,s.day);if(part!==s.part){s.part=part;ev(s,'part',{part});}
    if(s.t>=s.day){close(s);return;}
    if(s.t>=s.nextCust){
      if(s.cust.length<T.CUST_MAX)spawn(s);
      s.nextCust=r2(s.t+between(s,T.SPAWN_GAP[s.part]));
    }
    for(const c of s.cust)updateCustomer(s,c);
    autoSell(s);
    for(const r of s.runners)updateRunner(s,r);
    if(s.cust.some(c=>c.gone))s.cust=s.cust.filter(c=>!c.gone);
  }

  // closing: unsold stock is worth nothing (unless you've a Bargain Bin); did you beat the target?
  function close(s){
    s.cust=[];
    const you=s.order.map(id=>s.players[id]).find(p=>!p.ai);
    for(const id of s.order){
      const p=s.players[id],st=s.stalls[p.stall];
      const left={...st.stock};for(const r of s.runners)if(r.owner===id)for(const [g,n] of Object.entries(r.carry))left[g]=(left[g]||0)+n;
      for(const [g,n] of Object.entries(p.carry))left[g]=(left[g]||0)+n;
      p.st.wasted=Object.values(left).reduce((a,b)=>a+b,0);
      const refund=charmsOf(p).reduce((a,ch)=>a+(ch.refund||0),0);
      p.st.refund=refund?Math.floor(Object.entries(left).reduce((a,[g,n])=>a+T.GOODS[g].cost*n,0)*refund):0;
      p.coins+=p.st.refund;p.orders=[];
    }
    const res={score:you?you.score:0,target:s.run.target,passed:false,beat:0,over:0,interest:0};
    if(you&&you.score>=s.run.target){
      res.passed=true;res.beat=R.beat;
      res.over=Math.min(R.over.max,Math.floor((you.score/s.run.target-1)/R.over.per));
      res.interest=Math.min(R.interest.max,Math.floor(you.coins/R.interest.per));
      you.coins+=res.beat+res.over+res.interest;
      s.phase='closed';s.shop={rerolls:0,offers:[]};s.shop.offers=shopOffers(s,you);
    }else s.phase='over';
    s.result=res;
    ev(s,'close',{passed:res.passed});
  }

  /** Rebuild a day from its start state (or the first day's options) and a log of [tick, action] pairs. */
  function replay(start,log,untilTick){
    const s=start&&start.phase?JSON.parse(JSON.stringify(start)):newState(start);let i=0;
    const end=untilTick!=null?untilTick:Math.round(s.day/T.DT)+1;
    while(s.tick<end&&s.phase==='day'){
      while(i<log.length&&log[i][0]===s.tick)applyAction(s,log[i++][1]);
      tick(s);
    }
    return s;
  }

  return {newState,nextDay,applyAction,tick,replay,partAt,carried,capOf,reachOf,runnersOf,basketOf,runSpeedOf,streakStepOf,priceFor,offer,stealDeal,inRing,
    rerollCost,targetFor,post,payAt,backOf,atStall,blocked,collide,dist,rnd,clone:s=>JSON.parse(JSON.stringify(s))};
})();
