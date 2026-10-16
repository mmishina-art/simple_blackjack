import { audio } from '../audio/AudioManager';
import { openSheet } from './components/SkillSheet';
import { relicButton } from './components/relicMedal';
import { isCleared, reachableTiles, type RunState } from '../run/Run';
import { tileOf, TILE_LABEL, type TileDef, type TileKind } from '../map/StageMap';
import { stageRows } from '../map/stages';
import { getEnemy } from '../core/entities/enemies/catalog';
import { enemyLevel } from '../core/entities/enemies/level';
import { enemyArtHref } from './components/enemyArt';
import { TILE_ICONS } from './components/tileIcons';
import { openMonsterSheet } from './components/MonsterSheet';
import { mapBackdropHtml } from './components/art';
import { moneyBagSvg } from './components/moneyBag';
import { isDebug } from '../debug';

const NS = 'http://www.w3.org/2000/svg';
const W = 360;
const COL_X = [70, 180, 290];
/** 9段までは、画面の高さに収める（従来どおり）。それより長い階層は、段の間隔を一定にして、縦にスクロールする。 */
const FIT_ROWS = 9;
const ROW_STEP = 74;
const PAD = 64;
const boardHeight = (rows: number): number => (rows <= FIT_ROWS ? 680 : PAD * 2 + (rows - 1) * ROW_STEP);
const ROW_Y = (row: number, rows: number): number =>
  rows <= FIT_ROWS ? 624 - row * ((624 - 64) / Math.max(1, rows - 1)) : boardHeight(rows) - PAD - row * ROW_STEP;

/** 絵のないマスの文字（スタート・宝・店・祠・宿屋は tileIcons の絵）。 */
const ICON: Record<TileKind, string> = { start: '', empty: '', enemy: '敵', chest: '', inn: '', shrine: '', boss: '王', shop: '' };

export interface MapHandlers {
  onMove(tileId: string): void;
  onLoadout(): void;
  /** 冒険をあきらめて、タイトルに戻る（確認のあと）。魂片は入らない。 */
  onGiveUp(): void;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls = ''): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute('class', cls);
  return e;
}

/** 中ボス（通常の敵マスに置かれた、前の階層のボスの強化版）のマスか。 */
function isMidBoss(t: TileDef): boolean {
  return t.kind === 'enemy' && Boolean(t.enemyId) && Boolean(getEnemy(t.enemyId!).midBoss);
}

/** マスの半径。ボスがいちばん大きく、中ボスはその次。 */
function tileRadius(t: TileDef): number {
  if (t.kind === 'boss') return 32;
  if (isMidBoss(t)) return 30;
  return 28;
}

/** マップ画面。駒は1マスずつ進み、光っている隣接マスをタップして移動する。 */
export function showMap(root: HTMLElement, run: RunState, handlers: MapHandlers, message = ''): void {
  const screen = document.createElement('main');
  screen.className = 'map-screen';

  // 上部（枠なしの細い帯）: 1 行目 = 階層名（左）とゴールド（右）/ 2 行目 = HP バー（数字つき）/ 3 行目 = 所持レリック
  const hud = document.createElement('section');
  hud.className = 'map-hud';
  const pct = Math.max(0, Math.min(100, (run.hp / run.maxHp) * 100));
  hud.innerHTML = `<div class="map-hud__row"><span class="map-hud__stage"><b>第${run.stage}階層</b>${run.map.name}</span>
      <span class="map-hud__gold" aria-label="所持金 ${run.gold} ゴールド"><span class="map-hud__moneybag" aria-hidden="true">${moneyBagSvg()}</span><b>${run.gold}</b> G</span></div>
    <div class="map-hud__hp${run.hp <= run.maxHp * 0.3 ? ' map-hud__hp--low' : ''}" role="img" aria-label="HP ${run.hp} / ${run.maxHp}"><div class="map-hud__fill" style="width:${pct}%"></div>
      <div class="map-hud__hptext" aria-hidden="true"><span>HP</span><span><b>${Math.max(0, run.hp)}</b> / ${run.maxHp}</span></div></div>`;
  const relics = document.createElement('div');
  relics.className = 'map-hud__relics';
  if (run.relics.length === 0) relics.textContent = '遺物なし';
  for (const r of run.relics) {
    relics.append(relicButton(r, run.slots));
  }
  hud.append(relics);

  // 中央: マップ（SVG）
  const rows = stageRows(run.map);
  const H = boardHeight(rows);
  const tall = rows > FIT_ROWS;
  const pos = (t: TileDef) => ({ x: COL_X[t.col], y: ROW_Y(t.row, rows) });
  const reachable = new Set(reachableTiles(run).map((t) => t.id));
  const board = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: `map-board${tall ? ' map-board--tall' : ''}`, role: 'img', 'aria-label': 'ステージマップ' });

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
    const bossUnknown = t.kind === 'boss' && Boolean(t.enemyId) && !isDebug() && !(run.knownEnemies ?? []).includes(t.enemyId!);
    const midBoss = isMidBoss(t);
    const r = tileRadius(t);
    const g = svg('g', { transform: `translate(${x} ${y})` },
      `tile tile--${t.kind}${midBoss ? ' tile--midboss' : ''}${cleared ? ' tile--cleared' : ''}${here ? ' tile--here' : ''}${canMove ? ' tile--reach' : ''}${bossUnknown ? ' tile--unknown' : ''}`);
    // 中ボスは、円の外側に細い銅色のリングを重ねて二重の枠にする（ボスは金色の枠＋上の王冠。王冠は絵のあとに描く）
    if (midBoss) g.append(svg('circle', { r: r + 3.5 }, 'tile__ring'));
    g.append(svg('circle', { r }, 'tile__bg'));
    const monster = t.enemyId ? enemyArtHref(t.enemyId) : null;
    if (monster) {
      // 敵のマスには、出てくるモンスターの絵を出す（円の中に切り抜く。未討伐のボスはシルエット）
      const clip = svg('clipPath', { id: `clip-${t.id}` });
      clip.append(svg('circle', { r: r - 2 }));
      g.append(clip);
      const w = r * 2.5;
      const img = svg('image', { href: monster, x: -w / 2, y: (-w * 0.8) / 2, width: w, height: w * 0.8, 'clip-path': `url(#clip-${t.id})` }, 'tile__monster');
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      g.append(img);
    } else if (TILE_ICONS[t.kind]) {
      // 宝・店・祠・宿屋は、種類ごとの絵（線画。色は CSS の color）
      const glyph = svg('g', { transform: 'scale(1.45)', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, 'tile__glyph');
      glyph.innerHTML = TILE_ICONS[t.kind]!;
      g.append(glyph);
    } else {
      const icon = svg('text', { y: 1 }, 'tile__icon');
      icon.textContent = ICON[t.kind];
      g.append(icon);
    }
    // ボスは、円の上端に小さな王冠をのせる（色は CSS。枠と同じ金色）
    if (t.kind === 'boss') {
      const crown = svg('path', { d: 'M-11 0 L-11 -9 L-5.5 -4 L0 -11 L5.5 -4 L11 -9 L11 0 Z', transform: `translate(0 ${-r + 1})` }, 'tile__crown');
      g.append(crown);
    }
    if (cleared && t.kind !== 'empty' && t.kind !== 'start') {
      const mark = svg('text', { x: r - 4, y: -r + 10 }, 'tile__check');
      mark.textContent = '✓';
      g.append(mark);
    }
    const title = svg('title');
    const who = t.enemyId ? (bossUnknown ? '？？？・' : `${getEnemy(t.enemyId).name} LV${enemyLevel(getEnemy(t.enemyId))}・`) : '';
    title.textContent = who + TILE_LABEL[t.kind] + (cleared ? '（済）' : '');
    g.append(title);
    const enemyId = t.enemyId;
    const canGo = canMove || (isDebug() && Boolean(enemyId));
    if (enemyId || canMove) {
      const name = enemyId ? `${bossUnknown ? '？？？' : getEnemy(enemyId).name}（${TILE_LABEL[t.kind]}）` : TILE_LABEL[t.kind];
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', enemyId ? `${name}の詳細${canGo ? '（進める）' : ''}` : `${name}へ進む`);
      const act = () => {
        audio.sfx('click');
        if (enemyId) openMonsterSheet(enemyId, { run, boss: t.kind === 'boss', canGo, onGo: () => handlers.onMove(t.id) });
        else handlers.onMove(t.id);
      };
      g.addEventListener('click', act);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') act();
      });
    }
    board.append(g);
  }
  // 駒
  const hereTile = tileOf(run.map, run.position);
  const here = pos(hereTile);
  const hereR = tileRadius(hereTile) + (hereTile.kind === 'boss' ? 10 : isMidBoss(hereTile) ? 4 : 0);
  // 位置は外側の g の transform 属性で、上下にゆれる動き（CSS の transform）は内側の g で付ける（同じ要素に両方付けると、位置が上書きされて、左上に出てしまう）
  const pawn = svg('g', { transform: `translate(${here.x} ${here.y - (hereR + 12)})` });
  const bob = svg('g', {}, 'pawn');
  bob.append(svg('path', { d: 'M0 10 L9 0 L0 -12 L-9 0 Z' }, 'pawn__shape'));
  pawn.append(bob);
  board.append(pawn);

  const boardWrap = document.createElement('section');
  boardWrap.className = `map-board-wrap${tall ? ' map-board-wrap--tall' : ''}`;
  boardWrap.append(board);

  // 下部: メッセージ（枠なしの 1 行）と、操作のボタン（メッセージとは別の行）
  const foot = document.createElement('section');
  foot.className = 'map-foot';
  const msg = document.createElement('p');
  msg.className = 'map-foot__msg';
  msg.setAttribute('aria-live', 'polite');
  msg.textContent = message || (reachable.size > 1 ? '分かれ道だ。進む先を選べ。' : '光っているマスへ進め。');
  const actions = document.createElement('div');
  actions.className = 'map-foot__actions';
  const giveUp = document.createElement('button');
  giveUp.type = 'button';
  giveUp.className = 'btn map-foot__btn map-foot__giveup';
  giveUp.innerHTML = '<span class="btn__main">‹ タイトルへ</span>';
  giveUp.setAttribute('aria-label', 'タイトルへ戻る（冒険をあきらめる）');
  giveUp.addEventListener('click', () => {
    audio.sfx('click');
    openSheet({
      title: '冒険をあきらめる？',
      subtitle: 'この冒険は終わる。魂片は入らない（途中の記録は残らない）',
      options: [{ kind: 'danger', icon: '去', name: 'あきらめて、タイトルへ', detail: '魂片は入らず、冒険は最初からになる', onPick: () => handlers.onGiveUp() }],
    });
  });
  const loadout = document.createElement('button');
  loadout.className = 'btn btn--stand map-foot__btn map-foot__main';
  loadout.innerHTML = '<span class="btn__main">装備</span>';
  loadout.addEventListener('click', () => {
    audio.sfx('click');
    handlers.onLoadout();
  });
  actions.append(giveUp, loadout);
  foot.append(msg, actions);

  const bd = mapBackdropHtml(run.stage);
  if (bd.image) {
    const backdrop = document.createElement('div');
    backdrop.className = 'map-backdrop map-backdrop--image';
    backdrop.innerHTML = bd.html + '<div class="map-backdrop__overlay" aria-hidden="true"></div>';
    screen.append(backdrop);
  }

  screen.append(hud, boardWrap, foot);
  screen.dataset.stage = String(run.stage);
  root.replaceChildren(screen);
  // 長い階層は、いまいる位置が画面の中ほどに来るようにスクロールしておく
  if (tall) {
    requestAnimationFrame(() => {
      const scale = board.getBoundingClientRect().height / H;
      boardWrap.scrollTop = Math.max(0, here.y * scale - boardWrap.clientHeight / 2);
    });
  }
}
