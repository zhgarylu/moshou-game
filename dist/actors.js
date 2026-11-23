import * as THREE from './vendor/three.module.js';
import {createActor, preloadActors} from './characters.js';
import {disciplines} from './disciplines.js';
import {actionTiming} from './action-timing.js';

const roles = {
  thunder: ['雷法天师','雷部法师',[20,19,502,920],[578,10,988,907],[1120,80,1630,700],.68,.907],
  sword: ['剑诀天师','剑修',[59,14,493,922],[630,14,1039,905],[1135,55,1625,708],.68,.905],
  ward: ['镇坛天师','守坛力士',[56,12,511,918],[597,15,1027,902],[1198,105,1610,639],.56,.905],
  judge: ['钟馗','召唤神将',[16,8,551,922],[585,17,1044,902],[1080,25,1655,714],.52,.899],
  corpse: ['跳僵','义庄邪祟',[143,10,524,918],[613,8,965,905],[1118,25,1630,727],.38,.903],
  black: ['黑无常','冥府阴差',[67,12,551,922],[657,17,1050,935],[1130,25,1630,680],.56,.884],
  white: ['白无常','冥府阴差',[17,4,527,926],[643,10,1093,909],[1085,35,1615,715],.62,.881]
};
const $ = q => document.querySelector(q);
const canvas = $('#model'), refCanvas = $('#reference'), message = $('#message');
const roster = $('#roster'), panels = $('#panels'), refPane = $('#ref-pane');
const buttons = [...document.querySelectorAll('[data-view]')];
const params = new URLSearchParams(location.search);
let role = Object.hasOwn(roles,params.get('role')) ? params.get('role') : 'thunder';
let preset = ['front','back','side','right','face'].includes(params.get('view')) ? params.get('view') : 'front';
let comparing = params.get('compare') === '1';
let actor, asset, size, center, box, reference, request = 0;
let orbitRadius=0;
const facePivot=new THREE.Vector3(),viewCenter=new THREE.Vector3();
let orbiting=params.get('turn')==='1', freeView=false, refView='', lastFrame;
const extraRefs=new Map(), motion=$('#motion');
const wantedMotion=params.get('motion');
if([...motion.options].some(o=>o.value===wantedMotion))motion.value=wantedMotion;
let yaw = 0, pitch = 0, zoom = 1, motionTime=0, animationTime=0;
let effectsEnabled=params.get('effects')==='1',effectsReady=false,effectCycle=-1,effectRequest=0,effects;
const spellStage=new THREE.Group(),spellTarget=new THREE.Vector3(0,0,-3.7);
const previewPrograms=new Set();
let renderer;
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,.01,140);
scene.add(spellStage);
scene.add(new THREE.AmbientLight(0xffffff,1.85));
const key = new THREE.DirectionalLight(0xfff2e3,1.18);
key.position.set(-3,5,4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xe0eef7,.75);
fill.position.set(3,3,-4);
scene.add(fill);

function locationState() {
  const url = new URL(location.href);
  url.searchParams.set('role',role);
  if (comparing) url.searchParams.set('compare','1'); else url.searchParams.delete('compare');
  if (preset !== 'front') url.searchParams.set('view',preset); else url.searchParams.delete('view');
  if(motion.value!=='reference')url.searchParams.set('motion',motion.value);else url.searchParams.delete('motion');
  if(orbiting)url.searchParams.set('turn','1');else url.searchParams.delete('turn');
  if(effectsEnabled && showsSpell())url.searchParams.set('effects','1');else url.searchParams.delete('effects');
  history.replaceState(null,'',url);
}
function showsSpell(){return !!disciplines[role] && ['ultimate','invoke'].includes(motion.value);}
async function preparePreview(){
  const ticket=++effectRequest;
  effects?.clear();spellStage.visible=false;effectsReady=false;effectCycle=-1;motionTime=0;
  const enabled=effectsEnabled&&showsSpell();
  const toggle=$('#fx-preview');toggle.hidden=!showsSpell();toggle.setAttribute('aria-pressed',String(enabled));
  $('#model-pane').classList.toggle('spell-stage',enabled);
  if(!actor)return;
  message.textContent='';
  viewpoint();
  if(!enabled)return;
  message.textContent='正在准备法术…';
  try{
    const [module]=await Promise.all([import('./spells.js'),
      motion.value==='invoke' ? preloadActors(['judge']) : role==='ward' ? import('./ward-effects.js').then(m=>m.preloadWardRelic()) : null]);
    if(ticket!==effectRequest)return;
    effects??=module.makeEffects(spellStage);
    spellStage.rotation.y=actor.root.rotation.y+Math.PI;
    const program=motion.value==='invoke'?'invoke':role;
    if(!previewPrograms.has(program)){
      effects.prime(role,renderer,motion.value);
      // A viewer can switch roles immediately. Compile the temporary
      // materials before clearing them or handing the stage to another role.
      renderer.compile(spellStage,camera,scene);
      effects.clear();previewPrograms.add(program);
    }
    spellStage.visible=true;
    effectsReady=true;motionTime=0;lastFrame=performance.now();message.textContent='';viewpoint();
  }catch(error){
    if(ticket!==effectRequest)return;
    message.textContent='法术载入失败，点击「法术同演」可关闭后重试。';console.error(error);
  }
}
function stance(id) {
  return id==='thunder' && motion.value!=='reference' ? 'thunder-guard' : id;
}
const directions=['front','side','back','right'];
function viewYaw(view){
  const side=actor?.root.userData.sideCaptureDegrees??90;
  return THREE.MathUtils.degToRad(({front:0,side,back:actor?.root.userData.rearCaptureDegrees??180,right:side-180,face:0})[view]);
}
function closestView(){
  if(!freeView)return preset;
  const nearest=directions.reduce((a,b)=>Math.cos(yaw-viewYaw(a))>Math.cos(yaw-viewYaw(b))?a:b);
  return preset==='face'&&nearest==='front'?'face':nearest;
}
function refDraw() {
  if (!comparing || !reference) return;
  refView=closestView();
  const side=refView==='side'||refView==='right';
  const guardFront=refView==='front'&&asset==='thunder-guard';
  const refId=side?role+'-'+refView:guardFront?'thunder-guard-front':null;
  let source=reference;
  if(refId){
    if(!extraRefs.has(refId)){
      const image=new Image();extraRefs.set(refId,image);image.onload=refDraw;
      image.src='./art/refs/'+refId+'.webp';
    }
    source=extraRefs.get(refId);
  }
  if (!source.complete || !source.naturalWidth) return;
  const width = refCanvas.clientWidth, height = refCanvas.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(devicePixelRatio,2);
  refCanvas.width = Math.round(width*dpr); refCanvas.height = Math.round(height*dpr);
  const ctx = refCanvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const back = refView === 'back', face = refView === 'face';
  const [x,y,x2,y2] = refId ? [0,0,source.naturalWidth,source.naturalHeight] : roles[role][face ? 4 : back ? 3 : 2];
  const sw = x2-x, sh = y2-y;
  const scale = Math.min(height/(sh*(face ? 1.02 : 1.14)),width/(sw*1.09));
  const w = sw*scale, h = sh*scale;
  ctx.drawImage(source,x,y,sw,sh,(width-w)/2,(height-h)/2,w,h);
  $('#ref-tag').textContent = side ? '建模补图 · '+(role==='thunder'?'垂手':'')+(refView==='side'?'左侧':'右侧') : guardFront?'建模补图 · 垂手前侧':'定稿 · ' + (face ? '面部' : back ? '背面' : '前侧面');
}
function measureOrbit(){
  const hip=actor.root.getObjectByName('hips');
  const p=new THREE.Vector3();hip.getWorldPosition(p);center.x=p.x;center.z=p.z;
  facePivot.set(0,0,0);orbitRadius=0;
  const headY=box.min.y+size.y*roles[role][6];
  let count=0;
  actor.root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const geo=mesh.geometry,xyz=geo.getAttribute('position'),head=geo.getAttribute('_capture_head');
    for(let i=0;i<xyz.count;i++){
      p.fromBufferAttribute(xyz,i).applyMatrix4(mesh.matrixWorld);
      orbitRadius=Math.max(orbitRadius,Math.hypot(p.x-center.x,p.z-center.z));
      if(head?.getX(i)>.75 && Math.abs(p.y-headY)<.035*size.y){facePivot.add(p);count++;}
    }
  });
  if(count)facePivot.multiplyScalar(1/count);
  else actor.root.getObjectByName('head').getWorldPosition(facePivot);
  facePivot.y=headY;
}
function viewpoint() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!renderer || !actor || !w || !h) return;
  const aspect = w/h, face = preset === 'face';
  const aim = viewCenter.copy(center);
  const swordRaised = !face && $('#motion').value === 'attack' && (role==='judge' || role==='sword');
  if (swordRaised) aim.y += size.y*(role==='judge' ? .25 : .17);
  if(face)aim.copy(facePivot);
  let fit = face ? Math.max(size.y*.221,size.y*.166/aspect) :
    Math.max(size.y*(swordRaised ? (role==='judge' ? 1.68 : 1.49) : 1.14), 2*orbitRadius*1.06/aspect);
  if(effectsReady){
    const gate=motion.value==='invoke';
    const range=gate?4.8:3.4,angle=actor.root.rotation.y;
    const height=gate?3.95:role==='ward'?3.5:role==='sword'?4.65:3.65;
    aim.set(Math.sin(angle)*range,height,Math.cos(angle)*range);
    fit=Math.max(gate?11.8:role==='ward'?10.5:role==='sword'?12.6:10.3,(gate?13.4:12.2)/aspect);
  }
  const half = fit/(zoom*2), distance = effectsReady?30:size.y*3.3;
  const elevation=effectsReady?Math.min(1.25,pitch+.22):pitch;
  Object.assign(camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
  camera.position.set(aim.x+Math.sin(yaw)*Math.cos(elevation)*distance,
    aim.y+Math.sin(elevation)*distance,aim.z+Math.cos(yaw)*Math.cos(elevation)*distance);
  camera.lookAt(aim); camera.updateProjectionMatrix();
}
function resize() {
  if (renderer && canvas.clientWidth && canvas.clientHeight) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const desired = Math.max(1.35, Math.min(devicePixelRatio,3));
    const ratio = Math.max(1, Math.min(desired,Math.sqrt(3600000/(width*height))));
    renderer.setDrawingBufferSize(width,height,ratio);
  }
  viewpoint(); refDraw();
}
function selectView(next, stop=true) {
  preset = next;freeView=false;
  if(next==='face' && effectsEnabled){effectsEnabled=false;preparePreview();}
  if(stop)orbiting=false;
  $('#orbit').setAttribute('aria-pressed',String(orbiting));
  yaw = viewYaw(next);
  pitch = 0; zoom = 1;
  for (const b of buttons) b.setAttribute('aria-pressed',String(b.dataset.view===next));
  viewpoint(); refDraw(); locationState();
  if (asset && stance(role)!==asset) choose(role);
}
function compare(on) {
  comparing = on; refPane.hidden = !on;
  $('#compare').setAttribute('aria-pressed',String(on));
  panels.classList.toggle('split',on);
  resize(); locationState();
}
async function choose(id) {
  ++effectRequest;effectsReady=false;effects?.clear();
  role = id;
  $('#nuo-entry').href = './nuo.html?role='+encodeURIComponent(id);
  $('#nuo-entry').hidden = false;
  const playable=['thunder','sword','ward'].includes(id);
  $('.back').href=playable?'./?class='+id:'./';
  $('.back').textContent=playable?'以此职业入庄':'返回义庄';
  for(const opt of motion.options){
    const allowed=opt.value==='guard'?id==='thunder':opt.value==='charge'?id==='black':
      ['ultimate','invoke','dodge'].includes(opt.value)?playable:true;
    opt.hidden=opt.disabled=!allowed;
    if(!allowed && opt.selected)motion.value='reference';
  }
  motion.querySelector('[value=ultimate]').textContent=disciplines[id]?.thunder.name||'职业大招';
  asset = stance(id);
  const modelId = asset;
  const ticket = ++request, meta = roles[id];
  $('#type').textContent = meta[1]; $('#name').textContent = meta[0];
  document.title = meta[0] + ' · 角色图鉴';
  for (const b of roster.children) b.setAttribute('aria-current',String(b.dataset.role===id));
  if (actor) { scene.remove(actor.root); actor.dispose(); actor = null; }
  zoom = 1;
  reference = new Image();
  reference.onload = () => { if (ticket === request) refDraw(); };
  reference.src = './art/refs/'+id+'.webp';
  message.textContent = '正在载入'+meta[0]+'…';
  locationState();
  try {
    if (!renderer) throw new Error('请开启浏览器的图形加速后刷新页面。');
    await preloadActors([modelId]);
    if (ticket !== request) return;
    actor = createActor(modelId,0,true);
    // Keep the approved camera angles, while the walking feet and knees move
    // along this character's anatomical forward axis in the gallery too.
    actor.root.rotation.y = THREE.MathUtils.degToRad(actor.root.userData.sideCaptureDegrees-90);
    actor.animate('reference',0,0);
    actor.root.traverse(node=>{
      for (const material of [].concat(node.material || [])) {
        if (material.userData.studioLight) material.userData.studioLight.value = 1;
      }
    });
    $('#model-pane figcaption').textContent = id==='thunder' ? (modelId==='thunder-guard' ? '实时模型 · 垂手守坛' : '实时模型 · 举符') : '实时模型';
    scene.add(actor.root);
    actor.root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(actor.root,true);
    size = box.getSize(new THREE.Vector3()); center = box.getCenter(new THREE.Vector3());
    measureOrbit();
    if (!freeView) yaw=viewYaw(preset);
    lastFrame=performance.now();message.textContent='';resize();preparePreview();
  } catch (error) {
    if (ticket !== request) return;
    message.textContent = renderer ? '角色载入失败。' : error.message;
    if (renderer) {
      const retry = document.createElement('button'); retry.textContent='重新载入';
      retry.onclick=()=>choose(id); message.append(retry);
    }
    console.error(error);
  }
}
for (const [id,[name,type]] of Object.entries(roles)) {
  const b = document.createElement('button'); b.dataset.role=id;
  const img=document.createElement('img'); img.src='./art/refs/'+id+'-icon.webp'; img.alt='';
  const details=document.createElement('span'), title=document.createElement('strong'), sub=document.createElement('small');
  title.textContent=name; sub.textContent=type; details.append(title,sub); b.append(img,details);
  b.onclick=()=>choose(id); roster.append(b);
}
for (const b of buttons) b.onclick=()=>selectView(b.dataset.view);
$('#compare').onclick=()=>compare(!comparing);
motion.onchange=()=>{if(stance(role)!==asset)choose(role);else preparePreview();locationState();};
$('#fx-preview').onclick=()=>{effectsEnabled=!effectsEnabled;preparePreview();locationState();};
$('#orbit').onclick=()=>{
  orbiting=!orbiting;$('#orbit').setAttribute('aria-pressed',String(orbiting));
  if(orbiting){freeView=true;for(const b of buttons)b.setAttribute('aria-pressed','false');}
  locationState();
};
function orbit(dx,dy) {
  orbiting=false;freeView=true;$('#orbit').setAttribute('aria-pressed','false');
  yaw-=dx*.009; pitch=THREE.MathUtils.clamp(pitch+dy*.007,-.85,.85);
  for (const b of buttons) b.setAttribute('aria-pressed','false'); viewpoint();
  if(closestView()!==refView)refDraw();
  if(new URLSearchParams(location.search).has('turn'))locationState();
}
function magnify(factor) { zoom=THREE.MathUtils.clamp(zoom*factor,.62,3.5); viewpoint(); }
const pointers=new Map();
let pinch=0;
const separation=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
canvas.onpointerdown=e=>{
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2) pinch=separation();
};
canvas.onpointermove=e=>{
  const old=pointers.get(e.pointerId); if(!old)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1) orbit(e.clientX-old.x,e.clientY-old.y);
  if(pointers.size===2){const d=separation();if(pinch>2&&d>2)magnify(d/pinch);pinch=d;}
};
canvas.onlostpointercapture=canvas.onpointercancel=canvas.onpointerup=e=>pointers.delete(e.pointerId);
canvas.addEventListener('wheel',e=>{e.preventDefault();magnify(Math.exp(-e.deltaY*.0015));},{passive:false});
canvas.onkeydown=e=>{
  if(e.key==='ArrowLeft')orbit(12,0); else if(e.key==='ArrowRight')orbit(-12,0);
  else if(e.key==='ArrowUp')orbit(0,10); else if(e.key==='ArrowDown')orbit(0,-10);
  else if(e.key==='+')magnify(1.12); else if(e.key==='-')magnify(1/1.12); else return;
  e.preventDefault();
};
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor(0x000000,0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  const observer=new ResizeObserver(resize); observer.observe(canvas); observer.observe(refPane);
  renderer.setAnimationLoop(now=>{
    if (!actor) { renderer.render(scene,camera); return; }
    const dt=Math.max(0,Math.min(.10,(now-lastFrame)/1000));lastFrame=now;
    motionTime+=dt;animationTime+=dt;
    if(orbiting){
      if(!freeView){freeView=true;for(const b of buttons)b.setAttribute('aria-pressed','false');}
      yaw+=dt*.48;viewpoint();
      if(comparing&&closestView()!==refView)refDraw();
    }
    let pose=motion.value,progress=1;
    if(pose==='guard')pose='reference';
    if(!['reference','idle','walk'].includes(pose)){
      const length=actionTiming(role,pose).duration;
      const period=effectsReady?Math.max(length,pose==='invoke'?4.75:4.35)+.58:length+.62;
      const cycle=Math.floor(motionTime/period),elapsed=motionTime-cycle*period;
      if(effectsReady && cycle!==effectCycle){
        effectCycle=cycle;effects.clear();
        if(pose==='invoke')effects.summon(spellTarget);
        else if(role==='thunder')effects.thunder(spellTarget);
        else effects.forClass(role).summon(spellTarget);
        effects.update(elapsed);
      }else if(effectsReady)effects.update(dt);
      if(elapsed>length)pose='idle';
      else if(role==='judge'&&pose==='cast')pose='summon';
      progress=Math.min(1,elapsed/length);
    }
    actor.animate(pose,animationTime,progress);
    renderer.render(scene,camera);
  });
}catch(error){console.error(error);}
compare(comparing); selectView(preset,false); choose(role);
