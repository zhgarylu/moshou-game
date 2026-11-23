import * as THREE from './vendor/three.module.js';
import {makeRitualEffects} from './ritual-effects.js';
import {makeRites} from './rites.js';
import {makeSwordEffects} from './sword-effects.js';
import {makeWardEffects} from './ward-effects.js';
import { makeZhongkui } from './characters.js';
import {actionTiming} from './action-timing.js';

const TAU = Math.PI * 2;
const PI = Math.PI;
const clamp = THREE.MathUtils.clamp;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const between = (a, b) => a + (b - a) * Math.random();
const clampFloor = p => v3(clamp(p.x, -15, 15), 0, clamp(p.z, -13, 13));
const THUNDER_BEATS = actionTiming('thunder','ultimate').impacts;
const [GATE_OPEN,GATE_STEP,GATE_SLASH]=actionTiming('thunder','invoke').impacts;
// 五方雷部：东青、南赤、西白、北玄，末雷归中黄。符名与雷色一一对应。
const THUNDER_COLORS = [0x63f0c6, 0xff8a5c, 0xe4eeff, 0xa08cff, 0xffd36a];
const TALISMAN_NAMES = ['東', '南', '西', '北', '中'];
// Each value encodes the painted bars from top to bottom.
const TRIGRAMS = [7, 6, 5, 4, 3, 2, 1, 0];

function paint(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function circle(ctx, radius) {
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.stroke();
}

function brush(ctx, glyph, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = '900 ' + size + 'px "Kaiti SC", KaiTi, STKaiti, "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x, y);
}

function sealMap(glyph, color) {
  return paint(768, 768, (g, w, h) => {
    g.translate(w / 2, h / 2);
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = 4;
    for (const r of [345, 335, 262, 253, 197, 103, 96]) circle(g, r);
    g.lineWidth = 2;
    for (let i = 0; i < 96; i++) {
      g.save();
      g.rotate(TAU * i / 96);
      g.fillRect(-1.5, -333, 3, i % 4 === 0 ? 15 : 7);
      g.restore();
    }
    for (let i = 0; i < 8; i++) {
      g.save();
      g.rotate(TAU * i / 8);
      for (let j = 0; j < 3; j++) {
        const y = -305 + j * 12;
        if (TRIGRAMS[i] & (1 << j)) g.fillRect(-25, y, 50, 6);
        else { g.fillRect(-25, y, 20, 6); g.fillRect(5, y, 20, 6); }
      }
      brush(g, '乾兑离震巽坎艮坤'[i], 0, -227, 24, color);
      g.rotate(PI / 8);
      g.beginPath(); g.moveTo(0, -265); g.lineTo(0, -318); g.stroke();
      g.restore();
    }
    for (let i = 0; i < 5; i++) {
      const a = TAU * i / 5 - PI / 2, b = a + TAU * 2 / 5;
      g.beginPath();
      g.moveTo(Math.cos(a) * 168, Math.sin(a) * 168);
      g.lineTo(Math.cos(b) * 168, Math.sin(b) * 168);
      g.stroke();
      g.beginPath(); g.arc(Math.cos(a)*168, Math.sin(a)*168, 7, 0, TAU); g.fill();
    }
    brush(g, glyph, 0, -3, 100, color);
    g.lineWidth = 3;
    g.strokeRect(-52, -52, 104, 104);
  });
}

function paperMap(glyph, index) {
  return paint(144, 320, (g, w, h) => {
    const wash = g.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, '#fff4af'); wash.addColorStop(.35, '#ffc966'); wash.addColorStop(1, '#e18a26');
    g.fillStyle = wash;
    g.beginPath(); g.moveTo(6, 4); g.lineTo(w-4, 8); g.lineTo(w-8, h-12);
    g.lineTo(w-44, h-5); g.lineTo(w-71, h-10); g.lineTo(9, h-2); g.closePath(); g.fill();
    g.strokeStyle = '#8c2721'; g.lineWidth = 3;
    g.strokeRect(15, 17, w-30, h-39);
    brush(g, '敕', 71, 52, 41, '#a62a1a');
    g.save(); g.translate(72, 128);
    g.beginPath(); g.moveTo(-41, -39); g.quadraticCurveTo(-25,-48,-15,-25);
    g.lineTo(-31,-9); g.lineTo(0,-24); g.lineTo(12,-47); g.lineTo(10,-12);
    g.lineTo(37,-27); g.lineTo(21,-3); g.lineTo(35,4); g.lineTo(3,15);
    g.lineTo(-31,7); g.lineTo(-8,-5); g.lineTo(13,0); g.lineTo(-12,60); g.lineTo(26,29);
    g.strokeStyle = '#8a160e'; g.lineWidth = 6; g.stroke(); g.restore();
    brush(g, glyph, 71, 209, 51, '#963018');
    g.fillStyle = '#a73322'; g.fillRect(44, 248, 55, 31);
    brush(g, index === 5 ? '酆都' : '雷令', 71, 265, 20, '#ffe18a');
  });
}

function doorMap() {
  return paint(384, 720, (g, w, h) => {
    g.fillStyle = '#8b291e'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 7) {
      g.strokeStyle = x % 2 ? '#963427' : '#772720';
      g.lineWidth = x % 3 + 1;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x-8,200,x+5,400,x-1,h); g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = ['#52211e', '#cf985a', '#dfb573'][i]; g.lineWidth = [12, 7, 2][i];
      g.strokeRect(12+i*8, 12+i*8, w-24-i*16, h-24-i*16);
    }
    for (let i = 0; i < 4; i++) {
      g.save(); g.translate(i%2 ? w-34 : 34, i>1 ? h-36 : 36); g.scale(i%2 ? -1 : 1,i>1 ? -1 : 1);
      g.strokeStyle = '#ecc180'; g.lineWidth=5;
      g.beginPath(); g.moveTo(1,66); g.lineTo(1,1); g.lineTo(87,1); g.lineTo(87,17);
      g.lineTo(28,17); g.lineTo(28,43); g.lineTo(12,43); g.lineTo(12,27); g.stroke(); g.restore();
    }
    for (const y of [104, 330, 544]) for (let x = 58; x < w-45; x += 53) {
      const r=g.createRadialGradient(x-2,y-3,1,x,y,8);
      r.addColorStop(0,'#ffe4a5'); r.addColorStop(.4,'#cb9450'); r.addColorStop(1,'#59341f');
      g.fillStyle=r; g.beginPath(); g.arc(x,y,7,0,TAU); g.fill();
    }
    g.save(); g.translate(w/2,222); g.rotate(PI/4);
    g.strokeStyle='#d9a061'; g.lineWidth=5; g.strokeRect(-59,-59,118,118); g.restore();
    brush(g,'鎮',w/2,223,73,'#ffd99a');
    g.strokeStyle='#dbab6e'; g.lineWidth=3; g.beginPath(); g.arc(w/2,446,48,0,TAU); g.stroke();
    brush(g,'獄',w/2,449,51,'#e6b67c');
  });
}

function pointsMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {age:{value:0}, tint:{value:new THREE.Color()}, scale:{value:1}, gravity:{value:4}, lifetime:{value:1}},
    vertexShader: `
      attribute vec3 velocity; attribute float diameter; attribute float variation;
      uniform float age; uniform float scale; uniform float gravity; uniform float lifetime;
      varying float fade;
      void main(){
        float t=age; vec3 p=position+velocity*t;
        p.y-=gravity*t*t*.5; vec4 mv=modelViewMatrix*vec4(p,1.);
        float k=t/(lifetime*(.68+.32*variation));
        fade=clamp(1.-k,0.,1.);
        gl_PointSize=clamp(diameter*scale*(.65+.35*fade)*345./max(1.,-mv.z),1.,64.);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform vec3 tint; varying float fade;
      void main(){float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard;
        float core=pow(max(0.,1.-d),2.2); gl_FragColor=vec4(mix(tint,vec3(1.),core*.38),core*fade);
        #include <colorspace_fragment>
      }`
  });
}

// A tapered faceted conductor is visible from any camera angle. Side branches use
// the same buffer as the core branches to keep a full thunderstroke to three draws.
function lightningPath(start, end, jitter, steps) {
  const pts = [];
  const phase = between(0, TAU);
  for (let i=0; i<=steps; i++) {
    const u=i/steps, edge=Math.sin(PI*u)**.65;
    pts.push(start.clone().lerp(end,u).add(v3(
      (between(-.68,.68)+Math.sin(u*18+phase)*.45)*jitter*edge,
      between(-.22,.22)*jitter*edge,
      (between(-.68,.68)+Math.cos(u*15+phase)*.45)*jitter*edge
    )));
  }
  return pts;
}

function conductors(paths, radii) {
  const rings=paths.reduce((sum,path)=>sum+path.points.length,0);
  const positions=radii.map(()=>new Float32Array(rings*12)), indices=[];
  const tangent=v3(),side=v3(),up=v3(),axis=v3();let base=0;
  for(const {points,width} of paths){
    for(let i=0;i<points.length;i++){
      const p=points[i],vertex=base+4*i;
      tangent.subVectors(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]).normalize();
      axis.set(Math.abs(tangent.y)>.9?1:0,Math.abs(tangent.y)>.9?0:1,0);
      side.crossVectors(tangent,axis).normalize();up.crossVectors(tangent,side).normalize();
      const envelope=width*(.82+.18*Math.sin(PI*i/(points.length-1)));
      // The core and both halos wrap the same path. Calculate its frame once.
      for(let j=0;j<4;j++){
        const n=(j%2?up:side),d=j<2?envelope:-envelope,k=(vertex+j)*3;
        for(let layer=0;layer<radii.length;layer++){
          const xyz=positions[layer],r=radii[layer]*d;
          xyz[k]=p.x+r*n.x;xyz[k+1]=p.y+r*n.y;xyz[k+2]=p.z+r*n.z;
        }
        if(i+1<points.length){
          const a=vertex+j,b=vertex+(j+1)%4;
          indices.push(a,b,a+4,b,b+4,a+4);
        }
      }
    }
    base+=4*points.length;
  }
  return positions.map(xyz=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(xyz,3));geometry.setIndex(indices);
    return geometry;
  });
}

function arcSheet(radius, sweep) {
  const pos=[], uv=[], idx=[];
  for (let i=0;i<=52;i++){
    const u=i/52, a=(-.5+u)*sweep;
    const width=Math.sin(PI*u)**.65;
    for (let j=0; j<2; j++) {
      const r=radius-(j ? .0 : width*1.42);
      pos.push(Math.sin(a)*r,(.5-u)*2.3+(j ? 0 : .48*width),Math.cos(a)*r);
      uv.push(u,j);
    }
    if(i<52){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(idx); return geo;
}

function gateCurtain() {
  return new THREE.ShaderMaterial({
    transparent:true, side:THREE.DoubleSide, depthWrite:false,
    uniforms:{time:{value:0}, alpha:{value:1}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec2 vUv; uniform float time; uniform float alpha;
      void main(){
        vec2 p=(vUv-.5)*2.; float r=length(p*vec2(.84,1.02));
        float a=atan(p.y,p.x); float w=sin(23.*r-4.*a-time*5.+1.8*sin(a*3.+time));
        float wave=pow(.5+.5*w,5.)*.42;
        float edge=pow(clamp(max(abs(p.x),abs(p.y)),0.,1.),5.);
        vec3 col=mix(vec3(.020,.008,.055),vec3(.54,.025,.025),r*.58);
        col+=vec3(1.,.21,.045)*(wave+edge*.72);gl_FragColor=vec4(col,alpha*(.80+.19*edge));
        #include <colorspace_fragment>
      }`
  });
}

export function makeEffects(scene, onFeedback = () => {}, actors={}, camera=null) {
  const active=new Set(), actorPool=[];
  let preparing=false;
  const retained=new Map();
  function feedback(type,power){if(!preparing)onFeedback(type,power);}
  const ground=new THREE.PlaneGeometry(1,1);
  const box=new THREE.BoxGeometry(1,1,1);
  const disk=new THREE.RingGeometry(.92,1,96);
  const sphere=new THREE.SphereGeometry(1,12,8);
  const ringHandle=new THREE.TorusGeometry(.21,.043,6,20);
  const seals={thunder:sealMap('雷','#adf4ff'), summon:sealMap('敕','#ffe8ae')};
  const papers=[...TALISMAN_NAMES,'令','鎮'].map(paperMap);
  const quarterSeals=TALISMAN_NAMES.map((name,i)=>paint(256,256,(g,w,h)=>{
    const tint='#'+new THREE.Color(THUNDER_COLORS[i]).getHexString();
    g.translate(w/2,h/2);g.strokeStyle=tint;g.lineWidth=7;circle(g,112);g.lineWidth=3;circle(g,96);
    for(let k=0;k<8;k++){g.save();g.rotate(TAU*k/8);g.fillStyle=tint;g.fillRect(-3,-122,6,16);g.restore();}
    brush(g,name,0,4,118,tint);
  }));
  const radiance=paint(160,160,(g,w,h)=>{
    const halo=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
    for(const [stop,alpha] of [[0,.98],[.095,.85],[.22,.53],[.46,.20],[.72,.046],[1,0]]) {
      halo.addColorStop(stop,'rgba(255,255,255,'+alpha+')');
    }
    g.fillStyle=halo;g.fillRect(0,0,w,h);
  });
  const brushStroke=paint(256,64,(g,w,h)=>{
    // Long translucent frays keep a broad ink stroke readable from above.
    for(let y=3;y<h-3;y+=2){
      const strength=Math.sin(PI*y/h)**.6;
      const x=between(0,24)+(1-strength)*34, end=w-between(0,48)-(1-strength)*30;
      const gradient=g.createLinearGradient(x,0,end,0);
      gradient.addColorStop(0,'rgba(255,255,255,0)');
      gradient.addColorStop(.18,'rgba(255,255,255,'+strength*.74+')');
      gradient.addColorStop(.67,'rgba(255,255,255,'+strength+')');
      gradient.addColorStop(1,'rgba(255,255,255,0)');
      g.fillStyle=gradient;g.fillRect(x,y,end-x,2.3);
    }
  });
  const door=doorMap();
  const slashSeal=paint(384,384,(g,w,h)=>{
    g.translate(w/2,h/2);g.rotate(.06);g.fillStyle='rgba(176,26,18,.9)';
    g.beginPath();g.moveTo(-150,-140);g.lineTo(146,-152);g.lineTo(152,144);g.lineTo(-146,150);g.closePath();g.fill();
    g.strokeStyle='rgba(255,214,150,.9)';g.lineWidth=8;g.strokeRect(-124,-124,248,248);
    brush(g,'斬',0,8,206,'rgba(255,226,170,.96)');
  });
  const plaqueMap=paint(512,130,(g,w,h)=>{
    g.fillStyle='#281e27';g.fillRect(0,0,w,h);g.strokeStyle='#f6c980';g.lineWidth=7;
    g.strokeRect(7,7,w-14,h-14);g.strokeStyle='#875027';g.lineWidth=3;g.strokeRect(17,16,w-34,h-32);
    brush(g,'奉　敕　降　魔',w/2,h/2+5,63,'#ffe5a2');
  });
  const cinder=paint(512,512,(g,w,h)=>{
    g.translate(w/2,h/2);
    const fog=g.createRadialGradient(0,0,1,0,0,204);
    fog.addColorStop(0,'rgba(11,12,18,.94)');fog.addColorStop(.5,'rgba(26,22,30,.62)');fog.addColorStop(1,'rgba(21,20,27,0)');
    g.fillStyle=fog;g.fillRect(-w/2,-h/2,w,h);
    for(let i=0;i<19;i++){
      g.save();g.rotate(TAU*i/19);g.beginPath();g.moveTo(0,0);
      let x=0,y=0;const n=4+Math.floor(between(0,3));
      for(let j=0;j<n;j++){x+=between(-17,17);y-=between(13,30);g.lineTo(x,y);}
      g.lineWidth=between(1,4);g.strokeStyle='rgba(208,113,56,.8)';g.stroke();
      g.restore();
    }
  });
  function track(duration, build) {
    const group=new THREE.Group(), resources=[];
    scene.add(group);
    const own=r=>(resources.push(r),r);
    const fx={group,own,age:0,step:null,onEnd:null,dead:false};
    function release() {
      if(fx.dead) return;
      fx.dead=true;active.delete(fx);group.removeFromParent();
      fx.onEnd?.();
      resources.forEach(r=>{if(!warmed.has(r))r.dispose();});
    }
    fx.dispose=release;
    fx.advance=dt=>{
      if(fx.dead) return;
      fx.age+=dt; fx.step(Math.min(fx.age,duration),dt);
      if(fx.age>=duration) release();
    };
    build(fx); active.add(fx); fx.step(0,0); return fx;
  }
  function basic(fx, color, additive=true, map=null) {
    return fx.own(new THREE.MeshBasicMaterial({
      color, map, transparent:true, side:THREE.DoubleSide, depthWrite:false,forceSinglePass:additive,
      blending:additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped:false
    }));
  }
  function mesh(group, geo, mat, x, y, z, sx=1, sy=1, sz=1) {
    const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);
    group.add(o);return o;
  }
  function surface(fx,g,pos,size,tex,color=0xffffff,glow=true) {
    const mat=basic(fx,color,glow,tex);
    const plane=mesh(g,ground,mat,pos.x,pos.y,pos.z,size,size,1);
    plane.rotation.x=-PI/2; plane.renderOrder=1;return plane;
  }
  function glyph(fx,parent,index,height, width=height*.46) {
    const mat=fx.own(new THREE.SpriteMaterial({map:papers[index],color:0xffffff,transparent:true,depthWrite:false,toneMapped:false}));
    const sprite=new THREE.Sprite(mat);sprite.scale.set(width,height,1);parent.add(sprite); return sprite;
  }
  function glow(fx,parent,pos,color) {
    const mat=fx.own(new THREE.SpriteMaterial({map:radiance,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
    const sprite=new THREE.Sprite(mat);sprite.position.copy(pos);parent.add(sprite);return sprite;
  }
  function blast(pos,color,radius,ttl=.52) {
    track(ttl,fx=>{
      const band=mesh(fx.group,disk,basic(fx,color),pos.x,.065,pos.z);band.rotation.x=-PI/2;band.renderOrder=2;
      fx.step=t=>{
        const u=t/ttl, size=.15+(1-(1-u)**3)*radius;
        band.scale.set(size,size,1);band.material.opacity=(1-u)**1.8;
      };
    });
  }
  function scorch(pos,radius) {
    track(4.2,fx=>{
      const mark=surface(fx,fx.group,v3(pos.x,.038,pos.z),radius*2,cinder,0xffffff,false);
      mark.rotateZ(between(0,TAU));
      fx.step=t=>mark.material.opacity=.9*(1-smooth(2.8,4.2,t));
    });
  }
  function sparks(pos,count,color,speed,ttl=1.1,gravity=5,wide=1) {
    track(ttl,fx=>{
      const xyz=[],vel=[],size=[],random=[];
      for(let i=0;i<count;i++){
        const a=between(0,TAU), r=between(.13,1)*speed, lift=between(.12,1);
        xyz.push(between(-.16,.16),between(0,.28),between(-.16,.16));
        vel.push(Math.sin(a)*r*wide,speed*lift,Math.cos(a)*r*wide);
        size.push(between(.13,.36));random.push(Math.random());
      }
      const geo=fx.own(new THREE.BufferGeometry());
      for(const [key,array,n] of [['position',xyz,3],['velocity',vel,3],['diameter',size,1],['variation',random,1]]) {
        geo.setAttribute(key,new THREE.Float32BufferAttribute(array,n));
      }
      const mat=fx.own(pointsMaterial());
      mat.uniforms.gravity.value=gravity;mat.uniforms.tint.value.set(color);mat.uniforms.lifetime.value=ttl;
      const o=new THREE.Points(geo,mat);o.position.copy(pos);o.frustumCulled=false;fx.group.add(o);
      fx.step=t=>{mat.uniforms.age.value=t;};
    });
  }
  function flash(start,end,color,power,sky=false) {
    const length=start.distanceTo(end);
    const spine=lightningPath(start,end,sky ? 1.05*power : Math.min(.7,length*.12),sky ? 21 : Math.max(4,Math.ceil(length*1.45)));
    const paths=[{points:spine,width:1}];
    const branches=sky ? 7 : power>1 ? 4 : 1;
    for(let j=0;j<branches;j++){
      const k=Math.min(spine.length-2,1+Math.floor((spine.length-2)*(j+.2)/branches));
      const origin=spine[k], dir=end.clone().sub(start).normalize();
      const magnitude=sky ? between(1.3,3.1)*power : between(.3,1.5);
      const tip=origin.clone().addScaledVector(dir,magnitude*.65).add(v3(between(-1,1)*magnitude,between(-.4,.3)*magnitude,between(-1,1)*magnitude));
      if(tip.y<.12)tip.y=.12;
      const twig=lightningPath(origin,tip,magnitude*.19,sky?6:3);
      paths.push({points:twig,width:between(.2,.42)});
      if(sky&&j%3===0) {
        const tip2=twig[3].clone().add(v3(between(-1,1),-.8,between(-1,1)));
        paths.push({points:lightningPath(twig[3],tip2,.18,3),width:.14});
      }
    }
    const final=sky&&power>1.4;
    if(sky) {
      // A few roots fork near head height, so the strike still reads as one
      // trunk landing on the talisman instead of a curtain of light.
      const roots=final?6:3;
      for(let i=0;i<roots;i++){
        const origin=spine[spine.length-3-Math.floor(i%4)*2];
        const angle=TAU*(i+.17)/roots;
        const spread=(final?3.0:2.1)*between(.75,1.2);
        const foot=end.clone().add(v3(Math.cos(angle)*spread,.12,Math.sin(angle)*spread));
        const shoulder=origin.clone().lerp(foot,.5);
        shoulder.x+=Math.cos(angle)*.5; shoulder.y+=.6;
        const upper=lightningPath(origin,shoulder,.3,5);
        const lower=lightningPath(shoulder,foot,.42,6);
        paths.push({points:upper.concat(lower.slice(1)),width:between(.2,.34)});
      }
    }
    const ttl=sky ? (final?.92:.62) : .23;
    track(ttl,fx=>{
      const width=sky ? (final?.072:.085)*power : .041*power;
      const layers=conductors(paths,[width*(sky?3.1:4.4),width*1.55,width*.72]);
      const shell=mesh(fx.group,fx.own(layers[0]),basic(fx,color),0,0,0);
      const rim=mesh(fx.group,fx.own(layers[1]),basic(fx,color),0,0,0);
      const core=mesh(fx.group,fx.own(layers[2]),basic(fx,0xfffaff),0,0,0);
      const halos=[];
      if(sky){
        for(const [u,r,stretch] of [[.62,3.2,1.7],[.82,2.2,2.2],[.98,2.8,.6]]) {
          const point=spine[Math.min(spine.length-1,Math.round(u*(spine.length-1)))];
          halos.push({sprite:glow(fx,fx.group,point,color),r:r*power,stretch});
        }
      }
      fx.step=t=>{
        const p=t/ttl;
        // Real strokes flash, dim, then re-strike along the same channel.
        const level=sky ? Math.min(1,Math.exp(-t*7.5)+.8*Math.exp(-Math.abs(t-.17)*38)+(final?.7*Math.exp(-Math.abs(t-.34)*34):0))*(1-smooth(.55,1,p)) : 1-p;
        shell.material.opacity=(sky?.15:.13)*level;
        rim.material.opacity=.86*level;
        core.material.opacity=Math.min(1,level*1.15);
        for(const {sprite,r,stretch} of halos) {
          const size=r*(1+p*.2);sprite.scale.set(size,size*stretch,1);
          sprite.material.opacity=(final?.26:.17)*level;
        }
      };
    });
  }
  function groundLightning(center,final,color) {
    const paths=[],count=final?12:6;
    for(let i=0;i<count;i++){
      const a=TAU*(i+between(-.22,.22))/count, radius=(final?4.8:2.3)*between(.64,1.16);
      const tip=center.clone().add(v3(Math.cos(a)*radius,.095,Math.sin(a)*radius));
      const line=lightningPath(center.clone().add(v3(0,.115,0)),tip,.45,7);
      for(const p of line)p.y=between(.08,.15);
      paths.push({points:line,width:1});
      const fork=line[4].clone().add(v3(Math.cos(a+.62)*radius*.52,0,Math.sin(a+.62)*radius*.52));
      const branch=lightningPath(line[4],fork,.21,4);for(const p of branch)p.y=.11;
      paths.push({points:branch,width:.48});
    }
    const ttl=final?.86:.50;
    track(ttl,fx=>{
      const layers=conductors(paths,[final?.075:.055,final?.028:.02]);
      const outer=mesh(fx.group,fx.own(layers[0]),basic(fx,color),0,0,0);
      const inner=mesh(fx.group,fx.own(layers[1]),basic(fx,0xfff7d9),0,0,0);
      fx.step=t=>{
        const alpha=1-smooth(.12,1,t/ttl);
        outer.material.opacity=.75*alpha;inner.material.opacity=alpha;
      };
    });
  }
  function bolt(from,to,empowered=false,fromHand=false) {
    const start=from.clone();if(!fromHand)start.y+=1.35;
    const end=to.clone();end.y+=1.05;
    flash(start,end,empowered ? 0xffc464 : 0x75d8ff,empowered ? 1.4 : 1);
    sparks(end,empowered?23:12,empowered?0xffce7b:0x94d8ff,2.2,.36,7);
  }
  // 糯米：一把米粒从掌心抛向目标，落地铺成一片发白的米阵，持续到粘尸效果结束。
  const riceMap=paint(256,256,(g,w,h)=>{
    g.translate(w/2,h/2);
    for(let i=0;i<900;i++){
      const r=Math.sqrt(Math.random())*118,a=between(0,TAU),k=1-r/118;
      g.save();g.translate(Math.cos(a)*r,Math.sin(a)*r);g.rotate(between(0,TAU));
      g.fillStyle='rgba(255,252,238,'+(.35+.6*k)+')';g.beginPath();g.ellipse(0,0,1.6,3.6,0,0,TAU);g.fill();g.restore();
    }
    g.strokeStyle='rgba(255,246,214,.7)';g.lineWidth=3;circle(g,120);
  });
  function rice(from,target,radius,linger) {
    const start=from.clone(),end=clampFloor(target),flight=.32;
    track(flight,fx=>{
      const xyz=[],vel=[],size=[],random=[];
      for(let i=0;i<46;i++){
        xyz.push(between(-.1,.1),between(-.1,.1),between(-.1,.1));
        const spread=v3(between(-1,1),0,between(-1,1)).multiplyScalar(radius*.55/flight);
        const d=end.clone().sub(start).divideScalar(flight).add(spread);
        vel.push(d.x,d.y+9*flight*.5,d.z);size.push(between(.06,.12));random.push(Math.random());
      }
      const geo=fx.own(new THREE.BufferGeometry());
      for(const [key,array,n] of [['position',xyz,3],['velocity',vel,3],['diameter',size,1],['variation',random,1]])geo.setAttribute(key,new THREE.Float32BufferAttribute(array,n));
      const mat=fx.own(pointsMaterial());mat.uniforms.gravity.value=9;mat.uniforms.tint.value.set(0xfff6dc);mat.uniforms.lifetime.value=flight*1.6;
      const o=new THREE.Points(geo,mat);o.position.copy(start);o.frustumCulled=false;fx.group.add(o);
      fx.step=t=>{mat.uniforms.age.value=t;};
    });
    track(flight+linger,fx=>{
      const patch=surface(fx,fx.group,v3(end.x,.055,end.z),radius*2,riceMap,0xfff8e8,false);
      const rim=mesh(fx.group,disk,basic(fx,0xfff1c8),end.x,.06,end.z,radius,radius,1);rim.rotation.x=-PI/2;
      patch.rotation.z=between(0,TAU);
      fx.step=t=>{
        const land=smooth(flight-.05,flight+.12,t),fade=1-smooth(flight+linger-.6,flight+linger,t);
        patch.material.opacity=.82*land*fade;patch.scale.setScalar(radius*2*(.7+.3*land));
        rim.material.opacity=(.5*(1-smooth(flight,flight+.5,t))+.16)*land*fade;
      };
    });
    track(flight+.5,fx=>{fx.step=t=>{if(t>=flight&&!fx.hit){fx.hit=true;blast(end,0xfff3d4,radius,.45);sparks(end,26,0xfff6e0,3.2,.5,8);feedback('rice',1);}};});
  }
  function hit(target,color=0xffc777) { sparks(target.clone().add(v3(0,1,0)),14,color,2.7,.4,8); }
  function dodge(target) {
    const p=clampFloor(target);blast(p,0x8bb6c4,1.12,.28);
    sparks(p,18,0xaeceb8,2,.38,1.4);
  }
  function mark(target) {
    const p=target.clone();p.y+=1.65;
    track(.70,fx=>{
      const talisman=glyph(fx,fx.group,6,.75,.33);
      fx.step=t=>{
        const u=t/.7;talisman.position.copy(p); talisman.position.y+=u*.78;
        const k=.66+.34*Math.sin(Math.min(1,u/.3)*PI/2);talisman.scale.set(.4*k,.83*k,1);
        talisman.material.rotation=.22*Math.sin(u*7);
        talisman.material.opacity=1-smooth(.55,1,u);
      };
    });
  }
  // A ground arc between two talismans; the four outer strikes weave a square
  // lightning net, then each corner feeds the eye before the central bolt.
  function groundArc(fx,a,b,color){
    const line=lightningPath(a.clone().setY(.1),b.clone().setY(.1),.32,9);for(const p of line)p.y=between(.08,.13);
    const [outer,inner]=conductors([{points:line,width:1}],[.06,.022]);
    return {outer:mesh(fx.group,fx.own(outer),basic(fx,color),0,0,0),inner:mesh(fx.group,fx.own(inner),basic(fx,0xfff8e4),0,0,0)};
  }
  function thunder(target,onStrike=()=>{}) {
    const center=clampFloor(target);
    // Square the four quarter talismans to the camera, so no stroke lands
    // squarely between the lens and the master.
    let ax=0,az=1;
    if(camera){ax=camera.position.x-center.x;az=camera.position.z-center.z;const l=Math.hypot(ax,az)||1;ax/=l;az/=l;}
    const corner=(u,v)=>center.clone().add(v3((u*az+v*ax)*2.6,0,(-u*ax+v*az)*2.6));
    const ends=[corner(-.72,-.72),corner(.72,-.72),corner(.72,.72),corner(-.72,.72),center.clone()].map(clampFloor);
    const away=v3(-ax,0,-az);
    feedback('seal',.65);
    track(3.45,fx=>{
      const deck=surface(fx,fx.group,v3(center.x,.05,center.z),7.6,seals.thunder);
      const tabs=TALISMAN_NAMES.map((n,i)=>glyph(fx,fx.group,i,1.34));
      const burns=[],arcs=[];
      let next=0;
      fx.step=t=>{
        const build=smooth(0,.36,t),fade=1-smooth(2.6,3.4,t);
        deck.material.opacity=build*fade*(.34+.08*Math.sin(t*12));
        const scale=7.6*(.76+.24*build+.1*smooth(2.24,2.46,t));
        deck.scale.set(scale,scale,1);deck.rotation.z=t*.40;
        for(let i=0;i<5;i++){
          const a=i*TAU/5+Math.min(t,THUNDER_BEATS[i])*.85;
          const u=smooth(THUNDER_BEATS[i]-.24,THUNDER_BEATS[i],t);
          const r=2.77+.17*Math.sin(t*3+i);
          tabs[i].position.set(
            THREE.MathUtils.lerp(center.x+Math.sin(a)*r,ends[i].x,u),
            THREE.MathUtils.lerp(1.25+i*.15+.32*Math.sin(t*4+i),.62,u),
            THREE.MathUtils.lerp(center.z+Math.cos(a)*r,ends[i].z,u));
          tabs[i].material.opacity=build*(1-.35*u);
          tabs[i].material.rotation=Math.sin(a)*.24*(1-u);
          tabs[i].visible=t<THUNDER_BEATS[i]+.04;
        }
        for(const b of burns){
          const k=smooth(0,.16,t-b.born);
          b.mark.material.opacity=.92*k*fade;b.mark.scale.setScalar(b.size*(1.5-.5*k));
        }
        for(const arc of arcs){
          const k=smooth(0,.1,t-arc.born)*fade,flicker=.62+.38*Math.sin(t*47+arc.seed)**2;
          arc.outer.material.opacity=.7*k*flicker;arc.inner.material.opacity=k*flicker;
        }
        while(next<5 && t>=THUNDER_BEATS[next] && !fx.dead) {
          const i=next++,p=ends[i],final=i===4,force=final?1.65:1, color=THUNDER_COLORS[i];
          const base=p.clone().add(v3(0,.12,0));
          // Lean every channel away from the lens: the stroke stays a crisp
          // silhouette above the target instead of a wall across the screen.
          const top=p.clone().addScaledVector(away,final?1.2:3.4).add(v3(between(-1.2,1.2),final?27:20,between(-1.2,1.2)));
          flash(top,base,color,force,true);
          if(final) {
            for(let j=0;j<4;j++)arcs.push({...groundArc(fx,ends[j],p,THUNDER_COLORS[j]),born:t,seed:j*1.7});
            scorch(p,3.4);
          }else{
            burns.push({mark:surface(fx,fx.group,v3(p.x,.06,p.z),1,quarterSeals[i],0xffffff),born:t,size:1.55});
            if(i>0)arcs.push({...groundArc(fx,ends[i-1],p,color),born:t,seed:i*2.3});
            if(i===3)arcs.push({...groundArc(fx,p,ends[0],color),born:t,seed:9.1});
          }
          blast(p,color,final?5.0:2.2,final?.7:.4);
          groundLightning(p,final,color);
          sparks(p,final?70:28,color,final?7:4.6,final?1:.6,9);
          feedback('thunder',final?1:.5);
          onStrike(p.clone(),i);
        }
      };
    });
  }
  function buildGate(fx,frame) {
    const bronze=basic(fx,0xbd864e,false), wood=basic(fx,0x5d2523,false);
    const lacquer=basic(fx,0xa3452f,false), gold=basic(fx,0xfbc783,false);
    const dark=basic(fx,0x382129,false), trim=basic(fx,0xff9a43);
    const panel=basic(fx,0xffefcf,false,door), sign=basic(fx,0xffffff,false,plaqueMap);
    const curtain=fx.own(gateCurtain());
    const portal=mesh(frame,ground,curtain,0,3.68,-.37,5.58,7.19,1);
    const flameMaterials=[bronze,wood,lacquer,gold,dark,trim,panel,sign];
    for(const side of [-1,1]) {
      const x=side*2.99;
      mesh(frame,box,wood,x,3.62,0,.52,7.18,.53);
      mesh(frame,box,lacquer,x,3.52,.24,.33,6.65,.12);
      mesh(frame,box,trim,x+side*.17,3.54,.32,.034,6.67,.03);
      mesh(frame,box,dark,x,.22,0,.9,.42,.92);
      mesh(frame,box,bronze,x,.48,0,.7,.16,.7);
      mesh(frame,box,bronze,x,6.91,0,.78,.28,.8);
      for(const y of [.94,5.97])mesh(frame,box,gold,x,y,.03,.55,.14,.58);
      const topBracket=mesh(frame,box,bronze,side*3.19,7.23,0,.86,.23,.49);
      topBracket.rotation.z=side*.26;
    }
    mesh(frame,box,wood,0,7.23,0,7.03,.50,.68);
    mesh(frame,box,dark,0,7.60,-.03,6.88,.19,.89);
    mesh(frame,box,gold,0,7.50,.37,6.8,.074,.10);
    for(const side of [-1,1]){
      const corner=mesh(frame,box,bronze,side*3.58,7.65,.01,.75,.14,.73);
      corner.rotation.z=side*.29;
    }
    mesh(frame,ground,sign,0,7.39,.43,2.62,.67,1);
    mesh(frame,box,bronze,0,.12,0,6.5,.22,.83);
    const pivots=[];
    for(const side of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(side*2.73,.26,.06);frame.add(pivot);
      const x=-side*1.35;
      mesh(pivot,box,wood,x,3.40,0,2.69,6.82,.19);
      mesh(pivot,ground,panel,x,3.40,.108,2.68,6.78,1);
      const hx=-side*2.20;
      const bosses=mesh(pivot,sphere,bronze,hx,3.48,.19,.22,.24,.11);
      bosses.rotation.z=side*.25;
      mesh(pivot,ringHandle,gold,hx,3.27,.29);
      mesh(pivot,box,trim,-side*2.65,3.44,.18,.028,6.65,.035);
      pivots.push({pivot,side});
    }
    return {portal,pivots,flameMaterials,curtain};
  }

  function spirallingPaper(fx,stage,distance) {
    const count=34, seeds=Array.from({length:count},()=>({phase:between(0,TAU),ring:between(2.4,4.6),speed:between(.64,1.18),size:between(.30,.66),level:Math.random()}));
    const mat=basic(fx,0xffe4a4,false,papers[5]);
    const swarm=fx.own(new THREE.InstancedMesh(ground,mat,count));
    swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);swarm.frustumCulled=false;
    stage.add(swarm);
    const transform=new THREE.Object3D();
    const arcGeo=fx.own(arcSheet(3.5,3.36));
    const currents=[];
    for(let i=0;i<3;i++){
      const group=new THREE.Group();stage.add(group);
      const ink=mesh(group,arcGeo,basic(fx,0x332132,false,brushStroke),0,0,0,1,.66,1);
      const metallic=mesh(group,arcGeo,basic(fx,0xffae51,true,brushStroke),0,.10,0,.98,.38,.98);
      currents.push({group,ink,metallic});
    }
    return t=>{
      const opacity=smooth(.54,1.24,t)*(1-smooth(3.7,4.53,t));
      const sweep=smooth(2.43,2.95,t), lift=1-smooth(2.95,4.0,t);
      swarm.visible=opacity>.003;
      if(swarm.visible){
        mat.opacity=opacity*.97;
        for(let i=0;i<count;i++){
          const s=seeds[i], angle=s.phase+t*s.speed*1.78+sweep*2.45, a=s.level;
          const r=(s.ring+.35*Math.sin(t*3+s.phase))*(.68+.32*smooth(.52,1.38,t)+.38*sweep);
          const height=.18+a*(3.8+.52*Math.sin(angle))+.62*sweep*lift;
          transform.position.set(Math.cos(angle)*r,height,.45+Math.sin(angle)*r*.79+distance*.27*sweep);
          transform.rotation.set(.46*Math.cos(angle*1.7)+.52,angle+PI/2+.40*Math.sin(t*6+s.phase),.50*Math.sin(angle+t));
          transform.scale.set(s.size*.49,s.size,1);transform.updateMatrix();swarm.setMatrixAt(i,transform.matrix);
        }
        swarm.instanceMatrix.needsUpdate=true;
      }
      currents.forEach(({group,ink,metallic},i)=>{
        const a=i*2.08+t*1.96+sweep*2;
        group.visible=opacity>.003;
        group.position.set(0,.46+i*.55+Math.sin(a)*.24,.65+distance*.23*sweep);
        group.rotation.set(Math.sin(a)*.16,a,Math.cos(a)*.18);
        const r=.71+i*.11+.23*sweep;
        group.scale.set(r,1,r);
        ink.material.opacity=opacity*.72;
        metallic.material.opacity=opacity*(.59+.22*Math.sin(a)**2);
      });
    };
  }

  function slashTrail(pos,yaw) {
    const ttl=.92;
    // A red lacquer sweep and its white-hot leading edge cross in front of the
    // judge, at blade height. The marks on the ground follow the same heading.
    track(ttl,fx=>{
      fx.group.position.copy(pos);fx.group.rotation.y=yaw;
      // Tilt the sweep into a falling diagonal cleave, from the judge's raised
      // right shoulder down across the target, in ink, cinnabar and gold.
      const cleave=new THREE.Group();cleave.position.set(0,1.5,0);cleave.rotation.z=-.62;fx.group.add(cleave);
      const blades=[];
      const geo=fx.own(arcSheet(4.6,3.0));
      for(const [tint,scale,lift,add] of [[0x2a141c,1.1,-.2,false],[0xd63a22,1.04,-.08,true],[0xffc163,.98,.04,true]]) {
        const blade=mesh(cleave,geo,basic(fx,tint,add,brushStroke),0,lift,-1.7,scale,scale,scale);
        blades.push(blade);
      }
      const centerFlare=glow(fx,fx.group,v3(0,1.05,0),0xff7a3a);
      fx.step=t=>{
        const u=t/ttl,reveal=1-(1-u)**4;
        for(let i=0;i<blades.length;i++){
          const blade=blades[i];
          blade.rotation.y=-1.25+2.1*reveal+(2-i)*.07;
          blade.scale.y=.8-i*.12;
          blade.material.opacity=(i===0?.9:i===1?.95:.88)*(1-u)**1.2;
        }
        centerFlare.scale.set(4.6+u*2,1.6+u*.6,1);centerFlare.material.opacity=(1-u)**2.2*.42;
      };
    });
    const base=pos.clone().add(v3(0,.13,0));
    for(let i=0;i<3;i++) {
      const a=yaw-.43+i*.43;
      const tip=base.clone().add(v3(Math.sin(a)*between(3.9,6.2),.012,Math.cos(a)*between(3.9,6.2)));
      flash(base,tip,i===1?0xffd08a:0xf0602e,.72);
    }
    track(2.6,fx=>{
      const stamp=surface(fx,fx.group,v3(pos.x,.07,pos.z),3.4,slashSeal,0xffffff,false);stamp.rotation.z=-yaw;
      fx.step=t=>{const k=smooth(0,.12,t);stamp.scale.setScalar(3.4*(1.45-.45*k));stamp.material.opacity=.95*k*(1-smooth(1.7,2.6,t));};
    });
    scorch(pos,3.25);blast(pos,0xff8a3c,5.2,.66);
    sparks(pos,60,0xffa94b,7,1.1,7);
  }

  // 生死簿：竖排人名，朱笔勾名时整页被一道朱砂划过。
  const ledgerMap=paint(768,300,(g,w,h)=>{
    const paper=g.createLinearGradient(0,0,0,h);paper.addColorStop(0,'#efe2bf');paper.addColorStop(1,'#d8c391');
    g.fillStyle=paper;g.fillRect(0,0,w,h);
    g.fillStyle='#4a2416';g.fillRect(0,0,26,h);g.fillRect(w-26,0,26,h);
    g.strokeStyle='#7a2a1a';g.lineWidth=3;g.strokeRect(40,16,w-80,h-32);
    brush(g,'生',w-76,70,54,'#2a1410');brush(g,'死',w-76,140,54,'#2a1410');brush(g,'簿',w-76,210,54,'#2a1410');
    const names=['黑無常','白無常','謝必安','范無救','槐陰鎮','張阿四','李秀才','王寡婦','趙老漢','義莊守夜人'];
    names.forEach((n,i)=>{const x=w-140-i*58;g.strokeStyle='rgba(90,50,30,.35)';g.lineWidth=1;g.beginPath();g.moveTo(x+29,26);g.lineTo(x+29,h-26);g.stroke();
      Array.from(n).forEach((c,j)=>brush(g,c,x,52+j*44,34,i<2?'#1a0c08':'#3b2a20'));});
  });
  const devourMap=sealMap('啖','#ff4a2a');
  function beam(from,to,color=0xff3b24){flash(from.clone(),to.clone().setY(1.3),color,1.25);sparks(to.clone().setY(1.2),18,color,3,.45,6);}
  function summon(target,onSlash=()=>{},variant='slash') {
    const aim=clampFloor(target);
    const origin=v3(clamp(aim.x,-12.9,12.9),0,Math.max(-16.3,aim.z-4.9));
    const yaw=Math.atan2(aim.x-origin.x,aim.z-origin.z);
    const distance=Math.max(2.4,origin.distanceTo(aim));
    feedback('gong',.56);
    track(4.75,fx=>{
      const {group}=fx;
      const field=surface(fx,group,v3(aim.x,.073,aim.z),9.15,seals.summon,0xffbd83);
      const stage=new THREE.Group();stage.position.copy(origin);stage.rotation.y=yaw;group.add(stage);
      const gateGroup=new THREE.Group();stage.add(gateGroup);
      const gate=buildGate(fx,gateGroup);
      const wind=spirallingPaper(fx,stage,distance);
      const actor=actorPool.pop()||(actors.judge||makeZhongkui)();
      actor.resetMotion?.();
      const judge=actor.root;
      judge.visible=false;judge.position.set(0,0,-1);judge.rotation.set(0,0,0);judge.scale.setScalar(1);stage.add(judge);
      fx.onEnd=()=>{judge.removeFromParent();judge.visible=true;judge.scale.setScalar(1);actorPool.push(actor);};

      const decree=[0,1,2].map((_,i)=>glyph(fx,group,5,1.20));
      const backdropSeal=mesh(stage,ground,basic(fx,0xffa849,true,seals.summon),0,3.55,.16,5.78,5.78,1);
      let ledger=null,stroke=null,vortex=null;
      if(variant==='brush'){
        // 生死簿悬在朱门一侧、与钟馗头部齐高，正对镜头展开。
        const book=new THREE.Group();book.position.set(-5.4,5.2,1.4);book.rotation.y=.42;stage.add(book);
        ledger=mesh(book,ground,basic(fx,0xffffff,false,ledgerMap),0,0,0,4.4,1.72,1);ledger.renderOrder=3;
        stroke=mesh(book,ground,basic(fx,0xff2a1a,false,brushStroke),0,.1,.05,4.2,.46,1);stroke.rotation.z=.12;stroke.renderOrder=4;
      }
      if(variant==='devour'){vortex=surface(fx,group,v3(aim.x,.09,aim.z),6.2,devourMap,0xff5a3a);}
      const floorSeal=surface(fx,stage,v3(0,.065,0),8.35,seals.summon,0xff9760);
      let opened=false,stepped=false,slashed=false,returned=false;
      const gait={dt:0,forward:0,side:0,turn:0};
      fx.step=(t,dt)=>{
        wind(t);
        const rise=smooth(.10,.83,t),fade=1-smooth(4.05,4.75,t);
        gateGroup.visible=rise>.002&&fade>.002;
        gateGroup.scale.set(.82+.18*rise,.085+.915*rise,.85+.15*rise);
        gateGroup.position.y=-.15*(1-rise);
        for(const m of gate.flameMaterials) m.opacity=fade*rise;
        const opening=smooth(.84,1.64,t)*(1-smooth(3.94,4.49,t));
        for(const {pivot,side} of gate.pivots) pivot.rotation.y=side*opening*1.43;
        gate.curtain.uniforms.time.value=t;
        gate.curtain.uniforms.alpha.value=rise*fade;
        backdropSeal.material.opacity=smooth(.28,.80,t)*(1-smooth(.86,1.15,t))*.92;
        backdropSeal.rotation.z=-t*.46;
        floorSeal.material.opacity=rise*fade*(.68+.09*Math.sin(t*7));
        floorSeal.rotation.z=t*.31;
        field.material.opacity=smooth(0,.46,t)*fade*(.42+.1*Math.sin(6*t));
        field.rotation.z=-t*.26;
        const width=9.15*(.71+.29*smooth(0,.62,t)+.15*smooth(2.68,2.98,t));
        field.scale.set(width,width,1);
        for(let i=0;i<3;i++){
          const stamp=decree[i],a=TAU*i/3+t*.51;
          const lift=1-smooth(.91,1.32,t);
          stamp.position.set(aim.x+Math.sin(a)*3.2,lift*(1.4+.4*Math.sin(t*3+i))+.24,aim.z+Math.cos(a)*3.2);
          stamp.material.opacity=smooth(0,.22,t)*lift;
          stamp.material.rotation=.17*Math.sin(a);
        }
        const wasVisible=judge.visible,fromZ=judge.position.z;
        judge.visible=t>=1.10&&t<4.26;
        if(judge.visible){
          const emerge=smooth(1.10,1.65,t),walk=smooth(1.12,2.35,t);
          const retract=smooth(3.64,4.25,t);
          judge.scale.setScalar((.86+.14*emerge)*(1-.23*retract));
          judge.position.z=-1.50+(distance-.25)*walk-(distance-.55)*retract;
          judge.position.y=-1.14*(1-emerge)-1.25*retract;
          gait.dt=dt;gait.forward=wasVisible&&dt>0?(judge.position.z-fromZ)/dt:0;
          if(t<1.52)actor.animate('summon',t,emerge,gait);
          else if(t<2.26)actor.animate('walk',t,1,gait);
          else if(t<3.17)actor.animate('slash',t,clamp((t-2.26)/.83,0,1),gait);
          else actor.animate(retract?'walk':'idle',t,1,gait);
        }
        if(!opened&&t>=GATE_OPEN){
          opened=true;feedback('gong',.9);
          sparks(origin.clone().add(v3(0,.4,0)),67,0xffb867,5.4,1.25,3.1,.8);
        }
        if(!stepped&&t>=GATE_STEP){
          stepped=true;const step=origin.clone().lerp(aim,.33);
          blast(step,0xe09a57,3,.49);sparks(step,35,0xc09768,3.8,.8,6);
          feedback('rumble',.44);
        }
        if(!slashed&&t>=GATE_SLASH){
          slashed=true;
          const extra={origin:origin.clone(),scroll:ledger?ledger.getWorldPosition(v3()):null};
          if(variant==='slash'){slashTrail(aim,yaw);feedback('slash',1);}
          else if(variant==='devour'){blast(aim,0xff3a22,4.2,.6);sparks(aim.clone().setY(1.4),70,0x9b1410,5.5,1,3);feedback('devour',1);}
          else if(variant==='brush'){feedback('slash',.7);}
          else {blast(origin,0xffb35c,3.4,.5);sparks(origin.clone().setY(1.2),60,0xffd27a,5,.9,5);feedback('gong',.8);}
          onSlash(aim.clone(),extra);
        }
        if(ledger){
          const open=smooth(1.6,2.25,t),gone=1-smooth(3.6,4.3,t);
          ledger.scale.x=4.4*Math.max(.02,open);ledger.material.opacity=open>0?gone:0;
          const ink=smooth(GATE_SLASH-.26,GATE_SLASH,t);stroke.scale.x=4.2*Math.max(.001,ink);stroke.position.x=-2.1+2.1*ink;stroke.material.opacity=ink*gone;
        }
        if(vortex){const k=smooth(1.2,2.4,t)*(1-smooth(3.5,4.4,t));vortex.material.opacity=.8*k;vortex.rotation.z=-t*2.2;vortex.scale.setScalar(6.2*(1-.4*smooth(GATE_SLASH,GATE_SLASH+.5,t)));}
        if(!returned&&t>=3.92&&!fx.dead){returned=true;feedback('chime',.36);}
      };
    });
  }

  function update(dt) {
    if(!Number.isFinite(dt)||dt<=0)return;
    // Snapshot because a combat callback can finish the round and clear its
    // effects, or emit a fresh hit during the same simulation step.
    for(const fx of [...active]) fx.advance(dt);
  }
  function clear() { for(const fx of [...active]) fx.dispose(); }
  const kit={track,basic,mesh,surface,glow,blast,sparks,scorch,feedback,sealMap,ground,brushStroke,arcSheet,paint,flash,glyph};
  const ritual=makeRitualEffects({...kit,glyph},actors.priest);
  const classEffects=new Map();
  const warmed=new WeakSet();
  function forClass(id){
    if(id==='thunder')return null;
    if(!classEffects.has(id)){
      classEffects.set(id,id==='sword'?makeSwordEffects(kit):makeWardEffects(kit));
    }
    return classEffects.get(id);
  }
  // Prepare the same materials the first real spell uses, before starting
  // the fight clock. Retain one material per shader layout across replays.
  function prime(id,renderer,pose) {
    preparing=true;
    try {
      const at=v3(),special=pose==='invoke'?null:forClass(id);
      if(!pose || pose==='invoke')summon(at);
      if(!pose&&actors.priest)ritual.invoke(at,()=>{});
      if(!pose && special)special.thunder(at);
      if(!pose || pose==='ultimate'){
        if(special){special.prepare(renderer);special.summon(at);}
        else thunder(at);
      }
      function prepareMaterial(node){
        const m=node.material;if(!m||node.isSkinnedMesh)return;
        if(m.map)renderer.initTexture(m.map);
        const key=[node.type,node.isInstancedMesh,m.type,m.vertexShader,m.map?.isTexture,
          m.vertexColors,node.geometry?.attributes.color?.itemSize,m.side,m.forceSinglePass,
          m.toneMapped,m.customProgramCacheKey()].join('|');
        if(!retained.has(key)){retained.set(key,m);warmed.add(m);}
      }
      // Include the summoned judge, flying blades and the impact-only stone
      // fragments. Each first appearance gets its own warm-up sample.
      for(const seconds of [1.72,1.42]){
        update(seconds);
        for(const entry of active)entry.group.traverse(prepareMaterial);
      }
    } finally {preparing=false;}
  }
  const rites=makeRites(kit,actors.priest);
  return {thunder,summon,castTrails:ritual.castTrails,priest:ritual.invoke,rites,beam,bolt,mark,rice,dodge,hit,update,clear,forClass,prime};
}
