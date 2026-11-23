// 法宝三选一：取自《天师摇人》每波结束后的「请一件改命法宝」。
// 第 30、60 秒香案显灵，暂停战斗，从池中抽三件（本职业的专属法宝优先出现一次）。
export const relicTimes=[30,60];

export function freshMods(){
  return {dmg:1,taken:1,sealPer:2,chainExtra:0,chainDmg:1,swordCd:1,wardShield:0,wardCd:1,
    riceR:1,riceSlow:0,ultCd:15,dodgeCd:2.25,priestCd:28};
}

// tag 显示在卡片角上；max 为一局内最多选几次；only 限定职业；apply 收到 mods 与战斗上下文。
export const relics=[
  {id:'heavenThunder',name:'天雷灌顶',tag:'雷法专属',only:'thunder',max:1,icon:'chain',
    desc:'引连雷多跳一名敌人，连雷伤害提高三成。',apply:m=>{m.chainExtra+=1;m.chainDmg*=1.3;}},
  {id:'sevenStars',name:'七星剑匣',tag:'剑诀专属',only:'sword',max:1,icon:'stars',
    desc:'飞剑诀与七星剑阵回气快四分之一。',apply:m=>{m.swordCd*=.75;}},
  {id:'lionAwaken',name:'石狮开光',tag:'镇坛专属',only:'ward',max:1,icon:'lionseal',
    desc:'狮印护身多抵 14 点伤害，四象镇坛回气快两成。',apply:m=>{m.wardShield+=14;m.wardCd*=.8;}},
  {id:'moreRice',name:'糯米加量',tag:'改招式',max:1,icon:'rice',
    desc:'糯米阵范围扩大三成，粘尸时间多 1.5 秒。',apply:m=>{m.riceR*=1.3;m.riceSlow+=1.5;}},
  {id:'merit',name:'功德修复',tag:'回元',max:2,icon:'ritual',
    desc:'立刻回复 35 点生命，此后全部法术伤害提高一成半。',apply:(m,c)=>{c.heal(35);m.dmg*=1.15;}},
  {id:'goldSeal',name:'金印加持',tag:'请神',max:1,icon:'summon',
    desc:'立刻补满三枚天师印。此后每镇伏一名敌人就凝一印。',apply:(m,c)=>{c.fillSeals();m.sealPer=1;}},
  {id:'altarBreath',name:'法坛回气',tag:'大招',max:1,icon:'thunder',
    desc:'职业大招回气从 15 秒缩短到 10 秒。',apply:m=>{m.ultCd=10;}},
  {id:'stepper',name:'罡步轻身',tag:'身法',max:1,icon:'dodge',
    desc:'踏罡步回气缩短四成。',apply:m=>{m.dodgeCd*=.6;}},
  {id:'goldTalisman',name:'护身金符',tag:'防守',max:1,icon:'mark',
    desc:'此后受到的伤害减少四分之一。',apply:m=>{m.taken*=.75;}},
  {id:'eyebrow',name:'道长随行',tag:'请道长',max:1,icon:'ritual',
    desc:'七星伏魔回气从 28 秒缩短到 18 秒。',apply:m=>{m.priestCd=18;}},
];

export function drawRelics(classId,taken,count=3){
  const times=id=>taken.filter(x=>x===id).length;
  const open=relics.filter(r=>(!r.only||r.only===classId)&&times(r.id)<r.max);
  const own=open.filter(r=>r.only),rest=open.filter(r=>!r.only);
  for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
  // The discipline's own relic shows up on the first draw, so every class meets it once.
  return [...own,...rest].slice(0,count);
}
