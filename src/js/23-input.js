/* =========================================================
   Input: keys (WASD / arrows move in screen directions), the
   mouse (point at things, click to act or walk there) and touch
   (tap to walk and act, plus Dash and Act buttons).
   ========================================================= */
const IN={keys:{},nx:0,ny:0,mouse:false,touch:false};
const raycaster=new THREE.Raycaster(),GROUND=new THREE.Plane(new V3(0,1,0),0),tmpV=new V3();
function ndc(e){const r=canvas.getBoundingClientRect();return [((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1];}
function groundAt(nx,ny){raycaster.setFromCamera({x:nx,y:ny},camera);return raycaster.ray.intersectPlane(GROUND,tmpV)?{x:tmpV.x,z:tmpV.z}:null;}
// the customer under the pointer, if any
function custAt(nx,ny){
  raycaster.setFromCamera({x:nx,y:ny},camera);
  const list=[];for(const v of WV.cust.values())v.m.traverse(o=>{if(o.isMesh&&!o.userData.isOutline)list.push(o);});
  const h=raycaster.intersectObjects(list,false)[0];return h?h.object.userData.cust:null;
}
// which way the keys point, in world directions (up the screen is -z)
function keyDir(){
  const k=IN.keys;let x=0,z=0;
  if(k.KeyA||k.ArrowLeft)x-=1;if(k.KeyD||k.ArrowRight)x+=1;if(k.KeyW||k.ArrowUp)z-=1;if(k.KeyS||k.ArrowDown)z+=1;
  const l=Math.hypot(x,z);return l?{x:x/l,z:z/l}:null;
}

window.addEventListener('keydown',e=>{
  const typing=document.activeElement&&(document.activeElement.tagName==='INPUT'||document.activeElement.tagName==='TEXTAREA');
  if(typing){if(e.key==='Escape')document.activeElement.blur();return;}
  audioInit();
  if(!CMG.on)return;
  IN.keys[e.code]=true;
  if(e.code==='Space'||e.code==='Tab'||e.code.startsWith('Arrow'))e.preventDefault();
  if(e.repeat)return;
  gameKey(e);
});
window.addEventListener('keyup',e=>{IN.keys[e.code]=false;if(CMG.on)gameKeyUp(e);});
window.addEventListener('blur',()=>{for(const k in IN.keys)IN.keys[k]=false;});

canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'){[IN.nx,IN.ny]=ndc(e);IN.mouse=true;}});
canvas.addEventListener('pointerleave',()=>{IN.mouse=false;});
canvas.addEventListener('pointerdown',e=>{
  audioInit();
  if(e.pointerType==='touch'&&!IN.touch){IN.touch=true;document.documentElement.classList.add('touch');}
  if(!CMG.on||e.button!==0)return;
  const [nx,ny]=ndc(e);gameClick(nx,ny,e.shiftKey);
});
if(window.matchMedia&&matchMedia('(pointer:coarse)').matches){IN.touch=true;document.documentElement.classList.add('touch');}
// touch buttons act the moment a finger lands
$('#tDash').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();gameDash();});
$('#tAct').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();gameAct(false);});
$('#tAll').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();gameAct(true);});
$('#tPrices').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pricesOpen();});
