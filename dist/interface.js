import {drawRune,drawIcon} from './runes.js';
import {makeSound} from './sound.js';
import {disciplines,sevenStars} from './disciplines.js';
const $=id=>document.getElementById(id),audio=makeSound();
const skillButtons=[...document.querySelectorAll('[data-skill]')];
const keyMap={Digit1:'mark',Digit2:'chain',KeyR:'thunder',KeyQ:'summon',KeyE:'priest',Space:'dodge'};
const moveKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
const modal=$('dialog'),soundButton=$('sound'),play=$('start');
let game=null,opening=null,muted=false,dialogKind=null,lastFocus=null,visibleTarget=false;
try{muted=localStorage.getItem('daofa-mute')==='yes';}catch{}
document.querySelectorAll('[data-rune]').forEach(c=>drawRune(c,c.dataset.rune));document.querySelectorAll('[data-icon]').forEach(el=>drawIcon(el,el.dataset.icon));
for(let i=0;i<18;i++){const el=document.createElement('i');el.style.cssText='left:'+((i*41.79)%100)+'%;top:'+(25+(i*13.47)%70)+'%;animation-delay:-'+(i*.79)+'s;animation-duration:'+(6+i%6)+'s';$('dust').append(el);}
function setSound(){audio.mute(muted);drawIcon(soundButton.firstElementChild,muted?'mute':'sound');soundButton.setAttribute('aria-label',muted?'开启声音':'关闭声音');soundButton.setAttribute('aria-pressed',String(!muted));soundButton.title=muted?'开启声音（M）':'关闭声音（M）';}setSound();
function toggleSound(){audio.init();muted=!muted;setSound();try{localStorage.setItem('daofa-mute',muted?'yes':'no');}catch{}if(!muted)audio.sound('chime',.55);}
soundButton.onclick=toggleSound;
function screen(mode){document.body.dataset.mode=mode;$('menu').hidden=mode!=='title';$('battle').hidden=mode==='title';$('pause').hidden=mode==='title';}
function hideDialog(){modal.hidden=true;dialogKind=null;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
function panel(kind,kicker,title,body,actions){
  if(modal.hidden)lastFocus=document.activeElement;
  dialogKind=kind;$('dialog-kicker').textContent=kicker;$('dialog-title').textContent=title;$('dialog-body').innerHTML=body;
  const row=$('dialog-actions');row.replaceChildren();actions.forEach(([name,fn])=>{const b=document.createElement('button');b.textContent=name;b.onclick=fn;row.append(b);});
  modal.hidden=false;row.firstElementChild.focus({preventScroll:true});
}
function continueGame(){hideDialog();game?.resume();}
function returnToMenu(){hideDialog();game?.leave();screen('title');play.focus({preventScroll:true});}
function list(items){return '<dl>'+items.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>';}
let chosen = 'thunder';
const classButtons = [...document.querySelectorAll('[data-class]')];
const loreButtons = [...document.querySelectorAll('[data-lore]')];
function choose(id, remember=false){
  if(opening || !Object.hasOwn(disciplines,id))return;
  chosen=id;
  document.body.dataset.discipline=id;
  if(remember){try{localStorage.setItem('daofa-class',id);}catch{}}
  const spec=disciplines[id];
  classButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.class===id)));
  $('intro').textContent=spec.intro;
  document.querySelector('.vital-name').textContent=spec.name;
  document.querySelector('.actor-entry').href='./nuo.html?role='+id;
  document.querySelector('.aim-help').textContent='WASD 移动　·　拖动转向　·　单击'+spec.mark.name;
  for(const button of [...skillButtons,...loreButtons]){
    const slot=button.dataset.skill || button.dataset.lore;
    const ability=spec[slot];if(!ability)continue;
    button.querySelector('strong').textContent=ability.name;
    drawRune(button.querySelector('canvas'),ability.icon);
    if(button.dataset.lore)button.querySelector('small').textContent=ability.hint;
  }
  if(remember){const url=new URL(location.href);url.searchParams.set('class',id);history.replaceState(null,'',url);}
}
let remembered='thunder';try{remembered=localStorage.getItem('daofa-class') || remembered;}catch{}
const requested=new URLSearchParams(location.search).get('class');
choose(Object.hasOwn(disciplines,requested)?requested:Object.hasOwn(disciplines,remembered)?remembered:'thunder');
classButtons.forEach(b=>b.onclick=()=>choose(b.dataset.class,true));
function help(){
  if(opening||dialogKind==='result')return;
  const ingame=game?.state==='play'||game?.state==='paused',spec=disciplines[chosen];
  if(ingame)game.pause();
  panel('help',spec.name,'行法指南','<p>守住九十秒。黑无常沿地上的红色长道冲撞，向两侧让开。白无常在你脚下画拘魂圈，离圈可避，闪避可挣脱魂链。镇伏一名无常可回复十二点生命。</p>'+list([['移动 / 转动视角','WASD / 拖动画面'],[spec.mark.name+' / '+spec.chain.name,'单击或 1 / 2'],[spec.thunder.name+' / 请钟馗 / 请道长','R / Q / E'],['指地落阵','鼠标指向地面，按 Shift + R、Q 或 E'],['踏罡闪避 / 暂停','空格 / Esc']])+'<p>'+spec.thunder.text+' 职业大招每十五秒回气。开局有三印可请钟馗，每镇伏两名敌人再凝一印。一眉道长独立回气二十八秒。</p>',[[ingame?'返回战斗':'返回',ingame?continueGame:hideDialog]]);
}
$('help').onclick=help;
function pauseMenu(){if(!game?.pause())return;panel('pause','槐阴义庄','暂歇片刻','<p>试炼已暂停，回到战斗后继续计时。</p>',[['继续镇邪',continueGame],['返回山门',returnToMenu]]);}
$('pause').onclick=pauseMenu;
loreButtons.forEach(b=>b.onclick=()=>{
  if(opening)return;
  const slot=b.dataset.lore,ability=disciplines[chosen][slot];
  panel('lore',ability.school,ability.name,'<canvas id="detail-rune" class="dialog-art" width="80" height="80"></canvas><p>'+ability.text+'</p><p>'+(slot==='summon'?'Q · 消耗三枚天师印':slot==='priest'?('E · 回气 '+sevenStars.cooldown+' 秒'):'R · 回气 15 秒')+'</p>',[['入庄镇邪',start],['返回',hideDialog]]);
  drawRune($('detail-rune'),ability.icon);
});
function end(s){
  let best=s.kills;try{best=Math.max(s.kills,Number(localStorage.getItem('daofa-best'))||0);localStorage.setItem('daofa-best',best);}catch{}
  panel('result','槐阴义庄 · 试炼结算',s.win?'义庄已安':'法坛失守','<p>'+(s.win?'最后一声棺铃归于寂静，义庄的红灯重新亮起。':'法坛已破。看见黑无常的红色冲撞长道时向侧面闪避，白无常的拘魂圈亮起时先走出圈外。')+'</p>'+list([['守坛时间',s.elapsed+' 秒'],['镇邪数',s.kills+' 只 · 最高 '+best+' 只'],[disciplines[chosen].thunder.name,s.thunder+' 次'],['召唤钟馗',s.summon+' 次'],['一眉道长',s.priest+' 次'],['镇伏无常',s.envoys+' 名']]),[['再入义庄',start],['返回山门',returnToMenu]]);
}
const ui={
  hud(s){$('life').style.width=s.hp+'%';$('life-text').textContent=s.hp+' / 100';
    $('time').textContent=String(Math.floor(s.time/60)).padStart(2,'0')+':'+String(s.time%60).padStart(2,'0');$('kills').textContent=s.kills;$('phase').textContent=s.phase;
    $('seals').textContent='天师印　'+'◆ '.repeat(s.seals)+'◇ '.repeat(3-s.seals)+(s.seals<3&&s.sealCharge?'　凝印 1/2':'');
    for(const row of $('duo').children){
      const fraction=s.foes[row.dataset.foe];
      row.hidden=fraction===undefined;
      if(!row.hidden)row.style.setProperty('--hp',Math.ceil(fraction*100)+'%');
    }
    const condition=s.bound?'拘魂中 · 闪避脱身':s.shield?'护印 '+Math.ceil(s.shield)+'　'+Math.ceil(s.shieldTime)+'秒':'';
    if($('condition').textContent!==condition)$('condition').textContent=condition;
    for(const b of skillButtons){const name=b.dataset.skill,cd=s.cool[name],less=name==='summon'&&s.seals<3;const waiting=cd>.12||less;
      b.classList.toggle('waiting',waiting);b.lastElementChild.textContent=less?s.seals+'/3':cd>.12?String(Math.ceil(cd)):'';}
  },
  damage(v){$('hurt').style.opacity=Math.min(.85,v);},
  target(obj){const tag=$('target-tag');if(!obj){if(visibleTarget)tag.hidden=true;visibleTarget=false;return;}visibleTarget=true;tag.hidden=false;tag.style.left=obj.x+'%';tag.style.top=obj.y+'%';tag.querySelector('span').textContent=obj.label;tag.style.setProperty('--hp',(obj.hp*100)+'%');},
  banner(title,sub){const e=$('cast-banner');e.classList.toggle('show',!!title);e.querySelector('small').textContent=sub;e.querySelector('b').textContent=title;},
  notice(msg){$('notice').textContent=msg;$('notice').classList.toggle('show',!!msg);},end
};
async function start(){
  if(opening)return;audio.init();audio.sound('chime',.42);hideDialog();play.disabled=true;classButtons.forEach(b=>b.disabled=true);$('loading').textContent='正在开启法坛…';
  opening=(async()=>{try{
    if(!game){const {createCombat}=await import('./combat.js');game=await createCombat($('world'),ui,audio,chosen);}
    await game.selectClass(chosen);screen('play');game.start();
  }catch(error){console.error('义庄载入失败',error);screen('title');panel('error','槐阴义庄','法坛未能开启','<p>请重试载入角色。若画面持续无法打开，请确认浏览器已开启 WebGL 2 图形加速。</p>',[['重试',start],['返回',hideDialog]]);}
  finally{$('loading').textContent='';play.disabled=false;classButtons.forEach(b=>b.disabled=false);}})();await opening;opening=null;
}
play.onclick=start;
for(const b of skillButtons){b.addEventListener('click',()=>game?.skill(b.dataset.skill));}
window.addEventListener('keydown',e=>{
  if(e.code==='KeyM'&&!e.repeat){toggleSound();return;}
  if(!modal.hidden){if(e.code==='Escape'){e.preventDefault();if(dialogKind==='pause'||(dialogKind==='help'&&game?.state==='paused'))continueGame();else if(dialogKind!=='result')hideDialog();}
    if(e.key==='Tab'){const things=[...modal.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===things[0]){e.preventDefault();things.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===things.at(-1)){e.preventDefault();things[0].focus();}}return;}
  if(game?.state!=='play')return;
  if(e.code==='Escape'){e.preventDefault();pauseMenu();return;}
  if(moveKeys.has(e.code)){e.preventDefault();game.keys.add(e.code);}
  if(keyMap[e.code]){e.preventDefault();if(!e.repeat)game.skill(keyMap[e.code]);}
});
window.addEventListener('keyup',e=>game?.keys.delete(e.code));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.state==='play')pauseMenu();});
window.addEventListener('blur',()=>{game?.keys.clear();if(game){game.joy.x=game.joy.y=0;}});
const stick=$('joystick'),nub=stick.firstElementChild;let finger=null;
function moveStick(e){if(!game||finger!==e.pointerId)return;const b=stick.getBoundingClientRect(),dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2;
  const limit=b.width*.36,n=Math.max(1,Math.hypot(dx,dy)/limit);game.joy.x=dx/n/limit;game.joy.y=dy/n/limit;nub.style.transform='translate('+dx/n+'px,'+dy/n+'px)';}
stick.onpointerdown=e=>{finger=e.pointerId;stick.setPointerCapture(finger);moveStick(e);};stick.onpointermove=moveStick;
stick.onpointercancel=stick.onpointerup=()=>{finger=null;nub.style.transform='';if(game)game.joy.x=game.joy.y=0;};
