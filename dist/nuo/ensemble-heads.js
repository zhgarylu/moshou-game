import * as T from '../vendor/three.module.js';
import {V,tau,mix,clamp,rng,group,part,surface,oval,rings,stroke} from './form.js';
import {faceMaterial,inscription,recolor} from './ensemble-art.js';
import {priestFace} from './priest.js';
import {eyeMaterial} from './materials.js';

const width=[2.15,5.52,7.18,8.62,9.14,9.41,9.36,8.92,6.88,.24];
const front=[6.35,8.88,9.05,9.63,9.78,9.44,9.72,9.48,7.31,-.84];
const rear=[1.0,-3.8,-7.7,-9.31,-10.22,-10.63,-10.52,-9.40,-7.55,-.94];
const levels=[0,2.2,5,8,10.8,14.1,17.7,21.1,23.7,25.65];
function section(a,y){
  let i=0;while(i<levels.length-2&&y>levels[i+1])i++;
  return mix(a[i],a[i+1],clamp((y-levels[i])/(levels[i+1]-levels[i])));
}
// A monotone cubic keeps the photographed jaw and forehead rounded at each profile sample.
function portraitSection(values,y){
  let i=0;while(i<levels.length-2&&y>levels[i+1])i++;
  const slope=j=>(values[j+1]-values[j])/(levels[j+1]-levels[j]);
  const tangent=j=>{
    if(j===0)return slope(0);if(j===levels.length-1)return slope(j-1);
    const a=slope(j-1),b=slope(j);return a*b>0?2*a*b/(a+b):0;
  };
  const h=levels[i+1]-levels[i],t=clamp((y-levels[i])/h),t2=t*t,t3=t*t2;
  return (2*t3-3*t2+1)*values[i]+(t3-2*t2+t)*h*tangent(i)+(-2*t3+3*t2)*values[i+1]+(t3-t2)*h*tangent(i+1);
}
const ga=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
const heads={
  priest:{shape:[1.035,1.01,.99],nose:3.43,brow:1.18,cheek:1.28},
  thunder:{shape:[.98,1.02,1.03],nose:4.5,brow:1.65,cheek:1.44,tilt:1.05,eye:.80},
  ward:{shape:[1.19,.98,1.05],nose:3.52,brow:2.05,cheek:1.90,tilt:.77,eye:1.1},
  judge:{shape:[1.14,1.04,1.07],nose:4.13,brow:2.2,cheek:1.42,tilt:1.42,eye:1.45},
  corpse:{shape:[.92,1.04,1.0],nose:2.75,brow:1.16,cheek:2.01,tilt:.38,eye:.90},
  black:{shape:[1.12,1.00,1.08],nose:3.45,brow:1.90,cheek:1.45,tilt:.95,eye:.80},
  white:{shape:[.91,1.11,.94],nose:2.90,brow:.92,cheek:.82,tilt:.65,eye:.64}
};
function face(id){
  const c=heads[id],portrait=id==='priest';
  const profile=portrait?portraitSection:section;
  const widths=portrait?[2.62,6.13,7.98,8.90,9.30,9.41,9.36,8.92,6.88,.24]:width;
  const depths=portrait?[6.61,9.04,9.58,9.77,9.63,9.39,9.72,9.48,7.31,-.84]:front;
  function z(x,y){
    const a=Math.abs(x),r=profile(widths,y),temp=Math.sqrt(Math.max(0,1-(a/r)**2)),f=profile(depths,y),b=profile(rear,y);
    let relief= c.nose*ga(x,0,id==='ward'?2.0:1.24)*(.60*ga(y,12,5.9)+.62*ga(y,9.6,1.55));
    relief+=1.57*ga(a,1.55,.88)*ga(y,9.05,.93);
    relief+=c.brow*ga(y,15.32+.24*a,1.16)*ga(a,3.8,3.29);
    relief-=1.15*ga(a,4.06,2.52)*ga(y,13.6,1.22);
    relief+=c.cheek*ga(a,5.67,2.35)*ga(y,8.55+.47*a,1.52);
    relief+=(id==='ward'?1.35:.69)*ga(a,1.81,2.05)*ga(y,6.5,1.86);
    relief+=.74*ga(x,0,3.3)*ga(y,2.4,1.45);
    if(portrait){
      relief+=.63*ga(x,0,1.56)*ga(y,10.0,2.52)+.52*ga(a,1.37,.86)*ga(y,9.0,.80);
      relief+=.52*ga(a,3.9,2.55)*ga(y,15.22+.09*a,1.19);
      relief-=.50*ga(a,4.21,2.12)*ga(y,13.45,.98);
      relief+=.36*ga(a,4.73,2.5)*ga(y,12.13,.69);
      relief+=.72*ga(a,2.05,2.31)*ga(y,6.72,1.24)+.42*ga(x,0,3.5)*ga(y,2.56,1.14);
      relief-=.29*ga(a,2.48+.36*(8.6-y),.60)*ga(y,7.02,1.87);
    }
    if(id==='corpse')relief-=1.78*ga(a,5.2,2.0)*ga(y,7.28,2.15);
    return (f+b)/2+(f-b)/2*temp+relief*clamp(temp*2.6);
  }
  const p=(x,y,lift=0)=>V(x,y,z(x,y)+lift);
  return {z,p,c,widths,depths,profile};
}
function bladeRibbon(g,m,curve,width,height,f){
  const c=new T.CatmullRomCurve3(curve.map(([x,y])=>V(x,y,0)));
  part(g,surface(8,35,(u,t)=>{
    const q=c.getPoint(t),dir=c.getTangent(t),taper=.045+.955*Math.sin(Math.PI*t)**.51;
    const k=(u*2-1),x=q.x-dir.y*k*width*taper,y=q.y+dir.x*k*width*taper;
    return f.p(x,y,.055+height*(1-k*k)*taper);
  }),m);
}
function curl(g,m,s,x,y,z,r,roll=0){
  const path=Array.from({length:33},(_,i)=>{const t=i/32,a=-1.18+t*5.32+roll,rad=r*(1-.82*t);return [s*(x+rad*Math.cos(a)),y+rad*Math.sin(a),z+.25*Math.sin(Math.PI*t)];});
  stroke(g,m,path,t=>r*(.26-.13*t),34,7);
}
function hair(g,m,style,f){
  const random=rng(84);const long=style==='white',bun=style==='thunder'||style==='ward';
  const shell=(a,v,lift=0)=>{
    // Follow the carved skull at the hairline, including the temples in profile.
    const fore=(1+Math.cos(a))*.5,edge=style==='priest'?8.6+12.35*fore**1.10:4.6+15.7*fore**2.12+.46*Math.sin(3*a+.46)*fore;
    const top=bun?26.58:style==='corpse'?19.74:style==='priest'?25.9:20.38;
    const y=mix(top,Math.min(top-.16,edge),v),ys=clamp(y-(bun?.88:.24),0,25.64);
    const rx=section(width,ys),back=section(rear,ys),frontZ=section(front,ys),sn=Math.sin(a),cs=Math.cos(a);
    const crown=clamp((top-y)/1.30);
    const tuck=bun?0:1.20*(1-v)**2;
    const x=(rx+.46*crown+lift-tuck)*sn, z=cs>=0?f.z(rx*sn,ys):(frontZ+back)/2+(frontZ-back)*.5*cs;
    return V(x,y+(1-v)*lift,z+(.66*crown+lift-tuck)*cs);
  };
  part(g,surface(65,30,(u,v)=>shell(tau*u,1-v)),m.hair);
  for(let i=0;i<(bun?55:28);i++){
    const a=i/(bun?55:28)*tau+.03*random();
    const pts=Array.from({length:12},(_,k)=>{const t=k/11;return shell(a+.61*(1-t)+.19*Math.sin(t*Math.PI),.1+.88*t,.10);});
    stroke(g,i%4?m.hair:m.hairLight,pts,t=>.035+(style==='priest'?.068:.16)*Math.sin(t*Math.PI),16,5);
  }
  if(bun){
    oval(g,m.hair,[0,26.7,-3.51],[4.4,4.6,4.64],[.14,.12,.23]);
    for(let j=0;j<14;j++){
      const pts=Array.from({length:11},(_,k)=>{const t=k/10,p=.12+(Math.PI-.24)*t,a=t*1.61+j*tau/14;return [4.44*Math.sin(p)*Math.cos(a),26.83+4.45*Math.cos(p),-3.5+4.67*Math.sin(p)*Math.sin(a)];});
      stroke(g,j%4?m.hair:m.hairLight,pts,t=>.08+.17*Math.sin(Math.PI*t),16,6);
    }
    stroke(g,m.gold,[[-8,26.3,-4.1],[-3,25.6,-3.9],[7.75,24.2,-3.54]],t=>.16+.16*(1-t),16,7);
  }
  if(long||bun){
    for(const s of [-1,1])for(let j=0;j<(long?12:6);j++){
      const k=j/(long?12:6),r=random();
      const pts=[[s*(7.3+k),19,.95-2*k],[s*(8.6+k),15.4,.8-1.6*k],[s*(9.1+.48*k),10.1,1.65-2.1*k],[s*(8.8+k),6.2,2.28-1.5*k],[s*(8.1+1.4*k),long?-9-10*r:1-2.1*r,2.95-3*k],[s*(8.7+2.8*k),long?-18-8*r:-1.8-2.5*r,3.6-3.7*k]];
      stroke(g,j%3?m.hair:m.hairLight,pts,t=>(long?.25:.16)*(1-.85*t),23,6);
    }
  }
}
function beard(g,m,role){
  const big=role==='judge',random=rng(big?102:95);
  for(const s of [-1,1]){
    for(let j=0;j<(big?31:12);j++){
      const u=j/(big?30:11),r=random(),x=.18+7.1*u;
      const z=9.48-4.55*u,drop=big?7+12.6*(1-u)**.7+4.8*r:2.7+3.6*(1-u)+1.3*r;
      const twist=(big?1.2:.56)*Math.sin(j*2.4);
      const pts=[[s*x,3.6+2.8*u,z],[s*(x+1.08*u),2.3+u,z+.66],
        [s*(x+1.52*u),-.46,z+1.24+.4*r],[s*(x+1.24*u+twist),-drop*.44,z+2.05+.75*r],
        [s*(x*.82+.6+twist),-drop*.76,z+2.35],[s*(x*.52+twist*.65),-drop,z+2.45+1.75*r]];
      stroke(g,j%5?m.hair:m.hairLight,pts,t=>(.64+.32*r)*(1-.96*t**1.35),25,8);
    }
    for(let j=0;j<6;j++){
      const t=j/5;
      stroke(g,j%3?m.hair:m.hairLight,[[s*.42,7.0+t*.72,11.14],[s*2.3,6.92+t*.85,11.08],[s*4.6,6.26+t*.68,10.21],[s*(6.2+1.6*t),big?6.83+t:5.97+t,8.65],[s*(big?9.9:7.7),big?8.39+t:6.80+t,6.67]],u=>(.46+.13*t)*(1-.92*u),18,7);
    }
  }
}
function hat(g,m,id){
  const off=id==='black'||id==='judge',white=id==='white';
  const brim=id==='corpse'?m.lacquer:white?m.paper:m.ink;
  const brimY=id==='corpse'?19.5:20.1;
  rings(g,brim,[[brimY,9.72,10.0,-.65],[brimY+.5,10.32,10.55,-.65],[brimY+1.4,9.91,10.25,-.65]],0,72);
  if(id==='corpse'){
    rings(g,m.navy,[[20,9.66,10.05,-.8],[22,9.27,9.80,-.8],[25.5,7.55,7.93,-1],[27.4,4.32,4.61,-1],[28.4,.53,.65,-1]],0,72);
    oval(g,m.red,[0,28.84,-1],[1.26,1.50,1.26]);
    for(let j=0;j<21;j++){
      const a=tau*j/21;stroke(g,m.deepRed,[[.74*Math.sin(a),28.07,-1+.78*Math.cos(a)],[4.4*Math.sin(a+.12),27.10,-1+4.69*Math.cos(a+.12)],[7.05*Math.sin(a+.17),25.39,-1+7.58*Math.cos(a+.17)]],t=>.19-.12*t,14,5);
    }
    return;
  }
  const crown=group(g,0,0,0);
  // The rectangular gauze crown, folded paper peak and judge's double-lobed hat have separate profiles.
  const rows=white?[[20.6,9.75,9.9,-.65],[24,8.50,9.2,-.8],[31,6.8,7.1,-1.4],[39,4.90,5.38,-2.34],[46.9,1.23,2.28,-3.91],[48,.18,.7,-4.1]]:
    id==='black'?[[20.6,9.5,9.95,-.65],[25,8.93,8.95,-1.1],[31.9,8.45,7.02,-2.1],[37.3,8.74,6.13,-2.7],[37.85,8.12,5.74,-2.8],[38.1,.24,.28,-2.8]]:
    [[20.6,9.3,9.85,-.72],[22.5,9.6,9.85,-.75],[26.5,9.12,8.47,-1.28],[30,7.20,7.40,-2.50],[31.4,3.96,5.22,-3.04],[31.7,.2,.22,-3.0]];
  const get=(a,t)=>{
    const p=t*(rows.length-1),i=Math.min(rows.length-2,Math.floor(p)),v=p-i;
    const [y,rx,rz,cz]=rows[i].map((q,k)=>mix(q,rows[i+1][k],v));
    const fn=n=>Math.sign(n)*Math.abs(n)**(white?.75:off?.62:1);
    return V(rx*fn(Math.sin(a)),y,cz+rz*fn(Math.cos(a)));
  };
  part(crown,surface(72,36,(u,v)=>get(u*tau,v)),white?m.paper:m.navyDark);
  for(const a of [-2.47,-.78,.78,2.47])stroke(crown,white?m.linen:m.binding,Array.from({length:15},(_,k)=>get(a,k/14*.96)),.13,18,6);
  if(white||id==='black'){
    const paper=inscription(white?'一見生財':'天下太平',white?'#dbcfb4':'#393b36',white?'#4d4b40':'#c6a56f','tablet');
    part(crown,surface(14,34,(u,v)=>{const p=get((u-.5)*(white?.71:.80),mix(.045,white?.77:.73,v));p.z+=.19;return p;}),paper);
    return;
  }
  part(crown,surface(24,22,(u,v)=>{const p=get((u-.5)*.46,.08+.49*v);p.z+=.16;return p;}),inscription('敕','#49443a','#c7a568','medal'));
  for(const s of [-1,1]){
    const wing=(u,v)=>V(s*(7.25+u*15.6),22.2+5.1*u+3.2*u*u+(v-.5)*(1.4+3.55*Math.sin(Math.PI*u)**.6),-6.2-3.6*u);
    part(crown,surface(22,6,wing,s<0),m.navyDark);
    for(const t of [.04,.96])stroke(crown,m.oldGold,Array.from({length:13},(_,j)=>wing(j/12,t)),.18,16,6);
  }
}
function thunderCrest(g,m,f,skin){
  // Three swept quills on either side overlap like the pinions of a ritual bird mask.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const root=V(side*(5.9+i*.61),12.3+i*1.42,7.7-i*.75);
    const tip=V(side*(10.65+i*.43),14.75+i*2.60,-2.0-i*1.85);
    const feather=(u,t)=>{
      const mid=root.clone().lerp(tip,t),w=Math.sin(Math.PI*t)**.73;
      mid.x+=side*(.80+.52*(1-u*u))*w;mid.y+=w*(u*(.78+.13*i)+.53);
      mid.z+=.33*w*(1-u*u);return mid;
    };
    part(g,surface(9,28,(u,v)=>feather(u*2-1,v),side>0),i%2?m.copper:m.lacquer);
    for(const edge of [-.8,.05])stroke(g,edge>0?m.oldGold:m.gold,Array.from({length:19},(_,j)=>feather(edge,j/18)),t=>.045+.095*Math.sin(Math.PI*t),24,6);
  }
  const k=new T.CatmullRomCurve3([[0,19.88,0],[0,17.45,0],[0,14.02,0],[0,11.35,0],[0,9.02,0],[0,7.76,0]].map(q=>V(...q)));
  part(g,surface(16,35,(u,t)=>{
    const y=k.getPoint(t).y,x=(u*2-1)*(.12+1.10*Math.sin(Math.PI*t)**.61);
    return f.p(x,y,.10+(1-Math.abs(u*2-1))*(.34+2.05*Math.sin(t*Math.PI*.74)**1.8));
  },true),skin);
  for(const side of [-1,1])bladeRibbon(g,m.gold,[[side*.14,19.6],[side*.86,18.1],[side*2.8,18.6],[side*4.3,18.10],[side*6.7,19.25]] , .16,.30,f);
  // Bronze binding around the bun reads from the back as well as the front.
  rings(g,m.oldGold,[[23.6,4.20,4.71,-3.52],[24.1,4.72,4.96,-3.52],[25.1,4.63,4.89,-3.52],[25.45,4.45,4.70,-3.52]],0,44);
}
function lionMask(g,m,f,skin){
  for(const s of [-1,1]){
    for(let j=0;j<5;j++){
      const a=j*.59, x=7.75+1.3*Math.sin(a),y=8.55+j*2.56,z=3.9-.31*j;
      oval(g,skin,[s*x,y,z],[1.85,2.12,2.29],[.16,s*.25,s*(-.55+.19*j)]);
      curl(g,j%2?m.jade:skin,s,x,y,z+2.07,1.28,j*.66);
    }
    oval(g,skin,[s*7.02,20.7,1.20],[1.57,2.53,1.4],[.43,0,-s*.51]);
    curl(g,m.oldGold,s,7.12,21.08,2.43,.86,.53);
    bladeRibbon(g,skin,[[s*.82,15.35],[s*2.14,16.96],[s*3.28,17.74],[s*5.12,17.69],[s*6.88,18.42]],.78,.77,f);
    bladeRibbon(g,m.oldGold,[[s*1.12,15.80],[s*2.26,17.29],[s*3.32,17.92],[s*5.65,17.98]],.10,.92,f);
    oval(g,skin,[s*1.55,8.62,11.83],[1.55,1.08,1.03]);
    oval(g,m.stoneShade,[s*1.50,8.47,12.75],[.47,.27,.15]);
  }
}
export function makeHead(node,m,id){
  const g=group(node),f=face(id),{c}=f;g.scale.set(...c.shape);
  const skin=faceMaterial(id,m),line=id==='white'?m.warmInk:m.ink;
  part(g,surface(112,83,(u,v)=>{
    const y=25.65*v,a=(u-.5)*tau,x=f.profile(f.widths,y)*Math.sin(a),b=f.profile(rear,y),ff=f.profile(f.depths,y);
    const jaw=id==='priest'?2.2*(1-Math.cos(a))*(1-clamp(y/7))**2:0;
    return V(x,y+jaw,Math.cos(a)>=0?f.z(x,y):(ff+b)/2+(ff-b)/2*Math.cos(a));
  }),skin);
  for(const s of [-1,1]){
    oval(g,skin,[s*8.88,11.3,-1.31],[1.12,2.43,1.4],[.12,0,-s*.14]);
    if(id==='priest'){
      stroke(g,skin,[[s*9.46,12.68,-.86],[s*9.91,12.37,-1.54],[s*9.88,10.74,-1.69],[s*9.51,9.78,-1.1]],.18,16,7);
      continue;
    }
    stroke(g,m.oldGold,[[s*9.52,12.65,-.92],[s*9.88,12.24,-1.47],[s*9.81,10.76,-1.79],[s*9.54,9.72,-1.18]],.15,14,6);
    const edge=(t,upper)=>{
      const x=1.12+5.91*t,y=13.25+c.tilt*t;
      const arch=Math.sin(Math.PI*t)**.70;
      return [s*x,y+(upper?1:-1)*arch*c.eye*(upper?.81:.76)];
    };
    const eye=eyeMaterial(s),geo=surface(40,12,(u,v)=>{
      const [x,y0]=edge(u,false),[,y1]=edge(u,true);
      return f.p(x,mix(y0,y1,v),.09+.30*Math.sin(Math.PI*u)*Math.sin(Math.PI*v));
    },s<0);
    const uv=geo.attributes.uv;
    for(let j=0;j<=12;j++)for(let i=0;i<=40;i++){
      const t=i/40,[,bot]=edge(t,false),[,top]=edge(t,true);
      uv.setXY(j*41+i,t,clamp((mix(bot,top,j/12)-12.44)/(2.14+c.tilt*.62)));
    }
    if(id==='corpse')eye.color.set('#cfd3ab');part(g,geo,eye);
    for(const upper of [false,true]){
      const pts=Array.from({length:29},(_,j)=>f.p(...edge(j/28,upper),.19));
      stroke(g,upper?line:skin,pts,t=>.042+(upper?.25:.15)*Math.sin(Math.PI*t)**.56,32,7);
    }
    const bold=id==='judge'||id==='black';
    const paths=pts=>pts.map(([x,y])=>[s*x,y]);
    bladeRibbon(g,bold?m.hair:id==='white'?m.warmInk:skin,paths([[.79,14.7],[2.48,15.65],[4.48,16.33],[6.38,16.84],[8.25,bold?18.11:17.38]]),bold?.78:.52,bold?.72:.47,f);
    bladeRibbon(g,line,paths([[.55,8.61],[1.22,8.83],[1.73,9.05],[2.12,8.87]]),.17,.10,f);
    bladeRibbon(g,id==='white'?m.silk:line,paths([[0,5.84],[1.16,5.98],[2.10,5.78],[3.51,5.53],[4.18,5.87]]),id==='corpse'?.31:.14,.09,f);
    bladeRibbon(g,skin,paths([[.18,5.39],[1.54,5.34],[2.80,5.44],[3.72,5.52]]),.21,.21,f);
    if(id==='thunder'){
      for(let j=0;j<3;j++){
        const pts=paths([[3.30+j*.85,10.62+j*.2],[5+j*.77,11.45+j*.32],[6.32+j*.49,12.10+j*.5],[8.21+j*.22,14.18+j*.88]]);
        bladeRibbon(g,j===0?m.oldGold:m.copper,pts,.26,.25,f);
      }
      bladeRibbon(g,m.gold,paths([[.28,9.54],[.40,12.04],[.61,15.14],[2.16,17.75],[3.91,18.11],[5.60,19.24]]),.13,.24,f);
      bladeRibbon(g,m.red,paths([[.55,18.01],[1.60,19.44],[1.2,20.26],[2.20,21.51]]),.17,.12,f);
    }else if(id==='ward'){
      for(let j=0;j<4;j++){const y=6.45+j*2.25,x=6.23+.44*j;curl(g,skin,s,x,y,f.z(x,y)+.4,1.17+.11*j,j*.48);}
      bladeRibbon(g,m.worn,paths([[.88,14.79],[2.1,16.34],[3.5,16.55],[5.05,17.3],[6.4,17.25]]),.16,.45,f);
      oval(g,skin,[s*2.05,7.00,10.55],[2.15,1.43,1.09]);
      stroke(g,m.bone,[[s*3.23,6.26,11.03],[s*3.12,5.77,11.16],[s*2.95,5.10,10.98]],t=>.37*(1-.96*t),12,7);
    }else if(id==='corpse'){
      for(let j=0;j<3;j++)bladeRibbon(g,m.waxShadow,paths([[2.6,12.07-.38*j],[4.16,11.8-.45*j],[5.4,12.00-.46*j],[6.69,12.48-.42*j]]),.066,.02,f);
      for(let j=0;j<2;j++)bladeRibbon(g,m.waxShadow,paths([[6.4,9.58-.63*j],[4.75,8.52-.69*j],[4.36,7.15-.44*j],[3.9,6.73-.36*j]]),.09,.05,f);
      stroke(g,m.bone,[[s*2.62,6.02,f.z(s*2.62,6.02)+.31],[s*2.47,5.46,f.z(s*2.47,5.46)+.34],[s*2.30,4.73,f.z(s*2.3,4.73)+.31]],t=>.28*(1-.95*t),12,7);
    }else if(id==='white'){
      bladeRibbon(g,m.silk,paths([[6.64,13.96],[7.15,14.48],[7.83,15.21]]),.12,.035,f);
      bladeRibbon(g,m.shadowCloth,paths([[6.06,12.1],[6.63,10.05],[6.05,8.52],[6.6,7.51]]),.058,.025,f);
      bladeRibbon(g,m.shadowCloth,paths([[3.94,17.98],[5.04,18.16],[5.85,19.16]]),.051,.025,f);
    }else{
      const inlay=id==='judge'?m.deepRed:m.oldGold;
      bladeRibbon(g,inlay,paths([[2.8,12.24],[4.67,11.98],[6.05,12.74],[7.47,13.38]]),.13,.09,f);
      bladeRibbon(g,inlay,paths([[5.23,7.15],[6.20,8.18],[6.78,9.66],[7.88,10.3]]),.12,.06,f);
    }
  }
  hair(g,m,id,f);
  if(id==='priest')priestFace(g,m,f,skin);
  if(id==='thunder')thunderCrest(g,m,f,skin);
  if(id==='ward'){
    lionMask(g,m,f,skin);
    for(const s of [-1,1])curl(g,m.oldGold,s,2.64,19.11,f.z(s*2.64,19.11)+.35,1.18,2.22);
  }else if(id==='judge'||id==='black')beard(g,m,id);
  if(['judge','corpse','black','white'].includes(id))hat(g,m,id);
  if(id==='corpse'){
    for(let j=0;j<19;j++){
      const v=j/18;oval(g,j%2?m.hair:m.hairLight,[Math.sin(v*10)*1.62,13-50*v,-9.8+2.5*v],[1.88-.74*v,2.17-.36*v,1.45-.50*v],[0,0,(j%2?1:-1)*.49]);
    }
    const talisman=group(g,-1.6,22.65,10.05);talisman.rotation.z=.10;
    part(talisman,surface(10,32,(u,v)=>{const t=1-v;return V((u-.5)*(4.04+.24*t),-15*t,1.3*Math.sin(t*Math.PI)+3.8*t+.18*Math.cos(u*tau));}),inscription('敕令鎮屍','#c6a55b','#873a29','paper'));
    oval(g,m.oldGold,[-1.55,22.32,10.23],[.46,.42,.20]);return {paper:talisman};
  }
  return {};
}
