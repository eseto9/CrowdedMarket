/* =========================================================
   Tuning: every number the game plays by, including the map.
   Plain data only (no browser, no THREE): the simulation, the
   AI, the renderer and the tests all read it. Times are seconds,
   money is coins, distances are metres. x runs left→right on
   screen, z runs top→bottom (towards the camera).
   ========================================================= */
const CM_TUNE={
  DT:0.1,                    // one simulation tick
  DAYS:{short:60,normal:120,long:180},   // how long a trading day lasts (chosen on the title screen)
  DAY_DEFAULT:'normal',
  PARTS:[                    // day parts, starting at this fraction of the day
    {k:'morning',f:0,label:'Morning',icon:'🌅'},
    {k:'midday',f:1/3,label:'Midday',icon:'☀️'},
    {k:'evening',f:2/3,label:'Evening',icon:'🌇'},
  ],
  CLOSING_WARN:0.2,          // "closing soon!" when this much of the day is left (30 s at most)

  START_COINS:30,
  START_STOCK:{bread:3,fruit:3},   // every stall opens with this on the shelf
  CARRY:6,                   // units a bean can carry at once
  SHELF_MAX:20,              // units of one good a stall can hold
  PRICE_MAX:60,

  // goods: cost = what the supplier charges, list = the price a stall opens at, weight = how often it's wanted
  GOODS:{
    fish:   {icon:'🐟',name:'Fish',   cost:4,list:9, weight:3},
    bread:  {icon:'🥖',name:'Bread',  cost:2,list:5, weight:4},
    flowers:{icon:'💐',name:'Flowers',cost:3,list:8, weight:2},
    fruit:  {icon:'🍎',name:'Fruit',  cost:2,list:5, weight:4},
    cheese: {icon:'🧀',name:'Cheese', cost:5,list:11,weight:2},
    teapot: {icon:'🫖',name:'Teapots',cost:8,list:17,weight:1},
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
  STALL_RANGE:2.6,           // ...to your stall (or its post) to shelve or set prices
  PITCH_RANGE:3.2,           // ...to a customer to pitch
  STALL_REACH:7,             // a customer must be this close to your stall's till to be pitched (the ring round your stall)

  // movement: everyone walks at the same speed; a dash is a short burst with a cooldown
  WALK:6,
  DASH:{speed:14,time:0.2,cool:1.6},
  MOVE_SLACK:1.25,           // allowance for frame jitter when checking a move
  BEAN_R:0.42,               // how wide a bean is, for bumping into things

  // customers
  STREET:{x0:-26,x1:26,lane:2.1},   // they walk the street from one end to the other
  CUST_SPEED:1.5,
  CUST_GO_SPEED:2.6,         // walking over to the stall they chose
  CUST_MAX:10,               // on the street at once
  CUST_LIFE:70,              // gives up and leaves after this long
  SPAWN_GAP:{morning:[3,4.5],midday:[2.2,3.3],evening:[1.6,2.6]},
  BROWSE:1.4,                // stops to look at a stall that has what they want
  BROWSE_NEAR:2.2,           // ...when it passes this close
  DECIDE:1.6,                // after the first pitch, how long other stalls get to pitch too
  REPITCH:3,                 // a stall can pitch the same customer again after this long
  BUDGET_MULT:[0.95,1.5],    // a budget customer's max price = list × this
  BUY_TIME:0.8,              // at the stall, paying

  FEED_MAX:40,               // events kept in the state

  // AI rivals: personality × difficulty
  AI:{
    think:{easy:1.1,normal:0.55,hard:0.3},       // seconds between decisions
    speed:{easy:4.6,normal:5.4,hard:6},          // metres per second (never above WALK)
    pitchDelay:{easy:1.3,normal:0.6,hard:0.2},   // how long before it notices a customer
    restockAt:{easy:2,normal:4,hard:6},          // goes for more when its shelf is this low...
    variety:{easy:1,normal:2,hard:3},            // ...or has fewer kinds of goods than this
    share:0.5,                                    // the part of the customers it expects to win
    sayGap:10,                                    // at most one speech bubble this often
  },
  RIVALS:{
    undercutter:{name:'Ursula',title:'The Undercutter',col:'#FF5D73',
      fit:{t:'hawaii',tc:0,tp:'solid',b:'skirt',bc:4,bp:'dots',s:'sneakers',sc:0,x:'shades',r:'board'},
      startMult:0.85,        // opens every price at list × this
      undercutBy:1,          // beats a rival's price by this much
      floorMargin:1,         // never prices within this of cost
      says:{undercut:['Half price!','Cheaper here!','Beat that!','Bargains!'],sale:['Pleasure doing business!','Come again!'],restock:['Back in a jiffy!','More stock, coming up!']}},
  },
};
