/**
 * 特殊客人入场横幅：触发规则与各客人标志性台词。
 */
import type { OrderGenerationKind } from '@/orders/types';
import { CUSTOMER_TYPE_MAP } from './CustomerConfig';

export interface CustomerArrivalCopy {
  /** 横幅副标题，如「限时贵宾」 */
  subtitle?: string;
  /** 入场台词（随机一条） */
  arrivalLines: readonly string[];
}

/** 按 orderKind 触发横幅的订单类型（须同时在 CUSTOMER_ARRIVAL_COPY 有台词） */
export const CUSTOMER_ARRIVAL_BANNER_ORDER_KINDS: readonly OrderGenerationKind[] = [
  'timedDiamond',
  'timedFlorist',
];

export const CUSTOMER_ARRIVAL_COPY: Readonly<Record<string, CustomerArrivalCopy>> = {
  tycoon: {
    subtitle: '限时贵宾',
    arrivalLines: [
      '今天的花，要配得上我的时间。',
      '三样都要最好的——计时已经开始了。',
      '别让我等太久，钻石可不会等人。',
    ],
  },
  florist_merchant: {
    subtitle: '富贵花商',
    arrivalLines: [
      '这三份要一模一样，等级可不能含糊。',
      '高价收花，限时备货——迟了就没这笔生意。',
      '鲜的、绿的都行，但都得是上品。',
    ],
  },
};

export function shouldShowCustomerArrivalBanner(customer: {
  typeId: string;
  orderKind: OrderGenerationKind;
}): boolean {
  if (CUSTOMER_ARRIVAL_COPY[customer.typeId]) {
    const typeDef = CUSTOMER_TYPE_MAP.get(customer.typeId);
    if (typeDef?.specialOnly) return true;
    if (CUSTOMER_ARRIVAL_BANNER_ORDER_KINDS.includes(customer.orderKind)) return true;
  }
  return false;
}

export function pickCustomerArrivalLine(typeId: string): { subtitle?: string; line: string } | null {
  const copy = CUSTOMER_ARRIVAL_COPY[typeId];
  if (!copy || copy.arrivalLines.length === 0) return null;
  const line = copy.arrivalLines[Math.floor(Math.random() * copy.arrivalLines.length)]!;
  return { subtitle: copy.subtitle, line };
}
