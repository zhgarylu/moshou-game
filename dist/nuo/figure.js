import * as T from '../vendor/three.module.js';
import {V,tau,mix,clamp,rng,group,part,oval,surface,rings,ringPoint,stroke,bar,batch} from './form.js';
import {buildHead} from './mask.js';

const deg=Math.PI/180,up=V(0,1,0);
function trim(g,m,rows,t,width,fold=0){
  const pts=Array.from({length:81},(_,i)=>ringPoint(rows,t,i/80*tau,fold));
  stroke(g,m,pts,width,86,6);
}
function robe(g,m){
  const torso=[[0,12.6,8.35,-.4],[6,12.5,8.7,-.45],[15,13.1,9.2,-.35],[26,15.1,10.0,.15],[35,16.9,9.8,.55],[41,17.1,8.5,.3],[44.9,14.7,7.48,.1],[47,9.7,6.05,0],[48.1,5.1,4.85,.20]];
  const bodyAt=(a,y,lift)=>{
    let i=0;while(i<torso.length-2 && y>torso[i+1][0])i++;
    const t=clamp((y-torso[i][0])/(torso[i+1][0]-torso[i][0]));
    const p=ringPoint(torso,(i+t)/(torso.length-1),a,.37);
    const gathers=clamp((45-y)/8)*clamp((y-11)/6);
    const waves=(.64*Math.cos(2.9*a+y*.56+2.5*Math.sin(a+.38))+.34*Math.cos(5.4*a-y*.72)) * gathers * (.45+.55*Math.sin(a)**2);
    return p.add(V(Math.sin(a)*(lift+waves),0,Math.cos(a)*(lift+waves)));
  };
  part(g,surface(100,76,(u,v)=>bodyAt(u*tau,48.10*v,0)),m.robe);
  const collar=(u,v)=>{
    const a=u*tau,upper=51.65-6.1*Math.max(0,Math.cos(a))**2.7+.22*Math.sin(a);
    const y=upper-3.9*(1-v),extend=clamp((y-48.1)/3.6);
    const p=bodyAt(a,Math.min(y,48.10),.40);
    if(y>48.1){p.x=mix(p.x,5.00*Math.sin(a),extend);p.z=mix(p.z,.14+4.77*Math.cos(a),extend);p.y=y;}
    return p;
  };
  part(g,surface(100,10,collar),m.lapel);
  part(g,surface(100,3,(u,v)=>{const p=collar(u,1);p.x*=1-.12*v;p.z*=1-.12*v;p.y-=.19*v;return p;}),m.lapel);
  stroke(g,m.shadowCloth,Array.from({length:90},(_,i)=>collar(i/89,.965)),.095,92,6);
  function band(points,width,mat,lift,edging=true){
    const c=new T.CatmullRomCurve3(points.map(([a,y])=>V(a,y,0)));
    const pt=(k,t)=>{
      const p=c.getPoint(t),v=c.getTangent(t),l=Math.hypot(v.x*12,v.y);
      const y=p.y-k*width*v.x*12/l;
      return bodyAt(p.x+k*width*v.y/(12*l),y,(lift+.20*(1-k*k))*clamp((y-15)/5));
    };
    part(g,surface(12,76,(u,v)=>pt(u*2-1,v)),mat);
    if(mat===m.lapel){
      for(let i=0;i<14;i++){
        const t=.12+i*.050;
        const motif=[[.63,t],[.23,t+.012],[.52,t+.023],[.76,t+.016]];
        stroke(g,m.binding,motif.map(([k,f])=>{const p=pt(k,f);p.z+=.068;return p;}),.061,12,5);
      }
    }
    if(edging)for(const k of [-.96,.96])stroke(g,m.binding,Array.from({length:45},(_,i)=>pt(k,i/44)),.105,49,5);
  }
  band([[-1.48,47.5],[-.88,43.8],[-.56,38.5],[-.10,30.8],[.58,20.8],[.95,15.5]],2.4,m.linen,.58);
  band([[1.88,47],[1.15,46.0],[.69,42],[.39,36],[-.13,27.3],[-.62,19.0],[-.96,15.3]],2.80,m.lapel,.98);
  band([[-2.86,27],[-2.58,40.0],[-1.84,45.6],[-1.19,45.9],[-.81,42.1],[-.42,37.6],[-.22,35.55]],.64,m.deepRed,1.16);
  for(let i=0;i<5;i++){
    const y=12+i*1.4,rows=[[y-1.2,13.75,9.6,-.16],[y,14.05,9.75,-.16],[y+1.04,13.7,9.56,-.16]];
    rings(g,i===2||i===4?m.deepRed:m.lapel,rows,.09);trim(g,i===4?m.silk:m.linen,rows,.99,.075,.09);
  }
  const tie=[-3.10,35.5,11.5];
  for(const side of [-1,1]){
    stroke(g,m.deepRed,[tie,[-3.1+side*1.7,37.1,11.68],[-3.1+side*2.05,35.7,11.8],tie],.39);
    stroke(g,m.silk,[tie,[-2.8+side*.5,32.4,11.5],[-2.3+side*.8,29.1,11.2],[-2.2+side*1.4,27.7,11.1]],t=>.29-.15*t,20);
  }
  oval(g,m.oldGold,[1.8,15.1,10],[2.4,1.37,.41]);
  stroke(g,m.deepRed,[[-9,15.9,7.8],[-11,13.1,7.62],[-11.8,9.5,7.72],[-11.9,6.3,8.23]],.35,20);
  oval(g,m.oldGold,[-11.94,5.8,8.34],[.88,1.02,.72]);
  oval(g,m.oldGold,[-12.08,3.93,8.55],[1.56,1.77,1.28],[0,0,-.14]);
  for(let j=0;j<2;j++){
    const path=[[-8.8-j,14.3,8.1],[-9.5-j,12.4,8.72],[-9.35-j*1.2,8.6,9.4],[-9.08-j*1.23,5.3-j,10.05],[-8.8-j*1.2,1.8-2*j,10.6]];
    const cr=new T.CatmullRomCurve3(path.map(q=>V(...q)));
    part(g,surface(5,24,(u,t)=>{const c=cr.getPoint(t);c.x+=(u-.5)*(1.18+.28*(1-t));c.z+=.18*Math.sin(Math.PI*u);return c;}),j?m.linen:m.silk);
  }
}
function lower(root,m){
  const hem=[[43,20,13.1,-.6],[47,19.4,12.3,-.54],[62,17.5,11.8,-.15],[78,15.6,10.8,.09],[96,13.5,9.4,0],[112,12.5,8.8,0]];
  rings(root,m.shadowCloth,hem,.70);
  for(const s of [-1,1]){
    const layer=(u,v,extra=0)=>{
      const a=s*(.08+u*2.7+(.64-.76*v))+.055*Math.sin(v*Math.PI),p=ringPoint(hem,v,a,.68);
      p.y+=5.8*(1-v)**2*Math.abs(2*u-1)**1.55;
      return p.add(V((1.05+extra)*Math.sin(a),0,(1.05+extra)*Math.cos(a)));
    };
    part(root,surface(52,45,layer,s<0),m.robe);
    stroke(root,m.binding,Array.from({length:34},(_,i)=>layer(.014,i/33,.06)),.18,38);
    for(let i=0;i<5;i++){
      const a=.15+.156*i;const pts=Array.from({length:13},(_,j)=>layer(a+.021*Math.sin(j/12*Math.PI),.05+.63*j/12,.08));
      stroke(root,m.linen,pts,t=>.02+.15*Math.sin(t*Math.PI),17,5);
    }
    const side=s<0?'R':'L',thigh=group(root,s*7.6,92,0),shin=group(thigh,0,-47,0),foot=group(shin,0,-40,0);
    thigh.name='thigh'+side;shin.name='shin'+side;foot.name='foot'+side;
    thigh.rotation.z=s*.04;thigh.position.x-=Math.sin(-s*.04)*(-92);
    rings(thigh,m.boot,[[-48,5.82,5.9,0],[-37,6.4,6.0,0],[0,6.2,6.0,0]],.14);
    rings(shin,m.boot,[[-40,4.05,4.5,1.7],[-31,4.3,4.24,0],[-17,5.28,4.7,0],[-6,5.7,5.4,0],[3,5.98,5.85,0]],.22);
    for(let i=0;i<4;i++)rings(shin,m.leather,[[-36+i*3.1,4.68,4.74,.28],[-35+i*3.1,4.83,4.90,.28],[-33.95+i*3.1,4.72,4.78,.28]],.03,38);
    oval(foot,m.boot,[0,0,3.4],[4.6,5.3,8.0],[-.12,0,0]);
    oval(foot,m.leather,[0,-3.3,4.0],[4.8,1.35,8.25]);
  }
}
function casework(g,m){
  const box=group(g,-3.5,26.5,-9.45);box.rotation.z=.55;box.rotation.x=-.07;
  // The cross-section is flattened and octagonal. Both faces carry the seven-star inlay.
  const corners=[[-.72,1],[.72,1],[1,.64],[1,-.64],[.72,-1],[-.72,-1],[-1,-.64],[-1,.64]];
  function casing(y0,y1,rx,rz,mat){
    part(box,surface(8,3,(u,v)=>{const [x,z]=corners[Math.round(u*8)%8];return V(rx*x,mix(y0,y1,v),rz*z);}),mat);
    for(const y of [y0,y1])part(box,surface(8,1,(u,v)=>{const [x,z]=corners[Math.round(u*8)%8];return V(rx*x*v,y,rz*z*v);}),mat);
  }
  casing(-34,32,3.43,1.95,m.lacquer);
  for(const [a,b] of [[-34,-32.2],[-23,-21.9],[7,8.1],[29.4,32.15]])casing(a,b,3.64,2.07,m.oldGold);
  const stars=[[-1.61,26.4],[-.41,24.6],[1.25,23.1],[.85,20.6],[-1.14,17.6],[-.65,14.65],[1.14,12.45]];
  for(const s of [-1,1]){
    const z=s*2.02;stroke(box,m.oldGold,stars.map(([x,y])=>[x,y,z]),.093,28,5);
    for(const [x,y] of stars)oval(box,m.gold,[x,y,z],[.32,.32,.18]);
    for(const side of [-1,1])stroke(box,m.worn,[[side*2.39,28.9,z],[side*2.39,11,z],[side*2.39,-31.8,z]],.08,22,5);
  }
}
function sleeve(g,m,s){
  const rows=[[-28.9,4.4,4.6,.2],[-27.5,5.9,5.5,.1],[-25.7,6.2,5.7,-.1],[-24.3,5.4,5.3,-.15],[-22,6.15,5.9,-.15],[-17,6.55,6.3,.15],[-10,7.05,6.7,.23],[-5.3,7.30,7.1,.13],[-1.3,6.9,6.8,.05],[2.2,5.65,5.6,.05],[4.3,3.3,3.3,0],[5.1,.35,.35,0]];
  rings(g,m.robe,rows,.38,72);
  part(g,surface(60,4,(u,t)=>{const a=u*tau,p=ringPoint(rows,0,a,.38);return V(p.x*(1-.30*t),p.y+.75*t,p.z*(1-.30*t));}),m.shadowCloth);
  for(let i=0;i<2;i++){
    const tab=(u,v)=>{
      const a=s*(.02+u*3.26);const t=mix(.585+i*.091,.776+i*.092,v)+(.052*Math.cos(u*tau)+.046*u)*(1-v);
      const p=ringPoint(rows,t,a,.38);return p.add(V((.52+i*.22)*Math.sin(a),.18-i*.12,(.52+i*.22)*Math.cos(a)));
    };
    part(g,surface(40,9,tab,s<0),i?m.robe:m.linen);
    stroke(g,m.shadowCloth,Array.from({length:33},(_,j)=>tab(j/32,0)),.14,36,5);
  }
  for(let j=0;j<2;j++)trim(g,j?m.shadowCloth:m.linen,rows,.098+j*.10,.38,.38);
}
function forearm(g,m){
  rings(g,m.skin,[[-24.7,2.03,2.25,.3],[-23,2.23,2.45,.16],[-15.2,2.89,3.07,.08],[-8.6,3.67,3.42,0],[-3.8,3.66,3.49,0],[1.9,3.22,3.14,0]],.05,48);
  for(let i=0;i<6;i++){
    const y=-24+i*2.4,r=2.36+i*.197;
    part(g,surface(42,6,(u,v)=>{const a=u*tau,rad=r+.23*Math.sin(Math.PI*v);return V(Math.sin(a)*rad,y+3.1*v+.36*Math.sin(a+.65*i),.17+Math.cos(a)*(rad+.08));}),i===1||i===4?m.deepRed:m.leather);
  }
}
const neutralAxis=V(-.51,-.844,.16).normalize();
function swordAndHand(hand,m){
  const grip=V(-.45,-3.7,1.22),sword=group(hand,...grip.toArray());sword.quaternion.setFromUnitVectors(up,neutralAxis);
  rings(sword,m.wood,[[-6.45,1.19,1.10,0],[-6.0,1.19,1.01,0],[-4.7,.94,.88,0],[3.0,1.01,.89,0],[4.6,1.16,1.01,0]],.028,36);
  for(let i=0;i<10;i++){
    const y=-5.62+i*.99;stroke(sword,i%3?m.leather:m.oldGold,Array.from({length:23},(_,n)=>{const a=n/22*tau;return [1.01*Math.sin(a),y+n/22*.61,.90*Math.cos(a)];}),.12,27,5);
  }
  rings(sword,m.oldGold,[[-7.1,.43,.47,0],[-6.72,1.37,1.19,0],[-6.14,1.35,1.16,0],[-5.88,1.08,.98,0]],0,36);
  stroke(sword,m.wood,[[-4.01,5.2,0],[-3.63,4.36,0],[-2.64,4.47,0],[0,5.06,0],[2.64,4.47,0],[3.63,4.36,0],[4.01,5.2,0]],t=>.64+.35*Math.sin(Math.PI*t),36,10);
  for(const s of [-1,1])oval(sword,m.oldGold,[s*3.04,4.82,.60],[.42,.44,.28]);
  const blade=[[4.95,1.24,.40],[6.25,1.70,.54],[22,1.65,.50],[47,1.26,.40],[60,.74,.28],[66,.028,.02]];
  const cross=[[-1,0],[-.48,.70],[0,1],[.48,.70],[1,0],[.48,-.70],[0,-1],[-.48,-.70]];
  for(let k=0;k<8;k++)part(sword,surface(1,5,(u,v)=>{const [y,w,d]=blade[Math.round(v*5)],a=cross[k],b=cross[(k+1)%8];return V(mix(a[0],b[0],u)*w,y,mix(a[1],b[1],u)*d);}),[0,3,4,7].includes(k)?m.bladeEdge:m.wood);
  for(const s of [-1,1])stroke(sword,m.oldGold,[[0,8,s*.58],[-.63,9.6,s*.49],[.58,11,s*.49],[-.52,12.7,s*.50],[.56,14.3,s*.48],[.1,16,s*.57]],.095,20,5);
  const palm=group(sword);oval(palm,m.skin,[.26,-.14,-2.04],[2.15,3.44,1.48],[0,0,-.13]);
  for(let i=0;i<4;i++){
    const y=2.1-i*1.30,r=.61-.031*i;
    stroke(palm,m.skin,[[1.44,y,-2.51],[2.01,y+.17,-1.55],[1.86,y+.12,-.45],[1.18,y+.02,.81],[.15,y-.08,1.37],[-.69,y-.15,1.08]],t=>r*(.90+.14*Math.sin(3*t*Math.PI)-.31*t**3),27,10);
  }
  stroke(palm,m.skin,[[-1.23,-1.4,-2.33],[-1.87,-.65,-1.80],[-1.85,.8,-.92],[-1.68,1.45,.36],[-1.03,1.37,1.22],[-.65,1.06,1.31]],t=>.84-.31*t,27,10);
  return {sword,pin:V(0,-6.55,1.02)};
}
function openHand(g,m){
  oval(g,m.skin,[0,-2.37,.3],[2.1,3.22,1.46],[.10,0,.10]);
  for(let i=0;i<4;i++){const x=(i-1.5)*.98;
    stroke(g,m.skin,[[x,-4.05,0],[x+.09,-5.7,.16],[x+.05,-7.05+.29*Math.abs(i-1),.62],[x-.12,-7.33+.41*Math.abs(i-1),1.18]],t=>.56-.25*t,16,7);}
  stroke(g,m.skin,[[-1.55,-1.7,.28],[-2.67,-2.81,1.16],[-2.93,-4.02,1.7],[-2.47,-4.7,2.14]],t=>.79-.34*t,16,8);
}
function tassel(root,m){
  const N=32,curveGeo=new T.BufferGeometry(),tubeSides=7;
  const pos=new Float32Array(N*tubeSides*3),ind=[];
  for(let i=0;i<N-1;i++)for(let j=0;j<tubeSides;j++){const a=i*tubeSides+j,b=i*tubeSides+(j+1)%tubeSides;ind.push(a,b,a+tubeSides,b,b+tubeSides,a+tubeSides);}
  curveGeo.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));curveGeo.setIndex(ind);
  const rope=part(root,curveGeo,m.silk);rope.userData.moving=true;rope.frustumCulled=false;
  const drop=group(root);oval(drop,m.gold,[0,-.52,0],[.63,.77,.63]);
  for(let j=0;j<2;j++)oval(drop,m.deepRed,[0,-1.46-.43*j,0],[.39,.31,.39]);
  const random=rng(71);
  for(let i=0;i<33;i++){const a=random()*tau,r=.05+.49*random(),x=r*Math.cos(a),z=r*Math.sin(a);
    stroke(drop,i%4?m.silk:m.deepRed,[[x*.25,-1.9,z*.25],[x*.70,-2.85,z*.77],[x*.9,-4.34,z*1.12],[x*1.61,-5.8-random()*1.73,z*1.56]],t=>.11*(1-.90*t),9,5);}
  return (points)=>{
    const p=new T.CatmullRomCurve3(points),frames=p.computeFrenetFrames(N-1,false);
    for(let i=0;i<N;i++){
      const c=p.getPointAt(i/(N-1));for(let j=0;j<tubeSides;j++){
        const a=j/tubeSides*tau,q=c.clone().addScaledVector(frames.normals[i],.146*Math.cos(a)).addScaledVector(frames.binormals[i],.146*Math.sin(a));q.toArray(pos,(i*tubeSides+j)*3);
      }
    }
    curveGeo.attributes.position.needsUpdate=true;curveGeo.computeVertexNormals();
    drop.position.copy(points.at(-1));drop.quaternion.setFromUnitVectors(V(0,-1,0),points.at(-1).clone().sub(points.at(-2)).normalize());
  };
}
export function makeSwordswoman(m){
  const root=new T.Group();root.scale.setScalar(.011);
  const hips=group(root);hips.name='hips';lower(hips,m);const chest=group(hips,0,99,0);chest.name='chest';robe(chest,m);casework(chest,m);
  rings(chest,m.skin,[[45.5,5.2,5.36,-.21],[48.2,4.48,4.81,-.17],[51.7,4.11,4.48,-.1],[53.4,4.21,4.53,.06],[55.6,4.61,4.83,.48],[57.3,4.92,4.99,.64]],.03);
  const head=group(chest,0,52.5,-.03),eyes=buildHead(head,m);head.name='head';
  const arms=[];
  for(const s of [-1,1]){
    const clav=group(chest,0,40.8,0),upper=group(clav,s*15.7,0,0),fore=group(upper,0,-26.0,0),hand=group(fore,0,-24,0);
    const side=s<0?'R':'L';upper.name='upperArm'+side;fore.name='forearm'+side;hand.name='hand'+side;
    sleeve(upper,m,s);forearm(fore,m);
    const prop=s<0?swordAndHand(hand,m):null;if(!prop)openHand(hand,m);
    arms.push({s,clav,upper,fore,hand,prop});
  }
  const bladePivot=arms[0].prop.sword;bladePivot.name='swordGrip';
  const updateCord=tassel(bladePivot,m),cordSpace=new T.Matrix4();batch(root);
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const localHand=new T.Quaternion(),worldRot=new T.Quaternion(),rootRot=new T.Quaternion();
  const low=neutralAxis.clone(),half=V(-.88,-.12,.43).normalize(),high=V(-.30,.94,.17).normalize();
  const last=V(-.34,.91,.23).normalize(),end=V(-.36,.89,.25).normalize();
  const setRot=(g,x,y,z)=>g.rotation.set(x*deg,y*deg,z*deg,'YXZ');
  function pose(t){
    const look=smooth(.06,.49,t),lift=smooth(.53,1.44,t),settle=smooth(1.43,1.88,t);
    const gather=Math.sin(Math.PI*smooth(.22,.86,t)),elbow=smooth(.62,1.46,t);
    setRot(chest,1.0+2.6*gather-2.2*lift,-10-5.0*gather+15.4*lift-2*settle,1.9*gather-1.1*lift);
    setRot(head,10.8-12*look+1.5*settle,10+3.1*look-11*lift,1.0-1.5*look);
    for(const [i,{s,clav,upper,fore,hand}] of arms.entries()){
      if(s<0){
        setRot(clav,0,1.3+3*gather,-1.2-5.5*lift+1.1*settle);
        setRot(upper,-8+3*gather-44*lift+4*settle,-8+8*lift,-7-8*gather-6*lift);
        setRot(fore,-11+5*gather-53*elbow+5.3*settle,-1.2-5*elbow,-2.6-3*elbow);
        const direction=low.clone().lerp(half,smooth(.61,1.13,t)).normalize().lerp(high,smooth(1.01,1.62,t)).normalize().lerp(last,smooth(1.62,1.84,t)).lerp(end,smooth(1.80,2,t)).normalize();
        localHand.setFromUnitVectors(low,direction);root.getWorldQuaternion(rootRot);hand.parent.getWorldQuaternion(worldRot);
        hand.quaternion.copy(worldRot.invert()).multiply(rootRot).multiply(localHand);
      }else{
        setRot(clav,0,-1.5*gather,-1.0*lift);setRot(upper,-2.4+7*lift,-3,7+3*gather);setRot(fore,-11-5*gather+1.5*lift,0,2.5);setRot(hand,3-4*gather,0,-4+5*lift);
      }
      eyes[i].map.offset.y=.105*(smooth(.035,.18,t)-.69*smooth(.18,.48,t));
    }
    root.updateMatrixWorld(true);
  }
  // Bake the pendulum from the authored two seconds at a fixed step. Scrubbing and
  // quarter speed then reproduce the same overlap and the same final silhouette.
  const {sword,pin}=arms[0].prop,frames=[],framing=[],dt=1/192,link=1.44,N=7;
  let chain,previous;
  for(let i=0;i<=384;i++){
    pose(i*dt);
    if(i%8===0){
      // Store the blade, grip and bun over the whole take to frame a stable shot from any angle.
      framing.push(sword.localToWorld(V(0,66,0)),sword.localToWorld(V(0,-7,0)),head.localToWorld(V(0,32.3,-3.6)));
    }
    const anchor=root.worldToLocal(sword.localToWorld(pin.clone()));
    if(!chain){chain=Array.from({length:N},(_,k)=>anchor.clone().add(V(0,-k*link,0)));previous=chain.map(p=>p.clone());}
    for(let k=1;k<N;k++){const delta=chain[k].clone().sub(previous[k]).multiplyScalar(.976);previous[k].copy(chain[k]);chain[k].add(delta);chain[k].y-=960*dt*dt;}
    chain[0].copy(anchor);
    for(let n=0;n<10;n++)for(let k=1;k<N;k++){
      const delta=chain[k].clone().sub(chain[k-1]),l=delta.length();delta.multiplyScalar((l-link)/(l||1));
      if(k===1)chain[k].sub(delta);else{chain[k-1].addScaledVector(delta,.49);chain[k].addScaledVector(delta,-.51);}
    }
    frames.push(chain.map(p=>p.clone()));
  }
  function show(t){
    pose(t);const f=clamp(t/2)*384,a=Math.floor(f),b=Math.min(384,a+1);
    cordSpace.copy(bladePivot.matrixWorld).invert().multiply(root.matrixWorld);
    updateCord(frames[a].map((p,i)=>p.clone().lerp(frames[b][i],f-a).applyMatrix4(cordSpace)));
  }
  framing.push(V(-.25,.91,0),V(.25,.91,0));
  show(0);return {root,show,framing};
}
