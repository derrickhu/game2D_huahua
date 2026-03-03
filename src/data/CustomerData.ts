import { FlowerFamily } from '../config/Constants';

export interface CustomerConfig {
  id: string;
  name: string;
  color: number;  // 占位图颜色
  possibleRequests: CustomerRequest[];
}

export interface CustomerRequest {
  family: FlowerFamily;
  minLevel: number;
  maxLevel: number;
  goldReward: number;
  wishReward: number;
  dewReward: number;
}

// 阶段1只有2种客人，后续逐步增加
export const CustomerConfigs: CustomerConfig[] = [
  {
    id: 'energetic_girl',
    name: '元气少女',
    color: 0xFF9999,
    possibleRequests: [
      { family: FlowerFamily.DAILY, minLevel: 1, maxLevel: 2, goldReward: 10, wishReward: 2, dewReward: 0 },
      { family: FlowerFamily.DAILY, minLevel: 2, maxLevel: 3, goldReward: 20, wishReward: 3, dewReward: 1 },
    ],
  },
  {
    id: 'gentle_sister',
    name: '温柔大姐姐',
    color: 0x99BBFF,
    possibleRequests: [
      { family: FlowerFamily.DAILY, minLevel: 1, maxLevel: 3, goldReward: 15, wishReward: 2, dewReward: 1 },
      { family: FlowerFamily.DAILY, minLevel: 2, maxLevel: 4, goldReward: 30, wishReward: 5, dewReward: 2 },
    ],
  },
];

export function getRandomCustomerConfig(): CustomerConfig {
  return CustomerConfigs[Math.floor(Math.random() * CustomerConfigs.length)];
}

export function generateRequest(config: CustomerConfig): CustomerRequest {
  const requests = config.possibleRequests;
  return requests[Math.floor(Math.random() * requests.length)];
}
