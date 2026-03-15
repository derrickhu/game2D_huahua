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

## 🖼️ 第 7 张：房间风格背景（独立大图）

> 房间背景不放在网格中，每个风格单独一张完整图片。

### 7a. 温馨原木风（bg_room_default.png）

```
A complete 2.5D isometric flower shop interior scene, kawaii hand-drawn cartoon style. Warm natural wood floors, light green walls with white wainscoting. A large window on the left letting in soft sunlight. Empty wooden shelving areas along walls (furniture will be added separately). Cozy warm color palette: honey wood, soft mint green, cream white. The room has a cute arched doorway at the bottom. Clean and spacious interior with no furniture placed (just the empty room structure). Soft ambient lighting. Size: 750x1334 pixels aspect ratio (mobile portrait).
```

### 7b. 清新白调（bg_room_white.png）

```
A complete 2.5D isometric flower shop interior scene, kawaii hand-drawn cartoon style. Bright white walls with subtle texture, light birch wood flooring, Nordic minimalist design. Large windows with white curtains, letting in bright natural light. Clean white shelving outlines along walls (furniture will be added separately). Color palette: pure white, light gray, pale birch wood, touches of soft blue. The room has a modern glass doorway at the bottom. Spacious and airy interior with no furniture placed (just the empty room structure). Bright even lighting. Size: 750x1334 pixels aspect ratio (mobile portrait).
```

### 7c. 复古花坊（bg_room_vintage.png）

```
A complete 2.5D isometric flower shop interior scene, kawaii hand-drawn cartoon style. Exposed brick walls in warm brown tones, dark hardwood floors with vintage pattern. An old-fashioned arched window with iron frames. European antique shop atmosphere. Color palette: warm browns, burgundy accents, aged gold, dark wood tones. Vintage wallpaper with subtle floral pattern on upper walls. The room has an ornate wooden door at the bottom. Nostalgic and charming interior with no furniture placed (just the empty room structure). Warm golden lamplight atmosphere. Size: 750x1334 pixels aspect ratio (mobile portrait).
```

### 7d. 🌸 春日粉（bg_room_spring.png）— 季节限定

```
A complete 2.5D isometric flower shop interior scene, kawaii hand-drawn cartoon style. Soft pink walls with cherry blossom wallpaper pattern, light pink marble-pattern floor. Windows framed with cherry blossom branches, pink petals gently falling inside. Dreamy spring atmosphere. Color palette: baby pink, sakura pink, soft white, rose gold accents. The room has a pink-framed doorway with a small cherry blossom wreath. Magical spring interior with no furniture placed (just the empty room structure). Soft pink-tinted lighting. Size: 750x1334 pixels aspect ratio (mobile portrait).
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
