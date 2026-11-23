// 玩法介绍视频：逐帧录制。先启动本机服务器，再运行
//   node tools/trailer/record.cjs
// 输出 trailer/frames/*.jpg 与 trailer/timeline.json（音效、台词、旁白的时间点）。
// 需要可解析的 playwright-core（PLAYWRIGHT 环境变量可指定路径）与本机 Chrome。
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT||'/Users/gary/aiCode/lemo-opuscar-web/node_modules/playwright-core');

const root=path.resolve(__dirname,'../..');
const out=path.join(root,'trailer'),frames=path.join(out,'frames');
const base=process.env.GAME_URL||'http://127.0.0.1:4186';
const FPS=30,DT=1/FPS;
const narr=JSON.parse(fs.readFileSync(path.join(out,'voice/index.json'),'utf8'));
const text=key=>narr[key].text,dur=key=>narr[key].dur;

const overlayCss=`
#tr{position:fixed;inset:0;z-index:99;pointer-events:none;font-family:"Kaiti SC","STKaiti","Songti SC",serif;color:#fff4dc}
#tr .cap{position:absolute;left:50%;bottom:150px;transform:translateX(-50%);max-width:1500px;padding:10px 34px;font-size:40px;line-height:1.35;text-align:center;
  background:linear-gradient(90deg,#0000,#080404cc 12%,#080404cc 88%,#0000);text-shadow:0 2px 0 #000,0 0 10px #000;letter-spacing:.04em;opacity:0;transition:none}
#tr .card{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center;opacity:0}
#tr .card h1{margin:0;font-size:120px;letter-spacing:.2em;color:#ffe2a8;text-shadow:0 0 30px #ff8a3a,0 6px 0 #000}
#tr .card h2{margin:18px 0 0;font-size:54px;letter-spacing:.14em;text-shadow:0 0 18px #000,0 3px 0 #000}
#tr .card p{margin:22px 0 0;font:500 30px "PingFang SC",sans-serif;letter-spacing:.3em;color:#e8d6b0;text-shadow:0 2px 4px #000}
#tr .chips{display:flex;gap:18px;justify-content:center;margin-top:30px}
#tr .chips span{font:600 30px "PingFang SC",sans-serif;padding:8px 24px;border:2px solid #d2b57c;border-radius:6px;background:#0c0a08cc;color:#ffe2a8;letter-spacing:.12em}
#tr .veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#0006,#000d 75%);opacity:0}
#tr .tag{position:absolute;right:48px;top:110px;font:600 24px "PingFang SC",sans-serif;letter-spacing:.3em;color:#ffe2a8;padding:6px 16px;border-left:4px solid #c8452c;background:#0008;opacity:0}
`;
const overlayHtml=`<div class="veil"></div><div class="card"></div><div class="tag"></div><div class="cap"></div>`;

async function main(){
  fs.rmSync(frames,{recursive:true,force:true});fs.mkdirSync(frames,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>console.log('页面错误',e.message));
  await page.goto(base+'/?debug&class=thunder');
  await page.waitForTimeout(1500);
  const setup=pg=>pg.addStyleTag({content:overlayCss}).then(()=>pg.evaluate(html=>{
    const d=document.createElement('div');d.id='tr';d.innerHTML=html;document.body.append(d);
    window.__vt=0;window.__log=[];window.__logging=true;
    // 页面动画按视频时间走：每帧手动推进 currentTime。
    window.__anim=ms=>{for(const a of document.getAnimations()){if(a.__vt===undefined){a.__vt=Number(a.currentTime)||0;a.pause();}a.__vt+=ms;a.currentTime=a.__vt;}};
  },overlayHtml));
  await setup(page);
  // 角色图鉴页：时钟由录制器控制，环视转台按视频时间转动。
  const gal=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  gal.on('pageerror',e=>console.log('图鉴错误',e.message));
  await gal.clock.install();
  await gal.goto(base+'/nuo.html?role=thunder&view=body&orbit=1');
  await gal.addStyleTag({content:'header,#cast,.transport,.angles,.lens{display:none!important}.caption{top:120px!important;left:110px!important;transform:scale(1.35);transform-origin:left top}'});
  await setup(gal);
  async function galReady(){for(let i=0;i<400;i++){await gal.clock.runFor(50);if(await gal.evaluate(()=>document.querySelector('.status').hidden))return;await gal.waitForTimeout(30);}}
  await galReady();

  let vt=0,index=0;const events=[];let caption=null;
  let cur=null;
  const set=(sel,prop,val)=>(cur||page).evaluate(([s,p,v])=>{const e=document.querySelector('#tr '+s);if(p==='html')e.innerHTML=v;else e.style[p]=v;},[sel,prop,val]);
  async function shoot(advance){
    const pg=cur||page;
    if(pg===gal)await gal.clock.runFor(1000*DT);
    await pg.evaluate(([dt,adv,vt,cap])=>{
      window.__vt=vt;
      if(adv&&window.daofa&&window.daofa.state==='paused')window.daofa.debugAdvance(dt);
      window.__anim(dt*1000);
      const c=document.querySelector('#tr .cap');
      if(cap&&vt>=cap.from&&vt<cap.to){c.textContent=cap.text;c.style.opacity=Math.min(1,(vt-cap.from)*6,(cap.to-vt)*6);}else c.style.opacity=0;
    },[DT,advance,vt,caption]);
    await pg.screenshot({path:path.join(frames,String(index++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:92});
    vt+=DT;
  }
  // 拍 seconds 秒；each(t) 在每帧之前调用，可在指定时刻施法、移动。
  async function film(seconds,each=null,advance=true){
    const n=Math.round(seconds*FPS);
    for(let i=0;i<n;i++){if(each)await each(i*DT);await shoot(advance);await guard();}
  }
  // 旁白：记下时间点，并在旁白期间显示字幕。
  function say(key,offset=0){const from=vt+offset;events.push({t:from,type:'narr',key});caption={from,to:from+dur(key),text:text(key)};return dur(key)+offset;}
  // 不录画面地快进游戏时间（换场前让敌人走近、跳到第 30 秒等）。
  async function skip(seconds){
    await page.evaluate(()=>window.__logging=false);
    for(let left=seconds;left>0;left-=.5){await page.evaluate(()=>{window.daofa.debugAdvance(.5);});await guard();}
    await page.evaluate(()=>window.__logging=true);
  }
  // 意外弹出法宝时自动选第一件，保持录制流程。
  async function guard(){
    if(cur===gal)return;
    const st=await page.evaluate(()=>window.daofa?.state);
    if(st==='relic'&&!allowRelic)await page.evaluate(()=>{document.querySelector('.relic-card').click();window.daofa.pause();document.getElementById('dialog').hidden=true;});
  }
  let allowRelic=false;
  const g=(fn,arg)=>page.evaluate(fn,arg);
  async function enterGame(cls){
    await g(async cls=>{
      const s=window.daofaShell,d=window.daofa;d.leave();s.choose(cls);await d.selectClass(cls);s.screen('play');d.start();d.pause();s.hideDialog();d.debugGod(true);
    },cls);
  }
  function hookAudio(){
    return g(()=>{
      const a=window.daofaShell.audio;if(a.__hooked)return;a.__hooked=true;
      const voice=a.voice,sound=a.sound;
      a.voice=(key,o={})=>{if(window.__logging)window.__log.push({t:window.__vt+(o.delay||0),type:'voice',key,gain:o.gain??1});return voice(key,o);};
      a.sound=(k,p=1)=>{if(window.__logging&&k!=='step')window.__log.push({t:window.__vt,type:'sfx',key:k,power:p});return sound(k,p);};
    });
  }

  // ---------- 1 · 开场钩子：钟馗啖鬼 ----------
  await page.click('#start');
  await page.waitForFunction(()=>window.daofa&&window.daofa.state==='play',null,{timeout:60000});
  await g(()=>{window.daofa.pause();window.daofaShell.hideDialog();window.daofa.debugGod(true);});
  await hookAudio();
  await skip(9);
  await g(()=>window.daofa.debugAdvance(0,'summon','devour'));
  let d=say('narr.hook',1.1);
  await film(5.2);
  // 标题卡：画面压暗，亮出游戏名。
  await set('.veil','opacity','1');
  await set('.card','html','<h1>义庄惊雷</h1><h2>道法世界 · 第一案</h2><p>槐阴镇 · 子时 · 黑白无常勾魂</p>');
  d=say('narr.hello',.2);
  await film(d+.3,async t=>{await set('.card','opacity',String(Math.min(1,t*2.5,(d+.3-t)*3)));},false);
  await set('.card','opacity','0');await set('.veil','opacity','0');

  // ---------- 2 · 角色一览（角色图鉴环视） ----------
  cur=gal;
  const tag=t=>set('.tag','html',t).then(()=>set('.tag','opacity',t?'1':'0'));
  const showRole=async(name,label='')=>{
    const key={'雷法天师':'thunder','剑诀天师':'sword','镇坛天师':'ward','钟馗':'judge','一眉道长':'priest','黑无常':'black','白无常':'white','跳僵':'corpse'}[name];
    const ok=await gal.evaluate(k=>{const a=document.querySelector('#cast a[data-role="'+k+'"]');if(!a)return false;a.click();return true;},key);
    if(!ok)throw new Error('图鉴里找不到角色 '+name);
    for(let i=0;i<200;i++){await gal.clock.runFor(20);if(await gal.evaluate(n=>document.querySelector('.caption h1').textContent===n,name))break;}
    await galReady();await tag(label);
  };
  d=say('narr.roster1',.1);
  for(const n of ['雷法天师','剑诀天师','镇坛天师']){await showRole(n,'主角 · 天师');await film((d+.2)/3);}
  d=say('narr.roster2',.1);
  await showRole('钟馗','帮手 · 三印请神');await film(2.3);
  await showRole('一眉道长','帮手 · 英叔 / 九叔');await film(d-2.3+.3);
  d=say('narr.roster3',.1);
  for(const n of ['黑无常','白无常','跳僵']){await showRole(n,'对手 · '+n);await film(1.55);}
  // 纸人、飞头蛮不在图鉴里，切回实战镜头。
  cur=null;await enterGame('thunder');await skip(15.2);await tag('对手 · 纸人 · 飞头蛮');
  await film(Math.max(1.6,d+.2-4.65));
  // AI 制作说明：叠在角色环视上。
  cur=gal;await showRole('钟馗','');
  await gal.evaluate(()=>document.querySelector('.caption').style.opacity=0);
  await set('.veil','opacity','.85');
  await set('.card','html','<h2 style="font-size:66px">一款由 AI 全程打造的游戏</h2><div class="chips"><span>角色建模</span><span>动作</span><span>特效</span><span>代码</span><span>配音</span></div><p>全部由 AI 完成</p>');
  d=say('narr.ai',.15);
  await film(d+.25,async t=>{await set('.card','opacity',String(Math.min(1,t*3)));});
  await showRole('一眉道长','');
  await set('.card','html','<h2 style="font-size:66px">Three.js 实时 3D 渲染</h2><div class="chips"><span>WebGL 2</span><span>浏览器打开即玩</span><span>无需下载</span></div><p>三职业 · 八种请神招式 · 十件法宝 · 双首领</p>');
  d=say('narr.three',.15);
  await film(d+.35,async t=>{await set('.card','opacity',String(Math.min(1,t*3,(d+.35-t)*3)));});
  await set('.card','opacity','0');await set('.veil','opacity','0');await tag('');
  cur=null;

  // ---------- 3 · 入庄 ----------
  await enterGame('thunder');
  await tag('守住九十秒');
  d=say('narr.story',.2);
  await film(d+.4,async t=>{await g(t=>window.daofa.debugView({yaw:-.35+.35*Math.min(1,t/5)}),t);});

  // ---------- 3 · 三个职业 ----------
  await tag('雷法天师 · 五雷正法');
  d=say('narr.thunder',.1);
  await film(Math.max(d+.3,4.6),async t=>{if(Math.abs(t-1.6)<DT/2)await g(()=>window.daofa.debugAdvance(0,'thunder'));});
  await enterGame('sword');await skip(4);
  await tag('剑诀天师 · 万剑归宗');
  d=say('narr.sword',.1);
  await film(Math.max(d+.3,4.4),async t=>{if(Math.abs(t-.3)<DT/2)await g(()=>window.daofa.debugAdvance(0,'thunder'));});
  await enterGame('ward');await skip(4);
  await tag('镇坛天师 · 狮印撼岳');
  d=say('narr.ward',.1);
  await film(Math.max(d+.4,4.2),async t=>{if(Math.abs(t-.2)<DT/2)await g(()=>window.daofa.debugAdvance(0,'thunder'));});

  // ---------- 4 · 敌人与闪避 ----------
  await enterGame('thunder');await skip(12);
  await tag('跳僵 · 纸人 · 飞头蛮');
  d=say('narr.foes',.1);
  await film(d+.3,async t=>{if(Math.abs(t-2)<DT/2)await g(()=>window.daofa.debugAdvance(0,'chain'));});
  await tag('黑白无常 · 看地上预警');
  d=say('narr.dodge',.1);
  await film(d+.4,async t=>{
    if(Math.abs(t-.5)<DT/2)await g(()=>window.daofa.keys.add('KeyA'));
    if(Math.abs(t-1.6)<DT/2||Math.abs(t-4)<DT/2)await g(()=>window.daofa.debugAdvance(0,'dodge'));
    if(Math.abs(t-2.4)<DT/2)await g(()=>{window.daofa.keys.delete('KeyA');window.daofa.keys.add('KeyD');});
    if(Math.abs(t-4.8)<DT/2)await g(()=>window.daofa.keys.delete('KeyD'));
  });
  await tag('3 · 糯米阵');
  d=say('narr.rice',.1);
  await film(d+.3,async t=>{if(Math.abs(t-1.7)<DT/2)await g(()=>window.daofa.debugAdvance(0,'rice'));});

  // ---------- 5 · 请钟馗 ----------
  await enterGame('thunder');await skip(9);
  await tag('Q · 三印请神');
  d=say('narr.summon',.1);
  await film(d+.3,async t=>{if(Math.abs(t-3.3)<DT/2)await g(()=>window.daofa.debugAdvance(0,'summon'));});
  const pick=n=>g(n=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'Digit'+n,key:String(n)}));window.daofa.pause();window.daofaShell.hideDialog();},n);
  await tag('钟馗 · 啖鬼');await pick(2);
  say('narr.judge',.2);
  await film(4.4);
  await tag('钟馗 · 朱笔勾名');await skip(2);await g(()=>window.daofa.debugAdvance(1.2,'summon','brush'));
  await film(2.6);
  await tag('钟馗 · 五鬼听令');await skip(2);await g(()=>window.daofa.debugAdvance(1.4,'summon','ghosts'));
  await film(3.2);

  // ---------- 6 · 请九叔 ----------
  await enterGame('thunder');await skip(8);
  await tag('E · 请一眉道长');
  d=say('narr.priest',.1);
  await film(1.3,async t=>{if(Math.abs(t-.2)<DT/2)await g(()=>window.daofa.debugAdvance(0,'priest'));});
  await tag('九叔 · 墨斗封尸');await pick(2);
  await film(2.3,async t=>{if(Math.abs(t)<DT/2)await g(()=>window.daofa.debugAdvance(.5));});
  await tag('九叔 · 八卦照妖');await skip(1);await g(()=>window.daofa.debugAdvance(.9,'priest','mirror'));
  await film(1.6);
  await tag('九叔 · 茅山神打');await skip(1);await g(()=>window.daofa.debugAdvance(.9,'priest','possess'));
  await film(Math.max(2.6,d-7.2+2.6));

  // ---------- 7 · 法宝三选一 ----------
  await enterGame('sword');await skip(28);
  allowRelic=true;
  await tag('香案显灵 · 法宝三选一');
  d=say('narr.relic',.1);
  let opened=false;
  await film(d+.4,async t=>{
    const st=await g(()=>window.daofa.state);
    if(!opened&&st!=='relic')return;
    opened=true;
    if(Math.abs(t-3.6)<DT/2)await g(()=>{document.querySelectorAll('.relic-card')[1].click();window.daofa.pause();window.daofaShell.hideDialog();});
  });
  allowRelic=false;

  // ---------- 8 · 收尾 ----------
  await tag('');
  await skip(62);
  await g(()=>{const d=document.getElementById('dialog');d.hidden=false;});
  events.push({t:vt+.1,type:'voice',key:'sword.win'});
  d=say('narr.outro',1.3);
  await film(3.2,null,false);
  await set('.card','html','<h1>义庄惊雷</h1><h2>AI 制作 · Three.js 实时渲染</h2><p>浏览器打开即玩</p>');
  await g(()=>{document.getElementById('dialog').hidden=true;});
  await set('.veil','opacity','1');
  await film(Math.max(3.4,d-3),async t=>{await set('.card','opacity',String(Math.min(1,t*2)));},false);

  const log=await g(()=>window.__log);
  fs.writeFileSync(path.join(out,'timeline.json'),JSON.stringify({fps:FPS,frames:index,duration:vt,events:[...events,...log].sort((a,b)=>a.t-b.t)},null,1));
  console.log('录制完成',index,'帧',vt.toFixed(1),'秒');
  await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
