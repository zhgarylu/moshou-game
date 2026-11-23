// 玩法介绍视频：渲染音效、混音、合成 mp4。在 record.cjs 之后运行：
//   node tools/trailer/mix.cjs [输出路径]
// 游戏音效由 dist/sound.js 在离线音频环境里渲染，与旁白、台词、背景小调按 timeline.json 混合；
// 旁白出现时游戏声音自动压低。
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT||'/Users/gary/aiCode/lemo-opuscar-web/node_modules/playwright-core');

const root=path.resolve(__dirname,'../..'),out=path.join(root,'trailer');
const base=process.env.GAME_URL||'http://127.0.0.1:4186';
const SR=48000;
const timeline=JSON.parse(fs.readFileSync(path.join(out,'timeline.json'),'utf8'));
const target=process.argv[2]||path.join(out,'义庄惊雷-玩法介绍.mp4');

function decode(file){
  const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-f','f32le','-ac','1','-ar',String(SR),'-'],{maxBuffer:1<<28});
  return new Float32Array(raw.buffer,raw.byteOffset,raw.length/4);
}

async function renderInBrowser(){
  const kinds=[...new Set(timeline.events.filter(e=>e.type==='sfx').map(e=>e.key+'|'+(Math.round(e.power*20)/20)))];
  const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage();await page.goto(base+'/');
  const result=await page.evaluate(async({kinds,length,SR})=>{
    const {makeSound}=await import('/sound.js');
    const toB64=a=>{const u=new Uint8Array(a.buffer);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,i+32768));return btoa(s);};
    const sfx={};
    for(const k of kinds){
      const [kind,power]=k.split('|');
      window.AudioContext=class extends OfflineAudioContext{constructor(){super(1,SR*3.2,SR);window.__octx=this;}};
      const s=makeSound();s.init();s.sound(kind,Number(power));
      sfx[k]=toB64((await window.__octx.startRendering()).getChannelData(0));
    }
    // 背景小调：游戏里那段五声音阶，加低沉持续音与风声。
    const ctx=new OfflineAudioContext(1,Math.ceil(length*SR),SR),bus=ctx.createGain();bus.gain.value=.5;bus.connect(ctx.destination);
    const notes=[220,261.63,329.63,392,440,392,329.63,261.63],order=[0,2,1,0,5,3,1,0];
    const tone=(f,t,d,type,v)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(bus);o.start(t);o.stop(t+d+.05);};
    for(let t=1,i=0;t<length-1;t+=1.05,i++){const f=notes[order[i%8]];tone(f,t,1.2,'triangle',.09);tone(f*2,t,.8,'sine',.04);if(i%8===0)tone(f/2,t,4,'sine',.12);}
    for(let t=0;t<length;t+=8.4){tone(55,t,8.6,'sine',.1);}
    const n=ctx.createBuffer(1,SR*2,SR),d=n.getChannelData(0);let last=0;for(let i=0;i<d.length;i++){last=(last+.18*(Math.random()*2-1))/.995;d[i]=.7*(Math.random()*2-1)+.3*Math.max(-1,Math.min(1,last));}
    const src=ctx.createBufferSource(),lp=ctx.createBiquadFilter(),wg=ctx.createGain();src.buffer=n;src.loop=true;lp.type='lowpass';lp.frequency.value=420;wg.gain.value=.05;src.connect(lp);lp.connect(wg);wg.connect(bus);src.start();
    const bgm=toB64((await ctx.startRendering()).getChannelData(0));
    return {sfx,bgm};
  },{kinds,length:timeline.duration+2,SR});
  await browser.close();
  const f32=b=>{const buf=Buffer.from(b,'base64');return new Float32Array(buf.buffer,buf.byteOffset,buf.length/4);};
  return {sfx:Object.fromEntries(Object.entries(result.sfx).map(([k,v])=>[k,f32(v)])),bgm:f32(result.bgm)};
}

async function main(){
  const len=Math.ceil((timeline.duration+1.5)*SR);
  const narrBus=new Float32Array(len),gameBus=new Float32Array(len);
  const add=(bus,clip,t,gain)=>{const at=Math.round(t*SR);for(let i=0;i<clip.length&&at+i<len;i++)if(at+i>=0)bus[at+i]+=clip[i]*gain;};
  const {sfx,bgm}=await renderInBrowser();
  const cache=new Map(),clip=f=>{if(!cache.has(f))cache.set(f,decode(f));return cache.get(f);};
  const narrIndex=JSON.parse(fs.readFileSync(path.join(out,'voice/index.json'),'utf8'));
  const gameIndex=JSON.parse(fs.readFileSync(path.join(root,'dist/voice/index.json'),'utf8'));
  const duck=new Float32Array(len).fill(1);
  for(const e of timeline.events){
    if(e.type==='narr'){
      const c=clip(path.join(out,'voice',narrIndex[e.key].file));add(narrBus,c,e.t,1.15);
      // 旁白期间游戏声音压到四成，前后 0.25 秒渐变。
      const a=Math.round(e.t*SR),b=a+c.length,ramp=Math.round(.25*SR);
      for(let i=Math.max(0,a-ramp);i<Math.min(len,b+ramp);i++){const k=i<a?(a-i)/ramp:i>b?(i-b)/ramp:0;duck[i]=Math.min(duck[i],.4+.6*k);}
    }else if(e.type==='voice'&&gameIndex[e.key])add(gameBus,clip(path.join(root,'dist/voice',gameIndex[e.key].file)),e.t,.9*(e.gain??1));
    else if(e.type==='sfx'){const s=sfx[e.key+'|'+(Math.round(e.power*20)/20)];if(s)add(gameBus,s,e.t,.85);}
  }
  const mix=new Int16Array(len);
  for(let i=0;i<len;i++){
    const v=narrBus[i]+(gameBus[i]+(bgm[i]||0)*.8)*duck[i];
    mix[i]=Math.round(Math.tanh(v*1.1)*.92*32767);
  }
  const wav=path.join(out,'mix.wav'),header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(36+mix.byteLength,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(SR,24);header.writeUInt32LE(SR*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(mix.byteLength,40);
  fs.writeFileSync(wav,Buffer.concat([header,Buffer.from(mix.buffer)]));
  execFileSync('ffmpeg',['-y','-v','error','-framerate',String(timeline.fps),'-i',path.join(out,'frames/%05d.jpg'),'-i',wav,
    '-c:v','libx264','-preset','slow','-crf','21','-tune','animation','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ac','2','-shortest','-movflags','+faststart',target]);
  console.log('已输出',target);
}
main().catch(e=>{console.error(e);process.exit(1);});
