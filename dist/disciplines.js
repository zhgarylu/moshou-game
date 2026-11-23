// The key bindings are shared across the three disciplines. Q always opens Zhong Kui's gate.
const invocation = {
  name:'钟馗降临', icon:'summon', school:'三印请神', hint:'朱门请神 · 镇压群邪',
  text:'集三枚天师印开启朱门。钟馗走入阵眼挥出镇邪剑，重创范围内的敌人。每镇伏两名敌人可凝成一印。',
};
export const sevenStars = {
  gather:{time:2.08,damage:64,radius:6.45,stun:1},
  seal:{time:2.96,damage:260,radius:8.4,stun:3},
  duration:4.86,cooldown:28
};
// 糯米克尸：三职通用，取自《天师摇人》的糯米炮。撒出一片糯米，伤僵尸、粘住行动。
export const stickyRice = {radius:3.4, damage:30, envoyDamage:12, slow:3.6, cooldown:9};
const rice = {
  name:'糯米阵', icon:'rice', school:'糯米克尸', hint:'撒米成阵 · 粘尸迟缓',
  text:`向目标撒出一把糯米，在 ${stickyRice.radius} 米内对僵尸造成 ${stickyRice.damage} 点伤害，对阴差造成 ${stickyRice.envoyDamage} 点。被糯米粘住的敌人 ${stickyRice.slow} 秒内行动迟缓。`
};
const priest = {
  name:'七星伏魔', icon:'ritual', school:'一眉道长 · 踏罡封符', hint:'三清铃起 · 七星封阵',
  text:`请一眉道长执桃木剑、摇三清铃。北斗七星落入阵心，先造成 ${sevenStars.gather.damage} 点伤害并定身。朱砂敕令随即砸下，在更大范围内再造成 ${sevenStars.seal.damage} 点伤害，镇敌 ${sevenStars.seal.stun} 秒。`
};
export const disciplines = {
  thunder:{
    name:'雷法天师', actor:'thunder-guard', style:'符雷',
    intro:'以符为引，落雷破阵。黑白无常已至义庄。',
    mark:{name:'镇尸符',icon:'mark'}, chain:{name:'引连雷',icon:'chain'},
    thunder:{name:'五雷正法',icon:'thunder',school:'敕令 · 五方雷部',hint:'五雷连降 · 范围攻伐',
      text:'五枚雷符依次引下天雷，最后一雷在阵心炸开。先贴镇尸符，再用引连雷传击相邻的敌人。'},
    summon:invocation, priest, rice, markTag:'符', speed:4.6, light:0xa8ddff,
  },
  sword:{
    name:'剑诀天师', actor:'sword', style:'御剑',
    intro:'指引七星，万剑归宗。剑痕未消，再斩更重。',
    mark:{name:'飞剑诀',icon:'blade'}, chain:{name:'七星剑阵',icon:'stars'},
    thunder:{name:'万剑归宗',icon:'swordrain',school:'剑诀 · 万剑听令',hint:'群剑俯冲 · 天剑终斩',
      text:'飞剑诀留下剑痕。七星剑阵连续斩击阵内敌人，补上剑痕。万剑从天门俯冲，最后一柄巨剑消耗剑痕，追加伤害。'},
    summon:invocation, priest, rice, markTag:'剑痕', speed:5.05, light:0xa4fff1,
  },
  ward:{
    name:'镇坛天师', actor:'ward', style:'法印',
    intro:'立四象坛，擎狮印镇地。阵内困敌，大印护身。',
    mark:{name:'镇山印',icon:'seal'}, chain:{name:'四象镇坛',icon:'altars'},
    thunder:{name:'狮印撼岳',icon:'lionseal',school:'镇坛 · 金印敕山',hint:'狮印坠地 · 震敌护身',
      text:'镇山印震击目标。四象镇坛升起石柱，困住阵内敌人。狮钮巨印砸入地面，震慑群邪，并为自己加持可抵挡 28 点伤害的护印，持续六秒。'},
    summon:invocation, priest, rice, markTag:'印', speed:4.3, light:0xffbc72,
  }
};
