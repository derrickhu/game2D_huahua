/**
 * 许愿硬币（专用抽奖货币，存档键 flowerSignTickets 兼容旧档），随主档；
 * 直加用 add()；数量仅在许愿池界面展示（非棋盘物品、不进收纳盒）。
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
