# 道法世界 · 义庄惊雷

在槐阴镇义庄选择一个天师职业，迎战跳僵与黑白无常，守过九十秒。结算后可以再入义庄，或回山门换职业。

## 本机启动

进入本目录后运行 `python3 -m http.server 4186 --bind 127.0.0.1 --directory dist`，再打开[试玩入口](http://127.0.0.1:4186/)。浏览器需支持 WebGL 2。Three.js、封面与游戏素材随项目提供。

WASD 移动，拖动画面转向，空格闪避，Esc 暂停。触屏可用左下摇杆移动，点击右下法术施放。默认瞄准附近敌人，按住 Shift 并指向地面施放 R、Q 或 E，可以指定阵眼。

| 职业 | 单击 / 1 | 2 | R · 十五秒回气 |
| --- | --- | --- | --- |
| [雷法天师](http://127.0.0.1:4186/?class=thunder) | 镇尸符 | 引连雷 | 五雷正法，五方雷符依次降雷 |
| [剑诀天师](http://127.0.0.1:4186/?class=sword) | 飞剑诀留剑痕 | 七星剑阵连斩、续剑痕 | 万剑归宗，剑雨之后以巨剑引爆剑痕 |
| [镇坛天师](http://127.0.0.1:4186/?class=ward) | 镇山印 | 四象镇坛困敌 | 狮印撼岳，落印震敌，为自身加持六秒、二十八点护印 |

三个职业按 E 都可请一眉道长踏罡摇铃，以桃木剑引出七星伏魔阵。七星合阵造成 64 点范围伤害并定身 1 秒，随后朱符落印在 8.4 米内造成 260 点伤害并镇住敌人 3 秒，独立回气 28 秒。

三个职业入场都有三枚天师印，按 Q 召唤钟馗。每镇伏两名敌人凝回一印，集齐三印可再次召唤。黑无常开场巡夜，沿红色长道冲撞。白无常第八秒入场，在玩家脚下画拘魂圈。踏罡步能挣脱魂链，引黑无常撞断魂链可使两名阴差同时失衡。镇伏一名无常可回复最多十二点生命。第七十二秒两名无常同时登场。

调试时在地址后加 `?debug`，控制台可用 `daofa.pause()` 暂停，再用 `daofa.debugAdvance(秒数, 'thunder')` 施放技能并逐帧推进，方便对照大招每一拍的画面。

## 角色与定稿对照

[义庄角色试装](http://127.0.0.1:4186/nuo.html) 收录三位天师、钟馗、一眉道长、跳僵与黑白无常。可切换八个实时造型，在同一角度看正侧面、背面或实战距离，并用常速、四分之一速或时间轴查看各自的两秒动作。

图鉴可分别查看人物的左侧、右侧、背面及面部。点「环视」会连续绕人物转动，「原画对照」跟随镜头显示就近的参考图。前侧、背面和面部使用定稿，左右侧与雷法垂手前侧使用建模补图。选择职业大招或「请钟馗」后，点击「法术同演」可看手势与阵法同时演出。再次点击可近看角色动作。[剑诀天师大招环视](http://127.0.0.1:4186/actors.html?role=sword&view=side&motion=ultimate&turn=1)

实战八套造型从同一套 Three.js 试装模型烘成蒙皮 GLB，位于 `dist/art/battle`。实战步态叠加在职业动作上。需要重新烘焙时，先启动上面的本机服务器，在可解析 playwright、three@0.170.0 和 meshoptimizer@0.18.1 的 Node 环境中运行 `node tools/bake-battle.cjs`，也可在命令最后加角色 ID 以单独更新。以下原画图鉴使用早期的独立 GLB。袖臂独立于袍身蒙皮，三根辅助骨控制衣摆，剑、锏、法幡跟随握持手。剑诀的双靴与袍摆各自活动，行进时抬肘提剑，让剑尖离地。钟馗的两枚帽翅跟随头部转动。实战根据人物实际位移、转速和身高计算落脚点，移动中施法时保留步态。离线建模输入位于 `../角色设定/建模输入`。安装 Python 包 `numpy Pillow scipy scikit-image fast-simplification manifold3d xatlas` 后可重新导出。

面部拟合使用 MediaPipe 的 468 点脸部曲面作几何模板。每个角色按定稿的双眼、鼻尖、唇、下颏及双侧轮廓重新定向、缩放并与颅面融合。模板只用于离线建模，游戏加载本地角色资产。[模板来源](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj) · [Apache 2.0 许可证](tools/face-geometry/LICENSE)

```sh
python3 tools/build_actors.py "../角色设定/建模输入" dist/art/actors --body-output "../角色设定/建模输入"
python3 tools/build_view_textures.py "../角色设定/建模输入" dist/art/actors
python3 tools/build_head_pigment.py "../角色设定/建模输入" dist/art/actors
python3 tools/build_undercoat.py dist/art/actors
```

## 封面制作记录

三张职业封面由内置 ImageGen 生成。剑诀与镇坛封面沿用雷法封面的义庄构图，分别以剑诀、镇坛天师的定稿三视图为人物参考。切换职业时山门同步换画。场内角色、院落、技能和镜头由 Three.js 实时渲染。

<details><summary>封面最终提示词</summary>

Stylized concept art, a AAA Chinese dark fantasy RPG key visual / immersive game title screen background, extremely wide horizontal 16:9 cinematic painting. A traditional Chinese mortuary courtyard at night, a formidable ornate Chinese temple with authentic swooping tile eaves and glowing red paper lanterns, black mountains, hanging prayer talismans, silver mist, wet slate reflecting warm lantern light. On the RIGHT half in the foreground a charismatic adult Taoist exorcist seen from behind in three-quarter profile, wearing flowing dark navy and ivory robes with bright cinnabar sash that whips sideways, topknot, right hand raised in a two-finger lightning spell holding a glowing yellow paper talisman; art-directed SILVER ICE BLUE / WHITE storm lightning forks above the central roof and catches the wet sleeves. The figure is large enough to read from waist up with head at x≈73%, y≈34%, with the spell and flying golden talismans on the right. Gentle ember flecks. LEFT THIRD is much darker muted blue-black foggy architectural silhouette with subtle detail, deliberately quiet to receive a game title overlay. Polished fantasy matte painting with tactile brushwork and elegant stylized forms, very readable architecture composition, rich teal storm shadows, blazing white lightning and scarlet punctuation. Widescreen, full image bleed, a single coherent illustrated environment. No typography, no logo, no emblems, no lettering, no UI, no borders.

</details>

<details><summary>剑诀封面最终提示词</summary>

输出为 [art/sword-court.jpg](dist/art/sword-court.jpg)。

Create one complete ultrawide 16:9 cinematic landscape fantasy game selection background, same image dimensions and framing as reference 1. Edit reference 1 to feature the character from reference 2. Preserve its wet slate mortuary courtyard, architecture, red paper lanterns, dark left third reserved for UI, stormy night, composition, tactile realistic visual detail. Replace the entire existing figure on the right, spell and lightning with this subject: The slender young Chinese sword-discipline woman, reproduce the exact angular face, loose dark hair in a martial bun, worn ivory linen layers, dark burgundy wraps and narrow scabbard from ref 2. Show a strong rear three-quarter waist-up pose, her resolute facial profile shown to the left, one hand directing a deliberate ring of seven individually readable flying Chinese jian over the roof in the upper-right twilight. Restrained cyan edges and tiny gold inscriptions on steel blades, long burgundy silk, cinematic icy jade lighting. Hero takes up right 40%, head around x=74%, y=30%, fitting whole head and silhouette. Full bleed physically painted realistic Chinese dark-fantasy concept illustration. No lettering, typography, border, UI, logo or extra people.

</details>

<details><summary>镇坛封面最终提示词</summary>

输出为 [art/ward-court.jpg](dist/art/ward-court.jpg)。

Create one complete ultrawide 16:9 cinematic landscape fantasy game selection background, same image dimensions and framing as reference 1. Edit reference 1 to feature the character from reference 2. Preserve its wet slate mortuary courtyard, architecture, red paper lanterns, dark left third reserved for UI, stormy night, composition, tactile realistic visual detail. Replace the entire existing figure on the right, spell and lightning with this subject: The stocky middle-aged male altar guardian, match his exact heavy eyebrows, squared face, moustache, short goatee, black topknot, weathered layered red/umber/dull bronze armor, red tassel and jade guardian-lion left shoulder from reference 2. Show him waist-up in three-quarter back profile facing left, one hand raising a carved squat aged celadon Chinese guardian-lion seal on a bronze square stamp, emitting concentric molten amber ritual lines and airborne rocks behind him, warm volcanic amber illumination on clearly readable bronze armor. Hero takes up right 40%, head around x=74%, y=30%, fitting whole head and silhouette. Full bleed physically painted realistic Chinese dark-fantasy concept illustration. No lettering, typography, border, UI, logo or extra people.

</details>

<details><summary>三视图狮印法器最终提示词</summary>

内置 ImageGen 以镇坛天师定稿为参考生成三视图，重建为 [art/ward-lion-seal.glb](dist/art/ward-lion-seal.glb)。

GAME PROP TEXTURE CAPTURE. Use the stone guardian lion on the supplied Taoist master's back as sculpture reference only. Show ONLY ONE ancient Chinese imperial stone seal sculpture from three technical viewpoints, arranged as THREE isolated entire objects in a single 3-column wide landscape sheet with transparent background. Same sculpture in all three columns, same height, same horizontal baseline, ample clear gaps; from left to right: perfectly frontal symmetrical face looking into camera (not three-quarter), exact anatomical left profile with the muzzle facing LEFT, straight-on back of the lion. Orthographic camera at the middle height of the lion, level horizontal. A ferociously dignified weathered Ming Chinese shishi guardian lion carved from dark gray-green moss-flecked stone, crouched atop a square seal block: fierce brow ridge, broad flattened detailed muzzle, deeply carved teeth and slightly open snarling mouth, strong stylized broad nose, spiral curls on mane and forehead, flowing fur curls carved from solid stone, crouched muscular forepaws straddling a small brocade ball, curled tail behind, like the small sculpture on the reference character's back. Worn rich antique bronze rim around square green-black stone seal, very finely carved archaic bronze cloud and lightning meander relief on all square side faces, red cinnabar lacquer on the bottom rim. Real old stone with scratches, chips and traces of vermilion, masterfully sculpted 3D archaeological museum artifact, sharp details and readable solemn face. The square seal base is about 30 PERCENT of total height. Neutral museum key and fill, balanced bright on front, subtle sculpted grounding shadows within recesses only. THREE views only, exactly aligned at equal scale, no perspective, no pedestal other than integral square stamp base, no cast shadows, no humans, no magical effects, no scene, no labels or callouts, transparent PNG. Columns should each be ~30% of image width, views fully contained.

</details>
