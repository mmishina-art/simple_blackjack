import { Hand } from '../cards/Hand';

export type EntityId = 'player' | 'enemy';

export class Entity {
  hp: number;
  readonly hand = new Hand();

  constructor(
    readonly id: EntityId,
    readonly name: string,
    public maxHp: number,
  ) {
    this.hp = maxHp;
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }
}
