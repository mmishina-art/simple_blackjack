import { buildStage } from './build';

/**
 * ステージ3「竜の巣」（19段。第1階層の約2倍）。灼熱の火山。炎の精霊・溶岩ゴーレム・悪魔が出る。
 * 長い道のりで、途中に2つの広間（悪魔・溶岩の大蛇）があり、最後に宿屋を経て、ボスの黒竜へ。
 * a=炎の精霊 b=溶岩ゴーレム c=悪魔 d=鋼鉄のゴーレム e=溶岩の大蛇（中ボス）（C=宝箱 I=宿屋 H=祠 P=ショップ O=何もない）
 */
export const STAGE_3 = buildStage('stage3', '竜の巣', ['flame', 'golem', 'imp', 'iron_golem', 'magma_serpent'], 'dragon', [
  '.a.',
  'bOa',
  'CIc',
  'abO',
  'HOC',
  'cba',
  '.c.',
  'PHO',
  'daC',
  'IOc',
  'aHb',
  '.e.',
  'COH',
  'cda',
  'OIP',
  'abc',
  '.I.',
]);
