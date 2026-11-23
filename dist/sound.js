export function makeSound(){
  let ctx=null,out=null,wind=null,muted=false,bed=null,nextSong=0,phrase=0;
  const notes=[220,261.63,329.63,392,440,392,329.63,261.63];
  function init(){
    if(ctx){if(ctx.state==='suspended')ctx.resume().catch(()=>{});return;}
    try{ctx=new AudioContext();out=ctx.createGain();out.gain.value=muted?0:.55;
      const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-14;out.connect(compressor);compressor.connect(ctx.destination);
      wind=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const data=wind.getChannelData(0);let last=0;
      for(let i=0;i<data.length;i++){last=(last+.18*(Math.random()*2-1))/.995;last=Math.max(-1,Math.min(1,last));data[i]=.73*(Math.random()*2-1)+last*.27;}
    }catch{}
  }
  function tone(f,end,dur,type,vol,delay=0){
    if(!ctx||muted)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),a=ctx.createGain();o.type=type;
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(18,end),t+dur);
    a.gain.setValueAtTime(.0001,t);a.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.012);a.gain.exponentialRampToValueAtTime(.0001,t+dur+.015);
    o.connect(a);a.connect(out);o.start(t);o.stop(t+dur+.03);
  }
  function noise(dur,cut,vol,delay=0,low=80){
    if(!ctx||!wind||muted)return;const t=ctx.currentTime+delay,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),a=ctx.createGain();
    s.buffer=wind;s.loop=true;f.type='lowpass';f.frequency.setValueAtTime(cut,t);f.frequency.exponentialRampToValueAtTime(low,t+dur);
    a.gain.setValueAtTime(.0001,t);a.gain.exponentialRampToValueAtTime(vol,t+.012);a.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(f);f.connect(a);a.connect(out);s.start(t,Math.random());s.stop(t+dur+.02);
  }
  function sound(k,p=1){if(!ctx||muted)return;p=Math.max(.3,Math.min(2,p));
    if(k==='thunder'){noise(.48,6000,.83*p);noise(1.1,690,.54*p,.12,45);tone(86,28,.83,'sine',.51*p);noise(.6,380,.32,.38);}
    if(k==='rumble'){noise(1.2,420,.28*p);tone(53,30,.8,'sine',.21*p);}
    if(k==='gong'){[1,1.48,2.03,2.44,3.73,5.9].forEach((r,i)=>tone(94*r,89*r,2.8/(1+i*.19),'sine',.39*p/(1+i*.6)));noise(.22,1200,.24);}
    if(k==='slash'){noise(.63,6600,.8*p);tone(330,35,.33,'sawtooth',.19*p);tone(83,32,1.05,'sine',.57*p);noise(.8,470,.32,.14);}
    if(k==='chime'||k==='seal'){[1,2.69,3.94].forEach((r,i)=>tone(312*r,306*r,.82,'sine',.16*p/(i+1)));}
    if(k==='mark'){tone(595,230,.14,'triangle',.19);noise(.12,2800,.26);}
    if(k==='chain'){noise(.27,6800,.43);tone(790,144,.23,'sawtooth',.10);}
    if(k==='blade'){tone(920,600,.18,'triangle',.14*p);tone(1630,1210,.24,'sine',.075*p);noise(.12,5600,.12*p);}
    if(k==='ritualBell'){[1,2.28,4.03].forEach((h,i)=>tone(712*h,698*h,.82-i*.13,'sine',p*.18/(1+i)));}
    if(k==='starGather'){
      [294,370,440,587,740].forEach((f,i)=>tone(f,f*1.025,.36,'sine',.17*p,i*.054));
      noise(.37,4600,.25*p,.04,560);tone(157,78,.42,'triangle',.25*p);
    }
    if(k==='sealStrike'){
      tone(128,32,.92,'sine',.77*p);noise(.28,3600,.69*p);noise(.87,850,.43*p,.10,62);
      [1,1.47,2.09,3.18,4.14].forEach((r,i)=>tone(129*r,119*r,1.9/(1+i*.19),'sine',.30*p/(1+i*.7),.035));
      tone(78,41,1.18,'sine',.34*p,.27);noise(.48,960,.17*p,.38,70);
    }
    if(k==='stone'){tone(125,63,.28,'triangle',.26*p);noise(.24,1100,.28*p);}
    if(k==='shackle'){[0,.12].forEach(d=>{noise(.16,3900,.35*p,d);tone(165,71,.23,'triangle',.2*p,d);});}
    if(k==='soul'){tone(580,382,.65,'sine',.16*p);tone(801,582,.82,'triangle',.09*p,.08);}
    if(k==='hurt'){tone(100,39,.22,'triangle',.23);noise(.19,640,.28);}
    if(k==='dodge')noise(.24,3500,.35);
    if(k==='step')noise(.07,370,.1);
    if(k==='win'){[0,2,3,4].forEach((n,i)=>tone(notes[n],notes[n],1,'triangle',.20,.18*i));}
    if(k==='lose'){tone(146,98,1.8,'triangle',.19);tone(73,49,2.1,'sine',.3);}
  }
  function ambience(on){if(!ctx||!wind)return;if(bed){bed.stop();bed=null;}if(!on)return;
    bed=ctx.createBufferSource();bed.buffer=wind;bed.loop=true;const f=ctx.createBiquadFilter(),a=ctx.createGain();f.type='lowpass';f.frequency.value=480;a.gain.value=.042;bed.connect(f);f.connect(a);a.connect(out);bed.start();nextSong=ctx.currentTime+1.7;phrase=0;}
  function update(){if(!ctx||!bed||muted||ctx.currentTime<nextSong)return;nextSong=ctx.currentTime+2.1;const f=notes[[0,2,1,0,5,3,1,0][phrase++%8]];tone(f,f*.997,1.15,'triangle',.047);tone(f*2,f*1.99,.77,'sine',.025);}
  return{init,sound,ambience,update,mute(v){muted=v;if(out)out.gain.setTargetAtTime(v?0:.55,ctx.currentTime,.04);}};
}
