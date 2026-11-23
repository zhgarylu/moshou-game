import * as THREE from './vendor/three.module.js';
import {actionTiming} from './action-timing.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

const PI = Math.PI;
const TAU = 2 * PI;
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (lo, hi, t) => THREE.MathUtils.smoothstep(t, lo, hi);
const ORIENTS = [
  ['青龍',0x8cf2c0], ['朱雀',0xff9165], ['白虎',0xffe6ab], ['玄武',0x94d7f5]
];

// Bake small, individually carved details into one draw call per sculpture.
function carving() {
  const pieces = [], matrix = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const ball = new THREE.SphereGeometry(1,20,14);
  const block = new THREE.BoxGeometry(1,1,1);
  const square = new THREE.CylinderGeometry(1,1,1,4,1,false,PI/4);
  function shape(geo, color, pos, size, angles = [0,0,0]) {
    const copy = geo.index ? geo.toNonIndexed() : geo.clone();
    rotation.setFromEuler(new THREE.Euler(...angles));
    matrix.compose(vec(...pos), rotation, vec(...size));
    copy.applyMatrix4(matrix);
    const points = copy.getAttribute('position');
    const rgb = new Float32Array(points.count*3);
    const base = new THREE.Color(color);
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
      const patina = .94+.045*Math.sin(x*31+y*20+z*17)*Math.cos(y*47-z*13);
      rgb.set([base.r*patina,base.g*patina,base.b*patina],i*3);
    }
    copy.setAttribute('color',new THREE.BufferAttribute(rgb,3)); pieces.push(copy);
  }
  function cord(path, radius, color) {
    const curve = new THREE.CatmullRomCurve3(path.map(p=>vec(...p)));
    const tube = new THREE.TubeGeometry(curve, Math.max(12,path.length*4), radius, 7, false);
    shape(tube,color,[0,0,0],[1,1,1]); tube.dispose();
  }
  function finish() {
    const geo = mergeGeometries(pieces);
    for (const p of [...pieces,ball,block,square]) p.dispose();
    return geo;
  }
  return {shape,cord,finish,ball,block,square};
}

const JADE = 0x688674, LIGHT_JADE = 0xa6b597, DARK_JADE = 0x3d6156;
const BRONZE = 0xb99050, GOLD = 0xefc77b;

let relicTemplate, relicRequest, relicAtlas;

export function preloadWardRelic() {
  if (relicTemplate) return Promise.resolve(relicTemplate);
  if (relicRequest) return relicRequest;
  const url = new URL('./art/ward-lion-seal.glb', import.meta.url);
  relicRequest = new GLTFLoader().loadAsync(url.href).then(({scene})=>{
    const extent = new THREE.Vector3(...scene.userData.captureExtent);
    scene.traverse(node=>{
      if (!node.isMesh) return;
      const material = node.material;
      relicAtlas = material.map;
      material.map.anisotropy = 8;
      material.onBeforeCompile = shader=>{
        shader.uniforms.relicExtent={value:extent};
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`
          #include <common>
          uniform vec3 relicExtent;
          varying vec3 vRelicPoint;
          varying vec2 vRelicRay;
        `).replace('#include <begin_vertex>',`
          #include <begin_vertex>
          vRelicPoint = position/relicExtent;
          vec3 ray = cameraPosition - modelMatrix[3].xyz - modelMatrix[1].xyz*relicExtent.y*.52;
          vRelicRay = normalize(vec2(dot(ray,normalize(modelMatrix[0].xyz)),dot(ray,normalize(modelMatrix[2].xyz)))+vec2(.00001));
        `);
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
          #include <common>
          varying vec3 vRelicPoint;
          varying vec2 vRelicRay;
        `).replace('#include <map_fragment>',`
          float pageX = .5 + (vRelicRay.y>0. ? vRelicPoint.x : -vRelicPoint.x);
          vec2 faceTile = vec2(0.,vRelicRay.y>=0. ? 0. : .5);
          float flankX = .5 + (vRelicRay.x>0. ? -vRelicPoint.z : vRelicPoint.z);
          vec2 flankTile = vec2(.5,vRelicRay.x>=0. ? 0. : .5);
          float v=clamp(1.-vRelicPoint.y,.001,.999);
          vec3 face=texture2D(map,faceTile+.5*vec2(clamp(pageX,.001,.999),v)).rgb;
          vec3 flank=texture2D(map,flankTile+.5*vec2(clamp(flankX,.001,.999),v)).rgb;
          float sideRatio = smoothstep(-.20,.20,abs(vRelicRay.x)-abs(vRelicRay.y));
          vec3 recorded = mix(face,flank,sideRatio);
          float seam = 1.-smoothstep(.025,.34,abs(abs(vRelicRay.x)-abs(vRelicRay.y)));
          vec3 carvingColor = mix(recorded,texture2D(map,vMapUv).rgb,seam*.58);
          diffuseColor.rgb *= carvingColor;
        `).replace('#include <opaque_fragment>',`
          float rim=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),4.);
          outgoingLight = outgoingLight*.67 + carvingColor*.67 + rim*vec3(.17,.072,.023);
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey=()=> 'ward-carved-stone';
      material.needsUpdate=true;
    });
    relicTemplate=scene;
    return scene;
  }).catch(error=>{ relicRequest=null; throw error; });
  return relicRequest;
}

function buildPillar() {
  const {shape,cord,finish,block,ball,square} = carving();
  const body=(p,s,c)=>shape(block,c,p,s);
  body([0,.13,0],[1.13,.26,.93],DARK_JADE);
  body([0,.32,0],[.97,.12,.82],BRONZE);
  body([0,1.42,0],[.79,2.09,.65],JADE);
  for(const side of [-1,1]) {
    for(const edge of [-1,1])body([edge*.344,1.48,side*.328],[.052,1.91,.049],BRONZE);
  }
  body([0,2.47,0],[.95,.15,.80],GOLD);
  body([0,2.65,0],[1.05,.20,.87],DARK_JADE);
  shape(square,BRONZE,[0,2.85,0],[.71,.23,.59]);
  shape(ball,LIGHT_JADE,[0,3.03,0],[.19,.21,.19]);
  for(const s of [-1,1])cord([[s*.36,2.68,0],[s*.51,2.74,0],[s*.61,2.85,0]],.058,GOLD);
  return finish();
}

function glyph(ctx,text,x,y,size,color) {
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 '+size+'px "Kaiti SC",KaiTi,"Songti SC",serif';
  ctx.fillStyle=color; ctx.fillText(text,x,y);
}

function altarMap(paint,text,impression=false) {
  return paint(640,640,(g,w)=>{
    g.translate(w/2,w/2);
    if(impression){
      g.fillStyle='rgba(150,36,23,.72)';g.fillRect(-287,-287,574,574);
      // Tiny breaks leave the flagstone visible through a freshly stamped coat of cinnabar.
      let seed=17;
      function jitter(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
      for(let i=0;i<1650;i++)g.clearRect(jitter()*572-286,jitter()*572-286,1+jitter()*7,1+jitter()*3);
    }
    g.strokeStyle=impression?'#ff7142':'#ffdb86'; g.lineJoin='miter';
    for(const [size,width] of [[286,5],[271,2],[207,5],[196,2],[138,5]]){
      g.lineWidth=width;g.strokeRect(-size,-size,size*2,size*2);
    }
    for(let i=0;i<4;i++){
      g.save();g.rotate(i*PI/2);
      for(let j=-2;j<=2;j++){
        const x=j*74;
        g.beginPath();g.moveTo(x-30,-218);g.lineTo(x-30,-254);g.lineTo(x+24,-254);g.lineTo(x+24,-231);g.lineTo(x-6,-231);g.lineTo(x-6,-242);
        g.lineWidth=4;g.stroke();
      }
      g.beginPath();g.moveTo(-264,-176);g.lineTo(-264,-263);g.lineTo(-178,-263);
      g.moveTo(-251,-180);g.lineTo(-251,-248);g.lineTo(-184,-248);g.stroke();g.restore();
    }
    for(const [i,c] of [...text].entries()){
      glyph(g,c,(i%2-.5)*108,(Math.floor(i/2)-.5)*106+3,102,impression?'#ffd29c':'#ffe8aa');
    }
  });
}

function plaqueMap(paint,text) {
  return paint(144,320,(g,w,h)=>{
    g.fillStyle='#283e37';g.fillRect(0,0,w,h);
    g.strokeStyle='#c4a66e';g.lineWidth=4;g.strokeRect(5,5,w-10,h-10);
    g.lineWidth=2;g.strokeRect(12,12,w-24,h-24);
    glyph(g,text[0],w/2,96,83,'#fff3c4');glyph(g,text[1],w/2,223,83,'#ffc67e');
  });
}

function mandorlaMap(paint) {
  return paint(640,640,(g,w)=>{
    g.translate(w/2,w/2);g.strokeStyle='#ffc879';
    for(const [r,width] of [[278,3],[267,1.5],[229,3],[221,1.5],[179,2]]){
      g.beginPath();g.arc(0,0,r,0,TAU);g.lineWidth=width;g.stroke();
    }
    for(let i=0;i<8;i++){
      g.save();g.rotate(TAU*i/8);
      for(let row=0;row<3;row++){
        g.fillStyle='#ffdda3';const y=-263+row*9;
        if(i&(1<<row)){g.fillRect(-20,y,40,4);}
        else{g.fillRect(-20,y,15,4);g.fillRect(5,y,15,4);}
      }
      g.beginPath();g.moveTo(0,-220);g.lineTo(-11,-204);g.lineTo(0,-189);g.lineTo(11,-204);g.closePath();g.stroke();
      g.rotate(PI/8);g.beginPath();g.moveTo(0,-276);g.lineTo(0,-301);g.lineTo(5,-291);g.stroke();
      g.restore();
    }
  });
}

function barrierMap(paint) {
  return paint(512,160,(g,w,h)=>{
    const mist=g.createLinearGradient(0,0,0,h);
    mist.addColorStop(0,'rgba(255,229,160,.72)');mist.addColorStop(.20,'rgba(234,183,120,.13)');
    mist.addColorStop(.65,'rgba(231,187,123,.07)');mist.addColorStop(1,'rgba(255,210,150,.36)');
    g.fillStyle=mist;g.fillRect(0,0,w,h);
    g.strokeStyle='#ffe2a2';g.lineWidth=2;
    for(let x=0;x<w;x+=32){
      g.beginPath();g.moveTo(x,5);g.lineTo(x+13,19);g.lineTo(x+26,5);g.stroke();
      g.beginPath();g.moveTo(x,h-6);g.lineTo(x+16,h-28);g.lineTo(x+32,h-6);g.stroke();
    }
    for(let s=0;s<9;s++){
      const x=(s+.5)*w/9,y=36+(s%3)*10;
      g.strokeRect(x-6,y,12,18);g.beginPath();g.moveTo(x-2,y+4);g.lineTo(x+3,y+8);g.lineTo(x-3,y+13);g.stroke();
      g.fillRect(x-1,y+22,2,25+(s%4)*6);
    }
  });
}

function fissureMap(paint) {
  return paint(640,640,g=>{
    g.translate(320,320);g.lineCap='round';g.lineJoin='round';
    for(let i=0;i<23;i++) {
      const a=i*TAU/23, path=[[0,0]];
      for(let k=1;k<=8;k++){
        const length=k*(23+6*Math.sin(i*5.7))+(i%4)*k;
        const w=a+Math.sin(k*2.7+i*4)*.115;
        path.push([Math.sin(w)*length,Math.cos(w)*length]);
      }
      for(const [color,width] of [['#942e17',6.8],['#ffa64a',3.2],['#fff0ad',1.25]]){
        g.beginPath();g.moveTo(0,0);for(const [x,y] of path.slice(1))g.lineTo(x,y);
        g.strokeStyle=color;g.lineWidth=width;g.stroke();
        for (const k of [4,6]) {
          const [x,y]=path[k], side=a+(i%2?1:-1)*.65;
          g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.sin(side)*24,y+Math.cos(side)*24);
          g.lineTo(x+Math.sin(side+.28)*44,y+Math.cos(side+.28)*44);g.lineWidth=width*.64;g.stroke();
        }
      }
    }
  });
}

export function makeWardEffects(kit) {
  const {track,basic,mesh,surface,glow,blast,sparks,feedback,ground,paint}=kit;
  let assets;
  function resources() {
    if(assets)return assets;
    const stone = new THREE.MeshStandardMaterial({
      vertexColors:true, metalness:.20, roughness:.72, emissive:0x37402e, emissiveIntensity:.20
    });
    const atlas={value:relicAtlas}, hasAtlas={value:!!relicAtlas};
    if(!relicAtlas)preloadWardRelic().then(()=>{atlas.value=relicAtlas;hasAtlas.value=true;}).catch(()=>{});
    // Sample matching stone grain and cast-bronze relief directly from the seal's atlas.
    stone.onBeforeCompile = shader=>{
      shader.uniforms.wardAtlas=atlas;shader.uniforms.hasWardAtlas=hasAtlas;
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nvarying vec3 wardPoint; varying vec3 wardNormal;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nwardPoint=position;wardNormal=normal;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
        '#include <common>\nuniform sampler2D wardAtlas; uniform bool hasWardAtlas; varying vec3 wardPoint; varying vec3 wardNormal;')
        .replace('#include <color_fragment>',`
          #include <color_fragment>
          if(hasWardAtlas){
            float u=abs(wardNormal.x)>abs(wardNormal.z)?wardPoint.z:wardPoint.x;
            float y=wardPoint.y;
            vec2 mineralUv=vec2(.185,.032)+.045*fract(vec2(u*1.32+y*.14,y*.74+u*.25));
            vec3 mineral=texture2D(wardAtlas,mineralUv).rgb*vec3(.70,.88,.79);
            if(y>.39 && y<2.46) diffuseColor.rgb=mix(diffuseColor.rgb,mineral,.70);
            if(y<.39 || (y>2.5 && y<2.92)){
              float v=y<.39?clamp(1.-y/.39,0.,1.):clamp((2.92-y)/.42,0.,1.);
              vec2 bronzeUv=vec2(.25+clamp(u,-.54,.54)*.44,.5*(.684+v*.244));
              vec3 relief=texture2D(wardAtlas,bronzeUv).rgb;
              diffuseColor.rgb=mix(diffuseColor.rgb,relief*1.24,.87);
            }
          }
        `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight += diffuseColor.rgb * .47;\n#include <opaque_fragment>');
    };
    assets={pillar:buildPillar(),stone,altar:altarMap(paint,'四象鎮壇'),lionSigil:altarMap(paint,'撼嶽獅印'),ink:altarMap(paint,'撼嶽獅印',true),
      cracks:fissureMap(paint),mandorla:mandorlaMap(paint),barrier:barrierMap(paint),plaques:ORIENTS.map(([name])=>plaqueMap(paint,name)),
      chip:new THREE.DodecahedronGeometry(1,0),square:new THREE.BoxGeometry(1,1,1)};
    return assets;
  }
  function meteorChips(at,n,radius,color) {
    const {chip}=resources();
    track(.92,fx=>{
      const mat=basic(fx,color,false);
      const lumps=fx.own(new THREE.InstancedMesh(chip,mat,n)); lumps.frustumCulled=false;fx.group.add(lumps);
      const xform=new THREE.Object3D(), seeds=Array.from({length:n},(_,i)=>({
        a:TAU*(i+Math.random()*.6)/n,r:radius*(.25+.7*Math.random()),lift:1.1+Math.random()*2.2,size:.047+Math.random()*.105
      }));
      fx.step=t=>{
        const u=t/.92;
        seeds.forEach(({a,r,lift,size},i)=>{
          const d=.3+u*r;
          xform.position.set(at.x+Math.sin(a)*d,.12+Math.max(0,lift*4*u*(1-u)),at.z+Math.cos(a)*d);
          xform.rotation.set(i+u*4,a+u*5,i*.1-u*6);
          xform.scale.set(size*(1-u*.74),size*1.8*(1-u*.75),size*(1-u*.74));
          xform.updateMatrix();lumps.setMatrixAt(i,xform.matrix);
        });
        lumps.instanceMatrix.needsUpdate=true;mat.opacity=1-ease(.64,1,u);
      };
    });
  }
  function mark(from,to) {
    const a=resources(),start=from.clone(),end=to.clone().add(vec(0,1.05,0));
    track(.34,fx=>{
      const block=mesh(fx.group,a.square,basic(fx,0xd5a168,false),0,0,0,.28,.22,.28);
      const rim=glow(fx,fx.group,start,0xffc647);
      fx.step=t=>{
        if(t<.22){end.copy(to);end.y+=1.05;}
        const u=ease(0,.22,t);block.position.lerpVectors(start,end,u);block.position.y+=Math.sin(PI*u)*.62;
        block.rotation.y=PI/4+t*7;block.visible=t<.24;rim.position.copy(block.position);
        rim.scale.setScalar(.57+.58*ease(.2,.25,t));rim.material.opacity=.52*(1-ease(.21,.34,t));
      };
    });
  }
  function chain(from,to) {
    const at=to.clone(), start=from.clone(),delta=at.clone().sub(start);
    track(.54,fx=>{
      const bars=[],geo=resources().square,mat=basic(fx,0xffc55d),angle=Math.atan2(delta.x,delta.z);
      for(let i=0;i<8;i++){
        const p=start.clone().lerp(at,(i+.65)/8);
        const bar=mesh(fx.group,geo,mat,p.x,.17,p.z,.62,.08,.14);
        bar.rotation.y=angle;bars.push(bar);
      }
      fx.step=t=>bars.forEach((b,i)=>{
        const u=THREE.MathUtils.clamp((t-i*.027)/.27,0,1);
        b.visible=u>0&&u<1;b.position.y=.12+.4*Math.sin(PI*u);b.scale.x=.18+Math.sin(PI*u)*.68;
      });
    });
    blast(at,0xe6b667,1.75,.48);
  }
  function thunder(target,onStrike=()=>{}) {
    const at=target.clone(),a=resources(),life=3.7;
    track(life,fx=>{
      fx.group.position.copy(at);
      const root=fx.group, deck=surface(fx,root,vec(0,.08,0),8.9,a.altar,0xffc470);
      const groups=[],barriers=[],frame=basic(fx,0xffcf7c);
      for(let i=0;i<4;i++){
        const dir=(i+.5)*PI/2, group=new THREE.Group(),color=ORIENTS[i][1];root.add(group);
        mesh(group,a.pillar,a.stone,0,0,0);
        const engraving=basic(fx,0xffffff,false,a.plaques[i]);
        mesh(group,ground,engraving,0,1.43,.348,.54,1.70,1);
        mesh(group,ground,engraving,0,1.43,-.348,.54,1.70,1).rotation.y=PI;
        const pearl=glow(fx,group,vec(0,3.0,0),color);
        groups.push({group,dir,pearl});
        const curtain=basic(fx,color,true,a.barrier);curtain.opacity=.65;
        barriers.push({veil:mesh(root,ground,curtain,0,.7,0),rail:mesh(root,a.square,frame,0,.7,0),dir:i*PI/2});
      }
      let beat=0;
      const beats=actionTiming('ward','cast').impacts;
      feedback('seal',.7);
      fx.step=t=>{
        const build=ease(0,.45,t), collapse=ease(1.75,2.31,t), fade=1-ease(2.65,life,t);
        const r=3.63-1.68*collapse;deck.material.opacity=build*fade*(.64+.14*Math.sin(t*5));
        frame.opacity=fade*ease(.55,1.04,t)*.75;
        groups.forEach(({group,dir,pearl},i)=>{
          const u=ease(.09+i*.098,.58+i*.098,t);
          group.visible=u>.005&&fade>.005;
          group.position.set(Math.sin(dir)*r,-3.28*(1-u)-3.3*(1-fade),Math.cos(dir)*r);
          group.rotation.y=dir;
          group.scale.setScalar(1+.105*collapse);
          pearl.scale.setScalar(1.45+.33*Math.sin(t*8+i));pearl.material.opacity=u*fade*.72;
        });
        barriers.forEach(({veil,rail,dir},i)=>{
          const u=ease(.59+i*.08,.98+i*.08,t)*fade, dist=r/Math.SQRT2;
          const h=u*(1.35+.46*Math.sin(6*t+i)), x=Math.sin(dir)*dist,z=Math.cos(dir)*dist;
          veil.position.set(x,.10+h/2,z);veil.rotation.y=dir;veil.scale.set(Math.SQRT2*r,h,1);
          veil.material.opacity=u*(.70+.25*collapse);
          rail.position.set(x,h+.10,z);rail.rotation.y=dir;rail.scale.set(Math.SQRT2*r,.042,.042);
        });
        while(beat<beats.length && t>=beats[beat] && !fx.dead){
          const final=beat===beats.length-1;blast(at,final?0xffd57a:ORIENTS[beat][1],final?5.25:2.75,final?.75:.45);
          if(final)meteorChips(at,52,4.7,0xcba268);
          sparks(at,final?85:26,0xffcd71,final?6.6:3.6,final?.91:.54,7);
          feedback(final?'gong':'rumble',final?.90:.43);beat++;onStrike(at.clone(),final);
        }
      };
    });
  }
  function summon(target,onStrike=()=>{}) {
    const a=resources(),at=target.clone(),life=4.35,impact=actionTiming('ward','ultimate').impacts[0];
    track(life,fx=>{
      fx.group.position.copy(at);
      const group=fx.group;
      const lion=new THREE.Group();group.add(lion);
      if(relicTemplate)lion.add(relicTemplate.clone(true));
      else preloadWardRelic().then(template=>{if(!fx.dead)lion.add(template.clone(true));}).catch(console.error);
      const incense=surface(fx,group,vec(0,.09,0),7.8,a.lionSigil,0xffc36b);
      const print=surface(fx,group,vec(0,.105,0),5.1,a.ink,0xffffff,false);
      const fissure=surface(fx,group,vec(0,.082,0),5,a.cracks,0xffffff);
      const halo=glow(fx,group,vec(0,1.8,-.65),0xffaf3a);
      const nimbus=new THREE.Group();group.add(nimbus);
      const fieryWheel=mesh(nimbus,ground,basic(fx,0xffce89,true,a.mandorla),0,0,0);
      const innerWheel=mesh(nimbus,ground,basic(fx,0xfaab64,true,a.mandorla),0,0,-.03);
      const orbit=[];
      for(let i=0;i<4;i++){
        const t=basic(fx,0xffcc7b,true,a.lionSigil);
        orbit.push(mesh(group,ground,t,0,1.5,0,1.0,1.0,1));
      }
      const shafts=new THREE.InstancedMesh(a.square,basic(fx,0xdd8e35),16);
      shafts.frustumCulled=false;fx.own(shafts);group.add(shafts);
      const transform=new THREE.Object3D();
      let struck=false,raised=false,aftershock=false;
      feedback('gong',.64);
      fx.step=t=>{
        const form=ease(.03,.56,t),rise=ease(.24,1.21,t),suspend=ease(1.50,2.16,t);
        const drop=THREE.MathUtils.clamp((t-2.11)/(impact-2.11),0,1)**3;
        const retreat=ease(2.79,3.66,t);
        const y=(.12+1.52*rise+.53*suspend)*(1-drop);
        const scale=(.45+.78*form+.13*suspend)*(1-retreat);
        lion.visible=t>.035&&retreat<.995;
        lion.scale.setScalar(scale);
        lion.position.y=y-.11*ease(impact,impact+.10,t);
        lion.rotation.y=-.55+.90*rise+.18*Math.sin(t*2.5)*(1-drop)+.13*drop;
        incense.material.opacity=form*(1-ease(impact,impact+.48,t))*(.56+.17*Math.sin(t*6));
        incense.rotation.z=.10*Math.sin(t*1.8);
        const hit=ease(impact,impact+.09,t),wave=ease(impact,impact+1.04,t),fade=1-ease(3.4,life,t);
        print.material.opacity=hit*fade;print.rotation.z=-lion.rotation.y;
        fissure.material.opacity=hit*fade*(.84+.13*Math.sin(t*24));fissure.scale.setScalar(3.1+wave*14);
        halo.position.y=y+.70;halo.scale.set(4.8+rise,3.4+rise,1);
        halo.material.opacity=(.20+.15*suspend)*form*(1-drop);
        nimbus.rotation.y=lion.rotation.y;
        nimbus.position.set(-Math.sin(nimbus.rotation.y)*1.35,y+scale*2.15,-Math.cos(nimbus.rotation.y)*1.35);
        fieryWheel.scale.setScalar(5.45*form+.25*suspend);
        innerWheel.scale.setScalar(4.35*form+.23*suspend);
        fieryWheel.rotation.z=t*.27;innerWheel.rotation.z=-t*.38;
        fieryWheel.material.opacity=form*(1-drop)*.92;innerWheel.material.opacity=form*(1-drop)*.45;
        orbit.forEach((tablet,i)=>{
          const ang=TAU*i/4+t*1.28,r=2.25+.48*rise-.72*drop;
          tablet.position.set(Math.sin(ang)*r,.39+y+.32*Math.sin(ang*2+t),Math.cos(ang)*r);
          tablet.rotation.y=ang;tablet.rotation.z=.15*Math.sin(t*3+i);
          tablet.material.opacity=form*(1-drop)*(.65+.15*Math.sin(t*4+i));
        });
        shafts.material.opacity=form*(1-ease(impact,impact+.4,t))*(.14+.22*suspend);
        for(let i=0;i<16;i++){
          const ang=TAU*i/16+.14*t,r=1.85+.2*Math.sin(i*2);
          const length=(.3+.9*rise+.72*suspend)*(1-drop)+.2;
          transform.position.set(Math.sin(ang)*r,y+.26+Math.sin(t*4+i)*.21,Math.cos(ang)*r);
          transform.scale.set(.021,length,.021);transform.rotation.set(0,ang,0);
          transform.updateMatrix();shafts.setMatrixAt(i,transform.matrix);
        }
        shafts.instanceMatrix.needsUpdate=true;
        if(!raised&&t>=1.32){raised=true;feedback('chime',1);}
        if(!struck&&t>=impact){
          struck=true;feedback('gong',1.34);feedback('rumble',1.5);
          meteorChips(at,82,6.65,0xd1a873);sparks(at,102,0xffbb45,8.1,1.1,9);
          blast(at,0xff8a45,7.0,.76);onStrike(at.clone(),true);
        }
        if(!fx.dead&&!aftershock&&t>=impact+.24){
          aftershock=true;blast(at,0xffdd89,7.35,.83);sparks(at,35,0xffe6ad,4.6,.69,5);
        }
      };
    });
  }
  function prepare(renderer){
    for(const item of Object.values(resources()).flat())if(item?.isTexture)renderer.initTexture(item);
    if(relicAtlas)renderer.initTexture(relicAtlas);
  }
  return {mark,chain,thunder,summon,prepare};
}
