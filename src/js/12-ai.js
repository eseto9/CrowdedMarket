/* =========================================================
   AI shopkeepers
   An AI is a client like a player: each tick it reads the state
   (only what a player could see: stalls, prices, customers'
   request bubbles, where everyone is) and returns actions that
   go through CMSim.applyAction. It walks its own path no faster
   than a player runs. Its private memory (plan, path, timers,
   its own dice) lives outside the game state.
   ========================================================= */

/* ---------- paths: A* on a grid of walkable cells ---------- */
const CMNav=(()=>{
  // blocked(x,z) → true where a bean can't stand
  function makeGrid(x0,z0,w,h,cell,blocked){
    const g=new Uint8Array(w*h);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++)g[j*w+i]=blocked(x0+(i+0.5)*cell,z0+(j+0.5)*cell)?1:0;
    return {x0,z0,w,h,cell,g,cache:new Map()};
  }
  const cellOf=(G,x,z)=>[Math.floor((x-G.x0)/G.cell),Math.floor((z-G.z0)/G.cell)];
  const free=(G,i,j)=>i>=0&&j>=0&&i<G.w&&j<G.h&&!G.g[j*G.w+i];
  function nearestFree(G,i,j){
    if(free(G,i,j))return [i,j];
    for(let r=1;r<12;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;if(free(G,i+di,j+dj))return [i+di,j+dj];}
    return null;
  }
  // straight line between two cell centres stays on free cells
  function sight(G,a,b){
    const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*3);
    for(let k=1;k<n;k++){const x=a[0]+(b[0]-a[0])*k/n,y=a[1]+(b[1]-a[1])*k/n;
      for(const [ox,oy] of[[0.35,0.35],[-0.35,0.35],[0.35,-0.35],[-0.35,-0.35]])if(!free(G,Math.floor(x+0.5+ox),Math.floor(y+0.5+oy)))return false;}
    return true;
  }
  function path(G,ax,az,bx,bz){
    if(!G)return [[bx,bz]];
    const key=[ax,az,bx,bz].map(v=>Math.round(v)).join(',');
    if(G.cache.has(key)){const c=G.cache.get(key);return c.length?c.slice(0,-1).concat([[bx,bz]]):[[bx,bz]];}
    const s=nearestFree(G,...cellOf(G,ax,az)),t=nearestFree(G,...cellOf(G,bx,bz));
    if(!s||!t)return [[bx,bz]];
    const W=G.w,N=W*G.h,gs=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
    const heap=[],push=(k,f)=>{heap.push([f,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
    const h=(i,j)=>{const dx=Math.abs(i-t[0]),dy=Math.abs(j-t[1]);return Math.max(dx,dy)+0.414*Math.min(dx,dy);};
    const sk=s[1]*W+s[0],tk=t[1]*W+t[0];gs[sk]=0;push(sk,h(...s));
    let found=false;
    while(heap.length){
      const [,k]=pop();if(closed[k])continue;closed[k]=1;if(k===tk){found=true;break;}
      const i=k%W,j=(k-i)/W;
      for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
        if(!di&&!dj)continue;const ni=i+di,nj=j+dj;if(!free(G,ni,nj))continue;
        if(di&&dj&&(!free(G,i+di,j)||!free(G,i,j+dj)))continue;   // no cutting corners
        const nk=nj*W+ni,g=gs[k]+(di&&dj?1.414:1);
        if(g<gs[nk]){gs[nk]=g;from[nk]=k;push(nk,g+h(ni,nj));}
      }
    }
    if(!found){G.cache.set(key,[]);return [[bx,bz]];}
    const cells=[];for(let k=tk;k!==-1;k=from[k])cells.push([k%W,(k-k%W)/W]);cells.reverse();
    // keep only the corners you can't see past
    const pts=[cells[0]];let a=0;
    for(let k=2;k<cells.length;k++)if(!sight(G,cells[a],cells[k])){pts.push(cells[k-1]);a=k-1;}
    pts.push(cells[cells.length-1]);
    const world=pts.slice(1).map(([i,j])=>[G.x0+(i+0.5)*G.cell,G.z0+(j+0.5)*G.cell]);
    G.cache.set(key,world);
    return world.length?world.slice(0,-1).concat([[bx,bz]]):[[bx,bz]];
  }
  // the board's grid, built once from the same map the simulation uses (half-metre cells)
  let board=null;
  function boardGrid(){
    if(board)return board;
    const B=CM_TUNE.BOARD,c=0.5;
    board=makeGrid(B.x0,B.z0,Math.ceil((B.x1-B.x0)/c),Math.ceil((B.z1-B.z0)/c),c,(x,z)=>CMSim.blocked(x,z,CM_TUNE.BEAN_R+0.1));
    return board;
  }
  return {makeGrid,path,boardGrid};
})();

const CMAI=(()=>{
  const T=CM_TUNE,A=T.AI,S=CMSim;
  function newMem(id,kind,diff,seed){
    return newDay({id,kind,diff:A.think[diff]?diff:'normal',rng:(seed>>>0)||1});
  }
  /** A fresh day: forget yesterday's plans and faces, keep its dice. */
  function newDay(m){return Object.assign(m,{next:0,sayAt:-99,seen:{},tried:{},missed:{},lastSale:0});}
  function roll(m){let t=(m.rng=(m.rng+0x6D2B79F5)>>>0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  const oneOf=(m,list)=>list[Math.floor(roll(m)*list.length)];
  // a speech bubble now and then, so you can read what it's up to
  function say(s,m,kind,chance){
    const lines=T.RIVALS[m.kind].says[kind];
    if(!lines||s.t-m.sayAt<A.sayGap||roll(m)>(chance==null?0.6:chance))return undefined;
    m.sayAt=s.t;return oneOf(m,lines);
  }
  // what's on its way: queued orders and runners out fetching
  const coming=(s,p,g)=>p.orders.filter(o=>o===g).length*S.basketOf(p)+s.runners.filter(r=>r.owner===p.id&&r.item===g&&r.task!=='idle').length*S.basketOf(p);

  // what's worth sending a runner for: customers still to come who'd want it (shared with the other
  // stalls selling it, plus those it's had to turn away), less what's on the shelf or on its way,
  // for the profit per second of the round trip. Nothing, if no trip pays.
  function chooseGood(s,m){
    const p=s.players[m.id],st=s.stalls[p.stall],speed=S.runSpeedOf(p),basket=S.basketOf(p);
    const W=Object.values(T.GOODS).reduce((a,g)=>a+g.weight,0),gap=T.SPAWN_GAP[s.part],rate=2/(gap[0]+gap[1]);
    let best=null;
    for(const [g,G] of Object.entries(T.GOODS)){
      if(p.coins-G.cost<A.keep)continue;
      const sp=s.sup[g],trip=2*S.dist(st.x,st.z,sp.x,sp.z)/speed+T.RUNNER.buyTime+1;
      const left=s.day-s.t-trip;if(left<5)continue;
      const rivals=s.stalls.filter(o=>o!==st&&o.owner&&o.stock[g]>0).length;
      const demand=left*rate*G.weight/W*A.share/(1+rivals)+(m.missed[g]||0)*A.askedWorth-(st.stock[g]||0)-coming(s,p,g);
      if(demand<=0.5)continue;
      const price=st.price[g],n=Math.min(basket,Math.floor((p.coins-A.keep)/G.cost));if(n<=0)continue;
      const score=(Math.min(n,demand)*price-n*G.cost)/trip;
      if(score>0&&(!best||score>best.score))best={g,score};
    }
    return best;
  }

  function think(s,m,out){
    const p=s.players[m.id],st=s.stalls[p.stall],R=T.RIVALS[m.kind],me=m.id;
    if(p.stance!==R.stance)out.push({type:'stance',player:me,stance:R.stance});
    // customers: note what the ones in its ring want that it hasn't got, and steal any it can
    for(const c of s.cust){
      if(!S.inRing(s,p,c))continue;
      if(!m.seen[c.id]){m.seen[c.id]=s.t;for(const g of c.want)if(!(st.stock[g]>0))m.missed[g]=(m.missed[g]||0)+1;}
      if(c.ph!=='go'||!c.deal||c.deal.p===me)continue;
      const key=c.id+':'+(c.steals||0);if(m.tried[key])continue;
      if(!S.stealDeal(s,p,c).ok)continue;
      if(m.seen['go'+key]==null){m.seen['go'+key]=s.t;continue;}
      if(s.t-m.seen['go'+key]<A.stealDelay[m.diff])continue;
      m.tried[key]=true;
      if(roll(m)<R.steal)out.push({type:'steal',player:me,cust:c.id,say:say(s,m,'steal',0.7)});
    }
    // stock: send a runner when one's free and nothing's queued
    const idle=s.runners.some(r=>r.owner===me&&r.task==='idle');
    const stale=s.t-m.lastSale>=A.stale&&Object.values(m.missed).some(n=>n>=2);
    if(idle&&!p.orders.length){
      const pick=chooseGood(s,m);
      if(pick){out.push({type:'order',player:me,item:pick.g,say:say(s,m,'restock',stale?0.6:0.2)});m.missed[pick.g]=0;if(stale)m.lastSale=s.t;}
    }
  }

  /** One tick for one AI: returns the actions it takes. */
  function step(s,m){
    const out=[];if(s.phase!=='day')return out;
    const p=s.players[m.id];if(!p)return out;
    if(s.t>=m.next){m.next=s.t+A.think[m.diff];think(s,m,out);}
    // now and then something that just happened gets a bubble
    for(const e of s.feed){if(e.t!==s.t)continue;
      if(e.k==='sale'&&e.p===m.id)m.lastSale=s.t;
      const l=e.k==='sale'&&e.p===m.id?say(s,m,'sale',0.25):e.k==='steal'&&e.from===m.id?say(s,m,'stolen',0.8):null;
      if(l)out.push({type:'say',player:m.id,text:l});}
    return out;
  }
  return {newMem,newDay,step};
})();
