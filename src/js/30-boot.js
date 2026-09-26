/* =========================================================
   Boot and the main loop
   ========================================================= */
function onResize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();fitCamera();}
window.addEventListener('resize',onResize);

let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.max(0,Math.min(0.1,(now-last)/1000));last=now;const ts=now/1000;
  boardTick(ts);fxTick(dt);
  if(CMG.on)gameFrame(dt,ts);else demoFrame(dt,ts);
  renderer.render(scene,camera);
}

async function boot(){
  try{await Promise.race([Promise.all([document.fonts.load('40px "Lilita One"'),document.fonts.load('900 30px Nunito')]),new Promise(r=>setTimeout(r,2500))]);}catch(e){}
  buildBoard();
  onResize();
  $('#loading').hidden=true;
  demoStart();
  requestAnimationFrame(frame);
  if(new URLSearchParams(location.search).has('play'))gameStart();   // straight into a day
}
boot();
// for the console and dev checks
window.__cm={CMG,CM_TUNE,CMSim,CMAI,CMNav,P,WV,BD,gameStart,gameExit,gameStep,frame,camera,scene};
