// Seven fixed stars on a tilted sky chart. Every trail is drawn along its actual flight to the seal.
import * as T from './vendor/three.module.js';
const tau=2*Math.PI,up=new T.Vector3(0,1,0);
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const ease=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);

const names=['天樞','天璇','天璣','天權','玉衡','開陽','搖光'];
export function starChart(paint,stars,links,diameter){
  return paint(1024,1024,(g,w,h)=>{
    const r=w/2;g.translate(r,r);
    const wash=g.createRadialGradient(0,0,30,0,0,482);
    wash.addColorStop(0,'rgba(18,29,48,.44)');wash.addColorStop(.81,'rgba(25,37,61,.60)');wash.addColorStop(1,'rgba(18,29,48,0)');
    g.fillStyle=wash;g.fillRect(-r,-r,w,h);
    const ring=(size,color,line,from=0,to=tau)=>{g.strokeStyle=color;g.lineWidth=line;g.beginPath();g.arc(0,0,size,from,to);g.stroke();};
    for(const [size,color,lw] of [[472,'#df974f',4],[460,'#ffe5ae',2],[407,'#f6cc8d',3],[399,'#db7955',1.5],[313,'#8496b2',1.5],[187,'#918575',1]])ring(size,color,lw);
    for(let j=0;j<112;j++){g.save();g.rotate(j*tau/112);g.fillStyle=j%4?'#bea37e':'#ffe5b6';g.fillRect(-1,-457,2,j%4?8:17);g.restore();}
    const houses='角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸';
    g.textAlign='center';g.textBaseline='middle';g.font='24px "Kaiti SC",KaiTi,serif';
    for(let j=0;j<28;j++){
      g.save();g.rotate(j*tau/28);g.fillStyle='#fbe2b0';g.fillText(houses[j],0,-425);g.restore();
    }
    for(let j=0;j<8;j++){const a=j*tau/8;ring(375,'#b7ccce',1.5,a+.024,a+.55);ring(364,'#c79b64',2,a+.15,a+.69);}
    const pts=stars.map(([x,z])=>[x*w/diameter,z*h/diameter]);
    for(const [a,b] of links){g.strokeStyle='#e9b769';g.lineWidth=3;g.beginPath();g.moveTo(...pts[a]);g.lineTo(...pts[b]);g.stroke();}
    pts.forEach(([x,y],i)=>{g.save();g.translate(x,y);ring(12,'#ffdeb1',2);g.fillStyle='#fff3cc';g.beginPath();g.arc(0,0,5,0,tau);g.fill();
      g.font='17px "Kaiti SC",KaiTi,serif';g.fillText(names[names.length-1-i],3,-25);g.restore();});
  });
}
function streaming(fx,group,mat,curve,radius){
  const steps=54,sides=6,geo=fx.own(new T.TubeGeometry(curve,steps,radius,sides,false));
  const mesh=new T.Mesh(geo,mat);group.add(mesh);
  return (tail,head)=>{
    const start=Math.floor(steps*tail),end=Math.min(steps,Math.ceil(steps*head));
    geo.setDrawRange(start*sides*6,Math.max(0,end-start)*sides*6);mesh.visible=end>start;
  };
}
function rod(fx,group,mat,a,b,r){
  const d=b.clone().sub(a),mesh=new T.Mesh(fx.own(new T.CylinderGeometry(r,r,d.length(),7)),mat);
  mesh.quaternion.setFromUnitVectors(up,d.normalize());mesh.position.copy(a).lerp(b,.5);group.add(mesh);return mesh;
}
export function starfall(kit,fx,field,stars,links,score){
  const {basic,glow,mesh}=kit,sky=new T.Group();field.add(sky);
  const sources=stars.map(([x,z])=>V(x*1.14,4.98+z*.50,-3.02+z*.26));
  const starMat=basic(fx,0xffeabd),linkMat=basic(fx,0xffbe7b),cloudMat=basic(fx,0x93c9ff);
  const gold=basic(fx,0xffd18b),fire=basic(fx,0xfff0c2),blue=basic(fx,0x81ceff);
  const geometry=fx.own(new T.OctahedronGeometry(1,0)),spark=V();
  const skyLinks=links.map(([a,b])=>rod(fx,sky,linkMat,sources[a],sources[b],.022));
  const points=stars.map(([x,z],i)=>{
    const a=i*tau/7+.32,source=sources[i],end=V(x*.42,.31,z*.42);
    const curve=new T.CatmullRomCurve3([source,V(source.x+.46*Math.cos(a),source.y+.37,source.z+.81),V(x*1.22+.65*Math.sin(a),3.02,z*1.12+.81),V(x*1.01,1.40,z*.90),end]);
    const curls=Array.from({length:38},(_,j)=>{const k=j/37,p=curve.getPointAt(k),width=.24*Math.sin(Math.PI*k);
      p.x+=width*Math.cos(k*11+a);p.z+=width*Math.sin(k*11+a);return p;});
    const body=mesh(sky,geometry,starMat,source.x,source.y,source.z);
    const corona=glow(fx,sky,source,i%2?0xffc781:0xb2e9ff),head=glow(fx,field,end,0xffe2a1);
    return {body,corona,head,curve,veil:streaming(fx,field,blue,curve,.097),core:streaming(fx,field,fire,curve,.029),
      spiral:streaming(fx,field,gold,new T.CatmullRomCurve3(curls),.020)};
  });
  // Broken arcs flank the constellation and leave the actor's face visible through its center.
  const orbit=[];
  for(let i=0;i<4;i++){
    const geo=fx.own(new T.TorusGeometry(4.35+.21*(i%2),i%2?.012:.026,6,64,Math.PI*(i%2?.69:.55)));
    const arc=mesh(sky,geo,i%2?cloudMat:linkMat,0,5.02,-3.19);
    arc.scale.y=.48;orbit.push(arc);
  }
  return t=>{
    const chart=ease(.08,.64,t)*(1-ease(1.76,2.36,t));
    sky.visible=t<2.38;starMat.opacity=chart;cloudMat.opacity=chart*.46;linkMat.opacity=chart*.90;
    orbit.forEach((arc,i)=>{arc.rotation.z=i*Math.PI*.52+.07*t*(i%2?1:-1);});
    skyLinks.forEach((o,i)=>o.visible=t>.23+i*.11);
    const trailFade=1-ease(score.gather.time-.06,score.gather.time+.34,t);
    blue.opacity=.30*trailFade;fire.opacity=.96*trailFade;gold.opacity=.82*trailFade;
    points.forEach(({body,corona,head,curve,veil,core,spiral},i)=>{
      const lit=ease(.12+i*.115,.31+i*.115,t),release=1.06+i*.084;
      const fall=ease(release,score.gather.time-.18+i*.028,t),end=ease(release+.25,score.gather.time+.17+i*.019,t);
      const scale=lit*(1-ease(release,release+.21,t));
      body.scale.set(.11*scale,.28*scale,.11*scale);body.rotation.y=t*1.34+i;
      corona.scale.setScalar(1.03*scale);corona.material.opacity=chart*lit*.78;
      veil(end,fall);core(end,fall);spiral(end,fall);
      curve.getPointAt(fall,spark);head.position.copy(spark);
      head.scale.setScalar(.2+.85*Math.sin(Math.PI*fall));head.material.opacity=fall>0&&fall<1?.94:0;
    });
  };
}

let banners;
function fireBanners(paint){
  if(banners)return banners;
  banners=names.map((name,i)=>paint(224,768,(g,w,h)=>{
    const flame=(x,y,span,length,lean,colors)=>{
      const tint=g.createLinearGradient(0,y,0,y-length);
      colors.forEach(([stop,color])=>tint.addColorStop(stop,color));g.fillStyle=tint;
      g.beginPath();g.moveTo(x-span*.30,y);
      g.bezierCurveTo(x-span,y-length*.38,x+span*.33+lean,y-length*.52,x+lean,y-length);
      g.bezierCurveTo(x+span*.61+lean,y-length*.71,x+span*.61,y-length*.48,x+span*.35,y);
      g.closePath();g.fill();
    };
    for(let j=0;j<17;j++){
      const k=j/16,wind=Math.sin(j*2.2+i*.6),length=h*(.55+.38*Math.sin(Math.PI*k)+.06*wind);
      flame(46+131*k,753,33+26*Math.sin(Math.PI*k),length,wind*26,[
        [0,'rgba(255,219,127,.1)'],[.18,'#ffb14a'],[.49,'rgba(240,95,37,.88)'],[.80,'rgba(206,52,29,.70)'],[1,'rgba(240,91,42,.09)']]);
    }
    const core=g.createLinearGradient(0,180,0,712);core.addColorStop(0,'rgba(139,36,24,0)');core.addColorStop(.22,'rgba(141,36,23,.9)');
    core.addColorStop(.72,'rgba(151,42,21,.90)');core.addColorStop(1,'rgba(255,184,89,0)');
    g.fillStyle=core;g.fillRect(67,180,90,533);
    g.textBaseline='middle';g.textAlign='center';g.fillStyle='#fff3c3';g.font='bold 76px "Kaiti SC","Songti SC",serif';
    g.fillText(name[0],110,344);g.fillText(name[1],110,445);
    g.strokeStyle='#ffe3a1';g.lineWidth=3;g.beginPath();g.moveTo(87,284);g.lineTo(137,284);g.moveTo(95,506);g.lineTo(129,506);g.stroke();
    for(let j=0;j<5;j++)flame(35+j*40,751,8,135+52*Math.cos(j+i),12*Math.sin(j+i),[[0,'#ffe9ac'],[.47,'#ffc065'],[1,'rgba(255,190,107,0)']]);
  }));
  return banners;
}
function raiseStandards(kit,fx,group){
  const {paint,basic,mesh,glow}=kit,tiles=fireBanners(paint),rows=24,cols=4;
  const flags=tiles.map((map,i)=>{
    const geo=fx.own(new T.PlaneGeometry(1,1,cols,rows)),v=geo.attributes.position;
    v.setUsage(T.DynamicDrawUsage);
    const m=basic(fx,0xffffff,false,map),cloth=mesh(group,geo,m,0,0,0);cloth.frustumCulled=false;
    const offset=(i-3)/3;
    const x=offset*4.95,z=-3.9+offset*offset*3.35;
    const plume=glow(fx,group,V(x,.35,z),0xffa747);
    return {x,z,i,offset,cloth,v,m,plume};
  });
  return age=>{
    for(const {x,z,i,offset,cloth,v,m,plume} of flags){
      const u=age-.032*Math.abs(i-3),rise=1-(1-clamp01(u/.39))**2.7;
      const spent=ease(.55,1.43,u),alpha=rise*(1-spent);
      cloth.visible=plume.visible=alpha>.005;if(!cloth.visible)continue;
      const height=(4.06+1.69*(1-Math.abs(offset))+.34*Math.cos(i*2.3))*rise;
      cloth.position.set(x,.10+spent*.90,z);
      for(let j=0;j<=rows;j++)for(let k=0;k<=cols;k++){
        const h=1-j/rows,w=k/cols-.5;
        const wave=(.17*Math.sin(6*h-u*7+i)+.12*Math.cos(10*h+u*8+i))*h;
        const spread=(.76+1.14*Math.sin(Math.PI*h)**.62)*(1-.42*spent)*(.38+.62*rise);
        v.setXYZ(j*(cols+1)+k,w*spread+offset*1.13*h*h+wave,h*height,h*h*.42+Math.sin(w*4+h*5+i-u*7)*.14*h);
      }
      v.needsUpdate=true;m.opacity=alpha;plume.scale.set(1.66*rise,1.25*rise,1);plume.material.opacity=alpha*.80;
    }
  };
}
function clamp01(v){return Math.max(0,Math.min(1,v));}

export function sealImpact(kit,fx,field,score){
  const {basic,mesh,glow}=kit,radius=score.seal.radius,impact=score.seal.time,group=new T.Group();field.add(group);
  const pale=basic(fx,0xffdfa0),ember=basic(fx,0xff8344),smoke=basic(fx,0x9c6e59,false);
  const ring=fx.own(new T.TorusGeometry(1,.012,8,144));
  const rim=mesh(group,ring,pale,0,.17,0),inner=mesh(group,ring,ember,0,.21,0);
  rim.rotation.x=inner.rotation.x=Math.PI/2;
  const pos=[],idx=[];
  for(let i=0;i<=140;i++){
    const a=i*tau/140,k=Math.sin(7*a+.2)*.14+.09*Math.cos(13*a);
    pos.push(Math.sin(a),.08,Math.cos(a),Math.sin(a)*.975,.75+k,Math.cos(a)*.975);
    if(i<140){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const geo=fx.own(new T.BufferGeometry());geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);
  const veil=mesh(group,geo,basic(fx,0xff934e),0,0,0);
  const engravings=[],fractureMat=basic(fx,0xffcb79);
  for(let i=0;i<15;i++){
    const a=tau*i/15+.18*Math.sin(i*3.1),out=V(Math.sin(a),0,Math.cos(a)),side=V(out.z,0,-out.x);
    const curve=new T.CatmullRomCurve3([out.clone().multiplyScalar(.77),out.clone().multiplyScalar(2.33).addScaledVector(side,.48),
      out.clone().multiplyScalar(3.19).addScaledVector(side,-.25),out.clone().multiplyScalar(4.47).addScaledVector(side,.42),out.clone().multiplyScalar(5.5+1.63*(.5+.5*Math.sin(i*2.9)))]);
    for(const p of curve.points)p.y=.095;
    engravings.push(streaming(fx,group,fractureMat,curve,i%3?.024:.041));
  }
  const shardGeo=fx.own(new T.OctahedronGeometry(1)),debris=fx.own(new T.InstancedMesh(shardGeo,smoke,64)),dummy=new T.Object3D();
  debris.frustumCulled=false;group.add(debris);
  const halo=glow(fx,group,V(0,.62,0),0xffc172),standards=raiseStandards(kit,fx,group);
  return t=>{
    const age=t-impact;group.visible=age>=0&&age<1.72;if(!group.visible)return;
    standards(age);
    const wave=ease(0,.59,age),fade=1-ease(.15,.96,age),r=.5+(radius-.5)*wave;
    rim.scale.setScalar(r);inner.scale.setScalar(.45+(radius-.2)*ease(.07,.83,age));
    pale.opacity=.96*fade;ember.opacity=.82*(1-ease(.32,1.03,age));
    veil.scale.set(r,(1-wave)*1.5+.12,r);veil.material.opacity=.36*fade;
    engravings.forEach(draw=>draw(0,ease(0,.30,age)));fractureMat.opacity=(1-ease(.62,1.72,age))*.92;
    halo.scale.set(4.6+4.2*wave,.74+1.15*(1-wave),1);halo.material.opacity=.85*(1-ease(.045,.42,age));
    smoke.opacity=1-ease(.63,1.35,age);debris.visible=age<1.36;
    for(let i=0;i<64&&debris.visible;i++){
      const a=i*2.39996,r0=.84+.97*(i%9)/8,speed=1.9+4.1*((i*19)%43)/42,flight=Math.max(0,age-(i%6)*.017);
      const d=r0+speed*flight, y=flight*(3.4+2.9*(i%8)/7)-5.3*flight*flight;
      dummy.position.set(Math.cos(a)*d,Math.max(.06,y),Math.sin(a)*d);
      dummy.rotation.set(i+flight*3.2,i*2+flight*2.2,i*.4+flight*5);const s=(.043+.081*(i%5)/4)*(1-ease(.73,1.34,age));dummy.scale.set(s*.83,s*(1.2+.9*(i%3)),s);
      dummy.updateMatrix();debris.setMatrixAt(i,dummy.matrix);
    }
    if(debris.visible)debris.instanceMatrix.needsUpdate=true;
  };
}
