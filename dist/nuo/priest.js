import * as T from '../vendor/three.module.js';
import {V,tau,mix,clamp,rng,group,oval,stroke,rings,surface,part} from './form.js';
import {inscription,recolor} from './ensemble-art.js';

let bagua;
function emblem(){
  if(bagua)return bagua;
  const c=document.createElement('canvas');c.width=c.height=384;
  const g=c.getContext('2d'),circle=(x,y,r,fill)=>{g.beginPath();g.arc(x,y,r,0,tau);g.fillStyle=fill;g.fill();};
  g.translate(192,192);circle(0,0,186,'#785333');circle(0,0,178,'#d9af5a');circle(0,0,165,'#373029');
  for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);g.fillStyle='#ebc176';
    for(let k=0;k<3;k++){const y=-144+k*16;if(i&(1<<k)){g.fillRect(-31,y,26,8);g.fillRect(5,y,26,8);}else g.fillRect(-31,y,62,8);}g.restore();}
  circle(0,0,86,'#e9c781');g.beginPath();g.arc(0,0,80,-Math.PI/2,Math.PI/2);g.arc(0,40,40,Math.PI/2,-Math.PI/2);g.arc(0,-40,40,Math.PI/2,-Math.PI/2,true);g.fillStyle='#352d29';g.fill();
  circle(0,40,10,'#382d29');circle(0,-40,10,'#efcd86');
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  bagua=new T.MeshStandardMaterial({map,roughness:.77,side:T.DoubleSide});return bagua;
}
function badge(g,x,y,z,r,back=false){
  const disk=part(g,new T.CircleGeometry(r,48),emblem());disk.position.set(x,y,z);disk.rotation.y=back?Math.PI:0;
}
function portraitEye(g,f,side,skin,dark,crease,rim){
  const arch=t=>Math.max(0,Math.sin(Math.PI*t))**.76;
  const xAt=t=>1.72+4.91*t;
  const center=t=>13.34+.26*t+.07*Math.sin(2.1*Math.PI*t)+.036*side;
  const lid=(t,upper)=>center(t)+arch(t)*(upper?.45+.08*Math.cos(Math.PI*t):-.61);
  const point=(t,y,lift)=>f.p(side*xAt(t),y,lift);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=208;
  const c=canvas.getContext('2d'),w=512,h=208;
  const white=c.createLinearGradient(0,0,0,h);white.addColorStop(0,'#967970');white.addColorStop(.54,'#d5c2b3');white.addColorStop(1,'#b29888');
  c.fillStyle=white;c.fillRect(0,0,w,h);
  // UVs use anatomical x/y, retaining a round iris under the lowered lid.
  const cx=w*.478,cy=h*.41,r=111,iris=c.createRadialGradient(cx,cy,4,cx,cy,r);
  iris.addColorStop(0,'#201b19');iris.addColorStop(.43,'#33271e');iris.addColorStop(.77,'#544332');iris.addColorStop(.94,'#302d27');iris.addColorStop(1,'#221e1b');
  const dot=(x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,tau);c.fillStyle=color;c.fill();};
  dot(cx,cy,r,iris);const random=rng(57);
  for(let i=0;i<156;i++){
    const a=random()*tau,inner=48+random()*28;c.strokeStyle=i%3?'rgba(174,132,84,.21)':'rgba(33,27,21,.29)';
    c.beginPath();c.moveTo(cx+inner*Math.cos(a),cy+inner*Math.sin(a));c.lineTo(cx+(r-5)*Math.cos(a+.022),cy+(r-5)*Math.sin(a+.022));c.stroke();
  }
  dot(cx,cy,47,'#181918');dot(cx+side*26,cy-31,9.1,'#eddcc7');dot(cx-side*33,cy+21,3.1,'#ac9c84');
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
  const geo=surface(56,17,(u,v)=>{const y=mix(lid(u,false),lid(u,true),v);return point(u,y,.18+.34*arch(u)*Math.sin(Math.PI*v));},side<0);
  for(let j=0;j<=17;j++)for(let i=0;i<=56;i++){const t=i/56,y=mix(lid(t,false),lid(t,true),j/17);geo.attributes.uv.setXY(j*57+i,t,(y-12.51)/2);}
  part(g,geo,new T.MeshStandardMaterial({map,roughness:.32,side:T.DoubleSide}));
  for(const upper of [true,false]){
    const sign=upper?1:-1;
    part(g,surface(52,8,(t,v)=>{
      const a=arch(t),y=lid(t,upper)+sign*v*(upper?.21+.64*a:.14+.37*a);
      return point(t,y,.026+a*((1-v)*.19+.27*Math.sin(Math.PI*v)));
    },(side<0)!==!upper),skin);
    const contour=Array.from({length:31},(_,i)=>point(i/30,lid(i/30,upper),.21));
    stroke(g,upper?dark:rim,contour,t=>.014+(upper?.104:.055)*arch(t),37,7);
  }
  const path=(fn,start,end)=>Array.from({length:27},(_,i)=>{const t=mix(start,end,i/26);return point(t,fn(t),.09);});
  stroke(g,crease,path(t=>lid(t,true)+.28+.33*arch(t),.12,.97),t=>.015+.043*arch(t),29,6);
  stroke(g,crease,path(t=>lid(t,false)-.38-.27*arch(t),.24,1),t=>.014+.045*Math.sin(Math.PI*t),28,6);
}
function portraitHair(g,f,side,brow,paint,random){
  const xAt=t=>brow?.09+7.41*t:.09+4.01*t;
  const line=t=>brow?15.16+.15*t+.71*t*t+.035*side*t:6.69+.07*Math.sin(Math.PI*t)-.80*t*t+.035*side*t;
  const wide=t=>brow?.19+.53*Math.sin(Math.PI*t)**.62+.05*(1-t):.12+.37*Math.sin(Math.PI*t)**.61+.09*(1-t);
  const point=(t,v,h)=>f.p(side*xAt(t),line(t)+v*wide(t),h);
  const depth=(t,v)=>.07+(brow?.36:.245)*Math.sin(Math.PI*t)**.57*(1-v*v);
  part(g,surface(62,10,(t,u)=>{const v=u*2-1;return point(t,v,depth(t,v));},side<0),paint[0]);
  const count=brow?150:102;
  for(let i=0;i<count;i++){
    const t=.012+.965*random(),v=random()*1.92-.96;
    const dx=brow?(.024+.063*random())*(.58+t):(.007+.044*random());
    const dy=brow?.24+.57*random():-.49-.77*random();
    const bright=random(),mat=bright>(brow?.86:.974)?paint[3]:bright>.61?paint[2]:paint[1];
    const breadth=(brow?.034:.028)+.017*random();
    part(g,surface(2,5,(u,k)=>{
      const tt=Math.min(1,t+dx*k),vv=v+k*dy,ww=wide(tt);
      const y=line(tt)+vv*ww+(u-.5)*2*breadth*(.11+.89*Math.sin(Math.PI*k)**.72);
      const base=depth(tt,clamp(vv,-1,1));
      return f.p(side*xAt(tt),y,base+.037+.046*Math.sin(Math.PI*k));
    },side>0),mat);
  }
}
export function priestFace(g,m,f,skin){
  const paint=['#453931','#29231f','#62574a','#938473'].map(color=>new T.MeshStandardMaterial({color,roughness:.87,side:T.DoubleSide}));
  const crease=recolor(m.lid,'#9e705c'),rim=recolor(m.skin,'#ba8d74'),lip=recolor(m.skin,'#b07e68');
  const random=rng(2761);
  for(const s of [-1,1]){
    portraitEye(g,f,s,skin,paint[0],crease,rim);
    portraitHair(g,f,s,true,paint,random);portraitHair(g,f,s,false,paint,random);
    const trace=(mat,pts,r,lift=.06)=>stroke(g,mat,pts.map(([x,y])=>f.p(s*x,y,lift)),t=>.012+r*Math.sin(Math.PI*t)**.65,20,6);
    trace(crease,[[.38,15.83],[.54,16.37],[.64,17.03],[.93,17.57]],.043);
    trace(crease,[[6.50,13.49],[6.92,13.59],[7.51,13.84]],.037);
    trace(crease,[[6.38,13.09],[6.94,12.96],[7.36,12.83]],.027);
    trace(crease,[[2.36,8.62],[2.85,8.09],[3.45,7.26],[3.86,6.34]],.043);
    trace(paint[0],[[.72,8.88],[1.15,9.04],[1.53,9.14],[1.90,8.96]],.14,.10);
    trace(skin,[[1.76,9.46],[2.02,9.37],[2.17,9.06],[2.03,8.73]],.10);
  }
  // The sparse bridge reads as one horizontal brow without joining the dense hairs into a bar.
  for(let i=0;i<52;i++){
    const x=(random()-.5)*1.52,y=15.05+.44*random(),dx=(x*.18)+(random()-.5)*.30,h=.18+.37*random();
    stroke(g,i%5?paint[1]:paint[2],[f.p(x,y,.18),f.p(x+dx*.52,y+h*.64,.23),f.p(x+dx,y+h,.21)],t=>(.035+.009*Math.sin(Math.PI*t))*(1-.86*t),5,4);
  }
  const mouth=(u,v,upper)=>{
    const x=(u*2-1)*3.78,k=Math.abs(u*2-1),span=Math.sin(Math.PI*u)**.69;
    const seam=5.48+.09*k-.15*k*k;
    const y=seam+(upper?1:-1)*v*span*(upper?.40+.16*Math.sin(k*Math.PI*1.6):.55);
    return f.p(x,y,.075+.25*span*Math.sin(Math.PI*v));
  };
  for(const upper of [true,false])part(g,surface(52,9,(u,v)=>mouth(u,v,upper),!upper),lip);
  stroke(g,crease,Array.from({length:35},(_,i)=>mouth(i/34,0,true)),t=>.022+.069*Math.sin(Math.PI*t),37,7);
  rings(g,m.ink,[[19.2,9.55,9.76,-.34],[20,9.89,10.11,-.38],[24.9,9.18,9.49,-.84],[26,8.28,8.63,-1.1]],0,60);
  rings(g,m.saffron,[[22.6,9.86,10.13,-.44],[25,9.49,9.71,-.60],[28.7,8.28,8.7,-1.33],[31.2,6.36,6.69,-1.8],[31.7,.1,.17,-1.8]],0,64);
  for(const s of [-1,1]){
    const flap=(u,v)=>V(s*(.32+u*8.18),24.1+v*(10.65-4.5*u)+1.9*u,8.54-3.9*u*u-3.7*v);
    part(g,surface(20,12,flap,s<0),m.saffron);
    stroke(g,m.deepRed,Array.from({length:16},(_,i)=>flap(i/15,.95)),.23,20,7);
  }
  badge(g,0,22.45,9.98,2.46);
}
export function priestKit(r,m){
  badge(r.chest,0,33.2,13.0,6.15);badge(r.chest,0,32.5,-11.66,8.55,true);
  const sword=group(r.arms[0].hand,0,-3.72,1.2);sword.rotation.set(.78,0,.54);
  const outline=[[-1.65,3],[-1.72,28],[-1.36,45],[0,52],[1.36,45],[1.72,28],[1.65,3]];
  const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  part(sword,new T.ExtrudeGeometry(shape,{depth:.63,bevelEnabled:true,bevelSegments:2,bevelSize:.27,bevelThickness:.19}),m.wood);
  rings(sword,m.deepRed,[[-7,.64,.70,0],[-6,1,1,0],[2.8,1,1,0],[3.7,.8,.86,0]],0,20);
  stroke(sword,m.oldGold,[[-4,4.2,0],[-2.9,3.42,0],[0,4.14,0],[2.9,3.42,0],[4,4.2,0]],.57);
  const stars=[[-.71,8.7],[.61,13.4],[-.34,18.4],[.77,23.6],[.02,29.4],[-.65,34.1],[.4,40]];
  for(const z of [-.26,.94]){stroke(sword,m.gold,stars.map(([x,y])=>[x,y,z]),.10,22,5);for(const [x,y] of stars)oval(sword,m.gold,[x,y,z],[.36,.39,.16]);}
  const bell=group(r.arms[1].hand,0,-6.5,1.35);
  rings(bell,m.gold,[[-6.3,3.5,3.5,0],[-5.8,3.6,3.6,0],[-4.7,3.14,3.14,0],[-1,1.88,1.88,0],[0,.74,.74,0],[3,.55,.55,0]],0,36);
  oval(bell,m.oldGold,[0,-6.4,0],[.86,1.03,.86]);
  const sash=group(r.chest,-9,12.8,9.1);
  for(let j=0;j<2;j++)part(sash,surface(8,25,(u,v)=>V(j*3.6+(u-.5)*3.8-4.5*(1-v),-20*(1-v)+j*2,2+3*Math.sin(v*Math.PI))),inscription(j?'三清':'敕令','#deb557','#943d29','paper'));
  r.track(sword,0,52,0);
  return t=>{bell.rotation.z=.31*Math.sin(t*11)*Math.sin(Math.PI*Math.min(t/1.7,1));sash.rotation.x=.10*Math.sin(t*3);};
}
