import * as T from './vendor/three.module.js';

// 一眉道长的另外三式：墨斗封尸、八卦照妖、茅山神打。七星伏魔仍在 ritual-effects.js。
// 每式都先请道长现身（踏步、起手、施法、退场），演出关键帧通过回调交给 combat 结算。
const tau=Math.PI*2,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const ease=(a,b,t)=>T.MathUtils.smoothstep(t,a,b);

export function makeRites(kit,makePriest,camera=null){
  const {track,basic,mesh,surface,glow,blast,sparks,feedback,sealMap,ground,paint,flash,glyph}=kit;
  const pool=[];let splatMap=null,baguaMap=null,beamMap=null,auraSeal=null,inkMap=null,inkSeal=null,mirrorSeal=null;
  function textures(){
    if(baguaMap)return;
    baguaMap=paint(512,512,(g,w,h)=>{
      g.translate(w/2,h/2);
      const rim=g.createRadialGradient(0,0,120,0,0,250);rim.addColorStop(0,'#2a1a0e');rim.addColorStop(.7,'#7a4b1e');rim.addColorStop(1,'#d9a54e');
      g.fillStyle=rim;g.beginPath();for(let i=0;i<8;i++){const a=tau*i/8+tau/16;g.lineTo(Math.cos(a)*246,Math.sin(a)*246);}g.closePath();g.fill();
      const bits=[7,6,5,4,3,2,1,0];g.fillStyle='#ffe3a0';
      for(let i=0;i<8;i++){g.save();g.rotate(tau*i/8);for(let j=0;j<3;j++){const y=-210+j*20;if(bits[i]&(1<<j))g.fillRect(-36,y,72,11);else{g.fillRect(-36,y,30,11);g.fillRect(6,y,30,11);}}g.restore();}
      const mirror=g.createRadialGradient(-30,-30,10,0,0,128);mirror.addColorStop(0,'#fffbe8');mirror.addColorStop(.5,'#cfe8ea');mirror.addColorStop(1,'#6f8f96');
      g.fillStyle=mirror;g.beginPath();g.arc(0,0,128,0,tau);g.fill();
      g.fillStyle='#1b1410';g.beginPath();g.arc(0,0,58,-Math.PI/2,Math.PI/2);g.arc(0,29,29,Math.PI/2,-Math.PI/2,true);g.arc(0,-29,29,Math.PI/2,-Math.PI/2);g.fill();
      g.strokeStyle='#1b1410';g.lineWidth=4;g.beginPath();g.arc(0,0,58,0,tau);g.stroke();
      g.fillStyle='#fff';g.beginPath();g.arc(0,29,9,0,tau);g.fill();g.fillStyle='#1b1410';g.beginPath();g.arc(0,-29,9,0,tau);g.fill();
    });
    beamMap=paint(64,256,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,240,190,0)');r.addColorStop(.15,'rgba(255,226,150,.9)');r.addColorStop(1,'rgba(255,200,90,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
    splatMap=paint(256,256,(g,w,h)=>{g.translate(w/2,h/2);g.fillStyle='rgba(14,8,4,.92)';
      g.beginPath();for(let i=0;i<=40;i++){const a=i/40*tau,r=70+28*Math.sin(i*2.7)+18*Math.cos(i*5.1);g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.fill();
      for(let i=0;i<22;i++){const a=Math.random()*tau,r=80+Math.random()*40;g.beginPath();g.arc(Math.cos(a)*r,Math.sin(a)*r,3+Math.random()*10,0,tau);g.fill();}
      g.strokeStyle='rgba(255,200,110,.7)';g.lineWidth=3;g.beginPath();g.arc(0,0,52,0,tau);g.stroke();});
    auraSeal=sealMap('神','#ffd77a');inkSeal=sealMap('墨','#f2d08a');mirrorSeal=sealMap('照','#fff0b0');
    inkMap=paint(256,32,(g,w,h)=>{g.fillStyle='#120c08';g.fillRect(0,10,w,12);g.fillStyle='rgba(18,12,8,.6)';for(let x=0;x<w;x+=7)g.fillRect(x,8+Math.random()*4,4,16-Math.random()*6);});
  }
  // 道长落脚处先铺一面本招的地阵：墨（墨斗）、照（八卦）、神（神打）。
  function sigil(fx,at,map,tint,size,life){
    const s=surface(fx,fx.group,at.clone().setY(.075),size,map,tint);
    return t=>{const k=ease(0,.35,t)*(1-ease(life-.5,life,t));s.material.opacity=.85*k;s.rotation.z=t*.6;s.scale.setScalar(size*(.75+.25*k));};
  }
  // 请道长现身：from 处冒出、走一小段、起手施法、life 末缩回地面。
  function cameo(fx,at,yaw,life,{walk=.9,ritualFrom=.9,ritualTo=2}={}){
    const ally=pool.pop()||makePriest();const actor=ally.root;ally.resetMotion();
    fx.group.add(actor);actor.position.copy(at);actor.rotation.set(0,yaw,0);
    fx.onEnd=()=>{actor.removeFromParent();actor.scale.setScalar(1);actor.visible=true;pool.push(ally);};
    const gait={forward:0,side:0,turn:0,dt:0},dir=V(Math.sin(yaw),0,Math.cos(yaw));
    return (t,dt)=>{
      const appear=ease(0,.4,t),retreat=ease(life-.6,life,t);
      actor.visible=t<life-.05;
      actor.position.copy(at).addScaledVector(dir,.7*ease(.2,walk,t));actor.position.y=-.4*(1-appear)-.5*retreat;
      actor.scale.setScalar(1.3*(.7+.3*appear)*(1-.8*retreat));
      gait.dt=dt;gait.forward=t>.2&&t<walk?1:0;
      if(actor.visible)ally.animate(t<walk?'walk':'ritual',t,ease(ritualFrom,ritualTo,t),gait);
      return actor;
    };
  }
  // 墨斗封尸：三道墨线从道长手中弹出，崩直后钉在院中 6 秒。
  function ink(player,aim,onSnap){
    textures();const life=6.6,snap=1.3;
    const dir=aim.clone().sub(player).setY(0);if(dir.lengthSq()<.01)dir.set(0,0,-1);dir.normalize();
    const yaw=Math.atan2(dir.x,dir.z),side=V(dir.z,0,-dir.x),at=player.clone().addScaledVector(side,-1.5).addScaledVector(dir,-.4);
    const lines=[-.42,0,.42].map(a=>{
      const d=dir.clone().applyAxisAngle(V(0,1,0),a),start=at.clone().addScaledVector(dir,.8).setY(.45);
      const end=start.clone().addScaledVector(d,15);end.x=T.MathUtils.clamp(end.x,-14.5,14.5);end.z=T.MathUtils.clamp(end.z,-12.5,12.5);
      return {start,end};
    });
    feedback('ritualBell',.6);
    track(life,fx=>{
      const priest=cameo(fx,at,yaw,3.3,{walk:.8,ritualFrom:.8,ritualTo:1.6}),floor=sigil(fx,at,inkSeal,0xffd27a,5.5,3.4);
      const parts=lines.map(({start,end})=>{
        const len=start.distanceTo(end),mid=start.clone().lerp(end,.5),q=new T.Quaternion().setFromUnitVectors(V(1,0,0),end.clone().sub(start).normalize());
        // 墨线做成一条竖立的粗墨带（侧看也有厚度），外裹金光，线上挂三张镇尸符。
        const core=mesh(fx.group,ground,basic(fx,0xffffff,false,inkMap),mid.x,mid.y,mid.z,len,.26,1);core.quaternion.copy(q);
        const flat=mesh(fx.group,ground,basic(fx,0xffffff,false,inkMap),mid.x,mid.y,mid.z,len,.26,1);flat.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));
        const halo=mesh(fx.group,ground,basic(fx,0xffc25a),mid.x,mid.y,mid.z,len,.9,1);halo.quaternion.copy(q);
        const pins=[start,end].map(p=>glow(fx,fx.group,p.clone(),0xffd27a));
        const charms=[.25,.5,.75].map(u=>({u,paper:glyph(fx,fx.group,6,1.05,.46)}));
        return {core,flat,halo,pins,charms,len,start,end};
      });
      let snapped=false;const splats=[];
      fx.step=(t,dt)=>{
        priest(t,dt);floor(t);
        for(const sp of splats){sp.material.opacity=.85*(1-ease(life-1,life,t));sp.rotation.z+=dt*.05;}
        const reach=ease(snap-.35,snap,t),fade=1-ease(life-.8,life,t);
        for(const p of parts){
          const k=Math.max(.001,reach);
          p.core.scale.x=p.flat.scale.x=p.halo.scale.x=p.len*k;
          const mid=p.start.clone().lerp(p.end,k*.5);for(const m of [p.core,p.flat,p.halo])m.position.set(mid.x,mid.y,mid.z);
          // 崩直的一瞬间墨线弹起一下，金光最亮。
          const twang=t>snap?Math.exp(-(t-snap)*9)*Math.sin((t-snap)*60):0;
          for(const m of [p.core,p.flat,p.halo])m.position.y+=twang*.25;
          p.core.material.opacity=p.flat.material.opacity=reach*fade;p.halo.material.opacity=(t<snap?.25:.35+.6*Math.exp(-(t-snap)*4))*reach*fade*(.8+.2*Math.sin(t*9));
          p.pins.forEach(pin=>{pin.scale.setScalar(1.6);pin.material.opacity=reach*fade;});
          p.charms.forEach(({u,paper},i)=>{const at=p.start.clone().lerp(p.end,u*k);paper.position.set(at.x,at.y-.45+twang*.25,at.z);
            paper.material.rotation=.35*Math.sin(t*4+i+u*9);paper.material.opacity=ease(snap,snap+.2,t)*fade;});
        }
        if(!snapped&&t>=snap&&!fx.dead){
          snapped=true;feedback('inkSnap',1);
          feedback('hitstop',.25);feedback('thunder',.5);
          for(const p of parts){
            // 金雷沿墨线一路疾走，线上每段炸开墨花，线中央泼下一大摊墨。
            for(let k=0;k<3;k++)flash(p.start.clone().setY(.6),p.end.clone().setY(.6),k?0xffe6a0:0xffc040,.9);
            for(let i=1;i<=4;i++){const q=p.start.clone().lerp(p.end,i/5);sparks(q,26,0x140c06,4.5,.8,6);blast(q.clone().setY(0),0xffd27a,1.8,.35);}
            splats.push(surface(fx,fx.group,p.start.clone().lerp(p.end,.5).setY(.06),4.2,splatMap,0xffffff,false));
          }
          onSnap(parts.map(p=>({a:p.start.clone().setY(0),b:p.end.clone().setY(0)})),life-snap);
        }
      };
    });
  }
  // 八卦照妖：八卦镜举过头顶，朝目标照出一道扇形金光。
  function mirror(player,aim,onFlash){
    textures();const life=3.9,shine=1.4,range=17,spread=.55;
    const dir=aim.clone().sub(player).setY(0);if(dir.lengthSq()<.01)dir.set(0,0,-1);dir.normalize();
    const yaw=Math.atan2(dir.x,dir.z),side=V(dir.z,0,-dir.x),at=player.clone().addScaledVector(side,1.4).addScaledVector(dir,-.3);
    feedback('ritualBell',.6);
    track(life,fx=>{
      const priest=cameo(fx,at,yaw,life,{walk:.8,ritualFrom:.8,ritualTo:1.5}),floor=sigil(fx,at,mirrorSeal,0xfff0b0,5,life);
      // 照出去的那一刻，目标处地面投出一面巨大的八卦。
      const spot=aim.clone().setY(.08),projection=surface(fx,fx.group,spot,9,baguaMap,0xffe6a0);
      const disc=mesh(fx.group,ground,basic(fx,0xffffff,false,baguaMap),0,0,0,1.5,1.5,1);
      // 道长身后升起一面巨大的八卦光轮；照中时目标四周立起八道卦象光柱。
      const wheel=mesh(fx.group,ground,basic(fx,0xffe6a0,true,baguaMap),0,0,0,1,1,1);
      const pillarsGeo=fx.own(new T.CylinderGeometry(.32,.45,8,14,1,true));
      const pillars=Array.from({length:8},(_,i)=>{const a=i/8*tau;return mesh(fx.group,pillarsGeo,basic(fx,0xffd27a),spot.x+Math.cos(a)*5,4,spot.z+Math.sin(a)*5);});
      const shineGlow=glow(fx,fx.group,V(),0xfff0b0);
      const cone=new T.Mesh(fx.own(new T.ConeGeometry(Math.tan(spread)*range,range,40,1,true)),basic(fx,0xffe08a,true,beamMap));
      cone.material.side=T.DoubleSide;fx.group.add(cone);
      let fired=false;const mouth=V();
      fx.step=(t,dt)=>{
        const actor=priest(t,dt),raise=ease(.7,1.25,t),fade=1-ease(life-.7,life,t);floor(t);
        wheel.position.copy(actor.position).addScaledVector(dir,-.8);wheel.position.y=3.2;wheel.rotation.set(0,yaw+Math.PI,0);wheel.rotateZ(-t*.8);
        wheel.scale.setScalar(5.5*raise);wheel.material.opacity=.55*raise*fade;
        const cast=ease(shine,shine+.25,t);
        pillars.forEach((pl,i)=>{const k=ease(shine+i*.04,shine+.2+i*.04,t)*(1-ease(life-.9,life,t));pl.material.opacity=.6*k;pl.scale.set(1,Math.max(.01,k),1);pl.position.y=4*k;});
        projection.material.opacity=.85*cast*fade;projection.rotation.z=-t*1.2;projection.scale.setScalar(9*(.6+.4*cast));
        mouth.copy(actor.position).addScaledVector(dir,.6);mouth.y=1.7+1.1*raise;
        disc.position.copy(mouth);disc.rotation.set(0,yaw+Math.PI,0);disc.rotateZ(t*2.4);disc.material.opacity=ease(.3,.8,t)*fade;
        disc.scale.setScalar(1.1+.5*raise);
        shineGlow.position.copy(mouth);shineGlow.scale.setScalar(2+3*Math.exp(-Math.max(0,t-shine)*5)*(t>shine?1:0));shineGlow.material.opacity=raise*fade*.8;
        // 光锥从镜面朝外，顶点在镜心。
        const aimDown=dir.clone().setY(-(mouth.y-.9)/range).normalize();
        cone.position.copy(mouth).addScaledVector(aimDown,range/2);cone.quaternion.setFromUnitVectors(V(0,-1,0),aimDown);
        const beamOn=t>shine?Math.exp(-(t-shine)*1.2):0;cone.material.opacity=.85*beamOn*fade;cone.visible=t>shine;
        if(!fired&&t>=shine&&!fx.dead){fired=true;feedback('mirror',1);feedback('hitstop',.25);blast(mouth.clone().setY(.1),0xffe3a0,2.4,.4);onFlash(mouth.clone().setY(0),dir.clone(),range,spread);}
      };
    });
  }
  // 茅山神打：道长在玩家身后起手，化作金光没入玩家体内。
  function possess(getPlayer,yaw,onMerge){
    textures();const life=3.2,merge=1.7,player=getPlayer().clone();
    // 道长站在玩家正前方、面朝玩家施法，不挡镜头。
    const ahead=V(-Math.sin(yaw),0,-Math.cos(yaw)),at=player.clone().addScaledVector(ahead,3);
    feedback('ritualBell',.7);
    track(life,fx=>{
      const priest=cameo(fx,at,yaw,merge+.25,{walk:.6,ritualFrom:.6,ritualTo:1.4});
      const streak=glow(fx,fx.group,V(),0xffd77a);let merged=false;
      const spiral=Array.from({length:10},()=>glyph(fx,fx.group,6,1,.44));
      fx.step=(t,dt)=>{
        const actor=priest(t,dt),pull=ease(1.2,merge,t),p=getPlayer();
        // 十张护身符绕着玩家盘旋上升成柱，合身时一齐炸散。
        spiral.forEach((s,i)=>{const k=ease(.6+i*.05,merge,t),gone=ease(merge,merge+.3,t),a=t*5+i*tau/10,r=1.4-.5*k+2*gone;
          s.position.set(p.x+Math.cos(a)*r,.3+k*3.4+i*.12,p.z+Math.sin(a)*r);s.material.opacity=ease(.6+i*.05,.8+i*.05,t)*(1-gone);});
        streak.position.copy(actor.position).lerp(p,pull);streak.position.y=1.3;streak.scale.setScalar(1.5+2.5*pull);streak.material.opacity=ease(1,1.3,t)*(1-ease(merge,merge+.3,t));
        if(!merged&&t>=merge&&!fx.dead){merged=true;feedback('possess',1);feedback('hitstop',.3);feedback('thunder',.7);flash(p.clone().setY(24),p.clone().setY(.1),0xffd060,1.5,true);blast(p.clone(),0xffd77a,3.2,.5);sparks(p.clone().setY(1),60,0xffe6a0,4.5,.8,3);onMerge();}
      };
    });
  }
  // 神打附身期间，脚下金印与三张护身符绕身旋转。
  function aura(getPlayer,life,getYaw=()=>0){
    textures();
    track(life,fx=>{
      const ring=surface(fx,fx.group,V(0,.07,0),4.2,auraSeal,0xffd27a);
      // 金身法相：道长的巨大金色虚影立在玩家身后，跟着施法。
      const ghost=makePriest(),gold=new T.MeshBasicMaterial({color:0xffc860,transparent:true,opacity:.32,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
      ghost.root.traverse(o=>{if(o.isMesh){o.material=gold;o.castShadow=false;}});fx.group.add(ghost.root);
      fx.onEnd=()=>ghost.root.removeFromParent();
      const flame=mesh(fx.group,fx.own(new T.CylinderGeometry(1.1,1.4,1.2,24,1,true)),basic(fx,0xffc860),0,.6,0);
      const papers=[0,1,2].map(()=>glyph(fx,fx.group,6,.7,.3));
      fx.step=t=>{
        const p=getPlayer(),fade=1-ease(life-.6,life,t),pulse=.8+.2*Math.sin(t*6);
        fx.group.position.set(p.x,0,p.z);ring.rotation.z=t*1.5;ring.material.opacity=.8*fade*pulse;
        const yaw=getYaw(),grow=ease(0,.5,t);
        // 法相站在玩家左前方，面朝同一方向，不挡在镜头与玩家之间。
        const fx_=-Math.sin(yaw),fz=-Math.cos(yaw);
        ghost.root.position.set(fx_*1.2+fz*2.6,-.2,fz*1.2-fx_*2.6);ghost.root.rotation.y=yaw+Math.PI;ghost.root.scale.setScalar(2.4*grow);
        ghost.animate('ritual',t,.5+.5*Math.sin(t*2),{dt:1/60,forward:0,side:0,turn:0});gold.opacity=.24*fade*(.85+.15*Math.sin(t*5));
        flame.material.opacity=.16*fade*pulse;flame.rotation.y=t*2;
        papers.forEach((s,i)=>{const a=t*2.4+tau*i/3;s.position.set(Math.cos(a)*1.1,1.2+.25*Math.sin(t*3+i),Math.sin(a)*1.1);s.material.opacity=fade;});
      };
    });
  }
  // 被照出原形的敌人头顶浮着一面小八卦，持续到易伤结束。
  function exposedMark(getPos,life){
    textures();
    track(life,fx=>{
      const m=new T.Sprite(fx.own(new T.SpriteMaterial({map:baguaMap,color:0xffe6a0,transparent:true,depthWrite:false,toneMapped:false})));fx.group.add(m);
      fx.step=t=>{const p=getPos();if(!p){m.visible=false;return;}m.position.set(p.x,3.3+.12*Math.sin(t*4),p.z);m.material.rotation=t*2;
        const k=ease(0,.2,t)*(1-ease(life-.4,life,t));m.scale.setScalar(1.1*k);m.material.opacity=k;};
    });
  }
  // 神打期间普攻附带的掌心雷。
  function palm(from,to){flash(from.clone().setY(1.4),to.clone().setY(1),0xffd77a,1.6);flash(to.clone().setY(8),to.clone().setY(.1),0xffe6a0,.9,true);blast(to.clone(),0xffd77a,2.6,.35);sparks(to.clone().setY(1),24,0xffe6a0,4,.5,6);}
  return {ink,mirror,possess,aura,palm,exposedMark};
}
