import type { BattleEventName, BattleEvents } from './events';

type Handler<K extends BattleEventName> = (payload: BattleEvents[K]) => BattleEvents[K] | void;

interface Registration {
  handler: Handler<BattleEventName>;
  priority: number;
  order: number;
}

/**
 * 同期イベントバス。emit はハンドラを優先度順（小さい順、同値は登録順）に連鎖実行し、
 * 最終的なペイロードを返す。呼び出し側は戻り値を採用することで、レリックによる改変を反映できる。
 */
export class EventBus {
  private handlers = new Map<BattleEventName, Registration[]>();
  private counter = 0;

  /** 購読する。戻り値は購読解除関数。 */
  on<K extends BattleEventName>(name: K, handler: Handler<K>, priority = 0): () => void {
    const reg: Registration = { handler: handler as unknown as Handler<BattleEventName>, priority, order: this.counter++ };
    const list = this.handlers.get(name) ?? [];
    list.push(reg);
    list.sort((a, b) => a.priority - b.priority || a.order - b.order);
    this.handlers.set(name, list);
    return () => {
      const cur = this.handlers.get(name);
      if (cur) this.handlers.set(name, cur.filter((r) => r !== reg));
    };
  }

  emit<K extends BattleEventName>(name: K, payload: BattleEvents[K]): BattleEvents[K] {
    let current = payload;
    // ハンドラ内での登録/解除の影響を避けるためコピーして走査
    for (const reg of [...(this.handlers.get(name) ?? [])]) {
      const result = (reg.handler as unknown as Handler<K>)(current);
      if (result !== undefined) current = result;
    }
    return current;
  }
}
