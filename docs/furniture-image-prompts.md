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
> **配色方案**：粉橙色瓦顶 · 蜂蜜棕木地板 · 奶油白墙 · 焦糖棕柱子 · 棕木窗框 · 灰石地基

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded brown outlines, viewed from upper-left at 45 degrees. Pure white background.

STRUCTURE (must follow exactly):
- An open room with only TWO WALLS forming an L-shape: a BACK WALL (running from upper-left to upper-right) and a RIGHT WALL (running from upper-right to lower-right). The FRONT side and LEFT side are completely open — NO front wall, NO left wall, NO door, NO exterior facade, NO signage, NO awning.
- ROOF: CORAL-PINK / salmon-orange semicircular clay tile roof (#E8967A) with visible tile rows and subtle shadow between each row, covering the entire room from above. The roof edge trim is CHOCOLATE BROWN wood (#5C3A1E).
- FOUR square CARAMEL-BROWN wooden PILLARS (#8B5E3C) at the four corners of the room (back-left, back-right, front-left, front-right). Pillars are simple structural columns with visible wood grain texture.
- BACK WALL: a single clean, flat WARM CREAM / ivory colored surface (#FFF5E1). The wall must be completely plain and bare — NO shelves, NO cabinets, NO hangings. Just a smooth warm-tinted wall. Has 1 traditional wooden grid-pane window with CHOCOLATE BROWN frame (#5C3A1E), 3×2 grid muntins, light cyan-tinted glass panes.
- RIGHT WALL: same warm cream / ivory surface (#FFF5E1). Has 2 traditional wooden grid-pane windows (same chocolate brown frames, 3×2 grid, cyan glass), evenly spaced.
- Where the walls meet the floor, there is a low wooden wainscoting strip (about 1/5 wall height) in NATURAL OAK tone (#C4944A, distinctly darker than the cream wall above) — this is purely a color band, NOT a protruding shelf or ledge.
- FLOOR: warm HONEY-BROWN horizontal wood plank flooring (#B8834A) with visible natural wood grain lines and subtle knot details. Each plank clearly defined with thin dark seam lines between them.
- MEDIUM GRAY stone FOUNDATION/BASEBOARD (#A0A0A0) with visible round cobblestone texture, visible around the outside base of the room, raising the floor above ground level.
- 1-2 short HONEY-BROWN wooden STEPS (#B8834A, same as floor) at the front-left leading down to the outdoor area.
- Interior is completely EMPTY — absolutely no furniture, no shelves, no cabinets, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): a small irregular patch of SANDY-YELLOW dirt ground (#E8D5A8), scattered gray pebble stepping stones (#B0B0B0), tiny tufts of green grass only at the edges.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, clocks, or any standalone objects on or against the walls. Walls must remain clean and bare. (Carved/painted decorative patterns on pillars and window frames are fine.)

COLOR CONTRAST GUIDE (each part must be visually distinct):
- Roof (coral-pink #E8967A) ≠ Wall (cream #FFF5E1) ≠ Floor (honey-brown #B8834A) ≠ Pillar (caramel #8B5E3C) ≠ Foundation (gray #A0A0A0)
- The floor should be clearly DARKER than the walls. The pillars should be clearly DARKER than the floor. The wainscoting is a visible mid-tone between wall and floor.

STYLE: kawaii hand-drawn, soft brown outlines, warm cozy cottage atmosphere. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
```

### 7b. 清新薄荷白（bg_room_white.png）

> 🎨 **风格关键词**：北欧极简、明亮通透、色彩层次清晰
> **配色方案**：天蓝灰瓦顶 · 浅米色人字拼地板 · 白墙 · 浅灰蓝柱子 · 原木色窗框 · 浅灰石基

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded gray outlines, viewed from upper-left at 45 degrees. Pure white background. Nordic minimalist color redesign - SAME room structure.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: SLATE BLUE-GRAY semicircular tiles (#9EAEBB) with visible tile rows and subtle shadow lines. The roof edge trim is LIGHT GRAY wood (#C8C8C8).
- FOUR square LIGHT BLUE-GRAY painted wooden PILLARS (#B8C5D0) at the four corners, clean and elegant. Smooth painted surface.
- BACK WALL: a single clean, flat SOFT WHITE surface with a very subtle warm undertone (#F8F6F0, NOT pure white — slightly warmer). Completely plain and bare. Has 1 window with NATURAL LIGHT-OAK wooden frame (#C4A46A), 2×2 grid muntins, pale blue-tinted glass panes.
- RIGHT WALL: same soft white surface (#F8F6F0). Has 2 windows with same light-oak frames, 2×2 grid, pale blue glass, evenly spaced.
- Where the walls meet the floor, a low wainscoting strip (about 1/5 wall height) in PALE WARM GRAY (#D8D0C8) — a gentle visible color band that adds depth between the white wall and the floor.
- FLOOR: WARM BEIGE / light-tan herringbone parquet flooring (#D4C4A8, V-shaped chevron pattern). Each plank has subtle wood grain. The floor tone should be clearly WARMER and DARKER than the white walls.
- PALE GRAY stone FOUNDATION/BASEBOARD (#C0C0C0) with smooth rounded cobblestone texture around the outside base.
- 1-2 LIGHT OAK-TONED wooden STEPS (#C4A46A) at front-left.
- Interior is completely EMPTY — absolutely no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of PALE CREAM sandy ground (#EDE8D8), smooth pale flat stepping stones (#D0D0D0), tiny tufts of green grass at edges only.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, curtains, plants, or any standalone objects on or against the walls. Walls must remain clean and bare.

COLOR CONTRAST GUIDE (each part must be visually distinct):
- Roof (slate blue-gray #9EAEBB) ≠ Wall (soft white #F8F6F0) ≠ Floor (warm beige #D4C4A8) ≠ Pillar (blue-gray #B8C5D0) ≠ Window frame (oak #C4A46A) ≠ Foundation (pale gray #C0C0C0)
- The floor should be clearly WARMER/DARKER than the walls. The window frames add a warm wood accent against the cool palette. The pillars are a cool blue-gray, contrasting with the warm floor.

STYLE: kawaii hand-drawn, soft gray outlines, bright airy Scandinavian feel with clear color layering. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
```

### 7c. 复古花坊（bg_room_vintage.png）

> 🎨 **风格关键词**：欧式古董店、深暖色调、铁艺花窗、做旧质感
> **配色方案**：酒红瓦顶 · 深胡桃棋盘格地板 · 暖米色旧墙 · 深棕红木柱+雕花 · 黑铁窗框 · 深灰旧石基

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded warm-brown outlines, viewed from upper-left at 45 degrees. Pure white background. European vintage antique color redesign - SAME room structure.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: deep BURGUNDY / wine-red clay tiles (#7A2E3A) with slightly aged weathered texture and visible tile rows. The roof edge trim is DARK BROWN wood (#3E2216).
- FOUR square DARK MAHOGANY PILLARS (#4A2012) at the four corners, with subtle carved acanthus leaf details at the capitals (tops of pillars). Rich dark wood grain visible.
- BACK WALL: a single clean, flat WARM ANTIQUE-BEIGE surface (#E8D8B8) with a subtle aged plaster texture (slightly mottled warm tone). Completely plain and bare — no wallpaper, no exposed brick. Has 1 window with DARK WROUGHT-IRON arched frame (#2A2A2A), decorative iron scrollwork at the arch top, small diamond-shaped amber-tinted glass panes.
- RIGHT WALL: same warm antique-beige surface (#E8D8B8). Has 2 windows with dark wrought-iron arched frames, scrollwork, amber diamond panes, evenly spaced.
- Where the walls meet the floor, a low wainscoting strip (about 1/5 wall height) in DARK WALNUT tone (#5A3520) — a rich dark wood band that creates strong contrast with the lighter wall above.
- FLOOR: DARK WALNUT & MEDIUM BROWN CHECKERBOARD pattern tile flooring (alternating dark squares #4A2A15 and medium squares #7A5030 in a diamond layout). Rich, warm, and elegant with clear pattern definition.
- DARK CHARCOAL-GRAY weathered stone FOUNDATION/BASEBOARD (#5A5A5A) with rough-hewn cobblestone texture around the outside base.
- 1-2 DARK WALNUT wooden STEPS (#5A3520) at front-left.
- Interior is completely EMPTY — absolutely no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of DARK SANDY-BROWN worn cobblestone ground (#B0956A), old dark stone slab path, sparse grass tufts at edges.
- BACKGROUND: pure white (#FFFFFF).

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, exposed brick sections, wallpaper patterns, or any standalone objects on or against the walls. Walls must show only their flat aged-plaster surface and windows. (Carved decorative details on pillars and iron scrollwork on window frames are fine.)

COLOR CONTRAST GUIDE (each part must be visually distinct):
- Roof (burgundy #7A2E3A) ≠ Wall (antique beige #E8D8B8) ≠ Floor (dark walnut checkerboard #4A2A15/#7A5030) ≠ Pillar (dark mahogany #4A2012) ≠ Window frame (iron black #2A2A2A) ≠ Foundation (charcoal #5A5A5A)
- The floor should be dramatically DARKER than the walls. The dark pillars frame the light walls. The burgundy roof crowns the warm palette. Strong light-dark contrast throughout.

STYLE: kawaii hand-drawn, warm brown outlines, nostalgic old European antique atmosphere, rich and layered. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
```

### 7d. 🌸 春日粉（bg_room_spring.png）— 季节限定

> 🎨 **风格关键词**：樱花粉梦幻、轻柔少女、花瓣纷飞、颜色有层次
> **配色方案**：玫瑰粉瓦顶 · 浅原木色地板 · 淡粉白墙 · 深粉色柱子+樱花藤蔓 · 粉棕窗框 · 浅粉石基+飘落花瓣

```
A cute kawaii 2.5D isometric room interior, hand-drawn cartoon style with soft rounded PINK outlines, viewed from upper-left at 45 degrees. Pure white background. Dreamy spring cherry blossom color redesign - SAME room structure.

STRUCTURE (must follow exactly - same layout, only colors/materials change):
- An open room with only TWO WALLS forming an L-shape: BACK WALL + RIGHT WALL. FRONT and LEFT sides completely open — NO door, NO exterior facade, NO signage, NO awning.
- ROOF: ROSE-PINK semicircular tiles (#E8889A) with a subtle pearl sheen and visible tile rows. The roof edge trim is DUSTY ROSE wood (#C4707A). A few delicate cherry blossom branches with BRIGHT PINK blooms (#FF9EAE) extending from behind the roof edge. Scattered petals resting on tiles.
- FOUR square MEDIUM PINK-BROWN wooden PILLARS (#C4848A) at the four corners. Each pillar is wrapped in a delicate cherry blossom VINE GARLAND spiraling upward (tiny BRIGHT PINK flowers #FF9EAE and SPRING GREEN leaves #7ABE5E — decorative carving/painting on the pillar itself, not a separate object). The vines add colorful GREEN accents that contrast beautifully with the pink.
- BACK WALL: a single clean, flat VERY PALE PINK / almost-white surface (#FFF0F2, like a blush-tinted white). Completely plain and bare — no wallpaper, no sakura prints on the wall surface. Has 1 window with DUSTY ROSE wooden frame (#C4707A), adorned with cherry blossom branch carvings at the top, pale pink-tinted glass panes.
- RIGHT WALL: same very pale pink surface (#FFF0F2). Has 2 windows with dusty rose frames and cherry blossom carvings, evenly spaced.
- Where the walls meet the floor, a low wainscoting strip (about 1/5 wall height) in SOFT PINK tone (#F0C0C8) — a gentle visible color band darker than the pale wall above.
- FLOOR: LIGHT NATURAL WOOD plank flooring (#D4B896, warm beige-wood tone — NOT pink). Visible wood grain lines and plank seams. The floor should look like natural light wood, providing a warm NEUTRAL contrast against all the pink elements.
- PALE PINK stone FOUNDATION/BASEBOARD (#D4A0A8) with rounded cobblestone texture around the outside base.
- 1-2 WARM WOOD-TONED STEPS (#C4A080) at front-left with a few scattered BRIGHT PINK petals on the treads.
- A few floating cherry blossom petals (BRIGHT PINK #FF9EAE) drifting gently in the air inside.
- Interior is completely EMPTY — absolutely no furniture, no items, no wall decorations.
- OUTDOOR AREA (front-left, small patch): small irregular patch of PALE CREAM ground (#F0E8D8) dotted with bright pink fallen petals, pale pink-tinted stepping stones (#D4B0B0), tiny SPRING-GREEN grass tufts (#7ABE5E) with small pink wildflowers at edges.
- BACKGROUND: pure white (#FFFFFF).
- FLOATING ELEMENTS: scattered cherry blossom petals (bright pink #FF9EAE) gently falling throughout the entire scene.

IMPORTANT: Do NOT add any door, exterior facade, signage, or awning. Do NOT add any shelves, cabinets, display racks, picture frames, or any standalone objects on or against the walls. Walls must show only their flat pale-pink surface and windows. Cherry blossom decorations are ONLY allowed as: carved/painted details on pillars and window frames, floating petals in the air, and on the roof edge. Do NOT add wall-mounted or freestanding objects.

COLOR CONTRAST GUIDE (each part must be visually distinct — NOT all the same pink!):
- Roof (rose-pink #E8889A) ≠ Wall (pale blush-white #FFF0F2) ≠ Floor (natural wood beige #D4B896, NOT pink!) ≠ Pillar (pink-brown #C4848A) ≠ Window frame (dusty rose #C4707A) ≠ Foundation (pale pink stone #D4A0A8)
- CRITICAL: The floor must be NATURAL WOOD TONE (beige/tan), NOT pink. This provides essential contrast so the room doesn't look like one blob of pink. The spring green vine leaves and grass add vital complementary color accents.

STYLE: kawaii hand-drawn, soft pink outlines, magical dreamy spring cherry blossom atmosphere with clear color layering. Absolutely no furniture inside or outside. Mobile portrait aspect ratio (750x1334).
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
