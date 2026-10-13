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


const INK = (id: string) => `
    <filter id="${id}" x="-10%" y="-10%" width="120%" height="125%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5"/>
    </filter>`;

const skeleton = `
<svg viewBox="0 0 200 160" role="img" aria-label="骸骨兵" xmlns="http://www.w3.org/2000/svg">
  <defs>${INK('inkSk')}
    <pattern id="skHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#1a1408" stroke-width="1.2" opacity=".6"/>
    </pattern>
    <radialGradient id="skGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ff5a3a"/><stop offset="1" stop-color="#ff5a3a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="100" cy="152" rx="62" ry="6" fill="#000" opacity=".55"/>
  <g filter="url(#inkSk)" stroke="#0b0905" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <!-- 錆びた剣 -->
    <path d="M150 20l8 4-6 86-8-2z" fill="#8c8f8a"/>
    <path d="M142 108l24 4" stroke="#6b4a1e" stroke-width="7" fill="none"/>
    <path d="M154 110l-2 26" stroke="#4a3418" stroke-width="7" fill="none"/>
    <!-- 肋骨・背骨 -->
    <path d="M100 84v60" stroke="#cfc6a6" stroke-width="7" fill="none"/>
    <g fill="none" stroke="#cfc6a6" stroke-width="5">
      <path d="M100 92c-22-4-34 6-36 18M100 92c22-4 34 6 36 18"/>
      <path d="M100 106c-20-2-30 8-30 18M100 106c20-2 30 8 30 18"/>
      <path d="M100 120c-16 0-24 8-24 16M100 120c16 0 24 8 24 16"/>
    </g>
    <!-- 肩当て -->
    <path d="M52 86c0-14 16-20 30-18l-4 18c-8 6-18 6-26 0z" fill="#4a4f52"/>
    <path d="M148 86c0-14-16-20-30-18l4 18c8 6 18 6 26 0z" fill="#4a4f52"/>
    <!-- 頭蓋 -->
    <ellipse cx="100" cy="48" rx="27" ry="29" fill="#d6ccac"/>
    <path d="M82 70l3 14h30l3-14z" fill="#c4b994"/>
    <!-- 兜 -->
    <path d="M71 44c0-24 14-34 29-34s29 10 29 34l-8-6h-42z" fill="#5a5f63"/>
    <path d="M100 10v26" stroke="#2a2d2f" stroke-width="4" fill="none"/>
    <path d="M71 44l-10-8M129 44l10-8" stroke="#5a5f63" stroke-width="6" fill="none"/>
    <!-- 眼窩と鼻 -->
    <ellipse cx="88" cy="52" rx="8" ry="9" fill="#0b0905"/>
    <ellipse cx="112" cy="52" rx="8" ry="9" fill="#0b0905"/>
    <path d="M100 62l-4 9h8z" fill="#0b0905"/>
    <path d="M86 78v5M93 79v6M100 79v6M107 79v6M114 78v5" stroke="#0b0905" stroke-width="2" fill="none"/>
    <!-- 円盾 -->
    <circle cx="52" cy="112" r="30" fill="#5b3a1e"/>
    <circle cx="52" cy="112" r="30" fill="url(#skHatch)"/>
    <circle cx="52" cy="112" r="22" fill="none" stroke="#8c7a52" stroke-width="3"/>
    <circle cx="52" cy="112" r="7" fill="#8c8f8a"/>
  </g>
  <ellipse cx="88" cy="52" rx="14" ry="14" fill="url(#skGlow)"/>
  <ellipse cx="112" cy="52" rx="14" ry="14" fill="url(#skGlow)"/>
  <circle cx="88" cy="53" r="2.8" fill="#ffd9a0"/><circle cx="112" cy="53" r="2.8" fill="#ffd9a0"/>
</svg>`;

const bat = `
<svg viewBox="0 0 200 160" role="img" aria-label="大蝙蝠" xmlns="http://www.w3.org/2000/svg">
  <defs>${INK('inkBt')}
    <linearGradient id="btWing" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3a5c"/><stop offset="1" stop-color="#1b1424"/>
    </linearGradient>
    <radialGradient id="btGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ff3a3a"/><stop offset="1" stop-color="#ff3a3a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="100" cy="152" rx="40" ry="5" fill="#000" opacity=".45"/>
  <g filter="url(#inkBt)" stroke="#0a0710" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <!-- 左翼 -->
    <path d="M86 66C60 40 28 38 6 52c10 4 16 12 16 22-4 4-4 14-2 20 10-8 20-8 28 0 0-10 8-18 18-20 4 10 6 24 6 38l14-34z" fill="url(#btWing)"/>
    <path d="M86 66L6 52M86 70L22 74M84 78L48 94M84 82L68 112" stroke="#8a789c" stroke-width="2.5" fill="none" opacity=".8"/>
    <!-- 右翼 -->
    <path d="M114 66C140 40 172 38 194 52c-10 4-16 12-16 22 4 4 4 14 2 20-10-8-20-8-28 0 0-10-8-18-18-20-4 10-6 24-6 38l-14-34z" fill="url(#btWing)"/>
    <path d="M114 66L194 52M114 70L178 74M116 78L152 94M116 82L132 112" stroke="#8a789c" stroke-width="2.5" fill="none" opacity=".8"/>
    <!-- 胴 -->
    <ellipse cx="100" cy="94" rx="20" ry="30" fill="#2b2236"/>
    <path d="M86 92c8 6 20 6 28 0M88 104c8 5 16 5 24 0" stroke="#4d3f5e" stroke-width="2.5" fill="none"/>
    <!-- 頭と耳 -->
    <path d="M80 36l6 22 14-4 14 4 6-22-12 12h-16z" fill="#2b2236"/>
    <ellipse cx="100" cy="56" rx="20" ry="18" fill="#3a2e48"/>
    <!-- 牙 -->
    <path d="M90 66q10 8 20 0" fill="#12090d" stroke="#0a0710" stroke-width="2.5"/>
    <path d="M93 67l2 8 3-7M102 68l3 8 2-8" fill="#e8dfc8" stroke="#0a0710" stroke-width="1.5"/>
  </g>
  <ellipse cx="91" cy="52" rx="11" ry="9" fill="url(#btGlow)"/>
  <ellipse cx="109" cy="52" rx="11" ry="9" fill="url(#btGlow)"/>
  <circle cx="91" cy="52" r="3" fill="#ffd0c0"/><circle cx="109" cy="52" r="3" fill="#ffd0c0"/>
  <path d="M82 46l16 5M118 46l-16 5" stroke="#0a0710" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const ghoul = `
<svg viewBox="0 0 200 160" role="img" aria-label="屍食鬼" xmlns="http://www.w3.org/2000/svg">
  <defs>${INK('inkGh')}
    <radialGradient id="ghSkin" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#a3ae96"/><stop offset="0.6" stop-color="#6b7a68"/><stop offset="1" stop-color="#2c352c"/>
    </radialGradient>
    <pattern id="ghHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#0a0f0a" stroke-width="1.2" opacity=".6"/>
    </pattern>
  </defs>
  <ellipse cx="100" cy="152" rx="60" ry="6" fill="#000" opacity=".55"/>
  <g filter="url(#inkGh)" stroke="#080b08" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <!-- ぼろ布 -->
    <path d="M52 154l8-52c10-12 70-12 80 0l8 52-14-8-10 10-12-10-12 10-10-10-12 10z" fill="#3a2f2a"/>
    <!-- 胴と背中の骨 -->
    <path d="M62 104c0-26 76-26 76 0 0 14-10 22-38 22s-38-8-38-22z" fill="url(#ghSkin)"/>
    <path d="M62 104c0-26 76-26 76 0 0 14-10 22-38 22s-38-8-38-22z" fill="url(#ghHatch)"/>
    <path d="M84 96h32M86 106h28M90 116h20" stroke="#1a2018" stroke-width="2.5" fill="none"/>
    <!-- 長い腕と鉤爪 -->
    <path d="M62 100C34 96 22 76 24 52" fill="none" stroke="#5c6b58" stroke-width="12"/>
    <path d="M138 100c28-4 40-24 38-48" fill="none" stroke="#5c6b58" stroke-width="12"/>
    <g fill="#e1d9bf" stroke-width="2.5">
      <path d="M14 52l8 16 4-18zM22 44l8 18 3-20zM32 48l4 18 2-18z"/>
      <path d="M186 52l-8 16-4-18zM178 44l-8 18-3-20zM168 48l-4 18-2-18z"/>
    </g>
    <!-- 頭 -->
    <path d="M66 62c-4-30 14-48 34-48s38 18 34 48c-2 14-12 22-34 22s-32-8-34-22z" fill="url(#ghSkin)"/>
    <path d="M70 70c10 10 50 10 60 0l4-8c-6 18-62 18-68 0z" fill="url(#ghHatch)"/>
    <!-- 窪んだ眼 -->
    <ellipse cx="86" cy="52" rx="10" ry="12" fill="#070a07"/>
    <ellipse cx="114" cy="52" rx="10" ry="12" fill="#070a07"/>
    <!-- 裂けた口 -->
    <path d="M80 70q20 22 40 0z" fill="#1a0808"/>
    <path d="M84 71l3 9 3-8M92 74l3 9 3-9M102 74l3 9 3-9M110 72l3 8 3-8" fill="#e1d9bf" stroke-width="1.6"/>
    <!-- 頭の傷 -->
    <path d="M96 18l-6 14 8 4-5 12" fill="none" stroke="#2a1010" stroke-width="2.5"/>
  </g>
  <circle cx="86" cy="54" r="3.5" fill="#d8e86a"/><circle cx="114" cy="54" r="3.5" fill="#d8e86a"/>
  <circle cx="86" cy="54" r="9" fill="#d8e86a" opacity=".18"/><circle cx="114" cy="54" r="9" fill="#d8e86a" opacity=".18"/>
</svg>`;

const dragon = `
<svg viewBox="0 0 220 160" role="img" aria-label="黒竜" xmlns="http://www.w3.org/2000/svg">
  <defs>${INK('inkDr')}
    <linearGradient id="drScale" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3c3340"/><stop offset="1" stop-color="#0f0b12"/>
    </linearGradient>
    <radialGradient id="drFire" cx="50%" cy="60%" r="60%">
      <stop offset="0" stop-color="#ffe27a"/><stop offset="0.5" stop-color="#ff8a2a"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/>
    </radialGradient>
    <pattern id="drHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="#050308" stroke-width="1.4" opacity=".7"/>
    </pattern>
  </defs>
  <ellipse cx="110" cy="153" rx="80" ry="6" fill="#000" opacity=".55"/>
  <g filter="url(#inkDr)" stroke="#050308" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <!-- 翼 -->
    <path d="M78 88C56 48 22 28 4 30c12 10 14 22 12 34-4 6-4 16 0 24 10-8 22-6 28 2 2-10 10-16 20-14 2 8 6 14 14 20z" fill="url(#drScale)"/>
    <path d="M142 88c22-40 56-60 74-58-12 10-14 22-12 34 4 6 4 16 0 24-10-8-22-6-28 2-2-10-10-16-20-14-2 8-6 14-14 20z" fill="url(#drScale)"/>
    <path d="M78 88L4 30M76 90L16 64M82 94L44 90M142 88l74-58M144 90l60-26M138 94l38-4" stroke="#6a5878" stroke-width="2.5" fill="none" opacity=".8"/>
    <!-- 首と胴 -->
    <path d="M70 156c0-30 14-50 40-50s40 20 40 50z" fill="url(#drScale)"/>
    <path d="M70 156c0-30 14-50 40-50s40 20 40 50z" fill="url(#drHatch)"/>
    <!-- 角 -->
    <path d="M74 38C62 22 66 8 52 2c0 18 8 34 22 48zM146 38c12-16 8-30 22-36 0 18-8 34-22 48z" fill="#cdc0a0"/>
    <!-- 頭 -->
    <path d="M72 62c-2-26 16-44 38-44s40 18 38 44c-1 14-8 26-14 34-6 8-16 12-24 12s-18-4-24-12c-6-8-13-20-14-34z" fill="url(#drScale)"/>
    <path d="M72 70c8 14 18 22 38 22s30-8 38-22l-2 12c-10 14-22 20-36 20s-26-6-36-20z" fill="url(#drHatch)"/>
    <!-- 鼻先と口 -->
    <ellipse cx="110" cy="86" rx="22" ry="14" fill="#1b141e"/>
    <path d="M96 100q14 12 28 0" fill="url(#drFire)" stroke-width="2.5"/>
    <path d="M92 94l3 12 4-10M104 98l2 12 4-12M116 98l3 12 2-12M124 94l4 12 2-14" fill="#ece3c6" stroke-width="1.6"/>
    <circle cx="102" cy="82" r="2.5" fill="#050308"/><circle cx="118" cy="82" r="2.5" fill="#050308"/>
    <!-- 眉の稜 -->
    <path d="M80 50q14-10 24 2M140 50q-14-10-24 2" fill="none" stroke-width="4"/>
  </g>
  <ellipse cx="94" cy="58" rx="12" ry="8" fill="#ff9a2a" opacity=".5"/>
  <ellipse cx="126" cy="58" rx="12" ry="8" fill="#ff9a2a" opacity=".5"/>
  <path d="M84 58q10-7 20 0q-10 6-20 0zM116 58q10-7 20 0q-10 6-20 0z" fill="#ffd24a" stroke="#050308" stroke-width="2"/>
  <ellipse cx="94" cy="58" rx="2.4" ry="5" fill="#120808"/><ellipse cx="126" cy="58" rx="2.4" ry="5" fill="#120808"/>
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

import { NEW_ENEMY_SPRITES } from './enemySprites2';

export const ENEMY_SPRITES: Record<string, string> = { slime, skeleton, bat, ghoul, dragon, ...NEW_ENEMY_SPRITES };

/** タイトル画面のイラスト: 21 を作る A と K のカードと、その背後で笑う骸骨。 */
export const TITLE_ART = `
<svg viewBox="0 0 240 180" role="img" aria-label="21を作るAとKのカードと骸骨" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="inkTt" x="-10%" y="-10%" width="120%" height="125%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="9" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5"/>
    </filter>
    <radialGradient id="ttGlow" cx="50%" cy="55%" r="55%">
      <stop offset="0" stop-color="#ff9a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a2a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ttBone" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#ece3c6"/><stop offset="1" stop-color="#a99d7c"/>
    </radialGradient>
    <linearGradient id="ttCard" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e8dab0"/><stop offset="1" stop-color="#bba974"/>
    </linearGradient>
    <pattern id="ttHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="#1a1408" stroke-width="1.2" opacity=".55"/>
    </pattern>
  </defs>
  <ellipse cx="120" cy="100" rx="110" ry="80" fill="url(#ttGlow)"/>
  <g filter="url(#inkTt)" stroke="#0b0905" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
    <!-- 骸骨 -->
    <ellipse cx="120" cy="66" rx="44" ry="47" fill="url(#ttBone)"/>
    <ellipse cx="120" cy="66" rx="44" ry="47" fill="url(#ttHatch)" opacity=".5"/>
    <path d="M98 104l4 22h36l4-22z" fill="#c4b994"/>
    <ellipse cx="103" cy="68" rx="12" ry="14" fill="#0b0905"/>
    <ellipse cx="137" cy="68" rx="12" ry="14" fill="#0b0905"/>
    <path d="M120 82l-6 13h12z" fill="#0b0905"/>
    <path d="M104 106v14M112 108v16M120 108v16M128 108v16M136 106v14" stroke-width="2.2" fill="none"/>
    <path d="M86 40c6-12 18-20 34-20" stroke-width="3" fill="none" opacity=".6"/>
    <!-- 左のカード: A -->
    <g transform="translate(68 112) rotate(-16)">
      <rect x="-30" y="-46" width="60" height="92" rx="6" fill="url(#ttCard)"/>
      <text x="-21" y="-24" font-family="Cinzel, serif" font-size="22" font-weight="800" fill="#17110c" stroke="none">A</text>
      <text x="0" y="14" text-anchor="middle" font-size="46" fill="#17110c" stroke="none">♠</text>
    </g>
    <!-- 右のカード: K -->
    <g transform="translate(172 112) rotate(16)">
      <rect x="-30" y="-46" width="60" height="92" rx="6" fill="url(#ttCard)"/>
      <text x="-21" y="-24" font-family="Cinzel, serif" font-size="22" font-weight="800" fill="#17110c" stroke="none">K</text>
      <text x="0" y="14" text-anchor="middle" font-size="46" fill="#17110c" stroke="none">♠</text>
    </g>
  </g>
  <circle cx="103" cy="70" r="3.4" fill="#ffd9a0"/><circle cx="137" cy="70" r="3.4" fill="#ffd9a0"/>
  <circle cx="103" cy="70" r="11" fill="#ff7a2a" opacity=".3"/><circle cx="137" cy="70" r="11" fill="#ff7a2a" opacity=".3"/>
</svg>`;
