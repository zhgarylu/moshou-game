import * as T from '../vendor/three.module.js';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';

export const tau=Math.PI*2, V=(x,y,z)=>new T.Vector3(x,y,z);
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export function sample(values,t){
  const p=clamp(t)*(values.length-1),i=Math.floor(p);
  return mix(values[i],values[Math.min(i+1,values.length-1)],p-i);
}
export function rng(seed){return ()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);}
export function group(parent,x=0,y=0,z=0){
  const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;
}
export function part(parent,geo,material){
  const m=new T.Mesh(geo,material);parent.add(m);return m;
}
const sphere=new T.SphereGeometry(1,32,20);
export function oval(g,mat,p,r,rot=[0,0,0]){
  const m=part(g,sphere,mat);m.position.set(...p);m.scale.set(...r);m.rotation.set(...rot);return m;
}
export function surface(nx,ny,fn,flip=false){
  const pos=[],uv=[],idx=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const u=i/nx,v=j/ny,p=fn(u,v);pos.push(p.x,p.y,p.z);uv.push(u,v);
    if(i<nx && j<ny){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;idx.push(...(flip?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
export function stroke(g,mat,points,radius,steps=24,sides=7){
  const curve=new T.CatmullRomCurve3(points.map(p=>p.isVector3?p:V(...p)),false,'centripetal');
  const frames=curve.computeFrenetFrames(steps,false);
  const rings=Array.from({length:steps+1},(_,i)=>curve.getPointAt(i/steps));
  return part(g,surface(sides,steps,(u,v)=>{
    const i=Math.round(v*steps),r=typeof radius==='function'?radius(v):radius;
    return rings[i].clone().addScaledVector(frames.normals[i],Math.cos(u*tau)*r)
      .addScaledVector(frames.binormals[i],Math.sin(u*tau)*r);
  }),mat);
}
// y, horizontal radius, depth, center offset in z.
export function ringPoint(rows,t,a,fold=0){
  const p=clamp(t)*(rows.length-1),i=Math.min(rows.length-2,Math.floor(p)),k=p-i;
  const [y,rx,rz,cz]=rows[i].map((v,j)=>mix(v,rows[i+1][j],k));
  const w=fold*(Math.sin(a*9+.033*y)+.55*Math.cos(a*14-.024*y));
  return V((rx+w)*Math.sin(a),y,cz+(rz+w)*Math.cos(a));
}
export function rings(g,mat,rows,fold=0,segments=80){
  return part(g,surface(segments,(rows.length-1)*3,(u,v)=>ringPoint(rows,v,u*tau,fold)),mat);
}
export function bar(g,mat,x,y,z,w,h,d,angle=0){
  const m=part(g,new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.z=angle;return m;
}
export function batch(g){
  // Keep joint pivots and animated children intact, merge their rigid surfaces locally.
  for(const c of [...g.children]) if(c.isGroup)batch(c);
  const sets=new Map();
  for(const c of g.children)if(c.isMesh&&!c.userData.moving){
    const set=sets.get(c.material)||[];set.push(c);sets.set(c.material,set);
  }
  for(const [material,children] of sets){
    if(children.length<2)continue;
    const sources=children.map(c=>{c.updateMatrix();return c.geometry.clone().applyMatrix4(c.matrix);});
    const geo=mergeGeometries(sources);sources.forEach(s=>s.dispose());
    if(geo){children.forEach(c=>g.remove(c));part(g,geo,material);}
  }
}
