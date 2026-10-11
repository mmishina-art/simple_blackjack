import { audio } from '../audio/AudioManager';
import { rarityClass } from './rarity';
import { isCleared, reachableTiles, type RunState } from '../run/Run';
import { tileOf, TILE_LABEL, type TileDef, type TileKind } from '../map/StageMap';

const NS = 'http://www.w3.org/2000/svg';
const W = 360;
const H = 640;
const COL_X = [70, 180, 290];
const ROW_Y = (row: number, rows: number): number => 586 - row * ((586 - 64) / Math.max(1, rows - 1));

const ICON: Record<TileKind, string> = { start: '始', empty: '', enemy: '敵', chest: '宝', inn: '宿', shrine: '祠', boss: '王' };

export interface MapHandlers {
  onMove(tileId: string): void;
  onLoadout(): void;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls = ''): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
}

/** マップ画面。駒は1マスずつ進み、光っている隣接マスをタップして移動する。 */
export function showMap(root: HTMLElement, run: RunState, handlers: MapHandlers, message = ''): void {
  const screen = document.createElement('main');
  screen.className = 'map-screen';

  // 上部: HP と所持レリック
  const hud = document.createElement('section');
  hud.className = 'map-hud';
  hud.innerHTML = `<div class="map-hud__row"><strong>${run.map.name}</strong><span>ATK ${run.baseAttack}　HP ${run.hp} / ${run.maxHp}</span></div>
    <div class="map-hud__bar"><div class="map-hud__fill" style="width:${Math.max(0, (run.hp / run.maxHp) * 100)}%"></div></div>`;
  const relics = document.createElement('div');
  relics.className = 'map-hud__relics';
  if (run.relics.length === 0) relics.textContent = '遺物なし';
  for (const r of run.relics) {
    const m = document.createElement('span');
    m.className = `medal medal--sm ${rarityClass(r.rarity)}`;
    m.textContent = r.icon;
    m.title = `${r.name}: ${r.description}`;
    relics.append(m);
  }
  hud.append(relics);

  // 中央: マップ（SVG）
  const rows = Math.max(...Object.values(run.map.tiles).map((t) => t.row)) + 1;
  const pos = (t: TileDef) => ({ x: COL_X[t.col], y: ROW_Y(t.row, rows) });
  const reachable = new Set(reachableTiles(run).map((t) => t.id));
  const board = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'map-board', role: 'img', 'aria-label': 'ステージマップ' });

  for (const t of Object.values(run.map.tiles)) {
    for (const n of t.next) {
      const a = pos(t);
      const b = pos(tileOf(run.map, n));
      const active = t.id === run.position && reachable.has(n);
      board.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, `edge${active ? ' edge--active' : ''}`));
    }
  }
  for (const t of Object.values(run.map.tiles)) {
    const { x, y } = pos(t);
    const here = t.id === run.position;
    const canMove = reachable.has(t.id);
    const cleared = isCleared(run, t.id);
    const r = t.kind === 'boss' ? 28 : 21;
    const g = svg('g', { transform: `translate(${x} ${y})` },
      `tile tile--${t.kind}${cleared ? ' tile--cleared' : ''}${here ? ' tile--here' : ''}${canMove ? ' tile--reach' : ''}`);
    g.append(svg('circle', { r }, 'tile__bg'));
    const icon = svg('text', { y: 1 }, 'tile__icon');
    icon.textContent = ICON[t.kind];
    g.append(icon);
    if (cleared && t.kind !== 'empty' && t.kind !== 'start') {
      const mark = svg('text', { x: r - 4, y: -r + 10 }, 'tile__check');
      mark.textContent = '✓';
      g.append(mark);
    }
    const title = svg('title');
    title.textContent = TILE_LABEL[t.kind] + (cleared ? '（済）' : '');
    g.append(title);
    if (canMove) {
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', `${TILE_LABEL[t.kind]}へ進む`);
      const go = () => {
        audio.sfx('click');
        handlers.onMove(t.id);
      };
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') go();
      });
    }
    board.append(g);
  }
  // 駒
  const here = pos(tileOf(run.map, run.position));
  const pawn = svg('g', { transform: `translate(${here.x} ${here.y - 34})` }, 'pawn');
  pawn.append(svg('path', { d: 'M0 10 L9 0 L0 -12 L-9 0 Z' }, 'pawn__shape'));
  board.append(pawn);

  const boardWrap = document.createElement('section');
  boardWrap.className = 'map-board-wrap';
  boardWrap.append(board);

  // 下部: メッセージと操作
  const foot = document.createElement('section');
  foot.className = 'map-foot';
  const msg = document.createElement('p');
  msg.className = 'map-foot__msg';
  msg.textContent = message || (reachable.size > 1 ? '分かれ道だ。進む先を選べ。' : '光っているマスへ進め。');
  const loadout = document.createElement('button');
  loadout.className = 'btn btn--stand map-foot__btn';
  loadout.innerHTML = '<span class="btn__main">編成</span><span class="btn__sub">付け替え</span>';
  loadout.addEventListener('click', () => {
    audio.sfx('click');
    handlers.onLoadout();
  });
  foot.append(msg, loadout);

  screen.append(hud, boardWrap, foot);
  root.replaceChildren(screen);
}
