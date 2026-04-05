/**
 * 许愿券（专用抽奖货币，内部名 flowerSign），存档随主档；获取由活动/礼包等调用 add。
 */
import { EventBus } from '@/core/EventBus';

class FlowerSignTicketManagerClass {
  private _count = 0;

  get count(): number {
    return this._count;
  }

  loadState(raw: number | undefined): void {
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
    this._count = Math.max(0, n);
    EventBus.emit('flowerSignTicket:changed', this._count);
  }

  exportState(): number {
    return this._count;
  }

  add(amount: number): void {
    if (amount <= 0) return;
    this._count += Math.floor(amount);
    EventBus.emit('flowerSignTicket:changed', this._count);
  }

  trySpend(amount: number): boolean {
    if (amount <= 0) return true;
    const n = Math.floor(amount);
    if (this._count < n) return false;
    this._count -= n;
    EventBus.emit('flowerSignTicket:changed', this._count);
    return true;
  }
}

export const FlowerSignTicketManager = new FlowerSignTicketManagerClass();
