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

> 🎨 **风格关键词**：天然木质、暖棕色调、乡村小屋的温馨感
> **差异化要素**：蜂蜜色横纹木地板 · 奶油色素墙 · 暖棕木柱 · 原木格子窗 · 粉色瓦顶 · 灰石地基

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded brown outlines, viewed from upper-left at 45 degrees. Pure white background.

STRUCTURE (must follow exactly):
- An open room with only TWO WALLS forming an L-shape: a BACK WALL (running from upper-left to upper-right) and a RIGHT WALL (running from upper-right to lower-right). The FRONT side and LEFT side are completely open — NO front wall, NO left wall, NO door, NO exterior facade, NO signage, NO awning.
- ROOF: warm pink/salmon colored semicircular clay tile roof with visible tile rows, covering the entire room from above.
- FOUR square wooden PILLARS at the four corners of the room (back-left, back-right, front-left, front-right), all matching warm brown wood tone. Pillars are simple structural columns.
- BACK WALL: a single clean, flat CREAM/OFF-WHITE painted surface. The wall must be completely plain and bare — NO shelves, NO cabinets, NO hangings. Just a smooth solid-color wall. Has 1 traditional wooden grid-pane window (warm brown frame, 3×2 grid muntins) positioned in the right portion.
- RIGHT WALL: same clean, flat CREAM/OFF-WHITE painted surface. Has 2 traditional wooden grid-pane windows (warm brown frames, 3×2 grid muntins), evenly spaced.
- Where the walls meet the floor, there is a low wooden wainscoting strip (about 1/5 wall height) in natural oak tone — this is purely a color band, NOT a protruding shelf or ledge.
- FLOOR: warm honey-brown horizontal wood plank flooring with natural wood grain texture, subtle knot details.
- Gray stone FOUNDATION/BASEBOARD visible around the outside base of the room, raising the floor above ground level.
- 1-2 short honey-brown wooden STEPS at the front-left leading down from the elevated floor to the outdoor area.
- Interior is completely EMPTY — absolutely no furniture, no shelves, no cabinets, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): a small irregular patch of sandy/dirt ground (pale sandy-yellow color, NOT green grass), scattered gray pebble stepping stones, tiny tufts of green grass only at the edges. This outdoor patch is small and located at the lower-left of the composition.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning — the building has no enclosed exterior side. Do NOT add any shelves, cabinets, display racks, picture frames, clocks, or any standalone objects on or against the walls. Walls must remain clean and bare. (Carved/painted decorative patterns on pillars and window frames are fine.)

COLOR PALETTE: honey-brown & oak wood tones, cream/off-white walls, salmon pink roof tiles, gray stone base, sandy outdoor ground.
STYLE: kawaii hand-drawn, soft brown outlines, warm cozy cottage atmosphere. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
```

### 7b. 清新薄荷白（bg_room_white.png）

> 🎨 **风格关键词**：北欧极简、明亮通透、薄荷绿点缀
> **差异化要素**：漂白橡木人字拼地板 · 纯白素墙 · 白色柱子 · 白框简约窗 · 鸽灰瓦顶 · 浅灰石基

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded light-gray outlines, viewed from upper-left at 45 degrees. Pure white background. Nordic minimalist color redesign - SAME room structure as reference.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: soft dove-gray/off-white slate tiles, same semicircular tile shape with visible rows, covering entire room.
- FOUR square WHITE-PAINTED wooden PILLARS at the four corners, clean and minimal.
- BACK WALL: a single clean, flat BRIGHT PURE WHITE smooth surface. Completely plain and bare. Has 1 window with thin white wooden frame, simplified 2×2 grid muntins.
- RIGHT WALL: same bright pure white smooth surface. Has 2 windows with thin white frames, 2×2 grid muntins, evenly spaced.
- Where the walls meet the floor, a low painted white wainscoting strip (about 1/5 wall height) — purely a color band, same white tone, subtle separation line only.
- FLOOR: pale bleached-oak herringbone parquet flooring (V-shaped chevron pattern), very light warm-white wood tone.
- Light warm-gray stone FOUNDATION/BASEBOARD around the outside base.
- 1-2 pale bleached-wood STEPS at front-left.
- Interior is completely EMPTY — absolutely no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of light sandy ground (pale cream), smooth pale flat stepping stones, tiny tufts of grass at edges only.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, curtains, plants, or any standalone objects on or against the walls. Walls must remain clean and bare.

COLOR PALETTE: pure white & off-white, pale bleached oak, dove gray roof, light gray stone base, pale cream ground.
STYLE: kawaii hand-drawn, light gray outlines, bright airy Scandinavian feel, ultra-clean and minimalist. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
```

### 7c. 复古花坊（bg_room_vintage.png）

> 🎨 **风格关键词**：欧式古董店、深暖色调、铁艺花窗、做旧质感
> **差异化要素**：深胡桃木棋盘格地板 · 暖米色做旧素墙 · 深红木柱子+茛苕叶雕花 · 铁艺拱窗 · 酒红瓦顶 · 深灰旧石基

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded warm-brown outlines, viewed from upper-left at 45 degrees. Pure white background. European vintage antique color redesign - SAME room structure as reference.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: deep BURGUNDY/wine-red clay tiles with slightly aged weathered texture, same semicircular tile shape with visible rows, covering entire room.
- FOUR square dark-stained MAHOGANY PILLARS at the four corners, with subtle carved acanthus leaf details at the capitals (tops of pillars). Warm dark wood tone.
- BACK WALL: a single clean, flat WARM ANTIQUE-BEIGE / PARCHMENT colored surface with a subtle aged plaster texture. Completely plain and bare — no wallpaper, no exposed brick. Has 1 window with dark WROUGHT-IRON arched frame, decorative iron scrollwork at the arch top, small diamond-shaped glass panes.
- RIGHT WALL: same warm antique-beige aged plaster surface. Has 2 windows with dark wrought-iron arched frames, decorative scrollwork, diamond panes, evenly spaced.
- Where the walls meet the floor, a low dark wood wainscoting strip (about 1/5 wall height) in aged mahogany tone — purely a color band.
- FLOOR: dark walnut & warm mahogany CHECKERBOARD pattern tile flooring (alternating dark-brown and medium-brown squares in a diamond layout), rich and elegant.
- Dark charcoal-gray weathered stone FOUNDATION/BASEBOARD with rough-hewn texture around the outside base.
- 1-2 dark stained wood STEPS at front-left.
- Interior is completely EMPTY — absolutely no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of worn COBBLESTONE ground (dark sandy-brown with faded stone pattern), old stone slab path, sparse grass tufts at edges.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, exposed brick sections, wallpaper patterns, or any standalone objects on or against the walls. Walls must show only their flat aged-plaster surface and windows. (Carved decorative details on pillars and iron scrollwork on window frames are fine.)

COLOR PALETTE: dark walnut & mahogany wood, burgundy/wine-red roof tiles, antique brass accents, warm antique-beige walls, charcoal stone base.
STYLE: kawaii hand-drawn, warm brown outlines, nostalgic old European antique atmosphere, rich and storied. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
```

### 7d. 🌸 春日粉（bg_room_spring.png）— 季节限定

> 🎨 **风格关键词**：樱花粉梦幻、轻柔少女、花瓣纷飞
> **差异化要素**：浅粉白色细木纹地板 · 柔和粉色素墙 · 粉色柱子+樱花藤蔓 · 樱花枝雕花窗框 · 粉色珍珠光瓦顶 · 粉石基+飘落花瓣

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded PINK outlines, viewed from upper-left at 45 degrees. Pure white background. Dreamy spring cherry blossom color redesign - SAME room structure as reference.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: soft BABY-PINK semicircular tiles with a subtle pearl sheen, same tile shape with visible rows. A few delicate cherry blossom branches with pink blooms extending from behind the roof edge. Scattered petals resting on the tile surface.
- FOUR square LIGHT-PINK painted wooden PILLARS at the four corners. Each pillar is wrapped in a delicate cherry blossom VINE GARLAND spiraling upward (tiny painted pink flowers and green leaves — decorative carving/painting on the pillar itself, not a separate object).
- BACK WALL: a single clean, flat soft BLUSH-PINK colored surface (gentle pastel pink, like a light watercolor wash). Completely plain and bare — no wallpaper, no sakura prints. Has 1 window with PINK-PAINTED wooden frame, adorned with a small spray of cherry blossom branch carvings along the top of the frame.
- RIGHT WALL: same soft blush-pink surface. Has 2 windows with pink frames and cherry blossom branch carvings at the top, evenly spaced.
- Where the walls meet the floor, a low rose-white wainscoting strip (about 1/5 wall height) — purely a color band.
- FLOOR: light pinkish-white fine wood plank flooring with very subtle grain, giving a soft warm-pink glow underfoot.
- Light BLUSH-PINK stone FOUNDATION/BASEBOARD around the outside base.
- 1-2 light pink-washed wood STEPS at front-left with a few scattered pink petals on the treads.
- A few floating pink cherry blossom petals drifting gently in the air inside.
- Interior is completely EMPTY — absolutely no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of light pale ground dotted with fallen pink petals, pink-tinted smooth stepping stones, tiny spring-green grass tufts with small pink wildflowers at edges.
- BACKGROUND: pure white (#FFFFFF).
- FLOATING ELEMENTS: scattered cherry blossom petals gently falling throughout the entire scene, creating a magical dreamy atmosphere.

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, or any standalone objects on or against the walls. Walls must show only their flat pastel-pink surface and windows. Cherry blossom decorations are ONLY allowed as: carved/painted details on pillars and window frames, floating petals in the air, and on the roof edge. Do NOT add wall-mounted or freestanding objects.

COLOR PALETTE: baby pink, sakura blush, rose-pink, pearl white, spring green leaf accents, light pink stone.
STYLE: kawaii hand-drawn, soft pink outlines, magical dreamy spring cherry blossom atmosphere, feminine and enchanting. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
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
