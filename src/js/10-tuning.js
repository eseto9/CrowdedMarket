/* =========================================================
   Tuning: every number the game plays by, including the map.
   Plain data only (no browser, no THREE): the simulation, the
   AI, the renderer and the tests all read it. Times are seconds,
   money is coins, distances are metres. x runs left→right on
   screen, z runs top→bottom (towards the camera).
   ========================================================= */
const CM_TUNE={
  DT:0.1,                    // one simulation tick
  DAY:75,                    // a trading day
  PARTS:[                    // day parts, starting at this fraction of the day
    {k:'morning',f:0,label:'Morning',icon:'🌅'},
    {k:'midday',f:1/3,label:'Midday',icon:'☀️'},
    {k:'evening',f:2/3,label:'Evening',icon:'🌇'},
  ],
  CLOSING_WARN:15,           // "closing soon!" with this many seconds left

  /* ---------- the run ----------
     Rounds of three days. Beat each day's score target to go on; miss one and the run is over.
     Score beats targets; coins buy stock and things in the shop. */
  RUN:{
    days:3,
    targets:[130,200,300],   // round 1: day 1, day 2, the big day (an idle stall scores ~35, a busy one ~190)
    grow:1.6,                // each round's targets are this many times the last round's
    startCoins:15,
    beat:4,                  // coins for beating a target...
    over:{per:0.25,max:4},   // ...plus 1 for every 25% you beat it by (at most 4)
    interest:{per:5,max:5},  // ...plus 1 for every 5 coins you're holding (at most 5)
  },
  // every stall opens each day with the same random mix: this many kinds, this many of each, from this pool
  START_MIX:{kinds:[2,3],each:[2,3],pool:['bread','fruit','fish','flowers','cheese']},
  CARRY:6,                   // units you can carry yourself
  SHELF_MAX:20,              // units of one good a stall can hold

  // goods: cost = what the supplier charges, list = the market price, weight = how often it's wanted
  GOODS:{
    fish:   {icon:'🐟',name:'Fish',   cost:4,list:9, weight:3},
    bread:  {icon:'🥖',name:'Bread',  cost:2,list:5, weight:4},
    flowers:{icon:'💐',name:'Flowers',cost:3,list:8, weight:2},
    fruit:  {icon:'🍎',name:'Fruit',  cost:2,list:5, weight:4},
    cheese: {icon:'🧀',name:'Cheese', cost:5,list:11,weight:2},
    teapot: {icon:'🫖',name:'Teapots',cost:8,list:17,weight:1},
  },
  // your whole stall's pricing, one tap: this much off or on the market price (never below cost + 1)
  STANCES:{
    bargain:{icon:'🏷️',name:'Bargain',d:-1},
    fair:   {icon:'⚖️',name:'Fair',d:0},
    premium:{icon:'💎',name:'Premium',d:2},
  },

  /* ---------- scoring: every sale scores chips × mult ----------
     chips: what the sale was for. mult: 1, plus the hot streak, plus charms.
     The hot streak: every sale adds +streakStep; losing a customer you pitched to (they chose someone
     else, your shelf ran out, or they were stolen from you) ends it. A whole shopping list in one go
     counts ×listX; a stolen customer adds +stealMult. */
  SCORE:{streakStep:0.5,listX:2,stealMult:1},
  LIST_BONUS:0.25,           // coins: a whole shopping list pays this much extra

  // stealing: a customer on their way to someone else's stall switches to you for a coin less than their deal
  STEAL:{off:1,max:2},       // max: how many times one customer can be stolen

  // runners fetch stock so you can stay at your stall: tap a supplier to send one
  RUNNER:{speed:4.5,basket:4,queue:3,buyTime:0.6},

  /* ---------- the shop between days ---------- */
  SHOP:{offers:4,reroll:2,rerollUp:1,slots:5,sell:0.5},
  // charms: permanent, up to SHOP.slots at once. What each does is data the scoring reads:
  //   item: only sales with this good · when: morning|evening|steal|list|lucky · chips: + per matching good
  //   mult: + mult · xmult: × mult · listX / streakStep: replace the base value · reach: bigger sale ring
  //   coin: + coins per sale · refund: share of unsold stock's cost back at closing
  CHARMS:{
    bell:  {icon:'🔔',name:'Fishmonger’s Bell',desc:'🐟 sales score ×2',cost:6,item:'fish',xmult:2},
    dozen: {icon:'🥖',name:'Baker’s Dozen',desc:'+4 chips for every 🥖 sold',cost:4,item:'bread',chips:4},
    apple: {icon:'🍎',name:'Apple a Day',desc:'+2 mult on 🍎 sales',cost:4,item:'fruit',mult:2},
    posy:  {icon:'🌸',name:'Posy Pin',desc:'+3 mult on 💐 sales',cost:5,item:'flowers',mult:3},
    rind:  {icon:'🧀',name:'Big Cheese',desc:'+6 chips for every 🧀 sold',cost:5,item:'cheese',chips:6},
    tea:   {icon:'🫖',name:'Tea Party',desc:'🫖 sales score ×3',cost:6,item:'teapot',xmult:3},
    bag:   {icon:'👜',name:'Shopping Bag',desc:'A whole shopping list scores ×3 (not ×2)',cost:6,listX:3},
    fingers:{icon:'🧤',name:'Sticky Fingers',desc:'Stolen customers score ×1.5',cost:5,when:'steal',xmult:1.5},
    early: {icon:'🐓',name:'Early Bird',desc:'+2 mult in the morning',cost:4,when:'morning',mult:2},
    owl:   {icon:'🦉',name:'Night Owl',desc:'+3 mult in the evening',cost:5,when:'evening',mult:3},
    rush:  {icon:'⏱️',name:'Rush Hour',desc:'Hot streaks build twice as fast',cost:6,streakStep:1},
    lucky: {icon:'🍀',name:'Lucky Coin',desc:'1 sale in 4 scores ×2',cost:5,when:'lucky',chance:0.25,xmult:2},
    bin:   {icon:'🗑️',name:'Bargain Bin',desc:'Unsold stock refunds half its cost at closing',cost:4,refund:0.5},
    crier: {icon:'📣',name:'Town Crier',desc:'Your sale ring is 2 m bigger',cost:5,reach:2},
    piggy: {icon:'🐷',name:'Piggy Bank',desc:'+1 coin for every sale',cost:5,coin:1},
  },
  // staff and upgrades: bought as often as max allows
  STAFF:{
    runner:{icon:'🏃',name:'Extra runner',desc:'Another runner to fetch stock',cost:8,max:2},
    haggler:{icon:'🤝',name:'Haggler',desc:'Stealing a customer costs you nothing off the price',cost:6,max:1},
  },
  UPGRADES:{
    legs:  {icon:'👟',name:'Quick legs',desc:'Runners 25% faster',cost:5,max:2,speed:0.25},
    basket:{icon:'🧺',name:'Bigger basket',desc:'Runners carry 2 more',cost:5,max:2,basket:2},
    awning:{icon:'⛱️',name:'Bigger awning',desc:'Your sale ring is 2 m bigger',cost:6,max:1,reach:2},
  },

  /* ---------- the board ----------
     One screen of market: a street across the middle, a row of stalls above and below it,
     shops along the top, the harbour quay along the bottom, and suppliers round the edges. */
  BOARD:{
    x0:-24,x1:24,z0:-12,z1:11.5,           // where beans can walk
    street:{z0:-3,z1:3},                   // cobbles; customers walk along it
    stall:{w:3.6,d:1.4},                   // a stall's counter footprint
    stalls:[{x:-5,z:-5},{x:5,z:-5},{x:-5,z:5},{x:5,z:5}],   // the four trading stalls
    closed:[{x:-15,z:-5},{x:15,z:-5},{x:-15,z:5},{x:15,z:5}],   // shuttered stalls, for show (and in the way)
    post:{dx:1.6,z:3.6},                   // the owner's spot: street side, beside the till
    pay:{dx:-0.6,z:3.4},                   // where a customer stands to pay
    // things in the way besides stalls: [x0,x1,z0,z1] boxes and [x,z,r] circles
    boxes:[[-1.3,1.3,-9.3,-8.5]],          // a bench, top middle
    posts:[[-10,-3.4,0.25],[10,-3.4,0.25],[-10,3.4,0.25],[10,3.4,0.25],   // lamp posts
           [-21,-3.9,0.6],[-21,3.9,0.6],[21,-3.9,0.6],[21,3.9,0.6]],   // planters at the street ends, on the kerb
  },
  // where each good comes from: the spot you stand on to buy, and the prop beside it (a box you can't walk through)
  SUPPLIERS:{
    bread:  {x:-12, z:-10.3,prop:[-10.8,-9.4,-11.9,-10.9],name:'the bakery'},
    teapot: {x:17.5,z:-10,  prop:[19.4,22.4,-11.9,-9.1],  name:'the pottery'},
    flowers:{x:-20.4,z:-8.5,prop:[-23.9,-21.7,-9.7,-7.3], name:'the flower cart'},
    fruit:  {x:-20.4,z:8.5, prop:[-23.9,-21.7,7.3,9.7],   name:'the fruit stand'},
    cheese: {x:20.4,z:8.5,  prop:[21.7,23.9,7.3,9.7],     name:'the dairy cart'},
    fish:   {x:0,   z:10.2, prop:[1.1,2.7,10.3,11.5],     name:'the fish quay'},
  },

  // ranges
  SUPPLIER_RANGE:2.2,        // stand this close to a supplier to buy
  STALL_RANGE:2.6,           // ...to your stall (or its post) to shelve
  PITCH_RANGE:3.2,           // ...to a customer to pitch by hand
  STALL_REACH:7,             // your sale ring: customers this close to your till can be sold to (or stolen)

  // movement: everyone walks at the same speed; a dash is a short burst with a cooldown
  WALK:6,
  DASH:{speed:14,time:0.2,cool:1.6},
  MOVE_SLACK:1.25,           // allowance for frame jitter when checking a move
  BEAN_R:0.42,               // how wide a bean is, for bumping into things

  // customers: what kinds turn up in each part of the day
  CUST_MIX:{morning:{budget:1},midday:{budget:0.6,list:0.4},evening:{budget:0.6,list:0.4}},
  LIST:{items:[2,3],mult:[1.05,1.35]},     // shopping lists: 2-3 different things and a total budget
  STREET:{x0:-26,x1:26,lane:2.1},   // they walk the street from one end to the other
  CUST_SPEED:1.6,
  CUST_GO_SPEED:2.6,         // walking over to the stall they chose
  CUST_MAX:11,               // on the street at once
  CUST_LIFE:60,              // gives up and leaves after this long
  SPAWN_GAP:{morning:[2.4,3.4],midday:[1.8,2.6],evening:[1.4,2.2]},
  BROWSE:1.4,                // stops to look at a stall that has what they want
  BROWSE_NEAR:2.2,           // ...when it passes this close
  DECIDE:1.4,                // after the first pitch, how long other stalls get to pitch too
  REPITCH:3,                 // a stall can pitch the same customer again after this long
  BUDGET_MULT:[0.95,1.5],    // a budget customer's max price = list × this
  BUY_TIME:0.8,              // at the stall, paying

  FEED_MAX:40,               // events kept in the state

  // AI rivals: personality × difficulty
  AI:{
    think:{easy:1.1,normal:0.55,hard:0.3},       // seconds between decisions
    stealDelay:{easy:2,normal:1,hard:0.4},       // how long before it notices a customer it could steal
    share:0.45,                                   // the part of the customers it expects to win
    keep:4,                                       // coins it won't spend below
    stale:10,                                     // no sale for this long: fetch what people keep asking for
    askedWorth:0.5,                               // how much each turned-away customer counts when choosing what to fetch
    sayGap:8,                                     // at most one speech bubble this often
  },
  RIVALS:{
    undercutter:{name:'Ursula',title:'The Undercutter',col:'#FF5D73',
      fit:{t:'hawaii',tc:0,tp:'solid',b:'skirt',bc:4,bp:'dots',s:'sneakers',sc:0,x:'shades',r:'board'},
      stance:'bargain',steal:0.8,ups:{},coins:15,
      says:{steal:['Mine now!','Sorry, not sorry!','Better deal here!'],sale:['Pleasure doing business!','Come again!'],restock:['More stock, coming up!'],stolen:['Hey!','Oi, that was mine!']}},
    hoarder:{name:'Hattie',title:'The Hoarder',col:'#9B5DE5',
      fit:{t:'puffer',tc:3,tp:'solid',b:'overalls',bc:6,bp:'solid',s:'boots',sc:1,x:'backpack',r:'board'},
      stance:'fair',steal:0.15,ups:{basket:2},coins:15,
      says:{sale:['Lovely!','One less on the pile.'],restock:['Stocking up!','Mine, all mine!'],stolen:['Well I never!','Rude!']}},
  },
};
