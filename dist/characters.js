import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from './vendor/addons/utils/SkeletonUtils.js';
import { addReferenceColors } from './actor-material.js';
import { makeLocomotion } from './locomotion.js';
import { makeRitual } from './action-motion.js';
import { actionTiming } from './action-timing.js';

// Art heights include the cap, pins or topknot. The outer root stays at the
// feet so game movement and the judge's portal can control it independently.
const heights = {
  thunder: 2.14, 'thunder-guard': 2.14, sword: 2.04, ward: 2.16, judge: 6.0,
  corpse: 2.12, black: 2.32, white: 2.56
};

const loader = new GLTFLoader();
const templates = new Map();
const pending = new Map();

async function loadTemplate(id) {
  if (!Object.hasOwn(heights, id)) throw new Error('未知角色 ' + id);
  if (templates.has(id)) return;
  if (pending.has(id)) return pending.get(id);

  const task = (async () => {
    const url = new URL('./art/actors/' + id + '.glb', import.meta.url);
    const {scene} = await loader.loadAsync(url.href);
    const materials = new Set();
    let joints = 0;
    scene.traverse(node => {
      if (node.isBone) joints++;
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = false;
      for (const material of [].concat(node.material)) materials.add(material);
      // The sleeves and sword can travel considerably outside their rest box.
      // The game already limits encounters to the courtyard.
      if (node.isSkinnedMesh) node.frustumCulled = false;
    });
    if (!joints) throw new Error('角色缺少骨架 ' + id);
    await addReferenceColors(scene, id);
    for (const material of materials) {
      if (!material.map) continue;
      material.map.anisotropy = 8;
      if (material.isMeshStandardMaterial && !material.emissiveMap) {
        material.emissiveMap = material.map;
        material.emissive.setRGB(1, 1, 1);
        // The reference already includes shadows in the brocade and skin.
        // Keep those details readable when the court's moon is behind a figure.
        material.emissiveIntensity = id === 'black' ? .41 : id === 'white' ? .25 : .34;
      }
    }
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene, true);
    const assetHeight = bounds.max.y - bounds.min.y;
    if (!(assetHeight > 0 && Number.isFinite(assetHeight))) throw new Error('角色尺寸无效 ' + id);
    templates.set(id, {scene, scale: heights[id] / assetHeight, floor: bounds.min.y});
  })();
  pending.set(id, task);
  try {
    await task;
  } finally {
    pending.delete(id);
  }
}

export async function preloadActors(ids = Object.keys(heights)) {
  await Promise.all([...new Set(ids)].map(loadTemplate));
}

const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
const RAD = Math.PI / 180;
// Casting hand axes in the glTF bind pose, shared with its sculpted palm.
const fingerAcross = new THREE.Vector3(.48,0,-.88);
const fingerLength = new THREE.Vector3(.19,-.979,-.072).normalize();
fingerAcross.addScaledVector(fingerLength,-fingerAcross.dot(fingerLength)).normalize();
const palmNormal = new THREE.Vector3().crossVectors(fingerAcross,fingerLength);

function ease(from, to, value) {
  const k = clamp((value - from) / (to - from), 0, 1);
  return k * k * (3 - 2 * k);
}

function beat(value, start, peak, end) {
  return ease(start, peak, value) * (1 - ease(peak, end, value));
}

function makeMotion(scene, carrier, id, variant) {
  const joints = {};
  const bindings = [];
  scene.traverse(bone => {
    if (!bone.isBone) return;
    const binding = {bone, quaternion: bone.quaternion.clone(), position: bone.position.clone(), previous: bone.quaternion.clone(), last: bone.quaternion.clone(), spin:new THREE.Vector3()};
    bindings.push(binding);
    joints[bone.name] = binding;
  });

  const gait=makeLocomotion(carrier.parent,carrier,joints,id,heights[id],variant);
  const priorPosition=new THREE.Vector3(),priorRotation=new THREE.Quaternion();
  const lastPosition=new THREE.Vector3(),carryVelocity=new THREE.Vector3(), predicted=new THREE.Quaternion(), increment=new THREE.Quaternion(), axis=new THREE.Vector3();
  let sampledDt=1/60,chestPitchRate=0,chestTurnRate=0;
  const drapes=['clothL','clothR','clothBack'].filter(name=>joints[name]).map((name,i)=>({
    name, phase:i===1?.5:i===2?.21:0, pitch:0, roll:0, vPitch:0, vRoll:0,
  }));
  let previousPose=null, previousTime=null, previousProgress=0, transition=0, transitionDuration=0;
  const delta = new THREE.Quaternion();
  const angles = new THREE.Euler(0, 0, 0, 'YXZ');
  // Pose rotations are authored as offsets from the approved painted stance:
  // the thunder master's casting hand is already raised and the corpse's
  // forearms already point forward in the bind pose.
  function rotate(name, pitch = 0, yaw = 0, roll = 0) {
    const binding = joints[name];
    if (!binding) return;
    delta.setFromEuler(angles.set(pitch * RAD, yaw * RAD, roll * RAD, 'YXZ'));
    binding.bone.quaternion.multiply(delta);
  }

  function reset() {
    carrier.position.set(0, 0, 0);
    carrier.rotation.set(0, 0, 0);
    for (const {bone, quaternion, position} of bindings) {
      bone.quaternion.copy(quaternion);
      bone.position.copy(position);
    }
  }

  function idle(t) {
    const heavy = id === 'ward' || id === 'judge';
    const breathing = Math.sin(t * (heavy ? 1.52 : 1.98));
    if (id === 'corpse') {
      rotate('neck', -.9 + 1.4 * Math.sin(t * 1.12), 1.9 * Math.sin(t * .79));
      rotate('forearmL', Math.sin(t * 1.87), 0, .6);
      rotate('spine',.9*Math.sin(t*.64),1.2*Math.sin(t*.44));
      return;
    }
    const balance=Math.sin(t*(heavy?.61:.76));
    carrier.position.x+=heights[id]*.0034*balance;
    rotate('hips',0,.85*balance,.56*balance);
    carrier.position.y+=breathing*.0024*heights[id];
    rotate('spine', -.65 * breathing);
    rotate('chest', -1.25 * breathing, Math.sin(t * .68) * .55);
    rotate('head', .7 * breathing, Math.sin(t * .57) * 2.0);
    rotate('upperArmR', .72 * breathing, 0, -.72 * breathing);
    rotate('upperArmL', -.64 * breathing, 0, .9 * breathing);
    // The grip, free sleeve and gaze settle at different speeds.
    const drift=Math.sin(t*.83+.9), gaze=Math.sin(t*.39)*Math.sin(t*.67);
    rotate('neck',.55*drift,1.55*gaze,-.6*balance);
    rotate('handL',1.65*drift,1.3*gaze);
    rotate('forearmR',heavy?.62*drift:1.55*drift);
    if(id==='white')rotate('upperArmL',-1.4*drift,.9*gaze,1.0*balance);
  }

  function cast(p) {
    if(id==='black' || id==='white'){
      const set=ease(0,.56,p),hold=ease(.30,.88,p);
      if(id==='black'){
        // Brace on the rear foot; keep tension at the very last frame of the
        // warning so the following charge launches out of a crouch.
        carrier.position.z-=heights[id]*.043*set;carrier.position.x-=heights[id]*.042*set;
        carrier.position.y-=heights[id]*(.028*set+.022*hold);
        rotate('hips',4*set,-10*set);rotate('chest',7*hold,-12*set,4*set);rotate('head',-5*hold,9*set);
        rotate('upperArmL',-36*set,-14*hold,14*set);rotate('forearmL',-23*hold);
        rotate('upperArmR',11*set,-7*hold,-8*set);rotate('handL',8*hold,-12*set);
      }else{
        // The banner stays in the right hand. The pale official inscribes the
        // circle with the empty left palm and closes the snare at its rim.
        const circle=ease(.13,.93,p),theta=circle*Math.PI*1.65;
        carrier.position.y-=heights[id]*.018*set;carrier.position.x+=heights[id]*.031*Math.sin(theta*.68);
        rotate('hips',2*set,5*Math.sin(theta));rotate('chest',-2*set,8*Math.sin(theta),2*hold);rotate('head',-3*set,-4*Math.sin(theta));
        gait.guideHand('L',set*(.15+.09*Math.sin(theta)),set*(.105+.07*hold),set*.112*Math.cos(theta),set);
        rotate('handL',-17*set+27*hold,18*Math.sin(theta),9*hold);
        rotate('upperArmR',-6*set,3*Math.sin(theta));rotate('handR',5*set);
      }
      return;
    }
    if (id === 'corpse') {
      const gather = ease(0, .62, p);
      rotate('hips', -7 * gather);
      rotate('chest', -9 * gather);
      rotate('head', 9 * gather);
      rotate('upperArmL', -13 * gather, 0, 3.6 * gather);
      rotate('upperArmR', -14 * gather, 0, -3.3 * gather);
      return;
    }
    const gather = beat(p, 0, .34, .69);
    const send = beat(p, .24, .68, 1);
    rotate('hips', 1.3 * gather, -5 * gather + 3 * send);
    rotate('spine', -4 * gather + 3 * send, -7 * gather + 6 * send);
    rotate('chest', -4 * gather + 4 * send, -7 * gather + 6 * send);
    rotate('head', -5 * gather + 2 * send, 4 * gather - 3 * send);
    if (id === 'thunder-guard') {
      // Extend the seal beyond the right shoulder at chest height. The long
      // inner sleeve overlaps the robe in this lowered-hand stance.
      rotate('upperArmR', -17 * gather - 27 * send, -7 * gather - 11 * send, -12 * gather - 18 * send);
      rotate('forearmR', -16 * gather - 23 * send);
      rotate('handR', -6 * gather + 8 * send, 12 * gather);
      rotate('upperArmL', -15 * gather - 17 * send);
      rotate('forearmL', -21 * gather);
    } else if (id === 'thunder') {
      rotate('upperArmR', -14 * gather - 13 * send, 7 * gather - 10 * send, -9 * gather + 5 * send);
      rotate('forearmR', -15 * gather + 16 * send, -5 * send, 4 * gather);
      rotate('handR', -6 * gather + 10 * send, 18 * gather - 9 * send);
      rotate('upperArmL', -17 * gather - 12 * send, 0, 9 * gather);
      rotate('forearmL', -18 * gather - 8 * send);
    } else {
      rotate('upperArmR', -22 * gather - 16 * send, 0, -9 * gather);
      rotate('upperArmL', -18 * gather - 19 * send, 0, 12 * gather);
      rotate('forearmR', -18 * gather + 7 * send);
      rotate('forearmL', -14 * gather - 4 * send);
    }
  }

  function swordStrike(p) {
    const judge=id==='judge';
    // Turn at the pelvis before the blade leaves the scabbard line. The huge
    // sword at the gate cuts through at .42s of its .83s motion, then carries
    // the shoulder through the cut before the elbow catches its weight.
    const draw=beat(p,0,judge?.30:.19,judge?.49:.41);
    const hip=beat(p,.16,judge?.46:.31,.84);
    const cut=beat(p,judge?.28:.13,judge?.506:.38,.91);
    const follow=beat(p,.46,.69,.99);
    const weight=judge?1:.71;
    carrier.position.x+=heights[id]*weight*(-.023*draw+.042*hip);
    rotate('hips',-3*draw+3.5*hip,weight*(-14*draw+16*hip));
    rotate('spine',-4*draw+6*cut,weight*(-10*draw+13*hip));
    rotate('chest',-5*draw+7*cut,weight*(-14*draw+15*cut+5*follow),-3*draw+3*follow);
    rotate('neck',2*draw-4*cut,7*draw-9*hip);
    rotate('upperArmR',weight*(-65*draw-37*cut-12*follow),weight*(-24*draw+32*cut+12*follow),weight*(-22*draw+15*cut+8*follow));
    // Cant the thin sword just above the stone at the end of the diagonal.
    const clearance=judge?0:beat(p,.17,.47,.84)+.34*beat(p,.59,.81,.99);
    rotate('forearmR',weight*(-42*draw-12*cut-8*follow)-9*clearance,weight*(-6*draw+14*cut));
    rotate('handR',-9*draw+12*cut+6*follow-12*clearance,9*draw-11*cut,-6*draw+14*follow);
    rotate('upperArmL',-16*draw+4*cut,0,9*draw+12*cut);
    rotate('forearmL',-14*draw-10*cut);
  }

  function attack(p) {
    if (id === 'judge' || id === 'sword') {
      swordStrike(p);
      return;
    }
    const draw=beat(p,0,.18,.47);
    const strike=beat(p,.12,.38,.96);
    if (id === 'corpse') {
      rotate('hips', -4 * draw + 8 * strike);
      rotate('spine', -5 * draw + 10 * strike);
      rotate('head', 3 * draw - 4 * strike);
      rotate('upperArmR', 6 * draw - 17 * strike, 0, -4 * draw);
      rotate('upperArmL', 4 * draw - 13 * strike, 0, 4 * draw);
      rotate('forearmL', -6 * strike);
      const airborne=Math.sin(Math.PI*p);
      carrier.position.y+=heights[id]*.095*airborne;
      for(const side of ['L','R']){
        rotate('thigh'+side,-20*airborne-8*strike);
        rotate('shin'+side,29*airborne+11*strike);
        rotate('foot'+side,-7*airborne);
      }
      return;
    }
    if (id === 'ward') {
      rotate('hips', -3 * draw + 6 * strike);
      rotate('chest', -7 * draw + 9 * strike);
      for (const side of ['L', 'R']) {
        rotate('upperArm' + side, 7 * draw - 19 * strike);
        rotate('forearm' + side, -9 * draw + 13 * strike);
      }
      return;
    }
    if (id === 'black' || id === 'white') {
      const hand='L';
      const sweep = id === 'black' ? -1 : 1;
      if(id==='white'){
        // The snare has just closed. Reel the chain inward and let the
        // extended palm settle while the banner remains upright.
        const pull=(1-ease(.34,.95,p)),lift=beat(p,.10,.42,1);
        gait.guideHand('L',.12*pull+.10*lift,.16*pull-.04*lift,-.04*pull-.13*lift,pull);
        rotate('chest',-2*pull-4*lift,-7*pull+7*lift);rotate('handL',20*pull-14*lift,9*lift);
        return;
      }
      rotate('spine', -4 * draw + 4 * strike, sweep * (-9 * draw + 12 * strike));
      rotate('chest', 0, sweep * (-7 * draw + 10 * strike));
      rotate('upperArm' + hand, -18 * draw - 9 * strike, sweep * (9 * draw - 13 * strike));
      rotate('forearm' + hand, -8 * draw + 12 * strike);
      rotate('hand' + hand, -7 * draw + 8 * strike);
      return;
    }
    rotate('spine', -2 * draw + 4 * strike, -9 * draw + 9 * strike);
    rotate('chest', 0, -7 * draw + 9 * strike);
    rotate('head', 0, 3 * draw - 4 * strike);
    rotate('upperArmR', -8 * draw - 21 * strike, -9 * draw + 11 * strike);
    rotate('forearmR', -17 * draw + 13 * strike);
    rotate('handR', -4 * draw + 14 * strike);
    rotate('upperArmL', -6 * draw + 2 * strike);
  }

  const ritual=makeRitual(id,heights[id],carrier,gait,rotate);

  function articulate(name, curl, spread, tip) {
    const base=joints[name],end=joints[name+'Tip'];
    if(base){
      base.bone.quaternion.multiply(delta.setFromAxisAngle(palmNormal,spread*RAD));
      base.bone.quaternion.multiply(delta.setFromAxisAngle(fingerAcross,curl*RAD));
    }
    if(end)end.bone.quaternion.multiply(delta.setFromAxisAngle(fingerAcross,tip*RAD));
  }

  function swordFingers(pose,p,t,follow) {
    if(id!=='sword'||!joints.sealIndex)return;
    let seal=0,accent=0,open=0,brace=0;
    if(pose==='cast'||pose==='ultimate'||pose==='invoke'){
      const {duration,release,impacts,cancelAfter}=actionTiming(id,pose);
      const sec=p*duration;
      seal=ease(.10,release+.16,sec)*(1-ease(cancelAfter,duration-.03,sec));
      for(const impact of impacts)accent+=beat(sec,impact-.16,impact,impact+.18);
      if(pose==='invoke'){
        // Unfurl the palm as the gate opens, then join the two fingers for the verdict.
        open=beat(sec,.36,.84,1.64)*.90+beat(sec,1.76,2.09,2.51)*.43;
        seal*=1-open;
      }
    }else if(pose==='attack'){
      seal=.82*beat(p,.04,.34,.97);
      accent=beat(p,.19,.38,.67);
      brace=.4*beat(p,0,.18,.41);
    }else if(pose==='dodge'||pose==='hit'){
      brace=.83*beat(p,0,.32,1);
    }
    if(follow>=0&&follow<=1)accent+=.55*beat(follow,.13,.38,.93);
    const breath=Math.sin(t*1.47+.20)*(1-seal)*(1-open);
    // The sculpt already has curved distal phalanges. Straighten the index
    // first, lightly splay its neighbour, fold the ulnar fingers towards the
    // palm, then bring the opposing thumb across the tucked ring finger.
    articulate('sealIndex',7+2*breath-15*seal-8*open+13*brace,1-4.2*seal+7*open+2*accent,5+breath-20*seal-11*open+11*brace);
    articulate('sealMiddle',10+2*breath-17*seal-11*open+15*brace,-1+4.4*seal-2*open,8+breath-23*seal-13*open+14*brace);
    articulate('sealRing',14+3*breath+36*seal-14*open+10*brace,1.5+4*seal-6*open,12+2*breath+35*seal-13*open+9*brace);
    articulate('sealLittle',18+3*breath+37*seal-17*open+8*brace,1+6*seal-10*open,15+2*breath+36*seal-16*open+8*brace);
    articulate('sealThumb',4+breath+17*seal-6*open+7*brace,-4-21*seal+8*open-4*accent,6+breath+23*seal-7*open+5*brace);
  }

  function burst(p, charging) {
    const set=beat(p,0,.12,.49), drive=beat(p,.08,.47,.88), land=beat(p,.62,.84,1);
    const scale=heights[id];
    carrier.position.y+=scale*(drive*.020-.062*set-.058*land);
    rotate('hips',7*set+(charging?13:8)*drive+8*land,0,charging?0:5*drive);
    rotate('spine',3*set+6*drive-5*land,-7*drive);
    rotate('head',-6*drive+4*land,4*drive);
    rotate('thighL',-27*set-39*drive-14*land);
    rotate('shinL',44*set+50*drive+22*land);
    rotate('thighR',-19*set+17*drive-29*land);
    rotate('shinR',35*set+25*drive+48*land);
    rotate('footL',-14*set-9*drive-12*land);
    rotate('footR',-11*set+14*drive-19*land);
    rotate('upperArmL',-13*set-22*drive+6*land,0,5*drive);
    rotate('upperArmR',-8*set+9*drive-10*land,0,-4*drive);
  }

  function cloth(dt, pose,p) {
    if(!drapes.length)return;
    const cut=(pose==='attack'||pose==='slash')?beat(p,.23,.50,.88):0;

    const stride=gait.weight, turn=gait.bend;
    for(const panel of drapes) {
      const swinging=Math.sin(TAU*(gait.phase-panel.phase)-.44);
      const back=panel.name==='clothBack', flank=panel.name==='clothL'?1:-1;
      const targetPitch=stride*(back?5+4*swinging:2+7*swinging)+gait.acceleration*.62-chestPitchRate*1.1;
      const targetRoll=clamp(turn,-4,4)*1.65+(back?2.4:flank*1.4)*swinging*stride+cut*3.4-chestTurnRate*1.25;
      const omega=back?12:15, decay=Math.exp(-omega*dt);
      const dx=panel.pitch-targetPitch, dz=panel.roll-targetRoll;
      const bx=panel.vPitch+omega*dx, bz=panel.vRoll+omega*dz;
      panel.pitch=targetPitch+(dx+bx*dt)*decay; panel.vPitch=(panel.vPitch-omega*bx*dt)*decay;
      panel.roll=targetRoll+(dz+bz*dt)*decay; panel.vRoll=(panel.vRoll-omega*bz*dt)*decay;
      rotate(panel.name,panel.pitch,0,panel.roll);
    }
  }

  function resetMotion(){
    previousPose=previousTime=null;transition=transitionDuration=previousProgress=0;
    sampledDt=1/60;chestPitchRate=chestTurnRate=0;lastPosition.set(0,0,0);
    gait.reset();reset();
    for(const link of bindings){link.last.copy(link.bone.quaternion);link.spin.set(0,0,0);}
    for(const panel of drapes)panel.pitch=panel.roll=panel.vPitch=panel.vRoll=0;
  }

  function animate(pose = 'idle', time = 0, intensity = 1, input) {
    const t=Number.isFinite(time)?time:0;
    const p=Number.isFinite(intensity)?clamp(intensity,0,1):1;
    if(pose==='reference'){if(previousPose!=='reference'){resetMotion();previousPose='reference';}return false;}
    const elapsed=previousTime===null||t<previousTime?1/60:t-previousTime;
    const dt=clamp(Number.isFinite(input?.dt)?input.dt:elapsed,0,.10);
    const repeat=(pose==='attack'||pose==='cast'||pose==='ultimate'||pose==='invoke') && p+.35<previousProgress;
    if(previousPose!==pose || repeat){
      // Store the actual last blended pose. Interrupting a still-blending cast
      // should begin from the arms and silhouette visible on the previous frame.
      priorPosition.copy(carrier.position);priorRotation.copy(carrier.quaternion);
      carryVelocity.subVectors(priorPosition,lastPosition).multiplyScalar(1/sampledDt).clampLength(0,heights[id]*1.8);
      for(const link of bindings){
        link.previous.copy(link.bone.quaternion);
        increment.copy(link.last).invert().multiply(link.previous);
        const sign=increment.w<0?-1:1;
        link.spin.set(increment.x*sign,increment.y*sign,increment.z*sign);
        const sine=link.spin.length();
        if(sine>1e-6)link.spin.multiplyScalar(Math.min(14,2*Math.atan2(sine,Math.abs(increment.w))/sampledDt)/sine);
      }
      const spellToAction=previousPose==='ultimate'||previousPose==='invoke'||previousPose==='cast';
      const fast=pose==='dodge'||pose==='charge'||pose==='hit';
      transitionDuration=previousPose===null?0:fast?(spellToAction?.145:.088):
        pose==='attack'||pose==='slash'?(spellToAction?.16:.098):pose==='walk'||pose==='idle'?.20:.185;
      transition=0;
    }
    previousPose=pose;previousTime=t;previousProgress=p;
    lastPosition.copy(carrier.position);
    for(const link of bindings)link.last.copy(link.bone.quaternion);
    sampledDt=Math.max(.001,dt);
    reset();
    const footfall=gait.advance(pose,dt,input);
    idle(t);
    if(pose!=='dead'&&pose!=='dodge'&&pose!=='charge'&&pose!=='summon')gait.body(rotate);
    if ((id==='sword' || id==='judge') && (pose==='walk' || pose==='idle')) {
      // The reference sword hangs almost to the floor. Lift the elbow as the
      // hips lower into the stride so the blade travels clear of the paving.
      const carry=.18+.82*gait.weight;
      rotate('upperArmR',-8*carry);
      rotate('forearmR',-20*carry);
      rotate('handR',-4*carry);
    }
    switch(pose){
      case 'cast':
        if(ritual('cast',p,input?.followThrough ?? -1))break;
        cast(p);
        carrier.position.y-=heights[id]*(.018*beat(p,0,.31,.67)+.013*beat(p,.41,.67,1));
        break;
      case 'ultimate':case 'invoke':ritual(pose,p,input?.followThrough ?? -1);break;
      case 'dodge':burst(p,false);break;
      case 'charge':burst(p,true);break;
      case 'attack':case 'slash':{
        if(pose==='slash')swordStrike(p);else attack(p);
        const draw=beat(p,0,.28,.55), strike=beat(p,.23,.53,.91), tail=beat(p,.51,.75,1);
        carrier.position.y-=heights[id]*(.024*draw+.027*strike);
        carrier.position.z+=heights[id]*(.034*strike-.013*draw);
        rotate('hips',-2*draw+3*strike,0,1.8*draw-3.0*strike);
        rotate('chest',2*tail,-3*tail);
        if(id==='ward')gait.sealGrip(.065*draw-.074*strike,.16*strike-.026*draw);
        break;
      }
      case 'summon':{
        const rise=ease(0,1,p);
        rotate('hips',-4*(1-rise));rotate('chest',7*(1-rise),4*(1-rise));
        rotate('head',14*(1-rise)-3*rise);rotate('upperArmR',-7*rise,0,-4*rise);
        break;
      }
      case 'hit':{
        const recoil=Math.sin(Math.PI*p);
        carrier.position.y-=heights[id]*.027*recoil;
        rotate('hips',-3.5*recoil,0,2*recoil);
        rotate('spine',-10*recoil,-6*recoil);rotate('neck',-6*recoil);
        rotate('upperArmL',-5*recoil,0,6*recoil);rotate('upperArmR',-7*recoil,0,-5*recoil);
        break;
      }
      case 'dead':{
        const fall=ease(0,1,p);
        carrier.rotation.set(-1.47*fall,0,.12*fall);carrier.position.y=heights[id]*.075*fall;
        rotate('chest',-5*fall);rotate('neck',11*fall);rotate('shinL',15*fall);
        rotate('upperArmL',-12*fall,0,11*fall);
        break;
      }
    }
    const follow=input?.followThrough;
    swordFingers(pose,p,t,follow);
    if(follow>=0 && follow<=1 && (pose==='ultimate'||pose==='invoke'||pose==='cast')){
      // A short basic cast can share the shoulder while the other arm still
      // conducts the standing spell. Keep the long spell's torso and planted foot.
      const draw=beat(follow,0,.17,.43),send=beat(follow,.13,.38,.94);
      if(id==='ward'){
        rotate('handR',-draw*5+send*10);rotate('handL',-draw*5+send*10);
      }else{
        rotate('upperArmR',draw*4-send*9,-draw*3+send*4);
        rotate('forearmR',-draw*6+send*9);
        rotate('handR',-draw*8+send*17,send*6);
      }
    }
    // Blend the trunk first. Solve the legs against that trunk position last
    // so intermediate blends keep a planted shoe at its contact point.
    transition=Math.min(transitionDuration,transition+dt);
    const u=transitionDuration?transition/transitionDuration:1;
    const blend=u*u*u*(10+u*(-15+6*u));
    if(blend<1){
      const coast=.049*(1-Math.exp(-transition/.049));
      carrier.position.lerp(priorPosition,1-blend).addScaledVector(carryVelocity,coast*(1-blend));
      carrier.quaternion.slerp(priorRotation,1-blend);
      for(const link of bindings){
        const speed=link.spin.length();
        predicted.copy(link.previous);
        if(speed>.0001){
          axis.copy(link.spin).multiplyScalar(1/speed);
          predicted.multiply(increment.setFromAxisAngle(axis,speed*coast));
        }
        link.bone.quaternion.slerp(predicted,1-blend);
      }
    }
    const chest=joints.chest;
    increment.copy(chest.last).invert().multiply(chest.bone.quaternion);
    const sign=increment.w<0?-1:1;
    chestPitchRate=clamp(2*sign*increment.x/sampledDt,-7,7);
    chestTurnRate=clamp(2*sign*increment.y/sampledDt,-7,7);
    gait.feet(pose,dt);cloth(dt,pose,p);
    return footfall;
  }
  return {animate,resetMotion};
}

export function createActor(id, variant = 0, alignHeading = false) {
  const template = templates.get(id);
  if (!template) throw new Error('角色尚未载入 ' + id);

  const root = new THREE.Group();
  root.name = id;
  root.userData.rearCaptureDegrees = template.scene.userData.rearCaptureDegrees ?? 180;
  root.userData.sideCaptureDegrees = template.scene.userData.sideCaptureDegrees ?? 90;
  const carrier = new THREE.Group();
  root.add(carrier);
  const normalized = new THREE.Group();
  normalized.scale.setScalar(template.scale);
  if (alignHeading) normalized.rotation.y = THREE.MathUtils.degToRad(90-root.userData.sideCaptureDegrees);
  normalized.position.y = -template.floor * template.scale;
  carrier.add(normalized);
  const model = cloneRig(template.scene);
  normalized.add(model);
  const {animate,resetMotion} = makeMotion(model, carrier, id, variant);
  const skeletons = new Set();
  model.traverse(node => {
    if (node.isSkinnedMesh) skeletons.add(node.skeleton);
  });
  // Shared GPU meshes and textures remain cached. A gallery can discard just
  // the per-actor bone textures when switching characters.
  return {root, animate, resetMotion, dispose: () => skeletons.forEach(skeleton => skeleton.dispose())};
}

export const makeMaster = (id = 'thunder') => createActor(id,0,true);
export const makeJiangshi = (variant = 0) => createActor('corpse',variant,true);
export const makeZhongkui = () => createActor('judge',0,true);
