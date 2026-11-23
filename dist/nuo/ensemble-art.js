// Painted surfaces and carved insignia used by the figures on the courtyard stage.
import * as T from '../vendor/three.module.js';
import {rng,clamp} from './form.js';

const pigments={
  priest:['#bd896c','#d3a286','#ad7157','#9e7059'],
  thunder:['#526d66','#a89161','#b9663d','#263c40'],
  ward:['#85978a','#d6bd83','#af593a','#455c54'],
  judge:['#9d3d2a','#f4b26b','#e49558','#612c23'],
  corpse:['#929886','#c5b995','#746c52','#5c685f'],
  black:['#505553','#b2a080','#986448','#333a3c'],
  white:['#d8ccaf','#f2e1bb','#a45842','#b2a792']
};
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function texture(width,height,paint){
  const c=document.createElement('canvas');c.width=width;c.height=height;
  paint(c.getContext('2d'),width,height);const t=new T.CanvasTexture(c);
  t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
export function recolor(material,color,roughness=material.roughness){
  const m=material.clone();m.color.set(color);m.roughness=roughness;return m;
}
export function faceMaterial(role,palette){
  const [base,edge,,shadow]=pigments[role].map(rgb),random=rng(618+role.length*19+role.charCodeAt(0));
  const map=texture(640,512,(g,w,h)=>{
    const grids=[8,23,67].map(n=>({n,a:Float32Array.from({length:(n+1)**2},()=>random())}));
    const field=(grid,u,v)=>{
      const {a,n}=grid,x=u*n,y=v*n,i=Math.floor(x),j=Math.floor(y)*(n+1);
      let s=x-i,t=y-Math.floor(y);s=s*s*(3-2*s);t=t*t*(3-2*t);
      return (a[i+j]*(1-s)+a[i+j+1]*s)*(1-t)+(a[i+j+n+1]*(1-s)+a[i+j+n+2]*s)*t;
    };
    const im=g.createImageData(w,h);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const u=i/w,v=j/h,lo=field(grids[0],u,v),mid=field(grids[1],u,v),hi=field(grids[2],u,v);
      const grain=random(),fiber=Math.sin(i*(role==='white'?1.4:.79)+4*Math.sin(j*.029)+24*lo);
      const tarnish=clamp((.32*lo+.34*mid+.27*hi+.07*grain-.48)*3);
      const p=blend(blend(base,shadow,.44*(1-lo)),edge,tarnish*(role==='white'?.3:.55));
      const v0=(grain-.5)*13+fiber*(role==='corpse'?5:2.8);
      const k=(j*w+i)*4;im.data[k]=p[0]+v0;im.data[k+1]=p[1]+v0*.9;im.data[k+2]=p[2]+v0*.75;im.data[k+3]=255;
    }
    g.putImageData(im,0,0);
    for(let i=0;i<(role==='priest'?0:190);i++){
      const x=random()*w,y=random()*h;g.beginPath();g.moveTo(x,y);const length=random()*(role==='white'?30:13);
      g.lineTo(x+length*.25,y+length);g.lineTo(x+length*.18,y+length*1.27);
      g.strokeStyle=role==='white'?'rgba(106,75,52,.20)':'rgba(42,36,25,.18)';g.lineWidth=.4+random()*.9;g.stroke();
    }
  });
  const m=palette.mask.clone();m.map=map;m.roughnessMap=null;m.bumpMap=map;m.bumpScale=role==='priest'?.000045:.00013;
  m.roughness=({priest:.79,thunder:.53,ward:.72,judge:.57,corpse:.88,black:.54,white:.85})[role];
  m.metalness=({thunder:.29,black:.35})[role]||.025;return m;
}
const stamps=new Map();
export function inscription(text,base,ink,style='tablet'){
  const key=[text,base,ink,style].join('/');if(stamps.has(key))return stamps.get(key);
  const paper=style==='paper',round=style==='medal';
  const map=texture(round?384:192,round?384:512,(g,w,h)=>{
    const random=rng(text.charCodeAt(0));g.fillStyle=base;g.fillRect(0,0,w,h);
    for(let i=0;i<13000;i++){g.fillStyle=i%2?'rgba(44,36,25,.08)':'rgba(240,221,165,.13)';g.fillRect(random()*w,random()*h,.4+random()*1.7,1+random()*7);}
    g.strokeStyle=ink;g.fillStyle=ink;g.lineWidth=round?4:3;
    if(round){for(const r of [.46,.425,.34]){g.beginPath();g.arc(w/2,h/2,w*r,0,Math.PI*2);g.stroke();}
      for(let i=0;i<32;i++){const a=i*Math.PI/16;g.save();g.translate(w/2,h/2);g.rotate(a);g.beginPath();g.moveTo(0,-h*.42);g.lineTo(0,-h*.375);g.lineTo(9,-h*.375);g.stroke();g.restore();}
    }else{
      g.strokeRect(w*.08,h*.035,w*.84,h*.93);g.lineWidth=1.2;g.strokeRect(w*.115,h*.052,w*.77,h*.897);
      for(const x of [.16,.84])for(const y of [.08,.92]){g.beginPath();g.arc(w*x,h*y,3,0,Math.PI*2);g.fill();}
    }
    g.textAlign='center';g.textBaseline='middle';
    const chars=[...text],top=round?.23:paper?.15:.12,bottom=round?.77:paper?.76:.88;
    const step=h*(bottom-top)/chars.length;g.font='bold '+Math.floor(Math.min(w*(round?.46:.64),step*1.08))+'px "Kaiti SC", STKaiti, KaiTi, serif';
    chars.forEach((c,i)=>g.fillText(c,w*.5,h*top+step*(i+.51),w*.75));
    if(paper){g.strokeStyle='#9c382b';g.lineWidth=3;g.strokeRect(w*.39,h*.78,w*.31,h*.12);g.font='bold 30px STKaiti,serif';g.fillStyle='#9e392c';g.fillText('敕',w*.55,h*.843);}
  });
  const m=new T.MeshStandardMaterial({map,side:T.DoubleSide,roughness:paper?.87:.62,metalness:style==='tablet'?.14:.03});
  stamps.set(key,m);return m;
}
export const cast={
  sword:{name:'剑诀天师',detail:'黑漆木傩面 · 七星剑匣',action:'起剑',size:1,close:[1.791,.89],body:1.43,tint:'#805943'},
  thunder:{name:'雷法天师',detail:'青铜雷公面 · 五方雷牌',action:'开雷令',size:.011,close:[1.77,.94],body:1.01,tint:'#59786f'},
  ward:{name:'镇坛天师',detail:'石青狮面 · 镇坛方印',action:'托印镇坛',size:.0108,close:[1.725,.96],body:1.00,tint:'#87937e'},
  judge:{name:'钟馗',detail:'朱漆判相 · 翼帽虬髯',action:'提剑镇鬼',size:.0121,close:[1.958,1.22],body:1.16,tint:'#a04d3b'},
  corpse:{name:'跳僵',detail:'灰蜡尸面 · 额间镇符',action:'僵步前跃',size:.0105,close:[1.665,.93],body:1.04,tint:'#80856e'},
  black:{name:'黑无常',detail:'乌铁皂面 · 拘魂锁',action:'扬锁拘魂',size:.0113,close:[1.855,1.12],body:1.06,tint:'#555b5b'},
  white:{name:'白无常',detail:'纸胎白面 · 招魂长幡',action:'举幡引魂',size:.0114,close:[1.925,1.39],body:1.17,tint:'#cbc3aa'},
  priest:{name:'一眉道长',detail:'黄缎八卦袍 · 桃木剑与三清铃',action:'踏罡封符',size:.0112,close:[1.81,1.08],body:1.08,tint:'#c99b41'}
};

// Threadwork stays on a curved chest panel, lit along with the rest of the coat.
export function embroideredBadge(id,background,thread){
  const key=id+'-brocade';if(stamps.has(key))return stamps.get(key);
  const map=texture(512,420,(g,w,h)=>{
    const random=rng(id.charCodeAt(1)*31);g.fillStyle=background;g.fillRect(0,0,w,h);
    const line=(path,color=thread,lw=2)=>{g.strokeStyle=color;g.lineWidth=lw;g.stroke(new Path2D(path));};
    g.strokeStyle=thread;for(const v of [9,16,29]){g.lineWidth=v===16?3:1.7;g.strokeRect(v,v,w-2*v,h-2*v);}
    for(let i=0;i<14;i++){const x=34+i*32;line('M'+x+' 25v-12h18v7h-8');line('M'+x+' 395v12h18v-7h-8');}
    g.save();g.translate(256,210);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;g.save();g.rotate(a);line('M0 -135 q14 -21 29 -6 q4 8 -4 11 q-5 2 -7 -3',thread,1.9);g.restore();}
    if(id==='corpse'||id==='thunder'||id==='white'){
      // A crane in profile, one wing lifted above its tail.
      line('M-73 58 Q-23 68 18 24 Q59 -14 37 -57 Q19 -91 46 -102 Q67 -108 74 -92 L119 -84 L74 -83 Q53 -93 56 -74 Q84 -24 37 35 Q-7 83 -73 58 Z',thread,5);
      for(let i=0;i<6;i++){const x=-109+i*12,y=-81+i*9;line('M19 20 Q-29 -61 '+x+' '+y+' Q-61 -25 -38 18 Q-12 41 15 31',thread,2.4);}
      line('M-30 66l-24 30 9 13 M-18 64l-12 37 17 3',thread,3);
    }else{
      // Paired brows and curling mane of the guardian beast.
      for(const sign of [-1,1]){g.save();g.scale(sign,1);
        line('M3 -86 Q38 -104 58 -69 Q94 -98 108 -68 Q105 -34 80 -25 Q108 3 87 23 Q72 25 61 46 Q54 78 12 87',thread,4.1);
        line('M8 -17 Q28 -47 64 -43 Q53 -21 39 -15 Q25 -6 13 -11 M10 3 Q27 -8 37 6 Q49 25 30 32 Q16 37 7 22 M8 45 Q32 55 54 34',thread,3.5);
        for(let j=0;j<4;j++){g.save();g.translate(72+j*2,-46+j*22);g.rotate(j*.27);line('M-7 -8 Q15 -20 19 -4 Q23 12 8 14 Q-4 13 2 6 Q6 2 9 7',thread,2.5);g.restore();}
        g.restore();}
    }
    g.restore();for(let i=0;i<4500;i++){g.fillStyle=i%2?'rgba(32,27,20,.15)':'rgba(243,215,147,.12)';g.fillRect(random()*w,random()*h,random()*3+.4,.75);}
  });
  const m=new T.MeshStandardMaterial({map,roughness:.77,metalness:.13,side:T.DoubleSide});stamps.set(key,m);return m;
}
