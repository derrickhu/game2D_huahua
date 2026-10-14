/**
 * 编辑托盘小类筛选：按家具中文名关键词归到当前大类下的小类。
 *
 * 命中最长的关键词；都对不上的归最后的「其他」，保证每件家具都至少能在一个小类里找到。
 * 新家具不用登记，名字里带对应字即可自动归类。
 */
import type { DecoPanelTabId } from '@/config/DecorationConfig';

export interface TraySubCategory {
  id: string;
  label: string;
  keys: readonly string[];
}

export const TRAY_SUB_OTHER_ID = 'other';

const OTHER: TraySubCategory = { id: TRAY_SUB_OTHER_ID, label: '其他', keys: [] };

const SUBS: Partial<Record<DecoPanelTabId, readonly TraySubCategory[]>> = {
  furniture: [
    { id: 'table', label: '桌几', keys: ['桌', '几', '台', '书案', '柜台'] },
    { id: 'seat', label: '椅凳', keys: ['椅', '凳', '墩', '蒲团', '坐垫', '豆袋', '秋千'] },
    { id: 'sofa_bed', label: '沙发床', keys: ['沙发', '床', '榻', '躺椅', '猫窝', '软座', '窗座'] },
    { id: 'cabinet', label: '柜架', keys: ['柜', '架', '橱', '书塔', '衣帽'] },
    {
      id: 'bath',
      label: '厨卫',
      keys: ['浴缸', '浴盆', '马桶', '洗手台', '水池', '毛巾架', '洗衣篮', '晾衣架', '浴室', '厨柜', '橱柜', '中岛'],
    },
    { id: 'rug', label: '地毯', keys: ['地毯', '圆毯', '毯'] },
    OTHER,
  ],
  appliance: [
    { id: 'lamp', label: '灯具', keys: ['灯'] },
    {
      id: 'kitchen',
      label: '厨房',
      keys: ['冰箱', '冰柜', '烤箱', '烤炉', '灶', '水壶', '饮料机', '烤肠机', '冰淇淋机', '饮品'],
    },
    {
      id: 'life',
      label: '生活',
      keys: ['收音机', '电扇', '风扇', '加湿器', '洗衣机', '扫地机', '烘衣柜', '空调', '留声机'],
    },
    OTHER,
  ],
  ornament: [
    {
      id: 'plant',
      label: '花植',
      keys: ['盆', '仙人', '绿植', '蕨', '兰', '吊篮', '常春藤', '花园', '花瓶', '水培瓶', '折枝瓶', '陶瓶', '花纹瓶', '生态瓶', '花束'],
    },
    { id: 'plush', label: '玩偶', keys: ['玩偶', '抱枕', '玩具', '毛绒'] },
    { id: 'screen', label: '屏风', keys: ['屏风', '隔断', '浴屏'] },
    OTHER,
  ],
  wallart: [
    { id: 'window', label: '窗景', keys: ['窗'] },
    { id: 'curtain', label: '帘幔', keys: ['帘', '幔'] },
    { id: 'frame', label: '挂画', keys: ['画', '框', '挂轴', '浮雕', '标本'] },
    { id: 'light', label: '灯饰', keys: ['灯'] },
    { id: 'mirror_clock', label: '镜钟', keys: ['镜', '钟'] },
    { id: 'shelf', label: '壁架', keys: ['壁架', '洞洞板', '花箱'] },
    OTHER,
  ],
  garden: [
    { id: 'planter', label: '花台', keys: ['花架', '花台', '花箱', '花圃', '花瓮', '花廊', '花池'] },
    { id: 'water', label: '水景', keys: ['喷泉', '泳池', '池', '水钵', '桥'] },
    { id: 'tree', label: '树竹', keys: ['树', '樱', '竹'] },
    { id: 'leisure', label: '休闲', keys: ['秋千', '摇摇马', '帐篷', '遮阳伞', '凉亭'] },
    OTHER,
  ],
};

/** 当前大类的小类列表（不含「全部」）；没有小类时返回空数组 */
export function getTraySubCategories(tab: DecoPanelTabId): readonly TraySubCategory[] {
  return SUBS[tab] ?? [];
}

/** 家具名在该大类下归属的小类 id；大类没有小类时返回 null */
export function traySubCategoryOf(tab: DecoPanelTabId, displayName: string): string | null {
  const subs = SUBS[tab];
  if (!subs || subs.length === 0) return null;
  let best: string = TRAY_SUB_OTHER_ID;
  let bestLen = 0;
  for (const sub of subs) {
    for (const key of sub.keys) {
      if (key.length > bestLen && displayName.includes(key)) {
        best = sub.id;
        bestLen = key.length;
      }
    }
  }
  return best;
}
