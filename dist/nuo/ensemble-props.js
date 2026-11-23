import * as T from '../vendor/three.module.js';
import {V,tau,mix,clamp,group,oval,surface,part,stroke,rings,rng} from './form.js';
import {inscription} from './ensemble-art.js';

export function tablet(g,mat,w,h,d,r=Math.min(w,h)*.13){
  const loop=[];r=Math.min(r,w*.46,h*.46);
  for(const [cx,cy,start] of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,.25],[-w/2+r,-h/2+r,.5],[w/2-r,-h/2+r,.75]])
    for(let j=0;j<=5;j++){const a=(start+j/20)*tau;loop.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  const layers=[[-d/2,0],[-d/2,.94],[-d*.31,1],[d*.31,1],[d*.5,.94],[d*.5,0]];
  return part(g,surface(loop.length,layers.length-1,(u,v)=>{const [x,y]=loop[Math.round(u*loop.length)%loop.length],[z,k]=layers[Math.round(v*(layers.length-1))];return V(x*k,y*k,z);}),mat);
}
function label(g,mat,w,h,z){
  return part(g,surface(6,12,(u,v)=>V((u-.5)*w,(v-.5)*h,z+.04*Math.cos((u-.5)*Math.PI))),mat);
}
function incise(g,m,pts,r=.14){return stroke(g,m,pts,r,Math.max(14,pts.length*3),6);}
function loop(g,m,center,rx,ry,tube=.24,turn=0){
  const ob=part(g,new T.TorusGeometry(1,tube/Math.max(rx,ry),7,30),m);
  ob.position.set(...center);ob.scale.set(rx,ry,Math.max(rx,ry));ob.rotation.y=turn;return ob;
}
export function thunderKit(rig,m){
  const plates=[],signs=['東','南','中','西','北'],cradle=group(rig.chest,0,40.6,-10.9);
  incise(cradle,m.oldGold,[[-16,3,-.2],[-8,1,-2.55],[0,-1,-3],[8,1,-2.55],[16,3,-.2]],1.03);
  for(let i=0;i<5;i++){
    const k=i-2,hinge=group(cradle,k*3.36,.56*Math.abs(k),-1.8+.46*Math.abs(k));
    const plaque=group(hinge,0,22.9,0);
    tablet(plaque,m.oldGold,5.35,43.6,1.62,1.34);label(plaque,inscription(signs[i]+'雷','#405b55','#dfbb78'),4.34,36.9,.88);
    const reverse=group(plaque);reverse.rotation.y=Math.PI;label(reverse,inscription('雷令','#4e5848','#d4ab70'),4.30,36.9,.88);
    for(const y of [-20,20])oval(plaque,m.gold,[0,y,0],[.69,.71,1.06]);
    oval(hinge,m.copper,[0,1.1,.65],[1.65,1.65,.85]);plates.push(hinge);rig.track(plaque,0,22.05,0);
  }
  const charm=group(rig.arms[0].hand,0,-3.6,1.53);
  part(charm,surface(12,25,(u,v)=>V((u-.5)*4.63,(v-.33)*15.2,.61*Math.sin(v*Math.PI)+.12*Math.sin(u*tau))),inscription('五雷正法','#d3ae61','#8e3e29','paper'));
  return t=>{const a=clamp((t-.36)/.95);
    plates.forEach((p,i)=>{const k=i-2,s=T.MathUtils.smoothstep(a,Math.abs(k)*.08,.86+Math.abs(k)*.06);p.position.y=.56*Math.abs(k)+s*(13.8-1.3*Math.abs(k));p.rotation.z=-k*(.108+.282*s);p.rotation.x=-.13-.16*s+.031*Math.abs(k);});
    charm.rotation.x=-.21+.27*Math.sin(t*6)*a*(1-.72*clamp((t-1.25)/.7));};
}
function lion(g,m){
  oval(g,m.jade,[0,8.80,-.8],[6.12,7.04,5.27],[-.22,0,0]);
  for(const s of [-1,1]){
    oval(g,m.jade,[s*5.05,5.35,-1.75],[3.72,4.45,4.10]);
    oval(g,m.jade,[s*3.60,4.64,3.64],[2.02,3.9,2.14],[.08,0,s*.1]);
    oval(g,m.jade,[s*3.83,1.85,4.89],[2.72,1.32,2.82]);
    for(let j=0;j<3;j++)incise(g,m.stoneShade,[[s*(2.81+j*.75),1.70,7.17],[s*(2.90+j*.75),2.22,6.71],[s*(3.01+j*.75),2.46,6.21]],.14);
  }
  oval(g,m.jade,[0,13.4,2.02],[6.60,5.31,4.97]);
  for(const s of [-1,1]){
    oval(g,m.jade,[s*5.01,16.78,.78],[2.2,2.64,1.51],[0,0,-s*.42]);
    oval(g,m.oldGold,[s*2.87,14.55,6.26],[1.20,.69,.52]);
    oval(g,m.stoneShade,[s*2.77,14.58,6.73],[.42,.46,.19]);
    incise(g,m.jade,[[s*.56,14.41,6.64],[s*2.05,15.62,6.86],[s*3.59,15.83,6.36],[s*4.95,15.07,5.12]],.54);
    oval(g,m.jade,[s*1.91,12.16,6.62],[2.37,1.62,1.75]);oval(g,m.bone,[s*2.26,10.86,7.57],[.34,.74,.35]);
    for(let j=0;j<7;j++){
      const k=j/6,a=.53+k*2.19,x=s*(4.79+.75*Math.sin(a)),y=13.2+3.78*Math.cos(a),z=4.0+1.85*Math.sin(a);
      const pts=Array.from({length:19},(_,i)=>{const t=i/18,b=t*5.1,rr=(1-.77*t)*1.12;return [x+s*rr*Math.cos(b),y+rr*Math.sin(b),z+.32*t];});incise(g,m.jade,pts,.36);
    }
  }
  oval(g,m.stoneShade,[0,13.02,8.0],[1.45,.89,.68]);
  incise(g,m.jade,[[-4.8,5.78,-4.3],[-6.40,8.16,-6.0],[-5.42,11.42,-5.74],[-3.46,11.91,-5.55],[-3.36,10.66,-5.65]],.87);
}
export function wardKit(rig,m){
  const seal=group(rig.chest,0,0,0);
  const base=group(seal);base.rotation.x=-Math.PI/2;
  tablet(base,m.stoneShade,24.6,19.8,5.1,1.05);tablet(group(base,0,0,1.98),m.jade,25.1,20.1,1.56,.83);
  for(const side of [-1,1])for(let i=0;i<6;i++){const x=-9.9+i*3.9,z=side*9.98;
    incise(seal,m.oldGold,[[x,-.9,z],[x+2.95,-.9,z],[x+2.95,.87,z],[x+.84,.87,z],[x+.84,.01,z]],.14);}
  const sealText=group(seal,0,-2.56,0);sealText.rotation.x=Math.PI/2;label(sealText,inscription('鎮壇','#974932','#c69c66','medal'),19,17,.08);
  const guardian=group(seal,0,2.79,-.51);guardian.scale.setScalar(1.08);lion(guardian,m);rig.track(seal,0,24,8);
  return (t,move)=>{seal.position.copy(move.seal);};
}
export function judgeKit(rig,m){
  const sword=group(rig.arms[0].hand,0,-3.6,.6);
  sword.quaternion.setFromUnitVectors(V(0,1,0),V(-.69,-.69,.20).normalize());
  rings(sword,m.leather,[[-8,1.13,.97,0],[-7.3,1.39,1.13,0],[-6.6,1.10,.92,0],[4.6,1.08,.91,0],[5.6,1.35,1.05,0]],0,25);
  for(let j=0;j<6;j++)loop(sword,m.oldGold,[0,-6.4+j*1.8,0],1.17,.99,.14).rotation.x=Math.PI/2;
  for(const s of [-1,1])incise(sword,m.gold,[[0,5.4,0],[s*2.59,5.05,0],[s*4.25,5.62,0],[s*5.28,7.38,0],[s*4.39,7.60,0]],.68);
  const rows=[[5.46,2.15,.65],[8.43,2.83,.79],[36,2.61,.70],[62,2.08,.56],[74,1.35,.35],[81,.035,.03]],cross=[[-1,0],[-.68,.72],[0,1],[.68,.72],[1,0],[.68,-.72],[0,-1],[-.68,-.72]];
  for(let i=0;i<8;i++)part(sword,surface(1,5,(u,v)=>{const [y,wx,d]=rows[Math.round(v*5)],a=cross[i],b=cross[(i+1)%8];return V(wx*mix(a[0],b[0],u),y,d*mix(a[1],b[1],u));}),[0,3,4,7].includes(i)?m.bone:m.blade);
  for(let j=0;j<5;j++)incise(sword,m.oldGold,[[0,10+j*4,.87],[-.68,11+j*4,.82],[.64,12+j*4,.82],[0,13.3+j*4,.86]],.085);
  loop(sword,m.gold,[0,-8.94,0],1.13,1.28,.22);rig.track(sword,0,81,0);
  return ()=>{};
}
export function blackKit(rig,m){
  const n=20,geo=new T.TorusGeometry(1,.30,9,28);
  const chain=new T.InstancedMesh(geo,m.iron,n);chain.userData.moving=true;chain.frustumCulled=false;chain.instanceMatrix.setUsage(T.DynamicDrawUsage);rig.chest.add(chain);
  const token=group(rig.arms[1].hand,1.04,-5.0,1);tablet(token,m.oldGold,5.6,10.6,1.19,.70);
  label(token,inscription('拘魂','#454840','#c4a16c'),4.54,8.97,.71);
  const marker=group(rig.chest);rig.track(marker,0,0,0);
  const dummy=new T.Object3D(),vup=V(0,1,0),turn=new T.Quaternion(),rot=new T.Quaternion();
  return t=>{
    rig.chest.updateWorldMatrix(true,true);
    const a=rig.chest.worldToLocal(rig.arms[0].hand.localToWorld(V(0,-4.5,1.49))),b=rig.chest.worldToLocal(rig.arms[1].hand.localToWorld(V(0,-4.3,1.52)));
    const swing=Math.sin(Math.PI*T.MathUtils.smoothstep(t,.38,1.84)),angle=.30+1.07*swing;
    const down=V(0,-Math.cos(angle),Math.sin(angle));const axis=b.clone().sub(a).normalize();down.addScaledVector(axis,-down.dot(axis)).normalize();
    const p=new T.QuadraticBezierCurve3(a,V(0,0,0),b);
    let lo=0,hi=64;const length=Math.max(65,a.distanceTo(b)+.5);
    for(let k=0;k<9;k++){const sag=(lo+hi)*.5;p.v1.copy(a).lerp(b,.5).addScaledVector(down,sag);p.updateArcLengths();if(p.getLength()<length)lo=sag;else hi=sag;}
    marker.position.copy(p.getPoint(.5));
    for(let i=0;i<n;i++){
      const u=i/(n-1);dummy.position.copy(p.getPointAt(u));rot.setFromUnitVectors(vup,p.getTangentAt(u).normalize());
      turn.setFromAxisAngle(vup,i%2?1.54:.19);dummy.quaternion.copy(rot).multiply(turn);dummy.scale.set(1.49,2.24,1.53);dummy.updateMatrix();chain.setMatrixAt(i,dummy.matrix);
    }
    chain.instanceMatrix.needsUpdate=true;
  };
}
export function whiteKit(rig,m){
  const staff=group(rig.arms[0].hand,0,-4.18,.83);
  rings(staff,m.worn,[[-35,.59,.59,0],[-32,.74,.74,0],[48,.72,.72,0],[63,.61,.61,0],[74,.49,.49,0]],0,24);
  for(const y of [-32,33,56,62,68])rings(staff,m.oldGold,[[y,.83,.83,0],[y+.50,.93,.93,0],[y+.95,.81,.81,0]],0,22);
  oval(staff,m.oldGold,[0,74.33,0],[1.51,2.29,1.13]);incise(staff,m.worn,[[-13.1,65,0],[0,65.65,0],[13.1,65,0]],.56);
  const sheets=[];
  function silk(x,y,w,len,material,phase){
    const geo=surface(8,34,(u,v)=>V((u-.5)*w,(v-1)*len,0));
    const mesh=part(staff,geo,material);mesh.userData.moving=true;mesh.frustumCulled=false;mesh.position.set(x,y,0);
    const pos=geo.getAttribute('position');pos.setUsage(T.DynamicDrawUsage);
    sheets.push({geo,pos,w,len,phase});
  }
  silk(0,64.8,12.05,36.5,inscription('引魂歸路','#dcd1b4','#575746','paper'),.3);
  for(const s of [-1,1]){
    silk(s*9.06,64.68,3.12,40.1,s<0?m.paper:m.linen,.92+s*.56);
    silk(s*12.12,64.63,1.60,31.4,m.paper,1.64+s*.61);
    loop(staff,m.oldGold,[s*7.48,63.55,0],.82,1.08,.17);
  }
  rig.track(staff,-13,76,0);rig.track(staff,13,65,0);rig.track(staff,0,-35,0);
  return t=>{
    const sweep=T.MathUtils.smoothstep(t,.17,1.42),decay=1-.64*T.MathUtils.smoothstep(t,1.43,2);
    for(const {geo,pos,w,len,phase} of sheets){
      for(let j=0;j<=34;j++)for(let i=0;i<=8;i++){
        const u=i/8-.5,p=1-j/34,wave=Math.sin(6.6*p-5.55*t+phase);
        const x=w*u+Math.sin(p*3.8+phase)*1.07*p+wave*(2.2+6.0*sweep*decay)*p*p;
        const z=.49*(1-Math.cos(u*tau))+(2.1*Math.sin(p*6.3+phase)+7.66*sweep*decay*Math.sin(p*3.4-4.2*t+phase))*p;
        pos.setXYZ(j*9+i,x,-p*len+p*p*(1.45+2.2*sweep)*Math.abs(wave),z);
      }
      pos.needsUpdate=true;geo.computeVertexNormals();
    }
  };
}
