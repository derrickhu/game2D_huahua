---
name: 大地图许愿喷泉抽奖
overview: 大地图固定建筑「许愿喷泉」，点击打开抽奖弹层；消耗许愿券（存档键 flowerSignTickets）；花车/摊位类视觉预留给限时商人。
todos:
  - id: spec-ticket-item
    content: 许愿券展示与存档 flowerSignTickets（兼容）
  - id: spec-pool-v1
    content: 奖池 FlowerSignGachaConfig；单抽/十连消耗
  - id: implement-map-node
    content: WorldMapConfig wishing_fountain + worldmap_thumb_wishing_fountain
  - id: implement-gacha-panel
    content: FlowerSignGachaPanel 许愿文案 + EventBus panel:openFlowerSignGacha
  - id: implement-draw-service
    content: FlowerSignGachaManager + RewardBoxManager
  - id: defer-wandering
    content: 限时商人（花车式节点）与云游时段——后续迭代
---

# 大地图许愿喷泉 + 许愿券

## 产品决策（已调整）

| 项 | 决策 |
|----|------|
| 地图载体 | **许愿喷泉**：固定地标、通用祈愿感，与非花类奖池兼容；**非**花车/集市摊（该形式预留给**限时商人**）。 |
| 消耗 | **许愿券**（代码侧 FlowerSignTicketManager / 存档 `flowerSignTickets` 保持兼容）。 |
| 券来源 | 活动、礼包等仍由后续接入；GM 发券联调。 |

## 资源

- 提示词：`docs/prompt/worldmap_thumb_wishing_fountain_nb2_prompt.txt`
- 原图：`../game_assets/huahua/assets/raw/worldmap_thumb_wishing_fountain_nb2.png`
- 运行时：`minigame/subpkg_panels/images/ui/worldmap_thumb_wishing_fountain.png`，`TextureCache.worldmap_thumb_wishing_fountain`

## 后续迭代

- 限时商人节点（花车/云游）与时间表。
- 活动发券、礼包。
