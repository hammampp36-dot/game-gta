import * as THREE from 'three';
const S=2,N=640,C=320,W=(N/2-3)*S,isTouch=matchMedia('(pointer:coarse)').matches,rnd=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),$=i=>document.getElementById(i);
const FOGN=isTouch?70:110,FOGF=isTouch?220:290,VD=FOGF+12;
// RNG ber-seed: pohon, desa, reruntuhan & peti SAMA untuk semua pemain mabar
const wr=(()=>{let a=20261121;return()=>{let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};})(),wrnd=(a,b)=>a+wr()*(b-a),pick=a=>a[Math.floor(wr()*a.length)];
const hsh=(i,j)=>{let h=Math.imul(i|0,374761393)^Math.imul(j|0,668265263)^1337;h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;};
const vn=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz),a=hsh(i,j),b=hsh(i+1,j),c=hsh(i,j+1),d=hsh(i+1,j+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
const fbm=(x,z,o=4)=>{let a=1,f=1,s=0,n=0;for(let k=0;k<o;k++){s+=vn(x*f+k*17.3,z*f-k*9.1)*a;n+=a;a*=.5;f*=2;}return s/n;};
// jarak ke jalan terdekat (sel): jalan silang di tengah + jalan lingkar
const rdist=(i,j)=>{const a=Math.abs(i-C),b=Math.abs(j-C);let d=Math.abs(Math.hypot(a,b)-N*.27);if(b<N*.4)d=Math.min(d,a);if(a<N*.4)d=Math.min(d,b);return d;};
const road=(i,j)=>rdist(i,j)<=1.2;
// biome: 0 hutan/padang, 1 gurun, 2 salju
const biome=(i,j)=>{if(Math.hypot(i-C,j-C)<N*.1)return 0;const v=fbm(i*.011+5,j*.011+5,2);return v<.4?1:v>.6?2:0;};
const MP=[[-.3,-.3],[.3,-.3],[.3,.3],[-.3,.3]]; // 4 puncak gunung = lokasi altar elemen
function genH(i,j){
  const r=Math.hypot(i-C,j-C)/N;
  let h=4.6+(fbm(i*.018,j*.018,4)-.5)*16+(fbm(i*.07+9,j*.07,2)-.5)*3;
  const rim=Math.max(0,(r-.40)/.13);h+=rim*rim*10*(.55+fbm(i*.03+3,j*.03,3));   // pegunungan di tepi dunia
  for(const[px,pz]of MP){const d=Math.hypot(i-C-px*N,j-C-pz*N)/30;if(d<1)h+=Math.pow(1-d,1.6)*8;}  // puncak altar
  if(r>.07){
    const lk=fbm(i*.02+200,j*.02+90,3);if(lk<.36)h-=(.36-lk)*60;                      // danau
    const rv=Math.abs(fbm(i*.014+400,j*.014+10,2)-.5);if(rv<.022)h-=(.022-rv)*220;   // sungai
  }
  const d=rdist(i,j);if(d>1.2&&d<5)h=2+(h-2)*(d-1.2)/3.8;                            // tanjakan landai di tepi jalan
  return clamp(Math.round(h),0,13);
}
const H=[],BM=[];
for(let i=0;i<N;i++){H[i]=[];BM[i]=[];for(let j=0;j<N;j++){let h=genH(i,j);if(road(i,j))h=2;H[i][j]=h;BM[i][j]=biome(i,j);}}
const gi=v=>clamp(Math.round(v/S+C),0,N-1);
const gy=(x,z)=>H[gi(x)][gi(z)]*S+S/2;

// ---------- renderer / scene ----------
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.25:1.75));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color();scene.fog=new THREE.Fog(0,FOGN,FOGF);
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.5,500);
const hemi=new THREE.HemisphereLight(0xbcd8ff,0x553322,1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2);sun.castShadow=true;sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
const sc=sun.shadow.camera;sc.left=sc.bottom=-70;sc.right=sc.top=70;sc.far=400;sun.shadow.bias=-.0006;
scene.add(sun,sun.target);

// ---------- terrain (instanced, dipecah per chunk supaya dunia luas tetap ringan) ----------
const topColor=(h,b)=>h<=1?(b===2?0x4f9fd0:0x2f7fb8):h===2?(b===1?0xe3cf8a:0xd9c27a):h<=6?[0x4f9a3a,0xd8b868,0xe6edf4][b]:h<=8?[0x3b7a34,0xc29a55,0xd5dde6][b]:h<=10?[0x8b8b92,0xa9744f,0x9aa3ad][b]:0xf0f0f5;
const m4=new THREE.Matrix4(),col=new THREE.Color(),CS=16,CH=[],terrGeo=new THREE.BoxGeometry(S,S,S),terrMat=new THREE.MeshStandardMaterial();
for(let ci=0;ci<N/CS;ci++)for(let cj=0;cj<N/CS;cj++){
  const cells=[];
  for(let i=ci*CS;i<ci*CS+CS;i++)for(let j=cj*CS;j<cj*CS+CS;j++){
    const h=H[i][j],nb=[[i-1,j],[i+1,j],[i,j-1],[i,j+1]].map(([a,b])=>H[a]?.[b]??h),lo=Math.min(h,...nb);
    for(let y=lo;y<=h;y++)cells.push([i,j,y,y===h]);
  }
  const mesh=new THREE.InstancedMesh(terrGeo,terrMat,cells.length);
  cells.forEach(([i,j,y,top],k)=>{
    m4.setPosition((i-C)*S,y*S,(j-C)*S);mesh.setMatrixAt(k,m4);
    const h=H[i][j],b=BM[i][j];let c;
    if(!top)c=h>8?0x6e6e76:b===1?0xb68a52:0x6b4a2f;
    else if(road(i,j)){c=0x3a3d45;if((i===C&&j%4<2)||(j===C&&i%4<2))c=0xe8c93a;}
    else c=topColor(h,b);
    col.setHex(c).multiplyScalar(.9+wr()*.14);mesh.setColorAt(k,col);
  });
  mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);
  CH.push({m:mesh,x:((ci+.5)*CS-C)*S,z:((cj+.5)*CS-C)*S});
}
// culling manual per chunk (jarak + arah kamera) -> dunia 4x lebih luas tapi tetap ringan
const _fw=new THREE.Vector3();
function chunkVis(){
  camera.getWorldDirection(_fw);
  const fl=Math.hypot(_fw.x,_fw.z),fx=_fw.x/(fl||1),fz=_fw.z/(fl||1),px=camera.position.x,pz=camera.position.z,ang=fl>.25&&cam.mode<2;
  for(const c of CH){const dx=c.x-px,dz=c.z-pz,d=Math.hypot(dx,dz);let v=d<VD+26;if(v&&ang&&d>75)v=(dx*fx+dz*fz)/d>.4-26/d;c.m.visible=v;c.m.castShadow=v&&d<125;}
  for(const q of DM)q.o.visible=Math.hypot(q.x-px,q.z-pz)<VD;
}

// ----- vegetasi, batu & bunga (sesuai biome) -----
function inst(geo,mat,arr,fx,shadow=!isTouch){
  const m=new THREE.InstancedMesh(geo,mat,Math.max(arr.length,1)),o=new THREE.Object3D();m.count=arr.length;
  arr.forEach((a,k)=>{o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);fx(o,a,k,m);o.updateMatrix();m.setMatrixAt(k,o.matrix);});
  m.castShadow=shadow;m.frustumCulled=false;scene.add(m);return m;
}
const TR={pine:[],oak:[],snow:[],cact:[],rock:[],flw:[]};
for(let n=0;n<64000&&TR.pine.length+TR.oak.length+TR.snow.length+TR.cact.length<9600;n++){
  const i=Math.floor(wrnd(2,N-2)),j=Math.floor(wrnd(2,N-2)),h=H[i][j],b=BM[i][j];
  if(h<3||h>9||rdist(i,j)<4)continue;
  const dens=fbm(i*.045+300,j*.045+7,2);if(wr()>clamp((dens-.4)*3.2,.05,.95))continue;
  const x=(i-C)*S+wrnd(-.9,.9),z=(j-C)*S+wrnd(-.9,.9),y=gy(x,z),s=wrnd(.8,1.6);
  if(b===1){if(wr()<.65)TR.cact.push([x,y,z,s]);}
  else if(b===2)TR.snow.push([x,y,z,s]);
  else(wr()<.55||h>=7?TR.pine:TR.oak).push([x,y,z,s]);
}
for(let n=0;n<12000&&TR.rock.length<3000;n++){
  const i=Math.floor(wrnd(2,N-2)),j=Math.floor(wrnd(2,N-2)),h=H[i][j];
  if(h<2||rdist(i,j)<3||wr()>(h>=7?.6:.12))continue;
  TR.rock.push([(i-C)*S+wrnd(-.9,.9),gy((i-C)*S,(j-C)*S),(j-C)*S+wrnd(-.9,.9),wrnd(.6,2.2),BM[i][j]===1?0xa9744f:0x80808a]);
}
for(let n=0;n<36000&&TR.flw.length<7000;n++){
  const i=Math.floor(wrnd(2,N-2)),j=Math.floor(wrnd(2,N-2)),h=H[i][j];
  if(BM[i][j]!==0||h<3||h>6||rdist(i,j)<3||fbm(i*.045+300,j*.045+7,2)>.47)continue;
  TR.flw.push([(i-C)*S+wrnd(-.9,.9),gy((i-C)*S,(j-C)*S),(j-C)*S+wrnd(-.9,.9),pick([0xff6fae,0xffe14a,0xffffff,0xb98bff,0xff4d4d,0x6fd0ff])]);
}
{
  const brown=new THREE.MeshStandardMaterial({color:0x5a3b22}),W3=new THREE.MeshStandardMaterial({color:0xffffff}),pineG=new THREE.ConeGeometry(1.8,4,6);
  const trunks=[...TR.pine,...TR.snow];
  inst(new THREE.BoxGeometry(.6,2,.6),brown,trunks,(o,a)=>{o.position.set(a[0],a[1]+a[3],a[2]);o.scale.setScalar(a[3]);});
  inst(pineG,W3,TR.pine,(o,a,k,m)=>{o.position.set(a[0],a[1]+4*a[3],a[2]);o.scale.setScalar(a[3]);m.setColorAt(k,col.setHex(0x2f6b32).multiplyScalar(.8+wr()*.4));});
  inst(pineG,W3,TR.snow,(o,a,k,m)=>{o.position.set(a[0],a[1]+4*a[3],a[2]);o.scale.setScalar(a[3]);m.setColorAt(k,col.setHex(0xdce8f2).multiplyScalar(.85+wr()*.15));});
  inst(new THREE.BoxGeometry(.7,2.4,.7),brown,TR.oak,(o,a)=>{o.position.set(a[0],a[1]+1.2*a[3],a[2]);o.scale.setScalar(a[3]);});
  inst(new THREE.IcosahedronGeometry(2.1,0),W3,TR.oak,(o,a,k,m)=>{o.position.set(a[0],a[1]+3.9*a[3],a[2]);o.scale.setScalar(a[3]);o.rotation.y=wr()*6;m.setColorAt(k,col.setHex(wr()<.18?pick([0xe0892b,0xc9532a,0xe3b93a]):0x3f8f3a).multiplyScalar(.8+wr()*.35));});
  const cm=new THREE.MeshStandardMaterial({color:0x3f8f4a});
  inst(new THREE.BoxGeometry(.9,3.6,.9),cm,TR.cact,(o,a)=>{o.position.set(a[0],a[1]+1.8*a[3],a[2]);o.scale.setScalar(a[3]);});
  inst(new THREE.BoxGeometry(1.3,.45,.45),cm,TR.cact,(o,a)=>{o.position.set(a[0]+.8*a[3],a[1]+2*a[3],a[2]);o.scale.setScalar(a[3]);});
  inst(new THREE.BoxGeometry(.45,1.2,.45),cm,TR.cact,(o,a)=>{o.position.set(a[0]+1.4*a[3],a[1]+2.6*a[3],a[2]);o.scale.setScalar(a[3]);});
  inst(new THREE.DodecahedronGeometry(1,0),W3,TR.rock,(o,a,k,m)=>{o.position.set(a[0],a[1]+.25*a[3],a[2]);o.scale.set(a[3]*1.2,a[3]*.8,a[3]);o.rotation.set(wr()*3,wr()*6,0);m.setColorAt(k,col.setHex(a[4]).multiplyScalar(.8+wr()*.3));});
  inst(new THREE.BoxGeometry(.28,.6,.28),W3,TR.flw,(o,a,k,m)=>{o.position.set(a[0],a[1]+.3,a[2]);m.setColorAt(k,col.setHex(a[3]));},false);
}

// city blocks with neon roofs
const obs=[],bMats=[],neon=[0xff2fa0,0x2ff0ff,0xffe23a,0x9b5cff],towns=[],ruins=[],OG=new Map(),OC=16,DM=[],dm=(o,x,z)=>{DM.push({o,x,z});return o;};
function addObs(o){obs.push(o);for(let a=Math.floor((o.x-o.hw)/OC);a<=Math.floor((o.x+o.hw)/OC);a++)for(let b=Math.floor((o.z-o.hd)/OC);b<=Math.floor((o.z+o.hd)/OC);b++){const k=a*4096+b;let l=OG.get(k);if(!l)OG.set(k,l=[]);l.push(o);}}
for(let n=0,k=0;n<1200&&k<70;n++){
  const i=Math.floor(C+wrnd(-46,46)),j=Math.floor(C+wrnd(-46,46)),h=H[i][j];
  if(Math.abs(i-C)<4||Math.abs(j-C)<4||h<2||h>4||road(i,j))continue;
  const x=(i-C)*S,z=(j-C)*S,w=wrnd(5,8),d=wrnd(5,8);
  if(obs.some(o=>Math.abs(o.x-x)<o.hw+w/2+1&&Math.abs(o.z-z)<o.hd+d/2+1))continue;
  const hg=wrnd(6,18),g=gy(x,z);
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(wr(),.3,.55),emissive:0xffb050,emissiveIntensity:0});
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,hg+6,d),mat);
  b.position.set(x,g+hg/2-3,z);b.castShadow=b.receiveShadow=true;scene.add(b);
  const r=new THREE.Mesh(new THREE.BoxGeometry(w+.4,.4,d+.4),new THREE.MeshBasicMaterial({color:neon[k%4]}));
  r.position.set(x,g+hg+.2,z);scene.add(r);dm(b,x,z);dm(r,x,z);
  bMats.push(mat);addObs({x,z,hw:w/2,hd:d/2});k++;
}
// ----- destructible props -----
const PROPS=[]; // {type, mesh, hp, x, z}
// scatter crates and barrels (+ desa & reruntuhan untuk dijelajahi)
const crateMat=new THREE.MeshStandardMaterial({color:0x8b4513}),barrelMat=new THREE.MeshStandardMaterial({color:0xff0000}),crateG=new THREE.BoxGeometry(2,2,2),barrelG=new THREE.CylinderGeometry(.8,.8,2,8);
function addProp(type,x,z){
  const mesh=new THREE.Mesh(type==='crate'?crateG:barrelG,type==='crate'?crateMat:barrelMat);
  mesh.position.set(x,gy(x,z)+1,z);mesh.castShadow=true;scene.add(mesh);dm(mesh,x,z);
  PROPS.push({type,mesh,hp:type==='crate'?2:5,x,z});
}
for(let i=0;i<1000;i++){const x=wrnd(-W,W),z=wrnd(-W,W),a=gi(x),b=gi(z);if(road(a,b)||H[a][b]<2)continue;addProp(wr()<.5?'crate':'barrel',x,z);}
// --- desa ---
function house(x,z,w,d,hg,wallC,roofC){
  const g=gy(x,z),mat=new THREE.MeshStandardMaterial({color:wallC,emissive:0xffb050,emissiveIntensity:0});
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,hg+6,d),mat);b.position.set(x,g+hg/2-3,z);b.castShadow=b.receiveShadow=true;scene.add(b);
  const rh=hg*.5+1.2,r=new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*.78,rh,4),new THREE.MeshStandardMaterial({color:roofC}));
  r.rotation.y=Math.PI/4;r.position.set(x,g+hg+rh/2,z);r.castShadow=true;scene.add(r);
  dm(b,x,z);dm(r,x,z);bMats.push(mat);addObs({x,z,hw:w/2,hd:d/2});
}
const TN=['Desa Hijau','Desa Senja','Dusun Pinus','Pos Pesisir','Desa Gunung','Dusun Kabut','Desa Fajar','Kampung Batu','Kampung Embun','Desa Cahaya','Dusun Sunyi','Pos Perbatasan','Desa Karang','Dusun Salju','Kampung Pasir','Desa Telaga','Dusun Rimba','Pos Utara','Desa Lembah','Kampung Angin','Dusun Senja Barat','Desa Batu Api','Pos Selatan','Kampung Terakhir'];
const HWC=[0xe8d5b0,0xc9a37a,0xb7c4d1,0xd9b8b8,0xa9c9a4],HRC=[0xa33b2c,0x6b3b2a,0x35507a,0x4a6b3a];
[[0,-78],[82,-44],[-88,-34],[58,84],[-64,78],[-20,-130],[118,40],[-118,-76],[0,178],[150,120],[-160,100],[210,-20],[-220,-30],[60,-200],[-90,-190],[180,-150],[-190,170],[120,230],[-40,250],[250,90],[-250,-100],[130,-260],[-140,-250],[230,200]].forEach(([ci,cj],k)=>{
  const sp=findSpot(ci*S,cj*S,3,5);if(!sp)return;let hs=0;
  for(let n=0;n<140&&hs<8;n++){
    const x=sp[0]+wrnd(-32,32),z=sp[1]+wrnd(-32,32),i=gi(x),j=gi(z),h=H[i][j],w=wrnd(4.5,7),d=wrnd(4.5,7);
    if(h<3||h>6||rdist(i,j)<6||Math.hypot(x-sp[0],z-sp[1])<10)continue;
    if(obs.some(o=>Math.abs(o.x-x)<o.hw+w/2+2.5&&Math.abs(o.z-z)<o.hd+d/2+2.5))continue;
    house(x,z,w,d,wrnd(4,8),pick(HWC),pick(HRC));hs++;
  }
  if(hs>=3){towns.push({x:sp[0],z:sp[1],n:TN[k]});for(let c=0;c<4;c++){const an=wrnd(0,6.28),dd=wrnd(4,7);addProp(c<3?'crate':'barrel',sp[0]+Math.cos(an)*dd,sp[1]+Math.sin(an)*dd);}}
});
// --- reruntuhan kuno: harta karun (peti) + lebih banyak zombie ---
function buildRuin(x,z){
  const sm=new THREE.MeshStandardMaterial({color:0x8d8a84,roughness:1});
  for(let a=0;a<8;a++){
    const an=a/8*6.283,px=x+Math.cos(an)*8,pz=z+Math.sin(an)*8,g=gy(px,pz),hg=wrnd(3,9)*(a%3?1:.55);
    const p=new THREE.Mesh(new THREE.BoxGeometry(1.5,hg+4,1.5),sm);p.position.set(px,g+hg/2-2,pz);p.rotation.y=wrnd(0,3);p.castShadow=true;scene.add(p);dm(p,px,pz);addObs({x:px,z:pz,hw:.9,hd:.9});
  }
  const g=gy(x,z),al=new THREE.Mesh(new THREE.BoxGeometry(3,1.4,3),sm);al.position.set(x,g+.7,z);al.castShadow=true;scene.add(al);dm(al,x,z);addObs({x,z,hw:1.6,hd:1.6});
  const gm=new THREE.Mesh(new THREE.OctahedronGeometry(.7),new THREE.MeshBasicMaterial({color:0x22d3ee}));gm.position.set(x,g+2.5,z);scene.add(gm);dm(gm,x,z);
  for(let c=0;c<5;c++){const an=wrnd(0,6.28),dd=wrnd(3.8,6.5);addProp(c<4?'crate':'barrel',x+Math.cos(an)*dd,z+Math.sin(an)*dd);}
}
for(let n=0,k=0;n<5000&&k<30;n++){
  const x=wrnd(-W+30,W-30),z=wrnd(-W+30,W-30),i=gi(x),j=gi(z),h=H[i][j];
  if(h<3||h>7||rdist(i,j)<8||Math.hypot(x,z)<70||ruins.some(r=>Math.hypot(r.x-x,r.z-z)<130)||towns.some(t=>Math.hypot(t.x-x,t.z-z)<45))continue;
  buildRuin(x,z);ruins.push({x,z});k++;
}
// pickups array
const PICKUPS=[]; // {mesh, type, x, z}
function spawnPickup(x,z){
  const types=['heal','ammo','stamina'];
  const type=types[Math.floor(rnd(0,types.length))];
  const color=type==='heal'?0x00ff00:type==='ammo'?0xffff00:0x00ffff;
  const orb=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,8),new THREE.MeshBasicMaterial({color}));
  orb.position.set(x,gy(x,z)+1,z);
  scene.add(orb);
  PICKUPS.push({mesh:orb, type, x, z});
}
function hitProp(p,n){p.hp-=n;if(p.hp<=0)destroyProp(p);}
function destroyProp(p){
  scene.remove(p.mesh);
  const idx=PROPS.indexOf(p);
  if(idx>-1) PROPS.splice(idx,1);
  if(p.type==='crate'){
    // drop a pickup
    spawnPickup(p.x,p.z);
  }else if(p.type==='barrel'){
    // explosion effect
    ring(p.x,p.z,0xff5500,5);sfx('boom');cam.shake=Math.max(cam.shake,.3);
    // damage nearby enemies
    inR(5,e=>{dmg(e,4);});if(Math.hypot(p.x-P.x,p.z-P.z)<5)hurt(15);
  }
}

const blocked=(x,z,r)=>{for(let a=Math.floor((x-r)/OC);a<=Math.floor((x+r)/OC);a++)for(let b=Math.floor((z-r)/OC);b<=Math.floor((z+r)/OC);b++){const l=OG.get(a*4096+b);if(l)for(const o of l)if(Math.abs(x-o.x)<o.hw+r&&Math.abs(z-o.z)<o.hd+r)return true;}return false;};
function mv(o,dx,dz,r){
  const nx=o.x+dx;if(!blocked(nx,o.z,r)&&gy(nx,o.z)-gy(o.x,o.z)<=S*2.1)o.x=nx;
  const nz=o.z+dz;if(!blocked(o.x,nz,r)&&gy(o.x,nz)-gy(o.x,o.z)<=S*2.1)o.z=nz;
  o.x=clamp(o.x,-W,W);o.z=clamp(o.z,-W,W);
}

// ---------- day / night ----------
const K=[{sky:0xf2b79a,sun:0xffd2a0,si:1.5,hi:.7,fog:0xe8b9a6},{sky:0x7ec8f2,sun:0xffffff,si:2.4,hi:1.1,fog:0xa9d8f0},
 {sky:0xff7a3d,sun:0xff8a3a,si:2.2,hi:.6,fog:0xf08a5a},{sky:0x0b1030,sun:0x4466aa,si:.5,hi:.35,fog:0x0b1030}];
const tA=new THREE.Color(),tB=new THREE.Color();
let T=.45,night=0;
function sky(){
  const f=(((T%1)+1)%1)*4,a=Math.floor(f)%4,b=(a+1)%4;let m=f-Math.floor(f);m=m*m*(3-2*m);
  const A=K[a],B=K[b];
  scene.background.copy(tA.set(A.sky).lerp(tB.set(B.sky),m));
  scene.fog.color.copy(tA.set(A.fog).lerp(tB.set(B.fog),m));
  sun.color.copy(tA.set(A.sun).lerp(tB.set(B.sun),m));
  sun.intensity=A.si+(B.si-A.si)*m;hemi.intensity=A.hi+(B.hi-A.hi)*m;
  night=a===3?1-m:b===3?m:0;
  const ang=T*Math.PI*2,ey=Math.max(.25+.75*Math.sin(ang),.18);
  sun.position.set(P.x+Math.cos(ang)*110,ey*130,P.z+30);sun.target.position.set(P.x,0,P.z);
  bMats.forEach(x=>x.emissiveIntensity=night*.6);
  $('tm').textContent=['Pagi','Siang','Sunset','Malam'][Math.round(f)%4]+(wx.v>.3?(wx.target===2?' ⛈':' 🌧'):'');
  const gr=tA.set(0x39424f);scene.background.lerp(gr,wx.v*.55);scene.fog.color.lerp(gr,wx.v*.6);
  hemi.intensity=hemi.intensity*(1-.3*wx.v)+wx.flash*2.5;sun.intensity*=1-.5*wx.v;scene.fog.near=FOGN-wx.v*55;scene.fog.far=FOGF-wx.v*110;
}

// ---------- models ----------
function human(c,sc=1){
  const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:c}),sk=new THREE.MeshStandardMaterial({color:0xf1c8a0});
  const add=(w,h,d,m,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  add(1,1.2,.6,mat,0,2,0);add(.7,.7,.7,sk,0,3.1,0);
  const legL=add(.4,1.2,.4,mat,-.25,.6,0),legR=add(.4,1.2,.4,mat,.25,.6,0);
  const armL=add(.3,1,.3,mat,-.7,2.1,0),armR=add(.3,1,.3,mat,.7,2.1,0);
  g.scale.setScalar(sc);g.userData={legL,legR,armL,armR,mat};return g;
}
function animal(){
  const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:0xb5835a});
  const add=(w,h,d,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  add(.8,.8,1.6,0,1.1,0);add(.5,.5,.6,0,1.7,1);
  const legL=add(.2,.8,.2,-.25,.4,.5),legR=add(.2,.8,.2,.25,.4,-.5);
  g.userData={legL,legR,mat:m};return g;
}

// ---------- player ----------
const EL=[{n:'Api',c:0xff5a1f},{n:'Air',c:0x2aa8ff},{n:'Angin',c:0xbff5e0},{n:'Batu',c:0xb08a52}];
// load persistence
let savedData={};
try{savedData=JSON.parse(localStorage.getItem('voxelSave')||'{}')}catch(e){}
const P={x:0,z:rnd(-20,20),y:0,hp:100,st:150,w:0,el:0,sig:0,cd:0,atk:0,sw:0,mag:12,res:48,rl:0,shield:0,kx:0,kz:0,ry:0,rest:0,dead:false,fl:0,kills:savedData.kills||0,level:savedData.level||1,upgrades:savedData.upgrades||[],vx:0,vz:0,vy:0,glide:false,coins:savedData.coins||0,pw:savedData.pw||[1,1,1,1],shr:savedData.shr||[],car:null};
P.y=gy(P.x,P.z);
function saveProgress(){
  const data={kills:P.kills,level:P.level,upgrades:P.upgrades,coins:P.coins,pw:P.pw,shr:P.shr,squad:allies.length};
  try{localStorage.setItem('voxelSave',JSON.stringify(data));}catch(e){}
}
const pm=human(0xffd23a);scene.add(pm);
const swordP=new THREE.Group(),gunP=new THREE.Group();
const sw=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,2),new THREE.MeshStandardMaterial({color:0xdde4ee,metalness:.8,roughness:.3}));sw.position.z=1.1;swordP.add(sw);
const gn=new THREE.Mesh(new THREE.BoxGeometry(.25,.3,1),new THREE.MeshStandardMaterial({color:0x222222}));gn.position.z=.7;gunP.add(gn);
swordP.position.set(.8,2.1,.4);gunP.position.set(.7,2.2,.4);pm.add(swordP,gunP);
const shieldM=new THREE.Mesh(new THREE.SphereGeometry(2.4,16,12),new THREE.MeshBasicMaterial({color:0xb08a52,transparent:true,opacity:.3}));shieldM.visible=false;scene.add(shieldM);

// ---------- input / UI ----------
const keys={},mouse={x:0,y:0,down:false},joy={x:0,y:0},cam={mode:0,yaw:0,pitch:.1,ads:false,bob:0,shake:0,kick:0};let started=false;
const setEl=i=>{P.el=i;pm.userData.mat.color.setHex(EL[i].c);};
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  keys[e.code]=1;if(!started)return;
  if(e.code==='Digit1')P.w=0;if(e.code==='Digit2')P.w=1;
  if(e.code==='KeyQ')setEl((P.el+1)%4);
  if(e.code==='KeyE')skill();
  if(e.code==='KeyR')reload();if(e.code==='KeyT')T+=.25;
  if(e.code==='KeyV')cycleCam();if(e.code==='KeyC')toggleCar();if(e.code==='KeyF')toggleSquad();if(e.code==='KeyG')recruit();
  if(e.code==='KeyY'){wx.target=(wx.target+1)%3;wx.timer=90;toast(['Cuaca cerah','Hujan','Badai petir'][wx.target]);}
  if(e.code==='Enter'&&P.dead)respawn();
  if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault();
});
addEventListener('keyup',e=>keys[e.code]=0);
addEventListener('mousemove',e=>{mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight*2-1);
  if(started&&cam.mode<2&&document.pointerLockElement===renderer.domElement){cam.yaw-=e.movementX*.0025;cam.pitch=clamp(cam.pitch-e.movementY*.0022,-.6,.9);}});
addEventListener('mousedown',e=>{if(!started||isTouch||e.target.closest('button,input,#roomBadge'))return;
  if(cam.mode<2&&document.pointerLockElement!==renderer.domElement){renderer.domElement.requestPointerLock?.();return;}
  if(e.button===2)cam.ads=true;else mouse.down=true;});
addEventListener('mouseup',e=>{if(e.button===2)cam.ads=false;else mouse.down=false;});
document.querySelectorAll('.el-btn[data-e]').forEach(b=>b.onclick=()=>{P.sig=+b.dataset.e;setEl(P.sig);$('start').style.display='none';started=true;});
$('btnHost').onclick=()=>{const c=($('roomInput').value.trim()||Math.random().toString(36).slice(2,7)).toUpperCase();$('roomInput').value=c;setRoom(c,'Room dibuat:');};
$('btnJoin').onclick=()=>{const c=$('roomInput').value.trim().toUpperCase();if(!c){$('mabarStatus').textContent='Isi kode room dulu';return;}setRoom(c,'Bergabung ke room:');};
$('roomBadge').onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(room);};
$('btnRespawn').onclick=()=>respawn();
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});

// ---------- enemies, bullets, fx ----------
let E=[];const B=[],FX=[],bulletG=new THREE.SphereGeometry(.28,6,6),bulletM=new THREE.MeshBasicMaterial({color:0xffe066});
// ---------- zombie brutal: tipe, darah, mayat ----------
const ZC={base:30,night:60,perLevel:1.5,hordeEvery:[60,100],hordeSize:18,perTick:3}; // <- atur tingkat kebrutalan di sini

// NPC settings (user‑adjustable)
const NPC_SETTINGS = {
  maxTotal: 60,
  types: {
    zombie: {name:'Normal Zombie', count:30, weapon:'sword'},
    runner: {name:'Runner', count:10, weapon:'sword'},
    archer: {name:'Skeleton Bow', count:10, weapon:'bow'},
    boss:   {name:'Boss', count:1, weapon:'magic'}
  }
};

// Original enemy type table used by the game logic
const ZT = {
  z:{hp:5,sp:[4.6,6.4],r:.9,sc:1,col:0x5f8a45,dmg:12,cd:1},
  r:{hp:3,sp:[10,13],r:.8,sc:.95,col:0xa9b83a,dmg:9,cd:.65},
  k:{hp:22,sp:[3.8,5],r:1.5,sc:1.7,col:0x4b5d3a,dmg:30,cd:1.6},
  b:{hp:70,sp:[4.4,4.4],r:2.5,sc:2.6,col:0x7a2fd0,dmg:35,cd:1.8}
};
const gashM=new THREE.MeshBasicMaterial({color:0x6a0a0a}),bloodG=new THREE.BoxGeometry(.22,.22,.22),bloodM=new THREE.MeshBasicMaterial({color:0x8a0a0a}),dustM=new THREE.MeshBasicMaterial({color:0xcbb88a}),
  decG=new THREE.CircleGeometry(1,10),decM=new THREE.MeshBasicMaterial({color:0x5a0707,transparent:true,opacity:.8,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),BP=[],CORPSES=[],DEC=[];
function bloodBurst(x,y,z,n,mat=bloodM,sp=1){
  const cap=isTouch?80:170;
  for(let i=0;i<n&&BP.length<cap;i++){
    const m=new THREE.Mesh(bloodG,mat);m.position.set(x,y,z);m.scale.setScalar(rnd(.5,1.3));scene.add(m);
    BP.push({m,vx:rnd(-6,6)*sp,vy:rnd(2,9)*sp,vz:rnd(-6,6)*sp,l:rnd(.5,1.1)});
  }
}
function decal(x,z,s){
  const m=new THREE.Mesh(decG,decM);m.rotation.x=-Math.PI/2;m.position.set(x,gy(x,z)+.07,z);m.scale.setScalar(s*rnd(.7,1.3));scene.add(m);
  DEC.push(m);if(DEC.length>(isTouch?20:45))scene.remove(DEC.shift());
}
function corpse(e){
  bloodBurst(e.x,e.m.position.y+2*(e.sc||1),e.z,e.t==='w'?8:e.t==='b'?40:e.t==='k'?30:22);
  decal(e.x,e.z,e.t==='b'?5:e.t==='k'?3:2.2);
  e.mats.forEach(m=>m.emissive.setHex(0));
  if(e.t==='w'){scene.remove(e.m);return;}
  e.m.children.filter(o=>o.material===eyeMat).forEach(o=>e.m.remove(o));
  CORPSES.push({m:e.m,t:0,dir:Math.random()<.5?1:-1,y0:e.m.position.y});
  if(CORPSES.length>40)scene.remove(CORPSES.shift().m);
}
function mkEnemy(t,x,z){
  const c=ZT[t],m=t==='w'?animal():human(c.col,c.sc);
  m.position.set(x,gy(x,z),z);scene.add(m);
  const mats=[...new Set((m.children.map(o=>o.material)))];
  const lv=1+Math.min(.9,P.level*.03),hp=t==='w'?2:c.hp*lv;
  E.push({m,t,x,z,hp,max:hp,sp:t==='w'?3:rnd(c.sp[0],c.sp[1]),r:t==='w'?.8:c.r,sc:t==='w'?1:c.sc,dmg:t==='w'?0:c.dmg,acd:t==='w'?1:c.cd,slow:0,burn:0,kx:0,kz:0,cd:0,ph:rnd(0,9),tx:x,tz:z,alert:0,fl:0,mats,gt:rnd(.5,4)});
  if(t!=='w'){
    eyes(m);
    const g=new THREE.Mesh(new THREE.BoxGeometry(.5,.45,.05),gashM);g.position.set(rnd(-.25,.25),2+rnd(-.3,.3),.33);m.add(g); // luka berdarah di badan
    const u=m.userData;u.armL.rotation.x=u.armR.rotation.x=-1.4; // tangan terjulur ala zombie
  }
}

// ---------- tembakan 3D: peluru ikut arah bidikan (termasuk ke bawah/atas), bukan cuma lurus datar ----------
const _cd=new THREE.Vector3();
const eh=e=>e.t==='w'?2.4:3.8*(e.sc||1);
function hitE(e,x,y,z,pad){const by=e.m.position.y;return Math.hypot(e.x-x,e.z-z)<e.r+pad&&y>by-.4&&y<by+eh(e);}
function aimPoint(o,d){ // titik yang dilihat crosshair: sinar kamera sampai kena tanah / musuh / peti
  let x=o.x+d.x*2,y=o.y+d.y*2,z=o.z+d.z*2;
  for(let s=2;s<140;s+=1.2){
    if(gy(x,z)>y)return{x,y,z};
    for(const e of E)if(!e.dead&&hitE(e,x,y,z,.3))return{x,y,z};
    for(const p of PROPS)if(Math.abs(p.x-x)<1.3&&Math.abs(p.z-z)<1.3&&Math.abs(y-gy(p.x,p.z)-1)<1.6)return{x,y,z};
    x+=d.x*1.2;y+=d.y*1.2;z+=d.z*1.2;
  }
  return{x:o.x+d.x*140,y:o.y+d.y*140,z:o.z+d.z*140};
}
function shotDir(){
  let ox=P.x+aim.x*1.2,oy=P.y+2.3,oz=P.z+aim.z*1.2,dx=aim.x,dy=0,dz=aim.z;
  if(cam.mode<2){
    camera.getWorldDirection(_cd);const cp=camera.position;
    if(cam.mode===1){ox=cp.x+_cd.x*1.2;oy=cp.y+_cd.y*1.2-.2;oz=cp.z+_cd.z*1.2;}
    let T=aimPoint(cp,_cd);
    if(isTouch){const hl=Math.hypot(_cd.x,_cd.z)||1,n=nearestE(30,{x:_cd.x/hl,z:_cd.z/hl});if(n)T={x:n.x,y:n.m.position.y+1.9*(n.sc||1),z:n.z};}
    const vx=T.x-ox,vy=T.y-oy,vz=T.z-oz,l=Math.hypot(vx,vy,vz);
    if(l>2.5){dx=vx/l;dy=vy/l;dz=vz/l;}else{dx=_cd.x;dy=_cd.y;dz=_cd.z;}
  }else{ // kamera atas: arah mouse tetap datar, tapi dimiringkan ke musuh di garis bidik (naik/turun tebing)
    const n=nearestE(70,aim);
    if(n){const hd=Math.hypot(n.x-ox,n.z-oz)||1,sl=clamp((n.m.position.y+1.9*(n.sc||1)-oy)/hd,-1.2,1.2),l=Math.hypot(1,sl);dx=aim.x/l;dz=aim.z/l;dy=sl/l;}
  }
  return{ox,oy,oz,x:dx,y:dy,z:dz};
}
function hitMark(h){
  cross.style.filter=h?'drop-shadow(0 0 4px #ff0) drop-shadow(0 0 8px #f00)':'drop-shadow(0 0 3px #f00)';
  clearTimeout(hitMark.t);hitMark.t=setTimeout(()=>{cross.style.filter='drop-shadow(0 0 2px #000)';},110);
}
function kill(e){
  if(e.dead)return;e.dead=true;corpse(e);sfx('kill');if(e.t!=='w')zsnd('die',e);
  P.coins+=e.t==='b'?5:e.t==='k'?2:1;P.kills+=e.t==='b'?10:e.t==='k'?4:1;P.level=1+Math.floor(P.kills/10);
  if(Math.random()<(e.t==='k'||e.t==='b'?.8:.3))spawnPickup(e.x,e.z);saveProgress();
  if(e.t==='w'){P.hp=Math.min(100,P.hp+10);P.res+=6;}else if(e.t==='b')P.hp=100;else if(Math.random()<.35)P.res+=4;
}
function dmg(e,n,kx=0,kz=0){sfx('hit');const kr=e.t==='b'?.1:e.t==='k'?.35:1;e.hp-=n;e.kx+=kx*kr;e.kz+=kz*kr;e.fl=.12;e.alert=8;if(e.t!=='w')bloodBurst(e.x,e.m.position.y+2.4*(e.sc||1),e.z,3);if(e.hp<=0)kill(e);}
function hurt(n){
  if(P.dead)return;
  if(P.shield>0){const a=Math.min(P.shield,n);P.shield-=a;n-=a;}
  if(n>0){P.hp-=n;P.fl=1;sfx('hurt');cam.shake=Math.max(cam.shake,.25);}
  if(P.hp<=0){P.dead=true;$('deadStats').textContent='Kamu tumbang. Kills: '+P.kills+' · Lv.'+P.level;$('dead').style.display='flex';P.car=null;document.exitPointerLock?.();}
}
function respawn(){P.hp=100;P.st=150;P.mag=12;P.res=48;P.kills=0;P.dead=false;P.car=null;P.vy=0;P.vx=P.vz=0;P.x=0;P.z=rnd(-20,20);E.forEach(e=>{if(e.t!=='w'){e.dead=true;scene.remove(e.m);}});$('dead').style.display='none';}
function ring(x,z,c,r){
  const m=new THREE.Mesh(new THREE.RingGeometry(.6,1,40),new THREE.MeshBasicMaterial({color:c,transparent:true,side:2,opacity:.9,depthTest:false}));
  m.rotation.x=-Math.PI/2;m.position.set(x,gy(x,z)+.3,z);scene.add(m);FX.push({m,r,t:0});
}
const noise2=(r)=>E.forEach(e=>{if(e.t!=='w'&&Math.hypot(e.x-P.x,e.z-P.z)<r)e.alert=8;});
const inR=(r,f)=>E.forEach(e=>{if(!e.dead&&Math.hypot(e.x-P.x,e.z-P.z)<r+e.r)f(e);});

// ---------- combat ----------
let aim={x:0,z:1};const rc=new THREE.Raycaster(),hitP=new THREE.Vector3();
function reload(){if(P.rl>0||P.mag>=12||P.res<=0)return;P.rl=1;}
function attack(){
  if(P.atk>0||P.rl>0)return;
  if(P.w===0){
    P.atk=.45;P.sw=.25;noise2(10);sfx('slash');PROPS.slice().forEach(p=>{if(Math.hypot(p.x-P.x,p.z-P.z)<4.5)hitProp(p,1);});
    inR(4.2,e=>{const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1;if((dx*aim.x+dz*aim.z)/l>.1)dmg(e,2,dx/l*14,dz/l*14);});
    remotes.forEach((r,id)=>{const dx=r.x-P.x,dz=r.z-P.z,l=Math.hypot(dx,dz);if(l<4.2&&(dx*aim.x+dz*aim.z)/l>.1)net({t:'h',to:id,dmg:8});});
  }else{
    if(P.mag<=0){reload();return;}
    P.mag--;P.atk=.16;noise2(60);sfx('shot');cam.kick+=.3;cam.pitch=Math.min(.9,cam.pitch+.012);cam.shake=Math.max(cam.shake,.05);
    const d=shotDir(),b=new THREE.Mesh(bulletG,bulletM);b.position.set(d.ox,d.oy,d.oz);scene.add(b);
    B.push({m:b,vx:d.x*70,vy:d.y*70,vz:d.z*70,life:1.8});net({t:'b',id:ID,u:Math.random(),x:d.ox,y:d.oy,z:d.oz,vx:d.x*70,vy:d.y*70,vz:d.z*70});
  }
}
function skill(){
  if(P.cd>0||P.dead)return;
  const sig=P.el===P.sig,pw=(sig?1.5:1)*P.pw[P.el]*(P.el===1?1+.4*wx.v:1),c=EL[P.el].c;P.cd=(sig?2.5:5)*(P.el===0&&wx.v>.5?1.6:1);
  const pvp=(r,d)=>remotes.forEach((rp,id)=>{if(Math.hypot(rp.x-P.x,rp.z-P.z)<r)net({t:'h',to:id,dmg:d});});
  const push=(e,k)=>{const dx=e.x-P.x,dz=e.z-P.z,l=Math.hypot(dx,dz)||1;e.kx+=dx/l*k;e.kz+=dz/l*k;};
  noise2(30);sfx('skill');cam.shake=.3;net({t:'k',id:ID,x:P.x,z:P.z,c,r:[9,11,7,6][P.el]});
  if(P.el===0){ring(P.x,P.z,c,9);inR(9,e=>{dmg(e,2*pw);e.burn=4*pw;});pvp(9,6*pw);}
  else if(P.el===1){ring(P.x,P.z,c,11);inR(11,e=>{dmg(e,.5);e.slow=4*pw;});P.hp=Math.min(100,P.hp+15*pw);allies.forEach(a=>a.hp=Math.min(a.max,a.hp+25*pw));pvp(11,3*pw);}
  else if(P.el===2){ring(P.x,P.z,c,7);P.kx=aim.x*70;P.kz=aim.z*70;inR(7,e=>{dmg(e,1);push(e,30*pw);});pvp(7,4*pw);}
  else{ring(P.x,P.z,c,6);P.shield=35*pw;inR(6,e=>{dmg(e,1.5*pw);push(e,20);});pvp(6,5*pw);}
}

// ---------- multiplayer (BroadcastChannel, antar tab; kode room = nama channel) ----------
const ID=Math.random().toString(36).slice(2,8),remotes=new Map();let ch=new BroadcastChannel('voxel-city-2'),room='SOLO',sendT=0;
function onMsg({data:d}){
  if(d.id===ID)return;
  if(d.t==='h'&&d.to===ID)hurt(d.dmg);
  else if(d.t==='b'){if(seen.has(d.u))return;seen.add(d.u);if(seen.size>300)seen.clear();const b=new THREE.Mesh(bulletG,bulletM);b.position.set(d.x,d.y,d.z);scene.add(b);B.push({m:b,vx:d.vx,vy:d.vy||0,vz:d.vz,life:1.8,vis:true});}
  else if(d.t==='k')ring(d.x,d.z,d.c,d.r);
  else if(d.t==='s'){
    let r=remotes.get(d.id);
    if(!r){const m=human(0x3aa0ff);scene.add(m);const mk=micSprite();m.add(mk);r={m,mk,x:d.x,z:d.z,tx:d.x,tz:d.z,try:0,last:0};remotes.set(d.id,r);}
    Object.assign(r,{tx:d.x,tz:d.z,try:d.ry,last:performance.now()});if(d.pid){r.pid=d.pid;voiceLink(d.pid);}
    r.m.userData.mat.color.setHex(EL[d.el].c);
  }
}
ch.onmessage=onMsg;
function setRoom(c,msg){
  room=c;ch.close();remotes.forEach(r=>scene.remove(r.m));remotes.clear();
  ch=new BroadcastChannel('voxel-city-2-'+c);ch.onmessage=onMsg;
  $('roomBadge').textContent='Room: '+c;$('mabarStatus').textContent=msg+' '+c+' (teman harus buka tab/jendela di browser yang sama)';
}

// ---------- spawning ----------
let hordeT=45;
function horde(){
  const an=rnd(0,6.28),n=isTouch?9:ZC.hordeSize;toast('🧟 GELOMBANG ZOMBIE DATANG!');
  for(let i=0;i<n;i++){const a2=an+rnd(-.5,.5),d=rnd(48,72);mkEnemy(Math.random()<.35?'r':'z',clamp(P.x+Math.cos(a2)*d,-W+2,W-2),clamp(P.z+Math.sin(a2)*d,-W+2,W-2));E[E.length-1].alert=14;}
  if(Math.random()<.5){mkEnemy('k',clamp(P.x+Math.cos(an)*60,-W+2,W-2),clamp(P.z+Math.sin(an)*60,-W+2,W-2));E[E.length-1].alert=14;}
  zVoice('scream',P.x+Math.cos(an)*30,P.y+2,P.z+Math.sin(an)*30,1);
}
function spawnLoop(){
  if(!started||P.dead)return;
  const lv=Math.min(P.level,30),zs=E.filter(e=>e.t!=='w'&&e.t!=='b').length,nw=E.filter(e=>e.t==='w').length;
  const ring=(a,b)=>{const an=rnd(0,6.28),d=rnd(a,b);return[clamp(P.x+Math.cos(an)*d,-W+2,W-2),clamp(P.z+Math.sin(an)*d,-W+2,W-2)];};
  const hot=(ruins.some(r=>Math.hypot(r.x-P.x,r.z-P.z)<40)?25:0)+(towns.some(t=>Math.hypot(t.x-P.x,t.z-P.z)<45)?12:0);
  const cap=Math.round(((night>.5?ZC.night:ZC.base)+lv*ZC.perLevel+hot)*(isTouch?.55:1));
  for(let n=Math.min(ZC.perTick,cap-zs);n>0;n--){
    const[x,z]=ring(38,75),r=Math.random(),kb=.05+night*.07+lv*.004,rn=.2+night*.12;
    mkEnemy(r<kb?'k':r<kb+rn?'r':'z',x,z);
  }
  if(nw<14){const[x,z]=ring(25,70);mkEnemy('w',x,z);}
  if(night>.6&&!E.some(e=>e.t==='b')){const[x,z]=ring(45,60);mkEnemy('b',x,z);}
  hordeT-=1;if(hordeT<=0){hordeT=rnd(ZC.hordeEvery[0],ZC.hordeEvery[1]);horde();}
  E.forEach(e=>{if(e.t!=='b'&&Math.hypot(e.x-P.x,e.z-P.z)>135){e.dead=true;scene.remove(e.m);}});
}
setInterval(spawnLoop,1000);

// ---------- update ----------
// ================= EXTRA SYSTEMS (v2) =================
function mkEl(tag,css,parent=document.body){const e=document.createElement(tag);e.style.cssText=css;parent.appendChild(e);return e;}
{
  let vmeta=document.querySelector('meta[name=viewport]');
  if(!vmeta){vmeta=document.createElement('meta');vmeta.name='viewport';document.head.appendChild(vmeta);}
  vmeta.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  mkEl('style','',document.head).textContent='canvas{touch-action:none}#mUI{position:fixed;inset:0;z-index:15;pointer-events:none;touch-action:none}#mUI>*{pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none}';
  addEventListener('contextmenu',e=>e.preventDefault());
  const br=$('br');if(br)br.innerHTML='WASD gerak · Shift lari · Spasi lompat/glider<br>Klik kiri serang · Klik kanan bidik · V ganti kamera<br>1 Pedang · 2 Senjata · R Reload · Q Elemen · E Skill<br>F Perintah pasukan · G Rekrut (5 koin) · C Mobil · Y Cuaca · T Waktu<br>M Mic on/off · B Suara Tim/Dekat';
}
const toastEl=mkEl('div','position:fixed;top:92px;left:50%;transform:translateX(-50%);padding:6px 14px;border-radius:8px;background:rgba(0,0,0,.65);color:#fde047;font:700 13px system-ui;opacity:0;transition:opacity .3s;pointer-events:none;z-index:30;white-space:nowrap');
function toast(s){toastEl.textContent=s;toastEl.style.opacity=1;clearTimeout(toastEl._t);toastEl._t=setTimeout(()=>toastEl.style.opacity=0,2400);}

// ---------- audio (Web Audio, tanpa file) ----------
let AC=null;const aN={};
function audioInit(){
  if(AC){AC.resume?.();return;}
  try{
    AC=new(window.AudioContext||window.webkitAudioContext)();
    const buf=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const bus=(type,f)=>{const s=AC.createBufferSource();s.buffer=buf;s.loop=true;const fl=AC.createBiquadFilter();fl.type=type;fl.frequency.value=f;const g=AC.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(AC.destination);s.start();return g;};
    aN.wind=bus('lowpass',500);aN.rain=bus('highpass',2500);
    const o=AC.createOscillator(),fl=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';fl.type='lowpass';fl.frequency.value=260;g.gain.value=0;o.connect(fl);fl.connect(g);g.connect(AC.destination);o.start();aN.engO=o;aN.eng=g;zInit();
  }catch(e){AC=null;}
}
function tone(f,type='sine',dur=.12,vol=.1,slide=0){
  if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur);
}
const SFX={shot:[190,'square',.08,.1,-120],slash:[320,'triangle',.14,.12,-180],skill:[260,'sawtooth',.35,.14,180],hit:[150,'sawtooth',.07,.08,-60],hurt:[110,'sawtooth',.16,.14,-40],kill:[520,'triangle',.15,.1,220],jump:[240,'sine',.12,.07,120],pick:[700,'sine',.15,.1,300],boom:[70,'square',.45,.2,-40],thunder:[45,'sawtooth',1.1,.25,-20]};
const lastS={};
function sfx(n){const t=performance.now();if(t-(lastS[n]||0)<45)return;lastS[n]=t;const a=SFX[n];if(a)tone(...a);}
function audioTick(){
  if(!AC)return;const t=AC.currentTime;
  aN.wind.gain.setTargetAtTime(.03+clamp((P.y-10)/14,0,1)*.18+wx.v*.1,t,.4);
  aN.rain.gain.setTargetAtTime(wx.v*.1,t,.4);
  aN.eng.gain.setTargetAtTime(P.car?.04:0,t,.15);
  aN.engO.frequency.setTargetAtTime(38+(P.car?Math.abs(P.car.v):0)*5,t,.15);
  audioExtra(t);
}
let beat=0;
setInterval(()=>{
  if(!AC||!started)return;beat++;
  const bossUp=E.some(e=>e.t==='b'),near=E.some(e=>e.t!=='w'&&Math.hypot(e.x-P.x,e.z-P.z)<18);
  if(bossUp||near)tone(bossUp?(beat%2?55:62):70,'triangle',.2,.07);
  else if(beat%16===0)[220,277,330].forEach(f=>tone(f,'sine',3.5,.012));
  if(night>.5&&Math.random()<.7)tone(4200+Math.random()*300,'sine',.05,.012);
},300);

// ---------- cuaca ----------
const wx={target:0,v:0,flash:0,timer:rnd(45,90)}; // target: 0 cerah, 1 hujan, 2 badai
function weatherTick(dt){
  wx.timer-=dt;if(wx.timer<=0){wx.timer=rnd(50,110);const r=Math.random();wx.target=r<.55?0:r<.85?1:2;}
  wx.v+=((wx.target?1:0)-wx.v)*Math.min(1,dt*.4);
  if(wx.target===2&&Math.random()<dt*.1){wx.flash=1;setTimeout(()=>sfx('thunder'),300+Math.random()*700);}
  wx.flash=Math.max(0,wx.flash-dt*4);
}
const RN=900,rp=new Float32Array(RN*3),rv=new Float32Array(RN*6),rg=new THREE.BufferGeometry();
for(let i=0;i<RN;i++){rp[i*3]=rnd(-30,30);rp[i*3+1]=rnd(0,26);rp[i*3+2]=rnd(-30,30);}
rg.setAttribute('position',new THREE.BufferAttribute(rv,3));
const rainM=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xaed0ff,transparent:true,opacity:0}));rainM.frustumCulled=false;scene.add(rainM);
function rainTick(dt){
  rainM.material.opacity=wx.v*.55;rainM.visible=wx.v>.03;if(!rainM.visible)return;
  for(let i=0;i<RN;i++){
    let y=rp[i*3+1]-45*dt;if(y<0){y+=26;rp[i*3]=rnd(-30,30);rp[i*3+2]=rnd(-30,30);}rp[i*3+1]=y;
    const x=P.x+rp[i*3],z=P.z+rp[i*3+2],yy=P.y+y,o=i*6;
    rv[o]=x;rv[o+1]=yy;rv[o+2]=z;rv[o+3]=x+.15;rv[o+4]=yy+1;rv[o+5]=z+.1;
  }
  rg.attributes.position.needsUpdate=true;
}

// ---------- kamera: viewmodel FPS ----------
scene.add(camera);
const vmGrp=new THREE.Group(),vg=new THREE.Mesh(new THREE.BoxGeometry(.14,.18,.8),new THREE.MeshStandardMaterial({color:0x222222})),
  vs=new THREE.Mesh(new THREE.BoxGeometry(.06,.06,1.5),new THREE.MeshStandardMaterial({color:0xdde4ee,metalness:.8,roughness:.3}));
vs.position.set(.12,.1,-.6);vmGrp.add(vg,vs);camera.add(vmGrp);
function cycleCam(){
  cam.mode=(cam.mode+1)%3;
  if(cam.mode===2)document.exitPointerLock?.();else if(!isTouch&&started)renderer.domElement.requestPointerLock?.();
  toast(['Kamera bahu (Free Fire)','Kamera FPS (BLACK)','Kamera atas klasik'][cam.mode]);
}

// ---------- dunia: api unggun, altar elemen, mobil ----------
function findSpot(tx,tz,a,b){
  const ci=Math.round(tx/S+C),cj=Math.round(tz/S+C);
  for(const R of[40,120,N]){ // cari di sekitar target dulu (dunia besar -> hemat waktu loading)
    let best=null,bd=1e9;
    for(let i=Math.max(3,ci-R);i<Math.min(N-3,ci+R);i++)for(let j=Math.max(3,cj-R);j<Math.min(N-3,cj+R);j++){const h=H[i][j];if(h<a||h>b||road(i,j))continue;const d=Math.hypot((i-C)*S-tx,(j-C)*S-tz);if(d<bd){bd=d;best=[(i-C)*S,(j-C)*S];}}
    if(best)return best;
  }
  return null;
}
const campP=findSpot(-30,-76,3,6)||[-30,-60],camps=[];
function mkCamp(x,z){
  const y=gy(x,z),f=new THREE.Mesh(new THREE.ConeGeometry(.9,2.2,5),new THREE.MeshBasicMaterial({color:0xff9a2a}));f.position.set(x,y+1.2,z);scene.add(f);
  for(let i=0;i<6;i++){const a=i/6*6.283,st=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.7),new THREE.MeshStandardMaterial({color:0x6b6b70}));st.position.set(x+Math.cos(a)*1.8,y+.3,z+Math.sin(a)*1.8);scene.add(st);}
  const c={x,z,y,flame:f};camps.push(c);return c;
}
const camp=mkCamp(campP[0],campP[1]);
const campL=new THREE.PointLight(0xff7a2a,2.2,28);campL.position.set(camp.x,camp.y+2.5,camp.z);scene.add(campL); // 1 lampu saja, pindah ke api unggun terdekat (hemat GPU)
towns.forEach(t=>mkCamp(t.x,t.z));
const nearCamp=(x,z)=>{let b=camps[0],bd=1e9;for(const c of camps){const d=(c.x-x)**2+(c.z-z)**2;if(d<bd){bd=d;b=c;}}return b;};

const shrines=[];
(()=>{const K=N*S*.3;return[[-K,-K],[K,-K],[K,K],[-K,K]];})().forEach(([tx,tz],i)=>{
  const sp=findSpot(tx,tz,8,11);if(!sp)return;
  const c2=EL[i].c,found=P.shr.includes(i),y=gy(sp[0],sp[1]);
  const pillar=new THREE.Mesh(new THREE.BoxGeometry(1.4,7,1.4),new THREE.MeshStandardMaterial({color:c2,emissive:c2,emissiveIntensity:found?.15:.9}));
  pillar.position.set(sp[0],y+3.5,sp[1]);pillar.castShadow=true;scene.add(pillar);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(1),new THREE.MeshBasicMaterial({color:c2}));gem.position.set(sp[0],y+8.5,sp[1]);scene.add(gem);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,70,8,1,true),new THREE.MeshBasicMaterial({color:c2,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));
  beam.position.set(sp[0],y+38,sp[1]);beam.visible=!found;scene.add(beam);  // cahaya penunjuk arah dari jauh
  shrines.push({i,x:sp[0],z:sp[1],m:gem,pillar,beam});
});

const cars=[];
function mkCar(x,z,color,ry){
  const g=new THREE.Group(),a=(w,h,d,c,px,py,pz)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c}));o.position.set(px,py,pz);o.castShadow=true;g.add(o);return o;};
  a(3,1,5.4,color,0,1,0);a(2.4,.9,2.6,0x1e293b,0,1.9,-.3);
  [[-1.6,.5,1.7],[1.6,.5,1.7],[-1.6,.5,-1.7],[1.6,.5,-1.7]].forEach(p=>a(.5,1,1,0x111111,...p));
  a(2.6,.3,.1,0xfff3b0,0,1.1,2.7).material.emissive=new THREE.Color(0xfff3b0);
  const y=gy(x,z);g.position.set(x,y,z);scene.add(g);cars.push({m:g,x,z,y,ry,v:0});
}
[[0,-30,0xdc2626,0],[0,32,0x2563eb,Math.PI],[-34,0,0xf59e0b,Math.PI/2],[34,0,0x10b981,-Math.PI/2]].forEach(a=>mkCar(...a));
for(let k=0;k<28;k++){const a=k/28*6.283+.3,R=N*.27*S;mkCar(Math.cos(a)*R,Math.sin(a)*R,[0xdc2626,0x2563eb,0xf59e0b,0x10b981,0x9333ea][k%5],Math.atan2(-Math.sin(a),Math.cos(a)));}   // mobil di jalan lingkar
towns.forEach((t,k)=>mkCar(t.x+4.5,t.z+4.5,0x6b7280,k*1.3));
function driveCar(c,dt,dx,dz){
  c.v+=-dz*22*dt;c.v*=Math.exp(-(Math.abs(dz)<.1?1.2:.25)*dt);c.v=clamp(c.v,-8,26);
  c.ry+=-dx*Math.min(1,Math.abs(c.v)/8)*2.1*dt*Math.sign(c.v||1);
  const nx=c.x+Math.sin(c.ry)*c.v*dt,nz=c.z+Math.cos(c.ry)*c.v*dt;
  if(!blocked(nx,nz,1.9)&&gy(nx,nz)-gy(c.x,c.z)<=S*1.1){c.x=clamp(nx,-W,W);c.z=clamp(nz,-W,W);}else c.v*=-.3;
  if(Math.abs(c.v)>7){
    for(const e of E)if(!e.dead&&Math.hypot(e.x-c.x,e.z-c.z)<e.r+2){dmg(e,3,Math.sin(c.ry)*c.v*1.2,Math.cos(c.ry)*c.v*1.2);c.v*=.85;}
    PROPS.slice().forEach(p=>{if(Math.hypot(p.x-c.x,p.z-c.z)<2.6)hitProp(p,3);});
  }
  P.x=c.x;P.z=c.z;P.vx=P.vz=0;
}
function toggleCar(){
  if(P.dead)return;
  if(P.car){const c=P.car;P.car=null;c.v=0;P.x=c.x+Math.cos(c.ry)*3;P.z=c.z-Math.sin(c.ry)*3;}
  else{let b=null,bd=5;cars.forEach(c=>{const d=Math.hypot(c.x-P.x,c.z-P.z);if(d<bd){bd=d;b=c;}});if(b){P.car=b;P.vx=P.vz=0;cam.yaw=b.ry;}}
}
function worldTick(dt){
  const nc=nearCamp(P.x,P.z);campL.position.set(nc.x,nc.y+2.5,nc.z);campL.intensity=2.2+Math.sin(clock*12)*.4+Math.random()*.3;camps.forEach(c=>c.flame.scale.y=1+Math.sin(clock*14+c.x)*.2);
  if(!P.dead&&Math.hypot(P.x-nc.x,P.z-nc.z)<8)P.hp=Math.min(100,P.hp+10*dt);
  shrines.forEach(s=>{
    s.m.rotation.y+=dt;
    if(!P.dead&&!P.shr.includes(s.i)&&Math.hypot(P.x-s.x,P.z-s.z)<3.4){
      P.shr.push(s.i);P.pw[s.i]+=.25;s.pillar.material.emissiveIntensity=.15;if(s.beam)s.beam.visible=false;ring(s.x,s.z,EL[s.i].c,10);sfx('pick');
      toast('✨ Altar '+EL[s.i].n+' ditemukan! Skill '+EL[s.i].n+' +25%');saveProgress();
    }
  });
  cars.forEach(c=>{if(c!==P.car)c.v=0;c.y+=(gy(c.x,c.z)-c.y)*Math.min(1,dt*10);c.m.position.set(c.x,c.y,c.z);c.m.rotation.y=c.ry;});
}

// ---------- pasukan NPC ----------
const allies=[];let squadMode=0;
function mkAlly(i){
  const role=i%2?'sword':'gun',m=human(role==='gun'?0x10b981:0x14b8a6,.95);
  const wm=new THREE.Mesh(role==='gun'?new THREE.BoxGeometry(.2,.25,1):new THREE.BoxGeometry(.15,.15,1.8),new THREE.MeshStandardMaterial({color:role==='gun'?0x222222:0xdde4ee}));
  wm.position.set(.8,2.1,.8);m.add(wm);
  const x=P.x+rnd(-3,3),z=P.z+rnd(-3,3);m.position.set(x,gy(x,z),z);scene.add(m);
  allies.push({m,x,z,hp:80,max:80,cd:0,role,dead:0,kx:0,kz:0,vx:0,vz:0,ph:rnd(0,9),gx:P.x,gz:P.z});
}
function recruit(){
  if(P.coins<5){toast('Butuh 5 koin (1 koin tiap kill)');return;}
  if(allies.length>=8){toast('Pasukan sudah penuh');return;}
  P.coins-=5;mkAlly(allies.length);saveProgress();toast('👥 NPC baru bergabung!');
}
function toggleSquad(){squadMode=1-squadMode;allies.forEach(a=>{a.gx=P.x;a.gz=P.z;});toast(squadMode?'Pasukan: JAGA AREA':'Pasukan: IKUT');}
function allyTick(dt){
  allies.forEach((a,k)=>{
    if(a.dead>0){a.dead-=dt;if(a.dead<=0){a.dead=0;a.hp=a.max;a.x=P.x+rnd(-3,3);a.z=P.z+rnd(-3,3);a.m.visible=true;}return;}
    a.cd-=dt;let t=null,bd=squadMode?18:26;
    for(const e of E){if(e.dead||e.t==='w')continue;const d=Math.hypot(e.x-a.x,e.z-a.z);if(d<bd){bd=d;t=e;}}
    const ang=k/Math.max(1,allies.length)*6.283+Math.PI,rr=4+k%2*1.6,bx=squadMode?a.gx:P.x,bz=squadMode?a.gz:P.z;
    let tx=bx+Math.cos(ang)*rr,tz=bz+Math.sin(ang)*rr,stop=1.5;
    if(t&&!(squadMode&&Math.hypot(t.x-bx,t.z-bz)>20)){tx=t.x;tz=t.z;stop=a.role==='gun'?9:2;}else t=null;
    const ddx=tx-a.x,ddz=tz-a.z,dd=Math.hypot(ddx,ddz)||1,far=Math.hypot(P.x-a.x,P.z-a.z);
    if(far>60&&!squadMode){a.x=P.x+rnd(-3,3);a.z=P.z+rnd(-3,3);}
    const sp=dd>stop?(far>25?15:8.5):0,q=Math.min(1,10*dt);
    a.vx+=(ddx/dd*sp-a.vx)*q;a.vz+=(ddz/dd*sp-a.vz)*q;
    mv(a,a.vx*dt,a.vz*dt,.7);mv(a,a.kx*dt,a.kz*dt,.7);const kd=Math.exp(-5*dt);a.kx*=kd;a.kz*=kd;
    const ay=gy(a.x,a.z);a.m.position.set(a.x,a.m.position.y+(ay-a.m.position.y)*Math.min(1,dt*12),a.z);
    let fx=a.vx,fz=a.vz;if(t){fx=t.x-a.x;fz=t.z-a.z;}
    if(Math.hypot(fx,fz)>.3){const ta=Math.atan2(fx,fz),da=Math.atan2(Math.sin(ta-a.m.rotation.y),Math.cos(ta-a.m.rotation.y));a.m.rotation.y+=da*Math.min(1,dt*12);}
    const s=Math.sin(clock*9+a.ph)*.7*Math.min(1,Math.hypot(a.vx,a.vz)/6),u=a.m.userData;
    u.legL.rotation.x=s;u.legR.rotation.x=-s;u.armR.rotation.x=t?-1.3:s;u.armL.rotation.x=t&&a.role==='gun'?-1.2:-s;
    if(t&&a.cd<=0){
      const dx=t.x-a.x,dz=t.z-a.z,dl=Math.hypot(dx,dz)||1;
      if(a.role==='gun'&&dl<24){a.cd=.9;const b=new THREE.Mesh(bulletG,bulletM);b.position.set(a.x+dx/dl*1.2,ay+2.2,a.z+dz/dl*1.2);scene.add(b);B.push({m:b,vx:dx/dl*62,vy:(t.m.position.y+1.9*(t.sc||1)-(ay+2.2))/dl*62,vz:dz/dl*62,life:1.2,own:'a'});}
      else if(a.role==='sword'&&dl<t.r+2.6){a.cd=.7;dmg(t,1.5,dx/dl*10,dz/dl*10);ring(a.x,a.z,0x14b8a6,3);}
    }
    for(const e of E){if(e.dead||e.t==='w')continue;if(clock>(e.ah||0)&&Math.hypot(e.x-a.x,e.z-a.z)<e.r+1.4){e.ah=clock+1.2;a.hp-=(e.dmg||8)*.7;if(a.hp<=0){a.dead=8;a.m.visible=false;break;}}}
    a.hp=Math.min(a.max,a.hp+1.2*dt);
    if(Math.hypot(a.x-nearCamp(a.x,a.z).x,a.z-nearCamp(a.x,a.z).z)<8)a.hp=Math.min(a.max,a.hp+12*dt);
  });
}

// ---------- HUD: crosshair, minimap, kompas, info ----------
const cross=mkEl('div','width:22px;height:22px;position:fixed;left:50%;top:50%;margin:-11px 0 0 -11px;pointer-events:none;display:none;z-index:5;background:linear-gradient(#fff,#fff) center/2px 100% no-repeat,linear-gradient(#fff,#fff) center/100% 2px no-repeat;filter:drop-shadow(0 0 2px #000)');
const xh=mkEl('div','position:fixed;bottom:12px;left:50%;transform:translateX(-50%);font:700 12px system-ui;color:#fde047;text-shadow:1px 1px 3px #000;text-align:center;pointer-events:none;z-index:5;white-space:nowrap');
const mapBase=document.createElement('canvas');mapBase.width=mapBase.height=N;
{const g=mapBase.getContext('2d');for(let i=0;i<N;i++)for(let j=0;j<N;j++){const h=H[i][j];g.fillStyle=road(i,j)?'#3a3d45':'#'+topColor(h,BM[i][j]).toString(16).padStart(6,'0');g.fillRect(i,j,1,1);}}
const waterPts=[];for(let i=2;i<N-2;i+=8)for(let j=2;j<N-2;j+=8)if(H[i][j]<=1&&!road(i,j))waterPts.push([(i-C)*S,(j-C)*S]);
function nearestPt(arr){let b=null,bd=1e9;for(const p of arr){const d=(p[0]-P.x)**2+(p[1]-P.z)**2;if(d<bd){bd=d;b=p;}}return b;}
const MS=isTouch?84:112;
const mm=mkEl('canvas',`position:fixed;left:14px;top:84px;width:${MS}px;height:${MS}px;border-radius:50%;border:2px solid rgba(255,255,255,.5);pointer-events:none;z-index:5;background:#000;display:none`);mm.width=mm.height=112;
function drawMap(){
  const g=mm.getContext('2d'),R=46,k=112/(R*2);
  g.fillStyle='#000';g.fillRect(0,0,112,112);
  g.drawImage(mapBase,P.x/S+C-R,P.z/S+C-R,R*2,R*2,0,0,112,112);
  const dot=(x,z,c,r)=>{const px=56+(x-P.x)/S*k,pz=56+(z-P.z)/S*k;if(Math.hypot(px-56,pz-56)<54){g.fillStyle=c;g.beginPath();g.arc(px,pz,r,0,6.3);g.fill();}};
  camps.forEach(c=>dot(c.x,c.z,'#fb923c',4));ruins.forEach(r=>dot(r.x,r.z,'#22d3ee',3));
  shrines.forEach(s=>{if(!P.shr.includes(s.i))dot(s.x,s.z,'#'+EL[s.i].c.toString(16).padStart(6,'0'),4);});
  cars.forEach(c=>dot(c.x,c.z,'#e5e7eb',3));
  allies.forEach(a=>{if(!a.dead)dot(a.x,a.z,'#22c55e',2.5);});
  remotes.forEach(r=>dot(r.x,r.z,'#38bdf8',3));
  E.forEach(e=>dot(e.x,e.z,e.t==='b'?'#e879f9':e.t==='k'?'#f97316':e.t==='r'?'#facc15':e.t==='w'?'#fbbf24':'#ef4444',e.t==='b'?5:e.t==='k'?3.6:2.2));
  g.save();g.translate(56,56);g.rotate(Math.PI-pmRy);g.fillStyle='#fff';g.beginPath();g.moveTo(0,-6);g.lineTo(4.5,5);g.lineTo(-4.5,5);g.fill();g.restore();
}
const cmp=mkEl('canvas','position:fixed;top:58px;left:50%;transform:translateX(-50%);width:min(320px,52vw);height:26px;pointer-events:none;z-index:5;border-radius:6px;background:rgba(0,0,0,.35);display:none');cmp.width=320;cmp.height=26;
function drawCompass(){
  const g=cmp.getContext('2d'),w=320,head=cam.mode<2?cam.yaw:Math.PI;
  const X=b=>{const r=Math.atan2(Math.sin(b-head),Math.cos(b-head));return Math.abs(r)>1.2?null:w/2-r/1.2*(w/2-12);};
  g.clearRect(0,0,w,26);g.font='bold 12px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';
  [['U',Math.PI],['T',Math.PI/2],['S',0],['B',-Math.PI/2]].forEach(([t,b])=>{const x=X(b);if(x!==null)g.fillText(t,x,13);});
  const nc=nearCamp(P.x,P.z),T2=[[nc.x,nc.z,'🔥']],wp=nearestPt(waterPts);if(wp)T2.push([wp[0],wp[1],'💧']);const nt=nearestPt(towns.map(t=>[t.x,t.z]));if(nt)T2.push([nt[0],nt[1],'🏠']);
  const ns=nearestPt(shrines.filter(s=>!P.shr.includes(s.i)).map(s=>[s.x,s.z]));if(ns)T2.push([ns[0],ns[1],'✨']);
  const bs=E.find(e=>e.t==='b');if(bs)T2.push([bs.x,bs.z,'☠️']);
  T2.forEach(([x,z,ic])=>{const px=X(Math.atan2(x-P.x,z-P.z));if(px!==null)g.fillText(ic,px,13);});
}
function hudX(){
  if(!started)return;
  mm.style.display=cmp.style.display='block';
  const near=!P.car&&cars.some(c=>Math.hypot(c.x-P.x,c.z-P.z)<5);let h='';
  if(P.car)h='🚗 [C] keluar · W/S gas · A/D belok';else if(near)h='[C] naik mobil';
  else if(Math.hypot(P.x-nearCamp(P.x,P.z).x,P.z-nearCamp(P.x,P.z).z)<9)h='🔥 Api unggun: HP pulih';else if(P.coins>=5)h='[G] rekrut NPC (5 koin)';
  xh.textContent=(h?h+'  |  ':'')+'👥 '+allies.filter(a=>!a.dead).length+'/'+allies.length+' '+(squadMode?'Jaga':'Ikut')+' · 🪙 '+P.coins;
  cross.style.display=cam.mode<2&&!P.dead&&!P.car?'block':'none';
  drawMap();drawCompass();
}

// ---------- kontrol HP ----------
let TL=null;
const buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms);}catch(e){}};
if(isTouch){
  mkEl('style','',document.head).textContent='html,body{overscroll-behavior:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}body{-webkit-user-select:none;user-select:none}input{-webkit-user-select:text;user-select:text}.tb{transition:transform .06s,filter .06s;touch-action:none}.tb.on{transform:scale(.9);filter:brightness(1.4)}.tb.tg{background:rgba(34,197,94,.85)!important}';
  // helper posisi (aman untuk notch / sudut layar melengkung)
  const R=n=>`right:calc(${n}px + env(safe-area-inset-right,0px));`,Bt=n=>`bottom:calc(${n}px + env(safe-area-inset-bottom,0px));`;
  const ui=mkEl('div','');ui.id='mUI';

  // joystick kiri (muncul di titik sentuh, dorong penuh = lari)
  const jz=mkEl('div','position:absolute;left:0;bottom:0;width:42%;height:75%',ui);
  const jb=mkEl('div','position:absolute;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.3);display:none',ui);
  const jk=mkEl('div','position:absolute;width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,.6);left:34px;top:34px',jb);
  let jid=null,jc=null;
  jz.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];jid=t.identifier;jc={x:t.clientX,y:t.clientY};jb.style.display='block';jb.style.left=jc.x-60+'px';jb.style.top=jc.y-60+'px';},{passive:false});
  jz.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===jid){let x=(t.clientX-jc.x)/55,y=(t.clientY-jc.y)/55;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}joy.x=x;joy.y=y;jk.style.transform=`translate(${x*34}px,${y*34}px)`;}},{passive:false});
  const jr=e=>{for(const t of e.changedTouches)if(t.identifier===jid){jid=null;joy.x=joy.y=0;jb.style.display='none';jk.style.transform='';}};
  jz.addEventListener('touchend',jr);jz.addEventListener('touchcancel',jr);

  // geser layar kanan = melihat (lebih pelan saat membidik)
  const lz=mkEl('div','position:absolute;right:0;top:0;width:58%;height:100%',ui);
  let lid=null,lx=0,ly=0;
  lz.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];lid=t.identifier;lx=t.clientX;ly=t.clientY;},{passive:false});
  lz.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches)if(t.identifier===lid){const k=cam.ads?.6:1;cam.yaw-=(t.clientX-lx)*.0055*k;cam.pitch=clamp(cam.pitch-(t.clientY-ly)*.0045*k,-.6,.9);lx=t.clientX;ly=t.clientY;}},{passive:false});
  const lr=e=>{for(const t of e.changedTouches)if(t.identifier===lid)lid=null;};
  lz.addEventListener('touchend',lr);lz.addEventListener('touchcancel',lr);

  // pembuat tombol: efek tekan + getar singkat
  const mb=(txt,css,down,up)=>{
    const b=mkEl('div','position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(15,23,42,.55);color:#fff;font:800 10px/1.15 system-ui;display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre;'+css,ui);
    b.className='tb';b.textContent=txt;
    b.addEventListener('touchstart',e=>{e.preventDefault();b.classList.add('on');buzz(8);down&&down(b);},{passive:false});
    const u=e=>{e.preventDefault();b.classList.remove('on');up&&up(b);};
    b.addEventListener('touchend',u);b.addEventListener('touchcancel',u);return b;
  };
  TL={mb,R,Bt};

  // --- gugus tombol aksi (kanan bawah, jangkauan ibu jari) ---
  mb('TEMBAK',R(24)+Bt(24)+'width:88px;height:88px;font-size:12px;background:rgba(239,68,68,.75)',()=>{mouse.down=true;},()=>{mouse.down=false;});
  mb('⤒\nLOMPAT',R(34)+Bt(124)+'width:64px;height:64px',()=>{keys.Space=1;},()=>{keys.Space=0;});
  mb('✦\nSKILL',R(128)+Bt(36)+'width:66px;height:66px;background:rgba(245,158,11,.78)',()=>skill());   // () => skill() supaya pakai versi skill yang sudah diperbarui
  mb('🔫\nGANTI',R(204)+Bt(106)+'width:54px;height:54px',()=>{P.w=1-P.w;});
  mb('↻\nRELOAD',R(212)+Bt(44)+'width:54px;height:54px',()=>reload());
  mb('✨\nELEMEN',R(268)+Bt(76)+'width:54px;height:54px',()=>setEl((P.el+1)%4));

  // --- tombol kecil (kanan atas, di bawah HUD) ---
  const tb='width:46px;height:46px;border-radius:12px;';
  mb('📷\nCAM',tb+'top:104px;'+R(12),()=>cycleCam());
  mb('👥\nTIM',tb+'top:104px;'+R(66),()=>toggleSquad());
  mb('🚗\nMOBIL',tb+'top:104px;'+R(120),()=>toggleCar());
  mb('⛶\nFULL',tb+'top:104px;'+R(174),()=>goFull());
  mb('🎯\nBIDIK',tb+'top:158px;'+R(12),b=>{cam.ads=!cam.ads;b.classList.toggle('tg',cam.ads);});
  mb('🏃\nLARI',tb+'top:158px;'+R(66),b=>{keys.ShiftLeft=keys.ShiftLeft?0:1;b.classList.toggle('tg',!!keys.ShiftLeft);});
  mb('➕\nREKRUT',tb+'top:158px;'+R(120),()=>recruit());

  // layar penuh + kunci landscape (otomatis saat mulai main)
  function goFull(){
    const d=document.documentElement;
    try{const p=(d.requestFullscreen||d.webkitRequestFullscreen)?.call(d);p&&p.catch&&p.catch(()=>{});}catch(e){}
    try{const p=screen.orientation?.lock?.('landscape');p&&p.catch&&p.catch(()=>{});}catch(e){}
  }
  document.querySelectorAll('.el-btn[data-e]').forEach(b=>b.addEventListener('click',goFull));

  // petunjuk kontrol versi sentuh
  const br=$('br');if(br)br.innerHTML='Joystick kiri: gerak (dorong penuh = lari)<br>Geser layar kanan: melihat sekeliling<br>Tombol kanan bawah: tembak · lompat · skill · dash<br>🎯 Bidik · 🏃 Lari tetap · ➕ Rekrut teman · ⛶ Layar penuh';

  // saran putar ke landscape (ketuk untuk menutup)
  const rot=mkEl('div','position:fixed;inset:0;z-index:9999;background:rgba(2,6,23,.94);color:#fff;font:700 16px system-ui;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px');
  rot.innerHTML='<div style="font-size:54px">📱↻</div><div>Putar HP ke mode landscape<br>biar kontrolnya lega</div><div style="font:600 12px system-ui;opacity:.7">(ketuk layar untuk tetap main portrait)</div>';
  let rotOff=false;const chkRot=()=>{rot.style.display=!rotOff&&innerHeight>innerWidth?'flex':'none';};
  const rotClose=e=>{e.preventDefault();rotOff=true;chkRot();};
  rot.addEventListener('touchstart',rotClose,{passive:false});rot.addEventListener('click',rotClose);
  addEventListener('resize',chkRot);addEventListener('orientationchange',chkRot);chkRot();

  // lepas semua input kalau app ke background (cegah karakter lari/nembak sendiri)
  document.addEventListener('visibilitychange',()=>{if(document.hidden){mouse.down=false;keys.Space=0;joy.x=joy.y=0;jid=lid=null;jb.style.display='none';}});

  // kualitas adaptif: kalau FPS terus rendah, matikan bayangan lalu turunkan resolusi
  let fc=0,lowN=0,prNow=Math.min(devicePixelRatio,1.25);
  (function cnt(){fc++;requestAnimationFrame(cnt);})();
  setInterval(()=>{
    const fps=fc/2;fc=0;
    if(!started||document.hidden||P.dead){lowN=0;return;}
    lowN=fps<28?lowN+1:0;
    if(lowN>=2){
      lowN=0;
      if(sun.castShadow){sun.castShadow=false;toast('⚙ Bayangan dimatikan agar lebih lancar');}
      else if(prNow>.65){prNow=Math.max(.65,prNow-.15);renderer.setPixelRatio(prNow);renderer.setSize(innerWidth,innerHeight);toast('⚙ Resolusi diturunkan agar lebih lancar');}
    }
  },2000);
}

// ---------- mabar online (PeerJS, relay via host) + sinkron tembakan/skill ----------
const peers=[],seen=new Set();let peer=null;
function net(m){ch.postMessage(m);peers.forEach(c=>c.open&&c.send(m));}
function startPeer(code,host){
  const st=t=>{$('mabarStatus').textContent=t;};
  const go=()=>{
    try{peer&&peer.destroy();}catch(e){}peers.length=0;voices.forEach(v=>{try{v.call.close();}catch(e){}});voices.clear();
    const hid='voxelcity2-'+code.toLowerCase();peer=host?new Peer(hid):new Peer();
    const link=c=>{
      c.on('open',()=>{peers.push(c);st('Online: '+peers.length+' koneksi · Room '+code);});
      c.on('data',d=>{onMsg({data:d});if(host)peers.forEach(o=>o!==c&&o.open&&o.send(d));});
      c.on('close',()=>{const i=peers.indexOf(c);if(i>-1)peers.splice(i,1);});
    };
    peer.on('open',()=>{if(host)st('Room online dibuat: '+code+' (bagikan kode ini)');else link(peer.connect(hid));});
    peer.on('connection',link);peer.on('call',async call=>{await initVoice();call.answer(outStream);voiceSetup(call,call.peer);});initVoice();vui.style.display='flex';updVoiceUI();
    peer.on('error',er=>st(er.type==='unavailable-id'?'Kode room sudah dipakai, coba kode lain':'Online gagal ('+er.type+'); mode multi-tab tetap jalan'));
  };
  if(window.Peer)return go();
  const s=document.createElement('script');s.src='https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';s.onload=go;s.onerror=()=>st('PeerJS gagal dimuat; hanya mode multi-tab');document.head.appendChild(s);
}
{const oh=$('btnHost').onclick,oj=$('btnJoin').onclick;
 $('btnHost').onclick=()=>{audioInit();initVoice();oh();startPeer(room,true);};
 $('btnJoin').onclick=()=>{audioInit();initVoice();oj();if(room!=='SOLO')startPeer(room,false);};}
document.querySelectorAll('.el-btn[data-e]').forEach(b=>b.addEventListener('click',()=>{
  audioInit();
  if(!allies.length)for(let i=0;i<Math.max(3,savedData.squad||0);i++)mkAlly(i);
  if(!isTouch&&cam.mode<2)renderer.domElement.requestPointerLock?.();
}));


// ================= SUARA ZOMBIE SERAM (v3) =================
let NB=null,zBus=null,zCur=0;
const distCurve=k=>{const n=256,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(3+k)*x*20*(Math.PI/180)/(Math.PI+k*Math.abs(x));}return c;},zCurve=distCurve(28);
function zInit(){
  NB=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const comp=AC.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=6;
  zBus=AC.createGain();zBus.connect(comp);comp.connect(AC.destination);
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=320;lp.connect(zBus);
  const mk=(f,type)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.value=0;o.connect(g);g.connect(lp);o.start();return g;};
  aN.d1=mk(41.2,'sawtooth');aN.d2=mk(43.6,'sawtooth');aN.d3=mk(58.3,'triangle'); // drone disonan ala film horor
}
const setPos=(pn,x,y,z)=>{if(pn.positionX){pn.positionX.value=x;pn.positionY.value=y;pn.positionZ.value=z;}else pn.setPosition(x,y,z);};
function zVoice(kind,x,y,z,vol=1){
  if(!AC||!zBus||zCur>=7)return;
  const R=Math.random,t=AC.currentTime+.01,dist=Math.hypot(x-P.x,z-P.z);
  const cfg={
    groan:{d:1.3+R()*.8,f:68+R()*40,k:[.85,1.12,.55],n:.16,f1:[380,620],f2:[700,1150],v:.55,att:.18},
    moan2:{d:2,f:52+R()*20,k:[.9,1.2,.5],n:.1,f1:[300,520],f2:[600,900],v:.5,att:.3},
    scream:{d:.95,f:210,k:[.8,2.4,1.1],n:.45,f1:[700,950],f2:[1500,2100],v:.8,att:.03},
    roar:{d:2.3,f:44,k:[1,1.5,.5],n:.3,f1:[250,450],f2:[500,800],v:1.1,att:.1},
    die:{d:1.1,f:100,k:[1.1,.9,.4],n:.35,f1:[500,300],f2:[1000,600],v:.6,att:.02},
    bite:{d:.32,f:85,k:[1,.8,.5],n:.9,f1:[600,500],f2:[1200,900],v:.7,att:.005}
  }[kind];if(!cfg)return;
  const d=cfg.d,f=cfg.f;zCur++;
  const o=AC.createOscillator(),o2=AC.createOscillator(),sum=AC.createGain(),am=AC.createGain(),env=AC.createGain();
  o.type=o2.type='sawtooth';
  for(const q of[[o,1],[o2,1.03]]){const fr=q[0].frequency;fr.setValueAtTime(f*cfg.k[0]*q[1],t);fr.linearRampToValueAtTime(f*cfg.k[1]*q[1],t+d*.3);fr.linearRampToValueAtTime(f*cfg.k[2]*q[1],t+d);}
  const lf=AC.createOscillator(),lg=AC.createGain();lf.frequency.value=5+R()*3;lg.gain.value=f*.05;lf.connect(lg);lg.connect(o.frequency);lg.connect(o2.frequency);   // getar (vibrato)
  const ao=AC.createOscillator(),ad=AC.createGain();ao.frequency.value=32+R()*28;ad.gain.value=.4;am.gain.value=.6;ao.connect(ad);ad.connect(am.gain);                      // serak (AM growl)
  o.connect(sum);o2.connect(sum);
  const ns=AC.createBufferSource(),nf=AC.createBiquadFilter(),ng=AC.createGain();ns.buffer=NB;ns.loop=true;nf.type='bandpass';nf.frequency.value=900;nf.Q.value=.7;ng.gain.value=cfg.n;ns.connect(nf);nf.connect(ng);ng.connect(sum);
  sum.connect(am);
  const fm=(a,b,q,gn)=>{const fl=AC.createBiquadFilter();fl.type='bandpass';fl.Q.value=q;fl.frequency.setValueAtTime(a,t);fl.frequency.linearRampToValueAtTime(b,t+d);const g=AC.createGain();g.gain.value=gn;am.connect(fl);fl.connect(g);g.connect(env);};
  fm(cfg.f1[0],cfg.f1[1],5,1);fm(cfg.f2[0],cfg.f2[1],6,.7);fm(2500,2300,3,.25);                                                                                         // formant "uuuh-aaah"
  env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(1,t+cfg.att);env.gain.setValueAtTime(1,t+d*.55);env.gain.exponentialRampToValueAtTime(.001,t+d);
  const sh=AC.createWaveShaper();sh.curve=zCurve;sh.oversample='2x';
  const out=AC.createGain();out.gain.value=cfg.v*vol*.9;
  const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=clamp(7000-dist*70,700,7000);                                                                    // jauh = teredam
  const pn=AC.createPanner();pn.panningModel='HRTF';pn.distanceModel='inverse';pn.refDistance=5;pn.rolloffFactor=1.3;pn.maxDistance=160;setPos(pn,x,y,z);
  env.connect(sh);sh.connect(out);out.connect(lp);lp.connect(pn);pn.connect(zBus);
  const end=t+d+.15;[o,o2,lf,ao,ns].forEach(n=>{n.start(t);n.stop(end);});o.onended=()=>zCur--;
}
const zsnd=(kind,e)=>zVoice(kind,e.x,gy(e.x,e.z)+2.5,e.z,e.t==='b'?1.25:1);
function zAmb(e,pd,dt){
  if(!AC||pd>55)return;e.gt-=dt;
  if(e.gt<=0){e.gt=(e.t==='b'?rnd(3.5,6):rnd(2.5,6.5))*(pd<14?.55:1);zsnd(e.t==='b'?'roar':Math.random()<.25?'moan2':'groan',e);}
}
const eyeMat=new THREE.MeshBasicMaterial({color:0xff2a1a});
function eyes(m){[-.18,.18].forEach(x=>{const e=new THREE.Mesh(new THREE.BoxGeometry(.14,.1,.06),eyeMat);e.position.set(x,3.15,.36);m.add(e);});}   // mata merah menyala
function audioExtra(t){
  const L=AC.listener,fx=cam.mode<2?Math.sin(cam.yaw):0,fz=cam.mode<2?Math.cos(cam.yaw):-1;
  if(L.positionX){L.positionX.value=P.x;L.positionY.value=P.y+3;L.positionZ.value=P.z;L.forwardX.value=fx;L.forwardY.value=0;L.forwardZ.value=fz;L.upX.value=0;L.upY.value=1;L.upZ.value=0;}
  else{L.setPosition(P.x,P.y+3,P.z);L.setOrientation(fx,0,fz,0,1,0);}
  let near=0;for(const e of E)if(!e.dead&&e.t!=='w'&&Math.hypot(e.x-P.x,e.z-P.z)<30)near++;
  const dr=night*.045+Math.min(near,6)*.012;
  aN.d1.gain.setTargetAtTime(dr,t,1.2);aN.d2.gain.setTargetAtTime(dr*.8,t,1.2);aN.d3.gain.setTargetAtTime(dr*.5,t,1.2);
  voices.forEach(v=>{if(!v.pan)return;for(const r of remotes.values())if(r.pid===v.pid){setPos(v.pan,r.x,gy(r.x,r.z)+3,r.z);break;}});
}
setInterval(()=>{ // lolongan/erangan zombie jauh di malam hari + detak jantung saat HP rendah
  if(!AC||!started)return;
  if(Math.random()<(night>.5?.18:.04)){const a=rnd(0,6.28),d=rnd(60,110);zVoice(Math.random()<.5?'groan':'moan2',P.x+Math.cos(a)*d,P.y+2,P.z+Math.sin(a)*d,.8);}
},1000);
setInterval(()=>{if(AC&&started&&!P.dead&&P.hp<35){tone(55,'sine',.13,.3);setTimeout(()=>tone(48,'sine',.15,.22),190);}},800);
// ================= VOICE CHAT mabar (WebRTC via PeerJS) =================
const voices=new Map(); // peerId -> {call,src,pan,gP,gX,an,buf,speaking}
let outStream=null,micTrack=null,micOn=false,voiceMode=0,vInit=null; // voiceMode 0 = tim (semua dengar), 1 = dekat (3D)
const vui=mkEl('div',`position:fixed;left:14px;top:${84+MS+8}px;display:none;gap:6px;z-index:20;align-items:center;font:700 11px system-ui;color:#fff`);
const vbtn=()=>mkEl('button','width:42px;height:42px;border-radius:12px;color:#fff;border:2px solid rgba(255,255,255,.45);font-size:20px;cursor:pointer;padding:0;touch-action:manipulation',vui);
const bMic=vbtn(),bMode=vbtn(),vst=mkEl('div','text-shadow:1px 1px 3px #000;pointer-events:none',vui);
function updVoiceUI(){
  bMic.textContent=micOn?'🎤':'🔇';bMic.style.background=micOn?'rgba(22,163,74,.8)':'rgba(185,28,28,.75)';bMic.title='Mic on/off (M)';
  bMode.textContent=voiceMode?'📍':'👥';bMode.style.background='rgba(15,23,42,.75)';bMode.title='Suara tim / dekat (B)';
  vst.textContent='🎧 '+voices.size+' teman · '+(voiceMode?'dekat':'tim');
}
function initVoice(){return vInit||(vInit=(async()=>{
  audioInit();let mic=null;
  try{mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});}catch(e){}
  if(mic){outStream=mic;micTrack=mic.getAudioTracks()[0];micOn=true;toast('🎤 Mic aktif — tekan M untuk mute');}
  else{outStream=AC?AC.createMediaStreamDestination().stream:new MediaStream();micOn=false;toast('🎤 Mic tidak aktif (izin ditolak / butuh HTTPS) — kamu tetap bisa mendengar teman');}
  updVoiceUI();
})());}
async function toggleMic(){
  if(!outStream)await initVoice();
  if(!micTrack){
    try{
      const m=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      micTrack=m.getAudioTracks()[0];micOn=true;outStream=m;
      voices.forEach(v=>{const s=v.call?.peerConnection?.getSenders?.().find(s=>s.track&&s.track.kind==='audio');if(s)s.replaceTrack(micTrack);});
      toast('🎤 Mic aktif');
    }catch(e){toast('🎤 Mic ditolak / tidak tersedia (butuh HTTPS)');}
    updVoiceUI();return;
  }
  micOn=!micOn;micTrack.enabled=micOn;toast(micOn?'🎤 Mic ON':'🔇 Mic OFF');updVoiceUI();
}
const applyVoiceMode=v=>{if(!v.gP)return;v.gP.gain.value=voiceMode?0:1;v.gX.gain.value=voiceMode?1:0;};
function toggleVoiceMode(){voiceMode=1-voiceMode;voices.forEach(applyVoiceMode);toast(voiceMode?'📍 Suara DEKAT (3D, makin jauh makin pelan)':'👥 Suara TIM (semua saling dengar)');updVoiceUI();}
bMic.onclick=toggleMic;bMode.onclick=toggleVoiceMode;
addEventListener('keydown',e=>{if(!started||e.target.tagName==='INPUT')return;if(e.code==='KeyM')toggleMic();if(e.code==='KeyB')toggleVoiceMode();});
function voiceAttach(v,stream){
  if(v.src)return;audioInit();if(!AC)return;AC.resume?.();
  const el=new Audio();el.srcObject=stream;el.muted=true;el.play?.().catch(()=>{});v.el=el; // agar Chrome mengalirkan stream ke WebAudio
  const src=AC.createMediaStreamSource(stream),an=AC.createAnalyser(),gP=AC.createGain(),gX=AC.createGain(),pan=AC.createPanner();
  an.fftSize=256;pan.panningModel='HRTF';pan.distanceModel='inverse';pan.refDistance=18;pan.rolloffFactor=1.1;pan.maxDistance=400;
  src.connect(an);src.connect(gP);gP.connect(AC.destination);src.connect(pan);pan.connect(gX);gX.connect(AC.destination);
  Object.assign(v,{src,an,gP,gX,pan,buf:new Uint8Array(an.fftSize)});applyVoiceMode(v);updVoiceUI();
}
function voiceSetup(call,pid){
  const v={call,pid,speaking:false};voices.set(pid,v);
  call.on('stream',s=>voiceAttach(v,s));
  const drop=()=>{if(voices.get(pid)!==v)return;voices.delete(pid);try{v.src&&v.src.disconnect();}catch(e){}if(v.el)v.el.srcObject=null;updVoiceUI();};
  call.on('close',drop);call.on('error',drop);updVoiceUI();
}
function voiceLink(pid){ // dipanggil tiap ada data pemain lain; yang id-nya lebih kecil menelepon (hindari dobel panggilan)
  if(!peer||!peer.open||!pid||pid===peer.id||voices.has(pid)||!outStream)return;
  if(peer.id<pid){const call=peer.call(pid,outStream);if(call)voiceSetup(call,pid);}
}
function micSprite(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.font='44px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('🎙',32,34);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));s.scale.set(1.6,1.6,1);s.position.y=4.6;s.visible=false;return s;
}
setInterval(()=>{ // deteksi siapa yang sedang bicara -> ikon mic di atas kepala
  voices.forEach(v=>{
    if(!v.an)return;v.an.getByteTimeDomainData(v.buf);let s=0;for(let i=0;i<v.buf.length;i++){const q=(v.buf[i]-128)/128;s+=q*q;}
    v.speaking=Math.sqrt(s/v.buf.length)>.03;for(const r of remotes.values())if(r.pid===v.pid&&r.mk)r.mk.visible=v.speaking;
  });
},120);
// ================= PEMANDANGAN (v3): bintang, matahari/bulan, awan, burung, kunang-kunang =================
const glow=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),gr=g.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.4,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);})();
const stars=(()=>{
  const n=1500,p=new Float32Array(n*3);for(let i=0;i<n;i++){const th=wr()*6.2832,ph=Math.acos(.05+wr()*.95),rr=430;p[i*3]=Math.sin(ph)*Math.cos(th)*rr;p[i*3+1]=Math.cos(ph)*rr;p[i*3+2]=Math.sin(ph)*Math.sin(th)*rr;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const s=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2.6,sizeAttenuation:false,map:glow,transparent:true,opacity:0,depthWrite:false,fog:false}));s.frustumCulled=false;scene.add(s);return s;
})();
const sunD=new THREE.Mesh(new THREE.SphereGeometry(15,16,12),new THREE.MeshBasicMaterial({color:0xfff1b8,fog:false})),moonD=new THREE.Mesh(new THREE.SphereGeometry(10,16,12),new THREE.MeshBasicMaterial({color:0xe6eeff,fog:false})),
  sunH=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xffd27a,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
sunH.scale.set(150,150,1);scene.add(sunD,moonD,sunH);
const CLD=[];for(let k=0;k<34;k++){const c={x:wrnd(-460,460),y:wrnd(75,115),z:wrnd(-460,460),sp:wrnd(1.2,3),p:[]},n=3+Math.floor(wr()*4);for(let q=0;q<n;q++)c.p.push([wrnd(-15,15),wrnd(-1.5,1.5),wrnd(-8,8),wrnd(11,24),wrnd(4,7),wrnd(9,16)]);CLD.push(c);}
const cMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.92,fog:false,depthWrite:false}),cloudM=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),cMat,CLD.reduce((a,c)=>a+c.p.length,0)),_o=new THREE.Object3D();
cloudM.frustumCulled=false;scene.add(cloudM);
const birds=[];{
  const bm=new THREE.MeshBasicMaterial({color:0x1b1b22,side:THREE.DoubleSide}),wg=new THREE.BoxGeometry(1.5,.07,.6),bg=new THREE.BoxGeometry(.35,.3,.9);
  for(let k=0;k<14;k++){const g=new THREE.Group(),l=new THREE.Group(),r=new THREE.Group(),a=new THREE.Mesh(wg,bm),b=new THREE.Mesh(wg,bm);a.position.x=-.75;b.position.x=.75;l.add(a);r.add(b);g.add(new THREE.Mesh(bg,bm),l,r);g.scale.setScalar(1.5);scene.add(g);
    birds.push({g,l,r,a:wrnd(0,6.28),R:wrnd(30,90),h:wrnd(18,46),sp:wrnd(.12,.3)*(wr()<.5?1:-1),ph:wrnd(0,6),cx:0,cz:0});}
}
const FF=150,ffp=new Float32Array(FF*3),ffg=new THREE.BufferGeometry(),ffm=new THREE.PointsMaterial({color:0xd6ff6a,size:6,sizeAttenuation:false,map:glow,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
for(let i=0;i<FF;i++){ffp[i*3]=rnd(-45,45);ffp[i*3+1]=2;ffp[i*3+2]=rnd(-45,45);}
ffg.setAttribute('position',new THREE.BufferAttribute(ffp,3));const fireflies=new THREE.Points(ffg,ffm);fireflies.frustumCulled=false;scene.add(fireflies);
function areaName(){
  const t=towns.find(t=>Math.hypot(t.x-P.x,t.z-P.z)<32);if(t)return'🏘 '+t.n;
  if(Math.hypot(P.x,P.z)<70)return'🌆 Kota Neon';
  if(ruins.some(r=>Math.hypot(r.x-P.x,r.z-P.z)<22))return'🏛 Reruntuhan Kuno — waspada, banyak peti!';
  const i=gi(P.x),j=gi(P.z),h=H[i][j];
  if(h<=1)return'🌊 Perairan';if(h>=9)return'⛰ Pegunungan';
  return['🌲 Hutan & Padang Bunga','🏜 Gurun Pasir','❄ Tundra Salju'][BM[i][j]];
}
let tt=0,areaT=0,areaLast='';
function sceneryTick(dt){
  tt+=dt;const cp=camera.position;
  // bintang, matahari, bulan
  stars.position.copy(cp);stars.material.opacity=clamp(night*1.3-wx.v*.6,0,1)*.9;stars.visible=stars.material.opacity>.02;
  const ang=T*Math.PI*2,dx=Math.cos(ang),dy=Math.sin(ang),dl=Math.hypot(dx,dy,.25),ux=dx/dl*380,uy=dy/dl*380,uz=.25/dl*380;
  sunD.position.set(cp.x+ux,cp.y+uy,cp.z+uz);moonD.position.set(cp.x-ux,cp.y-uy,cp.z-uz);sunH.position.copy(sunD.position);
  sunD.material.color.setHex(dy<.3?0xffb070:0xfff1b8);sunH.material.color.setHex(dy<.3?0xff8a3a:0xffe9a0);
  sunD.visible=sunH.visible=dy>-.08&&wx.v<.75;moonD.visible=-dy>-.08&&wx.v<.75;
  // awan
  let ci=0;for(const c of CLD){c.x+=c.sp*dt;while(c.x-cp.x>470)c.x-=940;while(c.x-cp.x<-470)c.x+=940;while(c.z-cp.z>470)c.z-=940;while(c.z-cp.z<-470)c.z+=940;for(const p of c.p){_o.position.set(c.x+p[0],c.y+p[1],c.z+p[2]);_o.scale.set(p[3],p[4],p[5]);_o.updateMatrix();cloudM.setMatrixAt(ci++,_o.matrix);}}
  cloudM.instanceMatrix.needsUpdate=true;
  const cb=(1-night*.82)*(1-wx.v*.45);cMat.color.setRGB(cb*(1-night*.1),cb*(1-night*.05),Math.min(1,cb*(1+night*.3)));
  // burung (siang & cerah)
  const bv=night<.5&&wx.v<.5;
  for(const b of birds){b.g.visible=bv;if(!bv)continue;
    b.a+=b.sp*dt;b.cx+=(P.x-b.cx)*Math.min(1,dt*.15);b.cz+=(P.z-b.cz)*Math.min(1,dt*.15);
    const sg=Math.sign(b.sp);b.g.position.set(b.cx+Math.cos(b.a)*b.R,P.y+b.h+Math.sin(tt*.5+b.ph)*2,b.cz+Math.sin(b.a)*b.R);
    b.g.rotation.y=Math.atan2(-Math.sin(b.a)*sg,Math.cos(b.a)*sg);b.l.rotation.z=Math.sin(tt*8+b.ph)*.6;b.r.rotation.z=-b.l.rotation.z;}
  // kunang-kunang (malam)
  const fo=clamp(night*1.4-wx.v*.8-.2,0,1);ffm.opacity=fo*.95;fireflies.visible=fo>.02;
  if(fo>.02){for(let i=0;i<FF;i++){let x=ffp[i*3],z=ffp[i*3+2];x+=Math.sin(tt*.7+i)*dt*1.5;z+=Math.cos(tt*.6+i*1.7)*dt*1.5;
    if(x>P.x+48)x-=96;else if(x<P.x-48)x+=96;if(z>P.z+48)z-=96;else if(z<P.z-48)z+=96;
    ffp[i*3]=x;ffp[i*3+2]=z;ffp[i*3+1]=gy(x,z)+1.2+Math.sin(tt*1.1+i*2.3)*.7;}ffg.attributes.position.needsUpdate=true;}
  // nama wilayah
  areaT-=dt;if(areaT<=0&&started&&!P.dead){areaT=.6;const a=areaName();if(a!==areaLast){areaLast=a;toast(a);}}
}

let pmRy=0,clock=0;
function nearestE(r,dir){let b=null,bd=r;for(const e of E){if(e.dead)continue;const ax=e.x-P.x,az=e.z-P.z,d=Math.hypot(ax,az)||1;if(d<bd&&(!dir||(ax*dir.x+az*dir.z)/d>.955)){bd=d;b=e;}}return b;}
function update(dt){
  clock+=dt;T+=dt/160;weatherTick(dt);sky();
  const dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x,dz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0)+joy.y,
    dl=Math.hypot(dx,dz),mvg=dl>.12,l=Math.max(1,dl);
  // aim: kamera bahu/FPS pakai yaw, kamera atas pakai mouse (PC) / auto-aim (HP)
  if(cam.mode<2)aim={x:Math.sin(cam.yaw),z:Math.cos(cam.yaw)};
  else if(isTouch){const n=nearestE(26);if(n){const ax=n.x-P.x,az=n.z-P.z,al=Math.hypot(ax,az)||1;aim={x:ax/al,z:az/al};}else if(mvg)aim={x:dx/l,z:dz/l};}
  else{rc.setFromCamera(mouse,camera);if(rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-(P.y+1.5)),hitP)){const ax=hitP.x-P.x,az=hitP.z-P.z,al=Math.hypot(ax,az);if(al>.3)aim={x:ax/al,z:az/al};}}
  if(isTouch&&cam.mode<2){const n=nearestE(30,aim);if(n){const ax=n.x-P.x,az=n.z-P.z,al=Math.hypot(ax,az)||1,bx=aim.x*.35+ax/al*.65,bz=aim.z*.35+az/al*.65,bl=Math.hypot(bx,bz)||1;aim={x:bx/bl,z:bz/bl};}}
  let spr=false;
  if(!P.dead){
    P.atk-=dt;P.cd-=dt;P.sw-=dt;P.slowT=Math.max(0,(P.slowT||0)-dt);P.fl=Math.max(0,P.fl-dt*3);P.shield=Math.max(0,P.shield-dt*3);
    if(P.rl>0){P.rl-=dt;if(P.rl<=0){const n=Math.min(12-P.mag,P.res);P.mag+=n;P.res-=n;}}
    if(started&&mouse.down&&!P.car)attack();
    if(P.car)driveCar(P.car,dt,dx,dz);
    else{
      spr=mvg&&(keys.ShiftLeft||Math.hypot(joy.x,joy.y)>.92)&&P.st>0&&P.rest<=0;
      if(spr){P.st=Math.max(0,P.st-14*dt);if(P.st<=0)P.rest=1;}else P.st=Math.min(150,P.st+(mvg?20:34)*dt);
      P.rest=Math.max(0,P.rest-dt);
      const water=H[gi(P.x)][gi(P.z)]<=1&&!road(gi(P.x),gi(P.z));
      const spd=(spr?15:8)*(water?.6:1)*(P.slowT>0?.6:1);
      let mx=dx/l,mz=dz/l;
      if(cam.mode<2){const s=Math.sin(cam.yaw),c=Math.cos(cam.yaw);mx=(-dz*s-dx*c)/l;mz=(-dz*c+dx*s)/l;}
      const ac=Math.min(1,(P.vy===0?12:4)*dt);P.vx+=(mx*spd-P.vx)*ac;P.vz+=(mz*spd-P.vz)*ac;
      mv(P,P.vx*dt,P.vz*dt,.7);mv(P,P.kx*dt,P.kz*dt,.7);const dk=Math.exp(-6*dt);P.kx*=dk;P.kz*=dk;
    }
    P.ry=Math.atan2(aim.x,aim.z);
  }
  // lompat, glider, gravitasi
  const g0=gy(P.x,P.z);
  if(P.car){P.y=g0;P.vy=0;}
  else{
    if(!P.dead&&keys.Space&&P.vy===0&&Math.abs(P.y-g0)<.6){P.vy=11;sfx('jump');}
    if(P.vy!==0||P.y>g0+.35){
      P.vy-=30*dt;P.glide=!P.dead&&!!keys.Space&&P.vy<-2;if(P.glide)P.vy=-2.4;
      P.y+=P.vy*dt;if(P.y<=g0){P.y=g0;P.vy=0;P.glide=false;}
    }else P.y+=(g0-P.y)*Math.min(1,dt*14);
  }
  // badan: rotasi halus + animasi
  const spv=Math.hypot(P.vx,P.vz);
  let face=P.ry;if(cam.mode===0&&!cam.ads&&P.atk<=0&&spv>1.2)face=Math.atan2(P.vx,P.vz);
  if(P.car)pmRy=P.car.ry;else{const da=Math.atan2(Math.sin(face-pmRy),Math.cos(face-pmRy));pmRy+=da*Math.min(1,dt*14);}
  pm.position.set(P.x,P.y+(P.vy===0?Math.abs(Math.sin(clock*12))*.12*Math.min(1,spv/8):0),P.z);pm.rotation.y=pmRy;pm.visible=!P.dead&&!P.car&&cam.mode!==1;
  const wk=spv>1?Math.sin(clock*(spr?18:12))*.8*Math.min(1,spv/8):0,pu=pm.userData;
  pu.legL.rotation.x=wk;pu.legR.rotation.x=-wk;
  pu.armL.rotation.x=P.w===1?-1.2:-wk;pu.armR.rotation.x=P.w===1?-1.3:(P.sw>0?-1.5:wk);
  pu.armL.rotation.z=P.glide?.9:0;pu.armR.rotation.z=P.glide?-.9:0;
  swordP.visible=P.w===0;gunP.visible=P.w===1;
  swordP.rotation.y=P.sw>0?1.3-2.6*(1-P.sw/.25):.3;
  shieldM.visible=P.shield>0;shieldM.position.set(P.x,P.y+2,P.z);
  allyTick(dt);worldTick(dt);rainTick(dt);audioTick();
  // enemies
  for(const e of E){
    if(e.dead)continue;
    const pd=Math.hypot(P.x-e.x,P.z-e.z)||1,slow=e.slow>0?.4:1,u=e.m.userData;
    e.slow-=dt;e.cd-=dt;e.alert-=dt;e.fl-=dt;
    if(e.burn>0){e.burn-=dt;e.hp-=1.5*dt;e.fl=.1;if(e.hp<=0){kill(e);continue;}}
    if(e.t!=='w')zAmb(e,pd,dt);let vx=0,vz=0;
    if(e.t==='w'){
      if(pd<10){vx=(e.x-P.x)/pd;vz=(e.z-P.z)/pd;}
      else{if(Math.hypot(e.tx-e.x,e.tz-e.z)<1||Math.random()<.01){e.tx=e.x+rnd(-12,12);e.tz=e.z+rnd(-12,12);}
        const q=Math.hypot(e.tx-e.x,e.tz-e.z)||1;vx=(e.tx-e.x)/q*.4;vz=(e.tz-e.z)/q*.4;}
      mv(e,vx*e.sp*(pd<10?2.2:1)*slow*dt,vz*e.sp*(pd<10?2.2:1)*slow*dt,.6);
    }else if(!P.dead&&(pd<(night>.4?70:50)||e.alert>0||e.aggro)){
      if(!e.aggro){e.aggro=1;zsnd(e.t==='b'?'roar':'scream',e);E.forEach(o=>{if(!o.dead&&o.t!=='w'&&!o.aggro&&Math.hypot(o.x-e.x,o.z-e.z)<24)o.alert=Math.max(o.alert,10);});} // teriakan memanggil zombie lain
      vx=(P.x-e.x)/pd;vz=(P.z-e.z)/pd;
      const spd=e.sp*(1+night*.25)*slow*(e.t==='r'&&pd<16?1.2:1),ox=e.x,oz=e.z;
      mv(e,vx*spd*dt,vz*spd*dt,.6);
      if(Math.hypot(e.x-ox,e.z-oz)<spd*dt*.4){e.sd=e.sd||(Math.random()<.5?1:-1);mv(e,-vz*e.sd*spd*dt,vx*e.sd*spd*dt,.6);}else if(Math.random()<.01)e.sd=0; // memutar kalau tersangkut tembok
      if(pd<e.r+1.4&&e.cd<=0){
        e.cd=e.acd;hurt(e.dmg*(1+night*.25));P.slowT=.7;zsnd('bite',e);
        const kn=e.t==='b'?24:e.t==='k'?20:5;P.kx+=vx*kn;P.kz+=vz*kn;cam.shake=Math.max(cam.shake,e.t==='b'||e.t==='k'?.5:.25);
      }
    }
    mv(e,e.kx*dt,e.kz*dt,.6);const k=Math.exp(-5*dt);e.kx*=k;e.kz*=k;
    e.m.position.x=e.x;e.m.position.z=e.z;e.m.position.y+=(gy(e.x,e.z)-e.m.position.y)*Math.min(1,dt*12);
    if(vx||vz)e.m.rotation.y=Math.atan2(vx,vz);
    const s=Math.sin(clock*(e.t==='r'?14:8)+e.ph)*.7*(vx||vz?1:0);u.legL.rotation.x=s;u.legR.rotation.x=-s;
    if(e.t!=='w'){u.armL.rotation.x=-1.4+Math.sin(clock*6+e.ph)*.14;u.armR.rotation.x=-1.4+Math.sin(clock*6+e.ph+1.7)*.14;}
    const em=e.fl>0?(e.burn>0?0xff6600:0xff2200):e.slow>0?0x1166ff:0;e.mats.forEach(m=>m.emissive.setHex(em));
  }
  E=E.filter(e=>!e.dead);
  // mayat jatuh & partikel darah
  for(let i=CORPSES.length-1;i>=0;i--){const c=CORPSES[i];c.t+=dt;const f=Math.min(1,c.t/.35);c.m.rotation.z=c.dir*f*1.5;c.m.position.y=c.y0+f*.25-(c.t>6?(c.t-6)*1.2:0);if(c.t>8){scene.remove(c.m);CORPSES.splice(i,1);}}
  for(let i=BP.length-1;i>=0;i--){const p=BP[i],q=p.m.position;p.l-=dt;p.vy-=28*dt;q.x+=p.vx*dt;q.y+=p.vy*dt;q.z+=p.vz*dt;if(p.l<=0||q.y<gy(q.x,q.z)){scene.remove(p.m);BP.splice(i,1);}}
  // bullets (3D + sub-step supaya tidak tembus musuh)
  for(let i=B.length-1;i>=0;i--){
    const b=B[i],q=b.m.position,by=b.vy||0,sub=Math.max(1,Math.ceil(Math.hypot(b.vx,by,b.vz)*dt/1.1)),sd=dt/sub;let dead=false;
    b.life-=dt;if(b.life<=0)dead=true;
    for(let s=0;s<sub&&!dead;s++){
      q.x+=b.vx*sd;q.y+=by*sd;q.z+=b.vz*sd;
      if(!b.vis){
        for(const e of E){
          if(e.dead||!hitE(e,q.x,q.y,q.z,.5))continue;
          const head=!b.own&&e.t!=='w'&&q.y>e.m.position.y+3*(e.sc||1); // headshot = damage 2x
          bloodBurst(q.x,q.y,q.z,head?9:3);dmg(e,b.own?1.5:head?4:2,b.vx*.08,b.vz*.08);if(!b.own)hitMark(head);dead=true;break;
        }
        if(!dead)for(const p of PROPS){if(Math.abs(p.x-q.x)<1.3&&Math.abs(p.z-q.z)<1.3&&Math.abs(q.y-gy(p.x,p.z)-1)<1.6){hitProp(p,1);dead=true;break;}}
        if(!dead&&!b.own)remotes.forEach((r,id)=>{if(!dead&&Math.hypot(r.x-q.x,r.z-q.z)<1&&Math.abs(q.y-gy(r.x,r.z)-2)<2.2){net({t:'h',to:id,dmg:7});dead=true;}});
      }
      if(!dead&&gy(q.x,q.z)>q.y){dead=true;if(!b.vis)bloodBurst(q.x,q.y,q.z,2,dustM,.4);}
    }
    if(dead){scene.remove(b.m);B.splice(i,1);}
  }
  for(let i=PICKUPS.length-1;i>=0;i--){const k=PICKUPS[i];k.mesh.rotation.y+=dt*3;k.mesh.position.y=gy(k.x,k.z)+1+Math.sin(clock*3+i)*.25;
    if(!P.dead&&Math.hypot(k.x-P.x,k.z-P.z)<2){if(k.type==='heal')P.hp=Math.min(100,P.hp+30);else if(k.type==='ammo')P.res+=12;else P.st=150;sfx('pick');scene.remove(k.mesh);PICKUPS.splice(i,1);}}
  // fx
  for(let i=FX.length-1;i>=0;i--){
    const f=FX[i];f.t+=dt/.5;f.m.scale.setScalar(1+f.t*f.r);f.m.material.opacity=.9*(1-f.t);
    if(f.t>=1){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();FX.splice(i,1);}
  }
  // remotes
  const now=performance.now();
  remotes.forEach((r,id)=>{
    if(now-r.last>2500){scene.remove(r.m);remotes.delete(id);return;}
    r.x+=(r.tx-r.x)*.25;r.z+=(r.tz-r.z)*.25;r.m.position.set(r.x,gy(r.x,r.z),r.z);r.m.rotation.y=r.try;
  });
  sendT-=dt;if(sendT<=0){sendT=.1;net({t:'s',id:ID,pid:peer&&peer.id,x:P.x,z:P.z,ry:pmRy,el:P.sig});}
  // camera: 0 bahu (Free Fire), 1 FPS (BLACK), 2 atas klasik
  const car=P.car,fov=cam.ads?36:car?62:cam.mode===2?50:(P.vx*P.vx+P.vz*P.vz>150?64:54);
  camera.fov+=(fov-camera.fov)*Math.min(1,dt*8);camera.updateProjectionMatrix();
  cam.kick*=Math.exp(-9*dt);
  if(car&&cam.mode<2&&Math.abs(car.v)>2){let d=car.ry-cam.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));cam.yaw+=d*Math.min(1,dt*2.2);}
  if(cam.mode===0){
    const fx=Math.sin(cam.yaw),fz=Math.cos(cam.yaw),rx=-fz,rz=fx;
    const dist=cam.ads?2.8:car?10:6.5,sh=cam.ads?1.1:car?0:1.6,hg=(cam.ads?3.1:3.8)+(car?2.5:0)-cam.pitch*3;
    let k=1,tx,tz;do{tx=P.x-fx*dist*k+rx*sh;tz=P.z-fz*dist*k+rz*sh;k-=.15;}while(k>.3&&blocked(tx,tz,.5));
    const ty=Math.max(P.y+hg,gy(tx,tz)+1.8),a=Math.min(1,dt*12);
    camera.position.x+=(tx-camera.position.x)*a;camera.position.y+=(ty-camera.position.y)*a;camera.position.z+=(tz-camera.position.z)*a;
    camera.lookAt(P.x+fx*14,P.y+3+cam.pitch*14+cam.kick*2,P.z+fz*14);
  }else if(cam.mode===1){
    const sp2=Math.hypot(P.vx,P.vz);cam.bob+=dt*sp2*1.3;const bob=sp2>1&&P.vy===0?Math.sin(cam.bob)*.09:0;
    camera.position.set(P.x,P.y+3.4+bob+(car?2:0),P.z);
    camera.rotation.order='YXZ';camera.rotation.set(cam.pitch+cam.kick*.05,cam.yaw+Math.PI,Math.sin(cam.bob*.5)*.01*Math.min(1,sp2/8));
  }else{
    const hh=34+(P.y/S)*2.6;camera._h=(camera._h||hh)+(hh-camera._h||0)*Math.min(1,dt*2.5);
    const h2=camera._h;camera.position.set(P.x,P.y+h2,P.z+h2*.62);camera.lookAt(P.x,P.y+1,P.z);
  }
  if(cam.shake>0){camera.position.x+=rnd(-1,1)*cam.shake;camera.position.y+=rnd(-1,1)*cam.shake;cam.shake=Math.max(0,cam.shake-dt*1.2);}
  vmGrp.visible=cam.mode===1&&!P.car&&!P.dead;vg.visible=P.w===1;vs.visible=P.w===0;
  vmGrp.position.set(.32+Math.sin(cam.bob)*.012,-.3+Math.abs(Math.sin(cam.bob))*.01,-.7+cam.kick*.25);vs.rotation.z=P.sw>0?-1.2*(P.sw/.25):0;
  // HUD
  $('hpTxt').textContent=Math.max(0,Math.ceil(P.hp));$('stTxt').textContent=Math.ceil(P.st);$('hp').firstChild.style.width=Math.max(0,P.hp)+'%';$('st').firstChild.style.width=P.st/1.5+'%';
  $('wp').textContent=P.w===0?'⚔ PEDANG':'🔫 SENJATA '+(P.rl>0?'(reload...)':P.mag+' / '+P.res);
  const el=EL[P.el];$('el').innerHTML='<span style="color:#'+el.c.toString(16).padStart(6,'0')+'">'+el.n.toUpperCase()+(P.el===P.sig?' ★':'')+'</span> '+(P.cd>0?P.cd.toFixed(1)+'s':'SIAP [E]');
  $('kl').textContent='Kills: '+P.kills+' · Lv.'+P.level;
  const bs=E.find(e=>e.t==='b');$('boss').style.display=bs?'block':'none';if(bs)$('bb').firstChild.style.width=bs.hp/bs.max*100+'%';
  $('hurt').style.opacity=P.fl*.45;hudX();
}

let prev=performance.now();
function loop(t){
  const dt=Math.min((t-prev)/1000,.05);prev=t;
  update(dt);sceneryTick(dt);chunkVis();renderer.render(scene,camera);requestAnimationFrame(loop);
}
sky();requestAnimationFrame(loop);


// ================= SQUAD MERAH TERSEBAR RAPI, ZOMBIE KUNING/BIRU, HD FX & NINJA DASH (v4.5) =================
{
  P.dashCharges = 2;
  P.dashMax = 2;
  P.dashRegen = 0;
  P.invul = 0;
  const dashGhosts = [];
  const hdOrbs = [];

  // 1. Efek Elemen HD (Cincin Ganda Halus + Pilar Cahaya + Partikel Berkilau)
  function hdElementFX(x, z, color, radius) {
    const y = gy(x, z);

    ring(x, z, color, radius);

    const r2 = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.75, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        side: 2,
        opacity: 0.95,
        depthTest: false,
        blending: THREE.AdditiveBlending
      })
    );
    r2.rotation.x = -Math.PI / 2;
    r2.position.set(x, y + 0.45, z);
    scene.add(r2);
    FX.push({ m: r2, r: radius * 0.85, t: 0 });

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.35, 11, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        side: 2,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    beam.position.set(x, y + 5.5, z);
    scene.add(beam);
    hdOrbs.push({ m: beam, vx: 0, vy: 2.5, vz: 0, life: 0.48, maxLife: 0.48, isBeam: true });

    const pGeo = new THREE.OctahedronGeometry(0.24, 0);
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + rnd(-0.2, 0.2);
      const spd = rnd(radius * 0.6, radius * 1.4);
      const pMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffffff : color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      const pm2 = new THREE.Mesh(pGeo, pMat);
      pm2.position.set(x, y + rnd(0.6, 2.2), z);
      scene.add(pm2);
      hdOrbs.push({
        m: pm2,
        vx: Math.cos(ang) * spd,
        vy: rnd(4, 11),
        vz: Math.sin(ang) * spd,
        life: rnd(0.45, 0.75),
        maxLife: 0.75,
        isBeam: false
      });
    }
  }

  const origSkill = skill;
  skill = function () {
    const canCast = P.cd <= 0 && !P.dead;
    const c = EL[P.el].c;
    const rad = [9, 11, 7, 6][P.el];
    origSkill();
    if (canCast) hdElementFX(P.x, P.z, c, rad);
  };

  // 2. Warna Zombie Kuning & Monster Agak Kebiruan
  const origMkEnemy = mkEnemy;
  mkEnemy = function (t, x, z) {
    origMkEnemy(t, x, z);
    const e = E[E.length - 1];
    if (t === 'w') return;
    const enemyCol = (t === 'k' || t === 'b') ? 0x2563eb : 0xfacc15;
    e.m.userData.mat.color.setHex(enemyCol);
  };

  // 3. Ninja Dash (Z / Ctrl / tombol DASH HP)
  function spawnDashGhost() {
    const g = human(EL[P.el].c);
    g.position.copy(pm.position);
    g.rotation.y = pmRy;
    g.traverse(o => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.55;
      }
    });
    scene.add(g);
    dashGhosts.push({ m: g, life: 0.35 });
  }

  function ninjaDash() {
    if (!started || P.dead || P.car || P.dashCharges <= 0) return;
    P.dashCharges--;
    P.invul = 0.32;
    sfx('slash');
    cam.shake = Math.max(cam.shake, 0.16);

    let dx = aim.x, dz = aim.z;
    const ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    const iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
    if (Math.hypot(ix, iz) > 0.15) {
      const l = Math.hypot(ix, iz);
      if (cam.mode < 2) {
        const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
        dx = (-iz * s - ix * c) / l;
        dz = (-iz * c + ix * s) / l;
      } else {
        dx = ix / l; dz = iz / l;
      }
    }

    hdElementFX(P.x, P.z, EL[P.el].c, 3.6);
    const hitSet = new Set();
    for (let step = 0; step < 4; step++) {
      spawnDashGhost();
      mv(P, dx * 3.8, dz * 3.8, 0.7);
      for (const e of E) {
        if (!e.dead && !hitSet.has(e) && Math.hypot(e.x - P.x, e.z - P.z) < e.r + 2.4) {
          hitSet.add(e);
          dmg(e, 2.5 * P.pw[P.el], dx * 16, dz * 16);
          if (P.el === 0) e.burn = 3;
          if (P.el === 1) e.slow = 3;
        }
      }
    }
    P.kx = dx * 22;
    P.kz = dz * 22;
    hdElementFX(P.x, P.z, EL[P.el].c, 4.8);
  }

  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyZ' || e.code === 'ControlLeft') ninjaDash();
  });

  let dashBtn = null;
  if (isTouch && TL) {
    dashBtn = TL.mb('⚡\nDASH', TL.R(138) + TL.Bt(112) + 'width:56px;height:56px;background:rgba(14,165,233,.8);', ninjaDash);
  }

  // 4. Teman Merah & 4 Pengawal Elit Merah Kehitaman (Berjarak Lega & Tersebar)
  const origMkAlly = mkAlly;
  mkAlly = function (i, eliteSlot = -1) {
    origMkAlly(i);
    const a = allies[allies.length - 1];
    a.el = i % 4;
    a.elite = eliteSlot;
    a.slotAng = rnd(0, Math.PI * 2);
    a.slotRad = rnd(9.5, 17.5);
    a.max = eliteSlot >= 0 ? 280 : 140;
    a.hp = a.max;
    a.scd = eliteSlot >= 0 ? 0.9 : rnd(1.2, 2.6);

    // Posisi awal disebar melingkar agar tidak menumpuk
    const initAng = eliteSlot >= 0 ? (eliteSlot * Math.PI) / 2 + 0.5 : a.slotAng;
    const initDist = eliteSlot >= 0 ? 7.0 : a.slotRad;
    a.x = clamp(P.x + Math.cos(initAng) * initDist, -W, W);
    a.z = clamp(P.z + Math.sin(initAng) * initDist, -W, W);
    a.m.position.set(a.x, gy(a.x, a.z), a.z);

    a.m.userData.mat.color.setHex(eliteSlot >= 0 ? 0x3b0a0a : 0xdc2626);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(eliteSlot >= 0 ? 0.34 : 0.26, 1),
      new THREE.MeshBasicMaterial({ color: EL[a.el].c })
    );
    orb.position.set(-0.7, 3.0, 0);
    a.m.add(orb);

    if (eliteSlot >= 0) {
      a.m.scale.setScalar(1.1);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.45, 0.07, 12, 28),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, 3.85, 0);
      a.m.add(halo);
    }
  };

  recruit = function () {
    if (P.coins < 2) { toast('Butuh 2 koin untuk rekrut teman'); return; }
    if (allies.length >= 28) { toast('Pasukan sudah penuh (Maks 28)'); return; }
    P.coins -= 2;
    mkAlly(allies.length, -1);
    saveProgress();
    toast('🛡️ Teman Merah (' + EL[allies[allies.length - 1].el].n + ') bergabung! (' + allies.length + '/28)');
  };

  document.querySelectorAll('.el-btn[data-e]').forEach(b =>
    b.addEventListener('click', () => {
      for (let slot = 0; slot < 4; slot++) {
        if (!allies.some(a => a.elite === slot)) mkAlly(slot, slot);
      }
      while (allies.length < 14) mkAlly(allies.length, -1);
    })
  );

  const origHurt = hurt;
  hurt = function (n) {
    if (P.invul > 0) return;
    origHurt(n);
    if (isTouch) buzz(40);
    for (const e of E) {
      if (!e.dead && e.t !== 'w' && Math.hypot(e.x - P.x, e.z - P.z) < 26) {
        e.alert = 12;
      }
    }
  };

  const origUpdate = update;
  update = function (dt) {
    origUpdate(dt);

    if (P.invul > 0) P.invul = Math.max(0, P.invul - dt);
    if (P.dashCharges < P.dashMax) {
      P.dashRegen += dt;
      if (P.dashRegen >= 2.2) {
        P.dashRegen = 0;
        P.dashCharges++;
      }
    }

    for (let i = dashGhosts.length - 1; i >= 0; i--) {
      const g = dashGhosts[i];
      g.life -= dt;
      g.m.traverse(o => { if (o.isMesh && o.material) o.material.opacity = Math.max(0, g.life * 1.5); });
      if (g.life <= 0) {
        scene.remove(g.m);
        dashGhosts.splice(i, 1);
      }
    }

    for (let i = hdOrbs.length - 1; i >= 0; i--) {
      const h = hdOrbs[i];
      h.life -= dt;
      const ratio = Math.max(0, h.life / h.maxLife);
      if (h.isBeam) {
        h.m.scale.set(1 + (1 - ratio) * 0.6, 1, 1 + (1 - ratio) * 0.6);
        h.m.material.opacity = ratio * 0.55;
      } else {
        h.vy -= 18 * dt;
        h.m.position.x += h.vx * dt;
        h.m.position.y += h.vy * dt;
        h.m.position.z += h.vz * dt;
        h.m.rotation.x += dt * 8;
        h.m.rotation.y += dt * 8;
        h.m.material.opacity = ratio;
        h.m.scale.setScalar(ratio * 1.2);
      }
      if (h.life <= 0) {
        scene.remove(h.m);
        h.m.geometry.dispose();
        h.m.material.dispose();
        hdOrbs.splice(i, 1);
      }
    }

    // 4 Pengawal Elit berjarak lega (6.8 - 7.5m) di sekeliling pemain, tidak menumpuk di layar
    const guardOffsets = [
      { ang: Math.PI * 0.55, dist: 6.8 },  // Kiri samping agak belakang
      { ang: -Math.PI * 0.55, dist: 6.8 }, // Kanan samping agak belakang
      { ang: Math.PI * 0.85, dist: 7.5 },  // Belakang kiri
      { ang: -Math.PI * 0.85, dist: 7.5 }  // Belakang kanan
    ];

    for (let idx = 0; idx < allies.length; idx++) {
      const a = allies[idx];
      if (a.dead > 0) continue;
      const isElite = a.elite >= 0;
      a.hp = Math.min(a.max, a.hp + (isElite ? 7.0 : 2.8) * dt);

      // Tolak-menolak halus antar teman agar tidak saling menumpuk / gerombol rapat
      for (let jdx = 0; jdx < allies.length; jdx++) {
        if (idx === jdx) continue;
        const b = allies[jdx];
        if (b.dead > 0) continue;
        const dxSep = a.x - b.x, dzSep = a.z - b.z;
        const dSep = Math.hypot(dxSep, dzSep);
        const minGap = 3.4;
        if (dSep > 0.001 && dSep < minGap) {
          const push = ((minGap - dSep) / minGap) * 7.5;
          mv(a, (dxSep / dSep) * push * dt, (dzSep / dSep) * push * dt, 0.65);
        }
      }

      // Cari musuh di sekitar teman atau pemain
      let target = null, bestScore = 1e9;
      const scanRange = isElite ? 22 : 28;
      for (const e of E) {
        if (e.dead || e.t === 'w') continue;
        const dAlly = Math.hypot(e.x - a.x, e.z - a.z);
        const dPlayer = Math.hypot(e.x - P.x, e.z - P.z);
        if (dAlly < scanRange || dPlayer < 18) {
          const score = dPlayer * (isElite ? 2.2 : 1.3) + dAlly;
          if (score < bestScore) { bestScore = score; target = e; }
        }
      }

      if (target) {
        const dx = target.x - a.x, dz = target.z - a.z, dl = Math.hypot(dx, dz) || 1;
        const dPlayerToTarget = Math.hypot(target.x - P.x, target.z - P.z);

        if (!isElite || dPlayerToTarget <= 14) {
          const ideal = isElite ? 2.4 : (a.role === 'gun' ? 9.5 : 2.6);
          if (dl > ideal) {
            const chaseSpd = isElite ? 14.5 : 9.5;
            mv(a, (dx / dl) * chaseSpd * dt, (dz / dl) * chaseSpd * dt, 0.7);
          }
        }
        a.m.rotation.y = Math.atan2(dx, dz);

        a.cd = (a.cd || 0) - dt;
        const hitRange = isElite ? target.r + 4.0 : (a.role === 'gun' ? 25 : target.r + 3.2);
        if (a.cd <= 0 && dl < hitRange) {
          a.cd = isElite ? 0.28 : (a.role === 'gun' ? 0.58 : 0.48);
          if (!isElite && a.role === 'gun') {
            const b = new THREE.Mesh(bulletG, bulletM);
            b.position.set(a.x + (dx / dl) * 1.2, a.m.position.y + 2.2, a.z + (dz / dl) * 1.2);
            scene.add(b);
            B.push({ m: b, vx: (dx / dl) * 70, vy: (target.m.position.y + 1.8 - (a.m.position.y + 2.2)) / dl * 70, vz: (dz / dl) * 70, life: 1.2, own: 'a' });
          } else {
            const power = isElite ? 5.2 : 2.8;
            const knock = isElite ? 26 : 15;
            dmg(target, power, (dx / dl) * knock, (dz / dl) * knock);
            ring(a.x, a.z, EL[a.el].c, isElite ? 4.4 : 3.2);
          }
        }
      } else if (isElite) {
        // Berjaga di titik formasi berjarak sekitar pemain saat tidak ada musuh dekat
        const go = guardOffsets[a.elite];
        const worldAng = pmRy + go.ang;
        const gx = P.x + Math.sin(worldAng) * go.dist;
        const gz = P.z + Math.cos(worldAng) * go.dist;
        const dGuard = Math.hypot(gx - a.x, gz - a.z);
        if (dGuard > 22) {
          a.x = gx; a.z = gz;
        } else if (dGuard > 0.8) {
          const pullSpd = dGuard > 9 ? 17 : 9.5;
          mv(a, ((gx - a.x) / dGuard) * pullSpd * dt, ((gz - a.z) / dGuard) * pullSpd * dt, 0.65);
        }
      } else {
        // Teman reguler menyebar di ring luar (10 - 18m) agar tidak gerombol
        const spreadAng = (a.slotAng || 0) + clock * 0.12;
        const spreadDist = a.slotRad || 13;
        const sx = P.x + Math.cos(spreadAng) * spreadDist;
        const sz = P.z + Math.sin(spreadAng) * spreadDist;
        const dSpread = Math.hypot(sx - a.x, sz - a.z);
        if (dSpread > 45) {
          a.x = clamp(sx, -W, W); a.z = clamp(sz, -W, W);
        } else if (dSpread > 1.5) {
          const walkSpd = dSpread > 20 ? 15 : 7.5;
          mv(a, ((sx - a.x) / dSpread) * walkSpd * dt, ((sz - a.z) / dSpread) * walkSpd * dt, 0.65);
        }
      }

      // Jurus elemen HD oleh pasukan & pengawal
      a.scd = (a.scd || 2.0) - dt;
      if (a.scd <= 0 && target) {
        a.scd = isElite ? rnd(2.0, 2.8) : rnd(3.0, 4.4);
        const c = EL[a.el].c;
        const rad = isElite ? 8.5 : 6.5;
        const mult = isElite ? 1.8 : 1.0;
        hdElementFX(a.x, a.z, c, rad);

        if (a.el === 0) {
          E.forEach(e => { if (!e.dead && Math.hypot(e.x - a.x, e.z - a.z) < rad) { dmg(e, 2.5 * mult); e.burn = 4; } });
        } else if (a.el === 1) {
          E.forEach(e => { if (!e.dead && Math.hypot(e.x - a.x, e.z - a.z) < rad) e.slow = 4.5; });
          if (Math.hypot(P.x - a.x, P.z - a.z) < 13) P.hp = Math.min(100, P.hp + (isElite ? 15 : 9));
        } else if (a.el === 2) {
          const dx = target.x - a.x, dz = target.z - a.z, l = Math.hypot(dx, dz) || 1;
          a.kx += (dx / l) * 30; a.kz += (dz / l) * 30;
          E.forEach(e => {
            if (!e.dead && Math.hypot(e.x - a.x, e.z - a.z) < rad) {
              const ex = e.x - a.x, ez = e.z - a.z, elen = Math.hypot(ex, ez) || 1;
              dmg(e, 2.8 * mult, (ex / elen) * 26, (ez / elen) * 26);
            }
          });
        } else {
          E.forEach(e => {
            if (!e.dead && Math.hypot(e.x - a.x, e.z - a.z) < rad) {
              const dx = e.x - a.x, dz = e.z - a.z, l = Math.hypot(dx, dz) || 1;
              dmg(e, 3.4 * mult, (dx / l) * 24, (dz / l) * 24);
            }
          });
        }
      }
    }

    if (dashBtn && dashBtn._c !== P.dashCharges) {
      dashBtn._c = P.dashCharges;
      dashBtn.textContent = '⚡\nDASH ' + P.dashCharges;
      dashBtn.style.opacity = P.dashCharges > 0 ? 1 : 0.45;
    }

    if (started && xh.textContent) {
      xh.textContent += ' · ⚡Dash: ' + '●'.repeat(P.dashCharges) + '○'.repeat(P.dashMax - P.dashCharges) + ' [Z]';
    }
  };
}
