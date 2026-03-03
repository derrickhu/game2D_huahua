import Phaser from 'phaser';

class EventManagerClass {
  private emitter = new Phaser.Events.EventEmitter();

  on(event: string, callback: (...args: any[]) => void, context?: any): void {
    this.emitter.on(event, callback, context);
  }

  once(event: string, callback: (...args: any[]) => void, context?: any): void {
    this.emitter.once(event, callback, context);
  }

  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  off(event: string, callback: (...args: any[]) => void, context?: any): void {
    this.emitter.off(event, callback, context);
  }
}

export const EventManager = new EventManagerClass();

export const GameEvents = {
  FLOWER_MERGED: 'flower:merged',
  FLOWER_PLACED: 'flower:placed',
  ORDER_COMPLETED: 'order:completed',
  CUSTOMER_ARRIVED: 'customer:arrived',
  CUSTOMER_LEFT: 'customer:left',
  CURRENCY_CHANGED: 'currency:changed',
  BUILDING_PRODUCED: 'building:produced',
  BUILDING_CD_COMPLETE: 'building:cdComplete',
  BUILDING_UNLOCKED: 'building:unlocked',
  BOARD_FULL: 'board:full',
  SCENE_SWITCH: 'scene:switch',
  SAVE_GAME: 'save:game',
} as const;
