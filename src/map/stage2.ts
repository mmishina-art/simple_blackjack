import { buildStage } from './build';

/**
 * ステージ2「沈んだ大聖堂」（14段）。水に沈んだ聖堂。魚人・ガーゴイル・亡霊が出る。
 * 第1階層より長く、宝箱・祠・宿屋が増える。大聖堂の広間（亡霊）で合流し、宿屋を経て、ボスの海蛇へ。
 * a=魚人 b=ガーゴイル c=亡霊 d=鋼鉄のゴーレム（C=宝箱 I=宿屋 H=祠 P=ショップ O=何もない）
 */
export const STAGE_2 = buildStage('stage2', '沈んだ大聖堂', ['merman', 'gargoyle', 'wraith', 'iron_golem'], 'serpent', [
  '.a.',
  'COa',
  'dIb',
  'HCc',
  'aOb',
  '.c.',
  'CPH',
  'bad',
  'PIO',
  'cHb',
  'aOc',
  '.I.',
]);
