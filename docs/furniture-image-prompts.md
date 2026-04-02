# 🎨 花店家具素材生成提示词

> 本文档为 AI 图片生成工具（如 Midjourney / Stable Diffusion / DALL·E）准备的提示词。
> 每类家具生成在一张图中，按网格排列，保证同类画风一致。

---

## 📐 通用规范

| 项目 | 规格 |
|------|------|
| **画风** | 可爱手绘卡通风、粉色系暖色调、2.5D 等距视角、柔和描边 |
| **背景** | 纯白背景（#FFFFFF），方便抠图 |
| **格式** | 每张图按网格均分，每格一个物品，物品居中、留白均匀 |
| **分辨率** | 建议 2048×2048 或 2048×1024（按网格调整） |
| **描边** | 浅棕色/粉色柔和描边，线条圆润 |
| **配色** | 主色调：粉色、浅木色、奶白色、薄荷绿；点缀：金色、浅紫色 |

---

## 🖼️ 第 1 张：花架 / 展示架（furniture_shelf.png）

**网格：3 列 × 2 行 = 6 格**（5个常规 + 1个季节限定）

### Prompt

```
A sprite sheet of 6 cute flower shop display shelves, arranged in a 3x2 grid on a pure white background. Isometric 2.5D perspective, kawaii hand-drawn cartoon style, soft pink and warm wood tones, gentle brown outlines.

Grid layout (left to right, top to bottom):
1. Simple wooden flower shelf - three-tier natural wood shelf with small potted plants, rustic and practical
2. Step flower shelf - tiered cascade shelf like little hills, each level holding different flowers
3. Long flower display table - wall-mounted long wooden planter table with trailing vines
4. Iron art rotating shelf - elegant French wrought iron spiral shelf with ornate scrollwork, dark iron with gold accents
5. Glass display cabinet - premium glass-door cabinet with wooden frame, displaying flowers inside, soft interior glow
6. Cherry blossom shelf (seasonal limited) - wooden shelf decorated with pink cherry blossom branches and falling petals

Each item centered in its grid cell with equal padding. Consistent cute cartoon style across all items. Soft shadows beneath each piece.
```

### 切图命名

| 格子位置 | 文件名 | 对应 ID |
|---------|--------|---------|
| (0,0) | `shelf_wood.png` | `shelf_wood` |
| (1,0) | `shelf_step.png` | `shelf_step` |
| (2,0) | `shelf_long.png` | `shelf_long` |
| (0,1) | `shelf_iron.png` | `shelf_iron` |
| (1,1) | `shelf_glass.png` | `shelf_glass` |
| (2,1) | `shelf_spring.png` | `season_spring_shelf` |

---

## 🖼️ 第 2 张：桌台 / 工作台（furniture_table.png）

**网格：3 列 × 2 行 = 5 格**（4个常规 + 1个季节限定，留1格空）

### Prompt

```
A sprite sheet of 5 cute flower shop tables and counters, arranged in a 3x2 grid on a pure white background (bottom-right cell empty). Isometric 2.5D perspective, kawaii hand-drawn cartoon style, soft pink and warm wood tones, gentle brown outlines.

Grid layout (left to right, top to bottom):
1. Wooden cashier counter - warm natural wood counter with a small cash register and a vase of flowers on top, cozy shop counter feel
2. Drawer cabinet counter - practical counter with multiple small drawers, each drawer has a tiny flower-shaped handle
3. Flower crafting workbench - professional floral arrangement table with scissors, ribbons, and flower stems scattered on surface
4. Marble table - elegant cold marble top table with gold legs, a single elegant vase on top
5. Maple leaf counter (autumn limited) - wooden counter surface covered with scattered red and gold maple leaves, autumn harvest theme

Each item centered in its grid cell with equal padding. Consistent cute cartoon style. Soft shadows beneath each piece.
```

### 切图命名

| 格子位置 | 文件名 | 对应 ID |
|---------|--------|---------|
| (0,0) | `table_counter.png` | `table_counter` |
| (1,0) | `table_drawer.png` | `table_drawer` |
| (2,0) | `table_work.png` | `table_work` |
| (0,1) | `table_marble.png` | `table_marble` |
| (1,1) | `table_autumn.png` | `season_autumn_table` |

---

## 🖼️ 第 3 张：灯具（furniture_light.png）

**网格：3 列 × 2 行 = 5 格**（4个常规 + 1个季节限定，留1格空）

### Prompt

```
A sprite sheet of 5 cute flower shop lighting fixtures, arranged in a 3x2 grid on a pure white background (bottom-right cell empty). Isometric 2.5D perspective, kawaii hand-drawn cartoon style, soft pink and warm tones, gentle warm glow effects.

Grid layout (left to right, top to bottom):
1. Desk lamp - small cute table lamp with pink fabric shade, warm golden glow, sitting on a tiny doily
2. Floor lamp - tall standing floor lamp with cream shade and thin gold stand, soft ambient light
3. Flower pendant lamp - hanging ceiling lamp shaped like blooming flowers, petals as lamp shade in pastel pink and white
4. Crystal chandelier - luxurious small crystal chandelier with dangling crystal drops catching rainbow light, ornate gold frame
5. Sunflower lamp (summer limited) - cheerful table lamp shaped like a sunflower, bright yellow petals surrounding the warm bulb

Each lamp has a subtle warm glow effect. Centered in its grid cell with equal padding. Consistent cute cartoon style.
```

### 切图命名

| 格子位置 | 文件名 | 对应 ID |
|---------|--------|---------|
| (0,0) | `light_desk.png` | `light_desk` |
| (1,0) | `light_floor.png` | `light_floor` |
| (2,0) | `light_pendant.png` | `light_pendant` |
| (0,1) | `light_crystal.png` | `light_crystal` |
| (1,1) | `light_summer.png` | `season_summer_light` |

---

## 🖼️ 第 4 张：摆件 / 装饰品（furniture_ornament.png）

**网格：3 列 × 3 行 = 8 格**（6个常规 + 2个季节限定，留1格空）

### Prompt

```
A sprite sheet of 8 cute flower shop ornaments and decorative items, arranged in a 3x3 grid on a pure white background (bottom-right cell empty). Isometric 2.5D perspective, kawaii hand-drawn cartoon style, soft pink and warm tones, gentle brown outlines.

Grid layout (left to right, top to bottom):
1. Small flower pot - tiny cute ceramic pot with a single succulent plant, painted with flower patterns, sitting on a small saucer
2. Flower vase - elegant slender glass vase with a single beautiful rose, crystal clear glass with soft refraction
3. Mini fountain - small decorative desktop fountain with water flowing over smooth stones, tiny lily pads
4. Aromatic candle - pretty pink candle in a decorative glass jar with dried flowers embedded, soft flame glow
5. Vintage wall clock - round antique-style clock with roman numerals, ornate gold frame with tiny flower decorations
6. Fireplace - cozy small brick fireplace with warm crackling flames, mantelpiece with small flower vases
7. Pumpkin lantern (autumn limited) - cute carved pumpkin with warm candle glow inside, autumn leaves around base
8. Christmas fireplace (winter limited) - festive fireplace with hanging Christmas stockings, holly wreath, and twinkling lights

Each item centered in its grid cell with equal padding. Consistent cute cartoon style. Soft shadows beneath each piece.
```

### 切图命名

| 格子位置 | 文件名 | 对应 ID |
|---------|--------|---------|
| (0,0) | `orn_pot.png` | `orn_pot` |
| (1,0) | `orn_vase.png` | `orn_vase` |
| (2,0) | `orn_fountain.png` | `orn_fountain` |
| (0,1) | `orn_candle.png` | `orn_candle` |
| (1,1) | `orn_clock.png` | `orn_clock` |
| (2,1) | `orn_fireplace.png` | `orn_fireplace` |
| (0,2) | `orn_pumpkin.png` | `season_autumn_orn` |
| (1,2) | `orn_christmas.png` | `season_winter_orn` |

---

## 🖼️ 第 5 张：墙饰 / 挂件（furniture_wallart.png）

**网格：3 列 × 2 行 = 6 格**（4个常规 + 2个季节限定）

### Prompt

```
A sprite sheet of 6 cute flower shop wall decorations and hangings, arranged in a 3x2 grid on a pure white background. Isometric 2.5D perspective (items shown at slight angle as if mounted on wall), kawaii hand-drawn cartoon style, soft pink and warm tones, gentle brown outlines.

Grid layout (left to right, top to bottom):
1. Plant wall hanging - macramé plant hanger with trailing green ivy and small pink flowers, bohemian rope work
2. Decorative picture frame - ornate gold frame containing a watercolor painting of flowers, "flower language" theme
3. Flower wreath wall decor - circular wreath made of dried flowers, eucalyptus leaves, and small roses, tied with a pink ribbon
4. Art relief sculpture - elegant ceramic wall relief with carved floral motifs, cream white with gold leaf accents
5. Cherry blossom painting (spring limited) - framed oil painting of cherry blossom trees in full bloom, pink petals floating
6. Snow scene painting (winter limited) - framed painting of a snowy flower garden, soft blue and white tones, peaceful winter scene

Each wall decoration shown with slight perspective as if mounted on wall. Centered in its grid cell with equal padding. Consistent cute cartoon style.
```

### 切图命名

| 格子位置 | 文件名 | 对应 ID |
|---------|--------|---------|
| (0,0) | `wallart_plant.png` | `wallart_plant` |
| (1,0) | `wallart_frame.png` | `wallart_frame` |
| (2,0) | `wallart_wreath.png` | `wallart_wreath` |
| (0,1) | `wallart_relief.png` | `wallart_relief` |
| (1,1) | `wallart_spring.png` | `season_spring_wall` |
| (2,1) | `wallart_winter.png` | `season_winter_wallart` |

---

## 🖼️ 第 6 张：庭院 / 户外（furniture_garden.png）

**网格：3 列 × 2 行 = 6 格**（4个常规 + 1个季节限定 + 1格空）

### Prompt

```
A sprite sheet of 5 cute flower shop outdoor garden decorations, arranged in a 3x2 grid on a pure white background (bottom-right cell empty). Isometric 2.5D perspective, kawaii hand-drawn cartoon style, soft green and pink tones with natural wood, gentle brown outlines.

Grid layout (left to right, top to bottom):
1. Small flower bed - a tiny rectangular garden plot with colorful flowers (tulips, daisies, lavender) and a small picket fence border
2. Vine-covered arbor - a charming small garden pergola covered in climbing green vines and wisteria, with a tiny bench underneath
3. Rose archway - a romantic garden arch covered in climbing pink and red roses, forming a beautiful corridor entrance
4. Japanese zen garden - a mini dry landscape garden (karesansui) with raked white sand, moss-covered rocks, and a tiny bamboo fountain
5. Summer fountain (summer limited) - an ornate garden fountain with cool water splashing, surrounded by tropical flowers and small birds

Each garden item includes a small patch of ground/grass beneath it. Centered in its grid cell with equal padding. Consistent cute cartoon style.
```

### 切图命名

| 格子位置 | 文件名 | 对应 ID |
|---------|--------|---------|
| (0,0) | `garden_flowerbed.png` | `garden_flowerbed` |
| (1,0) | `garden_arbor.png` | `garden_arbor` |
| (2,0) | `garden_arch.png` | `garden_arch` |
| (0,1) | `garden_zen.png` | `garden_zen` |
| (1,1) | `garden_summer.png` | `season_summer_garden` |

---

## 🖼️ 第 7 组：房间风格背景（独立大图）

> 房间背景不放在网格中，每个风格单独一张完整图片。
> ⚠️ **必须保持与当前房屋完全一致的建筑结构**，只改变配色/材质/装饰细节。

### 🏗️ 建筑结构参考说明（所有风格通用）

当前花店是一个 **2.5D 等距俯视视角的开放式房间**，具体结构如下：

```
┌─────────────────────────────────────────────────┐
│                纯白背景                           │
│                                                  │
│         ┌── 粉色半圆瓦片屋顶 ──────────┐         │
│         │                              │         │
│    [柱] │   【后墙 - 左上→右上方向】      │ [柱]   │
│         │   · 整面干净素墙（只改颜色）    │         │
│         │   · 左侧有 1 扇格子窗         │         │
│         │                              │         │
│         │              【右墙 - 右上→右下方向】    │
│         │              · 整面干净素墙     │         │
│         │              · 有 2 扇格子窗   │         │
│         │                              │         │
│    [柱] │   暖棕色横纹木地板              │ [柱]   │
│         │   灰色石头地基（高于室外地面）    │         │
│         └──────────────────────────────┘         │
│              ↑                                    │
│         1~2级矮台阶                               │
│              ↓                                    │
│    【屋外区域 - 左前方一小片地】                     │
│    · 沙土/泥地（不是草地！浅土黄色地面）              │
│    · 零散灰色小石子铺成的小路                        │
│    · 边角有极少量绿色草丛点缀                        │
│    · 地块形状不规则，面积较小                        │
│                                                  │
└─────────────────────────────────────────────────┘
```

**关键结构要素（所有风格必须保留）：**
1. 等距 2.5D 俯视视角，从左上方约 45° 俯瞰
2. **纯白色背景**（图片本身是白底）
3. **只有两面墙呈 L 形**：后墙（左上→右上）+ 右墙（右上→右下），前面和左面完全开放
4. **没有右侧外立面**——不存在门、招牌、遮阳篷等外部元素
5. **4 根方形木柱子**分别在四个角落（左后、右后、左前、右前）
6. 屋顶覆盖整栋建筑（半圆形瓦片，有明显的行列纹路）
7. 后墙有 **1 扇窗**，右墙有 **2 扇窗**（共 3 扇格子窗）
8. 墙面为干净素墙（只改颜色/材质，不加装饰物）
9. **灰色石头地基/墙裙**将室内地板抬高于室外地面
10. 室内左前方有 **1~2 级矮木台阶**通向屋外
11. 屋外**左前方**保留一小片沙土地+石子路+少量草丛
12. 整体画风：可爱手绘卡通，柔和描边，线条圆润

---

### 7a. 温馨原木风（bg_room_default.png）

#### 7a-v2（2025–2026 试做 · 贴近合成页明亮感）

旧版偏暗沉；v2 由 NB2（`gemini-3.1-flash-image-preview`）按新提示词生成，强调 **左上柔光、材质肌理、高亮暖白墙、珊瑚橙瓦、薄荷感窗玻璃**，避免整体发灰。

**v2 迭代修正**：屋檐须 **向外挑出**（滴水朝室外/open 侧，勿向内翻进室内）；**地板人字拼改细密小条**（整面可见多次曲折重复）；**墙与柱减薄**，窗洞占比更大，整体比例更轻巧。

**屋顶参考图**：粉瓦筒瓦/鳞状檐、`L` 外角脊线、檐口越过立柱 — 见 `docs/prompt/refs/roof_reference_pink_scalloped.png`；生图时加参数 `--image .../roof_reference_pink_scalloped.png` 与提示词一并提交。

- **提示词**：`docs/prompt/house_bg_room_default_v2_nb2_prompt.txt`
- **预览图**：`minigame/subpkg_deco/images/house/preview/bg_room_default_v2_nb2.png`
- **原图目录**：`../game_assets/huahua/assets/preview_house_room/bg_room_default_v2_nb2.png`
- 验收通过后：将正式文件覆盖 `minigame/subpkg_deco/images/house/bg_room_default.png`（并保持 1024×1024 或与 `shop.png` 缩放策略一致）

#### 7a-candy（糖果 pastel · 单套，多分区硬装）

与 **7a-alt 薄荷北欧** 等冷灰/单主导色方案区分：同一 **`bg_room_default.png`** 布局参考（`--image`），硬装改为 **多色糖果 pastel**（屋顶粉/黄/薄荷分区、墙饰条纹或圆点、木构与窗框撞色、人字拼多色木条等），对齐全局 **清新柔和、温馨明亮、Q 版可爱**。

- **整房首版提示词**：`docs/prompt/house_bg_room_candy_nb2_prompt.txt`
- **仅换地板（迭代）**：`docs/prompt/house_bg_room_candy_nb2_floor_only_prompt.txt`，`--image` 用已入库的 **`minigame/.../house/bg_room_candy_nb2.png`**；一键 `scripts/ingest_house_room_candy_floor_nb2.sh`（NB2 + rembg → 覆盖 `bg_room_candy_nb2.png`）。
- **建议输出文件名**：`bg_room_candy_nb2.png`（**原始生图**目录：`../game_assets/huahua/assets/preview_house_room/`，勿将未抠图中间产物放入 minigame）
- 验收抠图后可覆盖 `minigame/.../bg_room_default.png`（当前默认 **糖果花坊** 即此管线）；与四套 alt 的说明见 **`docs/prompt/house_bg_room_alt_variants_README.md`**（顶部亦指向本提示词）。

#### 7a-nb2 · 三套扩展房壳（花境 / 海岛 / 复古花坊）

**NB2** `gemini-3.1-flash-image-preview`；raw 白底建议落在 `../game_assets/huahua/assets/preview_house_room/*_raw.png`。**入库游戏内 `minigame/.../house/` 须透明底**：`birefnet-general` rembg（与全项目抠图规范一致），保持 **1024×1024** 画布。一键：`scripts/gen_house_room_mirror_crystal_nb2.sh`（NB2 + rembg + 拷入 minigame）。

**布局参考**：`--image` 用 **`bg_room_default.png`** 锁 L 形房壳。**花境小筑**：建筑本身 **鲜花主题**（花箱、檐口花、墙面花卉装饰），**仅室内地坪**纯色大板。**复古花坊**（`bg_room_confetti_nb2`）：**明亮复古**层次（奶黄、豆沙绿、浅橡木、大格地面），避免暗沉。

| 提示词文件 | 风格 | `--image`（推荐） | 游戏内贴图键 |
|------------|------|-----------------|--------------|
| `house_bg_room_bloom_parade_nb2_prompt.txt` | 花境小筑 | `bg_room_default.png` | `bg_room_bloom_nb2` |
| `house_bg_room_lagoon_punch_nb2_prompt.txt` | 海岛 | `bg_room_default.png` 或已生成 `bg_room_lagoon_nb2.png`（若迭代地板） | `bg_room_lagoon_nb2` |
| `house_bg_room_confetti_cottage_nb2_prompt.txt` | 复古花坊 | `bg_room_default.png` | `bg_room_confetti_nb2` |
| `house_bg_room_pinkblue_nb2_prompt.txt` | 粉蓝可爱（粉白蓝主色、温馨温柔） | `bg_room_default.png`（首版锁布局）；迭代可用已生成的 `bg_room_pinkblue_nb2.png` | `bg_room_pinkblue_nb2` |

粉蓝套 v2 约束（已写入提示词）：**整铺短绒地毯**（禁人字木地板）、**地面无投影/无接触暗角**、**新瓦型**（鱼鳞或平瓦曲边等，禁默认半圆筒瓦）、**樱花轮廓窗框**。

对应 `ROOM_STYLES`：`style_bloom_nb2` / `style_lagoon_nb2` / `style_confetti_nb2` / `style_pinkblue_nb2`（见 [`DecorationConfig.ts`](src/config/DecorationConfig.ts)）。

#### 7a-alt · 四款变体（布局锁定当前 default）

以 **`minigame/subpkg_deco/images/house/bg_room_default.png`** 为参考图（`--image`），**1:1、体量与在画面中的位置须与参考一致**，仅换配色/材质。四套提示词：

| 提示词文件 | 风格 |
|------------|------|
| `docs/prompt/house_bg_room_alt_mint_nb2_prompt.txt` | 薄荷北欧 |
| `docs/prompt/house_bg_room_alt_autumn_nb2_prompt.txt` | 焦糖秋叶 |
| `docs/prompt/house_bg_room_alt_lilac_nb2_prompt.txt` | 淡紫童话 |
| `docs/prompt/house_bg_room_alt_lagoon_nb2_prompt.txt` | 热带泻湖 |

批量命令与输出路径见 **`docs/prompt/house_bg_room_alt_variants_README.md`**。生成后建议抠图再对应替换 `bg_room_white` / `bg_room_vintage` / `bg_room_spring` 等（或新增 `TextureCache` 键）。

---

> 🎨 **风格关键词（旧版说明，供对比）**：温暖可爱小木屋、奶油糖果色、甜蜜手绘感
> **配色方案**：🧡 暖橙黄瓦顶 · 🤎 焦糖棕木地板 · 🤍 奶油白墙 · 🪵 红棕色柱子 · 🟫 深棕窗框 · ⬜ 浅灰石基

```
A cute kawaii 2.5D isometric room interior for a flower shop game, hand-drawn cartoon style with soft rounded brown outlines, viewed from upper-left at 45 degrees. Pure white background. Warm, cozy, adorable cottage vibe — like a Stardew Valley or Animal Crossing style house.

STRUCTURE (must follow exactly):
- An open room with only TWO WALLS forming an L-shape: a BACK WALL (running from upper-left to upper-right) and a RIGHT WALL (running from upper-right to lower-right). The FRONT side and LEFT side are completely open — NO front wall, NO left wall, NO door, NO exterior facade, NO signage, NO awning.
- ROOF: cheerful WARM ORANGE-YELLOW semicircular clay tile roof (#E8A84C, like golden honey tiles) with visible tile rows and soft shadow between each row. The roof edge trim is REDDISH-BROWN wood (#6B3526). The warm orange roof is the brightest, most eye-catching part of the room.
- FOUR square REDDISH-BROWN wooden PILLARS (#7B4030) at the four corners, with visible wood grain and a tiny carved leaf ornament at the top. Pillars should be noticeably DARKER than the floor and walls.
- BACK WALL: clean, flat WARM CREAM surface (#FFF8E8, soft vanilla tone). Completely plain and bare. Has 1 window with DARK BROWN wooden frame (#5C3018), 3×2 grid muntins, LIGHT SKY-BLUE glass panes (#C8E8F8) — the blue glass adds a refreshing color pop.
- RIGHT WALL: same warm cream surface (#FFF8E8). Has 2 windows with same dark brown frames and sky-blue glass, evenly spaced.
- Where the walls meet the floor, a low wooden baseboard strip (about 1/8 wall height) in WARM MEDIUM-BROWN (#A07040) — a thin visible accent line between wall and floor.
- FLOOR: rich CARAMEL-BROWN wood plank flooring (#A0703C, warm golden-brown) in a herringbone / chevron pattern. Each plank has visible wood grain. The floor is CLEARLY DARKER AND WARMER than the cream walls — strong contrast.
- LIGHT GRAY stone FOUNDATION (#B0B0B0) with visible round cobblestone texture around the outside base.
- 1-2 short wooden STEPS (#8B6035, matching pillar tone) at front-left.
- Interior is completely EMPTY — no furniture, no shelves, no items.
- OUTDOOR AREA (front-left, small patch): small irregular patch of SOFT SANDY ground (#E8D8B8), a few scattered gray stepping stones (#B8B8B8), tiny tufts of FRESH GREEN grass (#7CC060) at edges — the green adds life.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, clocks, or any standalone objects. Walls must remain clean and bare. (Carved decorative patterns on pillars and window frames are fine.)

COLOR CONTRAST GUIDE (5 distinct color zones, all visually different):
- 🧡 Roof = warm orange-yellow #E8A84C (BRIGHTEST, most saturated)
- 🤍 Wall = vanilla cream #FFF8E8 (LIGHTEST)
- 🤎 Floor = caramel-brown herringbone #A0703C (WARM MID-TONE, clearly darker than walls)
- 🪵 Pillars = reddish-brown #7B4030 (DARKEST wood element)
- 🔵 Window glass = sky-blue #C8E8F8 (cool color accent)
- ⬜ Foundation = light gray stone #B0B0B0 (neutral base)
The warm orange roof + cream wall + caramel floor + dark pillar creates a cozy gradient from light to dark. The sky-blue window glass adds a cute refreshing accent.

STYLE: kawaii hand-drawn, soft brown outlines, warm cozy cottage like Animal Crossing. Adorable, NOT realistic. Soft diffused lighting. Mobile portrait (750x1334).
```

### 7b. 清新薄荷白（bg_room_white.png）

> 🎨 **风格关键词**：薄荷绿+白色清新可爱、明亮活泼、糖果色点缀
> **配色方案**：🍀 薄荷绿瓦顶 · 🤍 奶白人字拼地板 · 🤍 白墙 · 💚 淡绿色柱子 · 🪵 蜂蜜色窗框 · ⬜ 浅灰石基

```
A cute kawaii 2.5D isometric room interior for a flower shop game, hand-drawn cartoon style with soft rounded outlines, viewed from upper-left at 45 degrees. Pure white background. Fresh mint-green and white color scheme — bright, clean, cheerful, like a cute patisserie or candy shop.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: SOFT MINT-GREEN semicircular tiles (#8EC5A8, fresh spring green) with visible tile rows and gentle shadow lines. The roof edge trim is DEEPER GREEN wood (#5A9A70). The green roof is the signature color of this room.
- FOUR square LIGHT SAGE-GREEN painted wooden PILLARS (#A0C8A0) at the four corners. Clean, smooth painted surface with a hint of wood grain showing through. Pillars should be a different shade from the roof (lighter and more muted).
- BACK WALL: clean, flat PURE WHITE surface (#FFFFFF, bright crisp white — NOT off-white). Completely plain and bare. Has 1 window with WARM HONEY-WOOD frame (#C8A050, golden-warm), 2×2 grid muntins, very PALE MINT-tinted glass panes (#E0F5E8).
- RIGHT WALL: same pure white surface. Has 2 windows with same honey-wood frames and mint glass, evenly spaced.
- Where the walls meet the floor, a thin baseboard strip in PALE MINT (#C8E8D0) — a delicate green accent line.
- FLOOR: LIGHT WARM-BEIGE herringbone parquet flooring (#DDD0B8, warm wheat tone, V-shaped chevron pattern). Each plank has subtle wood grain. The floor is WARMER than the white walls — providing a cozy grounding element against the cool green and white palette.
- PALE GRAY stone FOUNDATION (#C0C0C0) with smooth rounded cobblestone texture around the outside base.
- 1-2 HONEY-TONED wooden STEPS (#C8A050, same as window frames) at front-left.
- Interior is completely EMPTY — no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of LIGHT CREAM sandy ground (#E8E0D0), smooth pale stepping stones (#D0D0D0), tiny tufts of BRIGHT GREEN grass (#70C060) with a couple of tiny white wildflowers.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, curtains, plants, or any standalone objects. Walls must remain clean and bare.

COLOR CONTRAST GUIDE (fresh, layered, NOT monotone):
- 🍀 Roof = soft mint-green #8EC5A8 (SIGNATURE COLOR, cheerful)
- 🤍 Wall = crisp white #FFFFFF (BRIGHTEST, clean backdrop)
- 🍞 Floor = warm wheat-beige herringbone #DDD0B8 (WARM contrast against cool white/green)
- 💚 Pillars = sage-green #A0C8A0 (softer green, different from roof)
- 🍯 Window frames = honey-wood #C8A050 (WARM GOLDEN accent — important contrast against cool greens)
- ⬜ Foundation = pale gray #C0C0C0
Key contrast: the WARM honey-wood frames and warm beige floor balance the cool mint-green and white, creating a fresh yet cozy look. NOT cold or sterile.

STYLE: kawaii hand-drawn, soft outlines, bright and airy like a cute bakery/café. Adorable, NOT realistic. Soft diffused lighting. Mobile portrait (750x1334).
```

### 7c. 复古花坊（bg_room_vintage.png）

> 🎨 **风格关键词**：可爱复古欧式、暖色调为主、精致但不沉闷
> **配色方案**：🌹 玫瑰红瓦顶 · 🪵 暖木色地板 · 🤍 淡黄奶油墙 · 🤎 深棕柱子+雕花 · 🟤 棕色拱形窗框 · 灰石基

```
A cute kawaii 2.5D isometric room interior for a flower shop game, hand-drawn cartoon style with soft rounded warm-brown outlines, viewed from upper-left at 45 degrees. Pure white background. Cute vintage European cottage — warm, charming, romantic but NOT dark or gloomy. Think cozy French countryside, not Gothic.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: warm ROSE-RED / terracotta clay tiles (#C85050, a warm cheerful red — NOT dark wine/burgundy) with visible tile rows and soft shadow lines. The roof edge trim is WARM BROWN wood (#6B4030). The red roof should look WARM and INVITING, not gloomy.
- FOUR square WARM DARK-BROWN wooden PILLARS (#5C3320) at the four corners, with a small carved acanthus leaf ornament at the top of each pillar (decorative carved detail). Visible warm wood grain.
- BACK WALL: clean, flat PALE WARM-YELLOW / butter-cream surface (#FFF0D0, like pale butter — warmer than plain beige). Completely plain and bare. Has 1 ARCHED window with WARM BROWN wooden frame (#6B4030), decorative carved scrollwork at the arch top, small grid muntins, GOLDEN AMBER-tinted glass panes (#F0E0A0, warm glow).
- RIGHT WALL: same butter-cream surface (#FFF0D0). Has 2 arched windows with same brown frames and golden glass, evenly spaced.
- Where the walls meet the floor, a low wainscoting strip (about 1/5 wall height) in WARM MEDIUM-BROWN (#906838) — a visible warm wood band.
- FLOOR: WARM HONEY-AMBER wood plank flooring (#B88040) in a DIAGONAL pattern. Each plank has visible grain and warm golden undertone. The floor is a RICH WARM BROWN — clearly darker than the butter walls but not too dark.
- WARM GRAY-BROWN stone FOUNDATION (#908070) with cobblestone texture around the outside base.
- 1-2 BROWN wooden STEPS (#7A5030) at front-left.
- Interior is completely EMPTY — no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of WARM SANDY ground (#D8C8A0), old stepping stones in warm gray (#A09880), sparse GREEN grass tufts (#70A050) at edges.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, or any standalone objects. Walls must remain clean. (Carved decorative details on pillars and window arches are fine.) The overall feeling should be CUTE vintage, NOT dark/gloomy vintage.

COLOR CONTRAST GUIDE (warm and layered, NOT dark/depressing):
- 🌹 Roof = warm rose-red terracotta #C85050 (WARM RED, eye-catching, NOT dark burgundy)
- 🧈 Wall = butter-cream #FFF0D0 (LIGHT AND WARM, like pale butter)
- 🍯 Floor = honey-amber wood #B88040 (WARM MID-TONE, rich golden-brown)
- 🪵 Pillars = dark-brown #5C3320 (DARKEST element, for framing)
- 🟡 Window glass = golden amber #F0E0A0 (warm glowing accent)
- ⬜ Foundation = warm gray-brown #908070
CRITICAL: This is a CUTE kawaii game — the vintage style should be WARM and CHARMING, like a cozy countryside cottage. Avoid anything that looks dark, cold, or Gothic. The rose-red roof + butter walls + honey floor = cheerful warm palette.

STYLE: kawaii hand-drawn, warm brown outlines, romantic French countryside charm — cute and warm, NOT gloomy. Adorable, NOT realistic. Soft warm lighting. Mobile portrait (750x1334).
```

### 7d. 🌸 春日粉（bg_room_spring.png）— 季节限定

> 🎨 **风格关键词**：樱花粉+白+木色、粉色层次分明、不是全部粉色
> **配色方案**：🌸 樱花粉瓦顶 · 🪵 浅暖木地板（非粉色！）· 🤍 白墙 · 🌷 深粉柱子+樱花 · 🩷 粉棕窗框 · 💚 绿色草丛点缀

```
A cute kawaii 2.5D isometric room interior for a flower shop game, hand-drawn cartoon style with soft rounded PINK outlines, viewed from upper-left at 45 degrees. Pure white background. Dreamy cherry blossom spring theme — IMPORTANT: not everything is pink! The floor and walls must be NON-PINK to create contrast.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: SAKURA PINK semicircular tiles (#E88098, vivid cherry-blossom pink) with visible tile rows and soft shadow. The roof edge trim is DEEPER ROSE wood (#B85070). A few delicate cherry blossom branches with BRIGHT PINK blooms (#FF90A8) and DARK PINK centers extending from behind the roof ridge. Scattered petals on tiles.
- FOUR square WARM ROSE-BROWN wooden PILLARS (#A06060, a brownish-pink tone — NOT bright pink, NOT gray) at the four corners. Each pillar has a delicate cherry blossom VINE pattern carved/painted spiraling upward, with tiny BRIGHT PINK flowers (#FF90A8) and FRESH GREEN leaves (#60B850). The GREEN leaves are critical — they break up the pink and add life.
- BACK WALL: clean, flat PURE WHITE surface (#FFFFFF — crisp white, NOT pink-tinted). Completely plain and bare. Has 1 window with ROSE-PINK wooden frame (#C06070), small cherry blossom carvings at the top, PALE PINK glass panes (#FFE8EE).
- RIGHT WALL: same PURE WHITE surface (#FFFFFF). Has 2 windows with rose-pink frames, evenly spaced.
- Where the walls meet the floor, a thin baseboard strip in LIGHT PINK (#F0C0C8) — a delicate accent.
- FLOOR: WARM NATURAL WOOD plank flooring (#C8A878, warm sandy-oak tone — absolutely NOT pink, NOT white). Visible wood grain lines and plank seams. The floor is a WARM NEUTRAL WOOD COLOR that grounds the pink palette.
- SOFT PINK-GRAY stone FOUNDATION (#C8A8B0) with rounded cobblestone texture around the outside base.
- 1-2 WARM WOOD-TONED STEPS (#B89868, matching floor) at front-left with a few BRIGHT PINK petals scattered on them.
- A few cherry blossom petals (BRIGHT PINK #FF90A8) floating gently in the air.
- Interior is completely EMPTY — no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of LIGHT CREAM ground (#F0E8D8), scattered bright pink fallen petals, pale pink stepping stones (#D8B8C0), BRIGHT GREEN grass tufts (#60B850) with tiny pink wildflowers — the GREEN is important contrast.
- BACKGROUND: pure white (#FFFFFF).
- FLOATING ELEMENTS: scattered cherry blossom petals (bright pink #FF90A8) falling gently through the scene.

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any standalone objects. Cherry blossom elements ONLY as: carved/painted details on pillars/windows, floating petals, and roof branches.

COLOR CONTRAST GUIDE (MUST have clear layers — NOT all pink!):
- 🌸 Roof = sakura pink #E88098 (BRIGHTEST PINK, most saturated)
- 🤍 Wall = PURE WHITE #FFFFFF (NOT pink-tinted! Crisp white provides maximum contrast)
- 🪵 Floor = warm sandy-oak wood #C8A878 (WARM BROWN/BEIGE — NOT pink, NOT white!)
- 🌹 Pillars = rose-brown #A06060 (muted brownish-pink)
- 💚 Vine leaves & grass = fresh green #60B850 (ESSENTIAL complementary color!)
- 🩷 Window frames = rose-pink #C06070

CRITICAL RULES:
1. The FLOOR must be NATURAL WOOD TONE (warm beige-brown). If the floor looks pink or white, the image fails.
2. The WALLS must be PURE WHITE. If the walls look pink, the image fails.
3. GREEN elements (vine leaves on pillars + grass outdoors) must be clearly visible. Without green, the image looks like a pink blob.
4. Pink should appear in: roof, pillars, window frames, floating petals, and foundation. Everything else is white, wood-tone, or green.

STYLE: kawaii hand-drawn, pink outlines, magical spring cherry blossom — but with clear WHITE + WOOD + GREEN contrast. Adorable, NOT realistic. Soft diffused lighting. Mobile portrait (750x1334).
```

---

## 📋 素材清单总览

| # | 文件名 | 类型 | 格子 | 内含物品数 |
|---|--------|------|------|-----------|
| 1 | `furniture_shelf.png` | spritesheet | 3×2 | 6 |
| 2 | `furniture_table.png` | spritesheet | 3×2 | 5 |
| 3 | `furniture_light.png` | spritesheet | 3×2 | 5 |
| 4 | `furniture_ornament.png` | spritesheet | 3×3 | 8 |
| 5 | `furniture_wallart.png` | spritesheet | 3×2 | 6 |
| 6 | `furniture_garden.png` | spritesheet | 3×2 | 5 |
| 7a | `bg_room_default.png` | 整图 | - | 1 |
| 7b | `bg_room_white.png` | 整图 | - | 1 |
| 7c | `bg_room_vintage.png` | 整图 | - | 1 |
| 7d | `bg_room_spring.png` | 整图 | - | 1 |
| **合计** | | | | **6张sheet + 4张背景 = 10张图 → 39个素材** |

---

## 🔧 切图后接入流程

1. 生成 6 张 spritesheet + 4 张背景图
2. 使用图片编辑工具按网格切割每个物品为单独 PNG（保留透明背景）
3. 按上表命名，放入 `minigame/images/` 目录
4. 运行 `sh sync-assets.sh` 同步到项目
5. 更新 `DecorationConfig.ts` 中每个 `icon` 字段为新的纹理 key
6. 删除旧的 `room_01~36` / `room2_01~36` 素材引用
