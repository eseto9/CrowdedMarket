/* =========================================================
   Townsfolk & critters
   (Copied from Whereabouts, the co-op I spy game on the same island.)
   ========================================================= */
function npc(body,hat,skin){
  skin=skin||'#F5C9A0';
  const g=new THREE.Group();
  g.add(at(cyl(0.34,0.42,1.05,body,10),0,0.78,0));
  g.add(at(sph(0.3,skin,12,10),0,1.56,0));
  for(const s of[-1,1]){
    g.add(at(cyl(0.09,0.09,0.4,'#3B2F5C',6,{ol:false}),0.15*s,0.2,0));
    g.add(at(sph(0.045,'#1D1533',6,5,{ol:false,shadow:false}),0.11*s,1.6,0.27));
  }
  const arms=[];
  for(const s of[-1,1]){const p=new THREE.Group();p.position.set(0.42*s,1.18,0);p.add(at(cap(0.08,0.4,body,{w:0.03}),0,-0.28,0));p.rotation.z=0.2*s;g.add(p);arms.push(p);}
  if(hat){g.add(at(cyl(0.22,0.24,0.28,hat,10),0,1.9,0));g.add(at(cyl(0.38,0.38,0.05,hat,12),0,1.77,0));}
  g.userData.arms=arms; return g;
}
function pigeonMesh(c){
  const g=new THREE.Group();
  g.add(scl(at(sph(0.22,c||'#9AA0B8',8,6),0,0.25,0),1,0.9,1.3));
  g.add(at(sph(0.13,'#7C6FA8',8,6),0,0.45,0.2));
  g.add(rot(at(cone(0.04,0.12,'#F2A541',5,{ol:false}),0,0.44,0.36),Math.PI/2,0,0));
  g.add(at(sph(0.03,'#1D1533',5,4,{ol:false,shadow:false}),0.07,0.48,0.3));
  g.add(at(sph(0.03,'#1D1533',5,4,{ol:false,shadow:false}),-0.07,0.48,0.3));
  return g;
}
function catMesh(col){
  const g=new THREE.Group(); const c=col||'#F29A38';
  g.add(scl(at(sph(0.32,c,10,8),0,0.34,0),0.9,0.8,1.5));
  g.add(at(sph(0.25,c,10,8),0,0.62,0.45));
  for(const s of[-1,1]){g.add(rot(at(cone(0.09,0.18,c,4),0.13*s,0.85,0.45),0,0,-0.2*s));g.add(at(sph(0.04,'#1D1533',6,5,{ol:false,shadow:false}),0.09*s,0.66,0.67));}
  const tail=rot(at(cyl(0.05,0.07,0.7,c,6),0,0.6,-0.55),-0.7,0,0); g.add(tail);
  for(const s of[-1,1])for(const f of[-1,1])g.add(at(cyl(0.06,0.06,0.2,'#FFFFFF',6,{ol:false}),0.14*s,0.1,0.25*f));
  g.userData.tail=tail; return g;
}
function duckMesh(big){
  const s=big?1:0.55, g=new THREE.Group();
  g.add(scl(at(sph(0.35*s,big?'#FFFFFF':'#FFE14D',10,8),0,0.25*s,0),1,0.8,1.3));
  g.add(at(sph(0.2*s,big?'#FFFFFF':'#FFE14D',8,6),0,0.6*s,0.3*s));
  g.add(scl(at(sph(0.1*s,'#FF9F1C',6,5,{ol:false}),0,0.56*s,0.5*s),1,0.5,1.5));
  return g;
}

