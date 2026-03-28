# 店主形象 sprite 美术规范（与游戏内缩放一致）

> **Cursor 强制规则**：`.cursor/rules/owner-sprite-art-spec.mdc`（`alwaysApply: true`），与本文一致；协作时以 Rule 摘要为必遵守约束，细节以本文为准。

用于「自然少女」默认套与「花店小姐姐」等换装：同一套内三张图（全身睁眼 / 全身闭眼 / 半身）角色身份一致；**不同套之间仅服装与配饰变，脸型与发型基底一致**，便于玩家认出是同一人。

## 0. 全身像风格规范（与 default / florist 批次对齐，生图强制）

以下适用于 **P1 / P2 全身像**（花店等距场景中的店主立绘）。**半身 P3** 的对话立绘语言、参考图策略与命令见 **§1.2** 与下表。

### 0.1 头身与轮廓

- **超 Q / SD（super-deformed）**：全身站立足印到发顶约 **2～2.8 头身**；单「头」含发量体积。
- **头大**：头高约占全身 **42%～52%**；颈极短；躯干小而圆桶状；四肢短、略粗、关节简化；手小脚圆；整体 **玩具感剪影**，缩小进房间仍可读。
- **禁止**：4～5 头身少女体、细长腿、写实比例、时尚插画模特体、油画级写实面部。

### 0.2 画风

- **2D 休闲合成 / merge 类 NPC**：暖色 pastel、平涂到轻渐变阴影、腮红；**棕褐软线稿**（勿纯黑硬线）；大眼棕瞳 + 白色高光。
- **禁止**：油画、电影感 3D、半身插画式的写实渲染（全身像不要做成「插画立绘」而要是 **小游戏场景角**）。

### 0.3 画布与背景（全身）

- 比例 **9:16**，**仅 1 人**。
- **脚底**落在画面高度 **自下约 10%～14%**；**发顶（含发型/冠）**约在 **自上约 16%～22%**；上下留 **#FF00FF 品红** 留白。
- **水平居中**，左右剪影外各约 **8%～12%** 品红边。
- 背景 **纯品红 #FF00FF**，无渐变、无分割、无字、无水印。

### 0.4 姿势与 P2

- **P1**：全身、微朝右 **3/4**、**睁眼**、双臂自然下垂略外张。
- **P2**：与 P1 **姿势/衣装/取景一致**，仅 **闭眼**微笑（简单弯月眼睑线）；须附 P1 作参考图生成。

### 0.5 英文提示词模板（与仓库内 P1 文件结构一致）

生图时以各套 `docs/prompt/owner_outfit_<id>_p1_full_open_nb2_prompt.txt` 为准；结构固定为四段：

1. `CHIBI PROPORTION — critical...`（SD 头身与禁止项）
2. `ART STYLE:`（2D merge-game、线稿与光影）
3. `LAYOUT STANDARD for game sprites — follow exactly:`（9:16、边距、品红底）
4. `Identity —` + `Outfit <theme>:`（该套发型与服装，**用简化块面**写，避免微细节）

女王套等 **长裙、高冠** 须在 P1 中写明：**冠低矮紧凑、裙摆简化为 Q 版 A 字/及膝感，保证双脚仍在底部条带内**。

### 0.6 仅生成全身（不覆盖半身）

```bash
cd /path/to/huahua
python3 scripts/gen_owner_outfit_panels.py outfit_spring \
  docs/prompt/owner_outfit_spring_p1_full_open_nb2_prompt.txt \
  docs/prompt/owner_outfit_spring_p2_full_closed_nb2_prompt.txt \
  --full-only
```

可省略第三个参数（P3 提示词路径）。仍会写入 `minigame/images/owner/full_<id>.png` 与 `full_<id>_eyesclosed.png`，**不会**重写 `chibi_<id>.png`。

## 1. 生产流程

- 使用 **三张竖图 9:16** 分别生成（见 `docs/prompt/owner_outfit_*_p{1,2,3}_*.txt`）。**P2** 以 **P1 全身** 为参考（闭眼与睁眼一致）。**P3（半身）**：`outfit_default` 仍以 P1 为参考；**其余套装**以已通过验收的 **`minigame/images/owner/chibi_default.png`** 为 Gemini 参考图，强制对齐默认半身的画风与胸像比例，避免 P1 的 SD 全身比把半身带偏。**若暂不需要半身，可加 `--full-only` 只出 P1+P2**（见 §0.6）。若仓库中缺少 `chibi_default.png`，脚本会回退为 P1 参考并打印警告。
- 脚本：`scripts/gen_owner_outfit_panels.py`（品红底 → 缩放 → **色键去底**，仅作自动化初稿）。
- **入库尺寸**：全身 `197×384`，半身 `249×384`（与现有 `TextureCache` 一致）。

### 1.1 抠底入库（全身 + 半身，强制）

**`gen_owner_outfit_panels.py` 里的品红缩放 + 色键仅为自动化初稿，不得作为最终入库资源。**  
凡写入 `minigame/images/owner/` 的 **`full_*.png`（睁眼/闭眼）与 `chibi_*.png`（半身）**，在入库 / 提交前 **一律** 再经 **`rembg` + `birefnet-general`**（BiRefNet 通用高精度，本项目抠图**唯一默认档**）。

- **禁止**仅以品红/粉色色键、魔棒或按背景色抠图作为最终去底（易留品红边、吃发丝；API 若非品红底则色键失效）。
- **全项目一致**：工具图标、宝箱等其它资源凡用 rembg，**默认同样 `birefnet-general`**，勿改用 lite 以免边质量不一致。
- **依赖**：Cursor skill `remove-background`（`rembg`、`onnxruntime`），模型缓存 `~/.u2net/`。
- **不处理**：`full_*_original.png` 等备份；脚本跳过 `*_original.png`。

**一键批量（推荐，含全身 + 半身）**：

```bash
chmod +x scripts/rembg_owner_full_sprites.sh   # 首次
./scripts/rembg_owner_full_sprites.sh
```

若 `rembg_batch.py` 不在默认路径：

```bash
REMBG_BATCH=/path/to/remove-background/scripts/rembg_batch.py ./scripts/rembg_owner_full_sprites.sh
```

**单张示例**：

```bash
python3 ~/.cursor/skills/remove-background/scripts/rembg_single.py minigame/images/owner/chibi_outfit_florist.png \
  -o minigame/images/owner/chibi_outfit_florist.png -m birefnet-general
```

（建议先输出到临时文件再 `mv` 覆盖。）**手工 rembg 后须再跑** `python3 scripts/owner_sprite_post_rembg.py <同一路径>`，与批量脚本一致。

**备选**：单张试对比可用 `isnet-anime`；**规范默认仍以 `birefnet-general` 为准**。

### 1.2 rembg 后的品红渗色（为何还有一点粉边）

生图统一 **#FF00FF** 底，即使用 **`birefnet-general`**（当前最高默认档），半透明抗锯齿边里仍常混入 **粉/品红 RGB**，看起来像「品红边」。这不是模型降档，而是 **背景色渗入 alpha 渐变**。

批量脚本在写回前会再跑 **`scripts/owner_sprite_post_rembg.py`**（与 `process_board_ui_nb2.py` 的 chroma 清理同思路）：在仍可见的像素上检测品红倾向并 **置透明**。若个别资源仍明显，可单张再执行：

```bash
python3 scripts/owner_sprite_post_rembg.py minigame/images/owner/chibi_outfit_summer.png
```

### 1.3 半身像（P3）生成方法（固化，须遵守）

**目标**：半身与订单区 `customer_*` 同语言，且各换装套之间 **头身取景、线稿与光影** 与 **`chibi_default.png`** 一致（避免 P1 SD 全身当参考时比例与画风跑偏）。

| 步骤 | 要求 |
|------|------|
| 模型与画幅 | 由 `scripts/gen_owner_outfit_panels.py` 调用 Gemini **`gemini-3.1-flash-image-preview`**，**`--aspect-ratio 9:16`**（与 NB2 流程一致） |
| P3 参考图 | **`outfit_default`**：附 **P1 全身** 缩略图。其余 **`outfit_*`**：附 **`minigame/images/owner/chibi_default.png`**（已通过验收的默认半身）；仓库缺该文件时脚本回退 P1 并 **警告** |
| 英文提示词 | 每套 **`docs/prompt/owner_outfit_<id>_p3_chibi_nb2_prompt.txt`**，须含「以默认半身为画风锚、仅换装发」等约束（与仓库现稿一致） |
| 缩放与初稿去底 | API 出图为 **9:16**，入库 **249×384（半身）** / **197×384（全身）** 的框 **比 9:16 更宽**，须 **等比缩放后居中 letterbox** 进目标画布（`gen_owner_outfit_panels.py` 内 `fit_resize_to_canvas`），**禁止** 直接非等比 `resize` 以免半身横向拉扁；再品红色键 → **仅自动化初稿** |
| 最终入库 | **必须** `./scripts/rembg_owner_full_sprites.sh`（**`birefnet-general`** + **§1.2** 品红渗色清理） |

**仅重跑某一套的半身（不碰全身）**：

```bash
cd /path/to/huahua
python3 scripts/gen_owner_outfit_panels.py outfit_queen \
  docs/prompt/owner_outfit_queen_p1_full_open_nb2_prompt.txt \
  docs/prompt/owner_outfit_queen_p2_full_closed_nb2_prompt.txt \
  docs/prompt/owner_outfit_queen_p3_chibi_nb2_prompt.txt \
  --only-panel 3
./scripts/rembg_owner_full_sprites.sh
```

**批量重跑多套 P3**（`raw` 里需已有对应 `owner_<id>_p1.png`，否则先完整跑一遍该套）：

```bash
for id in outfit_queen outfit_spring outfit_vintage; do
  python3 scripts/gen_owner_outfit_panels.py "$id" \
    "docs/prompt/owner_${id}_p1_full_open_nb2_prompt.txt" \
    "docs/prompt/owner_${id}_p2_full_closed_nb2_prompt.txt" \
    "docs/prompt/owner_${id}_p3_chibi_nb2_prompt.txt" \
    --only-panel 3
  sleep 15
done
./scripts/rembg_owner_full_sprites.sh
```

## 2. 画布与构图（三张共用，强制）

| 项目 | 要求 |
|------|------|
| 比例 | 9:16 单卡，**仅 1 个角色** |
| 全身像比例 | 同 **§0 全身像风格规范**：**2～2.8 头身 SD**，与房屋场景一致；**禁止** 4～5 头身少女体（详见 §0.1） |
| 垂直位置（全身） | **脚底**落在画面高度 **自下约 10%～14%** 的条带内；**头发顶**约在 **自上约 16%～22%** 条带内，上下留出品红留白 |
| 水平 | **角色居中**，剪影左右至少各 **约 8%～12%** 画布宽度的品红边 |
| 半身像（P3） | **订单区客人半身 `customer_*` 同系列**：手绘 2D、**柔和 3D 体积**、低饱和 pastel、大眼、略朝右 **3/4**。构图是 **腰以上胸像**：**禁止**胯、腿、脚、鞋入画；**头+发**约占画面高度 **58%～72%**。非默认套生图时以 **`chibi_default.png`** 为参考（见 **§1.3**）。品红底与边距见各套 `owner_outfit_*_p3_*.txt`；生成后须 **§1.1 + §1.2**（`birefnet-general` + 渗色清理） |
| 背景 | 纯色 **#FF00FF**（RGB 255,0,255），无渐变、无分割线、无字 |
| 画风（全身） | 手绘 2D、偏暖 pastel、简化阴影、**棕褐线稿**勿纯黑、**休闲合成类 / merge 游戏 NPC** 卡通立绘，勿油画或时尚插画写实 |

## 3. 角色身份基底（各套通用）

- 少女，约 18 岁观感。
- 大眼、棕瞳、软高光；表情温和。
- **发型与配饰可按套装变化**（双马尾、高马尾、半扎长发、披发+花冠等），耳环、花环、发带等可与主题一致；**不要求每套都是同一款短发**，但需仍是同一人种与气质连续的「店主」角色。

## 4. 服装区分

| 套装 id | 服装要点 |
|---------|----------|
| `outfit_default` | 粉泡泡袖上衣、**白色围裙两圆兜**、**灰蓝及膝 A 字裙**、**白色玛丽珍鞋** |
| `outfit_florist` | 米白/奶油泡泡袖、**深绿花艺围裙+口袋**、**棕腰带**、**橄榄绿中裙**、**棕短靴**、围裙可挂**小剪刀**与**干花点缀** |
| `outfit_spring` | **双马尾+樱花丝带与花瓣发饰**，**樱花坠耳环**；粉系和风连衣裙、樱花印花、蕾丝袖口、花篮可选 |
| `outfit_summer` | **高马尾+向日葵发夹**，**小金环耳饰**；白短上衣、牛仔短背带裤、黄帆布鞋、背后草帽 |
| `outfit_vintage` | **半扎波浪长发+酒红丝绒蝴蝶结**，**珍珠坠耳环**；蕾丝高领衬衣、酒红马甲、灰粉长裙、系带短靴、领针 |
| `outfit_queen` | **披肩波浪长发+金花叶冠**，**金花晶石耳坠**；白紫粉渐变礼裙、金藤刺绣、花瓣披肩、手持水晶花苞权杖 |

对应生图提示词：`docs/prompt/owner_outfit_<id>_p{1,2,3}_*.txt`。

批量生成全身（四套，写入 minigame，不覆盖半身）：

```bash
cd /path/to/huahua
for outfit in outfit_spring outfit_summer outfit_vintage outfit_queen; do
  python3 scripts/gen_owner_outfit_panels.py "$outfit" \
    "docs/prompt/owner_${outfit}_p1_full_open_nb2_prompt.txt" \
    "docs/prompt/owner_${outfit}_p2_full_closed_nb2_prompt.txt" \
    --full-only
  sleep 15
done
```

预览目录（不入库）时为每条命令追加 `--preview-root "$PREVIEW"`。

## 5. 三张分工

1. **P1**：全身，微侧向右 3/4，**睁眼**，手臂自然下垂略外张。
2. **P2**：与 P1 **姿势、衣装、取景一致**，仅 **闭眼**微笑。
3. **P3**：半身（腰以上），**正脸为主**可微朝右，**双眼可见**；姿势可与全身不同。

## 6. 预览输出目录（不入库 minigame）

规范试做资源放在仓库外（本批已生成）：

`/Users/huyi/rosa_games/game_assets/huahua/assets/owner_sprite_spec_v1/<outfit_id>/`

- `raw/`：API 直出 9:16 与参考缩略图  
- 根目录：`full_<outfit_id>.png`、`full_<outfit_id>_eyesclosed.png`、`chibi_<outfit_id>.png`（已缩放至 197×384 / 249×384 并去底）

**并入游戏时文件名**：`outfit_florist` 与现网一致。`outfit_default` 在工程里对应的是 `full_default.png` / `full_default_eyesclosed.png` / `chibi_default.png`（非 `full_outfit_default`），拷贝时需改名或改 `TextureCache` 映射。

生成命令示例：

```bash
python3 scripts/gen_owner_outfit_panels.py outfit_default \
  docs/prompt/owner_outfit_default_p1_full_open_nb2_prompt.txt \
  docs/prompt/owner_outfit_default_p2_full_closed_nb2_prompt.txt \
  docs/prompt/owner_outfit_default_p3_chibi_nb2_prompt.txt \
  --preview-root /Users/huyi/rosa_games/game_assets/huahua/assets/owner_sprite_spec_v1
```

## 7. 与程序显示倍率

游戏按 **整张纹理高度** 缩放到固定 `targetH`，留白不同会导致视觉身高差。若某套构图仍偏差，可在 `DressUpConfig` 为该套设 `ownerShopDisplayScale` / `ownerBoardDisplayScale` 微调（默认 1）。
