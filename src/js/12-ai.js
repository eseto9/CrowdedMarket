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
  const T=CM_TUNE,A=T.AI,S=CMSim,GRID=()=>CMNav.boardGrid();
  function newMem(id,kind,diff,seed){
    return {id,kind,diff:A.think[diff]?diff:'normal',rng:(seed>>>0)||1,next:0,path:null,task:'tend',item:null,sayAt:-99,seen:{}};
  }
  function roll(m){let t=(m.rng=(m.rng+0x6D2B79F5)>>>0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  const oneOf=(m,list)=>list[Math.floor(roll(m)*list.length)];
  // a speech bubble now and then, so you can read what it's up to
  function say(s,m,kind,chance){
    const lines=T.RIVALS[m.kind].says[kind];
    if(!lines||s.t-m.sayAt<A.sayGap||roll(m)>(chance==null?0.6:chance))return undefined;
    m.sayAt=s.t;return oneOf(m,lines);
  }
  function goTo(m,pos,x,z){m.path=CMNav.path(GRID(),pos.x,pos.z,x,z);}
  const shelfCount=st=>Object.values(st.stock).reduce((a,b)=>a+b,0);

  // what's worth fetching: how many it can still sell before closing (customers so far
  // this day part × how often people want it × its share of them), less what's on the shelf,
  // for the profit per second of the round trip. Nothing, if no trip pays.
  function chooseGood(s,m,pos){
    const p=s.players[m.id],st=s.stalls[p.stall],R=T.RIVALS[m.kind],speed=A.speed[m.diff];
    const W=Object.values(T.GOODS).reduce((a,g)=>a+g.weight,0),gap=T.SPAWN_GAP[s.part],rate=2/(gap[0]+gap[1]);
    let best=null;
    for(const [g,G] of Object.entries(T.GOODS)){
      const sp=s.sup[g],trip=(S.dist(pos.x,pos.z,sp.x,sp.z)+S.dist(sp.x,sp.z,st.x,st.z))/speed+2;
      const left=T.DAY-s.t-trip;if(left<10)continue;
      const demand=left*rate*G.weight/W*A.share-(st.stock[g]||0);
      const n=Math.min(T.CARRY,Math.floor(p.coins/G.cost),T.SHELF_MAX-(st.stock[g]||0),Math.ceil(demand));if(n<=0)continue;
      const price=Math.max(G.cost+R.floorMargin,Math.round(G.list*R.startMult));
      const score=(Math.min(n,demand)*price-n*G.cost)/trip;
      if(score>0&&(!best||score>best.score))best={g,n,score};
    }
    return best;
  }

  // pos: where it stands once this tick's step is taken
  function think(s,m,out,pos){
    const p=s.players[m.id],st=s.stalls[p.stall],R=T.RIVALS[m.kind],me=m.id,home=S.post(st);
    if(m.path)return;   // on the way somewhere
    if(m.task==='fetch'){   // arrived at the supplier
      out.push({type:'buy',player:me,item:m.item,n:m.n});
      m.task='return';goTo(m,pos,home.x,home.z);return;
    }
    if(m.task==='return'){out.push({type:'shelve',player:me});m.task='tend';}
    const at=S.atStall(pos,st);
    const price={...st.price};   // prices as they'll be once this tick's setPrice actions land
    const setPrice=(g,v)=>{if(v!==price[g]){const a={type:'setPrice',player:me,item:g,price:v};price[g]=v;out.push(a);return a;}return null;};

    // pricing (only at the stall): the Undercutter goes just under anyone selling the same thing
    if(at)for(const g of Object.keys(T.GOODS)){
      if(!(st.stock[g]>0))continue;
      const G=T.GOODS[g],floor=G.cost+R.floorMargin,open=Math.max(floor,Math.round(G.list*R.startMult));
      let rival=Infinity;for(const o of s.stalls)if(o!==st&&o.owner&&(o.stock[g]||0)>0)rival=Math.min(rival,o.price[g]);
      const want=Math.max(floor,rival<Infinity?Math.min(open,rival-R.undercutBy):open);
      const was=price[g],a=setPrice(g,want);
      if(a&&want<was&&rival<Infinity&&want<rival)a.say=say(s,m,'undercut');
    }

    // customers worth pitching: near the stall, wanting something on the shelf at a price they'll pay
    let hop=null,hopD=Infinity;
    for(const c of s.cust){
      if(c.ph!=='walk'&&c.ph!=='browse'&&c.ph!=='think')continue;
      const pa=S.payAt(st);if(S.dist(c.x,c.z,pa.x,pa.z)>T.STALL_REACH-0.5)continue;
      const w=c.want[0];if(!(st.stock[w.item]>0))continue;
      if(c.pitched[me]!=null&&s.t-c.pitched[me]<T.REPITCH)continue;
      if(m.seen[c.id]==null)m.seen[c.id]=s.t;
      if(s.t-m.seen[c.id]<A.pitchDelay[m.diff])continue;
      const floor=T.GOODS[w.item].cost+R.floorMargin;
      if(price[w.item]>w.max&&!(at&&w.max>=floor))continue;
      const d=S.dist(pos.x,pos.z,c.x,c.z);
      if(d<=T.PITCH_RANGE-0.2){
        if(price[w.item]>w.max)setPrice(w.item,w.max);
        out.push({type:'pitch',player:me,cust:c.id});
      }else if(d<hopD){hop=c;hopD=d;}
    }
    if(out.some(a=>a.type==='pitch'))return;
    // step out towards one, stopping a couple of metres short (round anything in the way)
    if(hop){const k=(hopD-2.2)/hopD;goTo(m,pos,pos.x+(hop.x-pos.x)*k,pos.z+(hop.z-pos.z)*k);return;}

    // restock when the shelf runs low and nobody is on the way to buy
    const busy=s.cust.some(c=>c.deal&&c.deal.p===me);
    const kinds=Object.values(st.stock).filter(n=>n>0).length;
    if(!busy&&!S.carried(p)&&(shelfCount(st)<=A.restockAt[m.diff]||kinds<A.variety[m.diff])){
      const pick=chooseGood(s,m,pos);
      if(pick){m.task='fetch';m.item=pick.g;m.n=pick.n;const sp=s.sup[pick.g];goTo(m,pos,sp.x,sp.z);
        const line=say(s,m,'restock',0.4);if(line)out.push({type:'say',player:me,text:line});return;}
    }
    if(S.dist(pos.x,pos.z,home.x,home.z)>0.6)goTo(m,pos,home.x,home.z);
  }

  /** One tick for one AI: returns the actions it takes. */
  function step(s,m){
    const out=[];if(s.phase!=='day')return out;
    const p=s.players[m.id];if(!p)return out;
    // walking: one move per tick along the path, never faster than a player runs
    if(m.path&&m.path.length){
      let left=Math.min(A.speed[m.diff],T.WALK)*T.DT,x=p.x,z=p.z;
      while(left>0&&m.path.length){
        const [tx,tz]=m.path[0],d=Math.hypot(tx-x,tz-z);
        if(d<=left){x=tx;z=tz;left-=d;m.path.shift();}
        else{x+=(tx-x)*left/d;z+=(tz-z)*left/d;left=0;}
      }
      out.push({type:'move',player:m.id,x,z});
      if(!m.path.length){m.path=null;m.next=Math.min(m.next,s.t);}
    }
    if(s.t>=m.next){m.next=s.t+A.think[m.diff];
      const mv=out.length?out[0]:p;   // it plans from where this tick's step leaves it
      think(s,m,out,{x:mv.x,z:mv.z});
    }
    // now and then a sale it just made gets a bubble
    for(const e of s.feed)if(e.k==='sale'&&e.p===m.id&&e.t===s.t){const l=say(s,m,'sale',0.3);if(l)out.push({type:'say',player:m.id,text:l});}
    return out;
  }
  return {newMem,step};
})();
