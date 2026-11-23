import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {clone as cloneRig} from './vendor/addons/utils/SkeletonUtils.js';
import {makeLocomotion} from './locomotion.js';

const loader=new GLTFLoader(),assets=new Map();
const heights={sword:2.04,thunder:2.14,ward:2.16,corpse:2.12,black:2.32,white:2.56,judge:6,priest:2.64};
const {clamp,smoothstep}=T.MathUtils,rad=Math.PI/180;
const ease=(a,b,x)=>smoothstep(x,a,b);
const pulse=(a,b,c,x)=>ease(a,b,x)*(1-ease(b,c,x));

export function preloadBattleActors(ids){
  return Promise.all(ids.map(id=>{
    if(!Object.hasOwn(heights,id))throw new Error('未知实战角色 '+id);
    if(!assets.has(id)){
      const url=new URL('./art/battle/'+id+'.glb',import.meta.url);
      const pending=loader.loadAsync(url.href).then(gltf=>{
        const template={scene:gltf.scene,clip:gltf.animations[0]};
        template.scene.traverse(o=>{if(o.isSkinnedMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material.map.anisotropy=4;o.material.emissiveMap=o.material.map;o.material.emissive.setHex(0xffffff);o.material.emissiveIntensity=.12;}});
        assets.set(id,template);return template;
      }).catch(error=>{assets.delete(id);throw error;});
      assets.set(id,pending);
    }
    return assets.get(id);
  }));
}

// Seconds in each figure's approved two-second gesture. The upper body follows the release
// and recovery of the active spell. Feet remain in the movement layer during a moving cast.
function gesture(id,pose,p){
  const recover=(a,b)=>1-ease(a,b,p);
  switch(pose){
    case 'ultimate':
      if(id==='ward')return (1.20*ease(.03,.49,p)+.38*ease(.64,.771,p))*recover(.84,1);
      if(id==='sword')return (1.50*ease(.01,.39,p)+.35*ease(.58,.81,p))*recover(.87,1);
      return (1.39*ease(.01,.27,p)+.36*ease(.63,.78,p))*recover(.87,1);
    case 'cast':
      if(id==='black'||id==='white')return 1.14*ease(0,.95,p);
      if(id==='corpse')return .53*ease(.02,.8,p);
      return 1.46*pulse(0,.42,1,p);
    case 'charge':return 1.12+.55*ease(0,.67,p);
    case 'slash':return .30+1.54*ease(0,.65,p);
    case 'attack':
      if(id==='corpse')return .56+1.11*ease(0,.88,p);
      if(id==='white')return 1.14+.68*ease(0,.73,p);
      return (id==='ward'?1.35:id==='sword'?1.38:1.48)*pulse(.01,.39,1,p);
    case 'invoke':return 1.39*ease(0,.36,p)*recover(.77,1);
    case 'ritual':return 1.95*ease(0,.92,p);
    case 'summon':return .37*ease(.02,.73,p);
    default:return 0;
  }
}
export function makeBattleActor(id,variant=0){
  const template=assets.get(id);
  if(!template?.scene)throw new Error('实战角色尚未载入 '+id);
  const root=new T.Group(),carrier=new T.Group(),model=cloneRig(template.scene);
  root.name='battle-'+id;root.add(carrier);carrier.add(model);
  const bones={},bindings=[],rest=[];
  model.traverse(o=>{if(o.isBone){bones[o.name]={bone:o};rest.push([o,o.position.clone(),o.quaternion.clone()]);}});
  for(const track of template.clip.tracks){
    const {nodeName,propertyName}=T.PropertyBinding.parseTrackName(track.name);
    const bone=bones[nodeName]?.bone;
    if(bone)bindings.push({bone,prop:propertyName,sampler:track.createInterpolant()});
  }
  const height=heights[id],gait=makeLocomotion(root,carrier,bones,id,height,variant);
  const deltaQ=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
  function rotate(name,x=0,y=0,z=0){
    const bone=bones[name]?.bone;if(!bone)return;
    euler.set(x*rad,y*rad,z*rad,'YXZ');bone.quaternion.multiply(deltaQ.setFromEuler(euler));
  }
  let gestureTime=0,previous=null,impact=0,lean=0;
  function resetMotion(){
    for(const [b,p,q] of rest){b.position.copy(p);b.quaternion.copy(q);}
    carrier.position.set(0,0,0);carrier.rotation.set(0,0,0);gestureTime=impact=lean=0;previous=null;gait.reset();
  }
  function animate(pose='idle',time=0,p=1,motion){
    const dt=clamp(motion?.dt??(previous===null?1/60:time-previous),0,.12);previous=time;
    const step=gait.advance(pose,dt,motion),target=gesture(id,pose,p);
    const rate=pose==='attack'||pose==='slash'?36:pose==='hit'?21:18;
    gestureTime+=(target-gestureTime)*(1-Math.exp(-rate*dt));
    for(const [node,pos,q] of rest){node.position.copy(pos);node.quaternion.copy(q);}
    for(const {bone,prop,sampler} of bindings)bone[prop].fromArray(sampler.evaluate(gestureTime));
    carrier.position.set(0,0,0);carrier.rotation.set(0,0,0);
    const breath=Math.sin(time*(id==='corpse'?2.2:2.7));
    carrier.position.y=height*breath*.0025;
    rotate('chest',breath*.72);rotate('head',-breath*.48);
    gait.body((name,x,y,z)=>{
      if((id==='ward'||id==='black')&&/^(upperArm|forearm|hand)/.test(name))return;
      rotate(name,x,y,z);
    });
    const flow=gait.weight,walk=Math.sin(gait.phase*Math.PI*2);
    rotate('skirt',flow*(1.8+walk*3.8)+gestureTime*1.8,0,flow*walk*2.5);
    const recoil=pose==='hit'?Math.sin(Math.PI*(.22+.78*p)):0;
    impact+=(recoil-impact)*(1-Math.exp(-23*dt));
    rotate('chest',-13*impact,6*impact);rotate('head',8*impact);carrier.position.z-=height*.045*impact;
    if(pose==='invoke'){rotate('chest',-5.5*pulse(0,.34,.85,p),-6*gestureTime);rotate('head',-4*gestureTime);}
    if(pose==='ultimate'&&id==='sword')rotate('chest',-3*gestureTime,14*pulse(.31,.58,.86,p)-26*pulse(.73,.83,1,p));
    if(pose==='slash'&&id==='judge'){
      const sweep=ease(.25,.53,p),follow=ease(.53,.87,p);
      rotate('chest',4*sweep,-29*ease(0,.25,p)+64*sweep-12*follow);
      rotate('upperArmR',-9*ease(0,.30,p)+29*sweep,28*sweep,21*sweep);
      rotate('handR',28*sweep,-54*sweep,52*sweep);
    }
    if(pose==='ritual')rotate('chest',2*gestureTime,12*pulse(.50,.70,.92,p));
    if(motion?.followThrough>=0 && pose!=='attack' && id!=='ward')rotate('forearmR',-14*Math.sin(Math.PI*motion.followThrough));
    const burst=pose==='dodge'||pose==='charge'?pulse(0,.28,1,p):0;
    lean+=(burst-lean)*(1-Math.exp(-26*dt));carrier.rotation.x=lean*.27;
    carrier.position.y-=height*lean*.064;rotate('thighR',-31*lean);rotate('shinR',52*lean);rotate('thighL',16*lean);rotate('shinL',21*lean);
    if(pose==='dead'){
      const fall=ease(0,.89,p);carrier.rotation.x=-1.48*fall;carrier.position.y=height*.09*fall;
      rotate('thighR',-22*fall);rotate('forearmL',-28*fall);
    }
    gait.feet(pose,dt);return step;
  }
  function dispose(){model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});root.removeFromParent();}
  return {root,animate,resetMotion,dispose};
}
