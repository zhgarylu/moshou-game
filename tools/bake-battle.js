// Browser-side asset build. The runner serves Three r170, its GLTFExporter and meshoptimizer locally.
import * as T from '/vendor/three.module.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {MeshoptSimplifier} from 'meshoptimizer';
import {palette} from '/nuo/materials.js';
import {makeSwordswoman} from '/nuo/figure.js';
import {makeEnsembleFigure} from '/nuo/ensemble-body.js';

const heights={thunder:2.14,sword:2.04,ward:2.16,corpse:2.12,black:2.32,white:2.56,judge:6,priest:2.64};
const view=new T.WebGLRenderer({antialias:false}),paints=palette(view);
const vec=()=>new T.Vector3();
function atlas(materials){
  const cols=Math.ceil(Math.sqrt(materials.length)),step=256,side=cols*step,edge=3;
  const canvas=()=>{const c=document.createElement('canvas');c.width=c.height=side;return c;};
  const color=canvas(),orm=canvas(),ctx=color.getContext('2d'),props=orm.getContext('2d');
  const rect=new Map();
  materials.forEach((m,i)=>{
    const x=(i%cols)*step,y=Math.floor(i/cols)*step;
    ctx.fillStyle='#fff';ctx.fillRect(x,y,step,step);
    if(m.map?.image)ctx.drawImage(m.map.image,x,y,step,step);
    ctx.globalCompositeOperation='multiply';ctx.fillStyle=m.color.getStyle();ctx.fillRect(x,y,step,step);ctx.globalCompositeOperation='source-over';
    props.fillStyle='rgb(255,'+Math.round(255*m.roughness)+','+Math.round(255*m.metalness)+')';props.fillRect(x,y,step,step);
    rect.set(m,[(x+edge)/side,1-(y+step-edge)/side,(step-2*edge)/side]);
  });
  const map=new T.CanvasTexture(color),mr=new T.CanvasTexture(orm);map.colorSpace=T.SRGBColorSpace;
  return {rect,material:new T.MeshStandardMaterial({map,metalnessMap:mr,roughnessMap:mr,metalness:1,roughness:1,side:T.DoubleSide})};
}

export async function bake(id){
  await MeshoptSimplifier.ready;
  const m=await paints,figure=id==='sword'?makeSwordswoman(m):makeEnsembleFigure(m,id);
  const src=figure.root;figure.show(0);src.updateMatrixWorld(true);
  const meshes=[],bones=[],controls=[],mapping=new Map(),dynamic=new Map();
  const heightScale=heights[id]/({sword:2.02,thunder:1.98,ward:1.93,corpse:1.87,black:2.09,white:2.30,judge:2.19,priest:2.04})[id];
  const unit=src.scale.x*heightScale;
  const stage=new T.Scene(),rig=new T.Group();stage.add(rig);
  function joint(parent,name,read){
    const b=new T.Bone();b.name=name||'joint'+bones.length;parent.add(b);const i=bones.push(b)-1;
    controls.push({b,read,positions:[],rotations:[],scales:[]});read(b);return i;
  }
  src.traverse(o=>{
    if(o.isGroup){
      const parent=o===src?rig:bones[mapping.get(o.parent)];
      mapping.set(o,joint(parent,o.name,b=>{b.position.copy(o.position).multiplyScalar(unit);b.quaternion.copy(o.quaternion);if(o!==src)b.scale.copy(o.scale);}));
    }else if(o.isMesh)meshes.push(o);
  });
  for(const o of meshes){
    const parent=bones[mapping.get(o.parent)];
    if(o.isInstancedMesh){
      const ids=[],mat=new T.Matrix4();
      for(let i=0;i<o.count;i++)ids.push(joint(parent,'',b=>{o.getMatrixAt(i,mat);mat.decompose(b.position,b.quaternion,b.scale);b.position.multiplyScalar(unit);}));
      dynamic.set(o,{ids});continue;
    }
    if(!o.userData.moving)continue;
    // Bone rows follow the same sampled cloth or cord as the review rig. Vertices between rows interpolate.
    const cord=id==='sword',cols=cord?7:9,rows=o.geometry.attributes.position.count/cols;
    const ids=[],last=rows-1,count=cord?12:9;
    for(let k=0;k<count;k++){
      const j=Math.round(last*k/(count-1)),local=vec();
      ids.push(joint(parent,'',b=>{
        const p=o.geometry.attributes.position;b.position.set(0,0,0);
        for(let i=0;i<cols;i++)b.position.add(local.fromBufferAttribute(p,j*cols+i));
        b.position.multiplyScalar(1/cols).applyMatrix4(o.matrix).multiplyScalar(unit);
      }));
    }
    dynamic.set(o,{cols,rows,ids});
  }
  const mats=[...new Set(meshes.map(o=>o.material))],{rect,material}=atlas(mats);
  const pos=[],norm=[],uv=[],weights=[],joints=[],indices=[];
  const v=vec(),n=vec(),normal=new T.Matrix3();
  function append(o,matrix,bone,strip){
    const g=o.geometry,p=g.attributes.position,tex=g.attributes.uv,ns=g.attributes.normal;
    const source=g.index?Uint32Array.from(g.index.array):Uint32Array.from({length:p.count},(_,i)=>i);
    const budget=Math.min(source.length,Math.max(18,Math.floor(source.length*(strip?.72:.095)/3)*3));
    const [idx]=MeshoptSimplifier.simplify(source,p.array,3,budget,.021);
    const remap=new Map(),[x,y,s]=rect.get(o.material);normal.getNormalMatrix(matrix);
    for(const index of idx){
      let dest=remap.get(index);
      if(dest===undefined){
        dest=pos.length/3;remap.set(index,dest);
        v.fromBufferAttribute(p,index).applyMatrix4(matrix).multiplyScalar(heightScale);pos.push(v.x,v.y,v.z);
        n.fromBufferAttribute(ns,index).applyNormalMatrix(normal);norm.push(n.x,n.y,n.z);
        uv.push(x+s*T.MathUtils.clamp(tex?.getX(index)??.5,0,1),y+s*T.MathUtils.clamp(tex?.getY(index)??.5,0,1));
        if(strip){
          const a=Math.floor(index/strip.cols)/(strip.rows-1)*(strip.ids.length-1),lo=Math.floor(a),f=a-lo;
          joints.push(strip.ids[lo],strip.ids[Math.min(lo+1,strip.ids.length-1)],0,0);weights.push(1-f,f,0,0);
        }else{joints.push(bone,0,0,0);weights.push(1,0,0,0);}
      }
      indices.push(dest);
    }
  }
  for(const o of meshes){
    const data=dynamic.get(o);
    if(o.isInstancedMesh){
      const local=new T.Matrix4(),world=new T.Matrix4();
      for(let i=0;i<o.count;i++){o.getMatrixAt(i,local);append(o,world.multiplyMatrices(o.matrixWorld,local),data.ids[i]);}
    }else append(o,o.matrixWorld,mapping.get(o.parent),data);
  }
  const g=new T.BufferGeometry();g.setIndex(indices);
  for(const [attr,arr,n] of [['position',pos,3],['normal',norm,3],['uv',uv,2],['skinWeight',weights,4]])g.setAttribute(attr,new T.Float32BufferAttribute(arr,n));
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
  rig.updateMatrixWorld(true);const sk=new T.SkinnedMesh(g,material);sk.name=id+'Figure';rig.add(sk);sk.bind(new T.Skeleton(bones));
  const fps=24,times=Array.from({length:2*fps+1},(_,i)=>i/fps),q=new T.Quaternion();
  for(const t of times){
    figure.show(t);
    for(const c of controls){c.read(c.b);const {position,quaternion,scale}=c.b;c.positions.push(...position.toArray());
      if(c.rotations.length&&q.fromArray(c.rotations,c.rotations.length-4).dot(quaternion)<0)quaternion.set(-quaternion.x,-quaternion.y,-quaternion.z,-quaternion.w);
      c.rotations.push(...quaternion.toArray());c.scales.push(...scale.toArray());}
  }
  const tracks=[];
  for(const c of controls){
    for(const [prop,vals,len,Track] of [['position',c.positions,3,T.VectorKeyframeTrack],['quaternion',c.rotations,4,T.QuaternionKeyframeTrack],['scale',c.scales,3,T.VectorKeyframeTrack]]){
      if(vals.some((v,i)=>Math.abs(v-vals[i%len])>.00001))tracks.push(new Track(c.b.name+'.'+prop,times,vals));
      c.b[prop].fromArray(vals,0);
    }
  }
  const clip=new T.AnimationClip('gesture',2,tracks);clip.optimize();
  const bin=await new GLTFExporter().parseAsync(stage,{binary:true,animations:[clip]});
  console.log(id,indices.length/3+' triangles',bones.length+' bones',bin.byteLength+' bytes');
  return bin;
}
