import * as THREE from './vendor/three.module.js';
import {earRegistration} from './art/actors/ear-registration.js';
import {headRegistration} from './art/actors/head-scanlines.js';

// Shoulder, elbow, wrist and fingertips measured on the two profile paintings.
// In particular, the raised talisman hand and the crossed seal gesture are
// drawn lower in the supplemental profiles than in the approved hero pose.
const armViews = {
  thunder: [[[.44,.21],[.40,.355],[.345,.484],[.33,.544]],[[.61,.21],[.68,.355],[.73,.486],[.735,.547]]],
  sword: [[[.63,.21],[.585,.363],[.46,.510],[.451,.569]],[[.37,.219],[.39,.370],[.521,.510],[.532,.566]]],
  ward: [[[.54,.205],[.44,.347],[.216,.315],[.164,.223]],[[.49,.205],[.62,.347],[.838,.314],[.874,.222]]],
  judge: [[[.66,.22],[.62,.365],[.51,.49],[.503,.543]],[[.41,.218],[.53,.335],[.81,.404],[.887,.425]]],
  corpse: [[[.78,.241],[.54,.271],[.17,.283],[.035,.343]],[[.22,.241],[.50,.271],[.837,.283],[.966,.343]]],
  black: [[[.54,.221],[.47,.37],[.422,.503],[.425,.565]],[[.53,.231],[.57,.387],[.66,.508],[.684,.572]]],
  white: [[[.69,.254],[.745,.357],[.851,.421],[.967,.432]],[[.36,.25],[.54,.363],[.702,.332],[.761,.323]]]
};

function registerSleeves(mesh, id, angle) {
  const g=mesh.geometry, front=g.getAttribute('captureFront');
  const pos=g.getAttribute('position'), index=g.getAttribute('skinIndex'), weights=g.getAttribute('skinWeight');
  const sight=g.getAttribute('_capture_visibility'), bones=mesh.skeleton?.bones;
  if(!sight || !bones) return;
  const confidence=Float32Array.from({length:pos.count*4},(_,i)=>sight.getComponent(i>>2,i%4));
  const labels=armViews[id==='thunder-guard'?'thunder':id];
  const invert=new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  for(let camera=0;camera<2;camera++){
    const side=camera?'R':'L', key=camera?'captureRight':'captureLeft', uv=g.getAttribute(key), targets=labels[camera];
    const sourceKeys=['upperArm','forearm','hand'].map(name=>bones.findIndex(b=>b.name===name+side));
    if(sourceKeys.includes(-1)) continue;
    const axis=new THREE.Vector2(Math.cos(angle),-Math.sin(angle)).multiplyScalar(camera?-1:1);
    const d=i=>pos.getX(i)*axis.x+pos.getZ(i)*axis.y;
    let lo=0;while(lo+1<pos.count && front.getX(lo)>1.6)lo++;
    let hi=lo;
    for(let i=0;i<pos.count;i++){if(front.getX(i)>1.6)continue;if(d(i)<d(lo))lo=i;if(d(i)>d(hi))hi=i;}
    const scale=(uv.getX(hi)-uv.getX(lo))/(d(hi)-d(lo)), intercept=uv.getX(lo)-scale*d(lo);
    function projectJoint(bone){
      const point=new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(invert);
      let best=-1,dist=Infinity;
      for(let i=0;i<pos.count;i++){
        if(front.getX(i)>1.6)continue;
        const delta=Math.abs(pos.getY(i)-point.y);
        if(delta<dist){best=i;dist=delta;}
      }
      return [intercept+scale*(axis.x*point.x+axis.y*point.z),uv.getY(best)];
    }
    const anchors=sourceKeys.map(k=>projectJoint(bones[k]));
    const coords=new Float32Array(uv.array), sleeveWeights=[0,0,0];
    const palm=targets[2],tip=targets[3],px=tip[0]-palm[0],py=tip[1]-palm[1];
    for(let i=0;i<pos.count;i++){
      if(front.getX(i)>1.6)continue;
      const u=uv.getX(i),v=uv.getY(i);
      sleeveWeights.fill(0);
      for(let k=0;k<4;k++){
        const j=sourceKeys.indexOf(index.getComponent(i,k));
        if(j!==-1)sleeveWeights[j]+=weights.getComponent(i,k);
      }
      // A profile camera sees the near wrist laid over the tunic. Once the
      // arm lifts, its painted fingers must not be left behind on the tunic.
      const t=THREE.MathUtils.clamp(((u-palm[0])*px*.23+(v-palm[1])*py)/(px*px*.23+py*py),0,1);
      const handDistance=Math.hypot((u-palm[0]-t*px)*.48,v-palm[1]-t*py);
      const palmCoverage=1-THREE.MathUtils.smoothstep(handDistance,.010,.030);
      const arm=sleeveWeights[0]+sleeveWeights[1]+sleeveWeights[2];
      confidence[4*i+2+camera]*=1-palmCoverage*(1-arm);
      if(arm<.001)continue;
      for(let j=1;j<3;j++){
        if(!sleeveWeights[j])continue;
        const a=anchors[j],b=targets[j];
        // Warp the sleeve together with its joints; preserve its embroidered
        // weave instead of stretching the last observed pixel at the cuff.
        const influence=sleeveWeights[j]*(j===1?.44:.88);
        coords[2*i]+=influence*(b[0]-a[0]);
        coords[2*i+1]+=influence*(b[1]-a[1]);
      }
    }
    g.setAttribute(key,new THREE.BufferAttribute(coords,2));
  }
  g.setAttribute('captureVisibility',new THREE.BufferAttribute(confidence,4));
}

// Project the approved front eye, nose, lip and chin anchors through the
// actual bind-pose triangles. This also accounts for an asymmetric head turn.
function faceCorrespondence(geometry, front, sideUVs, marks) {
  const triangles=geometry.index.array, pos=geometry.getAttribute('position');
  const matches=marks[0].map(([u,v])=>{
    let closest=null, nearestDepth=-Infinity;
    for(let n=0;n<triangles.length;n+=3){
      const i=triangles[n],j=triangles[n+1],k=triangles[n+2];
      const ax=front.getX(i),ay=front.getY(i),bx=front.getX(j)-ax,by=front.getY(j)-ay;
      const cx=front.getX(k)-ax,cy=front.getY(k)-ay,det=bx*cy-by*cx;
      if(Math.abs(det)<1e-8)continue;
      const b=((u-ax)*cy-(v-ay)*cx)/det,c=(bx*(v-ay)-by*(u-ax))/det,a=1-b-c;
      if(Math.min(a,b,c)<-.0001)continue;
      const depth=pos.getZ(i)*a+pos.getZ(j)*b+pos.getZ(k)*c;
      if(depth<=nearestDepth)continue;
      nearestDepth=depth;
      closest=sideUVs.map(uv=>[
        a*uv.getX(i)+b*uv.getX(j)+c*uv.getX(k),
        a*uv.getY(i)+b*uv.getY(j)+c*uv.getY(k)
      ]);
    }
    return closest;
  });
  if(matches.includes(null))return [null,null];
  return [0,1].map(k=>{
    const ordered=[k?1:2,0,3,4].map((index,i)=>{
      const [x,y]=matches[index][k],target=marks[k+1][i];
      return {x,y,dx:THREE.MathUtils.clamp(target[0]-x,-.10,.10),dy:THREE.MathUtils.clamp(target[1]-y,-.033,.033)};
    }).sort((a,b)=>a.y-b.y);
    const first=ordered[0], last=ordered[3];
    return [{x:first.x,y:first.y-.044,dx:0,dy:0},...ordered,{x:last.x,y:last.y+.044,dx:0,dy:0}];
  });
}

function fitFaceUV(uv,i,knots,head,dst){
  if(!knots)return;
  const x=uv.getX(i),y=uv.getY(i);
  for(let j=1;j<knots.length;j++){
    const a=knots[j-1],b=knots[j];
    if(y<a.y || y>b.y)continue;
    const t=THREE.MathUtils.smoothstep(y,a.y,b.y),axis=THREE.MathUtils.lerp(a.x,b.x,t);
    const weight=head*Math.exp(-1.5*((x-axis)/.135)**2);
    dst[2*i]+=weight*THREE.MathUtils.lerp(a.dx,b.dx,t);
    dst[2*i+1]+=weight*THREE.MathUtils.lerp(a.dy,b.dy,t);
    return;
  }
}

function registerHead(geometry, id, viewUVs) {
  const reference = headRegistration[id];
  const rows = Uint8Array.from(atob(reference.rows), c => c.charCodeAt(0));
  const position = geometry.getAttribute('position');
  const head = geometry.getAttribute('_capture_head');
  const parts = new Float32Array(position.count * 4), polar = new Float32Array(position.count * 3);
  const region = new Float32Array(2);
  // 65 rows over the top quarter of the figure, with two 8-bit horizontal bounds.
  function bounds(view, v) {
    const line = Math.min(64,Math.max(0,v*256));
    const lo = Math.floor(line), hi = Math.min(64,lo+1), t = line-lo;
    const base = view * 130;
    for(let j=0;j<2;j++)region[j]=((1-t)*rows[base+2*lo+j]+t*rows[base+2*hi+j])/255;
  }
  // Measure the head volume in each bind-pose slice, independently of nearby
  // rigid equipment. A scabbard sharing this height is not part of a cheek.
  const bins = Array.from({length:65},()=>[]);
  const amount = new Float32Array(position.count);
  for(let i=0;i<position.count;i++){
    for(let k=0;k<4;k++){
      const uv=viewUVs[k],u=uv.getX(i),v=uv.getY(i);
      bounds(k,v);
      parts[i*4+k]=v>.25?0:THREE.MathUtils.clamp(.5+Math.min(u-region[0],region[1]-u)/.014,0,1);
    }
    const h=head?head.getX(i):Math.min(parts[i*4],Math.max(parts[i*4+2],parts[i*4+3]));
    amount[i]=h;
    if(h>.40){
      const bin=THREE.MathUtils.clamp(Math.round(viewUVs[0].getY(i)*256),0,64);
      bins[bin].push(i);
    }
  }
  const slices=bins.map((_,index)=>{
    // Pool adjacent rows so a narrow hat brim or a UV chart seam is stable.
    const verts=bins.slice(Math.max(0,index-2),Math.min(65,index+3)).flat();
    if(!verts.length)return null;
    const span=read=>{
      const values=verts.map(read).sort((a,b)=>a-b);
      return [values[Math.floor((values.length-1)*.015)],values[Math.ceil((values.length-1)*.985)]];
    };
    return [span(i=>position.getX(i)),span(i=>position.getZ(i)),...viewUVs.slice(1).map(uv=>span(i=>uv.getX(i)))];
  });
  const sideNames=['captureLeft','captureRight'];
  const rearCoords=new Float32Array(viewUVs[1].array);
  const sideCoords=sideNames.map(name=>new Float32Array(geometry.getAttribute(name).array));
  for(let i=0;i<position.count;i++){
    const h=amount[i],v=viewUVs[0].getY(i);
    if(h<.001 || v>.25)continue;
    const scan=THREE.MathUtils.clamp(v*256,0,64),index=Math.floor(scan);
    const a=slices[index],b=slices[Math.min(index+1,64)]||a;
    if(!a||!b)continue;
    const span=(k,side)=>THREE.MathUtils.lerp(a[k][side],b[k][side],scan-index);
    function coordinate(k,x){const low=span(k,0);return THREE.MathUtils.clamp((x-low)/Math.max(.001,span(k,1)-low),0,1);}
    polar[3*i]=coordinate(0,position.getX(i))*2-1;
    polar[3*i+1]=coordinate(1,position.getZ(i))*2-1;
    polar[3*i+2]=h;
    const rearU=viewUVs[1].getX(i);
    bounds(1,viewUVs[1].getY(i));
    if(region[1]-region[0]>.015){
      const fit=THREE.MathUtils.lerp(region[0],region[1],coordinate(2,rearU));
      rearCoords[2*i]=THREE.MathUtils.lerp(rearU,fit,h);
    }
    for(let k=0;k<2;k++){
      const uv=viewUVs[k+2];bounds(k+2,uv.getY(i));
      if(region[1]-region[0]>.015){
        const u=uv.getX(i), fitted=THREE.MathUtils.lerp(region[0],region[1],coordinate(3+k,u));
        sideCoords[k][2*i]=THREE.MathUtils.lerp(u,fitted,h);
      }
    }
  }
  const registeredSides=sideCoords.map(arr=>new THREE.BufferAttribute(arr,2));
  const calibration=faceCorrespondence(geometry,viewUVs[0],registeredSides,reference.landmarks);
  for(let k=0;k<2;k++){
    for(let i=0;i<position.count;i++)if(amount[i]>.001)fitFaceUV(registeredSides[k],i,calibration[k],amount[i],sideCoords[k]);
    geometry.setAttribute(sideNames[k],registeredSides[k]);
  }
  geometry.setAttribute('captureBack',new THREE.BufferAttribute(rearCoords,2));
  geometry.setAttribute('partInCapture',new THREE.BufferAttribute(parts,4));
  geometry.setAttribute('headPolar',new THREE.BufferAttribute(polar,3));
}

// Estimate the outward direction over the whole cross-section of a robe or
// sleeve, so every little embroidery ridge does not introduce a new paint seam.
function garmentSections(mesh, front) {
  const geometry = mesh.geometry, position = geometry.attributes.position;
  const joint = geometry.attributes.skinIndex, weight = geometry.attributes.skinWeight;
  const partByJoint = (mesh.skeleton?.bones || []).map(bone => {
    if (!/^(upperArm|forearm|hand|sleeve|thigh|shin|foot)/.test(bone.name)) return 0;
    const leg = /^(thigh|shin|foot)/.test(bone.name);
    return (leg ? 3 : 1) + Number(bone.name.endsWith('R'));
  });
  const groups = new Uint8Array(position.count);
  const rows = Array.from({length:5}, () => Array.from({length:64}, () => []));
  const row = v => THREE.MathUtils.clamp(Math.floor(v * 64), 0, 63);
  for (let i = 0; i < position.count; i++) {
    if (front.getX(i) > 1.6) continue;
    const influence = [0,0,0,0,0];
    for (let slot = 0; slot < 4; slot++) {
      const part = partByJoint[joint.getComponent(i,slot)] || 0;
      influence[part] += weight.getComponent(i,slot);
    }
    const part = influence.indexOf(Math.max(...influence));
    groups[i] = part;
    rows[part][row(front.getY(i))].push(i);
  }
  const sections = rows.map(levels => levels.map((_, height) => {
    const vertices = levels.slice(Math.max(0,height-1),height+2).flat();
    if (!vertices.length) return null;
    function span(axis) {
      const coordinates = vertices.map(i => position.getComponent(i,axis)).sort((a,b)=>a-b);
      return [coordinates[Math.floor((coordinates.length-1)*.025)],coordinates[Math.ceil((coordinates.length-1)*.975)]];
    }
    return [...span(0), ...span(2)];
  }));
  return i => sections[groups[i]][row(front.getY(i))];
}

// Transfer each drawn ear onto its own closed mesh using the measured top,
// lobe and front/back extents. Its helix remains attached when the head turns.
function fitEars(geometry, axes, earRects) {
  const type = geometry.getAttribute('_surface_class');
  if (!type) return;
  const p = geometry.attributes.position;
  const earIds = [];
  for (let i=0; i<type.count; i++) if (type.getX(i)===5) earIds.push(i);
  if (!earIds.length) return;
  const side = i => p.getX(i)*axes[2][0]+p.getZ(i)*axes[2][1];
  const lateral = earIds.map(side).sort((a,b)=>a-b);
  const middle = (lateral[0]+lateral.at(-1))*.5;
  for (let k=0; k<2; k++) {
    const set = earIds.filter(i => (side(i)>=middle)===(k===0));
    if (!set.length) continue;
    const direction = k===0 ? 1 : -1;
    const horiz = i => direction*(p.getX(i)*axes[2][1]-p.getZ(i)*axes[2][0]);
    const horizontal = set.map(horiz), vertical = set.map(i => p.getY(i));
    const x0=Math.min(...horizontal), x1=Math.max(...horizontal);
    const y0=Math.min(...vertical), y1=Math.max(...vertical);
    const [u0,v0,u1,v1]=earRects[k];
    const target=geometry.getAttribute(k===0?'captureLeft':'captureRight');
    for (const i of set) {
      target.setXY(i, THREE.MathUtils.lerp(u0,u1,(horiz(i)-x0)/Math.max(.00001,x1-x0)),
                      THREE.MathUtils.lerp(v1,v0,(p.getY(i)-y0)/Math.max(.00001,y1-y0)));
    }
  }
  return middle;
}

// The opposite cheek is a measured second projection of the same canonical
// surface. Use it only on a far sagittal patch the front artist could not see.
function faceExposure(geometry, kind, mirror, front) {
  if (!kind || !mirror) return null;
  const seen = geometry.getAttribute('_capture_visibility');
  const normal = geometry.attributes.normal, ids=[];
  for (let i=0; i<kind.count; i++) if (kind.getX(i)===1) ids.push(i);
  const values=new Float32Array(kind.count);
  for (const i of ids) {
    const u=mirror.getX(i), v=mirror.getY(i);
    const z=normal.getZ(i), confidence=seen?seen.getX(i):1;
    if (z>.61 && confidence>.78) continue;
    let best=Infinity, partner=i;
    for (const j of ids) {
      const dx=u-front.getX(j),dy=v-front.getY(j);
      const d=dx*dx+dy*dy*2.7;
      if (d<best) {best=d;partner=j;}
    }
    const other=normal.getZ(partner), otherSeen=seen?seen.getX(partner):1;
    const quality=Math.max(0,z)*(.28+.72*confidence);
    const reverse=Math.max(0,other)*(.28+.72*otherSeen);
    values[i]=THREE.MathUtils.smoothstep(reverse-quality,.09,.40) *
              (1-THREE.MathUtils.smoothstep(quality,.20,.60));
  }
  return values;
}

function neckShading(geometry, kind, sideYaw) {
  if (!kind) return null;
  const points=geometry.attributes.position, ids=[];
  for (let i=0;i<kind.count;i++) if(kind.getX(i)===6)ids.push(i);
  if (!ids.length) return null;
  const coordinates=[0,1,2].map(k=>ids.map(i=>points.getComponent(i,k)));
  const box=coordinates.map(arr=>[Math.min(...arr),Math.max(...arr)]);
  const shade=new Float32Array(kind.count), cylinder=new Float32Array(kind.count*3), yaw=sideYaw-Math.PI/2;
  for (const i of ids) {
    const height=(points.getY(i)-box[1][0])/Math.max(.001,box[1][1]-box[1][0]);
    const x=(2*points.getX(i)-box[0][0]-box[0][1])/Math.max(.002,box[0][1]-box[0][0]);
    const z=(2*points.getZ(i)-box[2][0]-box[2][1])/Math.max(.002,box[2][1]-box[2][0]);
    const theta=Math.atan2(x,z)-yaw, side=Math.sin(theta), front=Math.cos(theta);
    cylinder.set([side,front,1-height],3*i);
    const jaw=Math.exp(-(((height-.91)/.23)**2)), collar=Math.exp(-((height/.16)**2));
    const tendon=Math.exp(-(((Math.abs(side)-(.18+.70*height))/.13)**2));
    const key=Math.cos(theta+.67);
    const larynx=Math.exp(-(((height-.53)/.12)**2+(side/.22)**2));
    shade[i]=THREE.MathUtils.clamp(.78+.17*key-.27*jaw-.13*collar+
        Math.max(front,0)*(.17*tendon+.10*larynx),.37,1.14);
  }
  return {shade,cylinder};
}

function bindPigment(mesh, id, sideYaw, rearYaw) {
  const g = mesh.geometry, front = g.getAttribute('captureFront');
  const normal = g.attributes.normal, position = g.attributes.position;
  const head = g.getAttribute('headPolar'), parts = g.getAttribute('partInCapture');
  const visibility = g.getAttribute('captureVisibility');
  const axes = [0, rearYaw, sideYaw, sideYaw-Math.PI].map(a => [Math.sin(a), Math.cos(a)]);
  const region = garmentSections(mesh, front);
  const jointIndex=g.attributes.skinIndex, jointWeight=g.attributes.skinWeight;
  const jointNames=mesh.skeleton.bones.map(bone=>bone.name);
  const armBone=jointNames.map(name=>/^(upperArm|forearm|hand|sleeve|finger|thumb)/.test(name));
  const kind = g.getAttribute('_surface_class') || g.getAttribute('_anatomy'), mirror = g.getAttribute('_face_mirror_uv');
  const middleEar = fitEars(g, axes, earRegistration[id]);
  const faceMirror = faceExposure(g,kind,mirror,front);
  const neck = neckShading(g,kind,sideYaw);
  const pigments = new Float32Array(position.count*4), regionData = new Float32Array(position.count*4);
  const mirroredFace = new Float32Array(position.count*3);
  const staff = id === 'white' ? new Float32Array(position.count*3) : null;
  const {smoothstep, clamp, lerp} = THREE.MathUtils;
  let earCenterX=0, earCenterZ=0, ears=0;
  if (id==='ward' && kind) {
    for (let i=0;i<position.count;i++) if(kind.getX(i)===5) {
      earCenterX+=position.getX(i);earCenterZ+=position.getZ(i);ears++;
    }
    if (ears){earCenterX/=ears;earCenterZ/=ears;}
  }
  const [nose,eyeA,eyeB,,chin] = headRegistration[id].landmarks[0];
  const eyesY = (eyeA[1]+eyeB[1])*.5, separation = Math.max(.025,eyeB[0]-eyeA[0]);
  const skinHalfWidth = separation * 1.13, faceHeight = chin[1]-eyesY;
  for (let i = 0; i < position.count; i++) {
    const nx = normal.getX(i), nz = normal.getZ(i);
    if (front.getX(i) > 1.6) {
      if (staff && front.getX(i) > 3.) {
        const side = nx*axes[2][0]+nz*axes[2][1];
        const uv = g.getAttribute(side > 0 ? 'captureLeft' : 'captureRight');
        staff.set([uv.getX(i),uv.getY(i),smoothstep(Math.abs(side),.68,.96)],3*i);
      }
      continue;
    }
    const surface = kind ? kind.getX(i) : 0;
    const h = kind ? Number(surface>0 && surface<9) : head.getZ(i);
    regionData[4*i]=h;regionData[4*i+1]=surface;regionData[4*i+2]=surface===6&&neck ? neck.shade[i] : 1;
    // Sleeve shells contain at least one arm joint. Coat/hips/legs are
    // disjoint meshes, even where their bind-pose silhouettes overlap.
    let armWeight=0;
    for (let slot=0;slot<4;slot++) {
      if (armBone[jointIndex.getComponent(i,slot)]) armWeight+=jointWeight.getComponent(i,slot);
    }
    const chestProp=jointNames[jointIndex.getX(i)]==='chest' && jointWeight.getX(i)>.99999;
    regionData[4*i+3]=Number(surface===0 && !chestProp && armWeight<.000001);
    if (surface===6 && neck) mirroredFace.set(neck.cylinder.subarray(3*i,3*i+3),3*i);
    if (id==='ward' && (surface===2 || surface===8)) {
      const angle=Math.atan2(position.getX(i)-earCenterX,position.getZ(i)-earCenterZ)-(sideYaw-Math.PI/2);
      const side=Math.sin(angle), ahead=Math.cos(angle), rear=Math.max(0,-ahead);
      const hairline=.036+.011*(1-ahead)+.021*rear**5+.007*side*side+.0025*Math.sin(3*angle);
      const mass=1-smoothstep(front.getY(i),hairline-.010,hairline+.014);
      mirroredFace.set([side,ahead,mass],3*i);
    }
    if (surface===10 || surface===12) continue;
    if (surface===1) {
      pigments[4*i]=1;
      if (mirror) {
        mirroredFace.set([mirror.getX(i),mirror.getY(i),faceMirror[i]],3*i);
      }
      continue;
    }
    if (surface===5) {
      const lateral=position.getX(i)*axes[2][0]+position.getZ(i)*axes[2][1];
      pigments[4*i+(lateral>=middleEar?2:3)]=1;
      continue;
    }
    if (surface===9) { pigments[4*i]=1;continue; }
    const slice = region(i);
    let rx = nx, rz = nz;
    if (slice) {
      const [x0,x1,z0,z1] = slice;
      rx = clamp((2*position.getX(i)-x0-x1)/Math.max(.012,x1-x0),-1.3,1.3);
      rz = clamp((2*position.getZ(i)-z0-z1)/Math.max(.012,z1-z0),-1.3,1.3);
    }
    rx = lerp(rx, head.getX(i), h);
    rz = lerp(rz, head.getY(i), h);
    const magnitude = Math.max(.10,Math.hypot(rx,rz));
    rx /= magnitude; rz /= magnitude;
    const u = front.getX(i), v = front.getY(i);
    const noseToChin = clamp((v-nose[1])/(chin[1]-nose[1]),0,1);
    const centerX = lerp((eyeA[0]+eyeB[0]+nose[0])/3,chin[0],noseToChin);
    const width = Math.abs(u-centerX)/skinHalfWidth;
    const face = (1-smoothstep(width,.68,1.28)) *
      smoothstep(v,eyesY-.56*faceHeight,eyesY-.22*faceHeight) *
      (1-smoothstep(v,chin[1]-.08*faceHeight,chin[1]+.29*faceHeight));
    const frontSeen = visibility ? smoothstep(visibility.getX(i),.05,.71) : 1;
    const onFace = (kind ? 0 : h) * face * smoothstep(rz,-.10,.52) * frontSeen;
    for (let k = 0; k < 4; k++) {
      const [x,z] = axes[k];
      const radial = rx*x+rz*z, facing = nx*x+nz*z;
      const direction = lerp(.47*radial+.53*facing, .87*radial+.13*facing, h);
      const visible = visibility ? visibility.getComponent(i,k) : 1;
      const semantic = 1-Math.abs(h-parts.getComponent(i,k));
      const confidence = Math.max(.005,smoothstep(visible,.01,.74)) *
                         lerp(smoothstep(semantic,.12,.81),1,h);
      let score = Math.max(.012,.23+direction)*confidence*(k<2?1.13:1);
      // The two pupils, bridge, nostrils and lips are one registered observation.
      // Secondary drawings contribute the temples and ears outside this boundary.
      if (k===0) score = Math.max(score,2.05*onFace);
      else score *= 1-.99*onFace;
      pigments[4*i+k]=score;
    }
  }
  g.setAttribute('surfacePigment',new THREE.BufferAttribute(pigments,4));
  g.setAttribute('pigmentRegion',new THREE.BufferAttribute(regionData,4));
  g.setAttribute('mirroredFace',new THREE.BufferAttribute(mirroredFace,3));
  if (staff) g.setAttribute('staffPigment',new THREE.BufferAttribute(staff,3));
}

export function registerCaptureCoordinates(mesh, id, sideYaw, rearYaw) {
  const geometry = mesh.geometry;
  const aliases = [['captureFront', 'uv1'], ['captureBack', 'uv2'],
                   ['captureLeft', 'uv3'], ['captureRight', 'texcoord_4']];
  const observations = aliases.map(([name, source]) => {
    const coordinates = geometry.getAttribute(source);
    geometry.setAttribute(name, coordinates);
    return coordinates;
  });
  const visibility = geometry.getAttribute('_capture_visibility');
  if (visibility) {
    geometry.setAttribute('captureVisibility', visibility);
    registerSleeves(mesh, id, sideYaw);
  }
  registerHead(geometry, id, observations);
  bindPigment(mesh, id, sideYaw, rearYaw);
}
