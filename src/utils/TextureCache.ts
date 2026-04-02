/**
 * 纹理缓存 - 管理图片加载和 PIXI.Texture 缓存
 * 支持微信小游戏分包加载：
 *   - 主包：棋盘/顶栏等小图标与启动必需 UI（images/）
 *   - 分包 chars：店主全身/半身 + 客人胸像（subpkg_chars/images/）
 *   - 分包 panels：签到/花语彩蛋/仓库/合成线/装修大卡等面板底图（subpkg_panels/images/ui/）
 *   - 分包 items：花朵 + 饮品 + 工具 + 棋盘消耗品等（subpkg_items/images/）；PNG 入库规范见 .cursor/rules/board-item-png-spec.mdc → compress_subpkg_items_pngs.py
 *   - 分包 deco：家具 + 房间背景 + 旧 room 素材（subpkg_deco/images/）
 */
import * as PIXI from 'pixi.js';

// ================================================================
// 主包资源（随主包一起下载，无需等待分包）
// ================================================================
const MAIN_IMAGE_MAP: Record<string, string> = {
  // ---- UI 图标 ----
  icon_energy: 'images/ui/icon_energy.png',
  icon_gem:    'images/ui/icon_gem.png',
  icon_star:   'images/ui/icon_star.png',
  icon_plus:   'images/ui/icon_plus.png',
  icon_shop:   'images/ui/icon_shop.png',
  icon_heart:  'images/ui/icon_heart.png',
  icon_book:   'images/ui/icon_book.png',
  icon_basket: 'images/ui/icon_basket.png',
  icon_chart:  'images/ui/icon_chart.png',
  icon_level_badge: 'images/ui/icon_level_badge.png',
  icon_gift:   'images/ui/icon_gift.png',
  order_panel: 'images/ui/order_panel.png',
  /** NB2+抠图：选中格四角、订单完成角标、无字完成按钮底图 */
  ui_cell_selection_corners: 'images/ui/ui_cell_selection_corners.png',
  ui_order_check_badge: 'images/ui/ui_order_check_badge.png',
  ui_complete_btn: 'images/ui/ui_complete_btn.png',
  icon_huayuan:  'images/ui/icon_huayuan.png',
  icon_furniture: 'images/ui/icon_furniture.png',
  icon_dress:     'images/ui/icon_dress.png',
  icon_checkin:   'images/ui/icon_checkin.png',
  icon_quest:     'images/ui/icon_quest.png',
  /** 挑战关卡入口占位（正式图标就绪后替换路径或 key） */
  icon_challenge: 'images/ui/icon_level_badge.png',
  icon_build:     'images/ui/icon_build.png',
  icon_operate:   'images/ui/icon_operate.png',

  // ---- 棋盘 & 场景背景 ----
  board_bg:       'images/ui/board_bg.png',
  board_bar:      'images/ui/board_bar.png',
  cell_locked:    'images/ui/cell_locked.png',
  /** 奖励收纳入口按钮底图（收起态礼盒） */
  cell_locked_v2: 'images/ui/cell_locked_v2.png',
  cell_peek:      'images/ui/cell_peek.png',
  cell_key:       'images/ui/cell_key.png',
  shop_scene_bg:  'images/ui/shop_scene_bg.png',
  /** 仅底栏 ItemInfoBar 叶形标题条（与合成线弹窗彩带分离） */
  item_info_leaf_bar: 'images/ui/item_info_leaf_bar.png',
};

// ================================================================
// chars 分包：店主 + 客人（需先 loadSubpackage('chars')）
// ================================================================
const CHARS_IMAGE_MAP: Record<string, string> = {
  owner_chibi_default:  'subpkg_chars/images/owner/chibi_default.png',
  owner_full_default:   'subpkg_chars/images/owner/full_default.png',
  owner_full_default_blink: 'subpkg_chars/images/owner/full_default_eyesclosed.png',

  owner_full_outfit_florist: 'subpkg_chars/images/owner/full_outfit_florist.png',
  owner_full_outfit_florist_blink: 'subpkg_chars/images/owner/full_outfit_florist_eyesclosed.png',
  owner_chibi_outfit_florist: 'subpkg_chars/images/owner/chibi_outfit_florist.png',

  owner_full_outfit_spring: 'subpkg_chars/images/owner/full_outfit_spring.png',
  owner_full_outfit_spring_blink: 'subpkg_chars/images/owner/full_outfit_spring_eyesclosed.png',
  owner_chibi_outfit_spring: 'subpkg_chars/images/owner/chibi_outfit_spring.png',

  owner_full_outfit_summer: 'subpkg_chars/images/owner/full_outfit_summer.png',
  owner_full_outfit_summer_blink: 'subpkg_chars/images/owner/full_outfit_summer_eyesclosed.png',
  owner_chibi_outfit_summer: 'subpkg_chars/images/owner/chibi_outfit_summer.png',

  owner_full_outfit_vintage: 'subpkg_chars/images/owner/full_outfit_vintage.png',
  owner_full_outfit_vintage_blink: 'subpkg_chars/images/owner/full_outfit_vintage_eyesclosed.png',
  owner_chibi_outfit_vintage: 'subpkg_chars/images/owner/chibi_outfit_vintage.png',

  owner_full_outfit_queen: 'subpkg_chars/images/owner/full_outfit_queen.png',
  owner_full_outfit_queen_blink: 'subpkg_chars/images/owner/full_outfit_queen_eyesclosed.png',
  owner_chibi_outfit_queen: 'subpkg_chars/images/owner/chibi_outfit_queen.png',

  customer_child:   'subpkg_chars/images/customer/child.png',
  customer_student: 'subpkg_chars/images/customer/student.png',
  customer_worker:  'subpkg_chars/images/customer/worker.png',
  customer_mom:     'subpkg_chars/images/customer/mom.png',
  customer_youth:   'subpkg_chars/images/customer/youth.png',
  customer_couple:   'subpkg_chars/images/customer/couple.png',
  customer_birthday: 'subpkg_chars/images/customer/birthday.png',
  customer_blogger:  'subpkg_chars/images/customer/blogger.png',
  customer_noble:    'subpkg_chars/images/customer/noble.png',
  customer_collector: 'subpkg_chars/images/customer/collector.png',
  customer_athlete:   'subpkg_chars/images/customer/athlete.png',
  customer_mystery:   'subpkg_chars/images/customer/mystery.png',
  customer_celebrity: 'subpkg_chars/images/customer/celebrity.png',
};

// ================================================================
// panels 分包：大卡面 UI（需先 loadSubpackage('panels')）
// ================================================================
const PANELS_IMAGE_MAP: Record<string, string> = {
  checkin_title_banner: 'subpkg_panels/images/ui/checkin_title_banner.png',
  checkin_milestone_panel: 'subpkg_panels/images/ui/checkin_milestone_panel.png',
  checkin_card_future: 'subpkg_panels/images/ui/checkin_card_future.png',
  checkin_card_today: 'subpkg_panels/images/ui/checkin_card_today.png',
  checkin_card_signed: 'subpkg_panels/images/ui/checkin_card_signed.png',
  checkin_card_day7: 'subpkg_panels/images/ui/checkin_card_day7.png',
  checkin_milestone_gift_1: 'subpkg_panels/images/ui/checkin_milestone_gift_1.png',
  checkin_milestone_gift_2: 'subpkg_panels/images/ui/checkin_milestone_gift_2.png',
  checkin_milestone_gift_3: 'subpkg_panels/images/ui/checkin_milestone_gift_3.png',
  checkin_milestone_gift_4: 'subpkg_panels/images/ui/checkin_milestone_gift_4.png',
  flower_egg_title_banner: 'subpkg_panels/images/ui/flower_egg_title_banner.png',
  flower_egg_btn_claim: 'subpkg_panels/images/ui/flower_egg_btn_claim.png',
  flower_egg_card_bg: 'subpkg_panels/images/ui/flower_egg_card_bg.png',
  flower_egg_reward_bg: 'subpkg_panels/images/ui/flower_egg_reward_bg.png',
  warehouse_panel_bg: 'subpkg_panels/images/ui/warehouse_panel_bg.png',
  warehouse_close_btn: 'subpkg_panels/images/ui/warehouse_close_btn.png',
  warehouse_slot_lock: 'subpkg_panels/images/ui/warehouse_slot_lock.png',
  merge_chain_ribbon: 'subpkg_panels/images/ui/merge_chain_ribbon.png',
  merge_chain_panel: 'subpkg_panels/images/ui/merge_chain_panel.png',
  /** 水晶球/金剪刀确认弹窗：NB2+rembg，与合成线彩带同风格 */
  special_consumable_panel_bg: 'subpkg_panels/images/ui/special_consumable_panel_bg.png',
  special_consumable_use_btn: 'subpkg_panels/images/ui/special_consumable_use_btn.png',
  deco_panel_popup_frame: 'subpkg_panels/images/ui/deco_panel_popup_frame.png',
  deco_furniture_card: 'subpkg_panels/images/ui/deco_furniture_card.png',
  deco_panel_title_ribbon: 'subpkg_panels/images/ui/deco_panel_title_ribbon.png',
  item_info_title_ribbon: 'subpkg_panels/images/ui/item_info_title_ribbon.png',
  deco_card_btn_1: 'subpkg_panels/images/ui/deco_card_btn_1.png',
  deco_card_btn_2: 'subpkg_panels/images/ui/deco_card_btn_2.png',
  deco_card_btn_3: 'subpkg_panels/images/ui/deco_card_btn_3.png',
  deco_card_btn_4: 'subpkg_panels/images/ui/deco_card_btn_4.png',
  deco_rarity_tag_common: 'subpkg_panels/images/ui/deco_rarity_tag_common.png',
  deco_rarity_tag_fine: 'subpkg_panels/images/ui/deco_rarity_tag_fine.png',
  deco_rarity_tag_rare: 'subpkg_panels/images/ui/deco_rarity_tag_rare.png',
  deco_rarity_tag_limited: 'subpkg_panels/images/ui/deco_rarity_tag_limited.png',

  // ---- 大地图 ----
  worldmap_bg: 'subpkg_panels/images/ui/worldmap_bg.png',
  /** 大地图「花语小筑」静态花坊外观（与装修房壳同系粉瓦白墙，完整店面） */
  worldmap_house_flower_shop: 'subpkg_panels/images/ui/worldmap_house_flower_shop.png',
  worldmap_thumb_flower_shop: 'subpkg_panels/images/ui/worldmap_thumb_flower_shop.png',
  worldmap_thumb_flower_market: 'subpkg_panels/images/ui/worldmap_thumb_flower_market.png',
  worldmap_thumb_tea_house: 'subpkg_panels/images/ui/worldmap_thumb_tea_house.png',
  worldmap_thumb_tool_shop: 'subpkg_panels/images/ui/worldmap_thumb_tool_shop.png',
  worldmap_thumb_garden_villa: 'subpkg_panels/images/ui/worldmap_thumb_garden_villa.png',
  icon_worldmap: 'subpkg_panels/images/ui/icon_worldmap.png',
};

// ================================================================
// items 分包资源（花朵 + 饮品 + 工具，需先 loadSubpackage('items')）
// ================================================================
const ITEMS_IMAGE_MAP: Record<string, string> = {
  // ---- 鲜花线 (10张) ----
  flower_fresh_1:  'subpkg_items/images/flowers/fresh/flower_fresh_1.png',
  flower_fresh_2:  'subpkg_items/images/flowers/fresh/flower_fresh_2.png',
  flower_fresh_3:  'subpkg_items/images/flowers/fresh/flower_fresh_3.png',
  flower_fresh_4:  'subpkg_items/images/flowers/fresh/flower_fresh_4.png',
  flower_fresh_5:  'subpkg_items/images/flowers/fresh/flower_fresh_5.png',
  flower_fresh_6:  'subpkg_items/images/flowers/fresh/flower_fresh_6.png',
  flower_fresh_7:  'subpkg_items/images/flowers/fresh/flower_fresh_7.png',
  flower_fresh_8:  'subpkg_items/images/flowers/fresh/flower_fresh_8.png',
  flower_fresh_9:  'subpkg_items/images/flowers/fresh/flower_fresh_9.png',
  flower_fresh_10: 'subpkg_items/images/flowers/fresh/flower_fresh_10.png',

  // ---- 花束线 (10张) ----
  flower_bouquet_1:  'subpkg_items/images/flowers/bouquet/flower_bouquet_1.png',
  flower_bouquet_2:  'subpkg_items/images/flowers/bouquet/flower_bouquet_2.png',
  flower_bouquet_3:  'subpkg_items/images/flowers/bouquet/flower_bouquet_3.png',
  flower_bouquet_4:  'subpkg_items/images/flowers/bouquet/flower_bouquet_4.png',
  flower_bouquet_5:  'subpkg_items/images/flowers/bouquet/flower_bouquet_5.png',
  flower_bouquet_6:  'subpkg_items/images/flowers/bouquet/flower_bouquet_6.png',
  flower_bouquet_7:  'subpkg_items/images/flowers/bouquet/flower_bouquet_7.png',
  flower_bouquet_8:  'subpkg_items/images/flowers/bouquet/flower_bouquet_8.png',
  flower_bouquet_9:  'subpkg_items/images/flowers/bouquet/flower_bouquet_9.png',
  flower_bouquet_10: 'subpkg_items/images/flowers/bouquet/flower_bouquet_10.png',

  // ---- 包装中间品（占位图，可后续替换） ----
  flower_wrap_1: 'subpkg_items/images/tools/wrap/flower_wrap_1.png',
  flower_wrap_2: 'subpkg_items/images/tools/wrap/flower_wrap_2.png',
  flower_wrap_3: 'subpkg_items/images/tools/wrap/flower_wrap_3.png',
  flower_wrap_4: 'subpkg_items/images/tools/wrap/flower_wrap_4.png',

  // ---- 绿植线 (10张) ----
  flower_green_1:  'subpkg_items/images/flowers/green/flower_green_1.png',
  flower_green_2:  'subpkg_items/images/flowers/green/flower_green_2.png',
  flower_green_3:  'subpkg_items/images/flowers/green/flower_green_3.png',
  flower_green_4:  'subpkg_items/images/flowers/green/flower_green_4.png',
  flower_green_5:  'subpkg_items/images/flowers/green/flower_green_5.png',
  flower_green_6:  'subpkg_items/images/flowers/green/flower_green_6.png',
  flower_green_7:  'subpkg_items/images/flowers/green/flower_green_7.png',
  flower_green_8:  'subpkg_items/images/flowers/green/flower_green_8.png',
  flower_green_9:  'subpkg_items/images/flowers/green/flower_green_9.png',
  flower_green_10: 'subpkg_items/images/flowers/green/flower_green_10.png',

  // ---- 茶饮线 (8张) ----
  drink_tea_1: 'subpkg_items/images/drinks/tea/drink_tea_1.png',
  drink_tea_2: 'subpkg_items/images/drinks/tea/drink_tea_2.png',
  drink_tea_3: 'subpkg_items/images/drinks/tea/drink_tea_3.png',
  drink_tea_4: 'subpkg_items/images/drinks/tea/drink_tea_4.png',
  drink_tea_5: 'subpkg_items/images/drinks/tea/drink_tea_5.png',
  drink_tea_6: 'subpkg_items/images/drinks/tea/drink_tea_6.png',
  drink_tea_7: 'subpkg_items/images/drinks/tea/drink_tea_7.png',
  drink_tea_8: 'subpkg_items/images/drinks/tea/drink_tea_8.png',

  // ---- 冷饮线 (8张) ----
  drink_cold_1: 'subpkg_items/images/drinks/cold/drink_cold_1.png',
  drink_cold_2: 'subpkg_items/images/drinks/cold/drink_cold_2.png',
  drink_cold_3: 'subpkg_items/images/drinks/cold/drink_cold_3.png',
  drink_cold_4: 'subpkg_items/images/drinks/cold/drink_cold_4.png',
  drink_cold_5: 'subpkg_items/images/drinks/cold/drink_cold_5.png',
  drink_cold_6: 'subpkg_items/images/drinks/cold/drink_cold_6.png',
  drink_cold_7: 'subpkg_items/images/drinks/cold/drink_cold_7.png',
  drink_cold_8: 'subpkg_items/images/drinks/cold/drink_cold_8.png',

  // ---- 甜品线 (8张) ----
  drink_dessert_1: 'subpkg_items/images/drinks/dessert/drink_dessert_1.png',
  drink_dessert_2: 'subpkg_items/images/drinks/dessert/drink_dessert_2.png',
  drink_dessert_3: 'subpkg_items/images/drinks/dessert/drink_dessert_3.png',
  drink_dessert_4: 'subpkg_items/images/drinks/dessert/drink_dessert_4.png',
  drink_dessert_5: 'subpkg_items/images/drinks/dessert/drink_dessert_5.png',
  drink_dessert_6: 'subpkg_items/images/drinks/dessert/drink_dessert_6.png',
  drink_dessert_7: 'subpkg_items/images/drinks/dessert/drink_dessert_7.png',
  drink_dessert_8: 'subpkg_items/images/drinks/dessert/drink_dessert_8.png',

  // ---- 工具：种植线 (3级试跑) ----
  tool_plant_1: 'subpkg_items/images/tools/plant/tool_plant_1.png',
  tool_plant_2: 'subpkg_items/images/tools/plant/tool_plant_2.png',
  tool_plant_3: 'subpkg_items/images/tools/plant/tool_plant_3.png',
  tool_plant_4: 'subpkg_items/images/tools/plant/tool_plant_4.png',
  tool_plant_5: 'subpkg_items/images/tools/plant/tool_plant_5.png',
  tool_plant_6: 'subpkg_items/images/tools/plant/tool_plant_6.png',

  // ---- 工具：花艺线 ----
  tool_arrange_1: 'subpkg_items/images/tools/arrange/tool_arrange_1.png',
  tool_arrange_2: 'subpkg_items/images/tools/arrange/tool_arrange_2.png',
  tool_arrange_3: 'subpkg_items/images/tools/arrange/tool_arrange_3.png',
  tool_arrange_4: 'subpkg_items/images/tools/arrange/tool_arrange_4.png',
  tool_arrange_5: 'subpkg_items/images/tools/arrange/tool_arrange_5.png',

  // ---- 工具：烘焙线 ----
  tool_bake_1: 'subpkg_items/images/tools/bake/tool_bake_1.png',
  tool_bake_2: 'subpkg_items/images/tools/bake/tool_bake_2.png',
  tool_bake_3: 'subpkg_items/images/tools/bake/tool_bake_3.png',
  tool_bake_4: 'subpkg_items/images/tools/bake/tool_bake_4.png',
  tool_bake_5: 'subpkg_items/images/tools/bake/tool_bake_5.png',

  // ---- 工具：茶饮线（茶具）----
  tool_tea_set_1: 'subpkg_items/images/tools/tea_set/tool_tea_set_1.png',
  tool_tea_set_2: 'subpkg_items/images/tools/tea_set/tool_tea_set_2.png',
  tool_tea_set_3: 'subpkg_items/images/tools/tea_set/tool_tea_set_3.png',
  tool_tea_set_4: 'subpkg_items/images/tools/tea_set/tool_tea_set_4.png',
  tool_tea_set_5: 'subpkg_items/images/tools/tea_set/tool_tea_set_5.png',

  // ---- 工具：冷饮线（饮品器具）----
  tool_mixer_1: 'subpkg_items/images/tools/mixer/tool_mixer_1.png',
  tool_mixer_2: 'subpkg_items/images/tools/mixer/tool_mixer_2.png',
  tool_mixer_3: 'subpkg_items/images/tools/mixer/tool_mixer_3.png',
  tool_mixer_4: 'subpkg_items/images/tools/mixer/tool_mixer_4.png',
  tool_mixer_5: 'subpkg_items/images/tools/mixer/tool_mixer_5.png',

  // ---- 宝箱 5 档（棋盘物品图统一最长边 128px + 256 色调色板，见 scripts/compress_subpkg_items_pngs.py）----
  chest_1: 'subpkg_items/images/chest/chest_1.png',
  chest_2: 'subpkg_items/images/chest/chest_2.png',
  chest_3: 'subpkg_items/images/chest/chest_3.png',
  chest_4: 'subpkg_items/images/chest/chest_4.png',
  chest_5: 'subpkg_items/images/chest/chest_5.png',

  // ---- 红包 4 档（工具线画风 1:1 白底生图 + rembg，见 docs/prompt/hongbao_*_nb2_prompt.txt）----
  hongbao_1: 'subpkg_items/images/hongbao/hongbao_1.png',
  hongbao_2: 'subpkg_items/images/hongbao/hongbao_2.png',
  hongbao_3: 'subpkg_items/images/hongbao/hongbao_3.png',
  hongbao_4: 'subpkg_items/images/hongbao/hongbao_4.png',

  // ---- 钻石袋 / 体力宝箱 各 3 档（参考 minigame/images/ui/icon_gem / icon_energy + rembg，见 docs/prompt/）----
  diamond_bag_1: 'subpkg_items/images/diamond_bag/diamond_bag_1.png',
  diamond_bag_2: 'subpkg_items/images/diamond_bag/diamond_bag_2.png',
  diamond_bag_3: 'subpkg_items/images/diamond_bag/diamond_bag_3.png',
  stamina_chest_1: 'subpkg_items/images/stamina_chest/stamina_chest_1.png',
  stamina_chest_2: 'subpkg_items/images/stamina_chest/stamina_chest_2.png',
  stamina_chest_3: 'subpkg_items/images/stamina_chest/stamina_chest_3.png',

  // ---- 棋盘消耗品（幸运金币 / 水晶球 / 金剪刀，与 icon_coin 同 122×128，items 分包）----
  icon_coin: 'subpkg_items/images/special/special_lucky_coin.png',
  icon_crystal_ball: 'subpkg_items/images/special/special_crystal_ball.png',
  icon_golden_scissors: 'subpkg_items/images/special/special_golden_scissors.png',
};

// ================================================================
// deco 分包资源（需先 loadSubpackage('deco') 后才可访问）
// ================================================================
const DECO_IMAGE_MAP: Record<string, string> = {
  // ---- 花店建筑场景 ----
  house_shop: 'subpkg_deco/images/house/shop.png',
  house_bg:   'subpkg_deco/images/house/bg.jpg',

  // ---- 装修家具素材 room_items (36张) ----
  ...buildRoomMap('room', 36),

  // ---- 装修家具素材 room2_items (36张) ----
  ...buildRoomMap('room2', 36),

  // ---- 新家具素材 furniture/ (含 NB2 扩展，已扣底) ----
  // 花架
  shelf_wood:    'subpkg_deco/images/furniture/shelf_wood.png',
  shelf_step:    'subpkg_deco/images/furniture/shelf_step.png',
  shelf_long:    'subpkg_deco/images/furniture/shelf_long.png',
  shelf_iron:    'subpkg_deco/images/furniture/shelf_iron.png',
  shelf_glass:   'subpkg_deco/images/furniture/shelf_glass.png',
  shelf_spring:  'subpkg_deco/images/furniture/shelf_spring.png',
  shelf_terracotta: 'subpkg_deco/images/furniture/shelf_terracotta.png',
  // 桌台
  table_counter: 'subpkg_deco/images/furniture/table_counter.png',
  table_drawer:  'subpkg_deco/images/furniture/table_drawer.png',
  table_work:    'subpkg_deco/images/furniture/table_work.png',
  table_marble:  'subpkg_deco/images/furniture/table_marble.png',
  table_autumn:  'subpkg_deco/images/furniture/table_autumn.png',
  table_wrap_station: 'subpkg_deco/images/furniture/table_wrap_station.png',
  table_rattan_twoset: 'subpkg_deco/images/furniture/table_rattan_twoset.png',
  table_round_cafe: 'subpkg_deco/images/furniture/table_round_cafe.png',
  table_square_bistro: 'subpkg_deco/images/furniture/table_square_bistro.png',
  table_side_round: 'subpkg_deco/images/furniture/table_side_round.png',
  // 灯具
  light_desk:    'subpkg_deco/images/furniture/light_desk.png',
  light_floor:   'subpkg_deco/images/furniture/light_floor.png',
  light_pendant: 'subpkg_deco/images/furniture/light_pendant.png',
  light_crystal: 'subpkg_deco/images/furniture/light_crystal.png',
  light_summer:  'subpkg_deco/images/furniture/light_summer.png',
  light_plant_strip: 'subpkg_deco/images/furniture/light_plant_strip.png',
  light_radio_vintage: 'subpkg_deco/images/furniture/light_radio_vintage.png',
  light_fan_desk: 'subpkg_deco/images/furniture/light_fan_desk.png',
  light_kettle_pastel: 'subpkg_deco/images/furniture/light_kettle_pastel.png',
  light_humidifier_cute: 'subpkg_deco/images/furniture/light_humidifier_cute.png',
  // 摆件
  orn_pot:       'subpkg_deco/images/furniture/orn_pot.png',
  orn_vase:      'subpkg_deco/images/furniture/orn_vase.png',
  orn_fountain:  'subpkg_deco/images/furniture/orn_fountain.png',
  orn_candle:    'subpkg_deco/images/furniture/orn_candle.png',
  orn_clock:     'subpkg_deco/images/furniture/orn_clock.png',
  orn_fireplace: 'subpkg_deco/images/furniture/orn_fireplace.png',
  orn_pumpkin:   'subpkg_deco/images/furniture/orn_pumpkin.png',
  orn_christmas: 'subpkg_deco/images/furniture/orn_christmas.png',
  orn_window_garden: 'subpkg_deco/images/furniture/orn_window_garden.png',
  orn_awaken_bucket: 'subpkg_deco/images/furniture/orn_awaken_bucket.png',
  orn_floral_chest: 'subpkg_deco/images/furniture/orn_floral_chest.png',
  orn_pastel_bench: 'subpkg_deco/images/furniture/orn_pastel_bench.png',
  orn_lounge_chaise: 'subpkg_deco/images/furniture/orn_lounge_chaise.png',
  orn_wood_stools_pair: 'subpkg_deco/images/furniture/orn_wood_stools_pair.png',
  orn_rocking_chair: 'subpkg_deco/images/furniture/orn_rocking_chair.png',
  // 墙饰
  wallart_plant:  'subpkg_deco/images/furniture/wallart_plant.png',
  wallart_frame:  'subpkg_deco/images/furniture/wallart_frame.png',
  wallart_wreath: 'subpkg_deco/images/furniture/wallart_wreath.png',
  wallart_relief: 'subpkg_deco/images/furniture/wallart_relief.png',
  wallart_spring: 'subpkg_deco/images/furniture/wallart_spring.png',
  wallart_winter: 'subpkg_deco/images/furniture/wallart_winter.png',
  wallart_lace_curtain: 'subpkg_deco/images/furniture/wallart_lace_curtain.png',
  // 庭院
  garden_flowerbed: 'subpkg_deco/images/furniture/garden_flowerbed.png',
  garden_arbor:     'subpkg_deco/images/furniture/garden_arbor.png',
  garden_arch:      'subpkg_deco/images/furniture/garden_arch.png',
  garden_zen:       'subpkg_deco/images/furniture/garden_zen.png',
  garden_summer:    'subpkg_deco/images/furniture/garden_summer.png',
  garden_wood_trough: 'subpkg_deco/images/furniture/garden_wood_trough.png',

  // 花房主题家具（NB2）
  wallart_greenhouse_chalkboard: 'subpkg_deco/images/furniture/wallart_greenhouse_chalkboard.png',
  orn_greenhouse_cart: 'subpkg_deco/images/furniture/orn_greenhouse_cart.png',
  garden_flower_stall: 'subpkg_deco/images/furniture/garden_flower_stall.png',
  orn_greenhouse_rug: 'subpkg_deco/images/furniture/orn_greenhouse_rug.png',
  orn_greenhouse_coat_rack: 'subpkg_deco/images/furniture/orn_greenhouse_coat_rack.png',
  orn_greenhouse_flower_cart: 'subpkg_deco/images/furniture/orn_greenhouse_flower_cart.png',
  greenhouse_pot_sprout: 'subpkg_deco/images/furniture/greenhouse_pot_sprout.png',
  greenhouse_pot_bud: 'subpkg_deco/images/furniture/greenhouse_pot_bud.png',
  greenhouse_pot_daisy: 'subpkg_deco/images/furniture/greenhouse_pot_daisy.png',
  greenhouse_pot_sunflower: 'subpkg_deco/images/furniture/greenhouse_pot_sunflower.png',
  greenhouse_pot_carnation: 'subpkg_deco/images/furniture/greenhouse_pot_carnation.png',
  greenhouse_pot_rose: 'subpkg_deco/images/furniture/greenhouse_pot_rose.png',
  greenhouse_pot_lily: 'subpkg_deco/images/furniture/greenhouse_pot_lily.png',
  greenhouse_pot_hydrangea: 'subpkg_deco/images/furniture/greenhouse_pot_hydrangea.png',
  greenhouse_pot_orchid: 'subpkg_deco/images/furniture/greenhouse_pot_orchid.png',
  greenhouse_pot_peony_gold: 'subpkg_deco/images/furniture/greenhouse_pot_peony_gold.png',

  // ---- 房间背景 ----
  bg_room_default: 'subpkg_deco/images/house/bg_room_default.png',
  bg_room_candy_nb2: 'subpkg_deco/images/house/bg_room_candy_nb2.png',
  bg_room_bloom_nb2: 'subpkg_deco/images/house/bg_room_bloom_nb2.png',
  bg_room_lagoon_nb2: 'subpkg_deco/images/house/bg_room_lagoon_nb2.png',
  bg_room_confetti_nb2: 'subpkg_deco/images/house/bg_room_confetti_nb2.png',
  bg_room_pinkblue_nb2: 'subpkg_deco/images/house/bg_room_pinkblue_nb2.png',
};

/** 合并后的完整映射（用于统一查询） */
const IMAGE_MAP: Record<string, string> = {
  ...MAIN_IMAGE_MAP,
  ...CHARS_IMAGE_MAP,
  ...PANELS_IMAGE_MAP,
  ...ITEMS_IMAGE_MAP,
  ...DECO_IMAGE_MAP,
};

/** 生成装修家具图片映射（旧 room 素材，已移到分包） */
function buildRoomMap(prefix: string, count: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 1; i <= count; i++) {
    const key = `${prefix}_${String(i).padStart(2, '0')}`;
    map[key] = `subpkg_deco/images/room/${key}.png`;
  }
  return map;
}


class TextureCacheClass {
  private _cache = new Map<string, PIXI.Texture>();
  private _loading = new Set<string>();
  private _failed = new Set<string>();
  private _decoLoaded = false;
  private _itemsLoaded = false;
  private _charsLoaded = false;
  private _panelsLoaded = false;

  /**
   * 预加载主包图片（UI + 角色等核心资源）
   * 在游戏启动时调用，不依赖分包
   */
  preloadMain(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const keys = Object.keys(MAIN_IMAGE_MAP);
    let loaded = 0;
    const total = keys.length;

    const promises = keys.map(key =>
      this._loadTexture(key, MAIN_IMAGE_MAP[key]).then(() => {
        loaded++;
        onProgress?.(loaded, total);
      }).catch(err => {
        console.warn(`[TextureCache] 主包加载失败: ${key}`, err);
        loaded++;
        onProgress?.(loaded, total);
      })
    );

    return Promise.all(promises).then(() => {
      console.log(`[TextureCache] 主包预加载完成: ${this._cache.size}/${total} 张纹理`);
    });
  }

  /**
   * 加载 chars 分包（店主 + 客人），然后预加载图片
   */
  loadCharsSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._charsLoaded) {
      return this._preloadImageMap(CHARS_IMAGE_MAP, 'chars', onProgress);
    }

    return this._loadSubpackage('chars').then(() => {
      this._charsLoaded = true;
      return this._preloadImageMap(CHARS_IMAGE_MAP, 'chars', onProgress);
    });
  }

  /**
   * 加载 panels 分包（签到/仓库/合成线/装修大卡等），然后预加载图片
   */
  loadPanelsSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._panelsLoaded) {
      return this._preloadImageMap(PANELS_IMAGE_MAP, 'panels', onProgress);
    }

    return this._loadSubpackage('panels').then(() => {
      this._panelsLoaded = true;
      return this._preloadImageMap(PANELS_IMAGE_MAP, 'panels', onProgress);
    });
  }

  /**
   * 加载 items 分包（花朵/饮品/工具物品图标），然后预加载图片
   * 启动时紧跟主包加载，玩法核心资源
   */
  loadItemsSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._itemsLoaded) {
      return this._preloadImageMap(ITEMS_IMAGE_MAP, 'items', onProgress);
    }

    return this._loadSubpackage('items').then(() => {
      this._itemsLoaded = true;
      return this._preloadImageMap(ITEMS_IMAGE_MAP, 'items', onProgress);
    });
  }

  /**
   * 加载 deco 分包，然后预加载分包中的图片
   * 在进入花店场景前调用
   */
  loadDecoSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._decoLoaded) {
      return this._preloadImageMap(DECO_IMAGE_MAP, 'deco', onProgress);
    }

    return this._loadSubpackage('deco').then(() => {
      this._decoLoaded = true;
      return this._preloadImageMap(DECO_IMAGE_MAP, 'deco', onProgress);
    });
  }

  /**
   * 兼容旧接口：预加载所有资源（主包 → chars → panels → items → deco）
   */
  preloadAll(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const totalKeys = Object.keys(IMAGE_MAP).length;
    let globalLoaded = 0;

    const wrapProgress = () => {
      globalLoaded++;
      onProgress?.(globalLoaded, totalKeys);
    };

    return this.preloadMain(() => wrapProgress())
      .then(() => this.loadCharsSubpackage(() => wrapProgress()))
      .then(() => this.loadPanelsSubpackage(() => wrapProgress()))
      .then(() => this.loadItemsSubpackage(() => wrapProgress()))
      .then(() => this.loadDecoSubpackage(() => wrapProgress()))
      .then(() => {
        console.log(`[TextureCache] 全部预加载完成: ${this._cache.size}/${totalKeys} 张纹理`);
      });
  }

  /** 获取已缓存的纹理 */
  get(key: string): PIXI.Texture | null {
    return this._cache.get(key) || null;
  }

  /** 分包资源是否已加载 */
  get isDecoLoaded(): boolean {
    return this._decoLoaded;
  }

  /** items 分包是否已加载 */
  get isItemsLoaded(): boolean {
    return this._itemsLoaded;
  }

  get isCharsLoaded(): boolean {
    return this._charsLoaded;
  }

  get isPanelsLoaded(): boolean {
    return this._panelsLoaded;
  }

  /**
   * 通用分包加载方法
   */
  private _loadSubpackage(name: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
      if (!platform || !platform.loadSubpackage) {
        // 非微信环境，直接通过（开发模式）
        console.log(`[TextureCache] 非微信环境，直接加载 ${name} 分包资源`);
        resolve();
        return;
      }

      console.log(`[TextureCache] 开始加载 ${name} 分包...`);
      const task = platform.loadSubpackage({
        name,
        success: () => {
          console.log(`[TextureCache] ${name} 分包加载成功`);
          resolve();
        },
        fail: (err: any) => {
          console.error(`[TextureCache] ${name} 分包加载失败`, err);
          reject(err);
        },
      });

      // 分包下载进度
      if (task && task.onProgressUpdate) {
        task.onProgressUpdate((res: any) => {
          console.log(`[TextureCache] ${name} 分包下载: ${res.progress}% (${res.totalBytesWritten}/${res.totalBytesExpectedToWrite})`);
        });
      }
    });
  }

  /** 通用图片批量预加载 */
  private _preloadImageMap(
    imageMap: Record<string, string>,
    label: string,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const keys = Object.keys(imageMap);
    let loaded = 0;
    const total = keys.length;

    const promises = keys.map(key =>
      this._loadTexture(key, imageMap[key]).then(() => {
        loaded++;
        onProgress?.(loaded, total);
      }).catch(err => {
        console.warn(`[TextureCache] ${label} 加载失败: ${key}`, err);
        loaded++;
        onProgress?.(loaded, total);
      })
    );

    return Promise.all(promises).then(() => {
      console.log(`[TextureCache] ${label} 图片预加载完成: ${loaded}/${total}`);
    });
  }

  /** 加载单张纹理 */
  private _loadTexture(key: string, path: string): Promise<void> {
    if (this._cache.has(key)) return Promise.resolve();
    if (this._loading.has(key)) return Promise.resolve();
    if (this._failed.has(key)) return Promise.resolve();

    this._loading.add(key);

    return new Promise<void>((resolve) => {
      try {
        // 在微信小游戏中使用平台 API 创建图片
        const platform = typeof wx !== 'undefined' ? wx : typeof tt !== 'undefined' ? tt : null;
        if (!platform) {
          this._failed.add(key);
          this._loading.delete(key);
          resolve();
          return;
        }

        const img = platform.createImage();
        img.onload = () => {
          try {
            const baseTexture = PIXI.BaseTexture.from(img as any);
            const texture = new PIXI.Texture(baseTexture);
            this._cache.set(key, texture);
          } catch (e) {
            console.warn(`[TextureCache] 创建纹理失败: ${key}`, e);
            this._failed.add(key);
          }
          this._loading.delete(key);
          resolve();
        };
        img.onerror = (err: any) => {
          console.warn(`[TextureCache] 图片加载失败: ${key} (${path})`, err);
          this._failed.add(key);
          this._loading.delete(key);
          resolve();
        };
        img.src = path;
      } catch (e) {
        console.warn(`[TextureCache] 加载异常: ${key}`, e);
        this._failed.add(key);
        this._loading.delete(key);
        resolve();
      }
    });
  }
}

export const TextureCache = new TextureCacheClass();
