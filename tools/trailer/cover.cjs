// 视频封面：在游戏里实拍去掉界面的大招画面作底图，再叠标题排版，输出 16:9 与 9:16 两张。
//   node tools/trailer/cover.cjs [输出目录]
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT||'/Users/gary/aiCode/lemo-opuscar-web/node_modules/playwright-core');
const root=path.resolve(__dirname,'../..');
const base=process.env.GAME_URL||'http://127.0.0.1:4186';
const outDir=process.argv[2]||path.join(root,'trailer');
// rw/rh 为底图实拍尺寸；shift 把主体从文字区移开（横版右移、竖版下移）。
const sizes=[{name:'16x9',w:1920,h:1080,rw:2600,rh:1080,shiftX:340,shiftY:0},{name:'9x16',w:1080,h:1920,rw:1080,rh:1920,shiftX:0,shiftY:260}];

// 底图：钟馗啖鬼，饕餮张口那一刻；隐藏全部界面。
async function shootBackdrop(browser,{rw:w,rh:h},{cast='summon',move='devour',at=3.05,yaw=0,tag=''}){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await page.goto(base+'/?debug&class=thunder');await page.waitForTimeout(800);
  await page.click('#start');
  await page.waitForFunction(()=>window.daofa&&window.daofa.state==='play',null,{timeout:60000});
  await page.evaluate(async({cast,move,at,yaw})=>{
    const d=window.daofa;d.pause();window.daofaShell.hideDialog();d.debugGod(true);d.debugView({yaw});
    for(let i=0;i<18;i++)d.debugAdvance(.5);
    d.debugAdvance(at,cast,move);
  },{cast,move,at,yaw});
  await page.addStyleTag({content:'#battle,header,#dialog,#relic-pick{display:none!important}'});
  await page.waitForTimeout(200);
  const file=path.join(outDir,`cover-bg-${move}${tag}-${w}x${h}.png`);await page.screenshot({path:file});await page.close();return file;
}

// 角色图鉴里的英叔正面全身像：受控时钟，停在施法手势的一刻，隐藏图鉴界面。
async function shootHero(browser,{rw:w,rh:h},{role='priest',view='body',at=1.1}={}){
  const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await page.clock.install();
  await page.goto(`${base}/nuo.html?role=${role}&view=${view}&angle=front`);
  await page.addStyleTag({content:'header,#cast,.transport,.angles,.lens,.caption{display:none!important}'});
  for(let i=0;i<400;i++){await page.clock.runFor(50);if(await page.evaluate(()=>document.querySelector('.status').hidden))break;await page.waitForTimeout(30);}
  for(let i=0;i<60;i++)await page.clock.runFor(33);
  await page.evaluate(()=>document.getElementById('play').click());
  for(let t=0;t<at;t+=1/30)await page.clock.runFor(33);
  const file=path.join(outDir,`cover-hero-${role}-${w}x${h}.png`);await page.screenshot({path:file});await page.close();return file;
}
function layout({w,h,rw,rh,shiftX,shiftY},bg){
  const tall=h>w;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box}
  body{width:${w}px;height:${h}px;overflow:hidden;background:#0a0606;font-family:"Kaiti SC","STKaiti","Songti SC",serif;color:#fff4dc}
  .bg{position:absolute;left:${(w-rw)/2+shiftX}px;top:${shiftY}px;width:${rw}px;height:${rh}px;background:url(data:image/png;base64,${fs.readFileSync(bg).toString('base64')}) 0 0/100% 100%}
  .shade{position:absolute;inset:0;background:${tall
    ?'linear-gradient(180deg,#000 0%,#000 14%,#0009 24%,#0000 40%,#0000 66%,#000c 84%,#000f 100%)'
    :'linear-gradient(90deg,#000e 0%,#000a 30%,#0000 58%),linear-gradient(0deg,#000a,#0000 30%)'}}
  .copy{position:absolute;${tall?'left:0;right:0;top:110px;text-align:center':'left:96px;top:120px;width:880px'}}
  .kicker{display:inline-block;font:700 ${tall?40:34}px "PingFang SC",sans-serif;letter-spacing:.18em;color:#1a0606;background:linear-gradient(90deg,#ffd27a,#ff9a3a);padding:8px 22px;border-radius:4px}
  h1{font-size:${tall?190:170}px;line-height:1.05;letter-spacing:.06em;margin-top:${tall?28:22}px;color:#ffe6b0;
     text-shadow:0 0 30px #ff3a10,0 0 70px #c00,0 8px 0 #3a0000,0 12px 30px #000}
  h2{font-size:${tall?60:54}px;letter-spacing:.14em;margin-top:${tall?18:14}px;text-shadow:0 4px 12px #000,0 0 20px #000}
  .tags{position:absolute;${tall?'left:0;right:0;bottom:150px;justify-content:center':'left:96px;bottom:92px'};display:flex;flex-wrap:wrap;gap:16px;max-width:${tall?w:1100}px;padding:0 40px}
  .tags span{font:600 ${tall?36:32}px "PingFang SC",sans-serif;padding:10px 24px;border:2px solid #ffd27a;border-radius:6px;background:#140808d9;color:#ffe2a8;letter-spacing:.08em}
  .ai{position:absolute;${tall?'left:0;right:0;bottom:70px;text-align:center':'right:70px;bottom:70px'};font:600 ${tall?30:28}px "PingFang SC",sans-serif;letter-spacing:.3em;color:#ffffffcc;text-shadow:0 2px 8px #000}
  .seal{position:absolute;${tall?'right:70px;top:540px':'right:110px;bottom:150px'};width:${tall?150:140}px;height:${tall?150:140}px;border:6px solid #e0201a;color:#e0201a;
     display:grid;place-items:center;font-size:${tall?60:56}px;line-height:1;transform:rotate(-8deg);background:#fff4dcd9;box-shadow:0 6px 20px #000a;font-weight:900;text-align:center;padding:6px}
  </style></head><body><div class="bg"></div><div class="shade"></div>
  <div class="copy"><span class="kicker">AI 做的国风 3D 驱鬼游戏</span><h1>义庄惊雷</h1><h2>九叔救命啊！</h2></div>
  <div class="seal">AI<br>制作</div>
  <div class="tags"><span>英叔出手</span><span>茅山神打</span><span>八卦照妖</span><span>钟馗啖鬼</span></div>
  <div class="ai">Three.js 实时渲染 · 浏览器即玩</div>
  </body></html>`;
}

(async()=>{
  fs.mkdirSync(outDir,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
  for(const size of sizes){
    const bg=await shootHero(browser,size);
    const page=await browser.newPage({viewport:{width:size.w,height:size.h},deviceScaleFactor:1});
    await page.setContent(layout(size,bg));await page.waitForTimeout(300);
    const file=path.join(outDir,`义庄惊雷-封面-${size.name}.png`);await page.screenshot({path:file});await page.close();
    console.log('封面',file);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
