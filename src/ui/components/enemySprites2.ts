/**
 * 第1階層のボス・第2階層・第3階層の敵のスプライト（インラインSVG）。enemySprites.ts と同じ、ペン画風（線の揺らぎ + ハッチング）。
 * 同じ画面に複数のスプライトが出ることはないが、フィルターや模様の id は敵ごとに別にしてある。
 */
const defs = (p: string, seed: number): string => `
  <defs>
    <filter id="ink${p}" x="-10%" y="-10%" width="120%" height="125%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5"/>
    </filter>
    <pattern id="hatch${p}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#05080a" stroke-width="1.3" opacity=".6"/>
    </pattern>
  </defs>`;
const shadow = '<ellipse cx="100" cy="152" rx="64" ry="6" fill="#000" opacity=".55"/>';
const STROKE = 'stroke="#070605" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';

/** 墓守の騎士（第1階層のボス）: 兜の骸骨騎士。大剣と塔盾。 */
const knight = `
<svg viewBox="0 0 200 160" role="img" aria-label="墓守の騎士" xmlns="http://www.w3.org/2000/svg">${defs('Kn', 11)}
  ${shadow}
  <g filter="url(#inkKn)" ${STROKE}>
    <!-- 大剣 -->
    <path d="M160 6l9 3-8 104-9-2z" fill="#9aa0a4"/><path d="M149 108l30 4" stroke="#6b4a1e" stroke-width="8" fill="none"/><path d="M164 112l-2 30" stroke="#3a2a14" stroke-width="8" fill="none"/>
    <!-- 胴鎧 -->
    <path d="M62 92c-6-18 8-30 38-30s44 12 38 30l-6 44H68z" fill="#4b5359"/>
    <path d="M62 92c-6-18 8-30 38-30s44 12 38 30l-6 44H68z" fill="url(#hatchKn)"/>
    <path d="M100 66v70M78 100h44M74 118h52" stroke="#2a3034" stroke-width="3" fill="none"/>
    <!-- 肩 -->
    <path d="M46 84c0-18 20-26 38-22l-6 22c-10 8-22 8-32 0z" fill="#6c757b"/>
    <path d="M154 84c0-18-20-26-38-22l6 22c10 8 22 8 32 0z" fill="#6c757b"/>
    <!-- 兜 -->
    <path d="M70 52c0-30 14-44 30-44s30 14 30 44v14H70z" fill="#79828a"/>
    <path d="M100 8v58M70 40h60" stroke="#2a3034" stroke-width="3.5" fill="none"/>
    <path d="M100 4c-6-4-4-12 0-14 4 2 6 10 0 14z" fill="#8a1c1c"/>
    <path d="M78 46h44v10H78z" fill="#0a0907"/>
    <!-- 塔盾 -->
    <path d="M24 70h44v52c0 14-10 22-22 28-12-6-22-14-22-28z" fill="#5b3a1e"/>
    <path d="M24 70h44v52c0 14-10 22-22 28-12-6-22-14-22-28z" fill="url(#hatchKn)"/>
    <path d="M46 78v66M30 96h32" stroke="#a88a4a" stroke-width="4" fill="none"/>
  </g>
  <ellipse cx="90" cy="51" rx="5" ry="3" fill="#ff4a2a"/><ellipse cx="110" cy="51" rx="5" ry="3" fill="#ff4a2a"/>
  <ellipse cx="90" cy="51" rx="12" ry="7" fill="#ff4a2a" opacity=".25"/><ellipse cx="110" cy="51" rx="12" ry="7" fill="#ff4a2a" opacity=".25"/>
</svg>`;

/** 沼の魚人（第2階層）: 魚の頭に水かき。銛を持つ。 */
const merman = `
<svg viewBox="0 0 200 160" role="img" aria-label="沼の魚人" xmlns="http://www.w3.org/2000/svg">${defs('Mm', 12)}
  <defs><linearGradient id="mmBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f9a86"/><stop offset="1" stop-color="#1c3a34"/></linearGradient></defs>
  ${shadow}
  <g filter="url(#inkMm)" ${STROKE}>
    <!-- 銛 -->
    <path d="M158 6v146" stroke="#6b5230" stroke-width="5" fill="none"/>
    <path d="M148 20c2-8 6-12 10-14 4 2 8 6 10 14l-10-4zM158 6v22" fill="#b9bfc2"/>
    <!-- 体 -->
    <path d="M60 96c-4-22 14-38 40-38s44 16 40 38l-6 46c-10 8-26 10-34 10s-24-2-34-10z" fill="url(#mmBody)"/>
    <path d="M60 96c-4-22 14-38 40-38s44 16 40 38l-6 46c-10 8-26 10-34 10s-24-2-34-10z" fill="url(#hatchMm)"/>
    <!-- 腹 -->
    <path d="M82 100c6 12 30 12 36 0l-4 40H86z" fill="#b8cdb0" opacity=".7"/>
    <!-- 背びれ・腕びれ -->
    <path d="M100 58l-12-26 12 10 12-10-12 26z" fill="#2f6a62"/>
    <path d="M60 98l-26 14 6-22zM140 98l26 14-6-22z" fill="#2f6a62"/>
    <!-- 頭（魚） -->
    <path d="M64 52c0-24 16-38 36-38s36 14 36 38c0 14-10 24-36 24S64 66 64 52z" fill="url(#mmBody)"/>
    <path d="M64 52c0-24 16-38 36-38s36 14 36 38c0 14-10 24-36 24S64 66 64 52z" fill="url(#hatchMm)" opacity=".7"/>
    <path d="M100 14v-10l-14 12zM100 14v-10l14 12z" fill="#2f6a62"/>
    <path d="M84 64q16 10 32 0" fill="#1a0f0f" stroke-width="2.5"/>
    <path d="M88 64l3 7 3-6M100 66l3 8 3-8M108 65l3 6 3-7" fill="#ece3c6" stroke-width="1.4"/>
    <path d="M70 44l-12 4M130 44l12 4" stroke-width="3" fill="none"/>
  </g>
  <circle cx="84" cy="40" r="11" fill="#e8d86a" stroke="#070605" stroke-width="3"/><circle cx="116" cy="40" r="11" fill="#e8d86a" stroke="#070605" stroke-width="3"/>
  <ellipse cx="84" cy="40" rx="3" ry="7" fill="#120d05"/><ellipse cx="116" cy="40" rx="3" ry="7" fill="#120d05"/>
  <g fill="none" stroke="#bfe6e0" stroke-width="1.5" opacity=".5"><circle cx="40" cy="60" r="5"/><circle cx="168" cy="40" r="4"/><circle cx="34" cy="40" r="3"/></g>
</svg>`;

/** ガーゴイル（第2階層）: 石の翼と角。 */
const gargoyle = `
<svg viewBox="0 0 200 160" role="img" aria-label="ガーゴイル" xmlns="http://www.w3.org/2000/svg">${defs('Gg', 13)}
  <defs><linearGradient id="ggStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d949a"/><stop offset="1" stop-color="#2c3136"/></linearGradient></defs>
  ${shadow}
  <g filter="url(#inkGg)" ${STROKE}>
    <!-- 翼 -->
    <path d="M70 80C40 70 14 40 8 8c26 6 44 18 58 34zM130 80c30-10 56-40 62-72-26 6-44 18-58 34z" fill="#5f666c"/>
    <path d="M70 80C40 70 14 40 8 8c26 6 44 18 58 34zM130 80c30-10 56-40 62-72-26 6-44 18-58 34z" fill="url(#hatchGg)"/>
    <path d="M26 24l30 30M18 14l40 40M174 24l-30 30M182 14l-40 40" stroke="#2a2f33" stroke-width="2" fill="none"/>
    <!-- 胴 -->
    <path d="M64 98c-4-20 10-34 36-34s40 14 36 34l-4 44H68z" fill="url(#ggStone)"/>
    <path d="M64 98c-4-20 10-34 36-34s40 14 36 34l-4 44H68z" fill="url(#hatchGg)"/>
    <!-- 脚・爪 -->
    <path d="M68 142l-10 10h22zM132 142l10 10h-22z" fill="#6a7177"/>
    <!-- 頭 -->
    <path d="M66 48c0-22 14-34 34-34s34 12 34 34c0 14-6 22-12 28H78c-6-6-12-14-12-28z" fill="url(#ggStone)"/>
    <path d="M66 48c0-22 14-34 34-34s34 12 34 34c0 14-6 22-12 28H78c-6-6-12-14-12-28z" fill="url(#hatchGg)" opacity=".6"/>
    <!-- 角 -->
    <path d="M72 24L58 0l22 12zM128 24L142 0l-22 12z" fill="#aab1b6"/>
    <!-- 口と牙 -->
    <path d="M82 66q18 10 36 0" fill="#0b0b0d" stroke-width="2.5"/>
    <path d="M86 66l3 8 3-7M96 69l3 9 3-9M108 68l3 8 3-8" fill="#e6e0cc" stroke-width="1.4"/>
    <path d="M78 36l16 6M122 36l-16 6" stroke-width="4" fill="none"/>
  </g>
  <ellipse cx="88" cy="46" rx="7" ry="5" fill="#ff4a2a"/><ellipse cx="112" cy="46" rx="7" ry="5" fill="#ff4a2a"/>
  <ellipse cx="88" cy="46" rx="15" ry="9" fill="#ff4a2a" opacity=".22"/><ellipse cx="112" cy="46" rx="15" ry="9" fill="#ff4a2a" opacity=".22"/>
</svg>`;

/** 亡霊（第2階層）: ぼろ布をまとう、青白い霊。 */
const wraith = `
<svg viewBox="0 0 200 160" role="img" aria-label="亡霊" xmlns="http://www.w3.org/2000/svg">${defs('Wr', 14)}
  <defs>
    <linearGradient id="wrCloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8fa8"/><stop offset=".6" stop-color="#2c3d52"/><stop offset="1" stop-color="#0c131c" stop-opacity=".2"/></linearGradient>
    <radialGradient id="wrGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9ff0ff"/><stop offset="1" stop-color="#9ff0ff" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="148" rx="50" ry="5" fill="#000" opacity=".4"/>
  <g filter="url(#inkWr)" ${STROKE}>
    <!-- 腕 -->
    <path d="M62 70C36 74 20 92 18 118c10-6 18-8 26-6 2-16 10-26 24-30z" fill="url(#wrCloak)"/>
    <path d="M138 70c26 4 42 22 44 48-10-6-18-8-26-6-2-16-10-26-24-30z" fill="url(#wrCloak)"/>
    <!-- 外套 -->
    <path d="M62 60C56 28 76 10 100 10s44 18 38 50c-2 20 4 44 12 72l-14-8-10 14-10-14-10 14-10-14-10 14-10-14-14 8c8-28 14-52 10-72z" fill="url(#wrCloak)"/>
    <path d="M62 60C56 28 76 10 100 10s44 18 38 50c-2 20 4 44 12 72l-14-8-10 14-10-14-10 14-10-14-10 14-10-14-14 8c8-28 14-52 10-72z" fill="url(#hatchWr)" opacity=".5"/>
    <!-- 顔の闇 -->
    <path d="M76 44c0-18 10-26 24-26s24 8 24 26c0 14-6 26-24 26S76 58 76 44z" fill="#05080c"/>
    <path d="M86 62q14 12 28 0" fill="none" stroke="#9ff0ff" stroke-width="2.5" opacity=".7"/>
  </g>
  <ellipse cx="90" cy="42" rx="14" ry="10" fill="url(#wrGlow)"/><ellipse cx="110" cy="42" rx="14" ry="10" fill="url(#wrGlow)"/>
  <ellipse cx="90" cy="42" rx="4" ry="6" fill="#e9fdff"/><ellipse cx="110" cy="42" rx="4" ry="6" fill="#e9fdff"/>
  <g fill="#bfeaff" opacity=".55"><circle cx="40" cy="40" r="3"/><circle cx="164" cy="56" r="2.5"/><circle cx="32" cy="76" r="2"/><circle cx="172" cy="28" r="2"/></g>
</svg>`;

/** 深淵の海蛇（第2階層のボス）: とぐろを巻く、ひれのある大蛇。 */
const serpent = `
<svg viewBox="0 0 200 160" role="img" aria-label="深淵の海蛇" xmlns="http://www.w3.org/2000/svg">${defs('Sp', 15)}
  <defs>
    <linearGradient id="spBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f9aa8"/><stop offset="1" stop-color="#0f2f3a"/></linearGradient>
    <radialGradient id="spGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>
  </defs>
  ${shadow}
  <g filter="url(#inkSp)" ${STROKE}>
    <!-- とぐろ -->
    <path d="M24 136c-6-28 22-40 56-36 40 4 66 20 70 40-30 14-96 14-126-4z" fill="url(#spBody)"/>
    <path d="M24 136c-6-28 22-40 56-36 40 4 66 20 70 40-30 14-96 14-126-4z" fill="url(#hatchSp)"/>
    <path d="M40 124c20-8 50-8 80 4M56 136c20-6 44-6 70 4" stroke="#bfe6ea" stroke-width="2" fill="none" opacity=".5"/>
    <!-- 首 -->
    <path d="M62 118C40 96 56 62 84 54c20-6 36-2 44 12 6 12-2 24-14 26-14 2-18 14-8 28z" fill="url(#spBody)"/>
    <path d="M62 118C40 96 56 62 84 54c20-6 36-2 44 12 6 12-2 24-14 26-14 2-18 14-8 28z" fill="url(#hatchSp)" opacity=".7"/>
    <!-- ひれ -->
    <path d="M88 52l-8-28 18 14 8-22 8 24 14-16-2 30z" fill="#2f7a86"/>
    <!-- 頭 -->
    <path d="M110 40c0-16 14-26 34-24 14 2 26 10 28 22-6 10-20 16-38 16-14 0-24-6-24-14z" fill="url(#spBody)"/>
    <path d="M118 52q22 10 50 2" fill="#1a0a0c" stroke-width="2.5"/>
    <path d="M124 52l2 8 4-6M138 55l2 8 4-8M152 54l2 8 3-8" fill="#ece3c6" stroke-width="1.4"/>
    <path d="M168 48l16 4-12 6" fill="#c8402a"/>
  </g>
  <ellipse cx="136" cy="32" rx="14" ry="10" fill="url(#spGlow)"/>
  <path d="M126 32q10-8 20 0q-10 6-20 0z" fill="#e8c24a" stroke="#070605" stroke-width="2"/><ellipse cx="136" cy="32" rx="2.4" ry="5" fill="#120808"/>
  <g fill="none" stroke="#bfe6ea" stroke-width="1.5" opacity=".5"><circle cx="30" cy="70" r="5"/><circle cx="170" cy="100" r="4"/><circle cx="22" cy="50" r="3"/></g>
</svg>`;

/** 炎の精霊（第3階層）: 燃え上がる炎の人影。 */
const flame = `
<svg viewBox="0 0 200 160" role="img" aria-label="炎の精霊" xmlns="http://www.w3.org/2000/svg">${defs('Fl', 16)}
  <defs>
    <radialGradient id="flBody" cx="50%" cy="70%" r="70%"><stop offset="0" stop-color="#fff0a0"/><stop offset=".45" stop-color="#ff9a2a"/><stop offset="1" stop-color="#8a1a0a"/></radialGradient>
    <radialGradient id="flHalo" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".5"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="90" rx="96" ry="70" fill="url(#flHalo)"/>
  ${shadow}
  <g filter="url(#inkFl)" ${STROKE}>
    <path d="M100 6c8 22 30 30 36 56 4 18-4 30 4 44 8 14 4 36-10 42-8 4-16 4-30 4s-22 0-30-4c-14-6-18-28-10-42 8-14 0-26 4-44 6-26 24-34 36-56z" fill="url(#flBody)"/>
    <path d="M100 30c4 14 18 20 20 38 2 12-4 20 2 30-12-4-22-4-34 0 6-10 0-18 2-30 2-18 16-24 10-38z" fill="#ffd25a" stroke="none" opacity=".9"/>
    <path d="M52 98c-14-8-24-24-20-42 10 8 20 8 26 20zM148 98c14-8 24-24 20-42-10 8-20 8-26 20z" fill="url(#flBody)"/>
    <path d="M84 120q16 14 32 0" fill="#3a0a06" stroke-width="2.5"/>
  </g>
  <path d="M74 80q12-10 24 0q-12 8-24 0zM102 80q12-10 24 0q-12 8-24 0z" fill="#2a0a06" stroke="#070605" stroke-width="2"/>
  <ellipse cx="86" cy="80" rx="3" ry="4" fill="#ffe27a"/><ellipse cx="114" cy="80" rx="3" ry="4" fill="#ffe27a"/>
  <g fill="#ffd25a" opacity=".8"><circle cx="40" cy="30" r="2.5"/><circle cx="160" cy="24" r="3"/><circle cx="26" cy="70" r="2"/><circle cx="176" cy="60" r="2"/></g>
</svg>`;

/** 溶岩ゴーレム（第3階層）: 岩の巨体に、溶岩が走る。 */
const golem = `
<svg viewBox="0 0 200 160" role="img" aria-label="溶岩ゴーレム" xmlns="http://www.w3.org/2000/svg">${defs('Gl', 17)}
  <defs><linearGradient id="glRock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5a52"/><stop offset="1" stop-color="#1c1512"/></linearGradient></defs>
  ${shadow}
  <g filter="url(#inkGl)" ${STROKE}>
    <!-- 腕 -->
    <path d="M44 66l-22 26 4 40 26 4 8-34z" fill="url(#glRock)"/>
    <path d="M156 66l22 26-4 40-26 4-8-34z" fill="url(#glRock)"/>
    <!-- 胴 -->
    <path d="M56 62h88l10 40-12 44H58l-12-44z" fill="url(#glRock)"/>
    <path d="M56 62h88l10 40-12 44H58l-12-44z" fill="url(#hatchGl)"/>
    <!-- 頭 -->
    <path d="M72 18l56-2 8 34-14 14H78L64 48z" fill="url(#glRock)"/>
    <path d="M72 18l56-2 8 34-14 14H78L64 48z" fill="url(#hatchGl)" opacity=".6"/>
  </g>
  <g fill="none" stroke="#ff8a2a" stroke-width="3" stroke-linecap="round">
    <path d="M70 74l14 18-6 20 16 16M126 72l-10 22 12 14-4 24M100 64v26l-8 18"/>
    <path d="M32 100l12 10-4 16M168 100l-12 10 4 16" stroke-width="2.5"/>
  </g>
  <g stroke="#ffe27a" stroke-width="1.2" fill="none" opacity=".7"><path d="M70 74l14 18-6 20 16 16M126 72l-10 22 12 14-4 24"/></g>
  <path d="M80 36h16v8H80zM106 36h16v8h-16z" fill="#ffb22a" stroke="#070605" stroke-width="2.5"/>
  <ellipse cx="88" cy="40" rx="14" ry="8" fill="#ff7a2a" opacity=".25"/><ellipse cx="114" cy="40" rx="14" ry="8" fill="#ff7a2a" opacity=".25"/>
  <path d="M84 58h32" stroke="#070605" stroke-width="4" stroke-linecap="round"/>
</svg>`;

/** 業火の悪魔（第3階層）: 角と翼と三叉の槍。 */
const imp = `
<svg viewBox="0 0 200 160" role="img" aria-label="業火の悪魔" xmlns="http://www.w3.org/2000/svg">${defs('Im', 18)}
  <defs><linearGradient id="imBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2412e"/><stop offset="1" stop-color="#3a0c0a"/></linearGradient></defs>
  ${shadow}
  <g filter="url(#inkIm)" ${STROKE}>
    <!-- 翼 -->
    <path d="M66 84C34 78 12 52 10 20c26 8 42 20 54 36zM134 84c32-6 54-32 56-64-26 8-42 20-54 36z" fill="#5a1a14"/>
    <path d="M66 84C34 78 12 52 10 20c26 8 42 20 54 36zM134 84c32-6 54-32 56-64-26 8-42 20-54 36z" fill="url(#hatchIm)"/>
    <!-- 三叉の槍 -->
    <path d="M160 40v112" stroke="#3a2a1a" stroke-width="5" fill="none"/>
    <path d="M148 44V24l6 6 6-14 6 14 6-6v20z" fill="#b9bfc2"/>
    <!-- 胴 -->
    <path d="M66 104c-4-22 10-38 34-38s38 16 34 38l-4 40H70z" fill="url(#imBody)"/>
    <path d="M66 104c-4-22 10-38 34-38s38 16 34 38l-4 40H70z" fill="url(#hatchIm)"/>
    <path d="M70 142l-8 10h20zM130 142l8 10h-20zM134 100l24 12-4-24z" fill="#8a2a1e"/>
    <path d="M136 120c14 6 20 16 16 28" stroke="#8a2a1e" stroke-width="5" fill="none"/>
    <!-- 頭 -->
    <path d="M68 52c0-22 14-34 32-34s32 12 32 34c0 14-8 22-32 22S68 66 68 52z" fill="url(#imBody)"/>
    <path d="M72 30L56 4l26 14zM128 30L144 4l-26 14z" fill="#e8d8b0"/>
    <path d="M82 62q18 12 36 0" fill="#1a0606" stroke-width="2.5"/>
    <path d="M86 62l3 8 3-7M96 66l3 9 3-9M108 65l3 8 3-8" fill="#ece3c6" stroke-width="1.4"/>
    <path d="M78 40l16 6M122 40l-16 6" stroke-width="4" fill="none"/>
  </g>
  <path d="M82 46q8-6 16 0q-8 5-16 0zM104 46q8-6 16 0q-8 5-16 0z" fill="#ffe27a" stroke="#070605" stroke-width="2"/>
  <ellipse cx="90" cy="46" rx="2" ry="3.5" fill="#120808"/><ellipse cx="112" cy="46" rx="2" ry="3.5" fill="#120808"/>
</svg>`;

export const NEW_ENEMY_SPRITES: Record<string, string> = { knight, merman, gargoyle, wraith, serpent, flame, golem, imp };
