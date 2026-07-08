/**
 * 纹理缓存 - 管理图片加载和 PIXI.Texture 缓存
 * 支持微信小游戏分包 / CDN 加载：
 *   - 主包：棋盘/顶栏等小图标与启动必需 UI（images/）
 *   - CDN chars：店主全身/半身 + 客人胸像（subpkg_chars/images/）
 *   - CDN panels：签到/花语彩蛋/仓库/合成线/装修大卡等面板底图（subpkg_panels/images/ui/）
 *   - 分包 items：花朵 + 饮品 + 工具 + 棋盘消耗品等（subpkg_items/images/）；PNG 入库规范见 .cursor/rules/board-item-png-spec.mdc → compress_subpkg_items_pngs.py
 *   - CDN deco：家具 + 房间背景 + 旧 room 素材（subpkg_deco/images/）
 */
import * as PIXI from 'pixi.js';
import { CdnAssetService } from '@/core/CdnAssetService';
import { EventBus } from '@/core/EventBus';
import {
  buildFurnitureIconAliasMap,
  furnitureAtlasFrameKey,
  FURNITURE_RENDER_DEFS,
  type FurnitureAtlasFrameRef,
} from '@/config/FurnitureRenderConfig';

const FURNITURE_ICON_ALIASES = buildFurnitureIconAliasMap();

// ================================================================
// 主包资源（随主包一起下载，无需等待分包）
// ================================================================
const MAIN_IMAGE_MAP: Record<string, string> = {
  // ---- UI 图标 ----
  icon_energy: 'images/ui/icon_energy.png',
  icon_gem:    'images/ui/icon_gem.png',
  icon_star:   'images/ui/icon_star.png',
  icon_plus:   'images/ui/icon_plus.png',
  /** 合成底栏「进屋/花店」门面图（原 icon_shop.png 重命名，语义非内购商店） */
  icon_enter_house: 'images/ui/icon_enter_house.png',
  /** NB2+rembg：顶栏内购商店胶囊图标 */
  icon_shop_nb2: 'images/ui/icon_shop_nb2.png',
  /** 周末订单花愿 +50% 顶栏入口（NB2 物件 + rembg） */
  icon_weekend_huayuan_boost_nb2: 'images/ui/icon_weekend_huayuan_boost_nb2.png',
  /** 花间珠匣活动入口：打开首饰盒 + 大颗宝石（主页面常驻入口，留在主包） */
  icon_jewelry_event_nb2: 'images/ui/icon_jewelry_event_nb2.png',
  /** NB2+rembg：激励视频 / 看广告统一小图标（粉紫边框 + 播放三角） */
  icon_ad_reward_nb2: 'images/ui/icon_ad_reward_nb2.png',
  icon_heart:  'images/ui/icon_heart.png',
  icon_book:   'images/ui/icon_book.png',
  icon_affinity_card: 'images/ui/icon_affinity_card.png',
  icon_basket: 'images/ui/icon_basket.png',
  icon_chart:  'images/ui/icon_chart.png',
  icon_level_badge: 'images/ui/icon_level_badge.png',
  icon_gift:   'images/ui/icon_gift.png',
  icon_newbie_gift_qinglian: 'images/ui/icon_newbie_gift_qinglian.png',
  order_panel: 'images/ui/order_panel.png',
  reward_box_button_slot: 'images/ui/reward_box_button_slot.png',
  /** NB2+抠图：选中格四角、订单完成角标、无字完成按钮底图 */
  ui_cell_selection_corners: 'images/ui/ui_cell_selection_corners.png',
  ui_order_check_badge: 'images/ui/ui_order_check_badge.png',
  ui_complete_btn: 'images/ui/ui_complete_btn.png',
  icon_huayuan:  'images/ui/icon_huayuan.png',
  /** 许愿喷泉消耗 / 棋盘货币「许愿硬币」（冷银+粉紫偏光，勿与金色幸运金币混淆） */
  icon_flower_sign_coin: 'images/ui/icon_flower_sign_coin.png',
  icon_furniture: 'images/ui/icon_furniture.png',
  icon_dress:     'images/ui/icon_dress.png',
  icon_checkin:   'images/ui/icon_checkin.png',
  icon_quest:     'images/ui/icon_quest.png',
  /** 挑战关卡入口占位（正式图标就绪后替换路径或 key） */
  icon_challenge: 'images/ui/icon_level_badge.png',
  icon_workshop_material: 'images/ui/icon_workshop_material.png',
  icon_workshop_dye_pink: 'images/ui/icon_workshop_dye_pink.png',
  icon_workshop_dye_yellow: 'images/ui/icon_workshop_dye_yellow.png',
  icon_workshop_dye_blue: 'images/ui/icon_workshop_dye_blue.png',
  icon_workshop_dye_green: 'images/ui/icon_workshop_dye_green.png',
  icon_furniture_workshop: 'images/ui/icon_furniture_workshop.png',
  /** 工坊面板右下角「图纸商店」卷轴（与底栏工坊建造台区分） */
  icon_workshop_blueprint_scroll: 'images/ui/icon_workshop_blueprint_scroll.png',
  icon_worldmap_nav: 'images/ui/icon_worldmap_nav.png',
  /** 花店主页「许愿」入口（3 级解锁；与 icon_worldmap_nav 同款 HUD 银色硬币 + 薄荷水纹） */
  icon_wishing_nav: 'images/ui/icon_wishing_nav.png',
  icon_operate:   'images/ui/icon_operate.png',

  // ---- 棋盘 & 场景背景 ----
  board_bg:       'images/ui/board_bg.png',
  board_bar:      'images/ui/board_bar.png',
  cell_locked:    'images/ui/cell_locked.png',
  cell_peek:      'images/ui/cell_peek.png',
  cell_key:       'images/ui/cell_key.png',
  shop_scene_bg:  'images/ui/shop_scene_bg_floral_nb2.jpg',
  /** 主界面客区试看：花团锦簇强虚化 NB2 稿 */
  shop_scene_bg_floral_nb2: 'images/ui/shop_scene_bg_floral_nb2.jpg',
  /** 启动 Loading 全屏底图（NB2 9:16，主包随下） */
  loading_splash_run_to_shop_nb2: 'images/ui/loading_splash_run_to_shop_nb2.jpg',
  /** Loading 顶栏游戏名（NB2 上半可爱版 + rembg 透明底） */
  loading_title_cute_nb2: 'images/ui/loading_title_cute_nb2.png',
};

// ================================================================
// chars CDN：店主 + 客人
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

  owner_full_outfit_qinglian: 'subpkg_chars/images/owner/full_outfit_qinglian.png',
  owner_full_outfit_qinglian_blink: 'subpkg_chars/images/owner/full_outfit_qinglian_eyesclosed.png',
  owner_chibi_outfit_qinglian: 'subpkg_chars/images/owner/chibi_outfit_qinglian.png',

  owner_full_outfit_queen: 'subpkg_chars/images/owner/full_outfit_queen.png',
  owner_full_outfit_queen_blink: 'subpkg_chars/images/owner/full_outfit_queen_eyesclosed.png',
  owner_chibi_outfit_queen: 'subpkg_chars/images/owner/chibi_outfit_queen.png',

  owner_full_outfit_jewel_bloom: 'subpkg_chars/images/owner/full_outfit_jewel_bloom.png',
  owner_full_outfit_jewel_bloom_blink: 'subpkg_chars/images/owner/full_outfit_jewel_bloom_eyesclosed.png',
  owner_chibi_outfit_jewel_bloom: 'subpkg_chars/images/owner/chibi_outfit_jewel_bloom.png',

  // ── 分部件换装（叠层纸娃娃）：基础身体 + 部件，坐标见 DressUpItemConfig ──
  owner_body_base: 'subpkg_chars/images/owner/parts/body_base.png',
  owner_body_base_blink: 'subpkg_chars/images/owner/parts/body_base_eyesclosed.png',
  owner_part_hair_bob_brown: 'subpkg_chars/images/owner/parts/hair_bob_brown.png',
  owner_part_hair_twintail_pink: 'subpkg_chars/images/owner/parts/hair_twintail_pink.png',
  owner_part_top_pink_puff: 'subpkg_chars/images/owner/parts/top_pink_puff.png',
  owner_part_top_sailor_blue: 'subpkg_chars/images/owner/parts/top_sailor_blue.png',
  owner_part_bottom_denim_skirt: 'subpkg_chars/images/owner/parts/bottom_denim_skirt.png',
  owner_part_bottom_flower_skirt: 'subpkg_chars/images/owner/parts/bottom_flower_skirt.png',
  owner_part_shoes_white_flats: 'subpkg_chars/images/owner/parts/shoes_white_flats.png',
  owner_part_shoes_red_boots: 'subpkg_chars/images/owner/parts/shoes_red_boots.png',
  owner_part_makeup_blush_pink: 'subpkg_chars/images/owner/parts/makeup_blush_pink.png',
  owner_part_acc_pearl_necklace: 'subpkg_chars/images/owner/parts/acc_pearl_necklace.png',
  owner_part_acc_star_earrings: 'subpkg_chars/images/owner/parts/acc_star_earrings.png',

  // v3 正式流程验证：整套穿好设计图 -> Gemini 严格原位拆层 -> fullCanvas 叠放
  owner_part_default_v3_hair_bob_brown: 'subpkg_chars/images/owner/parts/default_v3/hair_bob_brown.png',
  owner_part_default_v3_hair_bob_brown_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/hair_bob_brown.png',
  owner_part_default_v3_top_pink_puff: 'subpkg_chars/images/owner/parts/default_v3/top_pink_puff.png',
  owner_part_default_v3_top_pink_puff_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/top_pink_puff.png',
  owner_part_default_v3_bottom_denim_skirt: 'subpkg_chars/images/owner/parts/default_v3/bottom_denim_skirt.png',
  owner_part_default_v3_bottom_denim_skirt_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/bottom_denim_skirt.png',
  owner_part_default_v3_shoes_white_flats: 'subpkg_chars/images/owner/parts/default_v3/shoes_white_flats.png',
  owner_part_default_v3_shoes_white_flats_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/shoes_white_flats.png',
  owner_part_default_v3_makeup_blush_pink: 'subpkg_chars/images/owner/parts/default_v3/makeup_blush_pink.png',
  owner_part_default_v3_makeup_blush_pink_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/makeup_blush_pink.png',
  owner_part_default_v3_acc_pearl_necklace: 'subpkg_chars/images/owner/parts/default_v3/acc_pearl_necklace.png',
  owner_part_default_v3_acc_pearl_necklace_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/acc_pearl_necklace.png',
  owner_part_default_v3_acc_star_earrings: 'subpkg_chars/images/owner/parts/default_v3/acc_star_earrings.png',
  owner_part_default_v3_acc_star_earrings_thumb: 'subpkg_chars/images/owner/parts/default_v3/thumbs/acc_star_earrings.png',

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
  customer_tycoon:    'subpkg_chars/images/customer/tycoon.png',
  customer_florist_merchant: 'subpkg_chars/images/customer/florist_merchant.png',
  customer_furniture_craftswoman: 'subpkg_chars/images/customer/furniture_craftswoman.png',

  // 友谊卡 / 图鉴系统：S1 首发卡面（路径 affinity_cards/）
  affinity_card_student_01: 'subpkg_chars/images/affinity_cards/card_student_01.png',
  affinity_card_student_02: 'subpkg_chars/images/affinity_cards/card_student_02.png',
  affinity_card_student_03: 'subpkg_chars/images/affinity_cards/card_student_03.png',
  affinity_card_student_04: 'subpkg_chars/images/affinity_cards/card_student_04.png',
  affinity_card_student_05: 'subpkg_chars/images/affinity_cards/card_student_05.png',
  affinity_card_student_06: 'subpkg_chars/images/affinity_cards/card_student_06.png',
  affinity_card_student_07: 'subpkg_chars/images/affinity_cards/card_student_07.png',
  affinity_card_student_08: 'subpkg_chars/images/affinity_cards/card_student_08.png',
  affinity_card_student_09: 'subpkg_chars/images/affinity_cards/card_student_09.png',
  affinity_card_student_10: 'subpkg_chars/images/affinity_cards/card_student_10.png',
  affinity_card_student_11: 'subpkg_chars/images/affinity_cards/card_student_11.png',
  affinity_card_student_12: 'subpkg_chars/images/affinity_cards/card_student_12.png',
  affinity_card_athlete_01: 'subpkg_chars/images/affinity_cards/card_athlete_01.png',
  affinity_card_athlete_02: 'subpkg_chars/images/affinity_cards/card_athlete_02.png',
  affinity_card_athlete_03: 'subpkg_chars/images/affinity_cards/card_athlete_03.png',
  affinity_card_athlete_04: 'subpkg_chars/images/affinity_cards/card_athlete_04.png',
  affinity_card_athlete_05: 'subpkg_chars/images/affinity_cards/card_athlete_05.png',
  affinity_card_athlete_06: 'subpkg_chars/images/affinity_cards/card_athlete_06.png',
  affinity_card_athlete_07: 'subpkg_chars/images/affinity_cards/card_athlete_07.png',
  affinity_card_athlete_08: 'subpkg_chars/images/affinity_cards/card_athlete_08.png',
  affinity_card_athlete_09: 'subpkg_chars/images/affinity_cards/card_athlete_09.png',
  affinity_card_athlete_10: 'subpkg_chars/images/affinity_cards/card_athlete_10.png',
  affinity_card_athlete_11: 'subpkg_chars/images/affinity_cards/card_athlete_11.png',
  affinity_card_athlete_12: 'subpkg_chars/images/affinity_cards/card_athlete_12.png',
  affinity_card_celebrity_01: 'subpkg_chars/images/affinity_cards/card_celebrity_01.png',
  affinity_card_celebrity_02: 'subpkg_chars/images/affinity_cards/card_celebrity_02.png',
  affinity_card_celebrity_03: 'subpkg_chars/images/affinity_cards/card_celebrity_03.png',
  affinity_card_celebrity_04: 'subpkg_chars/images/affinity_cards/card_celebrity_04.png',
  affinity_card_celebrity_05: 'subpkg_chars/images/affinity_cards/card_celebrity_05.png',
  affinity_card_celebrity_06: 'subpkg_chars/images/affinity_cards/card_celebrity_06.png',
  affinity_card_celebrity_07: 'subpkg_chars/images/affinity_cards/card_celebrity_07.png',
  affinity_card_celebrity_08: 'subpkg_chars/images/affinity_cards/card_celebrity_08.png',
  affinity_card_celebrity_09: 'subpkg_chars/images/affinity_cards/card_celebrity_09.png',
  affinity_card_celebrity_10: 'subpkg_chars/images/affinity_cards/card_celebrity_10.png',
  affinity_card_celebrity_11: 'subpkg_chars/images/affinity_cards/card_celebrity_11.png',
  affinity_card_celebrity_12: 'subpkg_chars/images/affinity_cards/card_celebrity_12.png',
};

// ================================================================
// panels CDN：大卡面 UI
// ================================================================
const PANELS_IMAGE_MAP: Record<string, string> = {
  /** 内购商店大图移出主包，打开商店时通过 panels/CDN 懒加载。 */
  shop_section_panel_bg: 'subpkg_panels/images/ui/shop_section_panel_bg.png',
  shop_item_slot: 'subpkg_panels/images/ui/shop_item_slot.png',
  shop_merch_panel_frame: 'subpkg_panels/images/ui/shop_merch_panel_frame.png',
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
  /** 升级奖励等：粉色彩带标题条（叠字「恭喜升级」） */
  pink_bar: 'subpkg_panels/images/ui/pink_bar.png',
  merge_chain_panel: 'subpkg_panels/images/ui/merge_chain_panel.png',
  /** 花语泡泡外框：NB2 淡粉花瓣形 + 白底 rembg；局内再叠 alpha 透出棋盘 */
  merge_companion_flower_bubble: 'subpkg_panels/images/ui/merge_companion_flower_bubble_nb2.png',
  /** 花店装修面板：杏琥珀 flat vector 单壳底栏（DecorationPanel） */
  decoration_panel_shell_nb2: 'subpkg_panels/images/ui/decoration_panel_shell_nb2.png',
  /** 编辑托盘 Tab 图标（6×2 表切图 + rembg；顺序同 FURNITURE_TRAY_TABS） */
  /** 家具托盘 Tab 图标（单态；选中由程序描边/底色区分） */
  furniture_tray_tab_flower_room_idle: 'subpkg_panels/images/ui/furniture_tray_tab_flower_room_idle.png',
  furniture_tray_tab_furniture_idle: 'subpkg_panels/images/ui/furniture_tray_tab_furniture_idle.png',
  furniture_tray_tab_appliance_idle: 'subpkg_panels/images/ui/furniture_tray_tab_appliance_idle.png',
  furniture_tray_tab_ornament_idle: 'subpkg_panels/images/ui/furniture_tray_tab_ornament_idle.png',
  furniture_tray_tab_wallart_idle: 'subpkg_panels/images/ui/furniture_tray_tab_wallart_idle.png',
  furniture_tray_tab_garden_idle: 'subpkg_panels/images/ui/furniture_tray_tab_garden_idle.png',
  furniture_tray_tab_room_styles_idle: 'subpkg_panels/images/ui/furniture_tray_tab_room_styles_idle.png',
  furniture_tray_tab_qinglian_idle: 'subpkg_panels/images/ui/furniture_tray_tab_qinglian_idle.png',
  /** 房间编辑条：6 枚独立图标（横排；由合图 split 脚本产出） */
  room_edit_toolbar_zoom_in: 'subpkg_panels/images/ui/room_edit_toolbar_zoom_in.png',
  room_edit_toolbar_zoom_out: 'subpkg_panels/images/ui/room_edit_toolbar_zoom_out.png',
  room_edit_toolbar_flip: 'subpkg_panels/images/ui/room_edit_toolbar_flip.png',
  room_edit_toolbar_layer_up: 'subpkg_panels/images/ui/room_edit_toolbar_layer_up.png',
  room_edit_toolbar_layer_down: 'subpkg_panels/images/ui/room_edit_toolbar_layer_down.png',
  room_edit_toolbar_remove: 'subpkg_panels/images/ui/room_edit_toolbar_remove.png',
  /** 编辑模式「完成编辑」：顶右圆钮 + 对勾（无字） */
  furniture_edit_complete_icon_nb2:
    'subpkg_panels/images/ui/furniture_edit_complete_icon_nb2.png',
  /** 编辑模式「完成编辑」legacy 胶囊（保留映射，托盘已改用圆钮） */
  edit_complete_pill_4x2_nb2: 'subpkg_panels/images/ui/pill_btn_4x2_r1c1_idx01.png',
  /** 花店主界面「装修」入口：一体式 NB2 胶囊按钮（文字烘焙） */
  shop_edit_deco_btn_nb2: 'subpkg_panels/images/ui/shop_edit_deco_btn_nb2.png',
  /** 编辑托盘顶左「清空」：圆钮 + 垃圾桶（无字） */
  furniture_edit_clear_icon_nb2: 'subpkg_panels/images/ui/furniture_edit_clear_icon_nb2.png',
  /** 家具托盘底板壳（legacy 拱顶） */
  furniture_tray_panel_shell_nb2: 'subpkg_panels/images/ui/furniture_tray_panel_shell_nb2.png',
  /** 装修编辑托盘 v3：薄粉边 + 上竖纹/下 damask 双区 flat bottom sheet */
  furniture_tray_panel_shell_v3_thin_pink_nb2:
    'subpkg_panels/images/ui/furniture_tray_panel_shell_v3_thin_pink_nb2.png',
  /** 万能水晶/金剪刀确认弹窗：NB2+rembg，与合成线彩带同风格 */
  special_consumable_panel_bg: 'subpkg_panels/images/ui/special_consumable_panel_bg.png',
  special_consumable_use_btn: 'subpkg_panels/images/ui/special_consumable_use_btn.png',
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
  /** 装修面板右上角关闭（NB2 1:1 抠图入库；缺省时可与 warehouse 关闭钮同流程） */
  deco_nb2_close_btn_1x1: 'subpkg_panels/images/ui/deco_nb2_close_btn_1x1.png',

  // ---- 大地图 ----
  worldmap_bg: 'subpkg_panels/images/ui/worldmap_bg.png',
  /** 大地图「花花妙屋」静态花坊外观（与装修房壳同系粉瓦白墙，完整店面） */
  worldmap_house_flower_shop: 'subpkg_panels/images/ui/worldmap_house_flower_shop.png',
  /** 大地图蝴蝶小屋立绘（NB2+rembg；原茶室占位已替换） */
  worldmap_thumb_butterfly_house: 'subpkg_panels/images/ui/worldmap_thumb_butterfly_house.png',
  worldmap_thumb_garden_villa: 'subpkg_panels/images/ui/worldmap_thumb_garden_villa.png',
  worldmap_thumb_tea_house: 'subpkg_panels/images/ui/worldmap_thumb_tea_house.png',
  worldmap_thumb_forest_treehouse: 'subpkg_panels/images/ui/worldmap_thumb_forest_treehouse.png',
  /** 大地图梦云小屋立绘（支线，花愿购买解锁） */
  worldmap_thumb_dream_cloud_house: 'subpkg_panels/images/ui/worldmap_thumb_dream_cloud_house.png',
  /** 大地图花田农舍立绘（支线，花愿购买解锁） */
  worldmap_thumb_flower_farm_house: 'subpkg_panels/images/ui/worldmap_thumb_flower_farm_house.png',
  /** 大地图蛋糕房立绘（钩子，后续接 sceneId） */
  worldmap_thumb_cake_shop: 'subpkg_panels/images/ui/worldmap_thumb_cake_shop.png',
  icon_worldmap: 'subpkg_panels/images/ui/icon_worldmap.png',
  /** 大地图许愿喷泉双帧（水流动画） */
  worldmap_thumb_wishing_fountain_1: 'subpkg_panels/images/ui/worldmap_thumb_wishing_fountain_1.png',
  worldmap_thumb_wishing_fountain_2: 'subpkg_panels/images/ui/worldmap_thumb_wishing_fountain_2.png',
  /** 许愿喷泉：单张立绘（花精灵+喷泉泉水一体，透明底；标题由代码叠 deco_panel_title_ribbon） */
  flower_sign_gacha_scene_nb2: 'subpkg_panels/images/ui/flower_sign_gacha_scene_nb2.png',

  /** 每日挑战：NB2+rembg 粉紫壳（顶栏标题位、关闭钮、秒表条；中间留白叠列表） */
  daily_challenge_panel_shell_nb2: 'subpkg_panels/images/ui/daily_challenge_panel_shell_nb2.png',
  /** 周末花愿加成宣传卡（rembg 透明底，按钮文案由代码叠） */
  weekend_huayuan_boost_promo_panel_nb2: 'subpkg_panels/images/ui/weekend_huayuan_boost_promo_panel_nb2.png',
  /** 清涟荷影新手礼包宣传卡（空奖励格 + 空按钮，文案与图标由代码叠） */
  newbie_gift_qinglian_promo_panel_nb2: 'subpkg_panels/images/ui/newbie_gift_qinglian_promo_panel_nb2.png',
  /** 中间浅蓝任务区底板（空，叠在列表背后） */
  daily_challenge_task_area_nb2: 'subpkg_panels/images/ui/daily_challenge_ui_B_mid_plate_nb2.png',
  /** 任务行：暖金渐变 + 双层描边 + 高光阴影（与每日挑战壳 pastel 一致） */
  daily_challenge_task_row_textured_nb2: 'subpkg_panels/images/ui/daily_challenge_ui_C_task_row_textured_nb2.png',
  /** 周进度轨空槽 + 双小鸡（进度填充与刻度仍由代码画在上层） */
  daily_challenge_weekly_rail_empty_nb2: 'subpkg_panels/images/ui/daily_challenge_ui_D_weekly_rail_empty_nb2.png',
  /** 顶栏米色胶囊内倒计时左侧：金秒表（透明底） */
  daily_challenge_countdown_stopwatch_nb2:
    'subpkg_panels/images/ui/daily_challenge_countdown_stopwatch_nb2.png',
  /** 周积分轨里程碑刻度黄点 */
  daily_challenge_ui_F_dot: 'subpkg_panels/images/ui/daily_challenge_ui_F_dot.png',

  /** 图鉴面板壳体：笔记本风格粉紫框 + 金色标题栏 + 绿色翻页箭头 */
  collection_panel_shell_nb2: 'subpkg_panels/images/ui/collection_panel_shell_nb2.png',
  /** 家具工坊：NB2 粉紫壳（顶栏/材料 tray/内容区/底栏由贴图，文案与列表由代码叠） */
  furniture_workshop_panel_shell_nb2: 'subpkg_panels/images/ui/furniture_workshop_panel_shell_nb2.png',
  /** 图纸商店弹窗：星空卷轴异形壳（PIXI 叠标题/Tab/列表） */
  furniture_workshop_blueprint_shop_shell_nb2: 'subpkg_panels/images/ui/furniture_workshop_blueprint_shop_shell_nb2.png',
  /** 形象换装面板壳：玫瑰金框 + 空白内容区（PIXI 叠标题/进度/网格） */
  dressup_panel_shell_nb2: 'subpkg_panels/images/ui/dressup_panel_shell_nb2.png',

  /** 友谊卡 / 图鉴：通用卡背、（V1 遗留）友谊点图标、图鉴总览/详情壳 */
  affinity_card_back_default: 'subpkg_panels/images/ui/affinity_card_back_default.png',
  /** （V1 遗留）友谊点碎片图标；V2 重复卡直接发花愿/钻石/体力，已不再使用，仅保留资源 */
  affinity_shard_icon: 'subpkg_panels/images/ui/affinity_shard_icon.png',
  affinity_codex_overview_shell_nb2: 'subpkg_panels/images/ui/affinity_codex_overview_shell_nb2.png',
  affinity_codex_detail_shell_nb2: 'subpkg_panels/images/ui/affinity_codex_detail_shell_nb2.png',
  /** 图鉴未解锁物品占位卡：蓝色格纹方块 */
  collection_item_placeholder_nb2: 'subpkg_panels/images/ui/collection_item_placeholder_nb2.png',

  /** 新手引导：开场点题插画（单页） */
  tutorial_story_1: 'subpkg_panels/images/tutorial/story_1.png',

  /** 升星仪式 · 6 张「新解锁」专属图标（NB2+rembg；用于 LevelUnlockCard 的 feature/map/affinity 类） */
  ui_lvup_companion_bubble: 'subpkg_panels/images/ui/level_unlock/ui_lvup_companion_bubble.png',
  ui_lvup_combo_boost: 'subpkg_panels/images/ui/level_unlock/ui_lvup_combo_boost.png',
  ui_lvup_high_chest: 'subpkg_panels/images/ui/level_unlock/ui_lvup_high_chest.png',
  ui_lvup_world_map: 'subpkg_panels/images/ui/level_unlock/ui_lvup_world_map.png',
  ui_lvup_affinity_badge: 'subpkg_panels/images/ui/level_unlock/ui_lvup_affinity_badge.png',
  ui_lvup_butterfly_quest: 'subpkg_panels/images/ui/level_unlock/ui_lvup_butterfly_quest.png',
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
  flower_fresh_11: 'subpkg_items/images/flowers/fresh/flower_fresh_11.png',
  flower_fresh_12: 'subpkg_items/images/flowers/fresh/flower_fresh_12.png',
  flower_fresh_13: 'subpkg_items/images/flowers/fresh/flower_fresh_13.png',

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
  /** L10/L11 与 ItemConfig 绿植线一致：10 红掌、11 发财树（文件名未改，此处交叉映射） */
  flower_green_10: 'subpkg_items/images/flowers/green/flower_green_11.png',
  flower_green_11: 'subpkg_items/images/flowers/green/flower_green_10.png',
  flower_green_12: 'subpkg_items/images/flowers/green/flower_green_12.png',
  flower_green_13: 'subpkg_items/images/flowers/green/flower_green_13.png',

  // ---- 蝴蝶线 (10张) ----
  drink_butterfly_1: 'subpkg_items/images/drinks/butterfly/drink_butterfly_1.png',
  drink_butterfly_2: 'subpkg_items/images/drinks/butterfly/drink_butterfly_2.png',
  drink_butterfly_3: 'subpkg_items/images/drinks/butterfly/drink_butterfly_3.png',
  drink_butterfly_4: 'subpkg_items/images/drinks/butterfly/drink_butterfly_4.png',
  drink_butterfly_5: 'subpkg_items/images/drinks/butterfly/drink_butterfly_5.png',
  drink_butterfly_6: 'subpkg_items/images/drinks/butterfly/drink_butterfly_6.png',
  drink_butterfly_7: 'subpkg_items/images/drinks/butterfly/drink_butterfly_7.png',
  drink_butterfly_8: 'subpkg_items/images/drinks/butterfly/drink_butterfly_8.png',
  drink_butterfly_9: 'subpkg_items/images/drinks/butterfly/drink_butterfly_9.png',
  drink_butterfly_10: 'subpkg_items/images/drinks/butterfly/drink_butterfly_10.png',

  // ---- 冷饮线 (8张) ----
  drink_cold_1: 'subpkg_items/images/drinks/cold/drink_cold_1.png',
  drink_cold_2: 'subpkg_items/images/drinks/cold/drink_cold_2.png',
  drink_cold_3: 'subpkg_items/images/drinks/cold/drink_cold_3.png',
  drink_cold_4: 'subpkg_items/images/drinks/cold/drink_cold_4.png',
  drink_cold_5: 'subpkg_items/images/drinks/cold/drink_cold_5.png',
  drink_cold_6: 'subpkg_items/images/drinks/cold/drink_cold_6.png',
  drink_cold_7: 'subpkg_items/images/drinks/cold/drink_cold_7.png',
  drink_cold_8: 'subpkg_items/images/drinks/cold/drink_cold_8.png',

  // ---- 甜品线 (10张) ----
  drink_dessert_1: 'subpkg_items/images/drinks/dessert/drink_dessert_1.png',
  drink_dessert_2: 'subpkg_items/images/drinks/dessert/drink_dessert_2.png',
  drink_dessert_3: 'subpkg_items/images/drinks/dessert/drink_dessert_3.png',
  drink_dessert_4: 'subpkg_items/images/drinks/dessert/drink_dessert_4.png',
  drink_dessert_5: 'subpkg_items/images/drinks/dessert/drink_dessert_5.png',
  drink_dessert_6: 'subpkg_items/images/drinks/dessert/drink_dessert_6.png',
  drink_dessert_7: 'subpkg_items/images/drinks/dessert/drink_dessert_7.png',
  drink_dessert_8: 'subpkg_items/images/drinks/dessert/drink_dessert_8.png',
  drink_dessert_9: 'subpkg_items/images/drinks/dessert/drink_dessert_9.png',
  drink_dessert_10: 'subpkg_items/images/drinks/dessert/drink_dessert_10.png',

  // ---- 工具：种植线 (3级试跑) ----
  tool_plant_1: 'subpkg_items/images/tools/plant/tool_plant_1.png',
  tool_plant_2: 'subpkg_items/images/tools/plant/tool_plant_2.png',
  tool_plant_3: 'subpkg_items/images/tools/plant/tool_plant_3.png',
  tool_plant_4: 'subpkg_items/images/tools/plant/tool_plant_4.png',
  tool_plant_5: 'subpkg_items/images/tools/plant/tool_plant_5.png',
  tool_plant_6: 'subpkg_items/images/tools/plant/tool_plant_6.png',
  tool_plant_7: 'subpkg_items/images/tools/plant/tool_plant_7.png',

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

  // ---- 工具：捕虫网（蝴蝶线）----
  tool_butterfly_net_1: 'subpkg_items/images/tools/butterfly_net/tool_butterfly_net_1.png',
  tool_butterfly_net_2: 'subpkg_items/images/tools/butterfly_net/tool_butterfly_net_2.png',
  tool_butterfly_net_3: 'subpkg_items/images/tools/butterfly_net/tool_butterfly_net_3.png',
  tool_butterfly_net_4: 'subpkg_items/images/tools/butterfly_net/tool_butterfly_net_4.png',
  tool_butterfly_net_5: 'subpkg_items/images/tools/butterfly_net/tool_butterfly_net_5.png',

  // ---- 工具：冷饮线（饮品器具）----
  tool_mixer_1: 'subpkg_items/images/tools/mixer/tool_mixer_1.png',
  tool_mixer_2: 'subpkg_items/images/tools/mixer/tool_mixer_2.png',
  tool_mixer_3: 'subpkg_items/images/tools/mixer/tool_mixer_3.png',
  tool_mixer_4: 'subpkg_items/images/tools/mixer/tool_mixer_4.png',
  tool_mixer_5: 'subpkg_items/images/tools/mixer/tool_mixer_5.png',

  // ---- 工具：农田线（果切 MVP）----
  tool_farm_1: 'subpkg_items/images/tools/farm/tool_farm_1.png',
  tool_farm_2: 'subpkg_items/images/tools/farm/tool_farm_2.png',
  tool_farm_3: 'subpkg_items/images/tools/farm/tool_farm_3.png',
  tool_farm_4: 'subpkg_items/images/tools/farm/tool_farm_4.png',

  // ---- 工具：果切加工台 ----
  tool_fruit_cut_1: 'subpkg_items/images/tools/fruit_cut/tool_fruit_cut_1.png',
  tool_fruit_cut_2: 'subpkg_items/images/tools/fruit_cut/tool_fruit_cut_2.png',
  tool_fruit_cut_3: 'subpkg_items/images/tools/fruit_cut/tool_fruit_cut_3.png',

  // ---- 食物：整果合成线 L1–L4 ----
  food_fruit_1: 'subpkg_items/images/food/whole/food_fruit_1.png',
  food_fruit_2: 'subpkg_items/images/food/whole/food_fruit_2.png',
  food_fruit_3: 'subpkg_items/images/food/whole/food_fruit_3.png',
  food_fruit_4: 'subpkg_items/images/food/whole/food_fruit_4.png',

  // ---- 食物：果切线（4 线 × 3 级）----
  food_cut_avocado_1: 'subpkg_items/images/food/cut/food_cut_avocado_1.png',
  food_cut_avocado_2: 'subpkg_items/images/food/cut/food_cut_avocado_2.png',
  food_cut_avocado_3: 'subpkg_items/images/food/cut/food_cut_avocado_3.png',
  food_cut_watermelon_1: 'subpkg_items/images/food/cut/food_cut_watermelon_1.png',
  food_cut_watermelon_2: 'subpkg_items/images/food/cut/food_cut_watermelon_2.png',
  food_cut_watermelon_3: 'subpkg_items/images/food/cut/food_cut_watermelon_3.png',
  food_cut_pineapple_1: 'subpkg_items/images/food/cut/food_cut_pineapple_1.png',
  food_cut_pineapple_2: 'subpkg_items/images/food/cut/food_cut_pineapple_2.png',
  food_cut_pineapple_3: 'subpkg_items/images/food/cut/food_cut_pineapple_3.png',
  food_cut_dragonfruit_1: 'subpkg_items/images/food/cut/food_cut_dragonfruit_1.png',
  food_cut_dragonfruit_2: 'subpkg_items/images/food/cut/food_cut_dragonfruit_2.png',
  food_cut_dragonfruit_3: 'subpkg_items/images/food/cut/food_cut_dragonfruit_3.png',

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

  // ---- 棋盘消耗品（幸运金币 / 万能水晶 / 金剪刀，与 icon_coin 同 122×128，items 分包）----
  icon_coin: 'subpkg_items/images/special/special_lucky_coin.png',
  icon_crystal_ball: 'subpkg_items/images/special/special_crystal_ball.png',
  icon_golden_scissors: 'subpkg_items/images/special/special_golden_scissors.png',

};

// ================================================================
// events 分包资源：限时活动独有 UI + 物品图，按 eventId 独立目录存放，便于整套替换
// ================================================================
const JEWELRY_BOX_EVENT_IMAGE_MAP: Record<string, string> = {
  /** 花间珠匣活动整页背景：NB2 珠匣华丽底图（顶部金标题牌 + 中部纯色棋盘区 + 底部花纹） */
  event_board_bg: 'subpkg_events/images/jewelry_box_event/ui/event_board_bg_nb2.png',
  /** 花间珠匣：底部原石投放器「珠宝匣」图标（NB2 + birefnet 去底） */
  event_jewelry_casket: 'subpkg_events/images/jewelry_box_event/ui/event_jewelry_casket_nb2.png',
  /** 花间珠匣：棋盘上的「时空门」棋子（NB2 + birefnet 去底；集齐钥匙点击进下一层） */
  event_portal_gate: 'subpkg_events/images/jewelry_box_event/ui/event_portal_gate_nb2.png',
  /** 花间珠匣：阶段信息条纯色淡紫底（NB2 + birefnet 去底；其上叠绘标题/进度/图标） */
  event_stage_card_bg: 'subpkg_events/images/jewelry_box_event/ui/event_stage_card_bg_nb2.png',
  /** 花间珠匣：全锁格关闭首饰箱（NB2 + birefnet 去底） */
  event_cell_fog: 'subpkg_events/images/jewelry_box_event/ui/event_cell_fog_nb2.png',
  /** 花间珠匣：半锁格半块丝绒布（上半透明露出压着的物品） */
  event_cell_peek: 'subpkg_events/images/jewelry_box_event/ui/event_cell_peek_nb2.png',
  /** 花间珠匣：进度条上可获得钥匙节点的金钥匙角标（NB2 + birefnet 去底） */
  event_key_badge: 'subpkg_events/images/jewelry_box_event/ui/event_key_badge_nb2.png',
  /** 花间珠匣珠宝图鉴入口：小册子本体（Gemini + rembg；感叹号/进度条由程序绘制） */
  event_jewelry_reward_book_icon: 'subpkg_events/images/jewelry_box_event/ui/event_jewelry_reward_book_icon.png',
  /** 花间珠匣进度回响入口：点翠蓝绿进度徽章（Gemini + rembg） */
  event_jewelry_codex_reward_icon: 'subpkg_events/images/jewelry_box_event/ui/event_jewelry_codex_reward_icon.png',
  /** 花间珠匣：珠宝图鉴页空面板壳（透明底，内容由程序绘制） */
  event_jewelry_codex_panel_shell: 'subpkg_events/images/jewelry_box_event/ui/event_jewelry_codex_panel_shell.png',
  /** 花间珠匣：珠宝图鉴分组空面板（标题头 + 右侧奖励预留 + 空内容区） */
  event_jewelry_codex_reward_section_shell: 'subpkg_events/images/jewelry_box_event/ui/event_jewelry_codex_reward_section_shell.png',
  /** 花间珠匣：进度回响空面板壳（后续程序绘制达标奖励列表） */
  event_jewelry_codex_reward_panel_shell: 'subpkg_events/images/jewelry_box_event/ui/event_jewelry_codex_reward_panel_shell.png',

  // ---- 活动首饰线（花间珠匣活动棋盘，L1 原石 → L13 珠宝套装）----
  event_jewelry_1: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_1.png',
  event_jewelry_2: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_2.png',
  event_jewelry_3: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_3.png',
  event_jewelry_4: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_4.png',
  event_jewelry_5: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_5.png',
  event_jewelry_6: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_6.png',
  event_jewelry_7: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_7.png',
  event_jewelry_8: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_8.png',
  event_jewelry_9: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_9.png',
  event_jewelry_10: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_10.png',
  event_jewelry_11: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_11.png',
  event_jewelry_12: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_12.png',
  event_jewelry_13: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_13.png',
  event_jewelry_dian_cui_1: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_1.png',
  event_jewelry_dian_cui_2: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_2.png',
  event_jewelry_dian_cui_3: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_3.png',
  event_jewelry_dian_cui_4: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_4.png',
  event_jewelry_dian_cui_5: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_5.png',
  event_jewelry_dian_cui_6: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_6.png',
  event_jewelry_dian_cui_7: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_7.png',
  event_jewelry_dian_cui_8: 'subpkg_events/images/jewelry_box_event/items/event_jewelry_dian_cui_8.png',
};

const EVENT_IMAGE_MAPS: Record<string, Record<string, string>> = {
  jewelry_box_event: JEWELRY_BOX_EVENT_IMAGE_MAP,
};

const EVENTS_IMAGE_MAP: Record<string, string> = {
  ...JEWELRY_BOX_EVENT_IMAGE_MAP,
};

// ================================================================
// deco CDN 资源
// ================================================================
const DECO_IMAGE_MAP: Record<string, string> = {
  // ---- 花店建筑场景 ----
  house_shop: 'subpkg_deco/images/house/bg_room_default_soft_nb2.png',
  house_bg:   'subpkg_deco/images/house/bg_integrated_grass_nb2.jpg',
  house_bg_dream_cloud_sky_nb2: 'subpkg_deco/images/house/bg_dream_cloud_sky_nb2.jpg',
  house_bg_flower_farm_fields_nb2: 'subpkg_deco/images/house/bg_flower_farm_fields_nb2.jpg',

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
  promo_wood_tea_table: 'subpkg_deco/images/furniture/promo_wood_tea_table.png',
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
  promo_mint_fridge: 'subpkg_deco/images/furniture/promo_mint_fridge.png',
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
  promo_floral_sofa: 'subpkg_deco/images/furniture/promo_floral_sofa.png',
  /** 弧翼大沙发：1 列 × 3 行（默认绿 / 樱粉 / 海蓝）；每格 max-side 342 高清合图 */
  workshop_plush_sofa_sheet: 'subpkg_deco/images/furniture/workshop_plush_sofa_sheet.png',
  /** 泡芙拼块沙发：2 列合图 col0=front col1=back；每格 max-side 342 */
  workshop_puffy_petal_sofa_sheet: 'subpkg_deco/images/furniture/workshop_puffy_petal_sofa_sheet.png',
  workshop_giant_rose_bouquet_sheet: 'subpkg_deco/images/furniture/workshop_giant_rose_bouquet_sheet.png',
  /** 黑色超薄电视柜：2 列正/背合图；每格 max-side 342 */
  workshop_pastel_tv_cabinet_sheet: 'subpkg_deco/images/furniture/workshop_pastel_tv_cabinet_sheet.png',
  /** 玫瑰垂幔帘：1 列 × 3 行（樱粉 / 天蓝 / 蜜黄）；每格 max-side 342 */
  workshop_rose_cascade_drape_sheet: 'subpkg_deco/images/furniture/workshop_rose_cascade_drape_sheet.png',
  /** 蕾丝铁艺床：单张 PNG，max-side 342 */
  workshop_lace_ribbon_bed: 'subpkg_deco/images/furniture/workshop_lace_ribbon_bed.png',
  workshop_blueprint_generic: 'subpkg_deco/images/furniture/workshop_blueprint_generic.png',
  promo_petal_chaise: 'subpkg_deco/images/furniture/promo_petal_chaise.png',
  promo_doll_hug_pillow: 'subpkg_deco/images/furniture/promo_doll_hug_pillow.png',
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
  wallart_rose_swag_drape: 'subpkg_deco/images/furniture/wallart_rose_swag_drape.png',
  promo_pearl_bead_curtain: 'subpkg_deco/images/furniture/promo_pearl_bead_curtain.png',
  event_jewelry_jade_curtain: 'subpkg_deco/images/furniture/event_jewelry_jade_curtain.png',
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
  greenhouse_vase_tulip: 'subpkg_deco/images/furniture/greenhouse_vase_tulip.png',
  greenhouse_vase_peony: 'subpkg_deco/images/furniture/greenhouse_vase_peony.png',
  greenhouse_vase_lotus: 'subpkg_deco/images/furniture/greenhouse_vase_lotus.png',
  // 鲜花摆件批次 10（全场景摆件 Tab）
  orn_flora_hanging_spider_plant: 'subpkg_deco/images/furniture/orn_flora_hanging_spider_plant.png',
  orn_flora_wall_ivy_trellis: 'subpkg_deco/images/furniture/orn_flora_wall_ivy_trellis.png',
  orn_flora_fiddle_leaf_pot: 'subpkg_deco/images/furniture/orn_flora_fiddle_leaf_pot.png',
  orn_flora_hyacinth_glass_vase: 'subpkg_deco/images/furniture/orn_flora_hyacinth_glass_vase.png',
  orn_flora_wildflower_mason_jar: 'subpkg_deco/images/furniture/orn_flora_wildflower_mason_jar.png',
  orn_flora_blooming_cactus: 'subpkg_deco/images/furniture/orn_flora_blooming_cactus.png',
  orn_flora_lavender_window_box: 'subpkg_deco/images/furniture/orn_flora_lavender_window_box.png',
  orn_flora_cherry_branch_vase: 'subpkg_deco/images/furniture/orn_flora_cherry_branch_vase.png',
  orn_flora_fern_terrarium: 'subpkg_deco/images/furniture/orn_flora_fern_terrarium.png',
  orn_flora_hanging_petunia: 'subpkg_deco/images/furniture/orn_flora_hanging_petunia.png',
  orn_flora_pink_phalaenopsis_pot: 'subpkg_deco/images/furniture/orn_flora_pink_phalaenopsis_pot.png',
  // 蝴蝶小屋专属家具（由合图拆分）
  butterfly_house_display_case: 'subpkg_deco/images/furniture/butterfly_house_display_case.png',
  butterfly_house_writing_desk: 'subpkg_deco/images/furniture/butterfly_house_writing_desk.png',
  butterfly_house_sofa: 'subpkg_deco/images/furniture/butterfly_house_sofa.png',
  butterfly_house_wicker_chair: 'subpkg_deco/images/furniture/butterfly_house_wicker_chair.png',
  butterfly_house_tea_table: 'subpkg_deco/images/furniture/butterfly_house_tea_table.png',
  butterfly_house_wall_frame: 'subpkg_deco/images/furniture/butterfly_house_wall_frame.png',
  butterfly_house_study_field_stool: 'subpkg_deco/images/furniture/butterfly_house_study_field_stool.png',
  butterfly_house_study_pin_board: 'subpkg_deco/images/furniture/butterfly_house_study_pin_board.png',
  butterfly_house_bamboo_screen: 'subpkg_deco/images/furniture/butterfly_house_bamboo_screen.png',
  butterfly_house_study_microscope_desk: 'subpkg_deco/images/furniture/butterfly_house_study_microscope_desk.png',
  butterfly_house_moon_specimen_shelf: 'subpkg_deco/images/furniture/butterfly_house_moon_specimen_shelf.png',
  butterfly_house_aurora_terrarium: 'subpkg_deco/images/furniture/butterfly_house_aurora_terrarium.png',
  butterfly_house_moon_crescent_rug: 'subpkg_deco/images/furniture/butterfly_house_moon_crescent_rug.png',
  butterfly_house_moon_star_chair: 'subpkg_deco/images/furniture/butterfly_house_moon_star_chair.png',
  villa_planter_urn: 'subpkg_deco/images/furniture/villa_planter_urn.png',
  villa_wrought_bench: 'subpkg_deco/images/furniture/villa_wrought_bench.png',
  villa_gilded_mirror: 'subpkg_deco/images/furniture/villa_gilded_mirror.png',
  villa_rose_armoire: 'subpkg_deco/images/furniture/villa_rose_armoire.png',
  wallart_window_meadow_arch: 'subpkg_deco/images/furniture/wallart_window_meadow_arch.png',
  wallart_window_lake_round: 'subpkg_deco/images/furniture/wallart_window_lake_round.png',

  deco_late_lv7_table_01: 'subpkg_deco/images/furniture/deco_late_lv7_table_01.png',
  deco_late_lv7_wall_01: 'subpkg_deco/images/furniture/deco_late_lv7_wall_01.png',
  deco_late_lv8_garden_01: 'subpkg_deco/images/furniture/deco_late_lv8_garden_01.png',
  deco_late_lv8_shelf_01: 'subpkg_deco/images/furniture/deco_late_lv8_shelf_01.png',
  deco_late_lv8_light_01: 'subpkg_deco/images/furniture/deco_late_lv8_light_01.png',
  deco_late_lv9_orn_furn_01: 'subpkg_deco/images/furniture/deco_late_lv9_orn_furn_01.png',
  deco_late_lv9_wall_01: 'subpkg_deco/images/furniture/deco_late_lv9_wall_01.png',
  deco_late_lv9_table_01: 'subpkg_deco/images/furniture/deco_late_lv9_table_01.png',
  deco_late_lv9_garden_01: 'subpkg_deco/images/furniture/deco_late_lv9_garden_01.png',
  deco_late_lv10_shelf_01: 'subpkg_deco/images/furniture/deco_late_lv10_shelf_01.png',
  deco_late_lv10_orn_01: 'subpkg_deco/images/furniture/deco_late_lv10_orn_01.png',
  deco_late_lv10_pachira_01: 'subpkg_deco/images/furniture/deco_late_lv10_pachira_01.png',

  // ---- Lv14-20 高星常驻家具：海滨花园套 + 月光蝶园套 ----
  deco_lv14_wall_butterfly_clock: 'subpkg_deco/images/furniture/deco_lv14_wall_butterfly_clock.png',
  deco_lv14_light_blossom_sconce: 'subpkg_deco/images/furniture/deco_lv14_light_blossom_sconce.png',
  deco_lv15_garden_pool: 'subpkg_deco/images/furniture/deco_lv15_garden_pool.png',
  deco_lv15_garden_parasol: 'subpkg_deco/images/furniture/deco_lv15_garden_parasol.png',
  deco_lv15_light_drink_cooler: 'subpkg_deco/images/furniture/deco_lv15_light_drink_cooler.png',
  deco_lv16_orn_hanging_chair: 'subpkg_deco/images/furniture/deco_lv16_orn_hanging_chair.png',
  deco_lv16_wall_shell_mirror: 'subpkg_deco/images/furniture/deco_lv16_wall_shell_mirror.png',
  deco_lv16_garden_coral_planter: 'subpkg_deco/images/furniture/deco_lv16_garden_coral_planter.png',
  deco_lv17_shelf_surfboard: 'subpkg_deco/images/furniture/deco_lv17_shelf_surfboard.png',
  deco_lv17_table_terrace_bar: 'subpkg_deco/images/furniture/deco_lv17_table_terrace_bar.png',
  deco_lv17_orn_seabreeze_rug: 'subpkg_deco/images/furniture/deco_lv17_orn_seabreeze_rug.png',
  deco_lv18_shelf_moon_glasshouse: 'subpkg_deco/images/furniture/deco_lv18_shelf_moon_glasshouse.png',
  deco_lv18_light_firefly_lamp: 'subpkg_deco/images/furniture/deco_lv18_light_firefly_lamp.png',
  deco_lv18_garden_butterfly_arch: 'subpkg_deco/images/furniture/deco_lv18_garden_butterfly_arch.png',
  deco_lv19_wall_crystal_specimen: 'subpkg_deco/images/furniture/deco_lv19_wall_crystal_specimen.png',
  deco_lv19_orn_crescent_chaise: 'subpkg_deco/images/furniture/deco_lv19_orn_crescent_chaise.png',
  deco_lv19_table_stardust_aroma: 'subpkg_deco/images/furniture/deco_lv19_table_stardust_aroma.png',
  deco_lv20_garden_moon_fountain: 'subpkg_deco/images/furniture/deco_lv20_garden_moon_fountain.png',
  deco_lv20_shelf_star_observatory: 'subpkg_deco/images/furniture/deco_lv20_shelf_star_observatory.png',
  deco_lv20_wall_moon_sheer_curtain: 'subpkg_deco/images/furniture/deco_lv20_wall_moon_sheer_curtain.png',

  // ---- Lv10-20 扩展家具 30 件（NB2+rembg+crop_trim；DECO_DEFS 中以 deco_lv* id 注册）----
  deco_lv10_table_zen_tea_low: 'subpkg_deco/images/furniture/deco_lv10_table_zen_tea_low.png',
  deco_lv10_orn_zen_cushion_pair: 'subpkg_deco/images/furniture/deco_lv10_orn_zen_cushion_pair.png',
  deco_lv11_wallart_zen_ink_scroll: 'subpkg_deco/images/furniture/deco_lv11_wallart_zen_ink_scroll.png',
  deco_lv12_orn_mushroom_stool_pair: 'subpkg_deco/images/furniture/deco_lv12_orn_mushroom_stool_pair.png',
  deco_lv13_table_mushroom_round: 'subpkg_deco/images/furniture/deco_lv13_table_mushroom_round.png',
  deco_lv14_shelf_mushroom_cottage: 'subpkg_deco/images/furniture/deco_lv14_shelf_mushroom_cottage.png',
  deco_lv15_garden_mushroom_grove: 'subpkg_deco/images/furniture/deco_lv15_garden_mushroom_grove.png',
  deco_lv13_table_french_pastry_counter: 'subpkg_deco/images/furniture/deco_lv13_table_french_pastry_counter.png',
  deco_lv14_shelf_handbrew_coffee_bar: 'subpkg_deco/images/furniture/deco_lv14_shelf_handbrew_coffee_bar.png',
  deco_lv15_light_vintage_oven: 'subpkg_deco/images/furniture/deco_lv15_light_vintage_oven.png',
  deco_lv16_orn_macaron_tower: 'subpkg_deco/images/furniture/deco_lv16_orn_macaron_tower.png',
  deco_lv15_shelf_antique_library: 'subpkg_deco/images/furniture/deco_lv15_shelf_antique_library.png',
  deco_lv16_table_globe_writing_desk: 'subpkg_deco/images/furniture/deco_lv16_table_globe_writing_desk.png',
  deco_lv17_orn_chesterfield_armchair: 'subpkg_deco/images/furniture/deco_lv17_orn_chesterfield_armchair.png',
  deco_lv18_wallart_botanical_taxonomy: 'subpkg_deco/images/furniture/deco_lv18_wallart_botanical_taxonomy.png',
  deco_lv17_garden_aurora_mirror_pond: 'subpkg_deco/images/furniture/deco_lv17_garden_aurora_mirror_pond.png',
  deco_lv18_orn_aurora_crystal_orb: 'subpkg_deco/images/furniture/deco_lv18_orn_aurora_crystal_orb.png',
  deco_lv19_light_aurora_floor_lantern: 'subpkg_deco/images/furniture/deco_lv19_light_aurora_floor_lantern.png',
  deco_lv18_orn_cloud_pouf_set: 'subpkg_deco/images/furniture/deco_lv18_orn_cloud_pouf_set.png',
  deco_lv19_table_cloud_dessert_island: 'subpkg_deco/images/furniture/deco_lv19_table_cloud_dessert_island.png',
  deco_lv20_garden_cloud_swing: 'subpkg_deco/images/furniture/deco_lv20_garden_cloud_swing.png',
  deco_lv10_orn_kitten_bed: 'subpkg_deco/images/furniture/deco_lv10_orn_kitten_bed.png',
  deco_lv11_orn_cat_tower: 'subpkg_deco/images/furniture/deco_lv11_orn_cat_tower.png',
  deco_lv11_light_phonograph_vintage: 'subpkg_deco/images/furniture/deco_lv11_light_phonograph_vintage.png',
  deco_lv12_orn_pastel_postbox: 'subpkg_deco/images/furniture/deco_lv12_orn_pastel_postbox.png',
  deco_lv13_orn_teddy_armchair: 'subpkg_deco/images/furniture/deco_lv13_orn_teddy_armchair.png',
  deco_lv14_orn_carousel_music_box: 'subpkg_deco/images/furniture/deco_lv14_orn_carousel_music_box.png',
  deco_lv15_light_terrarium_lamp: 'subpkg_deco/images/furniture/deco_lv15_light_terrarium_lamp.png',
  deco_lv16_wallart_harbor_arch_window: 'subpkg_deco/images/furniture/deco_lv16_wallart_harbor_arch_window.png',
  deco_lv20_orn_white_grand_piano: 'subpkg_deco/images/furniture/deco_lv20_orn_white_grand_piano.png',

  // ---- Batch53 仙气古风 Lv21–30（rembg + crop_trim + max-side 171）----
  xianqi_maple_round_table: 'subpkg_deco/images/furniture/xianqi_maple_round_table.png',
  xianqi_maple_folding_chair: 'subpkg_deco/images/furniture/xianqi_maple_folding_chair.png',
  xianqi_maple_incense_stand: 'subpkg_deco/images/furniture/xianqi_maple_incense_stand.png',
  xianqi_maple_landscape_screen: 'subpkg_deco/images/furniture/xianqi_maple_landscape_screen.png',
  xianqi_maple_tier_shelf: 'subpkg_deco/images/furniture/xianqi_maple_tier_shelf.png',
  xianqi_plum_canopy_bed: 'subpkg_deco/images/furniture/xianqi_plum_canopy_bed.png',
  xianqi_plum_wardrobe: 'subpkg_deco/images/furniture/xianqi_plum_wardrobe.png',
  xianqi_plum_snow_basin: 'subpkg_deco/images/furniture/xianqi_plum_snow_basin.png',
  xianqi_plum_snow_window: 'subpkg_deco/images/furniture/xianqi_plum_snow_window.png',
  xianqi_plum_padded_stool: 'subpkg_deco/images/furniture/xianqi_plum_padded_stool.png',
  xianqi_koi_stream_bridge: 'subpkg_deco/images/furniture/xianqi_koi_stream_bridge.png',
  xianqi_koi_pond_tea_table: 'subpkg_deco/images/furniture/xianqi_koi_pond_tea_table.png',
  xianqi_koi_scale_cabinet: 'subpkg_deco/images/furniture/xianqi_koi_scale_cabinet.png',
  xianqi_koi_twin_stone_seat: 'subpkg_deco/images/furniture/xianqi_koi_twin_stone_seat.png',
  xianqi_koi_wall_fountain: 'subpkg_deco/images/furniture/xianqi_koi_wall_fountain.png',
  xianqi_bamboo_mist_daybed: 'subpkg_deco/images/furniture/xianqi_bamboo_mist_daybed.png',

  // ---- 现代生活扩展 Lv25–35（Gemini NB2 + rembg + crop_trim + max-side 171）----
  modern_folding_laundry_rack: 'subpkg_deco/images/furniture/modern_folding_laundry_rack.png',
  modern_kitchen_base_counter: 'subpkg_deco/images/furniture/modern_kitchen_base_counter.png',
  modern_hotdog_roller: 'subpkg_deco/images/furniture/modern_hotdog_roller.png',
  modern_glass_drink_dispenser: 'subpkg_deco/images/furniture/modern_glass_drink_dispenser.png',
  modern_camping_tent: 'subpkg_deco/images/furniture/modern_camping_tent.png',
  modern_picnic_cooler_cart: 'subpkg_deco/images/furniture/modern_picnic_cooler_cart.png',
  modern_plush_cloud_pile: 'subpkg_deco/images/furniture/modern_plush_cloud_pile.png',
  modern_wall_fairy_lights: 'subpkg_deco/images/furniture/modern_wall_fairy_lights.png',
  modern_tall_flower_vase: 'subpkg_deco/images/furniture/modern_tall_flower_vase.png',
  modern_capsule_drink_fridge: 'subpkg_deco/images/furniture/modern_capsule_drink_fridge.png',
  modern_waffle_snack_cart: 'subpkg_deco/images/furniture/modern_waffle_snack_cart.png',
  modern_robot_vacuum_dock: 'subpkg_deco/images/furniture/modern_robot_vacuum_dock.png',
  modern_balcony_drying_cabinet: 'subpkg_deco/images/furniture/modern_balcony_drying_cabinet.png',
  modern_plant_grow_light_shelf: 'subpkg_deco/images/furniture/modern_plant_grow_light_shelf.png',
  modern_citrus_soda_machine: 'subpkg_deco/images/furniture/modern_citrus_soda_machine.png',
  modern_pegboard_hobby_wall: 'subpkg_deco/images/furniture/modern_pegboard_hobby_wall.png',
  modern_countertop_icecream_machine: 'subpkg_deco/images/furniture/modern_countertop_icecream_machine.png',
  modern_aquarium_side_table: 'subpkg_deco/images/furniture/modern_aquarium_side_table.png',
  modern_plush_display_ladder: 'subpkg_deco/images/furniture/modern_plush_display_ladder.png',
  modern_patio_swing_sofa: 'subpkg_deco/images/furniture/modern_patio_swing_sofa.png',
  modern_plush_capybara: 'subpkg_deco/images/furniture/modern_plush_capybara.png',
  modern_plush_clownfish: 'subpkg_deco/images/furniture/modern_plush_clownfish.png',
  modern_plush_tree_spirit: 'subpkg_deco/images/furniture/modern_plush_tree_spirit.png',
  azure_lazy_wicker_loveseat: 'subpkg_deco/images/furniture/azure_lazy_wicker_loveseat.png',
  azure_lazy_wicker_armchair: 'subpkg_deco/images/furniture/azure_lazy_wicker_armchair.png',
  azure_lazy_ladder_towel_rack: 'subpkg_deco/images/furniture/azure_lazy_ladder_towel_rack.png',
  azure_lazy_glass_shell_table: 'subpkg_deco/images/furniture/azure_lazy_glass_shell_table.png',
  azure_lazy_star_border_rug: 'subpkg_deco/images/furniture/azure_lazy_star_border_rug.png',
  azure_lazy_barrel_stool: 'subpkg_deco/images/furniture/azure_lazy_barrel_stool.png',
  azure_lazy_star_lantern_string: 'subpkg_deco/images/furniture/azure_lazy_star_lantern_string.png',
  azure_lazy_lemon_tree_pot: 'subpkg_deco/images/furniture/azure_lazy_lemon_tree_pot.png',
  modern_lazy_bean_bag_coral: 'subpkg_deco/images/furniture/modern_lazy_bean_bag_coral.png',
  azure_lazy_bean_bag: 'subpkg_deco/images/furniture/azure_lazy_bean_bag.png',
  modern_floor_cello: 'subpkg_deco/images/furniture/modern_floor_cello.png',

  jiangnan_wash_bench: 'subpkg_deco/images/furniture/jiangnan_wash_bench.png',
  xianqi_bamboo_joint_desk: 'subpkg_deco/images/furniture/xianqi_bamboo_joint_desk.png',
  xianqi_bamboo_book_tower: 'subpkg_deco/images/furniture/xianqi_bamboo_book_tower.png',
  xianqi_bamboo_mist_fence: 'subpkg_deco/images/furniture/xianqi_bamboo_mist_fence.png',
  xianqi_orchid_pavilion_mirror: 'subpkg_deco/images/furniture/xianqi_orchid_pavilion_mirror.png',

  // ---- 茶香小院专属家具（batch51 tea_house Lv20-30）----
  gucha_tea_bench: 'subpkg_deco/images/furniture/gucha_tea_bench.png',
  jiangnan_lattice_window: 'subpkg_deco/images/furniture/jiangnan_lattice_window.png',
  gucha_water_jar: 'subpkg_deco/images/furniture/gucha_water_jar.png',
  gucha_charcoal_brazier: 'subpkg_deco/images/furniture/gucha_charcoal_brazier.png',
  jiangnan_rattan_daybed: 'subpkg_deco/images/furniture/jiangnan_rattan_daybed.png',
  gucha_tea_boat: 'subpkg_deco/images/furniture/gucha_tea_boat.png',
  jiangnan_willow_cart: 'subpkg_deco/images/furniture/jiangnan_willow_cart.png',
  gucha_tea_chest: 'subpkg_deco/images/furniture/gucha_tea_chest.png',
  xianxia_herb_rack: 'subpkg_deco/images/furniture/xianxia_herb_rack.png',
  jiangnan_blue_cabinet: 'subpkg_deco/images/furniture/jiangnan_blue_cabinet.png',
  xianxia_meditation_platform: 'subpkg_deco/images/furniture/xianxia_meditation_platform.png',

  // ---- 橡树小屋专属家具（forest_treehouse Lv35–38 航海奇遇套）----
  sea_wheel_wall: 'subpkg_deco/images/furniture/sea_wheel_wall.png',
  sea_anchor_bench: 'subpkg_deco/images/furniture/sea_anchor_bench.png',
  sea_treasure_chest: 'subpkg_deco/images/furniture/sea_treasure_chest.png',
  sea_coral_cabinet: 'subpkg_deco/images/furniture/sea_coral_cabinet.png',

  // ---- 梦云小屋专属家具（dream_cloud_house Lv20–24 卧室休闲套）----
  dream_cloud_bed: 'subpkg_deco/images/furniture/dream_cloud_bed.png',
  dream_cloud_sofa: 'subpkg_deco/images/furniture/dream_cloud_sofa.png',
  dream_cloud_star_rug: 'subpkg_deco/images/furniture/dream_cloud_star_rug.png',
  dream_cloud_moon_nightstand: 'subpkg_deco/images/furniture/dream_cloud_moon_nightstand.png',
  dream_cloud_star_vanity: 'subpkg_deco/images/furniture/dream_cloud_star_vanity.png',
  dream_cloud_tea_table: 'subpkg_deco/images/furniture/dream_cloud_tea_table.png',
  dream_cloud_bookshelf: 'subpkg_deco/images/furniture/dream_cloud_bookshelf.png',
  dream_cloud_crescent_cushion: 'subpkg_deco/images/furniture/dream_cloud_crescent_cushion.png',
  dream_cloud_floor_lamp: 'subpkg_deco/images/furniture/dream_cloud_floor_lamp.png',
  dream_cloud_storage_chest: 'subpkg_deco/images/furniture/dream_cloud_storage_chest.png',

  // ---- 花田农舍专属家具（flower_farm_house Lv30–34 拾光田园套 v2）----
  farm_vegetable_patch_rug: 'subpkg_deco/images/furniture/farm_vegetable_patch_rug.png',
  farm_garden_tool_stand: 'subpkg_deco/images/furniture/farm_garden_tool_stand.png',
  farm_fruit_crate_stack: 'subpkg_deco/images/furniture/farm_fruit_crate_stack.png',
  farm_scarecrow: 'subpkg_deco/images/furniture/farm_scarecrow.png',
  farm_hen_coop: 'subpkg_deco/images/furniture/farm_hen_coop.png',
  farm_melon_trellis: 'subpkg_deco/images/furniture/farm_melon_trellis.png',
  farm_hay_bench: 'subpkg_deco/images/furniture/farm_hay_bench.png',
  farm_beehive_stand: 'subpkg_deco/images/furniture/farm_beehive_stand.png',
  farm_fu_sticker_wall: 'subpkg_deco/images/furniture/farm_fu_sticker_wall.png',
  farm_ivy_wall: 'subpkg_deco/images/furniture/farm_ivy_wall.png',
  farm_rocking_chair: 'subpkg_deco/images/furniture/farm_rocking_chair.png',
  farm_picket_fence_wall: 'subpkg_deco/images/furniture/farm_picket_fence_wall.png',

  // ---- 古风/民俗/奇匠 Lv30-35（batch51）----
  ancient_brush_mountain: 'subpkg_deco/images/furniture/ancient_brush_mountain.png',
  ancient_inkstone_desk: 'subpkg_deco/images/furniture/ancient_inkstone_desk.png',
  ancient_scroll_rack: 'subpkg_deco/images/furniture/ancient_scroll_rack.png',
  ancient_dressing_case: 'subpkg_deco/images/furniture/ancient_dressing_case.png',
  folk_kite_wall: 'subpkg_deco/images/furniture/folk_kite_wall.png',
  folk_lion_head_stand: 'subpkg_deco/images/furniture/folk_lion_head_stand.png',
  ancient_landscape_screen: 'subpkg_deco/images/furniture/ancient_landscape_screen.png',
  folk_dragon_bench: 'subpkg_deco/images/furniture/folk_dragon_bench.png',
  ancient_master_chair: 'subpkg_deco/images/furniture/ancient_master_chair.png',
  ancient_bronze_ding: 'subpkg_deco/images/furniture/ancient_bronze_ding.png',
  ancient_phoenix_rug: 'subpkg_deco/images/furniture/ancient_phoenix_rug.png',
  ancient_jade_bi_stand: 'subpkg_deco/images/furniture/ancient_jade_bi_stand.png',
  whimsy_geode_table: 'subpkg_deco/images/furniture/whimsy_geode_table.png',
  folk_pole_lantern: 'subpkg_deco/images/furniture/folk_pole_lantern.png',
  ancient_stone_lantern: 'subpkg_deco/images/furniture/ancient_stone_lantern.png',

  // ---- 首月签到活动专属家具（7/14/21/28 日签到 + 28 日累计礼包）----
  checkin_m1_bunny_ac: 'subpkg_deco/images/furniture/checkin_m1_bunny_ac.png',
  checkin_m1_crystal_partition: 'subpkg_deco/images/furniture/checkin_m1_crystal_partition.png',
  checkin_m1_moon_display_arch: 'subpkg_deco/images/furniture/checkin_m1_moon_display_arch.png',
  checkin_m1_butterfly_wall_lamp: 'subpkg_deco/images/furniture/checkin_m1_butterfly_wall_lamp.png',
  checkin_m1_dew_wish_fountain: 'subpkg_deco/images/furniture/checkin_m1_dew_wish_fountain.png',
  checkin_m1_rocking_horse: 'subpkg_deco/images/furniture/checkin_m1_rocking_horse.png',

  /** 后期家具占位：无独立贴图前可继续用作 fallback */
  furniture_deco_placeholder: 'subpkg_deco/images/furniture/furniture_deco_placeholder.png',

  // ---- 蛋糕房 cake_shop 专属家具 20 件（NB2+rembg+crop_trim；allowedSceneIds=['cake_shop']）----
  cake_shelf_layered_display:        'subpkg_deco/images/cake/cake_shelf_layered_display.png',
  cake_shelf_baking_pantry:          'subpkg_deco/images/cake/cake_shelf_baking_pantry.png',
  cake_shelf_chilled_cabinet:        'subpkg_deco/images/cake/cake_shelf_chilled_cabinet.png',
  cake_shelf_fondant_flowers:        'subpkg_deco/images/cake/cake_shelf_fondant_flowers.png',
  cake_table_workstation:            'subpkg_deco/images/cake/cake_table_workstation.png',
  cake_table_register_counter:       'subpkg_deco/images/cake/cake_table_register_counter.png',
  cake_table_round_dessert:          'subpkg_deco/images/cake/cake_table_round_dessert.png',
  cake_table_gift_wrap:              'subpkg_deco/images/cake/cake_table_gift_wrap.png',
  cake_table_dessert_island:         'subpkg_deco/images/cake/cake_table_dessert_island.png',
  cake_light_pink_double_oven:       'subpkg_deco/images/cake/cake_light_pink_double_oven.png',
  cake_light_stand_mixer:            'subpkg_deco/images/cake/cake_light_stand_mixer.png',
  cake_light_pendant_macaron:        'subpkg_deco/images/cake/cake_light_pendant_macaron.png',
  cake_light_chocolate_fountain:     'subpkg_deco/images/cake/cake_light_chocolate_fountain.png',
  cake_orn_strawberry_stool_pair:    'subpkg_deco/images/cake/cake_orn_strawberry_stool_pair.png',
  cake_orn_wedding_cake_centerpiece: 'subpkg_deco/images/cake/cake_orn_wedding_cake_centerpiece.png',
  cake_orn_donut_cushion_pair:       'subpkg_deco/images/cake/cake_orn_donut_cushion_pair.png',
  cake_orn_teddy_baker:              'subpkg_deco/images/cake/cake_orn_teddy_baker.png',
  cake_wallart_menu_chalkboard:      'subpkg_deco/images/cake/cake_wallart_menu_chalkboard.png',
  cake_wallart_lollipop_clock:       'subpkg_deco/images/cake/cake_wallart_lollipop_clock.png',
  cake_garden_strawberry_arch:       'subpkg_deco/images/cake/cake_garden_strawberry_arch.png',

  // ---- 熟客主题家具（V2：单客人图鉴 100% 解锁；NB2+rembg+crop_trim；DECO_DEFS 中以 affinity_* id 注册）----
  affinity_student_desk:        'subpkg_deco/images/affinity/affinity_student_desk.png',
  affinity_worker_coffee_corner:'subpkg_deco/images/affinity/affinity_worker_coffee_corner.png',
  affinity_mom_balcony_rack:    'subpkg_deco/images/affinity/affinity_mom_balcony_rack.png',
  affinity_youth_book_rack:     'subpkg_deco/images/affinity/affinity_youth_book_rack.png',
  affinity_athlete_trophy_case: 'subpkg_deco/images/affinity/affinity_athlete_trophy_case.png',
  affinity_celebrity_dressing_mirror: 'subpkg_deco/images/affinity/affinity_celebrity_dressing_mirror.png',
  // ---- 赛季限定大件家具（V2 全集大奖；S1：初春繁花季招牌灯箱）----
  affinity_season_s1_signlight: 'subpkg_deco/images/affinity/affinity_season_s1_signlight.png',
  // ---- 清涟荷影主题家具 ----
  qinglian_flower_cart: 'subpkg_deco/images/furniture/qinglian_flower_cart.png',
  qinglian_cloud_rug: 'subpkg_deco/images/furniture/qinglian_cloud_rug.png',
  qinglian_koi_bench: 'subpkg_deco/images/furniture/qinglian_koi_bench.png',
  qinglian_lotus_screen: 'subpkg_deco/images/furniture/qinglian_lotus_screen.png',
  qinglian_lotus_lamp: 'subpkg_deco/images/furniture/qinglian_lotus_lamp.png',
  qinglian_lotus_pond_table: 'subpkg_deco/images/furniture/qinglian_lotus_pond_table.png',
  qinglian_tea_shelf: 'subpkg_deco/images/furniture/qinglian_tea_shelf.png',
  qinglian_lantern_frame: 'subpkg_deco/images/furniture/qinglian_lantern_frame.png',
  qinglian_scholar_rock: 'subpkg_deco/images/furniture/qinglian_scholar_rock.png',
  qinglian_guqin_stand: 'subpkg_deco/images/furniture/qinglian_guqin_stand.png',
  qinglian_bamboo_window: 'subpkg_deco/images/furniture/qinglian_bamboo_window.png',
  qinglian_wisteria_vanity: 'subpkg_deco/images/furniture/qinglian_wisteria_vanity.png',
  qinglian_cloud_book_desk: 'subpkg_deco/images/furniture/qinglian_cloud_book_desk.png',
  qinglian_moon_shelf: 'subpkg_deco/images/furniture/qinglian_moon_shelf.png',
  qinglian_peony_screen: 'subpkg_deco/images/furniture/qinglian_peony_screen.png',
  qinglian_cherry_wardrobe: 'subpkg_deco/images/furniture/qinglian_cherry_wardrobe.png',
  qinglian_silk_daybed: 'subpkg_deco/images/furniture/qinglian_silk_daybed.png',
  qinglian_lotus_canopy_bed: 'subpkg_deco/images/furniture/qinglian_lotus_canopy_bed.png',

  // ---- 花间珠匣活动奖励家具 ----
  event_jewelry_back_sofa: 'subpkg_deco/images/furniture/event_jewelry_back_sofa.png',
  event_jewelry_empty_tea_table: 'subpkg_deco/images/furniture/event_jewelry_empty_tea_table.png',

  // ---- 房间背景 ----
  /** 花坊默认房壳 v3 试看（原 soft 图保留不删，验收后可改回或覆盖） */
  bg_room_default: 'subpkg_deco/images/house/bg_room_default_flower_shop_v3_nb2.png',
  /** 蝴蝶小屋默认房壳（正式路径；preview/ 旧副本保留供现网 CDN，后续再删） */
  bg_room_butterfly_house_nb2: 'subpkg_deco/images/house/bg_room_butterfly_house_nb2.png',
  bg_room_butterfly_house_moon_nb2: 'subpkg_deco/images/house/bg_room_butterfly_house_moon_nb2.png',
  bg_room_butterfly_house_bamboo_nb2: 'subpkg_deco/images/house/bg_room_butterfly_house_bamboo_nb2.png',
  /** 蝴蝶小屋 — 仙气 pastel 茶寮风替换房壳（布局同默认壳） */
  bg_room_butterfly_house_xianqi_nb2: 'subpkg_deco/images/house/bg_room_butterfly_house_xianqi_nb2.png',
  /** 茶香小院默认房壳 — 仙气 pastel 双层茶寮 */
  bg_room_tea_house_xianqi_two_story_nb2: 'subpkg_deco/images/house/bg_room_tea_house_xianqi_two_story_nb2.png',
  /** 茶香小院 — 深色红木双层茶寮 cutaway 空壳 */
  bg_room_tea_house_darkwood_two_story_nb2: 'subpkg_deco/images/house/bg_room_tea_house_darkwood_two_story_nb2.png',
  /** 橡树小屋 — 童话森林双层树屋 cutaway 空壳 */
  bg_room_forest_treehouse_oak_nb2: 'subpkg_deco/images/house/bg_room_forest_treehouse_oak_nb2.png',
  bg_room_forest_treehouse_spring_bloom_nb2: 'subpkg_deco/images/house/bg_room_forest_treehouse_spring_bloom_nb2.png',
  /** 梦云小屋 — 云朵双层 cutaway 空壳（支线场景默认壳） */
  bg_room_dream_cloud_two_story_nb2: 'subpkg_deco/images/house/bg_room_dream_cloud_two_story_nb2.png',
  bg_room_dream_cloud_blue_concept_nb2: 'subpkg_deco/images/house/bg_room_dream_cloud_blue_concept_nb2.png',
  bg_room_dream_cloud_purple_mooncradle_nb2: 'subpkg_deco/images/house/bg_room_dream_cloud_purple_mooncradle_nb2.png',
  /** 花田农舍 — 单层暖木农舍 cutaway 空壳 */
  /** 花田农舍 — 日光户外小院 cutaway 空壳（默认） */
  bg_room_flower_farm_courtyard_sunny_nb2: 'subpkg_deco/images/house/bg_room_flower_farm_courtyard_sunny_nb2.png',
  /** 花田农舍 — 旧版室内暖木壳（保留备用） */
  bg_room_flower_farm_cottage_nb2: 'subpkg_deco/images/house/bg_room_flower_farm_cottage_nb2.png',
  bg_room_flower_farm_spring_vine_nb2: 'subpkg_deco/images/house/bg_room_flower_farm_spring_vine_nb2.png',
  /** 花园别墅 — 宽景分层西式洋房 cutaway 空壳 */
  bg_room_garden_villa_loft_nb2: 'subpkg_deco/images/house/bg_room_garden_villa_loft_nb2.png',
  /** 花园别墅 — 旧版木骨双层洋房（保留备用） */
  bg_room_garden_villa_manor_nb2: 'subpkg_deco/images/house/bg_room_garden_villa_manor_nb2.png',
  /** 蛋糕房 — 现代 pastel 甜品店 cutaway 空壳（正式路径；preview/ 旧副本保留供现网 CDN） */
  bg_room_cake_shop_modern_nb2: 'subpkg_deco/images/house/bg_room_cake_shop_modern_nb2.png',
  /** 蛋糕房 — 蓝莓薄荷 pastel 甜品店 cutaway 空壳 */
  bg_room_cake_shop_blueberry_mint_nb2: 'subpkg_deco/images/house/bg_room_cake_shop_blueberry_mint_nb2.png',
  /** 糖果花坊 v2 试看（原 candy 图保留不删，验收后可改回或覆盖） */
  bg_room_candy_nb2: 'subpkg_deco/images/house/bg_room_candy_nb2_v2_nb2.png',
  bg_room_bloom_nb2: 'subpkg_deco/images/house/bg_room_bloom_nb2.png',
  /** 海岛汽水 v2 试看（原 lagoon 图保留不删，验收后可改回或覆盖） */
  bg_room_lagoon_nb2: 'subpkg_deco/images/house/bg_room_lagoon_nb2_v2_nb2.png',
  bg_room_confetti_nb2: 'subpkg_deco/images/house/bg_room_confetti_nb2.png',
  bg_room_qinglian_lotus_shop_nb2: 'subpkg_deco/images/house/bg_room_qinglian_lotus_shop_nb2.png',
  bg_room_pinkblue_nb2: 'subpkg_deco/images/house/bg_room_pinkblue_nb2.png',
};

// ================================================================
// 启动关键资源：随主包保底，不走 CDN；避免新号首进弱网时新手图/基础头像空白
// ================================================================
const CRITICAL_IMAGE_MAP: Record<string, string> = {
  tutorial_story_1: 'images/tutorial/story_1.png',
  tutorial_hand_pointer: 'images/tutorial/tutorial_hand_pointer.png',

  owner_chibi_default: 'images/critical/owner/chibi_default.png',
  owner_full_default: 'images/critical/owner/full_default.png',
  owner_full_default_blink: 'images/critical/owner/full_default_eyesclosed.png',

  customer_child: 'images/critical/customer/child.png',
  customer_student: 'images/critical/customer/student.png',
};

/** 合并后的完整映射（用于统一查询） */
const IMAGE_MAP: Record<string, string> = {
  ...MAIN_IMAGE_MAP,
  ...CHARS_IMAGE_MAP,
  ...PANELS_IMAGE_MAP,
  ...ITEMS_IMAGE_MAP,
  ...EVENTS_IMAGE_MAP,
  ...DECO_IMAGE_MAP,
  ...CRITICAL_IMAGE_MAP,
};

const SHOP_WARMUP_KEYS = [
  'house_bg',
  'house_bg_dream_cloud_sky_nb2',
  'house_bg_flower_farm_fields_nb2',
  'house_shop',
  'owner_full_default',
  'owner_full_default_blink',
  'shop_edit_deco_btn_nb2',
  'furniture_tray_panel_shell_v3_thin_pink_nb2',
  'furniture_tray_tab_flower_room_idle',
  'furniture_tray_tab_furniture_idle',
  'furniture_tray_tab_appliance_idle',
  'furniture_tray_tab_ornament_idle',
  'furniture_tray_tab_wallart_idle',
  'furniture_tray_tab_garden_idle',
  'furniture_tray_tab_room_styles_idle',
  'furniture_tray_tab_qinglian_idle',
  'furniture_edit_clear_icon_nb2',
  'furniture_edit_complete_icon_nb2',
  'icon_worldmap_nav',
  'icon_wishing_nav',
  'icon_weekend_huayuan_boost_nb2',
  'icon_jewelry_event_nb2',
] as const;

const DECO_PANEL_WARMUP_KEYS = [
  'decoration_panel_shell_nb2',
  'deco_nb2_close_btn_1x1',
  'deco_card_btn_1',
  'deco_card_btn_2',
  'deco_card_btn_3',
  'deco_card_btn_4',
  'deco_rarity_tag_common',
  'deco_rarity_tag_fine',
  'furniture_tray_tab_qinglian_idle',
] as const;

const CHECKIN_PANEL_KEYS = [
  'checkin_title_banner',
  'checkin_milestone_panel',
  'checkin_card_future',
  'checkin_card_today',
  'checkin_card_signed',
  'checkin_card_day7',
  'checkin_milestone_gift_1',
  'checkin_milestone_gift_2',
  'checkin_milestone_gift_3',
  'checkin_milestone_gift_4',
  'deco_card_btn_2',
  'deco_card_btn_3',
  'icon_energy',
  'icon_gem',
  'checkin_m1_bunny_ac',
  'checkin_m1_crystal_partition',
  'checkin_m1_moon_display_arch',
  'checkin_m1_butterfly_wall_lamp',
  'checkin_m1_rocking_horse',
] as const;

const TUTORIAL_DECO_KEYS = [
  'house_bg',
  'house_shop',
  'shelf_wood',
  'decoration_panel_shell_nb2',
  'deco_nb2_close_btn_1x1',
  'deco_card_btn_1',
  'deco_card_btn_2',
  'deco_card_btn_3',
  'deco_card_btn_4',
  'deco_rarity_tag_common',
  'deco_rarity_tag_fine',
  'furniture_tray_panel_shell_nb2',
  'furniture_tray_panel_shell_v3_thin_pink_nb2',
  'furniture_tray_tab_flower_room_idle',
  'furniture_tray_tab_furniture_idle',
  'furniture_tray_tab_ornament_idle',
  'furniture_tray_tab_garden_idle',
  'furniture_tray_tab_qinglian_idle',
  'furniture_edit_clear_icon_nb2',
  'furniture_edit_complete_icon_nb2',
  'ui_order_check_badge',
  'room_edit_toolbar_zoom_in',
  'room_edit_toolbar_zoom_out',
  'room_edit_toolbar_flip',
  'room_edit_toolbar_remove',
] as const;

/** 大地图节点用到的缩略图须在此列表：否则 open 前 preload 不等人齐，首帧易落成五边形占位 */
const WORLDMAP_WARMUP_KEYS = [
  'worldmap_bg',
  'worldmap_house_flower_shop',
  'worldmap_thumb_butterfly_house',
  'worldmap_thumb_cake_shop',
  'worldmap_thumb_garden_villa',
  'worldmap_thumb_tea_house',
  'worldmap_thumb_forest_treehouse',
  'worldmap_thumb_dream_cloud_house',
  'worldmap_thumb_flower_farm_house',
  'worldmap_thumb_wishing_fountain_1',
  'worldmap_thumb_wishing_fountain_2',
  'icon_worldmap',
] as const;

const QUEST_PANEL_KEYS = [
  'daily_challenge_panel_shell_nb2',
  'daily_challenge_task_area_nb2',
  'daily_challenge_task_row_textured_nb2',
  'daily_challenge_weekly_rail_empty_nb2',
  'daily_challenge_countdown_stopwatch_nb2',
  'daily_challenge_ui_F_dot',
  'deco_card_btn_3',
  'icon_energy',
  'icon_gem',
  'icon_huayuan',
] as const;

const COLLECTION_PANEL_KEYS = [
  'collection_panel_shell_nb2',
  'collection_item_placeholder_nb2',
  'warehouse_close_btn',
  'ui_order_check_badge',
] as const;

const FURNITURE_WORKSHOP_PANEL_KEYS = [
  'furniture_workshop_panel_shell_nb2',
  'furniture_workshop_blueprint_shop_shell_nb2',
  'icon_workshop_material',
  'icon_workshop_dye_pink',
  'icon_workshop_dye_yellow',
  'icon_workshop_dye_blue',
  'icon_workshop_dye_green',
  'icon_furniture_workshop',
  'icon_workshop_blueprint_scroll',
  'workshop_blueprint_generic',
  'icon_gem',
] as const;

const AFFINITY_PANEL_KEYS = [
  'affinity_card_back_default',
  'affinity_codex_overview_shell_nb2',
  'affinity_codex_detail_shell_nb2',
  'warehouse_slot_lock',
  'ui_order_check_badge',
] as const;

const WAREHOUSE_PANEL_KEYS = [
  'warehouse_panel_bg',
  'warehouse_close_btn',
  'warehouse_slot_lock',
  'icon_gem',
] as const;

const MERGE_CHAIN_PANEL_KEYS = [
  'merge_chain_panel',
  'merge_chain_ribbon',
  'warehouse_close_btn',
  'ui_cell_selection_corners',
  'item_info_title_ribbon',
] as const;

const DRESSUP_PANEL_KEYS = [
  'dressup_panel_shell_nb2',
  'deco_card_btn_1',
  'deco_card_btn_2',
  'deco_card_btn_3',
  'owner_chibi_default',
  'owner_full_default',
  'owner_full_default_blink',
  'icon_star',
  'icon_huayuan',
] as const;

const MERCH_SHOP_PANEL_KEYS = [
  'shop_merch_panel_frame',
  'shop_section_panel_bg',
  'shop_item_slot',
  'deco_card_btn_3',
  'icon_gem',
] as const;

const WEEKEND_HUAYUAN_BOOST_PANEL_KEYS = [
  'weekend_huayuan_boost_promo_panel_nb2',
] as const;

const NEWBIE_GIFT_PANEL_KEYS = [
  'newbie_gift_qinglian_promo_panel_nb2',
  'icon_coin',
  'icon_crystal_ball',
  'icon_golden_scissors',
  'bg_room_qinglian_lotus_shop_nb2',
  'qinglian_flower_cart',
  'qinglian_cloud_rug',
  'qinglian_koi_bench',
  'qinglian_lotus_screen',
  'qinglian_lotus_lamp',
  'qinglian_lotus_pond_table',
  'qinglian_tea_shelf',
  'qinglian_lantern_frame',
  'qinglian_scholar_rock',
  'qinglian_guqin_stand',
] as const;

const FLOWER_SIGN_GACHA_PANEL_KEYS = [
  'flower_sign_gacha_scene_nb2',
  'icon_flower_sign_coin',
  'deco_panel_title_ribbon',
  'deco_card_btn_1',
] as const;

function uniqueKeys(...groups: readonly (readonly string[])[]): string[] {
  const set = new Set<string>();
  groups.forEach(group => group.forEach(key => set.add(key)));
  return Array.from(set);
}

function keysWhere(map: Record<string, string>, predicate: (key: string, path: string) => boolean): string[] {
  return Object.keys(map).filter(key => predicate(key, map[key]));
}

const ALL_MAIN_KEYS = Object.keys(MAIN_IMAGE_MAP);
const ALL_CHARS_KEYS = Object.keys(CHARS_IMAGE_MAP);
const ALL_PANELS_KEYS = Object.keys(PANELS_IMAGE_MAP);
const ALL_ITEMS_KEYS = Object.keys(ITEMS_IMAGE_MAP);
const ALL_EVENTS_KEYS = Object.keys(EVENTS_IMAGE_MAP);
const JEWELRY_BOX_EVENT_KEYS = Object.keys(JEWELRY_BOX_EVENT_IMAGE_MAP);
const ALL_DECO_KEYS = Object.keys(DECO_IMAGE_MAP);
const ALL_CRITICAL_KEYS = Object.keys(CRITICAL_IMAGE_MAP);
const OWNER_OUTFIT_KEYS = keysWhere(CHARS_IMAGE_MAP, key => key.startsWith('owner_'));
const CUSTOMER_KEYS = keysWhere(CHARS_IMAGE_MAP, key => key.startsWith('customer_'));
const AFFINITY_CARD_KEYS = keysWhere(CHARS_IMAGE_MAP, key => key.startsWith('affinity_card_'));
const WORLDMAP_KEYS = keysWhere(PANELS_IMAGE_MAP, key => key.startsWith('worldmap_') || key === 'icon_worldmap');

export type TextureAssetGroup =
  | 'shop'
  | 'deco'
  | 'checkin'
  | 'tutorialDeco'
  | 'worldmap'
  | 'quest'
  | 'collection'
  | 'furnitureWorkshop'
  | 'affinity'
  | 'warehouse'
  | 'mergeChain'
  | 'dressup'
  | 'merchShop'
  | 'flowerSignGacha'
  | 'weekendHuayuanBoost'
  | 'newbieGiftPack'
  | 'main'
  | 'items'
  | 'events'
  | 'jewelryBoxEvent'
  | 'chars'
  | 'panels'
  | 'critical'
  | 'ownerOutfits'
  | 'affinityCards'
  | 'customers';

const ASSET_GROUP_KEYS: Record<TextureAssetGroup, readonly string[]> = {
  shop: SHOP_WARMUP_KEYS,
  deco: DECO_PANEL_WARMUP_KEYS,
  checkin: CHECKIN_PANEL_KEYS,
  tutorialDeco: TUTORIAL_DECO_KEYS,
  worldmap: WORLDMAP_WARMUP_KEYS,
  quest: QUEST_PANEL_KEYS,
  collection: COLLECTION_PANEL_KEYS,
  furnitureWorkshop: FURNITURE_WORKSHOP_PANEL_KEYS,
  affinity: AFFINITY_PANEL_KEYS,
  warehouse: WAREHOUSE_PANEL_KEYS,
  mergeChain: MERGE_CHAIN_PANEL_KEYS,
  dressup: DRESSUP_PANEL_KEYS,
  merchShop: MERCH_SHOP_PANEL_KEYS,
  flowerSignGacha: FLOWER_SIGN_GACHA_PANEL_KEYS,
  weekendHuayuanBoost: WEEKEND_HUAYUAN_BOOST_PANEL_KEYS,
  newbieGiftPack: NEWBIE_GIFT_PANEL_KEYS,
  main: [],
  items: [],
  events: [],
  jewelryBoxEvent: JEWELRY_BOX_EVENT_KEYS,
  chars: [],
  panels: [],
  critical: [],
  ownerOutfits: [],
  affinityCards: [],
  customers: [],
};

const ASSET_GROUP_NOTIFY_KEYS: Record<TextureAssetGroup, readonly string[]> = {
  ...ASSET_GROUP_KEYS,
  main: ALL_MAIN_KEYS,
  items: ALL_ITEMS_KEYS,
  events: ALL_EVENTS_KEYS,
  jewelryBoxEvent: JEWELRY_BOX_EVENT_KEYS,
  chars: ALL_CHARS_KEYS,
  panels: ALL_PANELS_KEYS,
  critical: ALL_CRITICAL_KEYS,
  ownerOutfits: OWNER_OUTFIT_KEYS,
  affinityCards: AFFINITY_CARD_KEYS,
  customers: CUSTOMER_KEYS,
  shop: uniqueKeys(SHOP_WARMUP_KEYS, ALL_DECO_KEYS, OWNER_OUTFIT_KEYS, WORLDMAP_KEYS),
  // 装修面板里的卡片、房间风格、房间预览都来自 DECO_IMAGE_MAP。
  // 预加载仍保持轻量；但刷新通知必须覆盖全量 deco 图，避免 CDN 图下载完后 UI 不重绘。
  deco: uniqueKeys(DECO_PANEL_WARMUP_KEYS, ALL_DECO_KEYS, ALL_ITEMS_KEYS),
  tutorialDeco: uniqueKeys(TUTORIAL_DECO_KEYS, ALL_DECO_KEYS, ALL_ITEMS_KEYS),
  worldmap: uniqueKeys(WORLDMAP_WARMUP_KEYS, WORLDMAP_KEYS),
  quest: uniqueKeys(QUEST_PANEL_KEYS, ALL_ITEMS_KEYS, ALL_DECO_KEYS),
  collection: uniqueKeys(COLLECTION_PANEL_KEYS, ALL_ITEMS_KEYS),
  furnitureWorkshop: uniqueKeys(FURNITURE_WORKSHOP_PANEL_KEYS, ALL_DECO_KEYS),
  affinity: uniqueKeys(AFFINITY_PANEL_KEYS, AFFINITY_CARD_KEYS, CUSTOMER_KEYS, ALL_DECO_KEYS, ALL_ITEMS_KEYS),
  warehouse: uniqueKeys(WAREHOUSE_PANEL_KEYS, ALL_ITEMS_KEYS),
  mergeChain: uniqueKeys(MERGE_CHAIN_PANEL_KEYS, ALL_ITEMS_KEYS),
  dressup: uniqueKeys(DRESSUP_PANEL_KEYS, OWNER_OUTFIT_KEYS),
  merchShop: uniqueKeys(MERCH_SHOP_PANEL_KEYS, ALL_ITEMS_KEYS),
  flowerSignGacha: uniqueKeys(FLOWER_SIGN_GACHA_PANEL_KEYS, ALL_ITEMS_KEYS, ALL_DECO_KEYS),
  weekendHuayuanBoost: [...WEEKEND_HUAYUAN_BOOST_PANEL_KEYS],
  newbieGiftPack: uniqueKeys(NEWBIE_GIFT_PANEL_KEYS, ALL_DECO_KEYS, ALL_ITEMS_KEYS),
};

const TEXTURE_LOADED_EVENT = 'texture:loaded';

export interface TextureDependencySpec {
  groups?: readonly TextureAssetGroup[];
  keys?: readonly string[];
}

class TextureCacheClass {
  private _cache = new Map<string, PIXI.Texture>();
  private _loading = new Map<string, Promise<void>>();
  private _failed = new Set<string>();
  private _decoLoaded = false;
  private _itemsLoaded = false;
  private _eventsLoaded = false;
  private _charsLoaded = false;
  private _panelsLoaded = false;
  /** 分包加载去重：同一分包并发加载时复用同一 Promise，避免重复 wx.loadSubpackage 冲突。 */
  private _subpackageLoads = new Map<string, Promise<void>>();
  private _loadedSubpackages = new Set<string>();
  /** 纹理加载失败后的有限次自动重试：保证瞬时失败（分包未就绪 / CDN 抖动）最终能加载并发出 texture:loaded 触发自动刷新。 */
  private _retryCounts = new Map<string, number>();
  private _retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly MAX_TEXTURE_RETRY = 5;

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
   * 启动关键资源：主包 UI + 新手故事 + 默认店主/基础客人。
   * 这些资源不依赖 CDN，必须在进入教程/主场景前可用。
   */
  preloadCritical(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const criticalTotal = Object.keys(MAIN_IMAGE_MAP).length + Object.keys(CRITICAL_IMAGE_MAP).length;
    let loaded = 0;
    const report = () => {
      loaded++;
      onProgress?.(loaded, criticalTotal);
    };

    return this.preloadMain(() => report())
      .then(() => this._preloadImageMap(CRITICAL_IMAGE_MAP, 'critical', () => report()))
      .then(() => {
        console.log(`[TextureCache] 启动关键资源预加载完成: ${loaded}/${criticalTotal}`);
      });
  }

  /** 预加载 chars 图片；当前配置下走 CDN，非 CDN 配置才会加载微信分包。 */
  loadCharsSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._charsLoaded) {
      return this._preloadImageMap(CHARS_IMAGE_MAP, 'chars', onProgress);
    }

    if (CdnAssetService.areAllCdnPaths(Object.values(CHARS_IMAGE_MAP))) {
      this._charsLoaded = true;
      return this._preloadImageMap(CHARS_IMAGE_MAP, 'chars-cdn', onProgress);
    }

    return this._loadSubpackage('chars').then(() => {
      this._charsLoaded = true;
      return this._preloadImageMap(CHARS_IMAGE_MAP, 'chars', onProgress);
    });
  }

  /** 预加载 panels 图片；当前配置下走 CDN，非 CDN 配置才会加载微信分包。 */
  loadPanelsSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._panelsLoaded) {
      return this._preloadImageMap(PANELS_IMAGE_MAP, 'panels', onProgress);
    }

    if (CdnAssetService.areAllCdnPaths(Object.values(PANELS_IMAGE_MAP))) {
      this._panelsLoaded = true;
      return this._preloadImageMap(PANELS_IMAGE_MAP, 'panels-cdn', onProgress);
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

  /** 加载 events 分包；限时活动资源按 eventId 懒加载，避免进入主包或常驻 items。 */
  loadEventsSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._eventsLoaded) {
      return this._preloadImageMap(EVENTS_IMAGE_MAP, 'events', onProgress);
    }

    return this._loadSubpackage('events').then(() => {
      this._eventsLoaded = true;
      return this._preloadImageMap(EVENTS_IMAGE_MAP, 'events', onProgress);
    });
  }

  /** 预加载 deco 图片；当前配置下走 CDN，非 CDN 配置才会加载微信分包。 */
  loadDecoSubpackage(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this._decoLoaded) {
      return this._preloadImageMap(DECO_IMAGE_MAP, 'deco', onProgress);
    }

    if (CdnAssetService.areAllCdnPaths(Object.values(DECO_IMAGE_MAP))) {
      this._decoLoaded = true;
      return this._preloadImageMap(DECO_IMAGE_MAP, 'deco-cdn', onProgress);
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
    const totalKeys = Object.keys(MAIN_IMAGE_MAP).length
      + Object.keys(CRITICAL_IMAGE_MAP).length
      + Object.keys(ITEMS_IMAGE_MAP).length;
    let globalLoaded = 0;

    const wrapProgress = () => {
      globalLoaded++;
      onProgress?.(globalLoaded, totalKeys);
    };

    return this.preloadCritical(() => wrapProgress())
      .then(() => this.loadItemsSubpackage(() => wrapProgress()))
      .then(() => {
        console.log(`[TextureCache] 启动预加载完成: ${this._cache.size}/${totalKeys} 张关键纹理`);
      });
  }

  /** 按 key 预热资源；用于场景/面板打开前的 CDN 懒加载补齐 */
  preloadKeys(
    keys: readonly string[],
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    const total = keys.length;
    let loaded = 0;
    const jobs = keys.map(key => {
      const path = IMAGE_MAP[key];
      if (!path) {
        loaded++;
        onProgress?.(loaded, total);
        return Promise.resolve();
      }
      return this._loadTexture(key, path).then(() => {
        loaded++;
        onProgress?.(loaded, total);
      });
    });

    return Promise.all(jobs).then(() => undefined);
  }

  /** 严格预加载：Promise 完成时必须已经进入 TextureCache，否则向调用方暴露失败。 */
  preloadKeysStrict(keys: readonly string[], label = 'assets'): Promise<void> {
    return this.preloadKeys(keys).then(() => {
      const missing = keys.filter(key => IMAGE_MAP[key] && !this._cache.has(key));
      if (missing.length > 0) {
        throw new Error(`${label} missing textures: ${missing.join(', ')}`);
      }
    });
  }

  /** 场景级后台预热，不应阻塞启动；失败只记录警告 */
  preloadSceneWarmup(scene: TextureAssetGroup): Promise<void> {
    const keys = ASSET_GROUP_KEYS[scene] || [];
    return this.preloadKeys(keys).catch(err => {
      console.warn(`[TextureCache] ${scene} 场景预热失败:`, err);
    });
  }

  /** 花店首屏必须资源：切场景前等待，避免真机首次进入时背景/房壳空白。 */
  preloadShopScene(): Promise<void> {
    return this.preloadKeysStrict(SHOP_WARMUP_KEYS, 'shop');
  }

  /** 面板打开前的统一资源确保入口。 */
  preloadPanelAssets(panel: TextureAssetGroup): Promise<void> {
    return this.preloadSceneWarmup(panel);
  }

  /** 活动打开前的统一预加载入口；同一 events 分包可承载多个活动目录。 */
  preloadEventAssets(eventId: string, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const imageMap = EVENT_IMAGE_MAPS[eventId];
    if (!imageMap) {
      console.warn(`[TextureCache] 未注册活动资源: ${eventId}`);
      return Promise.resolve();
    }
    const load = this._eventsLoaded
      ? Promise.resolve()
      : this._loadSubpackage('events').then(() => {
        this._eventsLoaded = true;
      });
    return load.then(() => this._preloadImageMap(imageMap, `event:${eventId}`, onProgress));
  }

  /** 活动页首屏关键资源预热；避免打开页面时与整套活动图标并发抢加载。 */
  preloadEventKeys(eventId: string, keys: readonly string[], onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const imageMap = EVENT_IMAGE_MAPS[eventId];
    if (!imageMap) {
      console.warn(`[TextureCache] 未注册活动资源: ${eventId}`);
      return Promise.resolve();
    }
    const validKeys = keys.filter(key => !!imageMap[key]);
    if (validKeys.length === 0) return Promise.resolve();
    const load = this._eventsLoaded
      ? Promise.resolve()
      : this._loadSubpackage('events').then(() => {
        this._eventsLoaded = true;
      });
    return load.then(() => this.preloadKeys(validKeys, onProgress));
  }

  /** 顶栏内购商店必须资源：打开前严格等待，避免 CDN 首次下载时显示空壳。 */
  preloadMerchShopPanel(): Promise<void> {
    return this.preloadKeysStrict(MERCH_SHOP_PANEL_KEYS, 'merchShop');
  }

  /** 清涟荷影新手礼包：仅预加载面板壳 + 预览图，勿拉全量 deco/items/panels 分包。 */
  preloadNewbieGiftPackPanel(): Promise<void> {
    return this.preloadKeysStrict(NEWBIE_GIFT_PANEL_KEYS, 'newbieGiftPack');
  }

  preloadCheckIn(): Promise<void> {
    return this.preloadPanelAssets('checkin');
  }

  /** 新手装修链路必须资源：购买卡片、目标家具、放置托盘。 */
  preloadTutorialDeco(): Promise<void> {
    return this.preloadKeysStrict(TUTORIAL_DECO_KEYS, 'tutorialDeco');
  }

  /** 获取已缓存的纹理（支持家具合图子帧与 icon 别名） */
  get(key: string): PIXI.Texture | null {
    const alias = FURNITURE_ICON_ALIASES.get(key);
    if (alias) {
      const framed = this._getFurnitureAtlasFrame(alias);
      if (framed) return framed;
    }

    const frameMatch = /^(.+)#(\d+),(\d+)$/.exec(key);
    if (frameMatch) {
      const sheetKey = frameMatch[1]!;
      const col = Number(frameMatch[2]);
      const row = Number(frameMatch[3]);
      const atlas = FURNITURE_RENDER_DEFS.find(d => d.atlas?.sheetKey === sheetKey)?.atlas;
      if (atlas) {
        return this._getFurnitureAtlasFrame({
          sheetKey,
          col,
          row,
          columns: atlas.columns,
          rows: atlas.rows,
        });
      }
    }

    const cached = this._cache.get(key);
    if (cached) return cached;

    const path = IMAGE_MAP[key];
    if (path && !this._loading.has(key) && !this._failed.has(key)) {
      void this._loadTexture(key, path);
    }
    return null;
  }

  private _getFurnitureAtlasFrame(ref: FurnitureAtlasFrameRef): PIXI.Texture | null {
    const frameKey = furnitureAtlasFrameKey(ref.sheetKey, ref.col, ref.row);
    const cached = this._cache.get(frameKey);
    if (cached) return cached;

    const sheet = this._cache.get(ref.sheetKey);
    if (!sheet?.valid) {
      const path = IMAGE_MAP[ref.sheetKey];
      if (path && !this._loading.has(ref.sheetKey) && !this._failed.has(ref.sheetKey)) {
        void this._loadTexture(ref.sheetKey, path);
      }
      return null;
    }

    return this._sliceFurnitureAtlasFrame(ref);
  }

  private _sliceFurnitureAtlasFrame(ref: FurnitureAtlasFrameRef): PIXI.Texture {
    const frameKey = furnitureAtlasFrameKey(ref.sheetKey, ref.col, ref.row);
    const existing = this._cache.get(frameKey);
    if (existing) return existing;

    const sheet = this._cache.get(ref.sheetKey)!;
    const fw = Math.max(1, Math.floor(sheet.width / ref.columns));
    const fh = Math.max(1, Math.floor(sheet.height / ref.rows));
    const frame = new PIXI.Texture(
      sheet.baseTexture,
      new PIXI.Rectangle(ref.col * fw, ref.row * fh, fw, fh),
    );
    this._cache.set(frameKey, frame);
    EventBus.emit(TEXTURE_LOADED_EVENT, frameKey);
    for (const [aliasKey, aliasRef] of FURNITURE_ICON_ALIASES) {
      if (
        aliasRef.sheetKey === ref.sheetKey
        && aliasRef.col === ref.col
        && aliasRef.row === ref.row
      ) {
        EventBus.emit(TEXTURE_LOADED_EVENT, aliasKey);
      }
    }
    return frame;
  }

  private _materializeFurnitureSheetFrames(sheetKey: string): void {
    for (const def of FURNITURE_RENDER_DEFS) {
      const atlas = def.atlas;
      if (!atlas || atlas.sheetKey !== sheetKey) continue;
      for (let row = 0; row < atlas.rows; row++) {
        for (let col = 0; col < atlas.columns; col++) {
          this._sliceFurnitureAtlasFrame({
            sheetKey,
            col,
            row,
            columns: atlas.columns,
            rows: atlas.rows,
          });
        }
      }
    }
  }

  /** @deprecated 内部使用 get；保留兼容 */
  getTexture(key: string): PIXI.Texture | null {
    return this.get(key);
  }

  /** 判断纹理是否已经成功进入缓存；用于首屏资源重试与刷新判断。 */
  has(key: string): boolean {
    return this._cache.has(key);
  }

  /**
   * 获取可直接传给微信分享 imageUrl 的图片路径。
   * CDN 资源优先返回已下载缓存；未命中时返回本地分包逻辑路径。
   */
  async resolveImageUrl(key: string): Promise<string | null> {
    const path = IMAGE_MAP[key];
    if (!path) return null;
    try {
      return await CdnAssetService.resolveOrDownload(path);
    } catch (err) {
      console.warn(`[TextureCache] 分享图路径解析失败: ${key} (${path})`, err);
      return path;
    }
  }

  /** 订阅纹理加载完成；用于打开后的 UI 自动刷新。返回取消订阅函数。 */
  onTextureLoaded(handler: (key: string) => void): () => void {
    EventBus.on(TEXTURE_LOADED_EVENT, handler);
    return () => EventBus.off(TEXTURE_LOADED_EVENT, handler);
  }

  /** 订阅一组具体 key 的任意加载完成事件。 */
  onKeysLoaded(keys: readonly string[], handler: (key: string) => void): () => void {
    const keySet = new Set(keys);
    if (keySet.size === 0) return () => undefined;
    const onLoaded = (key: string): void => {
      if (keySet.has(key)) handler(key);
    };
    EventBus.on(TEXTURE_LOADED_EVENT, onLoaded);
    return () => EventBus.off(TEXTURE_LOADED_EVENT, onLoaded);
  }

  /** 订阅指定资源组中任意纹理完成，用于面板已打开时触发重绘。 */
  onAssetGroupLoaded(group: TextureAssetGroup, handler: () => void): () => void {
    const keys = new Set(ASSET_GROUP_NOTIFY_KEYS[group] || []);
    const onLoaded = (key: string): void => {
      if (keys.has(key)) handler();
    };
    EventBus.on(TEXTURE_LOADED_EVENT, onLoaded);
    return () => EventBus.off(TEXTURE_LOADED_EVENT, onLoaded);
  }

  /**
   * 统一观察资源依赖：资源组或动态 key 中任意纹理完成后，下一帧只刷新一次。
   * 用于已打开面板/常驻场景的「CDN 下载完自动重绘」。
   */
  observeTextureDependencies(spec: TextureDependencySpec, refresh: () => void): () => void {
    const keys = new Set<string>();
    spec.groups?.forEach(group => {
      (ASSET_GROUP_NOTIFY_KEYS[group] || []).forEach(key => keys.add(key));
    });
    spec.keys?.forEach(key => keys.add(key));
    if (keys.size === 0) return () => undefined;

    let raf: number | null = null;
    const onLoaded = (key: string): void => {
      if (!keys.has(key) || raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        refresh();
      });
    };
    EventBus.on(TEXTURE_LOADED_EVENT, onLoaded);
    return () => {
      EventBus.off(TEXTURE_LOADED_EVENT, onLoaded);
      raf = null;
    };
  }

  /** 预加载启动 Loading 底图 + 顶栏标题（先于 preloadAll） */
  preloadLoadingSplash(): Promise<void> {
    return Promise.all([
      this._loadTexture('loading_splash_run_to_shop_nb2', MAIN_IMAGE_MAP.loading_splash_run_to_shop_nb2),
      this._loadTexture('loading_title_cute_nb2', MAIN_IMAGE_MAP.loading_title_cute_nb2),
    ]).then(() => undefined);
  }

  /** 分包资源是否已加载 */
  get isDecoLoaded(): boolean {
    return this._decoLoaded;
  }

  /** items 分包是否已加载 */
  get isItemsLoaded(): boolean {
    return this._itemsLoaded;
  }

  get isEventsLoaded(): boolean {
    return this._eventsLoaded;
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
    // 已加载：直接通过
    if (this._loadedSubpackages.has(name)) return Promise.resolve();
    // 加载中：复用同一 Promise，避免并发重复调用 wx.loadSubpackage（重复任务可能互相冲突 / reject，
    // 进而污染本批纹理加载，导致活动图标卡在兜底绘制不刷新）。
    const inflight = this._subpackageLoads.get(name);
    if (inflight) return inflight;

    const promise = this._doLoadSubpackage(name).then(() => {
      this._loadedSubpackages.add(name);
      this._subpackageLoads.delete(name);
    }).catch(err => {
      // 失败后清掉缓存，允许后续重试
      this._subpackageLoads.delete(name);
      throw err;
    });
    this._subpackageLoads.set(name, promise);
    return promise;
  }

  private _doLoadSubpackage(name: string): Promise<void> {
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
          const errMsg = (err && (err.errMsg || err.message)) || '';
          let raw = '';
          try { raw = JSON.stringify(err); } catch (_) { raw = String(err); }
          console.error(`[TextureCache] ${name} 分包加载失败 errMsg=${errMsg} raw=${raw}`);
          reject(Object.assign(new Error(`loadSubpackage(${name}) 失败: ${errMsg || raw || 'unknown'}`), { raw: err }));
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
    const inflight = this._loading.get(key);
    if (inflight) return inflight;

    this._failed.delete(key);

    const promise = new Promise<void>((resolve) => {
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
        let retriedLocalSubpackage = false;
        const markFailed = (err?: any): void => {
          console.warn(`[TextureCache] 图片加载失败: ${key} (${path})`, err);
          this._failed.add(key);
          this._loading.delete(key);
          // 失败后排队有限次自动重试：分包资源（events/items）多因首屏时序竞态首次失败，
          // 重试可在分包就绪后加载成功并发出 texture:loaded，让兜底绘制自动刷成正常图。
          this._scheduleTextureRetry(key, path);
          resolve();
        };
        img.onload = () => {
          try {
            const baseTexture = PIXI.BaseTexture.from(img as any);
            const texture = new PIXI.Texture(baseTexture);
            this._cache.set(key, texture);
            if (FURNITURE_RENDER_DEFS.some(d => d.atlas?.sheetKey === key)) {
              this._materializeFurnitureSheetFrames(key);
            }
            this._retryCounts.delete(key);
            EventBus.emit(TEXTURE_LOADED_EVENT, key);
          } catch (e) {
            console.warn(`[TextureCache] 创建纹理失败: ${key}`, e);
            this._failed.add(key);
          }
          this._loading.delete(key);
          resolve();
        };
        img.onerror = (err: any) => {
          if (!retriedLocalSubpackage) {
            retriedLocalSubpackage = true;
            void this._ensureSubpackageForLocalFallback(path).then(ok => {
              if (ok) {
                img.src = path;
                return;
              }
              markFailed(err);
            }).catch(() => markFailed(err));
            return;
          }
          markFailed(err);
        };
        // 关键：本地分包资源（subpkg_events / subpkg_items）在设置 img.src 之前先确保分包已加载，
        // 避免「打开活动页同步 _refresh 抢先 get()，撞上 events 分包尚未就绪」的竞态——
        // 之前依赖 onerror 之后再补救，时序上仍会让原石 / 锁格首次失败。CDN 路径会瞬时跳过此步。
        const startLoad = async (): Promise<void> => {
          await this._ensureSubpackageForLocalFallback(path);
          const resolvedPath = await CdnAssetService.resolveOrDownload(path);
          img.src = resolvedPath;
        };
        void startLoad().catch((err) => {
          console.warn(`[TextureCache] 资源解析失败，尝试终止加载: ${key} (${path})`, err);
          this._failed.add(key);
          this._loading.delete(key);
          this._scheduleTextureRetry(key, path);
          resolve();
        });
      } catch (e) {
        console.warn(`[TextureCache] 加载异常: ${key}`, e);
        this._failed.add(key);
        this._loading.delete(key);
        resolve();
      }
    });
    this._loading.set(key, promise);
    return promise.finally(() => {
      this._loading.delete(key);
    });
  }

  /**
   * 失败纹理的有限次自动重试。瞬时失败（分包首屏未就绪、CDN 抖动）经重试后多能加载成功，
   * 加载成功会发出 texture:loaded，让 ItemView / 活动面板等订阅方把兜底绘制自动刷成正常图。
   */
  private _scheduleTextureRetry(key: string, path: string): void {
    if (this._cache.has(key)) return;
    if (this._retryTimers.has(key)) return;
    const attempts = this._retryCounts.get(key) ?? 0;
    if (attempts >= TextureCacheClass.MAX_TEXTURE_RETRY) return;
    const delay = 600 * (attempts + 1);
    const timer = setTimeout(() => {
      this._retryTimers.delete(key);
      if (this._cache.has(key)) return;
      this._retryCounts.set(key, attempts + 1);
      this._failed.delete(key);
      void this._loadTexture(key, path);
    }, delay);
    this._retryTimers.set(key, timer);
  }

  /**
   * 图片 onerror 时尝试加载微信分包后重试。
   * chars/panels/deco/audio 在 CdnConfig.cdnDirs 中，安装包不携带、game.json 也无对应分包，
   * 不得 loadSubpackage（必报 does not exist）；仅 items/events 等本地分包可走分包兜底。
   *
   * 注意：不要用 _itemsLoaded/_eventsLoaded 作为短路条件——标志位为 true 不代表该图片首次
   * img.src 没有因首屏时序竞态失败。统一再 ensure 一次即可（_loadSubpackage 已去重，已加载时瞬时返回），
   * 确保竞态失败的单张图仍能重试 img.src 加载成功。
   */
  private async _ensureSubpackageForLocalFallback(path: string): Promise<boolean> {
    const normalized = path.replace(/^\/+/, '').replace(/^minigame\//, '');
    if (CdnAssetService.isCdnPath(normalized)) {
      return false;
    }
    let subpackage: string | null = null;
    if (normalized.startsWith('subpkg_items/')) subpackage = 'items';
    else if (normalized.startsWith('subpkg_events/')) subpackage = 'events';
    if (!subpackage) return false;
    try {
      await this._loadSubpackage(subpackage);
      if (subpackage === 'items') this._itemsLoaded = true;
      else this._eventsLoaded = true;
      return true;
    } catch (err) {
      console.warn(`[TextureCache] ${subpackage} 分包加载失败，本地兜底不可用`, err);
      return false;
    }
  }
}

export const TextureCache = new TextureCacheClass();
