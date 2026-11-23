import {actionTiming} from './action-timing.js';

// Seconds, lateral weight, knee compression, body twist, hand height,
// forward reach, sweep across the chest, and counterweight from the other arm.
// These keys are placed at the spell events; the body leads the hands through
// each change of direction. Values between keys use non-uniform Hermite slopes.
const rest=t=>[t,0,0,0,0,0,0,0];
const swordStorm=[
 rest(0), [.31,-.55,.48,-.61,.37,-.13,-.50,.44], [.79,-.34,.17,-.26,.99,.24,.32,.71],
 [1.14,.18,.29,.37,.69,.45,.56,.60], [1.52,.64,.42,.74,.54,.92,.85,.35],
 [1.73,-.18,.30,-.60,.82,.36,-.14,.71], [1.98,-.58,.45,-.77,.58,.96,-.78,.43],
 [2.19,.04,.23,.21,.96,.34,-.28,.90], [2.44,.57,.46,.68,.61,.92,.64,.52],
 [2.76,-.67,.48,-.70,1.23,.16,-.88,1.03], [2.93,-.22,.34,-.25,.72,.40,-.20,.83],
 [3.12,.96,.90,.99,-.07,1.12,.91,.47],[3.28,.77,.66,.82,.03,.89,.99,.37],
 [3.53,.34,.24,.27,.24,.47,.42,.22],rest(3.84)
];
const swordStars=[
 rest(0),[.31,-.51,.43,-.48,.53,-.08,-.67,.32],[.71,-.20,.21,-.19,.88,.26,-.31,.54],
 [1.10,.60,.39,.67,.42,.81,.72,.31],[1.34,.04,.21,.06,.73,.46,.23,.52],
 [1.55,-.44,.33,-.55,.58,.80,-.68,.31],[1.82,-.12,.19,-.12,.78,.38,-.48,.51],
 [2.00,.48,.36,.57,.39,.94,.78,.32],[2.29,-.32,.29,-.38,.90,.20,-.49,.74],
 [2.58,.77,.70,.84,.12,1,.65,.38],[2.76,.48,.42,.44,.15,.65,.38,.21],rest(3.10)
];
const mountain=[
 rest(0), [.29,-.37,.68,-.32,-.30,-.34,-.33,.29], [.71,-.20,.51,-.22,.34,.16,-.24,.55],
 [1.09,.29,.13,.31,.91,.42,.34,.83], [1.32,.42,.10,.41,1.04,.48,.36,.89],
 [1.71,.17,.24,.17,.92,.32,.06,.82], [2.11,-.26,.40,-.27,1.17,.12,-.22,.95],
 [2.30,.18,.30,.20,.52,.50,.08,.80],[2.50,.80,1.10,.78,-.58,.94,.46,.44],
 [2.61,.73,.94,.63,-.57,.79,.46,.41],[2.74,.51,.60,.49,-.22,.62,.35,.36],
 [2.93,.23,.27,.23,.07,.30,.14,.24],rest(3.26)
];
const altars=[
 rest(0), [.32,-.37,.54,-.44,-.18,-.26,-.43,.30],[.54,-.22,.29,-.13,.63,.22,-.28,.50],
 [.71,.41,.59,.41,-.12,.62,.47,.26],[.93,.08,.24,.15,.41,.17,.31,.42],
 [1.12,-.43,.54,-.44,-.08,.71,-.48,.27],[1.34,-.08,.20,-.15,.39,.14,-.31,.47],
 [1.53,.48,.57,.48,-.15,.70,.52,.31],[1.87,-.26,.31,-.33,.75,.20,-.25,.65],
 [2.11,-.16,.20,-.18,.79,.31,-.17,.67],[2.31,.68,.86,.64,-.47,.91,.51,.39],
 [2.49,.43,.51,.81,-.24,.72,.47,.23],rest(2.86)
];
const lightning=[
 rest(0),[.27,-.62,.60,-.57,.65,-.29,-.53,.49],[.53,-.20,.18,-.14,.97,.21,-.29,.68],
 [.70,.47,.48,.49,.40,.89,.68,.44],[.88,.08,.27,.06,.75,.33,.25,.68],
 [1.04,-.48,.43,-.47,.49,.87,-.56,.48],[1.21,-.09,.23,-.07,.81,.38,-.21,.61],
 [1.38,.44,.52,.55,.37,.94,.64,.37],[1.54,-.04,.22,-.05,.78,.36,.14,.71],
 [1.72,-.56,.49,-.57,.43,.92,-.60,.47],[1.99,-.42,.37,-.52,1.1,.29,-.79,.93],
 [2.11,-.25,.26,-.29,1.03,.34,-.53,.97],[2.35,.84,.87,.85,-.08,1.03,.74,.56],
 [2.51,.65,.59,.69,.01,.81,.82,.35],[2.75,.28,.22,.29,.25,.47,.33,.19],rest(3.02)
];
const gate=[
 rest(0),[.30,-.52,.59,-.51,-.13,-.32,-.70,.38],[.62,-.27,.24,-.25,.70,.28,-.32,.77],
 [.84,.42,.22,.45,1.03,.60,.70,1],[1.10,.19,.32,.24,.80,.49,.94,.95],
 [1.42,-.19,.28,-.22,.73,.25,-.05,.72],[1.68,-.45,.58,-.39,.44,.73,-.50,.54],
 [1.98,-.26,.30,-.24,.74,.47,-.36,.64],[2.28,-.51,.38,-.68,1.00,.15,-.73,.91],
 [2.47,-.20,.28,-.25,.88,.34,-.42,.87],[2.68,.78,.79,.80,.03,1.02,.85,.47],
 [2.86,.65,.52,.61,.16,.73,.78,.34],[3.09,.26,.22,.22,.35,.39,.30,.23],rest(3.38)
];

function curve(keys){
 const tangents=keys.map((key,i)=>key.map((_,column)=>{
   if(!column||i===0||i===keys.length-1)return 0;
   const previous=keys[i-1],next=keys[i+1];
   const left=key[0]-previous[0],right=next[0]-key[0];
   const a=(key[column]-previous[column])/left,b=(next[column]-key[column])/right;
   return a*b<=0?0:3*(left+right)/((2*right+left)/a+(right+2*left)/b);
 }));
 return (t,out)=>{
   let n=0;
   while(n+2<keys.length && t>=keys[n+1][0])n++;
   const a=keys[n],b=keys[n+1],span=b[0]-a[0];
   const u=Math.max(0,Math.min(1,(t-a[0])/span)),s=u*u,h=s*(3-2*u);
   for(let i=1;i<a.length;i++){
     out[i-1]=a[i]+(b[i]-a[i])*h+span*(u*(1-u)*(1-u)*tangents[n][i]-s*(1-u)*tangents[n+1][i]);
   }
 };
}
const sword={ultimate:curve(swordStorm),cast:curve(swordStars)};
const ward={ultimate:curve(mountain),cast:curve(altars)};
const thunder={ultimate:curve(lightning)};
const invoke=curve(gate);
const clamp01=x=>Math.max(0,Math.min(1,x));
function ramp(t,a,b){const u=clamp01((t-a)/(b-a));return u*u*(3-2*u);}

export function makeRitual(id,height,carrier,gait,rotate){
 const style=id==='sword'?sword:id==='ward'?ward:thunder;
 const hips=new Float32Array(7),torso=new Float32Array(7),hands=new Float32Array(7);
 return (pose,progress,follow)=>{
   const sample=pose==='invoke'?invoke:style[pose];
   const clip=actionTiming(id,pose);
   if(!sample||!clip)return false;
   const {duration,impacts}=clip,t=progress*duration,last=impacts.at(-1);
   // Hips initiate each change of direction; fingers arrive on the marked frame.
   sample(t+.067,hips);sample(t+.032,torso);sample(t,hands);
   const [weight,compression,hipTwist]=hips;
   const [bodyWeight,bodyCompression,twist,bodyLift,bodyReach]=torso;
   const [,load,,lift,reach,sweep,counter]=hands;
   const heavy=id==='ward', isGate=pose==='invoke';
   const active=ramp(t,0,.22)*(1-ramp(t,last+.24,duration));
   carrier.position.x+=height*weight*(heavy?.064:.074);
   carrier.position.y-=height*compression*(heavy?.089:.061);
   carrier.position.z+=height*(bodyReach*.038+bodyWeight*.016-bodyLift*.019);
   rotate('hips',4.6*compression-2.5*bodyLift,hipTwist*(heavy?9:12),-3.3*weight);
   rotate('spine',4.2*bodyReach-4.0*bodyLift,twist*8,-2.9*bodyWeight);
   rotate('chest',5.4*bodyReach-6.7*bodyLift,twist*(heavy?7.2:10.1),2.7*bodyWeight);
   rotate('neck',2.5*bodyLift-3.7*bodyReach,-twist*5.3,1.8*bodyWeight);
   rotate('head',-6.1*lift+3.9*load,-4.6*sweep+.8*twist,-2.1*weight);

   const launch=.12,land=heavy?.56:.47,pickup=last+.155,setdown=duration-.075;
   const open=ramp(t,launch,land),close=ramp(t,pickup,setdown);
   const raised=Math.sin(Math.PI*clamp01((t-launch)/(land-launch)))**2+Math.sin(Math.PI*clamp01((t-pickup)/(setdown-pickup)))**2;
   const lead=heavy?-1:1,stroke=open-close;
   gait.stance(lead,stroke*(heavy?.085:.145),stroke*(heavy?.082:.045),raised*.041,stroke*lead*.20);
   const flare=follow>=0?Math.sin(Math.PI*ramp(follow,0,.92)):0;
   if(heavy){
     gait.sealGrip(.255*lift-.054*load+.014*flare,.192*reach+.059*counter+.045*flare,.095*sweep);
     rotate('handR',-12*lift+17*reach+9*flare,7*sweep);
     rotate('handL',-12*lift+14*reach+8*flare,5*sweep);
   }else if(id==='sword'){
     gait.guideHand('L',.46*lift+.15*reach,.26*reach+.14*lift+.025*active,.16*sweep-.11*reach,active);
     rotate('handL',-20*lift+23*reach,22*sweep,-14*(reach-lift));
     // The weapon arm counterbalances the two-finger command, then cuts the
     // last diagonal as the sky sword reaches the paving.
     const bladeArc=isGate?.54:1;
     const guardLift=isGate?1-ramp(t,.22,.52):0;
     rotate('upperArmR',bladeArc*(-27*counter-31*reach-9*lift),bladeArc*(-13*counter+18*sweep),isGate?-13*counter:-10*lift+15*reach);
     rotate('forearmR',bladeArc*(-22*counter-16*lift+9*reach)-9*guardLift,bladeArc*(5*counter-9*sweep));
     rotate('handR',bladeArc*(-13*lift+17*reach),bladeArc*15*sweep,-10*counter);
   }else{
     const raisedHand=id==='thunder', leftArc=isGate?.94:.77;
     if(raisedHand){
       rotate('upperArmR',-22*lift-20*reach,-22*lift+24*sweep,-14*lift+12*reach);
       rotate('forearmR',-18*lift+20*reach,11*sweep);
     }else{
       gait.guideHand('R',.44*lift+.15*reach,.25*reach+.135*lift+.025*active,.14*sweep+.07*reach,active);
     }
     rotate('handR',-18*lift+20*reach,20*sweep,-11*(reach-lift));
     gait.guideHand('L',.38*counter*leftArc+.09*lift,.17*counter+.08*reach,-.14*sweep-.06*reach,active);
     rotate('handL',-12*counter+14*reach,-13*sweep,9*lift);
   }
   return true;
 };
}
