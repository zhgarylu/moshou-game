import * as THREE from './vendor/three.module.js';

const {clamp, lerp, smoothstep, degToRad} = THREE.MathUtils;
const TAU = 2 * Math.PI;
const up = new THREE.Vector3(0,1,0);
const pitchAxis = new THREE.Vector3(1,0,0);
const sides = ['L','R'];

// The artist's legs are already splayed in their standing pose. Recover each
// chain's own rest directions and lengths, rather than assuming a vertical T pose.
function limb(upper, lower, end) {
  return {upper,lower,end, a:lower.position.length(),b:end.position.length(),
    restUpper:lower.position.clone().normalize().applyQuaternion(upper.quaternion),
    restLower:end.position.clone().normalize().applyQuaternion(lower.quaternion),
    upperQ:upper.quaternion.clone(), lowerQ:lower.quaternion.clone()};
}

export function makeLocomotion(root, carrier, joints, role, height, variant) {
  const bone = name => joints[name].bone;
  const vec = () => new THREE.Vector3();
  const quat = () => new THREE.Quaternion();
  const goal=vec(), direction=vec(), knee=vec(), lowerAim=vec(), pole=vec(), shift=vec();
  const previous=vec(), velocity=vec(), local=vec(), rootQ=quat(), worldQ=quat(), aimQ=quat(), soleQ=quat(),toeYaw=quat();
  root.updateWorldMatrix(true,true);
  const mild=role==='white', heavy=role==='ward'||role==='judge'||role==='black';
  const legs=sides.map((side,i)=>{
    const chain=limb(bone('thigh'+side),bone('shin'+side),bone('foot'+side));
    return {...chain, sign:i?-1:1, rest:root.worldToLocal(chain.end.getWorldPosition(vec())),
      orientation:root.getWorldQuaternion(quat()).invert().multiply(chain.end.getWorldQuaternion(quat())),
      anchor:vec(),lastFreeFoot:vec(),lastTarget:vec(),stopStart:vec(),stance:vec(),stanceGoal:vec(),toe:0,toeGoal:0,planted:false,yaw:0};
  });
  const arms=sides.map((side,i)=>{
    const chain=limb(bone('upperArm'+side),bone('forearm'+side),bone('hand'+side));
    const parent=chain.upper.parent;
    return {...chain,rest:parent.worldToLocal(chain.end.getWorldPosition(vec())),sign:i?-1:1};
  });
  const preservedUpper=quat(),preservedLower=quat();
  let phase=0, weight=0, speed=0, run=0, duty=.60, stride=1, previousYaw=0, ready=false;
  let sideSpeed=0,forwardSpeed=0,yawRate=0,turnVelocity=0,acceleration=0,steerSide=0,steerForward=0;
  let settle=1, returning=1, wasFree=false, stopTime=1;
  let hopX=0,hopZ=0,hopLift=0;
  let rootDX=0,rootDZ=0,deltaYaw=0,previousSpeed=0;

  function reset() {
    phase=weight=speed=turnVelocity=acceleration=sideSpeed=forwardSpeed=steerSide=steerForward=yawRate=previousSpeed=0;
    ready=false;wasFree=false;returning=stopTime=1;hopX=hopZ=hopLift=0;
    for(const leg of legs){leg.stance.set(0,0,0);leg.stanceGoal.set(0,0,0);leg.toe=leg.toeGoal=0;leg.planted=false;leg.yaw=0;leg.anchor.copy(leg.rest);leg.lastTarget.copy(leg.rest);leg.stopStart.copy(leg.rest);}
  }

  function advance(pose,dt,input) {
    for(const leg of legs){leg.stanceGoal.set(0,0,0);leg.toeGoal=0;}
    const yaw=root.rotation.y;
    const yawDelta=ready?Math.atan2(Math.sin(yaw-previousYaw),Math.cos(yaw-previousYaw)):0;
    const c=Math.cos(yaw), s=Math.sin(yaw);
    const dx=ready?root.position.x-previous.x:0,dz=ready?root.position.z-previous.z:0;
    const scale=Math.max(.001,root.scale.x);
    const displaced=Math.hypot(dx,dz)>.000015 && Math.hypot(dx,dz)<height*.5;
    const virtual=!input && pose==='walk' && !displaced;
    const defaultSpeed=height*(mild?.58:heavy?.83:1.13);
    sideSpeed=input?.side ?? (dt>0 && displaced?(dx*c-dz*s)/dt:0);
    forwardSpeed=input?.forward ?? (virtual?defaultSpeed:dt>0 && displaced?(dx*s+dz*c)/dt:0);
    yawRate=input?.turn ?? (dt>0?yawDelta/dt:0);
    // A dodge has its own airborne silhouette. Restart travel from that landing.
    if(pose==='dodge'||pose==='charge'||pose==='dead'||(role==='corpse' && pose!=='walk')) sideSpeed=forwardSpeed=yawRate=0;
    sideSpeed/=scale;forwardSpeed/=scale;
    yawRate=clamp(yawRate,-8,8);
    const drive=Math.hypot(sideSpeed,forwardSpeed), turning=Math.abs(yawRate)*height*.17;
    speed=Math.min(height*3.8,Math.max(drive,turning));
    const blend=1-Math.exp(-dt*13);
    steerSide+=(sideSpeed-steerSide)*blend;steerForward+=(forwardSpeed-steerForward)*blend;
    settle=1-Math.exp(-dt*8);
    weight+=(smoothstep(speed/height,.025,.42)-weight)*blend;
    if(speed===0 && weight<.005)weight=0;
    turnVelocity+=(yawRate-turnVelocity)*(1-Math.exp(-dt*9));
    const impulse=dt>.00001?(speed-previousSpeed)/(height*dt):0;
    acceleration+=(clamp(impulse,-5,6)-acceleration)*(1-Math.exp(-dt*7));
    if(speed<.005 && previousSpeed>=.005){
      stopTime=0;
      for(const leg of legs)leg.stopStart.copy(leg.lastTarget);
    }
    if(speed<.005)stopTime=Math.min(1,stopTime+dt);
    previousSpeed=speed;
    run=smoothstep(speed/height,.8,2.25);
    duty=lerp(mild?.65:.60,heavy?.50:.46,run);
    stride=height*(heavy?.70:.77)+height*(heavy?.37:.41)*run;
    if(role==='corpse')stride=height*(variant===2?.89:.73);
    const advanceBy=dt*speed/stride;
    const oldPhase=phase;
    phase=(phase+advanceBy)%1;
    rootDX=virtual?0:(dx*c-dz*s)/scale;
    rootDZ=virtual?forwardSpeed*dt:(dx*s+dz*c)/scale;
    deltaYaw=yawDelta;
    previous.copy(root.position);previousYaw=yaw;ready=true;
    if(weight<.2)return false;
    return role==='corpse' ? (oldPhase<.78 && phase>=.78) : phase<oldPhase || (oldPhase<.5 && phase>=.5);
  }

  // A two-link analytic reach. Targets and poles are in the upper bone's
  // parent space; the rest directions can point laterally or already be bent.
  function reach(chain, target, hint) {
    direction.subVectors(target,chain.upper.position);
    const distance=Math.max(.00001,direction.length());direction.multiplyScalar(1/distance);
    const span=clamp(distance,Math.abs(chain.a-chain.b)+.00005,chain.a+chain.b-.00005);
    const along=(chain.a*chain.a-chain.b*chain.b+span*span)/(2*span);
    pole.copy(hint).addScaledVector(direction,-direction.dot(hint));
    if(pole.lengthSq()<.000001)pole.set(0,0,1).addScaledVector(direction,-direction.z);
    pole.normalize();
    knee.copy(direction).multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,chain.a*chain.a-along*along)));
    lowerAim.copy(direction).multiplyScalar(span).sub(knee).normalize();
    chain.upper.quaternion.setFromUnitVectors(chain.restUpper,knee.normalize()).multiply(chain.upperQ);
    lowerAim.applyQuaternion(aimQ.copy(chain.upper.quaternion).invert());
    chain.lower.quaternion.setFromUnitVectors(chain.restLower,lowerAim).multiply(chain.lowerQ);
  }

  function body(rotate) {
    if(weight<.0001){hopX=hopZ=hopLift=0;return;}
    const swing=Math.sin(TAU*phase), alternation=Math.cos(TAU*phase);
    const heel=Math.cos(TAU*2*phase), lean=clamp(forwardSpeed/height,-1.7,2.7);
    if(role==='corpse'){
      const flight=Math.max(0,Math.sin(Math.PI*clamp((phase-.20)/.58,0,1)));
      const load=Math.max(0,1-Math.abs((phase-.12)/.13));
      const landing=Math.max(0,1-Math.abs((phase-.83)/.15));
      const crouch=(load*.044+landing*.046)*weight;
      carrier.position.y+=height*(flight*.103*weight-crouch);
      // The game translates the hitbox continuously. Hold the body over its
      // feet during compression and carry that displacement into the jump.
      const leapOffset=(smoothstep(phase,.20,.78)-phase)*stride*weight;
      hopLift=flight*height*.139*weight;
      if(speed>.001){
        hopX=leapOffset*sideSpeed/speed;hopZ=leapOffset*forwardSpeed/speed;
      }else{
        hopX*=1-settle;hopZ*=1-settle;
      }
      carrier.position.x+=hopX;carrier.position.z+=hopZ;
      rotate('hips',(8*load-7*flight+6*landing)*weight,0,1.1*swing*weight);
      rotate('chest',(7*load+3*landing-4*flight)*weight);
      rotate('head',(-6*load+8*flight-6*landing)*weight);
      for(const {sign} of legs){
        const side=sign>0?'L':'R';
        rotate('thigh'+side,(-17*load-17*flight-18*landing)*weight);
        rotate('shin'+side,(32*load+23*flight+30*landing)*weight);
        rotate('foot'+side,(-14*load+3*flight-12*landing)*weight);
        rotate('upperArm'+side,(4*load-9*flight+6*landing)*weight,0,sign*1.2*swing*weight);
        rotate('hand'+side,(-8*flight+4*landing)*weight);
      }
      return;
    }
    const lay=weight*(heavy?.82:1);
    carrier.position.x+=height*((mild?.011:.023)*swing-.009*clamp(turnVelocity,-2,2))*lay;
    carrier.position.y-=height*(.037+.019*run+.021*heel)*weight;
    rotate('hips',2.0*lean*lay, -alternation*(heavy?5.0:7.2)*lay, 2.8*swing*lay);
    rotate('spine',(1.6*lean+clamp(acceleration,-3,3)*.51)*lay, alternation*4.2*lay, -2.1*swing*lay);
    rotate('chest',-1.0*heel*lay, (6.2*alternation+2*turnVelocity)*lay, -1.55*swing*lay);
    rotate('neck',-1.45*lean*lay,-3.8*alternation*lay);
    rotate('head',.9*heel*lay,1.5*swing*lay);
    for (const {sign} of legs){
      const side=sign>0?'L':'R';
      const holding=(side==='R'&&['thunder','white','sword','judge'].includes(role))||role==='ward'||(role==='black'&&side==='L');
      const arm=holding?3.8:11+5*run;
      const oscillation=(alternation*.88+swing*.18)*sign;
      rotate('upperArm'+side,oscillation*arm*lay,0,sign*(1.9+1.5*swing)*lay);
      rotate('forearm'+side,(-3.2-(holding?2:7)*Math.max(0,-oscillation))*lay);
      rotate('hand'+side,-oscillation*(holding?1.1:4)*lay);
    }
  }

  function plant(leg,angle) {
    // Neutralize the hip/knee rotation at a planted sole. Point the toe
    // through takeoff and lift it for heel contact on the next stride.
    root.localToWorld(goal.copy(local));leg.upper.parent.worldToLocal(goal);
    velocity.set(leg.sign*.14+clamp(sideSpeed/height,-1,1)*.16,.03,1);
    velocity.applyQuaternion(rootQ).applyQuaternion(leg.upper.parent.getWorldQuaternion(worldQ).invert());
    reach(leg,goal,velocity);
    leg.lower.getWorldQuaternion(worldQ).invert();
    soleQ.setFromAxisAngle(pitchAxis,angle);toeYaw.setFromAxisAngle(up,leg.yaw+leg.toe);
    leg.end.quaternion.copy(worldQ).multiply(rootQ).multiply(toeYaw).multiply(soleQ).multiply(leg.orientation);
  }

  function feet(pose,dt) {
    const response=1-Math.exp(-dt*24);
    for(const leg of legs){
      leg.stance.lerp(leg.stanceGoal,response);
      leg.toe+=response*(leg.toeGoal-leg.toe);
    }
    root.getWorldQuaternion(rootQ);
    if(role==='corpse'){
      if(pose==='walk'||pose==='idle'){
        for(const leg of legs){
          local.copy(leg.rest);local.x+=hopX;local.y+=hopLift;local.z+=hopZ;
          plant(leg,hopLift/height*.83);
        }
      }
      return;
    }
    if(pose==='dead'||pose==='dodge'||pose==='charge'||pose==='summon'){
      for(const leg of legs){
        root.worldToLocal(leg.end.getWorldPosition(leg.lastFreeFoot));
        leg.planted=false;
      }
      wasFree=true;
      return;
    }
    if(wasFree){returning=0;wasFree=false;}
    returning=Math.min(1,returning+dt/.15);
    const active=weight>.008 && speed>.005;
    const duration=stride/Math.max(.001,speed);
    for(const leg of legs){
      const step=(phase+(leg.sign>0?0:.5))%1;
      const swing=clamp((step-duty)/(1-duty),0,1);
      const impulse=Math.sin(Math.PI*swing);
      const toeDown=22*smoothstep(step/duty,.57,1)*(1-smoothstep(swing,0,.34));
      const toeUp=11*(1-smoothstep(step,.00,.16))+10*smoothstep(swing,.58,.93);
      const angle=degToRad((toeDown-toeUp)*weight);
      const reachTime=duration*duty*.5;
      const vx=steerSide+yawRate*leg.rest.z, vz=steerForward-yawRate*leg.rest.x;
      const maxReach=height*.31;
      const travelX=clamp(vx*reachTime,-maxReach,maxReach),travelZ=clamp(vz*reachTime,-maxReach,maxReach);
      // Keep a support foot fixed in the scene even while the master aims at
      // a moving target. Transform its previous anchor into today's root frame.
      leg.anchor.applyAxisAngle(up,-deltaYaw);
      leg.anchor.x-=rootDX;leg.anchor.z-=rootDZ;
      const steering=clamp(steerSide/height,-1,1)*.24*weight;
      if(active && step<duty){
        if(leg.planted)leg.yaw=clamp(leg.yaw-deltaYaw,-.76,.76);
        else{
          leg.yaw=steering;
          leg.anchor.copy(leg.rest);
          leg.anchor.x+=travelX*(1-2*step/duty);leg.anchor.z+=travelZ*(1-2*step/duty);
        }
        leg.planted=true;
      }else if(active){
        const ratio=-1+2*(swing*swing*(3-2*swing)-(1-duty)/duty*swing*(1-swing)*(1-2*swing));
        leg.anchor.copy(leg.rest);leg.anchor.x+=travelX*ratio;leg.anchor.z+=travelZ*ratio;
        leg.anchor.z+=height*.078*impulse*impulse*clamp(steerSide/height,-1,1)*leg.sign;
        leg.yaw+=(steering-leg.yaw)*settle;
        leg.planted=false;
      }else{
        leg.yaw+=(0-leg.yaw)*settle;
        leg.anchor.lerp(leg.rest,settle);leg.planted=false;
      }
      local.lerpVectors(leg.rest,leg.anchor,weight);
      // A drifting root or an abrupt reversal cannot stretch a knee past the
      // hip. Allow a corrective short step on the following contact.
      local.x=leg.rest.x+clamp(local.x-leg.rest.x,-maxReach,maxReach);
      local.z=leg.rest.z+clamp(local.z-leg.rest.z,-maxReach,maxReach);
      local.y=leg.rest.y+(Math.max(0,Math.sin(angle))*.072+(.078+.082*run)*impulse*impulse)*height*weight;
      if(speed<.005 && stopTime<.31){
        const rest=smoothstep(stopTime,0,leg.sign>0?.29:.26);
        local.lerpVectors(leg.stopStart,leg.rest,rest);
      }
      if(returning<1)local.lerp(leg.lastFreeFoot,1-smoothstep(returning,0,1));
      leg.lastTarget.copy(local);
      local.add(leg.stance);
      plant(leg,angle);
    }
  }

  // Both palms hold one seal. A shared target displacement keeps the joined
  // hands together from the crouch through an overhead invocation.
  function sealGrip(upward, forward, across=0) {
    shift.set(across,upward,forward);
    for(let iteration=0;iteration<3;iteration++){
      for(const arm of arms){
        local.copy(arm.rest).add(shift).sub(arm.upper.position);
        const d=local.length(),span=arm.a+arm.b,limit=span*.98,soft=span*.12;
        if(iteration===0 && d>limit-soft){
          const comfortable=limit-soft*Math.exp(-(d-limit+soft)/soft);
          shift.addScaledVector(local,(comfortable-d)/d);
        }else if(d>limit)shift.addScaledVector(local,(limit-d)/d);
      }
    }
    for(const arm of arms){
      goal.copy(arm.rest).add(shift);
      velocity.set(arm.sign*.86,-.82,-.22);
      reach(arm,goal,velocity);
    }
  }
  function guideHand(side,upward,forward,across,influence) {
    if(influence<=0)return;
    const arm=arms[side==='L'?0:1];
    goal.copy(arm.rest);goal.x+=across;goal.y+=upward;goal.z+=forward;
    // Keep a little bend at extension. A hard reach limit makes the elbow
    // suddenly flip from the free arc to a straight line at full extension.
    shift.subVectors(goal,arm.upper.position);
    const length=shift.length(),limit=arm.a+arm.b,soft=limit*.14;
    if(length>limit-soft){
      const distance=limit-soft*Math.exp(-(length-limit+soft)/soft);
      goal.copy(arm.upper.position).addScaledVector(shift,distance/length);
    }
    velocity.set(arm.sign*.72,-.70,-.42);
    preservedUpper.copy(arm.upper.quaternion);preservedLower.copy(arm.lower.quaternion);
    reach(arm,goal,velocity);
    arm.upper.quaternion.slerp(preservedUpper,1-influence);
    arm.lower.quaternion.slerp(preservedLower,1-influence);
  }

  function stance(lead,forward,width,lift,pivot){
    const leg=legs[lead>0?0:1],stationary=1-weight;
    leg.stanceGoal.set(lead*width*height,lift*height,forward*height).multiplyScalar(stationary);
    leg.toeGoal=pivot*stationary;
  }

  reset();
  return {advance,body,feet,sealGrip,guideHand,stance,reset,get phase(){return phase;},get weight(){return weight;},
    get bend(){return turnVelocity;},get acceleration(){return acceleration;}};
}
