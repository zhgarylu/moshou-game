import * as T from '../vendor/three.module.js';
import {rng} from './form.js';

function canvasTexture(width,height,paint){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  paint(canvas.getContext('2d'),width,height);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  map.wrapS=map.wrapT=T.RepeatWrapping;return map;
}
function grain(type){
  const random=rng(type==='wood'?6154:441);
  return canvasTexture(512,512,(g,w,h)=>{
    const cloth=type==='linen';g.fillStyle=cloth?'#dad5c7':'#cec4b4';g.fillRect(0,0,w,h);
    for(let i=0;i<5200;i++){
      const y=random()*h,x=random()*w;g.strokeStyle=random()<.5?'rgba(49,33,24,.13)':'rgba(255,248,226,.26)';
      g.lineWidth=.3+random()*1.4;g.beginPath();g.moveTo(x,y);
      if(cloth)g.lineTo(x+(i%2?0:random()*13),y+(i%2?random()*17:0));
      else g.bezierCurveTo(x+2,y+4,x+Math.sin(y*.05)*4,y+13,x+Math.sin(y*.04)*6,y+11+random()*34);
      g.stroke();
    }
    if(cloth){
      for(let j=0;j<w;j+=3){g.fillStyle='rgba(43,34,31,.09)';g.fillRect(j,0,.8,h);g.fillRect(0,j,w,.7);}
    }
  });
}
export async function palette(renderer){
  const wood=grain('wood'),weave=grain('linen');
  // Broad paper-screen reflections reveal the changing planes in the black lacquer.
  const env=canvasTexture(512,256,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#77847f');grad.addColorStop(.44,'#595d59');grad.addColorStop(.55,'#232322');grad.addColorStop(1,'#302f26');g.fillStyle=grad;g.fillRect(0,0,w,h);
    for(const [x,y,rx,ry,c] of [[100,78,32,54,'#e9d7b7'],[393,84,19,59,'#b7dce2'],[272,100,10,39,'#d3aa7b']]){
      const q=g.createRadialGradient(x,y,1,x,y,rx);q.addColorStop(0,c);q.addColorStop(1,'rgba(255,255,255,0)');g.save();g.translate(x,y);g.scale(1,ry/rx);g.translate(-x,-y);g.fillStyle=q;g.fillRect(x-rx,y-rx,2*rx,2*rx);g.restore();
    }
  });env.mapping=T.EquirectangularReflectionMapping;
  const pmrem=new T.PMREMGenerator(renderer),rt=pmrem.fromEquirectangular(env);pmrem.dispose();env.dispose();
  const mk=(color,roughness,metalness=0,map=null)=>new T.MeshStandardMaterial({color,roughness,metalness,map,envMap:rt.texture,envMapIntensity:.48,side:T.DoubleSide});
  const loader=new T.TextureLoader();
  const [pigment,patina]=await Promise.all(['carved-lacquer.webp','lacquer-roughness.webp'].map(file=>loader.loadAsync(new URL(file,import.meta.url).href)));
  pigment.colorSpace=T.SRGBColorSpace;pigment.anisotropy=patina.anisotropy=8;
  const mask=mk('#ffffff',.94,.018,pigment);mask.roughnessMap=patina;mask.bumpMap=patina;mask.bumpScale=.00017;mask.envMapIntensity=.54;
  return {
    mask, lacquer:mk('#3e4441',.30,.33,wood), underside:mk('#312923',.56,.03,wood),
    raised:mk('#656058',.48,.09,wood), worn:mk('#a68253',.57,.10,wood),
    gold:mk('#bc9862',.37,.66),oldGold:mk('#806442',.48,.48),red:mk('#a34933',.45,.15,wood),
    ink:mk('#252623',.71), lips:mk('#422e27',.58,.05,wood),
    hair:mk('#302d29',.63,.012,wood),hairLight:mk('#4b4035',.59,.025,wood),
    skin:mk('#b78a70',.75),lid:mk('#966b56',.69),robe:mk('#d7ccae',.91,0,weave),
    shadowCloth:mk('#918b79',.9,0,weave),linen:mk('#adac93',.88,0,weave),lapel:mk('#354e4b',.82,0,weave),
    silk:mk('#92382c',.65,.035,weave),deepRed:mk('#60332e',.68,0,weave),
    leather:mk('#583d30',.60,.03,wood),wood:mk('#9f5936',.53,.05,wood),
    bladeEdge:mk('#c78a57',.52,.06,wood),boot:mk('#313938',.81,0,weave),binding:mk('#776044',.67,.10),
  };
}
export function eyeMaterial(side){
  const image=canvasTexture(512,192,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);grad.addColorStop(0,'#8e7261');grad.addColorStop(.48,'#c6b4a0');grad.addColorStop(1,'#a58c7b');g.fillStyle=grad;g.fillRect(0,0,w,h);
    const x=w*(side<0?.46:.54),y=h*.43,rx=86,ry=106;g.save();g.translate(x,y);g.scale(1,ry/rx);
    const iris=g.createRadialGradient(0,0,4,0,0,rx);iris.addColorStop(0,'#29231e');iris.addColorStop(.4,'#493b2b');iris.addColorStop(.71,'#756147');iris.addColorStop(.93,'#3e382e');iris.addColorStop(1,'#292c26');g.fillStyle=iris;g.beginPath();g.arc(0,0,rx,0,Math.PI*2);g.fill();
    const random=rng(34);for(let i=0;i<170;i++){const a=random()*Math.PI*2,r=38+random()*25;g.strokeStyle=i%2?'rgba(198,157,99,.23)':'rgba(36,33,29,.34)';g.beginPath();g.moveTo(r*Math.cos(a),r*Math.sin(a));g.lineTo((rx-4)*Math.cos(a+.02),(rx-4)*Math.sin(a+.02));g.stroke();}
    g.fillStyle='#181b18';g.beginPath();g.ellipse(0,0,35,38,0,0,Math.PI*2);g.fill();
    g.fillStyle='#ffecd3';g.beginPath();g.ellipse(side<0?17:-17,-20,10,9,0,0,Math.PI*2);g.fill();g.restore();
  });image.wrapS=image.wrapT=T.ClampToEdgeWrapping;
  return new T.MeshStandardMaterial({map:image,roughness:.31,side:T.DoubleSide});
}
