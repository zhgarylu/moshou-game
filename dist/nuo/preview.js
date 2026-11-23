import * as T from '../vendor/three.module.js';
import {buildCourtyard} from '../courtyard.js';
import {palette} from './materials.js';
import {makeSwordswoman} from './figure.js';
import {V,clamp,mix} from './form.js';
import {cast} from './ensemble-art.js';
import {makeEnsembleFigure} from './ensemble-body.js';

const $=selector=>document.querySelector(selector),all=selector=>[...document.querySelectorAll(selector)];
const canvas=$('#stage'),status=$('.status'),range=$('#timeline'),play=$('#play');
const angles={front:0,left:Math.PI/2,right:-Math.PI/2,back:Math.PI};
const lenses={close:{radius:.89,height:1.791,fov:34},body:{radius:2.10,height:1.43,fov:40},field:{radius:6.45,height:1.55,fov:51}};
const actorZ=3.0;
const yawDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function mark(buttons,test){for(const b of buttons)b.setAttribute('aria-pressed',String(test(b)));}
async function start(){
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.autoClear=false;
  const scene=new T.Scene(),court=buildCourtyard(scene),camera=new T.PerspectiveCamera(34,1,.015,170);
  const fill=new T.HemisphereLight(0xbcdcf5,0x655346,.16),portrait=new T.DirectionalLight(0xffe4c6,.82);
  scene.add(fill,portrait,portrait.target);
  const paints=await palette(renderer),figures=new Map(),roster=$('#cast');
  let actor,role,pendingRole=null;
  const ground=new T.Mesh(new T.PlaneGeometry(.86,.63),new T.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{},
    vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 p;void main(){float d=dot(p,p);gl_FragColor=vec4(.018,.030,.027,.36*(1.-smoothstep(.03,1.,d)));}'
  }));ground.rotation.x=-Math.PI/2;ground.position.set(0,.008,actorZ);scene.add(ground);
  scene.traverse(o=>{if(o.isLight){o.layers.enable(1);if(o.shadow)o.shadow.camera.layers.enable(1);}});
  const rt=new T.WebGLRenderTarget(4,4,{type:renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType});
  const backdrop=new T.Scene(),screen=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const blur=new T.ShaderMaterial({uniforms:{image:{value:rt.texture},texel:{value:new T.Vector2()},amount:{value:1},shade:{value:.65}},depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 coord;uniform sampler2D image;uniform vec2 texel;uniform float amount,shade;
    void main(){vec3 col=texture2D(image,coord).rgb*.12;
    for(int i=0;i<24;i++){float t=(float(i)+.5)/24.;float a=float(i)*2.399963;vec2 p=vec2(cos(a),sin(a))*sqrt(t)*amount*texel;col+=texture2D(image,coord+p).rgb*(.88/24.);}
    gl_FragColor=vec4(col*shade,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  backdrop.add(new T.Mesh(new T.PlaneGeometry(2,2),blur));
  let lens='close',yaw=-.46,pitch=.035,goalYaw=yaw,goalPitch=pitch,zoom=1,orbit=false;
  let radius=.89,height=1.791,fov=34,lead=0,camHeight=0;
  let time=0,speed=1,playing=false,width=1,heightPx=1,last=0,courtAt=-1000,cameraMoved=true,drawPose=true,resizePending=true;
  const aim=V(0,0,0),pointers=new Map();let pinch=0;
  const renderState=document.documentElement.dataset;
  function transport(){
    const action=cast[role].action;
    range.value=time.toFixed(3);$('#time').textContent=time.toFixed(2)+' / 2.00 秒';
    $('#play-icon').textContent=playing?'Ⅱ':'▶';$('#play-label').textContent=playing?'暂停':time>=1.999?'重播'+action:time>0?'继续'+action:'播放'+action;
    renderState.playing=String(playing);
  }
  function togglePlay(){
    if(time>=1.999)time=0;playing=!playing;drawPose=true;transport();
  }
  function turn(active){orbit=active;$('#orbit').setAttribute('aria-pressed',String(orbit));if(active)mark(all('[data-angle]'),()=>false);}
  function chooseAngle(key){
    turn(false);goalYaw=yaw+yawDelta(yaw,angles[key]);goalPitch=lens==='field'?.40:.015;mark(all('[data-angle]'),b=>b.dataset.angle===key);cameraMoved=true;
  }
  function chooseLens(key){
    lens=key;zoom=1;mark(all('button[data-lens]'),b=>b.dataset.lens===key);
    if(key==='field')chooseAngle('back');
    else if(Math.abs(goalPitch-.4)<.01)goalPitch=.045;
    renderState.lens=key;cameraMoved=true;
  }
  all('button[data-lens]').forEach(b=>b.onclick=()=>chooseLens(b.dataset.lens));
  all('[data-angle]').forEach(b=>b.onclick=()=>chooseAngle(b.dataset.angle));
  all('[data-speed]').forEach(b=>b.onclick=()=>{speed=Number(b.dataset.speed);mark(all('[data-speed]'),x=>Number(x.dataset.speed)===speed);});
  $('#orbit').onclick=()=>turn(!orbit);play.onclick=togglePlay;
  range.oninput=()=>{playing=false;time=Number(range.value);drawPose=true;transport();};
  function touchDistance(){const [a,b]=pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);}
  canvas.addEventListener('pointerdown',e=>{
    canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    turn(false);if(pointers.size===2)pinch=touchDistance();
  });
  canvas.addEventListener('pointermove',e=>{
    const prev=pointers.get(e.pointerId);if(!prev)return;
    const dx=e.clientX-prev.x,dy=e.clientY-prev.y;prev.x=e.clientX;prev.y=e.clientY;
    if(pointers.size===2){const d=touchDistance();if(pinch>1&&d>1)zoom=clamp(zoom*pinch/d,.62,2.3);pinch=d;}
    else{goalYaw-=dx*.0075;goalPitch=clamp(goalPitch+dy*.004,-.46,.93);mark(all('[data-angle]'),()=>false);}
    cameraMoved=true;
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>pointers.delete(e.pointerId));
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(clamp(e.deltaY,-100,100)*.0018),.62,2.3);cameraMoved=true;},{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(e.key===' '){e.preventDefault();togglePlay();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();turn(false);mark(all('[data-angle]'),()=>false);goalYaw+=(e.key==='ArrowRight'?.18:e.key==='ArrowLeft'?-.18:0);
    goalPitch=clamp(goalPitch+(e.key==='ArrowUp'?.08:e.key==='ArrowDown'?-.08:0),-.46,.93);cameraMoved=true;
  });
  const resize=new ResizeObserver(()=>{resizePending=true;});resize.observe(canvas);
  function size(){
    const b=canvas.getBoundingClientRect();width=Math.max(1,b.width);heightPx=Math.max(1,b.height);
    const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(2900000/(width*heightPx)));
    renderer.setPixelRatio(ratio);renderer.setSize(width,heightPx,false);
    const scale=Math.min(1,1000/width);rt.setSize(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(heightPx*scale)));
    blur.uniforms.texel.value.set(1/rt.width,1/rt.height);camera.aspect=width/heightPx;resizePending=false;cameraMoved=true;
  }
  function bodyDistance(a,p){
    const sx=Math.sin(a),cz=Math.cos(a),sp=Math.sin(p),cp=Math.cos(p);
    const tan=Math.tan(lenses.body.fov*Math.PI/360);let result=lenses.body.radius;
    for(const point of actor.framing){
      const x=-point.x,y=point.y-lenses.body.height,z=-point.z;
      const forward=x*sx*cp+y*sp+z*cz*cp;
      const horizontal=Math.abs(x*cz-z*sx)/(tan*camera.aspect*.79);
      const vertical=Math.abs(-x*sx*sp+y*cp-z*cz*sp)/(tan*.88);
      result=Math.max(result,forward+Math.max(horizontal,vertical));
    }
    return result;
  }
  function draw(now){
    if(resizePending)size();
    const wall=last?(now-last)/1000:0,dt=Math.min(.08,wall);last=now;
    if(playing){time=Math.min(2,time+wall*speed);if(time===2)playing=false;drawPose=true;transport();}
    if(drawPose){actor.show(time);drawPose=false;}
    if(orbit)goalYaw+=dt*.48;
    const L=lenses[lens],alpha=1-Math.exp(-dt*15),nextRadius=(lens==='body'?bodyDistance(yaw+Math.PI,pitch):L.radius)*zoom;
    const nextLead=lens==='field'?2.35:0,nextCamHeight=lens==='field'?.40:0;
    const moving=Math.abs(yaw-goalYaw)+Math.abs(pitch-goalPitch)+Math.abs(radius-nextRadius)+Math.abs(height-L.height)+Math.abs(fov-L.fov)+Math.abs(lead-nextLead)+Math.abs(camHeight-nextCamHeight)>.0004;
    yaw=mix(yaw,goalYaw,alpha);pitch=mix(pitch,goalPitch,alpha);radius=mix(radius,nextRadius,alpha);height=mix(height,L.height,alpha);fov=mix(fov,L.fov,alpha);lead=mix(lead,nextLead,alpha);camHeight=mix(camHeight,nextCamHeight,alpha);
    const a=yaw+Math.PI,dx=Math.sin(a),dz=Math.cos(a);
    aim.set(-dx*lead,height-camHeight,actorZ-dz*lead);
    camera.position.set(dx*Math.cos(pitch)*radius,height+Math.sin(pitch)*radius,actorZ+dz*Math.cos(pitch)*radius);
    camera.fov=fov;camera.lookAt(aim);
    if(width>750&&lens!=='field')camera.setViewOffset(width,heightPx,-width*.058,0,width,heightPx);else camera.clearViewOffset();
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    portrait.position.copy(camera.position);portrait.position.y+=2.5;portrait.position.x-=2.2;portrait.target.position.set(0,height,actorZ);
    if(lens==='field'&&Math.abs(lead-nextLead)<.012){
      renderer.setRenderTarget(null);renderer.clear();camera.layers.enableAll();court.update(dt,now*.001);renderer.render(scene,camera);
    }else{
      const bg=scene.background;
      if(cameraMoved||moving||orbit||now-courtAt>142){
        court.update(dt,now*.001);camera.layers.set(0);renderer.setRenderTarget(rt);renderer.clear();renderer.render(scene,camera);courtAt=now;cameraMoved=false;
      }
      blur.uniforms.amount.value=lens==='close'?10:lens==='body'?3.5:0;blur.uniforms.shade.value=lens==='close'?.39:.70;
      renderer.setRenderTarget(null);renderer.clear();renderer.render(backdrop,screen);renderer.clearDepth();
      scene.background=null;camera.layers.set(1);renderer.render(scene,camera);scene.background=bg;
    }
    if(pendingRole===null && renderState.role===role && (status.hidden===false||renderState.ready!=='true')){status.hidden=true;play.disabled=false;range.disabled=false;renderState.ready='true';}
  }
  let request=0;
  function urlFor(key){
    const url=new URL(location.href);url.searchParams.set('role',key);url.searchParams.set('view',lens);
    url.searchParams.delete('angle');
    for(const b of all('[data-angle]'))if(b.getAttribute('aria-pressed')==='true')url.searchParams.set('angle',b.dataset.angle);
    if(orbit)url.searchParams.set('orbit','1');else url.searchParams.delete('orbit');
    if(speed!==1)url.searchParams.set('speed',String(speed));else url.searchParams.delete('speed');
    url.searchParams.delete('play');return url;
  }
  function selectRole(key){
    const meta=cast[key];let next=figures.get(key);
    if(!next){next=key==='sword'?makeSwordswoman(paints):makeEnsembleFigure(paints,key);figures.set(key,next);}
    if(actor)scene.remove(actor.root);
    actor=next;role=key;actor.root.rotation.y=Math.PI;actor.root.position.set(0,0,actorZ);
    actor.root.traverse(o=>{o.layers.set(1);if(o.isMesh)o.castShadow=true;});scene.add(actor.root);
    lenses.close.height=meta.close[0];lenses.close.radius=meta.close[1];lenses.body.height=meta.body;
    ground.scale.setScalar(key==='ward'||key==='judge'||key==='black'?1.24:key==='white'?.87:1);
    $('.caption h1').textContent=meta.name;$('.caption p').textContent=meta.detail;document.title=meta.name+' · 角色试装 | 道法世界';
    $('.back').href=key==='priest'?'./':'./actors.html?role='+key;$('.back').firstChild.textContent=key==='priest'?'返回义庄 ':'返回角色图鉴 ';$('.scrub label').textContent=meta.action;
    $('.transport').setAttribute('aria-label',meta.name+'动作播放');range.setAttribute('aria-label',meta.action+'动作进度');
    $('.stage').setAttribute('aria-label',meta.name+'的实时三维预览');canvas.setAttribute('aria-label','拖动环视'+meta.name+'，滚轮或双指缩放，方向键调整角度');
    for(const a of roster.children){const current=a.dataset.role===key;a.setAttribute('aria-current',current?'true':'false');
      if(current && roster.scrollWidth>roster.clientWidth)roster.scrollLeft+=a.getBoundingClientRect().left-roster.getBoundingClientRect().left-(roster.clientWidth-a.offsetWidth)/2;}
    time=0;playing=false;drawPose=true;cameraMoved=true;last=0;renderState.role=role;transport();
  }
  function switchRole(key){
    const token=++request;pendingRole=key;renderState.ready='false';status.textContent='正在载入'+cast[key].name+'…';status.hidden=false;
    requestAnimationFrame(()=>{if(token!==request)return;
      try{selectRole(key);pendingRole=null;}catch(error){console.error(error);status.textContent='这个角色未能载入，请重新选择。';}
    });
  }
  for(const [key,meta] of Object.entries(cast)){
    const link=document.createElement('a');link.dataset.role=key;link.href='?role='+key;
    const icon=document.createElement('img');icon.src=new URL('./portraits/'+key+'.webp',import.meta.url).href;icon.alt='';
    const name=document.createElement('span');name.textContent=meta.name;link.append(icon,name);
    link.style.setProperty('--tint',meta.tint);
    link.addEventListener('click',event=>{
      if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();if(renderState.ready==='true'&&role===key)return;
      history.pushState(null,'',urlFor(key));switchRole(key);
    });roster.append(link);
  }
  function readLocation(initial=false){
    const params=new URLSearchParams(location.search),candidate=params.get('role'),key=Object.hasOwn(cast,candidate)?candidate:'sword';
    ++request;pendingRole=null;selectRole(key);
    turn(false);speed=params.get('speed')==='0.25'?.25:1;
    mark(all('[data-speed]'),b=>Number(b.dataset.speed)===speed);
    chooseLens(Object.hasOwn(lenses,params.get('view'))?params.get('view'):'close');
    if(Object.hasOwn(angles,params.get('angle')))chooseAngle(params.get('angle'));
    else if(lens!=='field'){goalYaw=-.46;goalPitch=.035;mark(all('[data-angle]'),()=>false);}
    if(initial){yaw=goalYaw;pitch=goalPitch;height=lenses[lens].height;radius=lenses[lens].radius;fov=lenses[lens].fov;}
    if(params.get('orbit')==='1')turn(true);if(params.get('play')==='1')togglePlay();
  }
  window.addEventListener('popstate',()=>readLocation());readLocation(true);
  document.addEventListener('visibilitychange',()=>{last=0;});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);status.hidden=false;status.textContent='三维画面已中断，请刷新预览。';});
  transport();renderer.setAnimationLoop(draw);
}
start().catch(e=>{console.error(e);status.hidden=false;status.textContent='无法载入三维预览。请确认浏览器已开启 WebGL 2，再刷新页面。';});
