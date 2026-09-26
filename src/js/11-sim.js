/* =========================================================
   The simulation
   All game state is one plain, JSON-safe object. It only ever
   changes through applyAction(state, action) (players and AI
   alike) and tick(state) (the authority's clock: customers,
   timers, closing). No browser, no THREE: the tests run this in
   Node, and a multiplayer host will run it later.
   Randomness comes from state.rng, so a seed plus the list of
   [tick, action] pairs replays a day exactly (see replay()).
   A market week is three days: nextDay(state) carries coins and
   upgrades into a fresh day.
   ========================================================= */
const CMSim=(()=>{
  const T=CM_TUNE,B=T.BOARD;
  const r2=v=>Math.round(v*100)/100;
  const dist=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
  // mulberry32, its whole state kept in s.rng
  function rnd(s){let t=(s.rng=(s.rng+0x6D2B79F5)>>>0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  const between=(s,[a,b])=>a+rnd(s)*(b-a);
  const intIn=(s,[a,b])=>a+Math.floor(rnd(s)*(b-a+1));
  function weighted(s,list){let sum=0;for(const [,w] of list)sum+=w;let r=rnd(s)*sum;for(const [k,w] of list){r-=w;if(r<0)return k;}return list[list.length-1][0];}
  const partAt=(t,day)=>{let p=T.PARTS[0];for(const x of T.PARTS)if(t>=x.f*day)p=x;return p.k;};
  const carried=p=>Object.values(p.carry).reduce((a,b)=>a+b,0);
  // what upgrades do
  const capOf=p=>T.CARRY+(p.ups.crate?T.UPGRADES.crate.carry:0);
  const speedOf=p=>p.ups.boots?T.UPGRADES.boots.speed:1;
  const reachOf=p=>T.STALL_REACH+(p.ups.awning?T.UPGRADES.awning.reach:0);
  const side=st=>st.z<0?-1:1;   // -1: the row above the street, 1: below it
  // where the owner stands (street side, beside the till) and where a customer pays
  const post=st=>({x:st.x+B.post.dx,z:side(st)*B.post.z});
  const payAt=st=>({x:st.x+B.pay.dx,z:side(st)*B.pay.z});
  const atStall=(p,st)=>{const b=post(st);return dist(p.x,p.z,st.x,st.z)<=T.STALL_RANGE||dist(p.x,p.z,b.x,b.z)<=T.STALL_RANGE;};

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
  function openStalls(s){
    s.mix=openingMix(s);
    for(const st of s.stalls){if(!st.owner)continue;st.stock=Object.assign({},s.mix);for(const g in T.GOODS)st.price[g]=T.GOODS[g].list;}
  }
  /** Day one of a week. o: {seed, len, diff, players:[{id,name,col,ai}]} */
  function newState(o){
    const seed=(o&&o.seed)>>>0;
    const len=T.DAYS[o&&o.len]?o.len:T.DAY_DEFAULT;
    const s={v:1,seed,rng:seed,tick:0,t:0,len,day:T.DAYS[len],week:{n:1,of:T.WEEK},phase:'day',part:'morning',diff:(o&&o.diff)||'normal',
      players:{},order:[],stalls:[],sup:{},cust:[],mix:{},wars:{},cuts:[],nextCust:1.2,nid:1,feed:[],fid:1,recap:null};
    B.stalls.forEach((d,i)=>s.stalls.push({id:i,owner:null,x:d.x,z:d.z,stock:{},price:{}}));
    for(const [k,v] of Object.entries(T.SUPPLIERS))s.sup[k]={x:v.x,z:v.z};
    ((o&&o.players)||[]).slice(0,s.stalls.length).forEach((p,i)=>{
      const st=s.stalls[i];st.owner=p.id;
      const b=post(st);
      s.players[p.id]={id:p.id,name:String(p.name||'Bean').slice(0,14),col:p.col||'#FFD23F',ai:p.ai||null,x:b.x,z:b.z,mt:0,
        coins:T.START_COINS,stall:i,carry:{},ups:{},st:freshStats()};
      s.order.push(p.id);
    });
    openStalls(s);
    return s;
  }
  const freshStats=()=>({sales:0,earned:0,spent:0,best:null,undercuts:0,sabotage:0,haggle:0,wasted:0,bonus:0});
  /** The next day of the week: same players, stalls and upgrades, coins carried over, a new seed. */
  function nextDay(prev){
    if(!prev||prev.phase!=='closed'||prev.week.n>=prev.week.of)return null;
    const seed=(Math.imul(prev.seed^0x9E3779B9,prev.week.n+1)>>>0)||1;
    const s=newState({seed,len:prev.len,diff:prev.diff,players:[]});
    s.week={n:prev.week.n+1,of:prev.week.of,before:(prev.week.before||[]).concat([prev.recap.rows.map(r=>({id:r.id,coins:r.coins,sales:r.sales}))])};
    for(const id of prev.order){
      const q=prev.players[id],st=s.stalls[q.stall];st.owner=id;const b=post(st);
      s.players[id]={id,name:q.name,col:q.col,ai:q.ai,x:b.x,z:b.z,mt:0,coins:q.coins,stall:q.stall,carry:{},ups:Object.assign({},q.ups),st:freshStats()};
      s.order.push(id);
    }
    openStalls(s);
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

  // a price war: two stalls undercutting each other on the same good, back and forth
  function noteUndercut(s,p,g,rivalId){
    const W=T.WAR;
    s.cuts=s.cuts.filter(u=>s.t-u.t<=W.window);
    const back=s.cuts.find(u=>u.item===g&&u.by===rivalId&&u.vs===p.id);
    s.cuts.push({item:g,by:p.id,vs:rivalId,t:s.t});
    const w=s.wars[g];
    if(back||(w&&[w.a,w.b].includes(p.id)&&[w.a,w.b].includes(rivalId))){
      if(!w)ev(s,'war',{item:g,a:rivalId,b:p.id});
      s.wars[g]={a:w?w.a:rivalId,b:w?w.b:p.id,until:r2(s.t+W.last)};
    }
  }

  /* ---------- actions ---------- */
  const ACT={
    // where a bean is: players report their own, AI steers along its path. Capped at dash speed, kept on the board.
    move(s,p,a){
      let x=+a.x,z=+a.z;if(!Number.isFinite(x)||!Number.isFinite(z))return no('bad');
      const max=T.DASH.speed*speedOf(p)*T.MOVE_SLACK*Math.max(0,s.t-p.mt)+0.3,d=dist(p.x,p.z,x,z);
      let clamped=false;
      if(d>max){x=p.x+(x-p.x)*max/d;z=p.z+(z-p.z)*max/d;clamped=true;}
      [x,z]=collide(x,z);
      p.x=r2(x);p.z=r2(z);p.mt=s.t;return ok({clamped});
    },
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
      let n=0;
      for(const g of Object.keys(p.carry)){
        const put=Math.min(p.carry[g],T.SHELF_MAX-(st.stock[g]||0));if(put<=0)continue;
        st.stock[g]=(st.stock[g]||0)+put;p.carry[g]-=put;n+=put;if(!p.carry[g])delete p.carry[g];
      }
      if(!n)return no('shelffull');
      ev(s,'shelve',{p:p.id,n});return ok({n});
    },
    setPrice(s,p,a){
      const g=a.item;if(!goodOk(g))return no('bad');
      const price=Math.round(+a.price);if(!Number.isFinite(price))return no('bad');
      if(price<T.GOODS[g].cost)return no('belowcost');
      if(price>T.PRICE_MAX)return no('toohigh');
      const st=s.stalls[p.stall];
      if(!atStall(p,st))return no('far');
      const old=st.price[g];if(price===old)return ok({same:true});
      st.price[g]=price;
      // an undercut: going strictly below the cheapest rival stall that has it on the shelf
      let rival=Infinity,rivalId=null;
      for(const o of s.stalls)if(o!==st&&o.owner&&(o.stock[g]||0)>0&&o.price[g]<rival){rival=o.price[g];rivalId=o.owner;}
      const under=price<rival&&old>=rival;
      if(under){p.st.undercuts++;noteUndercut(s,p,g,rivalId);}
      ev(s,under?'undercut':'price',{p:p.id,item:g,price,old,vs:under?rivalId:null});
      return ok({undercut:under});
    },
    pitch(s,p,a){
      const c=custById(s,a.cust);if(!c)return no('gone');
      if(!pitchable(c))return no('busy');
      if(dist(p.x,p.z,c.x,c.z)>T.PITCH_RANGE)return no('far');
      const st=s.stalls[p.stall],pa=payAt(st);
      if(dist(c.x,c.z,pa.x,pa.z)>reachOf(p))return no('reach');
      const last=c.pitched[p.id];if(last!=null&&s.t-last<T.REPITCH)return no('already');
      const o=offer(s,c,st);
      if(!o.ok){if(o.reason==='pricey'){c.pitched[p.id]=s.t;ev(s,'pricey',{p:p.id,cust:c.id});}return no(o.reason);}
      addPitch(s,c,p,false);
      return ok();
    },
    // between days: buy an upgrade (once each)
    upgrade(s,p,a){
      const U=T.UPGRADES[a.kind];if(!U)return no('bad');
      if(p.ups[a.kind])return no('owned');
      if(p.coins<U.cost)return no('broke');
      p.coins-=U.cost;p.ups[a.kind]=true;
      ev(s,'upgrade',{p:p.id,kind:a.kind});
      return ok();
    },
    // a speech bubble; nothing else changes
    say(s,p,a){const text=String(a.text||'').slice(0,40);if(!text)return no('bad');ev(s,'say',{p:p.id,text});return ok();},
  };

  function applyAction(s,a){
    if(!a||typeof a!=='object'||!Object.prototype.hasOwnProperty.call(ACT,a.type))return no('unknown');
    const p=s.players[a.player];if(!p)return no('noplayer');
    if(a.type==='upgrade'){if(s.phase!=='closed'||s.week.n>=s.week.of)return no('closed');}   // only between days
    else if(s.phase!=='day')return no('closed');
    const r=ACT[a.type](s,p,a);
    if(r.ok&&typeof a.say==='string'&&a.say)ev(s,'say',{p:p.id,text:a.say.slice(0,40)});
    return r;
  }

  /* ---------- customers ---------- */
  function spawn(s){
    const S=T.STREET,dir=rnd(s)<0.5?1:-1,kind=weighted(s,Object.entries(T.CUST_MIX[s.part]));
    // wanted goods: price wars draw extra customers for the good being fought over
    const weights=()=>Object.entries(T.GOODS).map(([k,g])=>[k,g.weight*(s.wars[k]?T.WAR.draw:1)]);
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
      want,budget,got:[],pitches:[],pitched:{},looked:[],deal:null,look:Math.floor(rnd(s)*1e6)};
    s.cust.push(c);ev(s,'arrive',{cust:c.id,kind,want:want.slice(),budget});
  }
  function stepTo(c,x,z,speed){
    const d=dist(c.x,c.z,x,z),k=speed*T.DT;
    if(d<=k){c.x=r2(x);c.z=r2(z);return true;}
    c.x=r2(c.x+(x-c.x)*k/d);c.z=r2(c.z+(z-c.z)*k/d);return false;
  }
  // after the pitching window: the offer covering the most of their list, then the cheapest, then the earliest pitch
  function decide(s,c){
    let best=null;
    for(const pt of c.pitches){
      const p=s.players[pt.p];if(!p)continue;const st=s.stalls[p.stall],o=offer(s,c,st);if(!o.ok)continue;
      if(!best||o.items.length>best.items.length||(o.items.length===best.items.length&&o.total<best.total))
        best={p:p.id,stall:st.id,items:o.items,prices:Object.fromEntries(o.items.map(g=>[g,st.price[g]])),total:o.total,full:o.full};
    }
    c.pitches=[];
    if(best){c.deal=best;c.ph='go';ev(s,'chose',{cust:c.id,p:best.p,items:best.items,price:best.total});}
    else{c.ph='walk';ev(s,'pass',{cust:c.id});}
  }
  function sell(s,c){
    const d=c.deal,st=s.stalls[d.stall],p=s.players[d.p];c.deal=null;
    const items=p?d.items.filter(g=>st.stock[g]>0):[];
    if(!items.length){c.ph='walk';ev(s,'soldout',{cust:c.id,p:d.p,items:d.items});return;}
    let price=0;for(const g of items){st.stock[g]--;price+=d.prices[g];}
    const full=c.kind==='list'&&d.full&&items.length===d.items.length;
    const bonus=full?Math.max(1,Math.round(price*T.LIST.bonus)):0;
    p.coins+=price+bonus;p.st.sales++;p.st.earned+=price+bonus;p.st.bonus+=bonus;
    if(!p.st.best||price+bonus>p.st.best.price)p.st.best={items:items.slice(),price:price+bonus};
    c.want=c.want.filter(g=>!items.includes(g));c.got.push(...items);c.budget=Math.max(0,c.budget-price);
    if(!c.want.length||c.budget<=0){c.ph='leave';c.happy=true;}else c.ph='walk';   // a list may carry on to other stalls
    ev(s,'sale',{p:p.id,cust:c.id,items,price,bonus});
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
  // standing at your stall sells for you: anyone in your range gets pitched, joining any other pitches
  // in the deciding window (the order stalls go in each tick takes turns, so ties are shared)
  function autoSell(s){
    const n=s.stalls.length;
    for(const c of s.cust){
      if(!pitchable(c))continue;
      for(let k=0;k<n;k++){
        const st=s.stalls[(s.tick+k)%n],p=st.owner&&s.players[st.owner];if(!p||!atStall(p,st))continue;
        const pa=payAt(st);if(dist(c.x,c.z,pa.x,pa.z)>reachOf(p))continue;
        const last=c.pitched[p.id];if(last!=null&&s.t-last<T.REPITCH)continue;
        if(!offer(s,c,st).ok){c.pitched[p.id]=s.t;continue;}
        addPitch(s,c,p,true);
      }
    }
  }

  /* ---------- the clock ---------- */
  function tick(s){
    if(s.phase!=='day')return;
    s.tick++;s.t=Math.round(s.tick*T.DT*1000)/1000;
    const part=partAt(s.t,s.day);if(part!==s.part){s.part=part;ev(s,'part',{part});}
    if(s.t>=s.day){close(s);return;}
    for(const [g,w] of Object.entries(s.wars))if(s.t>=w.until){delete s.wars[g];ev(s,'peace',{item:g});}
    if(s.t>=s.nextCust){
      if(s.cust.length<T.CUST_MAX)spawn(s);
      s.nextCust=r2(s.t+between(s,T.SPAWN_GAP[s.part]));
    }
    for(const c of s.cust)updateCustomer(s,c);
    autoSell(s);
    if(s.cust.some(c=>c.gone))s.cust=s.cust.filter(c=>!c.gone);
  }

  function close(s){
    s.phase='closed';s.cust=[];s.wars={};
    const rows=s.order.map(id=>{const p=s.players[id],st=s.stalls[p.stall];
      p.st.wasted=Object.values(st.stock).reduce((a,b)=>a+b,0)+carried(p);   // unsold stock is worth nothing now
      return {id,name:p.name,col:p.col,ai:p.ai,coins:p.coins,...p.st};});
    rows.sort((a,b)=>b.coins-a.coins||a.spent-b.spent);
    const top=(key,min)=>{let best=null;for(const r of rows)if((r[key]||0)>=(min||1)&&(!best||r[key]>best[key]))best=r;return best;};
    // fun titles, at most two each so everyone has a shot
    const titles=[],count={};
    const add=(r,title,why)=>{if(!r||(count[r.id]||0)>=2)return;count[r.id]=(count[r.id]||0)+1;titles.push({p:r.id,title,why});};
    const last=s.week.n>=s.week.of;
    add(rows[0],last?'Market Champion':'Top of the Day',last?'most coins at the end of the week':'most coins at closing');
    add(top('undercuts'),'Bargain Queen','most undercuts');
    add(top('sabotage'),'Market Menace','most coins spent on sabotage');
    add(top('haggle'),'Haggle Hero','biggest haggle win');
    add(top('bonus'),'List Ticker','most shopping-list bonuses');
    add(top('sales'),'Busy Bee','most sales');
    {let b=null;for(const r of rows)if(r.best&&(!b||r.best.price>b.best.price))b=r;if(b)add(b,'Big Ticket',`best sale: ${b.best.items.map(g=>T.GOODS[g].icon).join('')} for ${b.best.price}`);}
    add(top('spent'),'Big Spender','most spent at suppliers');
    add(top('wasted',5),'Stockpiler','most stock left unsold');
    s.recap={rows,titles,last};
    ev(s,'close',{last});
  }

  /** Rebuild a day from its start state and a log of [tick, action] pairs. start: newState options, or a state to copy. */
  function replay(start,log,untilTick){
    const s=start&&start.phase?JSON.parse(JSON.stringify(start)):newState(start);let i=0;
    const end=untilTick!=null?untilTick:Math.round(s.day/T.DT)+1;
    while(s.tick<end&&s.phase==='day'){
      while(i<log.length&&log[i][0]===s.tick)applyAction(s,log[i++][1]);
      tick(s);
    }
    return s;
  }

  return {newState,nextDay,applyAction,tick,replay,partAt,carried,capOf,speedOf,reachOf,offer,post,payAt,atStall,blocked,collide,dist,rnd,
    clone:s=>JSON.parse(JSON.stringify(s))};
})();
