/* =========================================================
   Audio: tiny synth, sound effects and a lo-fi loop
   (Copied from Whereabouts, the co-op I spy game on the same island.)
   ========================================================= */
const AU={ctx:null,master:null,music:null,muted:false,next:0,step:0,timer:null};
try{AU.muted=localStorage.getItem('wb.muted')==='1';}catch(e){}
function audioInit(){
  if(AU.ctx){if(AU.ctx.state==='suspended')AU.ctx.resume();return;}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  try{AU.ctx=new AC();}catch(e){return;}
  AU.master=AU.ctx.createGain();AU.master.gain.value=AU.muted?0:0.7;AU.master.connect(AU.ctx.destination);
  const lp=AU.ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1500;lp.connect(AU.master);
  AU.music=AU.ctx.createGain();AU.music.gain.value=0.13;AU.music.connect(lp);
  AU.next=AU.ctx.currentTime+0.3;AU.timer=setInterval(musicTick,200);
}
function tone(freq,dur,type,vol,delay,slide,dest){
  if(!AU.ctx)return;const c=AU.ctx,t=c.currentTime+(delay||0);
  const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||0.2,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(dest||AU.master);o.start(t);o.stop(t+dur+0.05);
}
const sfx={
  chime(){[784,988,1175,1568,2093].forEach((f,i)=>tone(f,0.6,'triangle',0.16,i*0.07));},
  thud(){tone(170,0.35,'sine',0.5,0,50);tone(95,0.2,'square',0.05,0,45);},
  blip(){tone(880,0.12,'sine',0.18);tone(1320,0.18,'sine',0.15,0.09);},
  jump(){tone(300,0.16,'square',0.035,0,640);},
  pop(){tone(620,0.09,'triangle',0.14,0,940);},
  tick(){tone(1200,0.05,'triangle',0.08);},
  hint(){tone(660,0.16,'triangle',0.13);tone(990,0.28,'triangle',0.12,0.12);},
  zoom(){tone(420,0.14,'sine',0.05,0,840);},
  sad(){[523,494,440,392].forEach((f,i)=>tone(f,0.32,'triangle',0.11,i*0.15));},
  fanfare(){[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,0.34,'triangle',0.15,i*0.12));},
  spy(){tone(392,0.2,'triangle',0.15);tone(587,0.35,'triangle',0.15,0.16);},
  clue(){tone(523,0.18,'sine',0.14);tone(784,0.3,'sine',0.13,0.12);},
  cluck(v){v=v||1;tone(560,0.07,'square',0.03*v,0,380);tone(600,0.07,'square',0.03*v,0.1,420);tone(700,0.1,'square',0.025*v,0.2,480);},
  meow(v){v=v||1;tone(560,0.16,'triangle',0.12*v,0,900);tone(900,0.3,'triangle',0.1*v,0.15,480);},
  bark(v){v=v||1;tone(460,0.09,'square',0.05*v,0,250);tone(440,0.1,'square',0.045*v,0.17,230);},
  coin(){tone(988,0.08,'square',0.045);tone(1319,0.3,'square',0.045,0.08);},
  gull(v){tone(1600,0.32,'sawtooth',0.02*v,0,850);tone(1450,0.28,'sawtooth',0.018*v,0.3,760);},
};
const CHORDS=[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]];
const PENTA=[72,74,76,79,81,84];
const mtof=m=>440*Math.pow(2,(m-69)/12);
function musicTick(){
  if(!AU.ctx||AU.muted)return;const c=AU.ctx;const half=60/74/2;
  while(AU.next<c.currentTime+0.7){
    const s=AU.step,t=AU.next-c.currentTime;
    if(s%8===0){const ch=CHORDS[(s/8|0)%4];ch.forEach((n,i)=>tone(mtof(n),3.4,'triangle',0.09,t+i*0.03,null,AU.music));tone(mtof(ch[0]-12),3.2,'sine',0.12,t,null,AU.music);}
    if(s%4===0)tone(62,0.25,'sine',0.25,t,40,AU.music);
    if(s%2===1)tone(5200,0.03,'triangle',0.02,t,null,AU.music);
    if(Math.random()<0.34)tone(mtof(pick(PENTA)),0.5,'sine',0.07,t+(Math.random()<0.3?half*0.5:0),null,AU.music);
    AU.next+=half;AU.step++;
  }
}
function toggleMute(){
  AU.muted=!AU.muted;try{localStorage.setItem('wb.muted',AU.muted?'1':'0');}catch(e){}
  if(AU.master)AU.master.gain.value=AU.muted?0:0.7;
  $('#mute').textContent=AU.muted?'Sound off':'Sound on';
}
$('#mute').textContent=AU.muted?'Sound off':'Sound on';
$('#mute').addEventListener('click',()=>{audioInit();toggleMute();});

