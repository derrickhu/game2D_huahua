/**
 * 首次合成「新解锁」弹窗文案（花语 / 物品短描述），与花语图鉴 32 张卡共用 quote。
 *
 * `getItemCollectionBlurb` 覆盖 ITEM_DEFS 中全部可合成物品；缺键时用兜底句（新物品上线时请补）。
 */

/** 花语图鉴可收集的 32 张卡（键与历史 FLOWER_QUOTES 一致） */
export const FLOWER_CARD_QUOTES: Record<string, { name: string; quote: string }> = {
  flower_fresh_1: { name: '花种子', quote: '纯真无邪，藏在心底的小美好。' },
  flower_fresh_2: { name: '花苞', quote: '沉默的爱，追随着你的光芒。' },
  flower_fresh_3: { name: '小雏菊', quote: '温馨的祝福，感恩每一份爱。' },
  flower_fresh_4: { name: '向日葵', quote: '甘愿做配角，只为衬托你的美。' },
  flower_fresh_5: { name: '康乃馨', quote: '缤纷世界，每一种美都值得。' },
  flower_fresh_6: { name: '玫瑰', quote: '最好的礼物，是用心准备的惊喜。' },
  flower_fresh_7: { name: '百合', quote: '百年好合，纯洁如初的心意。' },
  flower_fresh_8: { name: '郁金香', quote: '热烈的爱意，杯盏中盛放的春天。' },
  flower_fresh_9: { name: '绣球花', quote: '团聚与希望，团团圆圆的美好。' },
  flower_fresh_10: { name: '蝴蝶兰', quote: '幸福飞来，优雅如风。' },
  flower_fresh_11: { name: '荷花', quote: '出泥不染，心若清莲。' },
  flower_fresh_12: { name: '芍药', quote: '依依惜别，难舍的温柔。' },
  flower_fresh_13: { name: '金色牡丹', quote: '富贵吉祥，国色天香。' },
  flower_bouquet_1: { name: '手心小花束', quote: '三两朵小花扎在一起，心意刚刚发芽。' },
  flower_bouquet_2: { name: '糖纸迷你束', quote: '亮晶晶的糖纸一裹，连小花也有了礼物感。' },
  flower_bouquet_3: { name: '晴彩郁金香', quote: '红黄郁金香抬起头，把晴天抱进怀里。' },
  flower_bouquet_4: { name: '蜜粉玫瑰星', quote: '粉玫瑰层层绽开，满天星轻轻围在身旁。' },
  flower_bouquet_5: { name: '阳光田园束', quote: '向日葵、雏菊与小紫花，把花园的热闹捧成一束。' },
  flower_bouquet_6: { name: '缎带玫瑰礼束', quote: '香槟色包装托起玫瑰，缎带一系就有了仪式感。' },
  flower_green_1: { name: '小芽苗', quote: '小小的芽，蕴含着生命的力量。' },
  flower_green_2: { name: '铜钱草', quote: '圆圆铜钱叶，一汪清水里的好运气。' },
  flower_green_3: { name: '多肉盆栽', quote: '圆润饱满，安静而治愈。' },
  flower_green_4: { name: '绿萝', quote: '顽强生长，为你带来好运。' },
  flower_green_5: { name: '波士顿蕨', quote: '优雅的弧线，如绿色瀑布。' },
  flower_green_6: { name: '虎皮兰', quote: '坚韧挺拔，守护者的姿态。' },
  flower_green_7: { name: '龟背竹', quote: '独一无二的裂叶，大自然的艺术。' },
  flower_green_8: { name: '琴叶榕', quote: '大叶如琴，奏响一室绿意。' },
  flower_green_9: { name: '仙人掌', quote: '小小刺里，也藏着一朵温柔的勇气。' },
  flower_green_10: { name: '红掌', quote: '红烛高照，一片炽热心。' },
  flower_green_11: { name: '发财树', quote: '枝繁叶茂，财源滚滚来。' },
  flower_green_12: { name: '三角梅', quote: '热情奔放，阳光下的火焰。' },
  flower_green_13: { name: '松树盆景', quote: '岁寒长青，风骨自成。' },
};

export const FLOWER_CARD_TRACKED_TOTAL = Object.keys(FLOWER_CARD_QUOTES).length;

/** 其余物品：首次合成解锁弹窗专用短句（非花亦有一句物语） */
const ITEM_UNLOCK_BLURB_EXTRA: Record<string, string> = {
  flower_bouquet_7: '炽红玫瑰簇成大束，热烈得像一场告白。',
  flower_bouquet_8: '兰花与绣球铺开层次，少见的配色让花束更有记忆点。',
  flower_bouquet_9: '牡丹、银莲与金边相映，艳丽里藏着精致章法。',
  flower_bouquet_10: '紫色银莲与珊瑚花团簇拥金穗，艳丽里多了几分高级感。',
  flower_wrap_1: '细细一卷，捆住礼物的温柔。',
  flower_wrap_2: '为花束系上蝴蝶结的勇气。',
  flower_wrap_3: '把心意裹进色彩与折痕里。',
  flower_wrap_4: '包装纸与丝带备齐，下一步就能捧出花束。',

  drink_butterfly_1: '小小的起点，蠕动着对天空的向往。',
  drink_butterfly_2: '茧中静候，一场华丽的蜕变。',
  drink_butterfly_3: '白翼轻掠，像春信掠过窗台。',
  drink_butterfly_4: '柑橘香里，蝶影与阳光重叠。',
  drink_butterfly_5: '玉带当风，优雅掠过花影。',
  drink_butterfly_6: '青绿一闪，森林深处的精灵。',
  drink_butterfly_7: '金裳耀眼，贵气却不张扬。',
  drink_butterfly_8: '猫头鹰的纹，藏着夜的智慧。',
  drink_butterfly_9: '蓝闪如电，梦中那片热带雨。',
  drink_butterfly_10: '珍稀之翼，值得被温柔收藏。',

  drink_cold_1: '一口柠香，暑气退散。',
  drink_cold_2: '花果撞冰，夏天在舌尖开花。',
  drink_cold_3: '气泡升腾，像小花店的心跳。',
  drink_cold_4: '玫瑰与冰沙，甜得刚刚好。',
  drink_cold_5: '特调一杯，今日限定好心情。',
  drink_cold_6: '奶昔绵密，把云朵装进杯里。',
  drink_cold_7: '星空配色，喝得到晚风。',
  drink_cold_8: '极光入杯，浪漫封顶。',

  drink_dessert_1: '小小圆糕点上莓果，甜味刚刚冒头。',
  drink_dessert_2: '青提和奶油铺开，清爽颜色更醒目。',
  drink_dessert_3: '蜜桃铺成暖色圆顶，香甜感又厚了一层。',
  drink_dessert_4: '草莓围出红亮边，圆蛋糕开始像样登场。',
  drink_dessert_5: '香橙与奶油叠出亮色，盘里的存在感更足。',
  drink_dessert_6: '双果和夹层一起出现，层次终于变得分明。',
  drink_dessert_7: '什果铺满圆面，已经有了招牌蛋糕的样子。',
  drink_dessert_8: '双层蛋糕堆起缤纷果香，越看越想分享。',

  tool_plant_1: '翻土第一铲，故事从泥土开始。',
  tool_plant_2: '滋润根须，也滋润期待。',
  tool_plant_3: '一盘新绿，育苗人的小宇宙。',
  tool_plant_4: '仓里温湿，藏着下一场盛放。',
  tool_plant_5: '简易温室，给幼苗一个家。',
  tool_plant_6: '玻璃房里的四季，由你掌控。',
  tool_plant_7: '高级温室，专业玩家的浪漫。',

  tool_arrange_1: '铁丝定型，线条里都是耐心。',
  tool_arrange_2: '剪断多余，留下恰到好处的美。',
  tool_arrange_3: '小台一架，花束有了舞台。',
  tool_arrange_4: '包装台升级，效率与美感并存。',
  tool_arrange_5: '高级工位，指尖花艺的顶配。',

  tool_butterfly_net_1: '网眼初成，等待第一只访客。',
  tool_butterfly_net_2: '轻兜一握，别惊动花上的梦。',
  tool_butterfly_net_3: '柄短志长，近身捕捉微风。',
  tool_butterfly_net_4: '长柄探远，林缘花隙不放过。',
  tool_butterfly_net_5: '专业网面，收藏闪蝶的仪式感。',

  tool_mixer_1: '量杯见底，配方从零开始。',
  tool_mixer_2: '雪克一响，饮品有了节奏。',
  tool_mixer_3: '制冰机嗡鸣，夏天有了形状。',
  tool_mixer_4: '冰箱门开，清凉列队待命。',
  tool_mixer_5: '冰柜满仓，招待永不断供。',

  tool_bake_1: '擀面杖滚过，面团变得听话。',
  tool_bake_2: '烤盘排好位置，小点心准备进炉。',
  tool_bake_3: '小烤箱灯一亮，空气里就有甜香。',
  tool_bake_4: '双层烤箱上下同烤，甜品产能更稳了。',
  tool_bake_5: '高级烘焙炉火候精准，把甜点烤成招牌。',

  currency_stamina_1: '小口补给，再撑一会儿。',
  currency_stamina_2: '一罐元气，继续打理花田。',
  currency_stamina_3: '大桶能量，今日营业加满。',
  currency_stamina_4: '精粹一壶，干劲儿拉到最满。',

  currency_diamond_1: '碎光点点，也是小确幸。',
  currency_diamond_2: '整颗璀璨，值得好好规划。',
  currency_diamond_3: '大钻入账，心愿清单勾一项。',
  currency_diamond_4: '璨若星河，小店的高光时刻。',

  currency_huayuan_pickup_1: '小利是到，喜气沾一点。',
  currency_huayuan_pickup_2: '花愿渐丰，像盆土里蓄的力。',
  currency_huayuan_pickup_3: '大利是满，今日营业有彩头。',
  currency_huayuan_pickup_4: '豪礼封红，好运叠满一整格。',

  chest_1: '铜箱轻响，小惊喜在里头。',
  chest_2: '银辉一闪，奖励升了一档。',
  chest_3: '金光晃眼，今天手气不错。',
  chest_4: '钻石镶边，稀有度拉满。',
  chest_5: '传说封缄，开启需要一点勇气。',

  hongbao_1: '迎春红纸，图个开门红。',
  hongbao_2: '吉祥纹样，福气贴上门。',
  hongbao_3: '鸿运当头，拆开都是好意头。',
  hongbao_4: '福满一方，花愿与笑容同满。',

  diamond_bag_1: '碎钻轻响，积少成多。',
  diamond_bag_2: '布袋沉甸甸，闪亮装一袋。',
  diamond_bag_3: '锦袋系紧，大礼待拆。',

  stamina_chest_1: '元气小箱，开箱喘口气。',
  stamina_chest_2: '补给到位，还能再肝一轮。',
  stamina_chest_3: '澎湃满箱，体力如泉涌。',

  lucky_coin_1: '幸运翻面，下一格或许不同命。',
  crystal_ball_1: '水晶映线，看清成长的方向。',
  golden_scissors_1: '金刃一开，化一为二的智慧。',
};

const FALLBACK_BLURB = '每一次合成，都是花店故事里新的一页。';

export function getItemCollectionBlurb(itemId: string): string {
  const card = FLOWER_CARD_QUOTES[itemId];
  if (card) return card.quote;
  return ITEM_UNLOCK_BLURB_EXTRA[itemId] ?? FALLBACK_BLURB;
}
