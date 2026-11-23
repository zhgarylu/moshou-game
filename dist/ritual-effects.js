import * as T from './vendor/three.module.js';
import {sevenStars} from './disciplines.js';
import {starChart,starfall,sealImpact} from './starfall.js';

const tau=2*Math.PI,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const ease=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);
const stars=[[-3.7,-2.2],[-2.1,-1.45],[-1.15,-.14],[.38,.32],[1.66,1.96],[3.54,1.18],[2.92,-.55]];
const chartDiameter=12.7;
const paths=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]];
function tube(fx,group,mat,a,b,width){
  const d=b.clone().sub(a);const mesh=new T.Mesh(fx.own(new T.CylinderGeometry(width,width,d.length(),6)),mat);
  mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());group.add(mesh);return mesh;
}
export function makeRitualEffects(kit,makePriest){
  const {track,basic,mesh,surface,glow,blast,sparks,feedback,sealMap,ground,paint,glyph}=kit;
  let wheel,edict,chart;
  function textures(){
    if(wheel)return;
    wheel=sealMap('罡','#ffdaa0');
    chart=starChart(paint,stars,paths,chartDiameter);
    edict=paint(384,640,(g,w,h)=>{
      const paper=g.createLinearGradient(0,0,w,h);paper.addColorStop(0,'#6c2421');paper.addColorStop(.43,'#b74023');paper.addColorStop(1,'#80221b');
      g.fillStyle=paper;g.fillRect(0,0,w,h);
      for(let i=0;i<3800;i++){
        g.fillStyle=i%3?'rgba(249,194,101,.08)':'rgba(52,17,18,.13)';
        g.fillRect((i*401.43)%w,(i*127.76)%h,.8+2*(i%5),1);
      }
      for(const d of [9,17,28]){g.strokeStyle=d===17?'#fae4a7':'#dba54c';g.lineWidth=d===17?2:4;g.strokeRect(d,d,w-2*d,h-2*d);}
      for(const x of [36,w-36])for(const y of [39,h-39]){
        g.save();g.translate(x,y);g.scale(x>w/2?-1:1,y>h/2?-1:1);
        g.strokeStyle='#fbd990';g.lineWidth=3;g.beginPath();g.moveTo(0,44);g.lineTo(0,6);g.lineTo(48,6);g.lineTo(48,22);g.lineTo(18,22);g.lineTo(18,14);g.stroke();g.restore();
      }
      g.textAlign='center';g.textBaseline='middle';g.fillStyle='#ffe8a8';g.font='bold 34px "Songti SC",serif';g.fillText('北 斗 敕 令',w/2,96);
      g.lineWidth=2;g.strokeStyle='#dfb672';
      for(const y of [132,456]){g.beginPath();g.moveTo(62,y);g.lineTo(w-62,y);g.stroke();}
      g.fillStyle='#641c15';g.font='bold 218px "Songti SC",serif';g.fillText('鎮',w/2+3,289);
      g.fillStyle='#ffeab5';g.fillText('鎮',w/2,285);
      g.font='25px "Songti SC",serif';g.fillStyle='#f3c989';
      for(const [x,line] of [[53,'七元啟明'],[w-53,'攝伏群邪']])Array.from(line).forEach((ch,i)=>g.fillText(ch,x,199+i*54));
      const pts=stars.map(([x,z])=>[w/2+x*22,414+z*8]);g.beginPath();
      for(const [a,b] of paths){g.moveTo(...pts[a]);g.lineTo(...pts[b]);}g.stroke();
      for(const [x,y] of pts){g.beginPath();g.arc(x,y,4.4,0,tau);g.fill();}
      g.strokeStyle='#ffe1a1';g.lineWidth=3;g.strokeRect(w/2-64,485,128,70);
      g.font='bold 47px "Songti SC",serif';g.fillText('伏魔',w/2,522);
    });
  }
  // A visible hand-to-array path ties each large effect to its caster.
  function castTrails(kind,hand,target){
    if(!hand)return;
    const settings={thunder:[5,0x89d6ff,.53],sword:[7,0x9affda,.68],ward:[4,0xffb44e,.72],summon:[3,0xff8862,.80]};
    const [count,color,span]=settings[kind],N=30,up=V(0,1,0);
    const start=V(),end=V(),d=V(),u=V(),side=V(),p=V();
    track(span+.40,fx=>{
      const strands=Array.from({length:count},(_,i)=>{
        const geo=fx.own(new T.BufferGeometry()),pos=new T.BufferAttribute(new Float32Array((N+1)*6),3).setUsage(T.DynamicDrawUsage);
        geo.setAttribute('position',pos);const idx=[];
        for(let j=0;j<N;j++){const a=j*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}geo.setIndex(idx);
        const mat=basic(fx,i%3===1?0xffe6a4:color);
        const trail=mesh(fx.group,geo,mat,0,0,0);trail.frustumCulled=false;
        const tip=glow(fx,fx.group,V(),color);
        return {trail,geo,pos,mat,tip};
      });
      fx.step=t=>{
        if(t<span*.24)hand.getWorldPosition(start);
        for(const [i,s] of strands.entries()){
          const a=tau*i/count,u0=ease(i*.025,span+i*.025,t),tail=Math.max(0,u0-.54),fade=1-ease(span+i*.02,span+.35,t);
          end.set(target.x+Math.cos(a)*(kind==='ward'?2.55:1.7),.38+(kind==='sword'?2.1:0),target.z+Math.sin(a)*1.68);
          d.subVectors(end,start);side.crossVectors(d,up).normalize();
          for(let j=0;j<=N;j++){
            const k=T.MathUtils.lerp(tail,u0,j/N),arch=Math.sin(Math.PI*k),twist=a+(kind==='sword'?3.8:2.1)*k;
            const crack=kind==='thunder'?.16*Math.sin(k*35+i*3):0;
            p.copy(start).addScaledVector(d,k).addScaledVector(side,arch*(Math.cos(twist)*1.15+crack));
            p.y+=arch*((kind==='ward'?1.0:1.64)+.65*Math.sin(twist));
            const width=(kind==='sword'?.055:kind==='ward'?.062:.033)*Math.sin(Math.PI*j/N)**.6+.005;
            u.copy(side).multiplyScalar(width);s.pos.setXYZ(2*j,p.x-u.x,p.y-u.y,p.z-u.z);s.pos.setXYZ(2*j+1,p.x+u.x,p.y+u.y,p.z+u.z);
          }
          s.pos.needsUpdate=true;s.mat.opacity=fade*ease(0,.09,t);s.tip.position.copy(p);
          s.tip.scale.setScalar(kind==='sword'?.54:.42);s.tip.material.opacity=s.mat.opacity*.87;
        }
      };
    });
  }
  const pool=[];
  function invoke(target,onStrike,yaw=0){
    textures();const life=sevenStars.duration,seal=sevenStars.seal,gather=sevenStars.gather;
    track(life,fx=>{
      const field=fx.group;field.position.copy(target);field.rotation.y=yaw;
      const ally=pool.pop()||makePriest();const actor=ally.root;ally.resetMotion();
      field.add(actor);actor.rotation.set(0,-.20,0);
      fx.onEnd=()=>{actor.removeFromParent();actor.scale.setScalar(1);actor.visible=true;pool.push(ally);};
      const ink=surface(fx,field,V(0,.084,0),chartDiameter,chart,0xffffff,false);
      const floorStamp=surface(fx,field,V(0,.105,0),4.6,edict,0xffffff,false);
      floorStamp.scale.set(3.0,4.84,1);floorStamp.renderOrder=2;
      const haloGroup=new T.Group();field.add(haloGroup);
      const outer=mesh(haloGroup,ground,basic(fx,0xffbd55,true,wheel),0,0,0,4.1,4.1,1);
      const corona=mesh(haloGroup,ground,basic(fx,0xffedb3,true,wheel),0,0,.03,3.05,3.05,1);
      const stamp=new T.Group();field.add(stamp);
      const sheet=fx.own(new T.PlaneGeometry(1,1.60,16,34)),verts=sheet.attributes.position;
      for(let i=0;i<verts.count;i++){
        const x=verts.getX(i),y=verts.getY(i);verts.setZ(i,.12*y*y+.018*Math.cos(7*x+5*y));
      }
      const vermilion=basic(fx,0xffffff,false,edict),trim=basic(fx,0xeebd67,false);
      mesh(stamp,sheet,vermilion,0,0,0);
      for(const y of [-.80,.80])tube(fx,stamp,trim,V(-.55,y,.077),V(.55,y,.077),.026);
      const heaven=starfall(kit,fx,field,stars,paths,sevenStars),shock=sealImpact(kit,fx,field,sevenStars);
      const pins=stars.map(([x,z],i)=>{const star=glow(fx,field,V(x,.17,z),i===6?0xff7347:0xffe7a3);
        const paper=glyph(fx,field,i%5,1.27,.50);return {star,paper,x,z};});
      const lines=paths.map(([a,b])=>tube(fx,field,basic(fx,0xffcb63),V(stars[a][0],.14,stars[a][1]),V(stars[b][0],.14,stars[b][1]),.038));
      const cornerMat=basic(fx,0xff5830),threadMat=basic(fx,0xffd879),cage=new T.Group();field.add(cage);
      const corners=Array.from({length:8},(_,i)=>V(4.5*Math.sin(tau*i/8),.14,4.5*Math.cos(tau*i/8)));
      for(let i=0;i<8;i++){
        const a=corners[i],b=corners[(i+1)%8],tip=a.clone().multiplyScalar(.76);tip.y=3.52;
        tube(fx,cage,cornerMat,a,tip,.038);
        for(let j=0;j<3;j++){
          const c=a.clone().lerp(tip,j*.37+.14),d=b.clone().multiplyScalar(1-(.14+.37*((j+1)%3))*.24);d.y=.14+(.14+.37*((j+1)%3))*3.38;
          tube(fx,cage,threadMat,c,d,.022);
        }
      }
      const world=V(),gait={forward:0,side:0,turn:0,dt:0};let chimed=0,gathered=false,struck=false;
      feedback('ritualBell',.7);
      fx.step=(t,dt)=>{
        heaven(t);shock(t);
        const appear=ease(0,.42,t),lift=ease(.15,1.1,t),retreat=ease(3.78,life,t),fade=1-retreat;
        const step=ease(.37,1.42,t),slam=ease(seal.time-.34,seal.time,t)**1.65;
        actor.visible=t<life-.07;actor.position.set(-1.83+.65*step,-.42*(1-appear)-.4*retreat,-2.4+step*.84);
        actor.scale.setScalar(1.35*(.68+.32*appear)*(1-.83*retreat));
        gait.dt=dt;gait.forward=t>.37&&t<1.42?1.1:0;
        if(actor.visible)ally.animate(t<.96?'walk':'ritual',t,ease(.96,seal.time+.12,t),gait);
        haloGroup.position.set(actor.position.x,2.27+lift*.13,actor.position.z-.55);
        outer.rotation.z=.22*t;corona.rotation.z=-.47*t;
        outer.material.opacity=.49*appear*fade;corona.material.opacity=.22*appear*fade;
        ink.material.opacity=appear*fade*(.84+.06*Math.sin(t*4));
        const impression=ease(seal.time-.018,seal.time+.09,t);
        floorStamp.material.opacity=.91*impression*(1-ease(seal.time+.69,life,t));
        const reveal=ease(1.69,2.33,t);
        stamp.visible=t>1.69&&t<seal.time+.09;
        vermilion.opacity=reveal*(1-impression);trim.opacity=vermilion.opacity;
        stamp.position.set(1.45*(1-slam),4.25+.12*Math.sin(3*t)-4.09*slam,-1.32*(1-slam));
        stamp.scale.set(.32+1.48*reveal+1.20*slam,.42+1.46*reveal+1.14*slam,1.2);
        stamp.rotation.set(-Math.PI*.5*slam,-.14*(1-slam),-.10*(1-slam));
        pins.forEach(({star,paper,x,z},i)=>{
          const open=ease(.16+i*.15,.42+i*.15,t);star.scale.setScalar((.46+.21*Math.sin(5*t+i))*open+impression*.52);
          star.material.opacity=open*fade;paper.position.set(x,.26+open*(1.3+.24*Math.sin(t*3+i))+1.5*slam,z);
          paper.scale.set(.52*open,1.29*open,1);paper.material.rotation=.19*Math.sin(t*3+i);paper.material.opacity=open*(1-impression);
        });
        lines.forEach((line,i)=>line.material.opacity=ease(.29+i*.15,.68+i*.15,t)*fade);
        const tension=ease(1.12,2.12,t);cage.visible=tension>0&&t<3.61;cage.scale.set(1-.31*slam,tension*(1-.82*slam),1-.31*slam);
        cornerMat.opacity=.59*tension*(1-ease(seal.time,3.61,t));threadMat.opacity=cornerMat.opacity*.65;
        while(chimed<3&&t>=[.55,1.08,1.67][chimed]){feedback('ritualBell',.46+.11*chimed++);}
        if(!gathered&&t>=gather.time){
          gathered=true;field.getWorldPosition(world);blast(world,0x9fd8ff,gather.radius,.38);
          sparks(world,46,0xbcdfff,3.8,.61,4.0);feedback('starGather',.90);onStrike(world.clone(),gather);
        }
        if(!struck&&!fx.dead&&t>=seal.time){
          struck=true;field.getWorldPosition(world);blast(world,0xffc76c,seal.radius,.65);blast(world,0xf26e3f,5.45,.47);
          sparks(world,94,0xffd78b,7.3,1.13,6.8);feedback('sealStrike',1.2);onStrike(world.clone(),seal);
        }
      };
    });
  }
  return {castTrails,invoke};
}
