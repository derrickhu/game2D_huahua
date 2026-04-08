# 游戏音频 — Suno 专用提示词（与工程文件对照）

工程内注册见 [`AudioConfig.ts`](../src/config/AudioConfig.ts)；导出 **MP3**（或 WAV）后放入 `minigame/subpkg_audio/`，必要时改 `src` 文件名。

---

## Suno 里怎么填（重要）

Suno 不同版本界面略有差异，按你当前版本对照即可：

| 项 | 建议 |
|----|------|
| **Instrumental** | **务必打开**（纯器乐）。本项目 BGM/音效均不要人声。 |
| **Style of music / Style** | 下面每条里的 **「Suno · Style」整段英文** 主要贴这里（逗号分隔标签，Suno 识别最好）。 |
| **Song description / 歌曲描述** | 贴对应 **「Suno · Description」**；没有单独栏时，可把 Description 前半句并入 Style 末尾。 |
| **Lyrics** | 器乐模式：**留空**、只填 **`.`**、或填 **`[instrumental]`**（以你使用的 Suno 版本为准，避免模型编歌词）。 |
| **模型** | 优先用支持 **Custom / Instrumental** 的模型，质量更稳。 |

**Suno 的局限（必读）**

- Suno 偏 **「整段音乐」**，很难稳定产出 **&lt;1 秒的纯 UI 嗖声**。对 **whoosh / 极短点击感**，建议：用 Suno 生成 **8–20 秒** 的「极轻氛围 + 开头一次事件」，在 **DAW / Audacity** 里 **只剪前 0.4–1.0 秒**；或 whoosh 改用 **音效库 / ElevenLabs sfx** 等。
- **BGM**：生成 **1–2 分钟** 再截取 **60–90 秒** 做循环，在 DAW 找 **无缝 loop 点**（或 Suno 多生成几条选最稳的一段）。
- 导出后做 **响度归一**（与占位 WAV 听感接近即可），避免某条 BGM 明显偏大。

**风格锚点（所有 Style 已内化）**

温馨 **休闲合成 + 花店**、**高明度 pastel**、**软萌治愈**；禁止阴沉史诗、重金属、恐怖氛围；**不要人声、不要 rap、不要歌词哼唱**。

---

## A — 与当前代码绑定的资源（优先做）

### `bgm_shop` — 花店 / 装修场景 BGM

**当前工程已入库曲目：** 从资产库 `game_assets/huahua/bgm/Felt Petals.mp3` 拷贝为 `minigame/subpkg_audio/bgm_shop_felt_petals.mp3`，[`AudioConfig`](../src/config/AudioConfig.ts) 中 `bgm_shop` 已指向该文件。若日后替换曲目，保持路径或改 `src` 即可。以下为若用 Suno 重做的参考提示词：

- **Suno · Style**  
  `instrumental, cozy mobile game BGM, flower shop and garden, kawaii casual, pastel lofi, warm major key, soft felt piano, nylon acoustic guitar, subtle glockenspiel sparkles, 88 BPM, gentle and looping feel, light airy mix, no vocals, no rap, no heavy drums, no dubstep bass, no cinematic epic orchestra`
- **Suno · Description**  
  `Seamless looping background for a cute merge game flower shop interior; sunny relaxed mood; instrumental only.`
- **后期**  
  截 **~70–90s**；做 loop；`AudioConfig` 里 `volume` 约 **0.38**。

### `bgm_main` — 主界面棋盘 BGM

- **Suno · Style**  
  `instrumental, casual merge puzzle game BGM, cheerful cozy, pastel pop, ukulele lead, soft synth pads, very light shaker percussion, 100 BPM, bright but not stressful, loopable phrasing, no vocals, no heavy kick, no aggressive EDM`
- **Suno · Description**  
  `Main menu board game background; cute and light; instrumental loop.`
- **后期**  
  同上，截中段做 loop。

### `bgm_story` — 剧情 / 轻叙事（若与主界面区分）

- **Suno · Style**  
  `instrumental, soft story game underscore, flower theme, delicate harp and piano, slow 78 BPM, pastel emotional but sweet, sparse arrangement, no vocals, no trailer brass`
- **Suno · Description**  
  `Gentle underscore for light visual-novel moments in a flower shop game.`

### `ui_reward_fanfare` — 恭喜获得 / 庆祝面板（2–4s 音乐性最合适）

- **Suno · Style**  
  `instrumental, short mobile game win jingle, cute pastel, marimba, pizzicato strings, light hand claps, major key, uplifting kawaii, 110 BPM feel, marimba phrase ends in 3 seconds then soft tail, no vocals, no epic hollywood orchestra`
- **Suno · Description**  
  `A very short celebratory sting for getting rewards; cute flower-shop mobile game; instrumental only; first hit in first second.`
- **后期**  
  从成片 **剪出 2–4 秒**（保留上升 + 解决音），淡入淡出。

### `customer_deliver` — 订单完成 + 奖励物品飞入（同一资源；短、亮、不刺耳）

- 原独立 `reward_fly_whoosh` 已弃用；**所有** `RewardFlyCoordinator` 批量飞入、合成页 `_playRewardFly`、升级弹窗飞入收纳盒与点击客人「完成」起点均复用本段。
- **Suno · Style**  
  `instrumental, cute mobile UI confirm, soft bell tree, light wooden tick, tiny coin shimmer, major key, one short phrase under 1 second feel, no vocals, no cartoon horn, no harsh high frequencies`
- **Suno · Description**  
  `Satisfying order-complete sound for a cozy merge game; one gentle ding; instrumental.`
- **后期**  
  剪 **0.5–1.2s**；可高通略去糊低频。

### `world_map_open` — 大地图展开（可音乐化一点）

- **Suno · Style**  
  `instrumental, soft paper and parchment texture sound, gentle map unfold, airy woodwind pad, adventure but cute pastel, no vocals, no percussion groove, subtle 1-second gesture then fade`
- **Suno · Description**  
  `Opening a paper world map in a kawaii flower game; soft rustle and gentle reveal; instrumental.`
- **后期**  
  取 **0.6–1.0s**。

### `purchase_tap` — 点击购买 / 扣费（极短、轻快愉悦的「成交」小叮）

**当前工程已入库：** 资产库 `game_assets/huahua/bgm/购买.mp3` **截取首约 0.4s**（去掉尾段混入的其它声；末 0.08s 淡出；纯音频 `-map 0:a:0`）→ `minigame/subpkg_audio/purchase_tap.mp3`，[`AudioConfig.ts`](../src/config/AudioConfig.ts) 已注册。  
**播放时机：** 装修家具/房间风格花愿购买（`DecorationPanel`）、顶栏内购货架花愿/钻石购买与钻石刷新栏（`MerchShopManager`）、大地图弹窗商店扣花愿/钻（`PopupShopPanel`）、换装花愿解锁（`DressUpPanel`）、顶栏钻石买体力成功（`CurrencyManager.buyStaminaWithDiamond`）。免费商品与广告兑换不播。

**用途说明**  
与纯 `button_click` 区分；在**扣费已成立**后播。听感要 **轻快、明亮、小开心**——像小花店收银 **「叮～成交啦」** 的一下，**不要**闷重抽屉、**不要**灰扑扑的闷金属；也 **不是** `ui_reward_fanfare` 那种长庆祝。

**设计约束**

- **气质**：**轻快 + 愉悦 + pastel 软萌**；主声可带 **一点上扬感**（大调式、短琶音式两音、或软 bell / marimba 的 **亮叮**），让人一听觉得 **买得开心、很顺**，但仍保持 **SFX 体量**（别做成小曲子）。
- **核心意象（择一为主）**：**软木琴 / 糖感 bell 的一记短敲**、**硬币落瓷盘的清脆叮**（偏 **亮、薄、空气感** ，不是厚重铜锣）、**迷你收银「成功」哔——但要圆、要甜**；可带 **极轻沙铃或星星闪** 作点缀，**一层**即可。
- **忌**：沉闷木抽屉重关、低闷「咚」、过暗过糊、老虎机、刺耳激光扫码长音、人声 ka-ching、与 `ui_reward_fanfare` 同级的和弦铺陈。
- **时长**：剪后 **约 0.25～0.5s**，主能量在前 **0.15s** 内；尾音可 **极短自然衰减**（不必死硬切到发干），但 **不要** 拖混响尾巴。

- **Suno · Style**  
  `instrumental, ultra short happy purchase chime, lighthearted breezy pastel shop, cute kawaii cash-register ping, soft bright marimba or gentle bell tap, airy sparkly coin affirm, joyful micro sting, major key uplift, snappy cute positive, fluffy light texture not dark, not heavy wooden thunk, not muted dull metal, no long melody, no pad, no big fanfare, no slot machine, no laser scanner, no vocal, under 0.55 second bright gesture, clean cute mobile game SFX, no vocals`
- **Suno · Description**  
  `A tiny cheerful purchase sound for a cozy pastel merge game: light, happy, and pleasant—like a bright little shop register "ding" that makes buying feel fun; very short; not muffled or heavy; not a full celebration jingle; instrumental only.`
- **后期**  
  从 8–12s 成片中 **剪 0.25～0.5s**，选 **最亮、最弹** 的那一下；若成品偏 **闷**，**略抬 3～6kHz 空气感** 或 **极轻并联一条高频 copy**（勿变刺）；若偏 **刺** 再 **shelf-down 8k+**。与 [`button_click`](../src/config/AudioConfig.ts) 对比须更 **「开心成交」**；重导后可替换 `purchase_tap.mp3`，必要时略抬 [`AudioConfig`](../src/config/AudioConfig.ts) 里 `purchase_tap` 的 `volume`。

---

## B — 高重复核心音效（务必单独成片、精剪）

以下两条玩家**极频繁**触发，验收标准：**连听几十次仍舒适**；忌尖亮钟铃、忌金属刮耳、忌过长混响尾。导出后在真机用 [`AudioConfig`](../src/config/AudioConfig.ts) 里当前 `volume` 试听，仍刺耳则再压高频或略降音量。

### `merge_success` — 合成成功（饱满质感 + 轻快弹跳；兼容程序变调）

**当前工程已入库：** 资产库 `game_assets/huahua/bgm/合成3.mp3` **截取首 1s**（纯音频）→ `minigame/subpkg_audio/merge_success.mp3`。  
**程序连续合成变音：** [`SoundSystem.ts`](../src/systems/SoundSystem.ts) 在约 **2.4s** 内连续触发 `board:merged` 时，`playbackRate` 依次为 **1.00 → 1.05 → 1.10 → 1.14 → 1.18**（升幅收窄，避免素材被拉得过尖）；同时 [`AudioManager.play`](../src/core/AudioManager.ts) 对合成音支持 **`volumeScale`**，高档依次为 **1.0 → 0.97 → 0.93 → 0.90 → 0.86**，略压响度。第 **6** 次及以后沿用最后一档；超过 **2.4s** 无合成则回到 **1.00**。

**设计约束（给策划 / 音频）**

- 合成反馈要 **有体量、有质感**，忌「蚊子叫」式又细又虚；同时要 **轻快、有弹性**，像 **软糖弹一下 / 小皮球落地再弹起** 那种 **bouncy**，不要沉重慢板。
- **主体**：以 **中低频～中频的饱满体鸣** 打底（**胖一点的 marimba / 木琴低音条 / 软木鱼 / 带一点薄体共鸣的 pluck**），占满耳朵的中心，再叠 **一层** 很轻的 **亮粉系 sparkle**（沙铃、极短 celeste、软 bell one-shot）做「花店可爱」，**不要**只靠一根细高音条当主角。
- **游戏内会做 playbackRate 变调**：基频仍宜落在 **偏暖的中音区**（勿从超高音起跳），但 **允许中低频略丰满**；成片验收时务必用 **1.00～1.18** 连听，变调后仍要 **不刺、不瘪**。
- **忌**：铁丝般细 click、贴耳高频啸、过长混响尾、赌场式厚重铜管、史诗感。
- 剪后时长 **约 0.4～0.7s** 均可：略长一点也可以，只要 **能量集中在前半段**、尾上 **干净收**，仍适合高重复。

- **Suno · Style**  
  `instrumental, cheerful merge puzzle game success hit, bouncy lighthearted pastel pop, warm round body not thin, soft fat marimba or mellow wooden mallet low-mids, gentle rubber bounce thump, tiny bright kawaii sparkle accent on top single layer, cute flower shop mobile SFX, snappy upbeat micro phrase, airy playful springy feel, full warm transient, no weak tiny click, no piercing highs, no glassy harsh shimmer, no long reverb wash, no brass fanfare, under 0.75 second main energy, no vocals`
- **Suno · Description**  
  `A satisfying merge success sound for a cozy pastel merge game: it must feel plump and textured in the mids—not thin or tinny—and light, bouncy, happy; like a soft wooden pop with a cheerful little sparkle; the root pitch stays warm enough for later pitch-shifting in code; one short lively gesture then stop; instrumental only.`
- **后期**  
  从 8–15s 成片中 **剪 0.4～0.7s**（把 **最饱满、最弹** 的那一下落在剪入点后 **0～120ms**）。**勿狠高通**（保留 **200～400Hz 一带** 的「肉感」）；若偏糊可 **略提 2～4kHz 存在感**；若偏刺再 **shelf-down 8k+**。可极轻 **总线压缩 / 饱和** 增加 **密度**（勿糊成噪音）。验收：工程内 **1.00～1.18** + **volumeScale** 连播；[`AudioConfig`](../src/config/AudioConfig.ts) 里 `merge_success` 的 `volume` 若仍偏小，可在 **DAW 归一** 或 **略抬音量**；重导后替换 `merge_success.mp3` 即可。

### `tap_building` — 点击生产器 / 建筑产出（耐听、比合成更轻）

**当前工程已入库：** 资产库 `game_assets/huahua/bgm/合成2.mp3` → `minigame/subpkg_audio/tap_building.mp3`，[`AudioConfig`](../src/config/AudioConfig.ts) 中 `tap_building` 已指向该文件。若用 Suno 重做，仍可用下文参考。

**设计约束**

- 与合成错开听感：更 **轻、更贴 UI**，像「泥土 / 花盆 / 小木牌」的轻触，**不要** 做成第二个小合成音。
- 同样 **高重复**，忌硬 click、忌电话按键感、忌高频齿音；可略短于合成。
- 与 `button_click` 区分：`tap_building` 可带 **极轻** 的「物质感」（一粒沙、软木、薄陶），但仍 **极短、极柔**。

- **Suno · Style**  
  `instrumental, ultra soft mobile game tap, gentle potting soil micro thud, muted wooden tick, cozy flower shop casual, pastel kawaii, very quiet mix, no sharp transient, no metal click, no bright hi-hat, no glass ping, no vocal chop, 0.25 to 0.45 second gesture then near silence, no long tail`
- **Suno · Description**  
  `The lightest friendly tap when the player taps a producer building in a merge flower game; softer and simpler than a merge success sound; warm and non-fatiguing for hundreds of repeats; instrumental only.`
- **后期**  
  剪 **0.2–0.45s**；整体响度建议 **略低于** `merge_success`；可与 `button_click` 同一条 Suno 长片里选 **更闷、更短** 的一段另存为 `tap_building`，但**不要**与合成成片混用同一段。

---

## C — 其它已注册 / 计划音效（Suno Style 直贴）

### `customer_arrive`

`instrumental, friendly shop door chime, soft bloom sparkle, welcoming cute game, 0.8 second gesture, no vocals, no heavy reverb tail`

### `cell_unlock`

`instrumental, magic unlock harp glissando, airy shine, cute casual game, short 0.6s, no epic brass, no vocals`

### `chest_open`

`instrumental, small treasure chest lid, soft wooden creak and golden shimmer, cute RPG lite, 0.5s, no vocals`

### `checkin`

`instrumental, daily login reward bling, music box and mallet bells, bright major, 1.5s cute sting, no vocals`

### `level_up`

`instrumental, cute RPG level up flourish, rising marimba arpeggio, very light soft brass pad, major key, 2–3 seconds, no vocals, not final fantasy epic`

### `achievement`

`instrumental, small achievement badge sound, soft bells, cute mobile game, 1s, no vocals`

### `button_click`

**已入库**：`game_assets/huahua/bgm/按钮通用.mp3` → `subpkg_audio/button_click.mp3`（`AudioConfig` + `SoundSystem` 全局 `pointer` 链默认点击）。

若将来替换为 AI 生成，可参考：`instrumental, ultra soft UI button, felt and rubber gentle tap, kawaii game, very quiet, 0.15s feel, no clicky metal, no vocals`

---

## 占位脚本（无 Suno 时）

```bash
python3 scripts/gen_subpkg_audio_placeholders.py
```

---

## 替换进工程

1. 文件命名与 [`AudioConfig.ts`](../src/config/AudioConfig.ts) 中 `src` 一致（或改 `src` 指向新文件名）。  
2. 微信 **InnerAudioContext** 可用 MP3 / WAV。  
3. 大包体音频继续放在 **`subpkg_audio`** 分包。
