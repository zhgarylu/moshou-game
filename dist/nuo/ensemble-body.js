import * as T from '../vendor/three.module.js';
import {V,tau,clamp,mix,rng,group,part,oval,surface,rings,ringPoint,stroke,batch} from './form.js';
import {cast,recolor,inscription,embroideredBadge} from './ensemble-art.js';
import {makeHead} from './ensemble-heads.js';
import {priestKit} from './priest.js';
import {tablet,thunderKit,wardKit,judgeKit,blackKit,whiteKit} from './ensemble-props.js';

const sharedColors=new WeakMap();
const tailoring={
  priest:{w:17.7,hem:22.8,drop:26,sleeve:7.1,coat:'saffron',edge:'ink',side:'ochre',belt:'deepRed',threads:['#c59a49','#47392b']},
  thunder:{w:17.3,hem:20.5,drop:39,sleeve:7.4,coat:'navy',edge:'lapel',side:'robe',belt:'deepRed',threads:['#253e43','#c4a568']},
  ward:{w:23.5,hem:23.1,drop:42,sleeve:8.2,coat:'umber',edge:'ochre',side:'deepRed',belt:'leather',threads:['#60513d','#d4ad71']},
  judge:{w:24.1,hem:30.3,drop:24,sleeve:10.1,coat:'vermilion',edge:'deepRed',side:'vermilion',belt:'ink',threads:['#873c2b','#dfb773']},
  corpse:{w:16,hem:17.4,drop:36,sleeve:7.2,coat:'navyDark',edge:'faded',side:'navyDark',belt:'faded',threads:['#495253','#b5a789']},
  black:{w:22.6,hem:23.2,drop:37,sleeve:8.1,coat:'ironCloth',edge:'navyDark',side:'ironCloth',belt:'leather',threads:['#383d3b','#ae9672']},
  white:{w:15.1,hem:22.5,drop:18,sleeve:8.35,coat:'paperCloth',edge:'linen',side:'paperCloth',belt:'shadowCloth',threads:['#d6cbb2','#8b795a']}
};
function colors(base){
  if(sharedColors.has(base))return sharedColors.get(base);
  const paints={...base,saffron:recolor(base.robe,'#e5b23c'),navy:recolor(base.lapel,'#314e58'),navyDark:recolor(base.lapel,'#2d3640'),umber:recolor(base.robe,'#76604c'),
    ochre:recolor(base.robe,'#b19860'),vermilion:recolor(base.robe,'#ab4937'),ironCloth:recolor(base.robe,'#3c4241'),
    paper:recolor(base.linen,'#e4dcc6',.86),paperCloth:recolor(base.robe,'#e7deca'),faded:recolor(base.linen,'#7b847c'),
    jade:recolor(base.raised,'#82998c',.71),stoneShade:recolor(base.raised,'#52675e',.73),waxShadow:recolor(base.lid,'#657266'),
    iron:recolor(base.oldGold,'#928d7c',.40),copper:recolor(base.oldGold,'#609187',.54),blade:recolor(base.gold,'#9caaa8',.34),
    bone:recolor(base.worn,'#e0cfaa',.62),warmInk:recolor(base.ink,'#514139')};
  sharedColors.set(base,paints);return paints;
}
function along(g,mat,fn,r=.15,n=38){return stroke(g,mat,Array.from({length:n+1},(_,i)=>fn(i/n)),r,n+2,6);}
function shapedStrip(g,mat,curve,width){
  const p=new T.CatmullRomCurve3(curve.map(q=>V(...q)));part(g,surface(5,28,(u,v)=>{
    const c=p.getPoint(v);c.x+=(u-.5)*width*(.85+.15*Math.sin(Math.PI*v));c.z+=.17*Math.sin(Math.PI*u);return c;
  }),mat);
}
function chestCloth(r,m,id,c){
  const g=r.chest,w=c.w;
  const rows=[[-1,w*.68,8.9,0],[8,w*.72,9.1,.02],[16,w*.77,9.6,.18],[30,w*.92,11.09,.34],[40,w,10.82,.30],[46,w*.99,9.2,.16],[49,w*.78,7.45,.12],[52,6.15,5.53,.19]];
  function body(a,y,offset=0){
    let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;
    const v=(i+clamp((y-rows[i][0])/(rows[i+1][0]-rows[i][0])))/(rows.length-1),p=ringPoint(rows,v,a,.32);
    const folds=(.6*Math.sin(4.8*a+y*.49)+.41*Math.cos(3.9*a-y*.32))*clamp((47-y)/7)*clamp((y-9)/6);
    return p.add(V((folds+offset)*Math.sin(a),0,(folds+offset)*Math.cos(a)));
  }
  part(g,surface(88,58,(u,v)=>body(u*tau,-1+53*v)),m[c.coat]);
  const collar=(a,y)=>{
    if(y<52)return body(a,y,.60);
    const t=clamp((y-52)/3);return V(mix(6.7,5.35,t)*Math.sin(a),y,.15+mix(6.16,5.06,t)*Math.cos(a));
  };
  part(g,surface(76,10,(u,v)=>{const a=u*tau,top=55-4.5*Math.max(0,Math.cos(a))**2;return collar(a,top-3.4+3.4*v);}),m[c.edge]);
  const mantle=(u,v)=>{
    const a=u*tau,front=(1+Math.cos(a))/2,crest=51.2-.93*Math.cos(a*2),depth=id==='white'?5.8:id==='judge'?8.8:7.4;
    const hem=crest-depth-1.6*Math.cos(a*2)-1.86*Math.cos(a*4)-2.6*(1-front);
    return body(a,mix(hem,crest,v),.68+.38*Math.sin(Math.PI*v));
  };
  part(g,surface(92,18,mantle),m[id==='corpse'?'faded':id==='white'?'paperCloth':c.edge]);
  along(g,m[id==='white'?'faded':id==='black'?'binding':'oldGold'],t=>mantle(t,0),.22,84);
  along(g,m[c.side],t=>mantle(t,.19),.15,84);
  function wrap(side,y0,mat,lift,width){
    const line=new T.CatmullRomCurve3([[1.85*side,51.1],[1.12*side,48.85],[.73*side,45.54],[.36*side,39.18],[-.12*side,30.4],[-.69*side,20.7],[-1.00*side,y0]].map(([x,y])=>V(x,y,0)));
    const pt=(s,t)=>{const p=line.getPoint(t),d=line.getTangent(t),l=Math.hypot(d.x*13,d.y);return body(p.x+s*width*d.y/(13*l),p.y-s*width*d.x*13/l,lift+.21*(1-s*s));};
    part(g,surface(10,54,(u,v)=>pt(u*2-1,v)),mat);
    along(g,m.binding,t=>pt(.94,t),.13);along(g,m[c.side],t=>pt(-.92,t),.10);
  }
  wrap(-1,15,m[c.side],.58,2.64);wrap(1,14.8,m[c.edge],1.00,id==='judge'?3.63:2.85);
  if(id!=='white'){
    const formal=['judge','black','corpse'].includes(id),y=id==='ward'?32.6:33.4,w0=formal?Math.min(10.4,w*.47):5.2,h0=formal?8.4:5.0;
    const badge=(u,v)=>body((u-.5)*2*w0/(w*.94),y+(v-.5)*2*h0,1.55);
    part(g,surface(30,22,badge),embroideredBadge(id,...c.threads));for(const v of [.01,.99])along(g,m.oldGold,u=>badge(u,v),.095,22);
  }
  for(let i=0;i<3;i++){
    const y=11.5+2.21*i;
    const band=(u,v)=>{const a=u*tau,yy=y+(v-.5)*3.01+.46*Math.sin(2*a+i*.52);return body(a,yy,1.05+.22*Math.sin(Math.PI*v));};
    part(g,surface(66,5,band),i===1?m[c.belt]:m[c.edge]);along(g,m.binding,t=>band(t,.90),.105,50);
  }
  const buckle=group(g,0,14,11.01);tablet(buckle,m.oldGold,id==='judge'?9.3:6.01,3.60,1.05,1.11);
  oval(buckle,id==='ward'?m.jade:m[c.belt],[0,0,.64],[1.59,.98,.27]);
  for(const s of [-1,1])shapedStrip(g,s>0?m[c.belt]:m[c.edge],[[s*6,13.41,10.9],[s*8,8.3,10.69],[s*8.43,1.8,10.96],[s*9.64,-7.2,12],[s*10.26,-14.8,12.3]],2.83);
  if(id==='ward'){
    for(let j=0;j<2;j++)stroke(g,m.ochre,[[-w*.76,48,-2.9],[-w*.76,47,4.5],[-10.4,41.2+j,10.7],[-3.0,36.1+j,12.5],[4.3,32.85+j,12.2],[11.55,37.5+j,9.29],[w*.77,46.9,4.2]],.57,44,7);
  }
  if(id==='judge'||id==='black'){
    for(let j=0;j<7;j++){const a=(j-3)*.30,p=body(a,14.21,1.65);oval(g,m.gold,p.toArray(),[.44,.49,.29]);}
  }
  rings(g,id==='corpse'?m.waxShadow:id==='white'?m.paper:m.skin,[[48,5.5,5.3,0],[52,4.8,4.8,.1],[55.7,4.60,4.8,.18],[59,5.17,4.96,.51]],0,48);
}
function legsAndSkirt(r,m,id,c){
  const waist=r.carrier,w=c.w,drop=c.drop;
  for(const s of [-1,1]){
    const leg=group(waist,s*w*.42,89,0),shin=group(leg,0,-41,0);r.legs.push({s,leg,shin});const side=s<0?'R':'L';leg.name='thigh'+side;shin.name='shin'+side;
    const foot=group(shin,0,-42.5,0);foot.name='foot'+side;
    rings(leg,m.boot,[[-43,5.47,5.7,0],[-29,6.46,6.50,0],[-12,7.2,7.06,0],[3,7.04,6.69,0]],.29,40);
    rings(shin,m[c.edge],[[-43.7,4.20,4.85,.18],[-30.9,4.68,4.81,0],[-15.2,5.70,5.58,0],[3,5.76,5.59,0]],.19,40);
    for(let i=0;i<3;i++)rings(shin,m.leather,[[-38+i*4.3,4.8,5.09,.10],[-37+i*4.3,5.03,5.26,.10],[-36.1+i*4.3,4.92,5.21,.10]],0,36);
    r.track(shin,0,-47.40,9.9);
    oval(foot,m.boot,[0,0,3.86],[5.17,4.56,8.3],[-.12,0,0]);oval(foot,m.leather,[0,-3.63,4.31],[5.23,1.27,8.08]);
  }
  const skirt=group(waist,0,101,0);r.skirt=skirt;skirt.name='skirt';
  const rows=[[drop-101,c.hem,13.9,-.14],[drop-96,c.hem-.4,13.63,-.1],[-40,w*.9+2.9,13.02,0],[-22,w*.82+1.75,11.21,.0],[-5,w*.71+1.1,9.66,.03],[5,w*.69,9.45,0]];
  // The hem of the long judge/white robes descends below the knee; short dead cloth hangs in serrated strips.
  function fabric(a,v,extra){
    const p=ringPoint(rows,v,a,(.45+.41*(1-v)));
    p.z+=(extra+.36*Math.sin(a*11+2*v))*Math.cos(a);p.x+=extra*Math.sin(a);
    p.y+=(1-v)**3*(id==='corpse'?2.26*Math.sin(a*15+.7)+1.3*Math.cos(a*22):1.37*Math.sin(3*a+.3));return p;
  }
  part(skirt,surface(108,42,(u,v)=>fabric(u*tau,v,0)),m[c.side]);
  for(const s of [-1,1]){
    const panel=(u,v)=>{const a=s*(.10+u*2.94+(id==='white'?.24:.54)*(1-v));const p=fabric(a,v,.87);
      p.y+=(1-v)**2*(3.21*Math.abs(u*2-1)**2+.84*Math.sin(u*3.5));return p;};
    part(skirt,surface(47,38,panel,s<0),m[c.coat]);
    along(skirt,m[c.edge],t=>panel(.012,t),.24);along(skirt,m.binding,t=>panel(t,.044),.17,40);
    if(id==='judge'||id==='white'||id==='corpse')for(let j=0;j<9;j++){const u=.055+j*.107;along(skirt,id==='white'?m.shadowCloth:m.oldGold,t=>panel(u+.025*t,.075+.019*Math.sin(Math.PI*t)),.093,9);}
  }
  if(id==='white'||id==='ward'||id==='corpse'){
    const n=id==='white'?5:3;
    for(let i=0;i<n;i++){const a=(i-(n-1)/2)*.24-.17,front=id==='corpse'?Math.PI:0;const strip=group(skirt,0,0,0);
      const patch=(u,v)=>{const p=fabric(front+a+(u-.5)*.18,.11+v*.85,1.34);p.y+=(1-v)*(i%2?4.4:-2.94);return p;};
      part(strip,surface(7,30,patch),i%2?m[c.side]:m[c.edge]);r.tabs.push(strip);
    }
  }
}
function arms(r,m,id,c){
  for(const s of [-1,1]){
    const upper=group(r.chest,s*(c.w-1.32),44.2,0),fore=group(upper,0,-25.5,0),hand=group(fore,0,-24.5,0);
    const side=s<0?'R':'L';upper.name='upperArm'+side;fore.name='forearm'+side;hand.name='hand'+side;
    r.arms.push({s,upper,fore,hand});
    const rad=c.sleeve,wide=id==='white'||id==='judge'||id==='thunder'||id==='corpse';
    const rows=[[-27.5,rad*.69,rad*.68,.12],[-25.7,rad*.87,rad*.83,.12],[-23.4,rad*.82,rad*.82,.08],[-15,rad*.91,rad*.89,0],[-7,rad,rad*.95,0],[-1.4,rad*.98,rad*.95,0],[2.4,rad*.69,rad*.69,0],[4.2,.6,.65,0]];
    rings(upper,m[c.side],rows,.38,56);
    if(id==='ward'||id==='black'||id==='judge'){
      for(let j=0;j<3;j++){
        const patch=(u,v)=>{const a=s*(u*3.67-.32),t=.47+j*.122+v*.163+.04*Math.cos(u*tau);
          const p=ringPoint(rows,t,a,.38);p.x+=(1.0+.24*j)*Math.sin(a);p.z+=(1.0+.24*j)*Math.cos(a);p.y-=(1-v)*.63*Math.sin(u*Math.PI);return p;};
        part(upper,surface(33,7,patch,s<0),id==='judge'?m.deepRed:j%2?m.umber:m.ironCloth);
        along(upper,m.oldGold,t=>patch(t,0),.21,33);
        for(let k=0;k<5;k++)oval(upper,m.oldGold,patch((k+1)/6,.26).toArray(),[.32,.32,.32]);
      }
    }
    const armRows=wide?[[-24.0,rad*(id==='white'?1.21:1.04),rad*.94,.35],[-21,rad*1.04,rad*.96,.28],[-15.2,rad*.83,rad*.86,0],[-6.4,rad*.71,rad*.76,0],[1.15,rad*.68,rad*.73,0]]:
      [[-23.2,2.72,2.68,.1],[-19.7,3.31,3.14,0],[-9.9,4.58,4.37,0],[-2.4,4.61,4.58,0],[1.4,4.06,4.23,0]];
    rings(fore,wide?m[c.side]:m.leather,armRows,wide?.42:.08,52);
    const cuff=(u,v)=>{const a=u*tau,p=ringPoint(armRows,.025+v*(wide?.21:.68),a,wide?.42:.08);return p.add(V(.22*Math.sin(a),0,.22*Math.cos(a)));};
    if(wide){part(fore,surface(50,10,cuff),m[c.edge]);along(fore,m.binding,t=>cuff(t,.14),.12,48);}
    else for(let i=0;i<5;i++)along(fore,i%2?m.binding:m.deepRed,t=>cuff(t,i*.19+.055*Math.sin(t*tau)),.37,39);
    part(fore,surface(44,5,(u,v)=>{const p=ringPoint(armRows,0,u*tau,wide?.42:.08);p.x*=1-.58*v;p.z*=1-.58*v;p.y+=3.68*v;return p;}),m[id==='white'?'faded':'ink']);
    const skin=id==='white'?m.paper:id==='corpse'?m.waxShadow:id==='black'?m.leather:m.skin;
    rings(hand,skin,[[-2.2,1.56,1.24,.17],[-.1,1.66,1.42,.05],[2.7,1.85,1.52,0],[4.1,1.92,1.63,0]],0,32);
    oval(hand,skin,[0,-1.28,.24],[2.08,3.44,1.36],[.08,0,.06]);
    for(let j=0;j<4;j++){
      const x=(j-1.5)*1.04,open=id==='corpse'||id==='ward'||(id==='thunder'&&s>0);
      const y=-7.12+.41*Math.abs(j-1),pts=open?[[x,-3.38,.14],[x*1.07,-4.93,.37],[x*1.15,y-.17,.93],[x*1.09,y-.84,1.75]]:
        [[x,-3.34,-.34],[x*1.09,-4.82,.01],[x*1.12,-5.22,1.35],[x,-4.49,2.29],[x*.94,-3.55,2.19]];
      stroke(hand,skin,pts,t=>(.56+.048*Math.sin(Math.PI*t))*(1-.29*t),17,7);
      if(id==='corpse')stroke(hand,m.ink,[[x*1.11,y-.53,1.53],[x*1.09,y-1.28,1.98],[x*1.09,y-1.77,2.47]],t=>.35*(1-.97*t),9,6);
    }
    stroke(hand,skin,[[s*1.31,-.6,.0],[s*2.11,-1.66,.5],[s*2.24,-2.58,1.59],[s*1.35,-3.05,2.10]],t=>.74-.28*t,18,8);
  }
}
const deg=Math.PI/180,down=V(0,-1,0);
const ease=T.MathUtils.smoothstep;
function rot(node,x,y,z){node.rotation.set(x*deg,y*deg,z*deg,'YXZ');}
function bendArm(arm,target,pole,q){
  const a=arm.upper.position,delta=target.clone().sub(a),d=clamp(delta.length(),1.2,49.94),forward=delta.normalize();
  const lateral=pole.clone().addScaledVector(forward,-pole.dot(forward)).normalize(),along=(25.5**2-24.5**2+d*d)/(2*d);
  const elbow=a.clone().addScaledVector(forward,along).addScaledVector(lateral,Math.sqrt(Math.max(0,25.5**2-along*along)));
  const upper=new T.Quaternion().setFromUnitVectors(down,elbow.clone().sub(a).normalize());
  const fore=new T.Quaternion().setFromUnitVectors(down,target.clone().sub(elbow).normalize());
  arm.upper.quaternion.copy(upper);arm.fore.quaternion.copy(upper).invert().multiply(fore);
  arm.hand.quaternion.copy(fore).invert().multiply(q);
}
const handRotation=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x*deg,y*deg,z*deg,'YXZ'));
function performance(id,t,c){
  const prepare=Math.sin(Math.PI*ease(t,0,.77)),lift=ease(t,.25,1.30),strike=ease(t,1.15,1.53),recover=ease(t,1.55,2);
  const swing=Math.sin(Math.PI*ease(t,.40,1.83)),w=c.w;
  const right=V(-w-2.4,1.3,6.9),left=V(w+2.8,2.1,5),wrists=[right,left];
  const q=[handRotation(-5,0,4),handRotation(-6,0,-3)],chest=[1.8,0,0],head=[4.2,0,0];
  let shift=0,knees=0,advance=0,seal;
  if(id==='thunder'){
    right.set(-w-3.9-5.6*swing,16+40*lift-6*recover,13+18*swing);
    left.set(w-6.0,17+9*lift,16+5*lift);q[0]=handRotation(-11+18*swing,14,-6+12*lift);q[1]=handRotation(-52-16*lift,-10,-25);
    chest[1]=-8+17*lift-4*recover;head[0]=7.5-13*ease(t,.09,.59)+4.2*recover;head[1]=6-9*lift;
  }else if(id==='ward'){
    const weight=ease(t,.92,1.27),drop=ease(t,1.25,1.49);
    seal=V(0,19-3.9*prepare+14.4*lift+3.7*weight-17.4*drop+1.1*recover,18.6+5.4*lift+5.1*drop-1.8*recover);
    for(let i=0;i<2;i++){const s=i?1:-1;wrists[i].set(s*9.35,seal.y-3.40,seal.z-5.2);q[i]=handRotation(-88,s*8,s*5);}
    shift=-1.3*prepare-3.8*drop+1.7*recover;chest[0]=3+4*prepare-6.8*lift+10.1*drop-2*recover;head[0]=5-8*lift+6*drop-3*recover;
  }else if(id==='priest'){
    const sweep=ease(t,.96,1.44),cut=Math.sin(Math.PI*ease(t,.72,1.84));
    right.set(-w-4+23*sweep,12+38*lift-13*sweep,13+20*sweep);
    left.set(w-2+3.4*cut,14+17*prepare+12*lift,11+9*lift);
    q[0]=handRotation(-12-64*lift+43*sweep,18-66*sweep,-22+64*cut);q[1]=handRotation(-13-24*prepare,8,9+21*prepare);
    chest[1]=-13-11*prepare+34*sweep;head[1]=8-20*sweep;head[0]=8-12*lift+7*sweep;shift=-2.6*prepare-2.1*sweep;
  }else if(id==='judge'){
    right.set(-w-1-4*swing,8+31*lift-8*recover,12+17*swing+4*lift);
    left.set(w+2-7*lift,7+26*lift-5*recover,8+8.5*lift);q[1]=handRotation(-54-24*lift,16,-14);
    const base=V(-.69,-.69,.20).normalize(),dir=base.clone().lerp(V(-.94,.12,.44).normalize(),ease(t,.18,.87)).normalize().lerp(V(-.38,.87,.29).normalize(),ease(t,.78,1.37)).normalize().lerp(V(-.68,.60,.40).normalize(),ease(t,1.43,2)).normalize();
    q[0]=new T.Quaternion().setFromUnitVectors(base,dir);chest[1]=-12-4*prepare+24*lift-6*recover;head[1]=12-16*lift;head[0]=7-11*lift+4*recover;
  }else if(id==='corpse'){
    const jump=clamp((t-.60)/.66),air=4*jump*(1-jump),land=Math.sin(Math.PI*ease(t,1.25,1.69));
    shift=-4.0*prepare+16.2*air-3.2*land;knees=7*prepare+16*air+5*land;advance=11*ease(t,.59,1.29);
    for(let i=0;i<2;i++){const s=i?1:-1;wrists[i].set(s*(w+1.6+1.8*air),39.1+2.3*s+6.6*air-4.1*land,39.0+6.8*air);q[i]=handRotation(-83-10*air+12*land,6*s,s*3);}
    chest[0]=7.7+4.1*prepare-6.3*air+5.6*land;head[0]=-3+7*prepare-6.8*air+6.5*land;head[2]=3.9-3*air;
  }else if(id==='black'){
    right.set(-w-1.4-8.2*lift,9+30.9*swing+7*lift,11.8+16*lift-4*recover);
    left.set(w-6.6+13.5*lift,12+12.7*lift-2.3*recover,12-3.3*swing);q[0]=handRotation(-31-40*swing,10,18);q[1]=handRotation(-11,5,-13);
    chest[1]=-8-9*prepare+26*lift-8*recover;chest[0]=4.4+4*prepare-5*lift+3*recover;head[1]=8-15*lift;
  }else{
    right.set(-w-3.5-6.1*lift,15.1+23.6*lift-4.0*recover,12.0+9.2*swing);left.set(w-2+10.8*swing,13+14.5*lift,10+11*swing);
    q[0]=handRotation(3+8*swing,3,7+12*swing-3*recover);q[1]=handRotation(-41-29*lift,-12,-23);
    chest[1]=9-24*lift+4*recover;chest[2]=-1.2+3.0*swing;head[1]=-8+15*lift;head[2]=4.3-5.1*lift;
  }
  return {wrists,q,chest,head,shift,knees,advance,seal,follow:swing-.58*strike+.38*recover};
}
const extras={priest:priestKit,thunder:thunderKit,ward:wardKit,judge:judgeKit,black:blackKit,white:whiteKit};
export function makeEnsembleFigure(base,id){
  const c=tailoring[id],m=colors(base),root=new T.Group(),carrier=group(root),chest=group(carrier,0,92,0);
  root.scale.setScalar(cast[id].size);carrier.name='hips';chest.name='chest';
  const markers=[],r={root,carrier,chest,arms:[],legs:[],tabs:[],track:(node,x,y,z)=>markers.push([node,V(x,y,z)])};
  legsAndSkirt(r,m,id,c);chestCloth(r,m,id,c);arms(r,m,id,c);
  const head=group(chest,0,55.3,.10),secondary=makeHead(head,m,id);head.name='head';
  const accent=extras[id]?extras[id](r,m):()=>{};
  r.track(head,0,({priest:38,white:55,judge:33,black:40,corpse:31,ward:33,thunder:33})[id],-1);
  r.track(head,0,id==='judge'?-18:0,7);r.track(r.carrier,-c.hem,45,0);r.track(r.carrier,c.hem,45,0);
  for(const a of r.arms)r.track(a.hand,0,-6,1.3);
  batch(root);
  function show(t){
    const move=performance(id,t,c);
    carrier.position.set(0,move.shift,move.advance);
    rot(chest,...move.chest);rot(head,...move.head);
    for(let i=0;i<r.arms.length;i++){
      const arm=r.arms[i];bendArm(arm,move.wrists[i],V(arm.s*.80,-1,-.49),move.q[i]);
    }
    for(const {s,leg,shin} of r.legs){
      rot(leg,-move.knees,-s*2.6,s*(id==='ward'?6.0:2.7));rot(shin,1.76*move.knees,0,-s*.95);
    }
    r.skirt.rotation.x=(id==='corpse'?-.42*move.knees:1.8*move.follow)*deg;r.skirt.rotation.z=move.follow*.022;
    r.tabs.forEach((o,i)=>{o.rotation.z=Math.sin(i*1.7+.4)*.023*move.follow;});
    if(secondary.paper){secondary.paper.rotation.x=.035+.27*Math.sin(ease(t,.54,1.79)*Math.PI*2)*Math.sin(Math.PI*ease(t,.54,1.79));}
    accent(t,move);root.updateMatrixWorld(true);
  }
  const framing=[];
  for(let i=0;i<=20;i++){show(i*.10);for(const [node,p] of markers)framing.push(node.localToWorld(p.clone()));}
  show(0);return {root,show,framing};
}
