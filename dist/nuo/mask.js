import * as T from '../vendor/three.module.js';
import {V,tau,clamp,mix,sample,rng,part,oval,surface,stroke,rings} from './form.js';
import {eyeMaterial} from './materials.js';

// Sampled front contours of the approved upper and lower lids, from inner to outer corner.
const lids=[
  [[432.75,429.9,427.4,425.49,424.21,423.47,422.9,422.5,422.19,421.86,421.5,421.4,421.44,421.52,421.8,422.3,423.42],[432.75,434.7,435.25,435.8,436.14,436.31,436.4,436.23,435.79,435.25,434.46,433.54,432.54,431.17,429.24,426.88,423.42]],
  [[432.62,430.41,427.84,426.06,424.75,423.97,423.46,423.04,422.72,422.37,421.99,421.88,421.98,422.14,422.47,423.08,424.32],[432.62,435.17,435.78,436.28,436.64,436.87,436.98,436.78,436.27,435.67,434.86,434.02,433.01,431.71,429.96,427.7,424.32]]
];
const profile=[
  [0,1.10,6.9,5.5],[1.2,3.65,8.8,3.95],[3.5,5.8,9.1,2.8],[6.3,7.38,9.3,2.0],
  [9.2,8.52,9.35,.90],[12.3,9.18,9.15,.22],[15.3,9.22,9.51,.02],
  [18.7,8.75,9.56,.75],[21.5,7.79,9.13,2.0],[23.5,6.55,8.76,3.62]
];
function section(y,k){
  let i=0;while(i<profile.length-2 && y>profile[i+1][0])i++;
  const a=profile[i],b=profile[i+1];return mix(a[k],b[k],clamp((y-a[0])/(b[0]-a[0])));
}
const bell=(n,c,w)=>Math.exp(-(((n-c)/w)**2));
function depth(x,y){
  const a=Math.abs(x),n=clamp(a/section(y,1)),base=section(y,3)+(section(y,2)-section(y,3))*Math.pow(1-n*n,.59);
  const bridge=bell(x,0,1.16)*(2.55*bell(y,12.8,6.1)+2.64*bell(y,9.15,1.75));
  const nostril=1.52*bell(a,1.53,.85)*bell(y,9.0,.83);
  const brow=1.48*bell(y,14.95+.395*a,1.10)*bell(a,4.1,4.0);
  const orbit=-1.23*bell(a,4.4,2.95)*bell(y,13.9,1.20);
  const cheek=1.29*bell(y,7.5+.66*a,1.17)*bell(a,5.55,3.2);
  return base+bridge+nostril+brow+orbit+cheek+.57*bell(x,0,2.5)*bell(y,5.65,.94)+.65*bell(x,0,2.45)*bell(y,2.2,1.55);
}
function at(u,y,extra=0){const x=u*section(y,1);return V(x,y,depth(x,y)+extra);}
const root=.161,tail=.766;
function aperture(side,u){
  const k=clamp((u-root)/(tail-root)),ap=lids[side<0?0:1],bulge=Math.sin(Math.PI*k)**.52;
  const top=14.05+(430-sample(ap[0],k))*.101,bot=14.05+(430-sample(ap[1],k))*.101;
  return {top,bot,hi:top+.74*bulge,lo:bot-.74*bulge,k};
}
function ornament(head,material,side,points,width,height=.10,lift=.025){
  const curve=new T.CatmullRomCurve3(points.map(([u,y])=>V(side*u*section(y,1),y,0)));
  const geo=surface(6,48,(s,t)=>{
    const p=curve.getPoint(t),v=curve.getTangent(t),w=(typeof width==='number'?width:width(t))*Math.max(.035,Math.sin(Math.PI*t)**.39),k=s*2-1;
    const x=p.x-v.y*w*k,y=p.y+v.x*w*k;
    return V(x,y,depth(x,y)+lift+height*(1-k*k));
  });
  part(head,geo,material);
}
function eye(head,m,side){
  const M=eyeMaterial(side);
  for(const [a,b] of [[0,root],[root,tail],[tail,1]]){
    const shell=(band)=>{
      const geo=surface(Math.ceil((b-a)*87),band===1?4:36,(s,v)=>{
        const u=mix(a,b,s),e=aperture(side,u);
        let y;
        if(band===0)y=mix(0,e.lo,v);
        if(band===1)y=mix(e.lo,e.hi,v);
        if(band===2)y=mix(e.hi,23.2-2.6*u*u+1.05*Math.sin(Math.PI*u),v);
        return at(side*u,y);
      },side<0);
      const positions=geo.attributes.position,uv=geo.attributes.uv;
      for(let i=0;i<positions.count;i++)uv.setXY(i,.5+positions.getX(i)/20,positions.getY(i)/24);
      part(head,geo,m.mask);
    };
    shell(0);if(a!==root)shell(1);shell(2);
  }
  const strip=(a,b,material,n=8)=>part(head,surface(60,n,(s,v)=>{
    const u=mix(root,tail,s),e=aperture(side,u);
    const p=a(e,s),q=b(e,s);
    return at(side*u,mix(p[0],q[0],v),mix(p[1],q[1],v));
  },side<0),material);
  strip(e=>[e.lo,0],e=>[e.lo+.08,-.76],m.underside);
  strip(e=>[e.hi-.08,-.76],e=>[e.hi,0],m.underside);
  strip(e=>[e.lo,-.75],e=>[e.bot,-.45],m.skin);
  strip(e=>[e.top,-.43],e=>[e.hi,-.75],m.lid);
  const geo=surface(64,14,(s,v)=>{
    const u=mix(root,tail,s),e=aperture(side,u),y=mix(e.bot,e.top,v);
    return at(side*u,y,-.46+.11*Math.sin(Math.PI*v)*Math.sin(Math.PI*s));
  },side<0);
  // Map the iris in face coordinates so it stays round behind the asymmetric opening.
  const uv=geo.attributes.uv;
  for(let j=0;j<=14;j++)for(let i=0;i<=64;i++){
    const s=i/64,e=aperture(side,mix(root,tail,s)),y=mix(e.bot,e.top,j/14);
    uv.setXY(j*65+i,s,clamp((y-13.30)/1.86));
  }
  part(head,geo,M);
  const edge=Array.from({length:38},(_,i)=>{const t=i/37,u=mix(root,tail,t);return at(side*u,aperture(side,u).top,-.39);});
  stroke(head,m.ink,edge,t=>.019+.105*Math.sin(Math.PI*t)**.55,42,7);
  return M;
}
function hair(head,m){
  const random=rng(905);
  const cap=(a,t,extra=0)=>{
    const front=(1+Math.cos(a))*.5;
    const end=2.69-1.56*front**1.46+.075*Math.sin(3*a)+.049*Math.cos(7*a)+.031*Math.sin(13*a);
    const q=mix(.008,end,t),r=1+extra*.065;
    const lock=.16*Math.sin(a*22+4.2*q+.81*Math.sin(3*a+q))+.12*Math.sin(11*a+3*q);
    const rr=Math.sin(q)*(1+lock*.046);
    return V(9.60*r*rr*Math.sin(a),14.7+(11.65+extra)*Math.cos(q),-1.63+10*r*rr*Math.cos(a));
  };
  part(head,surface(110,44,(u,v)=>cap(u*tau,1-v)),m.hair);
  for(let j=0;j<105;j++){
    const a=j/105*tau+.035*random(),paths=[],width=.038+.078*random();
    for(let i=0;i<=13;i++){const t=i/13;paths.push(cap(a+.88*(1-t)+(.3+.12*Math.sin(a*4))*Math.sin(t*Math.PI),.11+.884*t,.10));}
    stroke(head,j%4?m.hair:m.hairLight,paths,t=>width*(.22+.83*Math.sin(Math.PI*t)**.5),19,5);
  }
  oval(head,m.hair,[0,27.1,-3.65],[5.15,5.0,4.75],[-.26,0,.17]);
  for(let i=0;i<21;i++){
    const pts=[],angle=i/21*tau;
    for(let j=0;j<=17;j++){const t=j/17,p=.11+t*(Math.PI-.22),a=angle+2.02*t+.18*Math.sin(p);pts.push([5.02*Math.sin(p)*Math.cos(a),27.35+4.88*Math.cos(p),-3.62+4.73*Math.sin(p)*Math.sin(a)]);}
    stroke(head,i%3?m.hair:m.hairLight,pts,t=>.043+.135*Math.sin(t*Math.PI),24,6);
  }
  for(let j=0;j<3;j++)stroke(head,j===1?m.gold:m.deepRed,Array.from({length:38},(_,i)=>{const a=tau*i/37;return [4.48*Math.sin(a),24.06+j*.29+.14*Math.sin(a+.8),-3.4+4.20*Math.cos(a)];}),.18,40);
  stroke(head,m.gold,[[-11,26.9,-3.9],[-7,26.2,-3.6],[3,24.2,-3.25],[9.8,22.74,-2.8]],t=>.14+.25*t,26,9);
  oval(head,m.oldGold,[-10.8,26.85,-3.9],[1.44,.49,.60],[.1,.25,-.2]);
  for(const side of [-1,1])for(let k=0;k<9;k++){
    const a=random(),b=random(),j=k/9;
    const points=[[side*(6.4+1.2*j),20.5+a,4.4-j],[side*(8.3+j),17.8,3.7-j],[side*(9.35+.93*j),14.25,3.30-j],[side*(9.15+1.25*j),10.4+b,4.47-j],[side*(7.93+1.2*j),6.6+b*2,5.26-j],[side*(7.78+.66*j),3.8-1.9*a,4.25-j]];
    stroke(head,k%3?m.hair:m.hairLight,points,t=>(.023+.035*a)*(.07+.93*(1-t)**.61),27,5);
  }
  for(const side of [-1,1])for(let j=0;j<19;j++){
    const a=random(),b=random(),k=j/19;
    const points=[[side*(6.1+2*k),20+1.6*a,4.8-2*k],[side*(8.6+.8*k),17.2+a,3.4-k],[side*(9+.54*a),12.6+k,2.5-1.4*k],[side*(8.2+1.25*k),7.7+b,k*.3+2],[side*(7.55+1.9*k),3.3-2.8*b,2.9-k],[side*(7.1+2.3*k),.3-2.7*b,2.4+.8*a]];
    stroke(head,j%3?m.hair:m.hairLight,points,t=>(.055+.13*a)*(.08+.92*(1-t)**.6),24,5);
  }
}
export function buildHead(head,m){
  rings(head,m.skin,[[.45,2.33,3.26,3.65],[1.4,3.85,4.28,2.19],[3.4,5.70,5.64,.60],[6.3,7.10,6.51,-.28],[9.2,8.05,7.46,-1.05],[13,8.46,8.03,-1.8],[17.3,8.30,8.4,-1.78],[21.4,6.9,7.75,-1.8],[24.9,3.6,4.8,-1.94],[26,.12,.22,-1.95]],0,84);
  for(const s of [-1,1]){
    const ear=(a,r,lift=0)=>{
      const ca=Math.cos(a),sa=Math.sin(a),y=10.45+2.38*r*sa,z=-.73+1.14*r*ca+.23*r*sa;
      const x=8.02+.97*Math.sqrt(Math.max(0,1-r*r))+.27*Math.exp(-((r-.78)**2)/.022)-.34*Math.exp(-(r*r)/.20)+lift;
      return V(s*x,y,z);
    };
    part(head,surface(52,18,(u,v)=>ear(u*tau,v),s>0),m.skin);
    part(head,surface(36,8,(u,v)=>ear(u*tau,.37*v,.022),s>0),m.lid);
    stroke(head,m.skin,Array.from({length:32},(_,i)=>ear(-.42+i/31*4.99,.76,.10)),t=>.12+.085*Math.sin(Math.PI*t),34,7);
    stroke(head,m.skin,[[s*9.14,11.54,-1.03],[s*9.11,11.25,-.38],[s*8.91,10.72,-.51],[s*8.83,10.18,-.86]],.16,18,7);
    oval(head,m.skin,[s*8.92,10.37,.04],[.20,.35,.23]);
  }
  hair(head,m);
  const eyes=[];
  for(const s of [-1,1]){
    eyes.push(eye(head,m,s));
    const rim=[];
    for(let i=0;i<=40;i++){const u=i/40;rim.push(at(s*u,23.2-2.6*u*u+1.05*Math.sin(Math.PI*u)));}
    for(let i=1;i<=60;i++)rim.push(at(s,20.6*(1-i/60)));
    for(let i=1;i<=8;i++)rim.push(at(s*(1-i/8),0));
    part(head,surface(rim.length-1,4,(u,v)=>{const p=rim[Math.round(u*(rim.length-1))].clone();p.x*=1-.028*v;p.z-=.82*v;return p;}),m.underside);
    stroke(head,m.worn,rim,t=>.060+.045*Math.sin(t*8)**2,92,6);
    // Raised brow and cheek knife planes carry chipped lacquer and vermilion inlay.
    const brow=[[.077,14.75],[.215,16.55],[.43,17.12],[.66,17.53],[.87,18.72],[.971,20.08]];
    ornament(head,m.raised,s,brow,t=>.32+.49*Math.sin(Math.PI*t),.31,.04);
    ornament(head,m.worn,s,brow,t=>.08+.11*t,.025,.36);
    ornament(head,m.red,s,[[.19,17.45],[.38,18.02],[.64,18.24],[.82,19.34],[.94,20.76]],.18,.075,.08);
    ornament(head,m.red,s,[[.96,15.61],[.866,14.88],[.76,13.13],[.60,11.70],[.41,10.50]],t=>.13+.30*Math.sin(t*Math.PI),.05,.07);
    ornament(head,m.raised,s,[[.958,14.97],[.85,12.24],[.64,10.53],[.55,8.68],[.62,7.91],[.76,8.73]],.31,.20,.05);
    ornament(head,m.oldGold,s,[[.965,15.12],[.864,12.3],[.65,10.6],[.564,8.69],[.618,8.09],[.739,8.73]],.073,.04,.265);
    ornament(head,m.raised,s,[[.89,10.4],[.83,8.31],[.75,6.43],[.58,4.68],[.25,2.22]],.32,.18,.04);
    ornament(head,m.red,s,[[.93,10.1],[.87,7.72],[.78,6.03],[.66,4.61]],.105,.04,.08);
    ornament(head,m.worn,s,[[.22,10.15],[.236,9.51],[.209,8.99],[.105,8.79]],.17,.05,.13);
    ornament(head,m.ink,s,[[.064,8.60],[.14,8.71],[.224,8.77],[.267,9.12]],.15,.035,.11);
    ornament(head,m.raised,s,[[.047,8.09],[.15,7.10],[.28,6.68],[.47,6.28]],.18,.12,.03);
    ornament(head,m.lips,s,[[0,5.76],[.14,5.90],[.30,5.78],[.49,5.48]],.24,.12,.04);
    ornament(head,m.worn,s,[[.035,5.42],[.19,5.43],[.35,5.36]],.055,.02,.08);
    ornament(head,m.oldGold,s,[[.02,18.05],[.13,19.55],[.24,20.25],[.16,21.2],[.038,22.1]],.09,.075,.11);
    for(const y of [12.25,16.7]){
      const p=at(s*.944,y,.04);oval(head,m.oldGold,p.toArray(),[.38,.39,.25]);
      const pts=[p.toArray()];
      for(let k=0;k<=20;k++){
        const a=1.40+(Math.PI-1.40)*k/20,h=y+.58*Math.sin(k/20*Math.PI/2);
        const radial=Math.sqrt(1-((h-14.7)/11.65)**2);
        pts.push([s*(9.60*radial+.29)*Math.sin(a),h,-1.63+(10*radial+.32)*Math.cos(a)]);
      }
      stroke(head,m.deepRed,pts,.22,39);
      if(s===1){
        const [cx,cy,cz]=pts.at(-1);
        for(const d of [-1,1]){
          stroke(head,m.deepRed,[[cx,cy,cz],[d*1.11,cy+.64,cz-.26],[d*1.36,cy-.25,cz-.54],[cx,cy,cz-.38]],.24,14);
          if(y<14)stroke(head,m.deepRed,[[cx,cy,cz-.44],[d*.66,cy-1.14,cz-.34],[d*1.12,cy-2.85,cz+.26],[d*1.51,cy-4.20,cz+1.12]],t=>.24-.10*t,18);
        }
      }
    }
  }
  ornament(head,m.red,1,[[0,17.9],[.02,19.29],[.058,20.28],[.019,21.2],[0,22.34]],.14,.065,.13);
  return eyes;
}
