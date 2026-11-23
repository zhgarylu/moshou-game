import * as THREE from './vendor/three.module.js';

// 3、4 号是小怪，阴差排在后面，战斗里 type>=BLACK 即为阴差。
export const PAPER = 3, FLYER = 4, BLACK = 5, WHITE = 6;
export const foes = [
  {model:'corpse',name:'跳僵',hp:70,speed:1.57},
  {model:'corpse',name:'青面毛僵',hp:100,speed:1.85},
  {model:'corpse',name:'铁甲尸魁',hp:290,speed:1.29},
  {model:'paper',name:'纸人',hp:38,speed:3.1},
  {model:'flyer',name:'飞头蛮',hp:80,speed:3.4},
  {model:'black',name:'黑无常',hp:235,speed:1.64},
  {model:'white',name:'白无常',hp:194,speed:1.48}
];
export const chargeLength=7.4, chargeHalfWidth=.85, prisonRadius=2.15;
const TAU=Math.PI*2;
function material(color,opacity=1){
  return new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
}
function add(group,geometry,mat){
  const m=new THREE.Mesh(geometry,mat);group.add(m);return m;
}
// Telegraphs belong to pooled enemies. Stagger, death and restart can dismiss them immediately.
export function makeEnvoySigns(scene){
  const sheet=new THREE.PlaneGeometry(1,1);
  const link=new THREE.TorusGeometry(.105,.026,6,14);
  const rim=new THREE.RingGeometry(.95,1,72);
  const disc=new THREE.CircleGeometry(1,64);
  const chevron=new THREE.Shape();chevron.moveTo(-.44,-.19);chevron.lineTo(0,.10);chevron.lineTo(.44,-.19);
  chevron.lineTo(.44,-.03);chevron.lineTo(0,.28);chevron.lineTo(-.44,-.03);chevron.closePath();
  const arrow=new THREE.ShapeGeometry(chevron);
  const paperMap=(()=>{
    const c=document.createElement('canvas');c.width=c.height=128;
    const g=c.getContext('2d');g.fillStyle='#efe6cd';g.fillRect(6,6,116,116);
    g.strokeStyle='#879389';g.lineWidth=4;g.strokeRect(13,13,102,102);
    g.fillStyle='#576c69';g.font='bold 76px serif';g.textAlign='center';g.textBaseline='middle';g.fillText('冥',64,67);
    g.clearRect(55,55,18,18);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
  })();
  const paper=material(0xd6ffef);paper.map=paperMap;
  const copper=material(0x99f7e0), sample=new THREE.Object3D(), up=new THREE.Vector3(0,1,0);
  function ground(group,geometry,mat,x,z,width,length,y=.075){
    const obj=add(group,geometry,mat);obj.rotation.x=-Math.PI/2;obj.position.set(x,y,z);obj.scale.set(width,length,1);return obj;
  }
  function create(type){
    const root=new THREE.Group();root.visible=false;scene.add(root);
    if(type===BLACK){
      const bed=material(0xc03432,.24),edge=material(0xff946a,.9);
      ground(root,sheet,bed,0,chargeLength*.5,chargeHalfWidth*2,chargeLength);
      for(const sign of [-1,1])ground(root,sheet,edge,sign*chargeHalfWidth,chargeLength*.5,.055,chargeLength,.09);
      for(let i=0;i<6;i++)ground(root,arrow,edge,0,.85+i*1.12,1,-1,.10);
      return {show(e,phase,u){
        root.visible=true;root.position.copy(e.origin);root.rotation.y=Math.atan2(e.attackDir.x,e.attackDir.z);
        bed.opacity=phase==='wind'?.20+.13*u:.11;edge.opacity=.68+.30*Math.sin((u*3+.1)*Math.PI)**2;
      },hide(){root.visible=false;}};
    }
    const mist=material(0x76debe,.16),ink=material(0xc9fff0,.9);
    ground(root,disc,mist,0,0,prisonRadius,prisonRadius);
    ground(root,rim,ink,0,0,prisonRadius,prisonRadius,.095);
    const orbit=new THREE.Group();root.add(orbit);
    for(let i=0;i<9;i++){
      const a=i*TAU/9,o=add(orbit,sheet,paper);
      o.position.set(prisonRadius*Math.sin(a),.25,prisonRadius*Math.cos(a));
      o.rotation.set(-1.1,a,.2);o.scale.setScalar(.34);
    }
    return {show(e,phase,u){
      root.visible=true;root.position.copy(e.anchor);
      orbit.rotation.y=u*2.8;orbit.position.y=Math.sin(Math.PI*u)*.26;
      mist.opacity=phase==='wind'?.10+.23*u:.08;ink.opacity=.69+.30*u;
    },hide(){root.visible=false;}};
  }
  const chain=new THREE.InstancedMesh(link,copper,42);
  chain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);chain.frustumCulled=false;chain.visible=false;scene.add(chain);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),dir=new THREE.Vector3(),orient=new THREE.Quaternion();
  function tether(source,player,time){
    if(!source){chain.visible=false;return;}
    a.copy(source).y+=1.2;b.copy(player).y+=.98;dir.subVectors(b,a);
    const distance=dir.length(),count=Math.min(42,Math.max(2,Math.ceil(distance/.19)));
    dir.normalize();orient.setFromUnitVectors(up,dir);
    for(let i=0;i<count;i++){
      const u=i/(count-1);
      sample.position.lerpVectors(a,b,u);sample.position.y+=Math.sin(u*Math.PI)*(-.27+.07*Math.sin(time*12));
      sample.quaternion.copy(orient);sample.rotateY(i%2?1.04:0);sample.scale.set(.7,1.25,.7);
      sample.updateMatrix();chain.setMatrixAt(i,sample.matrix);
    }
    chain.visible=true;chain.count=count;chain.instanceMatrix.needsUpdate=true;
  }
  return {create,tether};
}
