import * as THREE from './vendor/three.module.js';

// 程序化小怪：纸人（纸扎人）与飞头蛮。与 battle-actors 的实战角色同一接口：
// {root, animate(pose,time,progress,motion), resetMotion(), dispose()}；
// 飞头蛮另有 lift（离地高度），由战斗逻辑设定，模型内部抬高，root 仍贴地方便范围判定。
const TAU=Math.PI*2,{clamp,smoothstep}=THREE.MathUtils;
const ease=(a,b,x)=>smoothstep(x,a,b);

function canvasTexture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
let shared=null;
function assets(){
  if(shared)return shared;
  // 纸扎人的脸：惨白纸面、两团胭脂、墨点眼、樱桃小口、墨画发髻。
  const paperFace=canvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#f3ecdc';g.fillRect(0,0,w,h);
    for(let i=0;i<40;i++){g.strokeStyle='rgba(150,130,100,.12)';g.lineWidth=1;g.beginPath();const y=Math.random()*h;g.moveTo(0,y);g.lineTo(w,y+Math.random()*12-6);g.stroke();}
    g.fillStyle='#161212';g.beginPath();g.ellipse(128,40,118,64,0,Math.PI,TAU);g.fill();g.fillRect(10,30,236,26);
    for(const x of [84,172]){const r=g.createRadialGradient(x,150,2,x,150,30);r.addColorStop(0,'rgba(232,70,80,.85)');r.addColorStop(1,'rgba(232,70,80,0)');g.fillStyle=r;g.beginPath();g.arc(x,150,30,0,TAU);g.fill();}
    g.fillStyle='#111';for(const x of [94,162]){g.beginPath();g.ellipse(x,118,9,5,0,0,TAU);g.fill();}
    g.strokeStyle='#111';g.lineWidth=3;for(const x of [94,162]){g.beginPath();g.moveTo(x-16,98);g.quadraticCurveTo(x,90,x+16,98);g.stroke();}
    g.fillStyle='#c8202a';g.beginPath();g.ellipse(128,184,10,7,0,0,TAU);g.fill();
  });
  // 纸衣：靛蓝底、朱红团寿纹、金边，带竹篾折痕。
  const paperRobe=canvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#2f4f86';g.fillRect(0,0,w,h);
    g.fillStyle='#d9b45c';g.fillRect(0,h-26,w,26);g.fillRect(0,0,w,10);
    for(let y=40;y<h-30;y+=64)for(let x=(y/64%2)*32+16;x<w;x+=64){
      g.strokeStyle='#c8333a';g.lineWidth=5;g.beginPath();g.arc(x,y,15,0,TAU);g.stroke();
      g.beginPath();g.moveTo(x-9,y);g.lineTo(x+9,y);g.moveTo(x,y-9);g.lineTo(x,y+9);g.stroke();
    }
    g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=2;for(let x=0;x<w;x+=21){g.beginPath();g.moveTo(x,0);g.lineTo(x+4,h);g.stroke();}
  });
  // 飞头蛮：青白人脸、血红双目、獠牙。
  const headFace=canvasTexture(256,256,(g,w,h)=>{
    const bg=g.createRadialGradient(128,140,20,128,128,160);bg.addColorStop(0,'#c9d3c4');bg.addColorStop(1,'#5f6d63');
    g.fillStyle=bg;g.fillRect(0,0,w,h);
    g.fillStyle='#0b0b0b';g.beginPath();g.ellipse(128,30,140,70,0,Math.PI,TAU);g.fill();g.fillRect(0,20,w,30);
    g.strokeStyle='#2a1c1c';g.lineWidth=6;for(const s of [-1,1]){g.beginPath();g.moveTo(128+s*20,96);g.lineTo(128+s*62,82);g.stroke();}
    for(const x of [92,164]){const r=g.createRadialGradient(x,116,1,x,116,22);r.addColorStop(0,'#fff2c0');r.addColorStop(.3,'#ff3b24');r.addColorStop(1,'rgba(120,0,0,0)');g.fillStyle=r;g.beginPath();g.arc(x,116,22,0,TAU);g.fill();}
    g.fillStyle='#2a0d0d';g.beginPath();g.ellipse(128,186,34,18,0,0,TAU);g.fill();
    g.fillStyle='#f2ead2';for(const x of [108,148]){g.beginPath();g.moveTo(x-6,176);g.lineTo(x+6,176);g.lineTo(x,200);g.closePath();g.fill();}
  });
  const flame=canvasTexture(128,128,(g,w,h)=>{
    const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(220,255,240,1)');r.addColorStop(.25,'rgba(90,255,200,.8)');r.addColorStop(1,'rgba(20,120,110,0)');
    g.fillStyle=r;g.fillRect(0,0,w,h);
  });
  shared={paperFace,paperRobe,headFace,flame};return shared;
}

function lit(map,extra={}){return new THREE.MeshStandardMaterial({map,roughness:.95,metalness:0,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.16,...extra});}

export function makePaperActor(){
  const a=assets(),root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='battle-paper';
  const robe=lit(a.paperRobe,{side:THREE.DoubleSide}),face=lit(a.paperFace),white=lit(null,{color:0xefe7d6});
  // 纸扎人上下一般宽、身板扁平，像糊在竹篾架上。
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.27,.42,1.15,4,1,true),robe);torso.rotation.y=Math.PI/4;torso.scale.z=.55;torso.position.y=.78;
  const hem=new THREE.Mesh(new THREE.ConeGeometry(.5,.38,4,1,true),robe);hem.rotation.y=Math.PI/4;hem.scale.z=.55;hem.position.y=.2;hem.rotation.x=Math.PI;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,18,14),face);head.scale.set(1,1.12,.86);head.position.y=1.6;head.rotation.y=-Math.PI/2;
  const hat=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.12,10),lit(null,{color:0x161212}));hat.position.y=1.85;
  body.add(torso,hem,head,hat);
  const arms=[];
  for(const s of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(s*.33,1.28,0);body.add(pivot);
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.12,.62,.08),robe);arm.position.y=-.3;pivot.add(arm);
    const hand=new THREE.Mesh(new THREE.BoxGeometry(.1,.12,.05),white);hand.position.y=-.66;pivot.add(hand);
    pivot.rotation.x=-.9;arms.push({pivot,s});
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  let previous=0;
  function animate(pose='idle',time=0,p=1,motion){
    const dt=clamp(motion?.dt??1/60,0,.1);previous=time;
    body.position.set(0,0,0);body.rotation.set(0,0,0);body.scale.set(1,1,1);
    // 纸人走路不迈腿，是一顿一顿往前飘。
    const hop=pose==='walk'?Math.abs(Math.sin(time*9))*.16:Math.abs(Math.sin(time*2.4))*.03;
    body.position.y=hop;body.rotation.z=Math.sin(time*(pose==='walk'?9:2.4))*.07;
    for(const {pivot,s} of arms){pivot.rotation.x=-.9+Math.sin(time*9+s)*(pose==='walk'?.18:.05);pivot.rotation.z=s*.08;}
    if(pose==='cast'){body.rotation.x=-.25*p;for(const {pivot} of arms)pivot.rotation.x=-2.2*p-.9*(1-p);}
    if(pose==='attack'){body.rotation.x=.55*Math.sin(Math.PI*p);for(const {pivot} of arms)pivot.rotation.x=-2.4+1.6*p;}
    if(pose==='hit'){body.rotation.x=-.35*(1-p);body.rotation.z=.4*Math.sin(p*18)*(1-p);}
    if(pose==='dead'){const k=ease(0,1,p);body.rotation.x=-1.5*k;body.scale.set(1,1-.75*k,1);body.position.y=.05*k;}
  }
  return {root,animate,resetMotion(){},dispose(){}};
}

export function makeFlyerActor(){
  const a=assets(),root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='battle-flyer';
  const head=new THREE.Mesh(new THREE.SphereGeometry(.36,22,16),lit(a.headFace,{emissiveIntensity:.3}));head.rotation.y=-Math.PI/2;head.scale.set(1,1.1,.92);
  body.add(head);
  // 耳化作双翼，长发与断颈拖在脑后。
  const wing=new THREE.Shape();wing.moveTo(0,0);wing.quadraticCurveTo(.5,.42,.95,.18);wing.quadraticCurveTo(.62,.02,.82,-.22);wing.quadraticCurveTo(.4,-.12,0,0);
  const wingGeo=new THREE.ShapeGeometry(wing,10),wingMat=new THREE.MeshStandardMaterial({color:0x8b9b8c,roughness:.8,side:THREE.DoubleSide,emissive:0x203028,emissiveIntensity:.4});
  const wings=[-1,1].map(s=>{const g=new THREE.Group();g.position.set(s*.32,.06,0);g.scale.x=s;body.add(g);const m=new THREE.Mesh(wingGeo,wingMat);g.add(m);return g;});
  const hair=[];const hairMat=new THREE.MeshStandardMaterial({color:0x0c0b0b,roughness:.7,side:THREE.DoubleSide});
  for(let i=0;i<7;i++){
    const strand=new THREE.Mesh(new THREE.PlaneGeometry(.12,1.1,1,6),hairMat);
    const g=new THREE.Group();g.position.set((i-3)*.08,.18,-.22);g.add(strand);strand.position.y=-.5;body.add(g);hair.push(g);
  }
  const neck=new THREE.Mesh(new THREE.ConeGeometry(.13,.42,10,1,true),new THREE.MeshStandardMaterial({color:0x7a1f1c,roughness:.6,side:THREE.DoubleSide,emissive:0x3a0505,emissiveIntensity:.6}));
  neck.position.y=-.42;neck.rotation.x=Math.PI;body.add(neck);
  const fire=new THREE.Sprite(new THREE.SpriteMaterial({map:a.flame,color:0x7dffd0,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  fire.scale.setScalar(1.3);fire.position.set(0,-.3,-.25);body.add(fire);
  head.castShadow=true;
  const actor={root,lift:2.4,animate,resetMotion(){},dispose(){}};
  function animate(pose='idle',time=0,p=1){
    const flap=Math.sin(time*(pose==='attack'?20:11));
    let y=actor.lift+Math.sin(time*2.3)*.12;
    body.rotation.set(0,0,Math.sin(time*1.7)*.1);
    if(pose==='cast')body.rotation.x=-.4*p;
    if(pose==='attack')body.rotation.x=.5;
    if(pose==='hit'){body.rotation.z=.6*Math.sin(p*20)*(1-p);y-=.3*(1-p);}
    if(pose==='dead'){const k=ease(0,1,p);y=actor.lift*(1-k)+.3*k;body.rotation.x=1.3*k;fire.material.opacity=1-k;}
    else fire.material.opacity=.75+.25*Math.sin(time*13);
    body.position.y=y;
    wings.forEach((g,i)=>{g.rotation.z=(pose==='dead'?-.2:.25+flap*.55);g.rotation.y=.2;});
    hair.forEach((g,i)=>{g.rotation.x=-.9-.25*Math.sin(time*6+i*.7);g.rotation.z=(i-3)*.08+.06*Math.sin(time*4+i);});
  }
  return actor;
}

// 五鬼：钟馗座下五方小鬼，戴青、赤、白、玄、黄五色傩面，矮身短角，蹦跳着追打敌人。
const impColors=[0x3fe0a0,0xff5030,0xf4f0e4,0x7a66ff,0xffc040];
let impFaces=null;
function impFace(i){
  impFaces??=impColors.map(c=>canvasTexture(128,128,(g,w,h)=>{
    g.fillStyle='#'+new THREE.Color(c).getHexString();g.fillRect(0,0,w,h);
    g.fillStyle='#120c08';g.beginPath();g.ellipse(40,54,14,9,-.3,0,TAU);g.ellipse(88,54,14,9,.3,0,TAU);g.fill();
    g.fillStyle='#ffe28a';g.beginPath();g.arc(40,54,4,0,TAU);g.arc(88,54,4,0,TAU);g.fill();
    g.strokeStyle='#120c08';g.lineWidth=5;g.beginPath();g.moveTo(26,36);g.lineTo(54,44);g.moveTo(102,36);g.lineTo(74,44);g.stroke();
    g.fillStyle='#5a0d0a';g.beginPath();g.ellipse(64,92,26,12,0,0,TAU);g.fill();
    g.fillStyle='#fff6e0';for(const x of [48,80]){g.beginPath();g.moveTo(x-5,84);g.lineTo(x+5,84);g.lineTo(x,98);g.closePath();g.fill();}
  }));
  return impFaces[i%5];
}
export function makeImpActor(i=0){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);root.name='ally-imp';
  const robe=new THREE.MeshStandardMaterial({color:0x2a1c18,roughness:.9,emissive:impColors[i%5],emissiveIntensity:.08});
  const torso=new THREE.Mesh(new THREE.ConeGeometry(.34,.75,8),robe);torso.position.y=.42;
  const face=new THREE.Mesh(new THREE.SphereGeometry(.26,16,12),lit(impFace(i),{emissiveIntensity:.35}));face.position.y=.98;face.rotation.y=-Math.PI/2;
  const hornMat=new THREE.MeshStandardMaterial({color:0xe8dcc0,roughness:.6});
  for(const s of [-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(.05,.22,6),hornMat);h.position.set(s*.13,1.22,0);h.rotation.z=-s*.4;body.add(h);}
  const arms=[-1,1].map(s=>{const a=new THREE.Mesh(new THREE.BoxGeometry(.09,.4,.09),robe);a.position.set(s*.3,.6,0);body.add(a);return a;});
  body.add(torso,face);root.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  // 每只小鬼裹着本方颜色的鬼火，跑动时拖出火尾。
  const fireMat=new THREE.SpriteMaterial({map:assets().flame,color:impColors[i%5],transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const fires=[0,1,2].map(k=>{const f=new THREE.Sprite(fireMat);f.position.set(0,.55+k*.05,-.25-k*.32);f.scale.setScalar(1.3-k*.3);body.add(f);return f;});
  const halo=new THREE.Sprite(fireMat);halo.scale.setScalar(2.2);halo.position.y=.7;body.add(halo);
  function animate(pose='walk',time=0,p=1){
    body.position.y=Math.abs(Math.sin(time*11))*.22;body.rotation.set(0,0,Math.sin(time*11)*.12);
    arms.forEach((a,k)=>{a.rotation.x=pose==='attack'?-2.2+2*p:Math.sin(time*11+k*Math.PI)*.8;});
    if(pose==='attack')body.rotation.x=.5*Math.sin(Math.PI*p);
    fireMat.opacity=.75+.25*Math.sin(time*17);halo.scale.setScalar(pose==='attack'?3:2.2);
  }
  return {root,animate,resetMotion(){},dispose(){}};
}
