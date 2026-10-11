/**
 * 敵IDごとのスプライト（インラインSVG）。新しい敵はここに追加する。
 * ペン画の線の揺らぎ（feDisplacementMap）とハッチングで、ダークファンタジーの挿絵風に描いている。
 */
const slime = `
<svg viewBox="0 0 200 160" role="img" aria-label="スライム" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ink" x="-10%" y="-10%" width="120%" height="125%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="4"/>
    </filter>
    <radialGradient id="slBody" cx="38%" cy="25%" r="90%">
      <stop offset="0" stop-color="#7f9a63"/>
      <stop offset="0.45" stop-color="#3f5a3a"/>
      <stop offset="1" stop-color="#121c13"/>
    </radialGradient>
    <radialGradient id="slGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffd35a" stop-opacity="1"/>
      <stop offset="0.5" stop-color="#e8962a" stop-opacity=".55"/>
      <stop offset="1" stop-color="#e8962a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="slHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#050a06" stroke-width="1.3" opacity=".65"/>
    </pattern>
    <clipPath id="slClip">
      <path d="M22 128C12 84 36 34 100 28c58-4 88 42 80 96-2 12-14 16-28 14l-12 8-10-8-14 10-12-9-14 10-10-9-16 8-8-10C32 140 24 138 22 128z"/>
    </clipPath>
  </defs>

  <ellipse cx="100" cy="150" rx="70" ry="7" fill="#000" opacity=".55"/>

  <g filter="url(#ink)">
    <!-- 本体 -->
    <path d="M22 128C12 84 36 34 100 28c58-4 88 42 80 96-2 12-14 16-28 14l-12 8-10-8-14 10-12-9-14 10-10-9-16 8-8-10C32 140 24 138 22 128z"
          fill="url(#slBody)"/>
    <g clip-path="url(#slClip)">
      <!-- 体内に沈む朽ちた剣と頭蓋 -->
      <g opacity=".85">
        <path d="M128 52l10-4 18 66-8 3z" fill="#6f5a3e" stroke="#1a120a" stroke-width="2"/>
        <path d="M121 56l22-8" stroke="#8a6a2e" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="74" cy="104" rx="26" ry="23" fill="#c9bf9f" stroke="#1d1a12" stroke-width="2.5"/>
        <path d="M58 120l4 12h24l4-12z" fill="#b9ae8c" stroke="#1d1a12" stroke-width="2"/>
        <ellipse cx="65" cy="102" rx="7" ry="8" fill="#0b0d08"/>
        <ellipse cx="84" cy="102" rx="7" ry="8" fill="#0b0d08"/>
        <path d="M74 110l-3 8h6z" fill="#0b0d08"/>
        <path d="M63 128v-4M70 130v-6M77 130v-6M84 128v-4" stroke="#1d1a12" stroke-width="1.6"/>
      </g>
      <!-- 泡 -->
      <g fill="none" stroke="#b8d6a0" stroke-width="1.5" opacity=".55">
        <circle cx="46" cy="76" r="6"/><circle cx="150" cy="96" r="4"/><circle cx="112" cy="118" r="5"/>
        <circle cx="132" cy="76" r="3"/><circle cx="38" cy="104" r="3"/>
      </g>
      <!-- ハッチング（陰影） -->
      <path d="M20 80C60 70 120 90 190 70V160H20z" fill="url(#slHatch)"/>
    </g>
    <!-- 上面のぬめった艶 -->
    <path d="M48 60c14-18 34-24 54-24" fill="none" stroke="#d6efb8" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <path d="M54 72c8-10 16-14 26-16" fill="none" stroke="#d6efb8" stroke-width="2.5" stroke-linecap="round" opacity=".4"/>
    <!-- 輪郭 -->
    <path d="M22 128C12 84 36 34 100 28c58-4 88 42 80 96-2 12-14 16-28 14l-12 8-10-8-14 10-12-9-14 10-10-9-16 8-8-10C32 140 24 138 22 128z"
          fill="none" stroke="#070b07" stroke-width="4.5" stroke-linejoin="round"/>
    <!-- 滴り -->
    <path d="M70 140c-1 8 1 12 4 12s4-5 3-12" fill="#2a3d2a" stroke="#070b07" stroke-width="2.5"/>
    <path d="M132 142c-1 6 0 10 3 10s3-4 2-10" fill="#2a3d2a" stroke="#070b07" stroke-width="2.5"/>
  </g>

  <!-- 光る眼 -->
  <g class="slime-eyes">
    <ellipse cx="82" cy="70" rx="17" ry="13" fill="url(#slGlow)"/>
    <ellipse cx="124" cy="70" rx="17" ry="13" fill="url(#slGlow)"/>
    <path d="M70 70q12-9 24 0q-12 7-24 0z" fill="#110d07" stroke="#070b07" stroke-width="1.5"/>
    <path d="M112 70q12-9 24 0q-12 7-24 0z" fill="#110d07" stroke="#070b07" stroke-width="1.5"/>
    <ellipse cx="82" cy="70" rx="3" ry="4.5" fill="#ffe27a"/>
    <ellipse cx="124" cy="70" rx="3" ry="4.5" fill="#ffe27a"/>
    <path d="M68 60l24 6M138 60l-24 6" stroke="#070b07" stroke-width="3" stroke-linecap="round"/>
  </g>
  <!-- 牙 -->
  <path d="M82 94q21 12 42 0" fill="none" stroke="#070b07" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M88 96l2 7 3-6M100 99l2 8 3-8M112 97l3 7 2-7" fill="#d8cfae" stroke="#070b07" stroke-width="1.4" stroke-linejoin="round"/>
</svg>`;

/** 敵の背景（地下墓所の入口）。 */
export const STAGE_BACKDROP = `
<svg viewBox="0 0 320 170" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050607"/>
      <stop offset="1" stop-color="#1c1712"/>
    </linearGradient>
    <radialGradient id="bgLight" cx="50%" cy="85%" r="55%">
      <stop offset="0" stop-color="#8a6a2e" stop-opacity=".55"/>
      <stop offset="1" stop-color="#8a6a2e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bgFog" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9aa39a" stop-opacity="0"/>
      <stop offset="1" stop-color="#9aa39a" stop-opacity=".28"/>
    </linearGradient>
  </defs>
  <rect width="320" height="170" fill="url(#bgSky)"/>
  <!-- 石の大アーチ -->
  <path d="M40 170V70C40 30 80 8 160 8s120 22 120 62v100" fill="#0a0907" stroke="#3a2f22" stroke-width="5"/>
  <path d="M62 170V76C62 44 94 26 160 26s98 18 98 50v94" fill="#12100d" stroke="#2a2218" stroke-width="3"/>
  <g stroke="#2a2218" stroke-width="2" fill="none" opacity=".9">
    <path d="M40 70h22M44 100h18M40 130h22M280 70h-22M276 100h-18M280 130h-22"/>
    <path d="M160 8v18M110 14l8 14M210 14l-8 14M76 34l12 12M244 34l-12 12"/>
  </g>
  <!-- 奥の光と燭台 -->
  <rect x="62" y="26" width="196" height="144" fill="url(#bgLight)"/>
  <g fill="#e8a23a">
    <path d="M30 96c-4-8 0-14 3-18 1 6 5 8 5 14 0 4-3 6-4 6s-4-1-4-2z"/>
    <path d="M290 96c4-8 0-14-3-18-1 6-5 8-5 14 0 4 3 6 4 6s4-1 4-2z"/>
  </g>
  <g stroke="#2a2218" stroke-width="3"><path d="M34 100v34M286 100v34"/></g>
  <!-- 床と霧 -->
  <path d="M0 150h320v20H0z" fill="#0b0907"/>
  <path d="M0 150h320" stroke="#3a2f22" stroke-width="2"/>
  <g class="stage-fog"><rect x="-20" y="118" width="360" height="52" fill="url(#bgFog)"/></g>
</svg>`;

export const ENEMY_SPRITES: Record<string, string> = { slime };
