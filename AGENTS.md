# 花花妙屋（game2D_huahua）项目规则

## 场景房壳（`bg_room_*`）设计与生图硬性规范

凡设计、绘制或修改装修场景房壳（`minigame/subpkg_deco/images/house/bg_room_*.png`），必须严格遵守以下规范：

1. **室内空间严禁画任何立面隔断（通用铁律）**
   - 房壳在运行时是垫在所有家具底层的单张背景精灵，无法与玩家摆放的家具逐像素穿插遮挡。
   - **严禁**在房壳内部地面中间绘制任何屏风、玻璃隔断门框、内隔墙、拱门洞或中置立柱。
   - 所有楼层内部及室内外露台衔接处必须保持 **100% 敞亮贯通、平整无遮挡**，确保玩家可在任意位置自由摆放家具；隔断/屏风类需求一律拆分为可自由拖拽的独立家具实现。

2. **透视锁死与二层/多层空间比例**
   - 统一采用 **2:1 正交等距投影**（墙脚线与地坪边相对水平约 `±26.6°～30°`，竖边严格 `90°` 垂直），**禁止**在楼板边缘自由手绘弧线以免产生透视歪斜。
   - 复杂双层或三台错层大房壳，优先先通过 2:1 等距数学脚本生成 **硬结构蓝图（Hard Structure Blueprint）** 锁死透视与比例，再交由 `image-generator` 手绘上色。
   - 二层（及三层错层）必须做成**进深充足、方正完整的实用大房间**（可容纳床、沙发、花架、地毯等成套大件），**禁止**画成局促狭窄的装饰性窄走廊；楼梯须紧贴边缘或转角布置，不切碎主地面。
   - 正面完全敞开（Open-front cutaway），墙顶仅保留外挑瓦檐或分段斜天窗棚檐，**严禁**用屋顶封盖遮挡任何一层可摆放地面。

3. **画风统一与入库流程**
   - 画风保持柔和细暖棕描边（`gentle thin warm taupe-brown outlines`）、左上高调柔光赛璐璐/水彩手绘质感，室内地面与墙面完全留空（零家具、零盆栽、零地毯、零文字水印）。
   - 生图统一输出纯白底 `#FFFFFF` 原图归档至 `../game_assets/huahua/assets/raw/`，经 `rembg -m birefnet-general` 去底写入 `minigame/subpkg_deco/images/house/`，同步补齐大地图外观缩略图与 `TextureCache` / `WorldMapConfig` / `StarLevelConfig` / `DecorationConfig` / `SceneRenovationConfig` / `LevelUnlockConfig`，并执行 `npm run check:deco-textures` 校验通过。
