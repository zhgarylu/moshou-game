import * as THREE from './vendor/three.module.js';
import {buildCourtyard} from './courtyard.js';
import {makeBattleActor,preloadBattleActors} from './battle-actors.js';
import {makeEffects} from './spells.js';
import {makeAtmosphere} from './atmosphere.js';
import {preloadWardRelic} from './ward-effects.js';
import {actionTiming} from './action-timing.js';

import {disciplines,sevenStars,stickyRice,judgeMoves,priestMoves} from './disciplines.js';
import {relicTimes,freshMods,drawRelics} from './relics.js';
import {makePaperActor,makeFlyerActor,makeImpActor} from './minions.js';
import {PAPER,FLYER,BLACK,WHITE,foes,chargeLength,chargeHalfWidth,prisonRadius,makeEnvoySigns} from './envoys.js';

const clamp=THREE.MathUtils.clamp;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

const duration=90;
const phaseNames=['第一更 · 黑使巡夜','第二更 · 白幡引魂','第三更 · 阴差叩门','终更 · 黑白同临'];
const waves=[
  [0,BLACK,-2.8,-1.5],[0,0,3,-4],[4,0,-7,-5],[8,WHITE,4,-4],[11,0,-6,0],[16,0,4,-8],[20,0,-6,-8],
  [24,1,-6,-5],[24,0,7,-6],[29,0,10,-1],[34,0,-10,1],[35,WHITE,-5,-6],[39,1,1,-9],
  [44,0,10,-7],[48,BLACK,5,-3],[50,2,0,-10],[54,0,-7,-6],[58,1,-10,2],[62,0,9,-5],
  [66,1,3,-9],[70,2,-4,-8],
  // 纸人三只一队从院门两侧涌入；飞头蛮从屋檐上方掠下。
  [6,PAPER,-9,-9],[6.4,PAPER,-8,-10],[6.8,PAPER,-10,-8],[14,FLYER,8,-10],[19,PAPER,9,-9],[19.4,PAPER,8,-10],[19.8,PAPER,10,-8],
  [33,PAPER,-3,-11],[33.4,PAPER,0,-11],[33.8,PAPER,3,-11],[40,FLYER,-9,-9],[46,PAPER,-10,-3],[46.4,PAPER,-10,-5],[46.8,PAPER,-10,-1],
  [55,FLYER,9,-6],[61,FLYER,-8,-10],[63,PAPER,9,-2],[63.4,PAPER,9,-4],[63.8,PAPER,9,0],[75,FLYER,0,-11],[79,PAPER,-4,-11],[79.4,PAPER,0,-11],[79.8,PAPER,4,-11],[72,BLACK,-4,-3],[72,WHITE,4,-5],[77,0,-7,1],[81,1,7,-2],[85,0,-8,-7]
];
waves.sort((a,b)=>a[0]-b[0]);
const slowMotionMedia=matchMedia('(prefers-reduced-motion: reduce)');
function angleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
function turn(obj,angle,dt,rate=11){
  const error=angleDelta(obj.rotation.y,angle);
  obj.rotation.y+=clamp(error*(1-Math.exp(-15*dt)),-rate*dt,rate*dt);
}
function localMotion(motion,root,fromX,fromZ,fromYaw,dt){
  const dx=(root.position.x-fromX)/dt,dz=(root.position.z-fromZ)/dt;
  const sin=Math.sin(root.rotation.y),cos=Math.cos(root.rotation.y);
  motion.forward=dx*sin+dz*cos;motion.side=dx*cos-dz*sin;
  motion.turn=angleDelta(fromYaw,root.rotation.y)/dt;motion.dt=dt;
  return motion;
}
function ringGeometry(){const geometry=new THREE.RingGeometry(.82,1,56);geometry.rotateX(-Math.PI/2);return geometry;}
export async function createCombat(host,ui,audio,firstClass='thunder'){
  function loadClass(id, shared=[]){
    return Promise.all([preloadBattleActors([id,...shared]),id==='ward' && preloadWardRelic()]);
  }
  await loadClass(firstClass,['corpse','black','white','judge','priest']);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.replaceChildren(renderer.domElement);const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('aria-label','槐阴义庄战场，使用键盘移动和施法');
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(54,1,.12,160),court=buildCourtyard(scene);
  const atmosphere=makeAtmosphere(renderer);
  let classId=firstClass,spec=disciplines[firstClass],master=makeBattleActor(classId),pos=master.root.position;
  let castingHand=master.root.getObjectByName('handR'),basicStrike=null,followTime=0;
  const palm=V();
  scene.add(master.root);
  const enemySigns=makeEnvoySigns(scene);
  const pool=foes.map(()=>[]),enemies=[],keys=new Set(),joy={x:0,y:0};
  const shape=ringGeometry(),reticle=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:0xedc882,transparent:true,opacity:.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  reticle.position.y=.045;scene.add(reticle);
  const groundMarker=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:0x88dfec,transparent:true,opacity:.66,depthWrite:false}));
  groundMarker.scale.setScalar(2.15);groundMarker.visible=false;scene.add(groundMarker);let hoverPoint=null;
  const fill=new THREE.HemisphereLight(0xbcdcf5,0x655346,.16);scene.add(fill);
  const portraitLight=new THREE.DirectionalLight(0xffe4c6,.82);
  scene.add(portraitLight,portraitLight.target);
  const punch=new THREE.DirectionalLight(0xd5eeff,0);punch.position.set(-4,14,2);scene.add(punch);
  const spellLight=new THREE.PointLight(0xb3edff,0,20,1.6);scene.add(spellLight);
  const fx=makeEffects(scene,(kind,power=1)=>{
    if(kind==='hitstop'){hitstop=Math.max(hitstop,power);return;}
    audio.sound(kind,power);
    if(['thunder','slash','gong','rumble','sealStrike','devour'].includes(kind)){
      const amp=kind==='devour'?.42:kind==='thunder'?.19:kind==='slash'||kind==='sealStrike'?.33:kind==='gong'?.1:.08;
      shake=Math.max(shake,power*amp);if(kind==='thunder'||kind==='slash'||kind==='sealStrike')surge=Math.max(surge,power);
    }
  },{judge:()=>makeBattleActor('judge'),priest:()=>makeBattleActor('priest')},cam);
  let special=fx.forClass(classId);
  async function selectClass(id){
    if(classId===id)return;
    const next=disciplines[id];
    await loadClass(id);
    const replacement=makeBattleActor(id);
    master.root.removeFromParent();master.dispose();master=replacement;scene.add(master.root);
    pos=master.root.position;castingHand=master.root.getObjectByName('handR');
    classId=id;spec=next;special=fx.forClass(id);
    await prepareEntry();
  }
  let state='idle',t=0,timeLeft=90,hp=100,seals=3,sealCharge=0,kills=0,markCount=0,chainCount=0,thunderCount=0,summonCount=0,priestCount=0;
  let wardHp=0,wardTime=0,envoyKills=0,tetherEnemy=null,tetherTime=0;
  function breakTether(){tetherEnemy=null;tetherTime=0;enemySigns.tether(null);}
  function dismiss(e){e.ring.visible=false;e.sign?.hide();}
  const IMP_COLORS=[0x3fe0a0,0xff5030,0xf4f0e4,0x7a66ff,0xffc040];
  let hitstop=0,godMode=false,inkLines=[],imps=[],possessed=0,spokeHurt=false,mods=freshMods(),picked=[],nextRelic=0,nextWave=0,phase=0,yaw=0,pitch=.40,shake=0,surge=0,hurt=0,immune=0,dash=0,cool={},cast=0,castMax=0;
  let castPose='attack',castYaw=0,evade=0,focus=null,focusLife=0,focusSpan=0,focusRite=false,focusGate=false,dim=0,primary=null,bannerTime=0,msgTime=0,hudTick=0,loopId=0,prev=0,activeTouch=null;
  const velocity=V(),masterMotion={};
  // Retina screens rarely need full 2x for a 3D scene; adapt down to 0.85 when frames drop.
  const preferredScale=Math.min(1.6,Math.max(1,devicePixelRatio));
  let pixelScale=preferredScale,perfTime=0,perfCount=0;
  const dashDir=V(),camFocus=V(),camBase=V(),desiredCam=V(),desiredFocus=V(),aimDir=V(),tmp=V(),project=V(),ray=new THREE.Raycaster(),plane=new THREE.Plane(V(0,1,0),0);
  function resize(){const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);renderer.setPixelRatio(pixelScale);renderer.setSize(w,h,false);atmosphere.resize(canvas.width,canvas.height);cam.aspect=w/h;cam.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(host);resize();
  function resetCamera(){camBase.set(0,6.5,15);cam.position.copy(camBase);camFocus.set(0,1.55,1);cam.lookAt(camFocus);cam.updateMatrixWorld();}
  function release(e){if(e===tetherEnemy)breakTether();e.actor.root.removeFromParent();dismiss(e);pool[e.type].push(e);}
  function spawn(type,x,z){
    let e=pool[type].pop();
    const kind=foes[type];
    if(!e){
      const actor=kind.model==='paper'?makePaperActor():kind.model==='flyer'?makeFlyerActor():makeBattleActor(kind.model,type);
      const ring=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:0xff6c3c,transparent:true,opacity:.6,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
      scene.add(ring);
      e={actor,ring,type,sign:type>=BLACK?enemySigns.create(type):null,origin:V(),anchor:V(),attackDir:V(),motion:{}};
    }
    Object.assign(e,{hp:kind.hp,max:kind.hp,speed:kind.speed,seed:Math.random()*5,marked:0,slow:0,exposed:0,devour:0,inkSafe:0,stagger:0,dead:0,stage:'chase',clock:0,
      wait:type===WHITE?2.5:type===BLACK?2.2:type===FLYER?2.6:type===PAPER?.4:.7,wind:type===WHITE?1.35:type===BLACK?1.12:type===FLYER?.85:type===PAPER?.42:type===2?.91:.73,
      reach:type===WHITE?8.9:type===BLACK?6.8:type===FLYER?1.5:type===PAPER?1.6:type===2?3.3:2.3,orbit:Math.random()*Math.PI*2,hitOnce:false,staggerSpan:0});
    if(state==='play'&&type===BLACK)audio.voice('black.enter',{channel:'black',gain:.9});
    if(state==='play'&&type===WHITE)audio.voice('white.enter',{channel:'white',gain:.9});
    if(type===FLYER)e.actor.lift=2.4;
    e.actor.root.visible=true;e.actor.root.position.y=0;
    const p=e.actor.root.position;p.set(x,0,z);e.actor.root.scale.setScalar(type===2?1.18:1);e.actor.root.rotation.y=Math.atan2(pos.x-x,pos.z-z);
    e.ring.visible=false;e.actor.resetMotion?.();e.actor.animate('idle',t+e.seed,1);scene.add(e.actor.root);enemies.push(e);
  }
  const prepared=new Set();
  async function prepareEntry(){
    if(prepared.has(classId))return;
    try {
      resetCamera();
      for(const type of [0,PAPER,FLYER,BLACK,WHITE])spawn(type,type-3,0);
      fx.prime(classId,renderer);
      await atmosphere.prepare(scene,cam);
      prepared.add(classId);
    } finally {
      fx.clear();
      while(enemies.length)release(enemies.pop());
    }
  }
  function phaseOf(){return t>=70?3:t>=49?2:t>=24?1:0;}
  function notice(s,seconds=1.9){ui.notice(s);msgTime=seconds;}
  function banner(s,sub,seconds=1.9){ui.banner(s,sub);bannerTime=seconds;}
  function start(){
    cancelAnimationFrame(loopId);fx.clear();while(enemies.length)release(enemies.pop());keys.clear();joy.x=joy.y=0;
    Object.assign(cool={},{mark:0,chain:0,rice:0,dodge:0,thunder:0,summon:0,priest:0});spokeHurt=false;clearAllies();possessed=0;mods=freshMods();picked=[];nextRelic=0;t=0;timeLeft=duration;hp=100;seals=3;sealCharge=0;kills=markCount=chainCount=thunderCount=summonCount=priestCount=0;
    phase=nextWave=0;yaw=0;pitch=.40;shake=surge=dim=hurt=immune=dash=cast=focusLife=focusSpan=hudTick=perfTime=perfCount=0;primary=null;focus=null;focusRite=false;activeTouch=null;
    wardHp=wardTime=envoyKills=followTime=0;basicStrike=null;breakTether();
    pos.set(0,0,5);velocity.set(0,0,0);evade=0;master.root.rotation.set(0,Math.PI,0);master.resetMotion?.();master.animate('idle',0,1);reticle.visible=false;groundMarker.visible=false;hoverPoint=null;
    resetCamera();court.setSurge(0);punch.intensity=0;ui.damage(0);ui.target(null);ui.banner('','');ui.notice('');
    state='play';audio.ambience(true);banner('棺铃初动','槐阴镇 · 第一更',1.8);
    notice('黑无常冲撞时向侧面闪避。R '+spec.thunder.name+'　Q 请钟馗　E 请道长',5);
    while(nextWave<waves.length&&waves[nextWave][0]===0){const [,type,x,z]=waves[nextWave++];spawn(type,x,z);}
    pickPrimary();syncHud();resize();cameraStep(1);atmosphere.render(scene,cam,surge,dim);canvas.focus({preventScroll:true});prev=performance.now();loopId=requestAnimationFrame(frame);
  }
  function finish(win){
    if(state!=='play')return;state='over';keys.clear();joy.x=joy.y=0;audio.ambience(false);audio.sound(win?'win':'lose');ui.target(null);ui.notice('');ui.banner('','');ui.damage(0);
    if(win)audio.voice(classId+'.win',{delay:.6});
    ui.end({win,kills,relics:picked,elapsed:Math.min(duration,Math.floor(t)),thunder:thunderCount,summon:summonCount,priest:priestCount,envoys:envoyKills});
  }
  function offerRelic(){
    nextRelic++;const choices=drawRelics(classId,picked);if(!choices.length)return;
    state='relic';keys.clear();joy.x=joy.y=0;activeTouch=null;audio.ambience(false);audio.sound('chime',.9);
    const context={heal:n=>{hp=Math.min(100,hp+n);},fillSeals:()=>{seals=3;sealCharge=0;}};
    ui.relic(choices,nextRelic,relic=>{
      if(state!=='relic')return;
      picked.push(relic.id);relic.apply(mods,context);audio.sound('seal',1.2);
      state='play';audio.ambience(true);syncHud();banner(relic.name,'法宝加身',2.2);
      prev=performance.now();canvas.focus({preventScroll:true});loopId=requestAnimationFrame(frame);
    });
  }
  function pause(){if(state!=='play')return false;state='paused';keys.clear();joy.x=joy.y=0;activeTouch=null;audio.ambience(false);cancelAnimationFrame(loopId);return true;}
  function resume(){if(state!=='paused')return;state='play';audio.ambience(true);prev=performance.now();canvas.focus({preventScroll:true});loopId=requestAnimationFrame(frame);}
  function leave(){clearAllies();state='idle';breakTether();cancelAnimationFrame(loopId);keys.clear();fx.clear();while(enemies.length)release(enemies.pop());audio.ambience(false);ui.damage(0);ui.target(null);}
  function pickPrimary(point){
    let best=null,score=Infinity;const facing=V(-Math.sin(yaw),0,-Math.cos(yaw));
    for(const e of enemies){if(e.hp<=0)continue;const p=e.actor.root.position,d=p.distanceTo(pos);let s=d;if(point)s=p.distanceTo(point);else if(d>.15)s+=Math.max(0,1-((p.x-pos.x)*facing.x+(p.z-pos.z)*facing.z)/d)*2.2;
      if(s<score){score=s;best=e;}}
    if(point&&score>3.5)return null;return best;
  }
  function groundAim(){return V(clamp(pos.x-Math.sin(yaw)*6,-13,13),0,clamp(pos.z-Math.cos(yaw)*6,-11,11));}
  function damageEnemy(e,amount,stun){
    if(e.hp<=0)return;
    e.hp=Math.max(0,e.hp-amount*mods.dmg*(possessed>0?1.4:1)*(e.exposed>0?1.5:1));
    // A glancing basic attack chips the officials' health while their warning stays readable.
    if(e.hp===0 || e.type<BLACK || stun>=.65){
      e.stagger=e.staggerSpan=Math.max(e.stagger,stun);dismiss(e);e.stage='chase';e.wait=Math.max(e.wait,.35);
      if(e===tetherEnemy)breakTether();
    }
    if(e.hp===0){
      e.dead=.01;kills++;
      if(e.type===PAPER){fx.hit(e.actor.root.position,0xf3ecdc);fx.hit(e.actor.root.position,0xd9b45c);}
      if(e.type>=BLACK){
        envoyKills++;
        const recovery=Math.min(12,100-hp);
        hp+=recovery;
        if(recovery)notice(foes[e.type].name+'已伏 · 回元 '+recovery,1.7);
      }
      if(seals<3 && ++sealCharge>=mods.sealPer){sealCharge=0;seals++;if(seals===3)notice('三枚天师印已齐，可再次请神。');}
    }
  }
  function area(center,radius,amount,stun,color=0xffc97c,after=null){
    for(const e of enemies){
      if(e.hp<=0||e.actor.root.position.distanceTo(center)>radius)continue;
      const bonus=after?.(e) || 0;
      damageEnemy(e,amount+bonus,stun);fx.hit(e.actor.root.position,color);
    }
  }
  function pose(name,at){
    const minor=name==='attack'||name==='cast';
    const sustaining=castPose==='ultimate'||castPose==='invoke'||(castPose==='cast'&&name==='attack');
    if(cast>0 && minor && sustaining && castMax-cast<actionTiming(classId,castPose).cancelAfter){
      followTime=actionTiming(classId,'attack').duration;
      return;
    }
    castYaw=Math.atan2(at.x-pos.x,at.z-pos.z);
    castPose=name;cast=castMax=actionTiming(classId,name).duration;followTime=0;
  }
  function advanceBasic(){
    if(!basicStrike)return;
    const strike=basicStrike,e=strike.target;
    if(e.hp<=0){basicStrike=null;return;}
    if(!strike.launched && t>=strike.release){
      const p=e.actor.root.position;
      if(castingHand)castingHand.getWorldPosition(palm);else palm.copy(pos).y+=1.25;
      if(special)special.mark(palm,p);
      else{fx.mark(p);fx.bolt(palm,p,false,true);}
      audio.sound(classId==='sword'?'blade':classId==='ward'?'stone':'mark',.67);
      strike.launched=true;
    }
    if(t>=strike.impact){
      damageEnemy(e,classId==='ward'?24:classId==='sword'?23:18,.13);
      if(possessed>0){const p=e.actor.root.position.clone();fx.rites.palm(pos,p);area(p,2.4,22,.35,0xffd77a);audio.sound('chain');}
      basicStrike=null;
    }
  }
  function skill(name,point,move){
    if(state!=='play'||!(name in cool))return false;
    if(cool[name]>.02){if(name!=='mark')notice('法术回气中',.7);return false;}
    if(name==='summon'&&seals<3){notice('每镇伏两名敌人凝成一印，集齐三印可请神。');return false;}
    if(!point&&(name==='thunder'||name==='summon'||name==='priest')&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&hoverPoint)point=hoverPoint;
    // 请神选招：战斗完全暂停，四选一后再从这里继续施放。
    if((name==='summon'||name==='priest')&&!move){
      const moves=name==='summon'?judgeMoves:priestMoves,keep=point?.clone();
      state='choose';keys.clear();joy.x=joy.y=0;activeTouch=null;audio.ambience(false);audio.sound('chime',.7);
      ui.choose({kicker:name==='summon'?'三印请神 · 钟馗':'请一眉道长',title:name==='summon'?'钟馗出何招':'道长施何法',moves},picked=>{
        if(state!=='choose')return;state='play';audio.ambience(true);prev=performance.now();canvas.focus({preventScroll:true});loopId=requestAnimationFrame(frame);
        if(picked)skill(name,keep,picked.key);else syncHud();
      });
      return true;
    }
    const target=(point&&pickPrimary(point))||pickPrimary();const at=point?point.clone():target?target.actor.root.position.clone():groundAim();
    at.x=clamp(at.x,-14,14);at.y=0;at.z=clamp(at.z,-12,12);
    if(name==='dodge'){
      cast=followTime=0;
      movement(dashDir);if(dashDir.lengthSq()<.01)dashDir.set(-Math.sin(yaw),0,-Math.cos(yaw));dashDir.normalize();dash=.27;evade=.44;immune=.52;cool.dodge=mods.dodgeCd;
      if(tetherEnemy){breakTether();notice('魂链已挣脱',1.2);}
      fx.dodge(pos);audio.sound('dodge');return true;
    }
    if(name==='rice'){
      const p=target?target.actor.root.position.clone():groundAim();
      if(target&&pos.distanceTo(p)>16){notice('靠近敌人再撒糯米。',.9);return false;}
      pose('cast',p);cool.rice=stickyRice.cooldown;audio.voice(classId+'.rice');
      if(castingHand)castingHand.getWorldPosition(palm);else palm.copy(pos).setY(1.4);fx.rice(palm,p,stickyRice.radius*mods.riceR,stickyRice.slow+mods.riceSlow);
      const at=p.clone();let stuck=0;
      setTimeout(()=>{if(state!=='play')return;for(const e of enemies){
        if(e.hp<=0||e.actor.root.position.distanceTo(at)>stickyRice.radius*mods.riceR)continue;
        e.slow=stickyRice.slow+mods.riceSlow;stuck++;damageEnemy(e,e.type>=BLACK?stickyRice.envoyDamage:stickyRice.damage,.2);fx.hit(e.actor.root.position,0xfff4d8);
      }if(stuck)notice('糯米粘尸 · 行动迟缓',1.2);},320);
      syncHud();return true;
    }
    if(name==='mark'||name==='chain'){
      if(!target||pos.distanceTo(target.actor.root.position)>25){notice('靠近敌人再出招。',.9);return false;}
      const p=target.actor.root.position;
      pose(name==='mark'?'attack':'cast',p);
      if(name==='mark'){
        markCount++;target.marked=8;
        const release=t+actionTiming(classId,'attack').release,travel=classId==='sword'?.24:classId==='ward'?.20:0;
        basicStrike={target,release,impact:release+travel,launched:false};
        cool.mark=classId==='ward'?.53:classId==='sword'?.42*mods.swordCd:.42;
      }else if(special){
        chainCount++;cool.chain=classId==='sword'?7.5*mods.swordCd:8.5*mods.wardCd;audio.voice(classId+'.chain');
        banner(spec.chain.name,spec.name,1.8);
        special.thunder(p.clone(),(center,final)=>{
          if(classId==='sword'){
            area(center,final?4.2:3.6,final?35:13,final?.67:.12,spec.light,e=>{e.marked=8;});
          }else{
            area(center,4.1,final?33:11,final?1.9:.68,spec.light);
          }
        },yaw);
      }else{
        chainCount++;cool.chain=4.4;audio.voice('thunder.chain');let e=target,from=pos;const struck=new Set();
        for(let i=0;i<4+mods.chainExtra&&e;i++){
          const ep=e.actor.root.position,tagged=e.marked>0;fx.bolt(from,ep,true);damageEnemy(e,(tagged?68:37)*mods.chainDmg,.55);e.marked=0;struck.add(e);from=ep;
          let near=null,best=tagged?10:6;for(const other of enemies){const d=ep.distanceTo(other.actor.root.position);if(other.hp>0&&!struck.has(other)&&d<best){near=other;best=d;}}e=near;
        }
        audio.sound('chain');
      }
    }else{
      const priest=name==='priest',invoking=name==='summon'||priest;
      focus=at.clone();spellLight.position.copy(at);spellLight.position.y=invoking?5.8:3.85;
      if(invoking){spellLight.position.x-=2.6;spellLight.position.z+=2.1;}
      spellLight.color.set(priest?0xffd68a:invoking?0xffbe89:spec.light);
      focusRite=priest;focusGate=name==='summon'||(name==='thunder'&&classId==='ward');focusLife=focusSpan=priest?sevenStars.duration:invoking?4.3:special?4.16:3.1;
      pose(invoking?'invoke':'ultimate',at);
      if(!priest)fx.castTrails(invoking?'summon':classId,castingHand,at);
      if(priest){
        priestCount++;cool.priest=mods.priestCd;
        const m=priestMoves.find(x=>x.key===move);banner(m.name,'一眉道长 · '+m.tag,3.1);ui.splash(m.name,'一眉道长 · '+m.tag,m.hue);
        audio.voice('summon.priest',{channel:'summon'});audio.voice('priest.'+move,{channel:'priest',delay:1.25});
        if(move==='stars')fx.priest(at,(p,hit)=>area(p,hit.radius,hit.damage,hit.stun,hit===sevenStars.gather?0xa9dfff:0xffd784),yaw);
        else if(move==='ink'){focusLife=focusSpan=3.3;fx.rites.ink(pos.clone(),at,(lines,life)=>{
          for(const l of lines)inkLines.push({...l,life});
          for(const e of enemies)if(e.hp>0&&nearInk(e.actor.root.position,lines))inkCatch(e);
        });}
        else if(move==='mirror'){
          // 照妖镜优先照向最近的无常，没有无常时照当前目标。
          const envoy=enemies.filter(e=>e.hp>0&&e.type>=BLACK).sort((a,b)=>a.actor.root.position.distanceTo(pos)-b.actor.root.position.distanceTo(pos))[0];
          const glare=envoy?envoy.actor.root.position.clone():at;focus=glare.clone();
          focusLife=focusSpan=2.6;fx.rites.mirror(pos.clone(),glare,(origin,dir,range,spread)=>{
          let caught=0;
          for(const e of enemies){
            if(e.hp<=0)continue;tmp.copy(e.actor.root.position).sub(origin).setY(0);const d=tmp.length();
            if(d>range||tmp.normalize().dot(dir)<Math.cos(spread+.1))continue;
            caught++;if(e.exposed<=0){const r=e.actor.root;fx.rites.exposedMark(()=>e.hp>0?r.position:null,6);}e.exposed=6;
            if(e.type>=BLACK){if(e===tetherEnemy)breakTether();dismiss(e);e.stage='chase';e.wait=Math.max(e.wait,3);damageEnemy(e,60,2.2);}
            else damageEnemy(e,40,1);
            fx.hit(e.actor.root.position,0xffe3a0);
          }
          notice(caught?'照妖镜下 · 现出原形':'金光照空',1.6);
        });}
        else{focusLife=focusSpan=2.2;fx.rites.possess(()=>pos,yaw,()=>{possessed=8;fx.rites.aura(()=>pos,8,()=>yaw);hp=Math.min(100,hp+10);notice('茅山神打 · 掌心引雷',2);syncHud();});}
      }else if(invoking){
        summonCount++;seals=0;sealCharge=0;cool.summon=7;
        const m=judgeMoves.find(x=>x.key===move);banner(m.name,'三印请神 · 钟馗',3.25);ui.splash(m.name,'钟馗 · '+m.tag,m.hue);
        // 广西远舟喊人，钟馗应声，收招时再喝一句本招台词。
        audio.voice('summon.judge',{channel:'summon'});audio.voice('judge.arrive',{channel:'judge',delay:1.1});
        // 啖鬼先锁定猎物：场上生命最多的敌人，阴差优先。
        const prey=move==='devour'?enemies.filter(e=>e.hp>0&&!e.devour).sort((a,b)=>(b.type>=BLACK)-(a.type>=BLACK)||b.hp-a.hp)[0]:null;
        const aim=prey?prey.actor.root.position.clone():at;
        fx.summon(aim,(p,extra)=>{
          audio.voice('judge.'+move,{channel:'judge'});
          if(move==='slash')area(p,7.3,235,2.15);
          else if(move==='devour'){
            if(prey&&prey.hp>0){const r=prey.actor.root;fx.maw(()=>r.position.clone().setY(r.position.y+1.2),1.1);fx.chains(extra.origin,()=>prey.devour>0?r.position.clone().setY(r.position.y+1):null,.85);prey.devourFrom=null;prey.devour=1.1;prey.stagger=0;dismiss(prey);if(prey===tetherEnemy)breakTether();}
            area(p,3.2,40,1,0xff5a3a);hp=Math.min(100,hp+20);notice('钟馗啖鬼 · 回元 20',1.8);syncHud();
          }else if(move==='brush'){
            let struck=0;
            for(const e of enemies)if(e.hp>0&&e.type>=BLACK){
              struck++;if(e===tetherEnemy)breakTether();dismiss(e);e.stage='chase';e.wait=Math.max(e.wait,6);
              damageEnemy(e,Math.ceil(e.max*.35/mods.dmg),1.4);fx.strike(e.actor.root.position.clone());fx.burnName(e.actor.root.position.clone(),e.type===BLACK?'黑無常':'白無常');
            }
            area(p,5,30,.6,0xff3b24);notice(struck?'生死簿上 · 勾去其名':'簿上暂无阴差之名',1.8);
          }else spawnImps(extra.origin);
        },move);
      }else{
        thunderCount++;cool.thunder=mods.ultCd;banner(spec.thunder.name,spec.thunder.school,3.05);audio.voice(classId+'.ultimate');
        if(classId==='sword'){
          special.summon(at,(center,final)=>{
            if(final)audio.voice('sword.final');
            area(center,final?6.1:4.9,final?126:34,final?1.25:.25,spec.light,e=>{
              if(final && e.marked>0){e.marked=0;return 56;}
            });
          },yaw);
        }else if(classId==='ward'){
          special.summon(at,(center,final)=>{
            if(!final)return;
            audio.voice('ward.final');area(center,6.8,222,2.7,spec.light);wardHp=28+mods.wardShield;wardTime=6;notice('狮印护身 · 可抵 '+wardHp+' 点伤害',2);
          },yaw);
        }else fx.thunder(at,(p,index)=>{if(index===4)audio.voice('thunder.final');area(p,index===4?5.8:3.65,index===4?106:35,index===4?1.2:.38);});
      }
    }
    syncHud();return true;
  }
  function movement(result){const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joy.x;
    const z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+joy.y;
    result.set(x*Math.cos(yaw)+z*Math.sin(yaw),0,-x*Math.sin(yaw)+z*Math.cos(yaw));if(result.lengthSq()>1)result.normalize();return result;}
  function hurtPlayer(amount){
    if(immune>0 || state!=='play' || godMode)return false;
    amount=Math.round(amount*mods.taken);
    const absorbed=Math.min(wardHp,amount);wardHp-=absorbed;
    hp=Math.max(0,hp-(amount-absorbed));immune=.5;
    if(absorbed)audio.sound('seal',.6);
    if(amount>absorbed){hurt=.65;shake=Math.max(shake,.12);audio.sound('hurt');}
    if(!spokeHurt&&hp>0&&hp<=35){spokeHurt=true;audio.voice(classId+'.hurt');}
    if(hp<=0)finish(false);
    return amount>absorbed && hp>0;
  }
  const chargeSegment=new THREE.Line3(),chainSegment=new THREE.Line3(),nearest=V(),foot=V();
  function envoyStep(e,dt,dist){
    const p=e.actor.root.position,black=e.type===BLACK;
    if(e.stage==='wind'){
      const u=Math.min(1,e.clock/e.wind);
      e.sign.show(e,'wind',u);e.pose='cast';e.progress=u;
      if(u>=1){
        e.stage='strike';e.clock=0;audio.sound(black?'shackle':'soul',.9);
        if(!black){
          if(pos.distanceTo(e.anchor)<prisonRadius && hurtPlayer(12)){tetherEnemy=e;tetherTime=1.65;notice('白幡拘魂 · 踏罡步可挣脱',1.5);}
          fx.hit(e.anchor,0xbfefdd);
        }
      }
      return;
    }
    if(e.stage==='strike'){
      const u=Math.min(1,e.clock/(black?.57:.55));e.sign.show(e,'strike',u);
      e.pose=black?'charge':'attack';e.progress=u;
      if(black){
        foot.copy(p);
        p.copy(e.origin).addScaledVector(e.attackDir,chargeLength*(1-(1-u)**1.4));
        p.x=clamp(p.x,-14.6,14.6);p.z=clamp(p.z,-12.5,12.5);
        chargeSegment.set(foot,p);
        if(!e.hitOnce && chargeSegment.closestPointToPoint(pos,true,nearest).distanceTo(pos)<chargeHalfWidth){
          e.hitOnce=true;hurtPlayer(16);
        }
        if(tetherEnemy){
          chainSegment.set(tetherEnemy.actor.root.position,pos);
          if(chainSegment.closestPointToPoint(p,true,nearest).distanceTo(p)<.85){
            const white=tetherEnemy;breakTether();
            damageEnemy(white,36,1.85);damageEnemy(e,36,1.85);fx.hit(p,0xffddaa);
            notice('魂链撞断 · 双使失衡',2);return;
          }
        }
      }
      if(u===1){dismiss(e);e.stage='chase';e.wait=black?3.8:4.3;}
      return;
    }
    tmp.subVectors(pos,p);
    if(dist>.01)tmp.multiplyScalar(1/dist);
    turn(e.actor.root,Math.atan2(tmp.x,tmp.z),dt);
    if(dist<=e.reach && e.wait<=0){
      e.origin.copy(p);e.anchor.copy(pos);e.attackDir.copy(tmp);e.clock=0;e.hitOnce=false;e.stage='wind';
      if(e.attackDir.lengthSq()<.01)e.attackDir.set(0,0,1);
      e.sign.show(e,'wind',0);audio.sound(black?'shackle':'soul',.45);
      return;
    }
    const preferred=black?2.6:5.8;
    const step=dist>preferred+.45?1:!black && dist<preferred-1?-.72:0;
    if(step)p.addScaledVector(tmp,step*e.speed*dt);
    e.pose=step?'walk':'idle';
  }
  // 飞头蛮：在玩家头顶盘旋，地上亮起俯冲圈后直扑下来，再拉回空中。
  function flyerStep(e,dt,dist){
    const p=e.actor.root.position,actor=e.actor;
    if(e.stage==='wind'){
      const u=Math.min(1,e.clock/e.wind);e.pose='cast';e.progress=u;
      e.ring.visible=true;e.ring.position.set(e.anchor.x,.06,e.anchor.z);e.ring.scale.setScalar(e.reach*(.7+.3*u));e.ring.material.opacity=.4+.5*u;
      tmp.copy(e.anchor).sub(p);turn(actor.root,Math.atan2(tmp.x,tmp.z),dt);
      if(u>=1){e.stage='dive';e.clock=0;e.ring.visible=false;e.hitOnce=false;e.origin.copy(p);e.attackDir.copy(e.anchor).sub(p).setY(0);}
      return;
    }
    if(e.stage==='dive'){
      const u=Math.min(1,e.clock/.55);e.pose='attack';e.progress=u;
      p.copy(e.origin).addScaledVector(e.attackDir,u*1.35);
      actor.lift=2.4-1.7*Math.sin(Math.PI*Math.min(1,u*1.1));
      if(!e.hitOnce&&u>.35&&u<.75&&p.distanceTo(pos)<e.reach){e.hitOnce=true;hurtPlayer(14);}
      if(u>=1){e.stage='chase';e.wait=2.4;e.clock=0;actor.lift=2.4;}
      return;
    }
    // 盘旋：绕着玩家转圈，距离 4.5 米。
    actor.lift+=(2.4-actor.lift)*(1-Math.exp(-dt*3));
    e.orbit+=dt*.9;tmp.set(pos.x+Math.cos(e.orbit)*4.5,0,pos.z+Math.sin(e.orbit)*4.5).sub(p);
    const d=tmp.length();if(d>.05)p.addScaledVector(tmp,Math.min(1,e.speed*dt/d));
    tmp.copy(pos).sub(p);turn(actor.root,Math.atan2(tmp.x,tmp.z),dt);e.pose='walk';
    if(e.wait<=0&&dist<7.5){e.stage='wind';e.clock=0;e.anchor.copy(pos);}
  }
  function nearInk(p,lines){
    for(const {a,b} of lines){
      const abx=b.x-a.x,abz=b.z-a.z,len=abx*abx+abz*abz||1,u=clamp(((p.x-a.x)*abx+(p.z-a.z)*abz)/len,0,1);
      const dx=p.x-(a.x+abx*u),dz=p.z-(a.z+abz*u);if(dx*dx+dz*dz<.55)return true;
    }
    return false;
  }
  function inkCatch(e){
    e.inkSafe=3;
    if(e.type>=BLACK){e.slow=Math.max(e.slow,4);damageEnemy(e,16,.2);}
    else{damageEnemy(e,22,2.5);}
    fx.hit(e.actor.root.position,0x2a1a10);
  }
  function spawnImps(origin){
    for(let i=0;i<5;i++){
      const actor=makeImpActor(i),a=i/5*Math.PI*2;actor.root.scale.setScalar(1.3);
      // 从朱门里依次蹦出，划一道彩色弧线砸进战场。
      const from=V(clamp(origin.x+Math.cos(a)*1.2,-14,14),0,clamp(origin.z+1+Math.sin(a)*.6,-12,12));
      // 落点：优先砸在活着的敌人身边，否则落在玩家前方，不落在镜头与玩家之间。
      const foe=enemies.filter(e=>e.hp>0&&!e.devour)[i];
      const ahead=V(pos.x-Math.sin(yaw)*4.5,0,pos.z-Math.cos(yaw)*4.5);
      const base=foe?foe.actor.root.position:ahead;
      const land=V(clamp(base.x+Math.cos(a)*1.3,-14,14),0,clamp(base.z+Math.sin(a)*1.3,-12,12));
      actor.root.position.copy(from);scene.add(actor.root);
      const m={actor,life:10,cd:.3+i*.1,swing:0,seed:i*1.3,leap:{from,land,t:-i*.12,dur:.75},trail:0,color:IMP_COLORS[i]};imps.push(m);
      fx.footRing(()=>m.life>0&&!m.leap?actor.root.position:null,IMP_COLORS[i],10.8);
    }
    notice('五鬼听令 · 追打群邪',1.8);
  }
  function clearAllies(){for(const m of imps)m.actor.root.removeFromParent();imps=[];inkLines=[];}
  function alliesStep(dt){
    possessed=Math.max(0,possessed-dt);
    for(let i=inkLines.length-1;i>=0;i--){if((inkLines[i].life-=dt)<=0)inkLines.splice(i,1);}
    for(let i=imps.length-1;i>=0;i--){
      const m=imps[i],root=m.actor.root;m.life-=dt;m.cd-=dt;m.swing=Math.max(0,m.swing-dt);
      if(m.life<=0){fx.hit(root.position,0xffd27a);root.removeFromParent();imps.splice(i,1);continue;}
      if(m.leap){
        const L=m.leap;L.t+=dt;const u=clamp(L.t/L.dur,0,1);
        root.position.lerpVectors(L.from,L.land,u);root.position.y=5*Math.sin(Math.PI*u);
        m.trail-=dt;if(u>0&&m.trail<=0){m.trail=.05;fx.hit(root.position.clone().setY(root.position.y-.6),m.color);}
        m.actor.animate('attack',t+m.seed,u);
        if(u>=1){m.leap=null;root.position.y=0;fx.impLand(root.position.clone(),m.color);area(root.position,2.2,18,.6,m.color);}
        continue;
      }
      let best=null,bd=Infinity;for(const e of enemies){if(e.hp<=0||e.devour)continue;const d=e.actor.root.position.distanceTo(root.position);if(d<bd){bd=d;best=e;}}
      if(best){
        tmp.copy(best.actor.root.position).sub(root.position).setY(0);root.rotation.y=Math.atan2(tmp.x,tmp.z);
        if(bd>1.1)root.position.addScaledVector(tmp.normalize(),Math.min(bd-1,5.2*dt));
        else if(m.cd<=0){m.cd=.7;m.swing=.3;damageEnemy(best,10,.2);fx.hit(best.actor.root.position,0xffd27a);}
      }
      m.actor.animate(m.swing>0?'attack':'walk',t+m.seed,1-m.swing/.3);
    }
  }
  function enemiesStep(dt){
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i],p=e.actor.root.position;
      const root=e.actor.root,fromX=p.x,fromZ=p.z,fromYaw=root.rotation.y;
      e.pose='idle';e.progress=1;
      if(e.devour>0&&e.hp>0){
        // 被钟馗抓起：升空、旋转、缩小，然后一口吞下。
        e.devour=Math.max(0,e.devour-dt);const u=1-e.devour/1.1;
        // 往镜头方向拉出一点、升到钟馗胸前，免得被他身子挡住。
        // 先被提到钟馗身侧半空（镜头看得见），最后三成时间被吸进口中。
        if(!e.devourFrom)e.devourFrom=p.clone();
        tmp.copy(pos).sub(e.devourFrom).setY(0);if(tmp.lengthSq()>.01)tmp.normalize();else tmp.set(0,0,1);
        const grab=1-(1-Math.min(1,u/.7))**2,gulp=Math.max(0,(u-.7)/.3);
        p.copy(e.devourFrom).addScaledVector(V(tmp.z,0,-tmp.x),2.1*grab*(1-gulp)).addScaledVector(tmp,.9*gulp);
        root.position.y=4.2*grab+1.1*gulp;
        root.rotation.y+=dt*9;root.scale.setScalar((e.type===2?1.18:1)*(1-.25*grab-.65*gulp));
        if(Math.random()<dt*14)fx.hit(root.position.clone().setY(root.position.y-.6),0x9b1410);
        e.actor.animate('hit',t+e.seed,.5,localMotion(e.motion,root,fromX,fromZ,fromYaw,dt));
        if(e.devour<=0){e.devourFrom=null;fx.hit(root.position,0x9b1410);damageEnemy(e,99999,1);root.visible=false;e.dead=1.2;
          // 群鬼被这一口吓住，全场僵直。
          for(const o of enemies)if(o!==e&&o.hp>0&&!o.devour){o.stagger=o.staggerSpan=Math.max(o.stagger,1.4);dismiss(o);if(o===tetherEnemy)breakTether();}notice('钟馗啖鬼 · 群邪震慑',1.6);}
        continue;
      }
      e.exposed=Math.max(0,e.exposed-dt);e.inkSafe=Math.max(0,e.inkSafe-dt);
      if(inkLines.length&&e.hp>0&&e.inkSafe<=0&&nearInk(p,inkLines))inkCatch(e);
      if(e.hp<=0){e.dead+=dt;e.actor.animate('dead',t+e.seed,clamp(e.dead/.65,0,1),localMotion(e.motion,root,fromX,fromZ,fromYaw,dt));if(e.dead>1.25){release(e);enemies.splice(i,1);}continue;}
      // 糯米粘住时，僵尸起跳与追击都慢一半，阴差的预警也拖长。
      e.slow=Math.max(0,e.slow-dt);const pace=e.slow>0?(e.type>=BLACK?.7:.5):1;
      e.marked=Math.max(0,e.marked-dt);e.wait=Math.max(0,e.wait-dt*pace);e.clock+=dt*pace;
      if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);e.actor.animate('hit',t+e.seed,1-e.stagger/e.staggerSpan,localMotion(e.motion,root,fromX,fromZ,fromYaw,dt));continue;}
      const dist=p.distanceTo(pos),type=e.type;
      if(type>=BLACK){
        envoyStep(e,dt*pace,dist);
      }else if(type===FLYER){
        flyerStep(e,dt*pace,dist);
      }else if(e.stage==='wind'){
        const progress=Math.min(1,e.clock/e.wind);e.ring.visible=true;e.ring.position.set(e.anchor.x,.06,e.anchor.z);e.ring.scale.setScalar(e.reach*(.8+progress*.2));e.ring.material.opacity=.36+.5*progress;
        e.pose='cast';e.progress=progress;
        if(progress>=1){e.stage='leap';e.clock=0;e.ring.visible=false;e.hitOnce=false;}
      }else if(e.stage==='leap'){
        const u=Math.min(1,e.clock/.33);p.addScaledVector(e.attackDir,.95*dt/.33);e.pose='attack';e.progress=u;
        if(!e.hitOnce&&u>.38){e.hitOnce=true;if(pos.distanceTo(e.anchor)<e.reach+.2)hurtPlayer(type===2?24:type===1?16:type===PAPER?7:11);}
        if(u>=1){e.stage='chase';e.wait=type===2?1.5:type===PAPER?.8:1.14;e.clock=0;}
      }else{
        tmp.copy(pos).sub(p);if(dist>.01)tmp.multiplyScalar(1/dist);turn(e.actor.root,Math.atan2(tmp.x,tmp.z),dt);
        if(dist<e.reach+.3&&e.wait<=0){
          e.stage='wind';e.clock=0;e.attackDir.copy(tmp);e.anchor.copy(p).addScaledVector(tmp,.85);
        }else if(dist>1){p.addScaledVector(tmp,e.speed*pace*dt);e.pose='walk';}
      }
      // Make silhouettes and attack warnings readable when several corpses reach the same spot.
      for(let j=0;j<i;j++){const other=enemies[j];if(other.hp<=0||e.stage==='wind'||e.stage==='strike')continue;const o=other.actor.root.position,dx=p.x-o.x,dz=p.z-o.z,sq=dx*dx+dz*dz;if(sq>.0001&&sq<.97){const d=Math.sqrt(sq),push=(1-d)*dt*3/d;p.x+=dx*push;p.z+=dz*push;}}
      p.x=clamp(p.x,-14.6,14.6);p.z=clamp(p.z,-12.5,12.5);if(state!=='play')return;
      e.actor.animate(e.pose,t+e.seed,e.progress,localMotion(e.motion,root,fromX,fromZ,fromYaw,dt));
    }
  }
  function cameraStep(dt){
    const forwardX=-Math.sin(yaw),forwardZ=-Math.cos(yaw),skillView=focusLife>0,rite=skillView&&focusRite,gate=skillView&&focusGate;
    const desired=desiredFocus.set(pos.x+forwardX*2.35,1.15,pos.z+forwardZ*2.35);
    const close=skillView?Math.min(1,focusLife/.55,(focusSpan-focusLife)/.32):0;
    if(skillView){tmp.copy(focus);tmp.y=rite?3.25:gate?3.4:focusSpan>4?3.15:2.45;desired.lerp(tmp,close*.79);}
    camFocus.lerp(desired,1-Math.exp(-dt*7));const radius=6.45+close*(rite?(cam.aspect<1?5.8:4.1):gate?(cam.aspect<1?5.2:3.6):1.65),range=radius*Math.cos(pitch);
    desiredCam.set(clamp(pos.x-forwardX*range,-15.3,15.3),1.55+Math.sin(pitch)*radius+close*(gate?1.3:.65),clamp(pos.z-forwardZ*range,-14.4,14.8));
    if(skillView){const dx=focus.x-pos.x,dz=focus.z-pos.z;desiredCam.x+=clamp(dx*.34,-4,4)*close;desiredCam.z+=clamp(dz*.34,-4,4)*close;}
    const near=desiredCam.distanceTo(pos);if(near<4.5)desiredCam.y+=4.5-near;
    camBase.lerp(desiredCam,1-Math.exp(-dt*9));cam.position.copy(camBase);
    if(shake>.008&&!slowMotionMedia.matches){cam.position.x+=Math.sin(t*53)*shake*.68;cam.position.y+=Math.sin(t*43)*shake*.42;}
    portraitLight.position.copy(cam.position);portraitLight.position.y+=2.5;portraitLight.position.x-=2.2;
    portraitLight.target.position.copy(camFocus);cam.lookAt(camFocus);cam.updateMatrixWorld();cam.fov=51+close*(rite||gate?5:1);cam.updateProjectionMatrix();
  }
  function syncHud(){
    const present={};
    for(const e of enemies)if(e.hp>0 && e.type>=BLACK){
      const id=foes[e.type].model;
      present[id]=Math.min(present[id]??1,e.hp/e.max);
    }
    ui.hud({time:Math.ceil(Math.max(0,timeLeft)),hp,kills,seals,sealCharge,cool,phase:phaseNames[phase],
      foes:present,bound:!!tetherEnemy,shield:wardHp,shieldTime:wardTime});
  }
  function step(dt){
    if(state!=='play')return;
    // 香案显灵：到点且没有大招正在演出时，停下战斗请一件法宝。
    if(nextRelic<relicTimes.length&&t>=relicTimes[nextRelic]&&focusLife<=0){offerRelic();return;}
    t+=dt;timeLeft=duration-t;for(const k in cool)cool[k]=Math.max(0,cool[k]-dt);
    while(nextWave<waves.length&&waves[nextWave][0]<=t){const [,type,x,z]=waves[nextWave++];spawn(type,x,z);}
    const n=phaseOf();if(n!==phase){phase=n;banner(phaseNames[n].split(' · ')[1],'槐阴义庄 · '+['一','二','三','四'][n]+'更');audio.sound('gong',.42);}
    if(bannerTime>0&&(bannerTime-=dt)<=0)ui.banner('','');if(msgTime>0&&(msgTime-=dt)<=0)ui.notice('');
    const fromX=pos.x,fromZ=pos.z,fromYaw=master.root.rotation.y;
    cast=Math.max(0,cast-dt);evade=Math.max(0,evade-dt);immune=Math.max(0,immune-dt);focusLife=Math.max(0,focusLife-dt);
    wardTime=Math.max(0,wardTime-dt);if(!wardTime)wardHp=0;
    if(tetherEnemy){
      tetherTime-=dt;
      if(tetherTime<=0||tetherEnemy.hp<=0)breakTether();
      else{
        tmp.subVectors(tetherEnemy.actor.root.position,pos);
        const d=tmp.length();
        if(d>1)pos.addScaledVector(tmp,Math.min(d-1,1.7*dt)/d);
      }
    }
    movement(aimDir);
    const hasInput=aimDir.lengthSq()>.003;
    const winding=cast>0 && castMax-cast<actionTiming(classId,castPose).release;
    const pace=spec.speed*(winding?.74:1)*(tetherEnemy?.55:1);
    velocity.lerp(aimDir.multiplyScalar(pace),1-Math.exp(-dt*(hasInput?12:18)));
    if(velocity.lengthSq()<.001)velocity.set(0,0,0);
    if(dash>0){
      pos.addScaledVector(dashDir,15*Math.min(dt,dash));dash=Math.max(0,dash-dt);
    }else pos.addScaledVector(velocity,dt);
    if(cast>0&&(winding||!hasInput))turn(master.root,castYaw,dt,15);
    else if(hasInput && !evade)turn(master.root,Math.atan2(aimDir.x,aimDir.z),dt);
    pos.x=clamp(pos.x,-13.6,13.6);pos.z=clamp(pos.z,-11.5,11.3);
    const motion=localMotion(masterMotion,master.root,fromX,fromZ,fromYaw,dt);
    const distance=Math.hypot(pos.x-fromX,pos.z-fromZ),moving=distance>dt*.08;
    const action=evade?'dodge':cast>0?castPose:moving?'walk':'idle';
    const progress=evade?1-evade/.44:cast>0?1-cast/castMax:1;
    followTime=Math.max(0,followTime-dt);
    motion.followThrough=followTime>0?1-followTime/actionTiming(classId,'attack').duration:-1;
    if(master.animate(action,t,progress,motion))audio.sound('step');
    advanceBasic();
    enemiesStep(dt);if(state!=='play')return;
    enemySigns.tether(tetherEnemy?.actor.root.position,pos,t);alliesStep(dt);fx.update(dt);shake=Math.max(0,shake-dt*1.0);surge=Math.max(0,surge-dt*3.4);hurt=Math.max(0,hurt-dt*1.6);
    dim+=((focusLife>.25?1:0)-dim)*(1-Math.exp(-dt*(focusLife>.25?7:3)));
    court.setSurge(surge*.4);court.update(dt,t);punch.intensity=surge*.7;spellLight.intensity=focusLife>0?(focusSpan>4?12:13)+surge*(focusSpan>4?16:24):0;audio.update();
    cameraStep(dt);primary=pickPrimary();
    groundMarker.visible=!!hoverPoint&&(keys.has('ShiftLeft')||keys.has('ShiftRight'));if(groundMarker.visible)groundMarker.position.set(hoverPoint.x,.067,hoverPoint.z);
    if(primary){const p=primary.actor.root.position;reticle.visible=true;reticle.position.set(p.x,.049,p.z);reticle.scale.setScalar(primary.type===2?1.05:primary.type===PAPER?.6:.7);
      project.copy(p);project.y+=primary.type===FLYER?3.2:primary.type===PAPER?2.15:primary.type===2?3.05:primary.type===WHITE?2.83:primary.type===BLACK?2.61:2.35;project.project(cam);
      const visible=project.z>0&&project.z<1&&Math.abs(project.x)<.94&&Math.abs(project.y)<.80;
      ui.target(visible?{x:(project.x*.5+.5)*100,y:(.5-project.y*.5)*100,label:foes[primary.type].name+(primary.marked>0?' · '+spec.markTag:''),hp:primary.hp/primary.max}:null);
    }else{reticle.visible=false;ui.target(null);}
    hudTick-=dt;if(hudTick<=0){hudTick=.09;syncHud();ui.damage(hurt);}
    if(timeLeft<=0)finish(true);
  }
  function frame(now){
    if(state!=='play')return;const dt=clamp((now-prev)/1000,0,.35);prev=now;
    perfTime+=dt;perfCount++;
    if(perfTime>=1.5){
      const fps=perfCount/perfTime,previous=pixelScale;
      if(fps<45)pixelScale=Math.max(.85,pixelScale-(fps<28?.25:.12));
      else if(fps>56)pixelScale=Math.min(preferredScale,pixelScale+.08);
      if(Math.abs(previous-pixelScale)>.001)resize();
      perfTime=perfCount=0;
    }
    // 顶帧：招式命中瞬间时间放慢到两成，按真实时间计时。
    if(hitstop>0){hitstop-=dt;dt*=.2;}
    let left=dt;while(left>.00001&&state==='play'){const chunk=Math.min(left,.05);step(chunk);left-=chunk;}
    atmosphere.render(scene,cam,surge,dim);if(state==='play')loopId=requestAnimationFrame(frame);
  }
  function pointAt(ev){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,1-(ev.clientY-r.top)/r.height*2),cam);return ray.ray.intersectPlane(plane,V());}
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',ev=>{if(state!=='play'||activeTouch)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(ev.pointerId);activeTouch={id:ev.pointerId,x:ev.clientX,y:ev.clientY,dist:0,button:ev.button};});
  canvas.addEventListener('pointermove',ev=>{if(state!=='play')return;if(!activeTouch){const p=pointAt(ev);hoverPoint=p&&Math.abs(p.x)<=14&&Math.abs(p.z)<=12?p:null;return;}if(activeTouch.id!==ev.pointerId)return;const dx=ev.clientX-activeTouch.x,dy=ev.clientY-activeTouch.y;
    activeTouch.dist+=Math.abs(dx)+Math.abs(dy);activeTouch.x=ev.clientX;activeTouch.y=ev.clientY;if(activeTouch.dist>3){yaw-=dx*.0065;pitch=clamp(pitch+dy*.004,.22,.94);}});
  canvas.addEventListener('pointerup',ev=>{if(activeTouch?.id!==ev.pointerId)return;const tap=activeTouch.dist<8&&activeTouch.button===0;activeTouch=null;if(tap)skill('mark',pointAt(ev));});
  canvas.addEventListener('pointercancel',()=>activeTouch=null);canvas.addEventListener('pointerleave',()=>hoverPoint=null);
  await prepareEntry();
  // ?debug: step a paused fight by fixed frames so spell beats can be captured exactly.
  function debugAdvance(seconds,cast,move){
    if(state!=='paused')return false;state='play';if(cast){cool[cast]=0;if(cast==='summon')seals=3;skill(cast,null,move);}
    for(let left=seconds;left>1e-5&&state==='play';left-=1/60)step(Math.min(left,1/60));
    atmosphere.render(scene,cam,surge,dim);if(state==='play')state='paused';return true;
  }
  return {start,pause,resume,leave,selectClass,skill,keys,joy,debugAdvance,debugScene:scene,debugGod(v){godMode=!!v;},get state(){return state;}};
}
