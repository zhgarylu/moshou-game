import * as THREE from './vendor/three.module.js';
import {actionTiming} from './action-timing.js';

const TAU=Math.PI*2;
const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
const point=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const dipper=[
  [-3.2,1.43,-.10],[-2.32,2.05,-.45],[-1.20,2.28,-.30],[-.12,2.03,-.10],
  [.63,3.05,-.32],[2.42,2.81,-.45],[2.08,1.52,-.15]
];
const joins=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]];
const rBeats=actionTiming('sword','cast').impacts;
const qBeats=actionTiming('sword','ultimate').impacts;

// The pivot is the point of the jian. Its ridged blade, swept bronze guard,
// wrapped grip and jade pommel remain legible even in small instanced volleys.
function makeBlade() {
  const vertices=[], colors=[];
  const steel=['#387b86','#ceeae5','#62b7ad','#244755'];
  function face(a,b,c,tint,light=1) {
    const col=new THREE.Color(tint).multiplyScalar(light);
    for(const p of [a,b,c]) {vertices.push(p[0],p[1]-1,p[2]);colors.push(col.r,col.g,col.b);}
  }
  function strip(rings,tints) {
    for(let k=1;k<rings.length;k++)for(let i=0;i<rings[k].length;i++){
      const j=(i+1)%rings[k].length,lo=rings[k-1],hi=rings[k],t=tints[i%tints.length];
      face(lo[i],lo[j],hi[j],t);face(lo[i],hi[j],hi[i],t);
    }
  }
  const bladeSection=(y,w,r)=>[[-w,y,0],[0,y,r],[w,y,0],[0,y,-r]];
  strip([bladeSection(.27,.052,.027),bladeSection(.31,.084,.042),bladeSection(.78,.048,.026),bladeSection(1,0,0)],steel);
  for(const d of [-1,1]) {
    const coords=[[.010,.254],[.045,.215],[.150,.243],[.204,.315],[.153,.290],[.067,.291],[.021,.318]];
    const front=coords.map(([x,y])=>[x*d,y,.035]),rear=coords.map(([x,y])=>[x*d,y,-.035]);
    for(let i=1;i<coords.length-1;i++){
      face(front[0],front[i],front[i+1],i%2?'#f6ce77':'#ffe9a2',1.18);
      face(rear[0],rear[i+1],rear[i],'#ac7a3e');
    }
    for(let i=0;i<coords.length;i++){
      const j=(i+1)%coords.length;
      face(front[i],rear[i],rear[j],'#8f592a');face(front[i],rear[j],front[j],'#d9a858');
    }
  }
  function ring(y,r){return Array.from({length:8},(_,i)=>[Math.cos(TAU*i/8)*r,y,Math.sin(TAU*i/8)*r]);}
  strip([ring(.008,.015),ring(.037,.046),ring(.075,.029),ring(.224,.029),ring(.26,.050)],['#42636c','#467c70','#845b3d','#785a37']);
  for(const y of [.035,.084,.121,.158,.195,.23]){
    strip([ring(y,.032),ring(y+.008,.035),ring(y+.013,.030)],['#bd9147','#f5ca77','#f5ca77','#795b34']);
  }
  const gem=(y,w,z)=>[[0,y+w,z],[w,y,z],[0,y-w,z],[-w,y,z]];
  for(const sign of [-1,1]) {
    const d=gem(.275,.036,.040*sign);face(d[0],d[1],d[2],'#d4fff2',1.4);face(d[0],d[2],d[3],'#2bdeab',1.3);
    function inlay(x,y) {
      const width=y<.78 ? .084-(y-.31)*.077 : .048*(1-y)/.22;
      const ridge=y<.78 ? .042-(y-.31)*.034 : .026*(1-y)/.22;
      return [x,y,sign*(.0018+ridge*(1-Math.min(1,Math.abs(x)/width)))];
    }
    function etch(x0,y0,x1,y1,width,col) {
      const a=inlay(x0-width,y0),b=inlay(x0+width,y0),c=inlay(x1+width,y1),d=inlay(x1-width,y1);
      face(a,b,c,col);face(a,c,d,col);
    }
    // Layers of gilded and lacquered engraving travel on the actual blade,
    // including the end-on giant during its landing.
    for(const side of [-1,1]){
      etch(side*.030,.34,side*.009,.81,.003,'#d6b76d');
      etch(side*.024,.34,side*.006,.81,.0022,'#184552');
    }
    for(let i=0;i<5;i++){
      const y=.35+i*.074,inset=.016-i*.0016;
      etch(-inset,y,0,y+.019,.004,'#344e51');etch(0,y+.019,inset,y+.027,.004,'#e4bf68');
      etch(inset,y+.028,0,y+.044,.004,'#775e35');
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeBoundingSphere();
  return geo;
}

function astralChart(paint,crown) {
  return paint(768,768,(g,w,h)=>{
    g.translate(w/2,h/2);g.strokeStyle=crown?'#ffe4a3':'#a8f7f5';g.fillStyle=g.strokeStyle;
    const disk=r=>{g.beginPath();g.arc(0,0,r,0,TAU);g.stroke();};
    for(const [r,weight] of [[341,2],[331,4],[304,1],[261,2],[252,1]]){g.lineWidth=weight;disk(r);}
    for(let i=0;i<72;i++) {
      g.save();g.rotate(i*TAU/72);g.fillRect(-1.1,-328,2.2,i%6===0?22:i%3===0?12:5);
      if(i%6===0){g.beginPath();g.moveTo(0,-349);g.lineTo(-4,-340);g.lineTo(0,-334);g.lineTo(4,-340);g.closePath();g.fill();}
      g.restore();
    }
    const words=crown?'萬劍朝宗御氣凌霄':'天樞天璇天璣天權玉衡開陽搖光'.match(/../g);
    const labels=crown?[...words]:words;
    g.font='bold 24px "Kaiti SC",KaiTi,serif';g.textAlign='center';g.textBaseline='middle';
    labels.forEach((v,i)=>{g.save();g.rotate(TAU*i/labels.length);g.fillText(v,0,-282);g.restore();});
    if(crown){
      for(let i=0;i<12;i++){g.save();g.rotate(i*TAU/12);g.beginPath();g.moveTo(0,-246);g.lineTo(-10,-217);g.lineTo(0,-186);g.lineTo(10,-217);g.closePath();g.lineWidth=2;g.stroke();g.restore();}
      g.setLineDash([5,9]);disk(177);g.setLineDash([]);
    }else{
      const dots=[[-189,60],[-135,21],[-73,4],[-9,16],[35,-68],[153,-62],[131,39]];
      for(const [a,b] of joins){g.beginPath();g.moveTo(...dots[a]);g.lineTo(...dots[b]);g.lineWidth=3;g.stroke();}
      for(const [x,y] of dots){g.beginPath();g.arc(x,y,7,0,TAU);g.fill();g.beginPath();g.arc(x,y,14,0,TAU);g.lineWidth=1.5;g.stroke();}
    }
  });
}

// One strip batch for the wakes of the entire sword formation. Sample its
// measured flight path backwards, so the trails bend through both banked turns.
function wakes(fx,count,steps,tint) {
  const geometry=fx.own(new THREE.BufferGeometry());
  const total=count*steps*2, xyz=new Float32Array(total*3), rgba=new Float32Array(total*4), idx=[];
  const color=new THREE.Color(tint);
  for(let i=0;i<count;i++)for(let j=0;j<steps;j++){
    const base=(i*steps+j)*2;
    for(const k of [base,base+1]){rgba.set([color.r,color.g,color.b,0],k*4);}
    if(j+1<steps)idx.push(base,base+1,base+2,base+1,base+3,base+2);
  }
  const pos=new THREE.BufferAttribute(xyz,3).setUsage(THREE.DynamicDrawUsage);
  const colors=new THREE.BufferAttribute(rgba,4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',pos);geometry.setAttribute('color',colors);geometry.setIndex(idx);
  const material=fx.own(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
    blending:THREE.AdditiveBlending,toneMapped:false}));
  const sheet=new THREE.Mesh(geometry,material);sheet.frustumCulled=false;fx.group.add(sheet);
  const p=point(),previous=point(),normal=point(),view=point(0,.22,1).normalize();
  return function update(t,sample,visible,span,width){
    for(let i=0;i<count;i++){
      const alpha=visible(i,t);
      if(alpha>0) sample(i,t+.012,previous);
      for(let j=0;j<steps;j++){
        const k=(i*steps+j)*2,u=j/(steps-1);
        rgba[k*4+3]=rgba[(k+1)*4+3]=alpha*(1-u)**1.4;
        if(!alpha)continue;
        sample(i,t-span*u,p);
        normal.copy(p).sub(previous).cross(view).normalize().multiplyScalar(width*(1-.72*u));
        const o=k*3;
        xyz[o]=p.x+normal.x;xyz[o+1]=p.y+normal.y;xyz[o+2]=p.z+normal.z;
        xyz[o+3]=p.x-normal.x;xyz[o+4]=p.y-normal.y;xyz[o+5]=p.z-normal.z;
        previous.copy(p);
      }
    }
    pos.needsUpdate=true;colors.needsUpdate=true;
  };
}

export function makeSwordEffects(kit) {
  const {track,basic,mesh,surface,glow,blast,sparks,scorch,feedback,arcSheet,brushStroke,ground,paint}=kit;
  const blade=makeBlade();
  const chart=astralChart(paint,false),seal=astralChart(paint,true);
  const crossGeo=new THREE.CylinderGeometry(1,1,1,5,1);
  const gemGeo=new THREE.OctahedronGeometry(1,0);
  const scratch=new THREE.Object3D(),matrix=new THREE.Matrix4(),X=point(),Y=point(),Z=point();
  const towardViewer=point(0,.22,1).normalize();
  const tip=point(),prev=point(),dir=point(),world=point();
  function batch(fx,count){
    const material=fx.own(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false}));
    const blades=fx.own(new THREE.InstancedMesh(blade,material,count));
    blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);blades.frustumCulled=false;fx.group.add(blades);return blades;
  }
  function place(blades,i,p,d,size,roll=0){
    Y.copy(d).normalize();
    if(Y.lengthSq()<.01)Y.set(0,1,0);
    X.crossVectors(Y,towardViewer);
    if(X.lengthSq()<.001)X.set(1,0,0);else X.normalize();
    Z.crossVectors(X,Y);matrix.makeBasis(X,Y,Z);
    scratch.quaternion.setFromRotationMatrix(matrix);scratch.rotateY(roll);
    scratch.position.copy(p);scratch.scale.setScalar(Math.max(.0001,size));scratch.updateMatrix();
    blades.setMatrixAt(i,scratch.matrix);
  }
  function swipe(from,to,strong){
    const start=from.clone(),end=to.clone().add(point(0,1.1,0));
    if(strong)start.y+=1.2;
    const path=(i,t,out)=>{
      const u=THREE.MathUtils.clamp(t/.26,0,1);
      return out.lerpVectors(start,end,u).addScaledVector(Y_UP,Math.sin(u*Math.PI)*(.5+i*.2))
        .addScaledVector(across,(i-(strong?1:0))*Math.sin(Math.PI*u)*.43);
    };
    const across=point().subVectors(end,start).cross(Y_UP).normalize();
    track(.40,fx=>{
      const n=strong?3:1,blades=batch(fx,n),wake=wakes(fx,n,8,strong?'#bbffe0':'#7ae8ee');
      fx.step=t=>{
        if(t<.26){end.copy(to);end.y+=1.1;}
        for(let i=0;i<n;i++){
          path(i,t,tip);path(i,t-.015,prev);dir.subVectors(tip,prev);
          place(blades,i,tip,dir,(strong?1.16:.92)*(1-smooth(.24,.35,t)));
        }
        blades.instanceMatrix.needsUpdate=true;
        wake(t,path,()=>.72*(1-smooth(.25,.39,t)),.13,strong?.064:.037);
      };
    });
  }
  const Y_UP=point(0,1,0);

  // Inlaid fracture lines on the floor burst outward only when the final
  // sword meets the paving. The ink under each hot edge keeps it legible on
  // dark wet stones and on the altar's already bright brass circle.
  function fractures(fx,tint) {
    const xyz=[],colors=[];
    function stroke(a,b,width,color,lift) {
      const dx=b[0]-a[0],dz=b[1]-a[1],r=width/Math.max(.001,Math.hypot(dx,dz));
      const x=-dz*r,z=dx*r;
      const quad=[[a[0]-x,lift,a[1]-z],[a[0]+x,lift,a[1]+z],
        [b[0]+x,lift,b[1]+z],[b[0]-x,lift,b[1]-z]];
      const c=new THREE.Color(color);
      for(const k of [0,1,2,0,2,3]) {xyz.push(...quad[k]);colors.push(c.r,c.g,c.b);}
    }
    for(let i=0;i<13;i++){
      let p=[0,0];const a=TAU*i/13+.17*Math.sin(i*7);
      for(let j=1;j<=5;j++){
        const radius=j*(.62+.29*(.5+.5*Math.sin(i*2.1))),bend=a+.075*Math.sin(i*3+j*2);
        const q=[radius*Math.cos(bend),radius*Math.sin(bend)];
        stroke(p,q,.105*(1-j*.09),'#3b332c',.071);
        stroke(p,q,.039*(1-j*.12),tint,.076);
        if(j===3){
          const branch=[q[0]+.79*Math.cos(a+.67),q[1]+.79*Math.sin(a+.67)];
          stroke(q,branch,.020,tint,.076);
        }
        p=q;
      }
    }
    const geometry=fx.own(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const material=basic(fx,0xffffff,false);material.vertexColors=true;
    const lines=mesh(fx.group,geometry,material,0,0,0);lines.renderOrder=3;return lines;
  }

  function thunder(target,onStrike=()=>{},yaw=0) {
    const center=target.clone();center.y=0;
    feedback('chime',.7);
    track(3.44,fx=>{
      fx.group.position.copy(center);fx.group.rotation.y=yaw;
      const deck=surface(fx,fx.group,point(0,.055,0),9.4,chart,0xb9faff);
      const blades=batch(fx,7),wake=wakes(fx,7,12,'#70edff');
      const stars=dipper.map(p=>{const g=glow(fx,fx.group,point(...p),0xb8efff);g.scale.setScalar(.76);return g;});
      const starGems=dipper.map(p=>mesh(fx.group,gemGeo,basic(fx,0xffdda0),...p,.068,.068,.068));
      const linkMat=basic(fx,0x98dbf9);
      const links=joins.map(([a,b])=>{
        const u=point(...dipper[a]),v=point(...dipper[b]),mid=u.clone().lerp(v,.5);
        const o=mesh(fx.group,crossGeo,linkMat,mid.x,mid.y,mid.z,.012,u.distanceTo(v),.012);
        o.quaternion.setFromUnitVectors(Y_UP,v.sub(u).normalize());return o;
      });
      const arcs=Array.from({length:3},(_,i)=>{
        const arc=mesh(fx.group,fx.own(arcSheet(3.5+i*.36,2.75)),basic(fx,i===1?0xe6bd7c:0x8bdcfc,true,brushStroke),0,.95+i*.13,0);
        arc.rotation.z=(i-1)*.24;return arc;
      });
      function flight(i,t,out){
        const original=dipper[i],a=TAU*i/7;
        const emerge=smooth(i*.035,.52+i*.035,t),orbit=smooth(.75,1.28,t);
        const collapse=smooth(2.12,2.57,t),release=smooth(2.58,2.91,t);
        const phase=a+(t-.85)*4.6;
        const radius=(2.95+.36*Math.sin(t*5+i))*(1-collapse)+release*3.8;
        out.set(Math.cos(phase)*radius,.86+.54*Math.sin(phase+.4)+.34*i/7,Math.sin(phase)*radius);
        out.y=THREE.MathUtils.lerp(out.y,.18+release*.62,collapse);
        out.x=THREE.MathUtils.lerp(original[0],out.x,orbit);
        out.y=THREE.MathUtils.lerp(original[1]*emerge,out.y,orbit);
        out.z=THREE.MathUtils.lerp(original[2],out.z,orbit);return out;
      }
      let beat=0;
      fx.step=t=>{
        const fade=1-smooth(2.79,3.43,t),lit=smooth(0,.33,t);
        deck.material.opacity=lit*fade*.85;deck.rotation.z=-.16+t*.12;
        const sky=lit*(1-smooth(.80,1.40,t));linkMat.opacity=sky*.94;
        for(const o of links)o.visible=sky>.007;
        for(let i=0;i<7;i++){
          flight(i,t,tip);flight(i,t-.017,prev);dir.subVectors(tip,prev);
          const orbit=smooth(.82,1.16,t);
          dir.normalize().multiplyScalar(orbit);dir.y+=1-orbit;
          place(blades,i,tip,dir,(1.75+.20*Math.sin(i))*smooth(i*.032,.41+i*.03,t)*fade);
          stars[i].position.y=dipper[i][1]*smooth(i*.035,.52+i*.035,t);
          starGems[i].position.y=stars[i].position.y;
          stars[i].material.opacity=sky*.87;starGems[i].material.opacity=sky;
        }
        blades.instanceMatrix.needsUpdate=true;wake(t,flight,()=>smooth(.85,1.12,t)*fade*.87,.22,.103);
        arcs.forEach((arc,i)=>{
          arc.rotation.y=t*(4.4+i*.3)+i*2.1;
          arc.material.opacity=smooth(.95,1.2,t)*fade*(.34+.33*Math.sin(t*6+i)**2);
          arc.scale.setScalar(1-.66*smooth(2.16,2.57,t)+.88*smooth(2.58,2.86,t));
        });
        while(beat<rBeats.length && t>=rBeats[beat] && !fx.dead){
          const final=beat++===rBeats.length-1;
          blast(center,final?0xffd88b:0x83e2ff,final?5.7:3.9,final?.72:.43);
          world.copy(center);world.y+=final?.35:.85;
          sparks(world,final?94:30,final?0xffdd91:0x98ecff,final?6.6:3.9,final?.86:.54,6);
          feedback(final?'slash':'chime',final?.96:.64);
          onStrike(center.clone(),final);
        }
      };
    });
  }

  function summon(target,onStrike=()=>{},yaw=0) {
    const center=target.clone();center.y=0;
    feedback('gong',.55);
    track(4.35,fx=>{
      fx.group.position.copy(center);fx.group.rotation.y=yaw;
      const deck=surface(fx,fx.group,point(0,.065,0),10.7,seal,0xffd082);
      const gateGroup=new THREE.Group();gateGroup.position.set(0,3.1,-2.85);gateGroup.rotation.x=-.09;fx.group.add(gateGroup);
      const gate=mesh(gateGroup,ground,basic(fx,0xffcf70,true,seal),0,0,0,6.5,6.5);
      const inner=mesh(gateGroup,ground,basic(fx,0x72dec4,true,chart),0,0,.045,3.87,3.87);
      const gateHeart=glow(fx,gateGroup,point(0,0,.06),0xa6ffe0);gateHeart.scale.set(1.7,2.0,1);
      const total=42,blades=batch(fx,total+1),wake=wakes(fx,total,8,'#8dffe6');
      const starts=[],falls=[],launches=[],ends=[];
      const radial=point(),tangent=point(),fromBank=new THREE.Quaternion(),toBank=new THREE.Quaternion();
      for(let i=0;i<total;i++){
        const layer=Math.floor(i/14),a=(i%14)*TAU/14+layer*.12,r=1.36+layer*.69;
        starts.push(point(Math.cos(a)*r,3.18+Math.sin(a)*r,-2.67-layer*.10));
        const b=a+1.13+layer*.65,impactRadius=.66+(i%5)*.46;
        ends.push(point(Math.cos(b)*impactRadius,.12,Math.sin(b)*impactRadius));
        falls.push(point(Math.cos(a+.50)*(r+2.1),4.70+layer*1.1+Math.sin(a)*1.53,Math.sin(a+.5)*2.8+.23));
        launches.push(qBeats[layer]-.57-(i%3)*.055);
      }
      const travel=(i,t,out)=>{
        const s=starts[i],f=falls[i],e=ends[i],l=launches[i],arrival=qBeats[Math.floor(i/14)]-.028*(i%3);
        const u=smooth(l,arrival,t);
        const inv=1-u;
        out.set(inv*inv*s.x+2*inv*u*f.x+u*u*e.x,inv*inv*s.y+2*inv*u*f.y+u*u*e.y,inv*inv*s.z+2*inv*u*f.z+u*u*e.z);
        if(t<l)out.y-=.58*(1-smooth(.04,.62,t));
        return out;
      };
      const giants=glow(fx,fx.group,point(0,1.2,0),0xffdf95);
      const cracks=fractures(fx,'#ffcf72');
      const crownBlades=batch(fx,12);
      const bladesong=Array.from({length:4},(_,i)=>{
        const o=mesh(fx.group,fx.own(arcSheet(4.45+i*.19,2.21)),basic(fx,i%2?0xf9cf75:0x8ae9c6,true,brushStroke),0,.64,0);
        o.rotation.z=.17*(i-1.5);return o;
      });
      let beat=0;
      fx.step=t=>{
        const lit=smooth(.03,.61,t),fade=1-smooth(3.43,4.32,t);
        const gateLight=lit*(1-smooth(2.44,3.22,t));gate.material.opacity=gateLight*.9;
        gate.rotation.z=.12*t;inner.rotation.z=-.31*t+.16;inner.material.opacity=gateLight*.54;
        gateHeart.material.opacity=gateLight*(.46+.16*Math.sin(t*6));
        deck.material.opacity=lit*fade*(.7+.10*Math.sin(t*5));
        const spread=10.7*(.77+.23*lit+.17*smooth(3.12,3.49,t));
        deck.scale.set(spread,spread,1);deck.rotation.z=t*.18;
        for(let i=0;i<total;i++){
          travel(i,t,tip);
          // Turn out of the gate before launch and follow the curve's tangent
          // through arrival. A finite difference became zero at both endpoints.
          const u=smooth(launches[i],qBeats[Math.floor(i/14)]-.028*(i%3),t);
          radial.set(starts[i].x,starts[i].y-3.15,.27).normalize();
          tangent.subVectors(falls[i],starts[i]).multiplyScalar(1-u);
          dir.subVectors(ends[i],falls[i]).multiplyScalar(u).add(tangent).normalize();
          fromBank.setFromUnitVectors(Y_UP,radial);toBank.setFromUnitVectors(Y_UP,dir);
          fromBank.slerp(toBank,smooth(launches[i]-.24,launches[i]+.09,t));
          dir.copy(Y_UP).applyQuaternion(fromBank);
          const appear=smooth(.06+(i%7)*.045,.54+(i%7)*.045,t);
          const shrink=1-smooth(qBeats[Math.floor(i/14)]+.04,qBeats[Math.floor(i/14)]+.28,t);
          place(blades,i,tip,dir,appear*shrink*(.94+.18*Math.floor(i/14)),.16*Math.sin(i));
        }
        wake(t,travel,(i,age)=>smooth(launches[i],launches[i]+.17,age)*(1-smooth(qBeats[Math.floor(i/14)],qBeats[Math.floor(i/14)]+.18,age))*.95,.24,.058);
        const build=smooth(1.58,2.47,t),drop=smooth(2.76,3.12,t);
        const poise=smooth(1.95,2.74,t);
        tip.set((.20+.52*poise)*(1-drop),(3.85+1.02*poise)*(1-drop)-.23*drop,-1.3*(1-drop));
        dir.set(-.11-.47*(1-poise),-1,.065);
        const swordSize=build*(1-smooth(3.71,4.27,t))*5.15;
        place(blades,total,tip,dir,swordSize,.12);blades.instanceMatrix.needsUpdate=true;
        giants.position.copy(tip);giants.position.y=Math.max(.34,tip.y);
        const burst=smooth(3.055,3.14,t)*(1-smooth(3.14,3.79,t));
        giants.scale.set(1+burst*6.7,.68+burst*2.8,1);giants.material.opacity=build*fade*(.38+burst*.61);
        const impact=smooth(3.10,3.40,t),after=1-smooth(3.60,4.28,t);
        cracks.visible=t>3.10;cracks.scale.setScalar(.065+impact*1.52);cracks.material.opacity=after;
        crownBlades.visible=impact>0 && after>0;
        if(crownBlades.visible){
          for(let i=0;i<12;i++){
            const a=i*TAU/12+.18*impact,rad=1.05+3.32*impact;
            const nx=Math.cos(a),nz=Math.sin(a);
            tip.set(nx*rad,.25+Math.sin(impact*Math.PI)*.85+impact*.42,nz*rad);
            dir.set(nx*.61,.83,nz*.61);
            place(crownBlades,i,tip,dir,impact*after*(i%2===0?1.45:1.02));
          }
          crownBlades.instanceMatrix.needsUpdate=true;
        }
        bladesong.forEach((o,i)=>{
          const u=smooth(3.06,3.80,t);o.visible=t>3.065;o.scale.setScalar(.23+u*1.37);o.rotation.y=i*TAU/4+u*2.37;
          o.material.opacity=smooth(3.065,3.15,t)*(1-smooth(3.34,4.07,t))*.87;
        });
        while(beat<qBeats.length && t>=qBeats[beat] && !fx.dead){
          const final=beat++===qBeats.length-1;
          blast(center,final?0xffcf73:0x84f1c9,final?7.35:3.1+beat*.6,final?.85:.48);
          sparks(center,final?132:36,final?0xffd481:0xb2ffe9,final?8.1:4.0,final?1.18:.64,8);
          if(final){scorch(center,3.75);feedback('gong',1.05);feedback('slash',1.15);}
          else feedback('chain',.55);
          onStrike(center.clone(),final);
        }
      };
    });
  }
  function prepare(renderer){renderer.initTexture(chart);renderer.initTexture(seal);}
  return {mark:(from,to)=>swipe(from,to,false),chain:(from,to)=>swipe(from,to,true),thunder,summon,prepare};
}
