/**
 * 場所ごとの挿絵（インライン SVG）。敵のスプライトと同じ、ペン画の線の揺らぎ（feDisplacementMap）と
 * 陰影で描いた、横長の場面。お店・祠・宿屋・スキル獲得・宝箱（遺物）の画面の上に置く。外部の画像は使わない（自作）。
 */
export type SceneKind = 'shop' | 'shrine' | 'inn' | 'reward' | 'chest';

const INK = (p: string) => `<filter id="${p}ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>`;
const HATCH = (p: string, c: string) => `<pattern id="${p}hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="0" y1="0" x2="0" y2="5" stroke="${c}" stroke-width="1.2" opacity=".55"/></pattern>`;

/** お店: 夜の露店。吊りランタンの灯り、ひさしの下に商人、台の上にゴールドと秤、後ろの棚に瓶と巻物。 */
const shop = `
<svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="夜の露店。ランタンの灯りの下で、フードをかぶった商人が品物を並べている" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${INK('sh')}${HATCH('sh', '#0a0604')}
    <linearGradient id="shSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150e0a"/><stop offset="1" stop-color="#4a2c14"/></linearGradient>
    <radialGradient id="shLamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd87a" stop-opacity="1"/><stop offset=".45" stop-color="#e8962a" stop-opacity=".5"/><stop offset="1" stop-color="#e8962a" stop-opacity="0"/></radialGradient>
    <linearGradient id="shWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4424"/><stop offset="1" stop-color="#2c1a0d"/></linearGradient>
  </defs>
  <rect width="360" height="140" fill="url(#shSky)"/>
  <g filter="url(#shink)">
    <!-- 後ろの棚 -->
    <rect x="22" y="34" width="150" height="62" fill="#22150b" stroke="#0a0604" stroke-width="2"/>
    <line x1="22" y1="62" x2="172" y2="62" stroke="#0a0604" stroke-width="3"/>
    <g stroke="#0a0604" stroke-width="1.6">
      <path d="M36 62 v-16 q0-5 5-5 h4 q5 0 5 5 v16z" fill="#7a3b3b"/><rect x="39" y="35" width="8" height="6" fill="#b99a5c"/>
      <path d="M62 62 v-12 q0-8 9-8 q9 0 9 8 v12z" fill="#3e6b86"/><rect x="68" y="36" width="6" height="6" fill="#b99a5c"/>
      <rect x="92" y="44" width="26" height="18" rx="2" fill="#c9b27a"/><rect x="95" y="47" width="20" height="3" fill="#7e1b1b"/>
      <path d="M130 62 v-14 q0-6 6-6 h6 q6 0 6 6 v14z" fill="#4f7a5c"/><rect x="135" y="36" width="8" height="6" fill="#b99a5c"/>
      <circle cx="158" cy="54" r="8" fill="#8b6bb0"/>
      <rect x="34" y="82" width="40" height="14" rx="2" fill="#3a2a1a"/><rect x="86" y="76" width="22" height="20" rx="2" fill="#5a4630"/><circle cx="130" cy="90" r="9" fill="#9a8d72"/><rect x="146" y="80" width="18" height="16" fill="#7a3b3b"/>
    </g>
    <rect x="22" y="34" width="150" height="62" fill="url(#shhatch)"/>
    <!-- ひさし -->
    <path d="M6 30 L354 30 L336 8 L24 8 Z" fill="#7a3b1a" stroke="#0a0604" stroke-width="2"/>
    <g fill="#c9b27a" stroke="#0a0604" stroke-width="1.5"><path d="M24 8 h48 l-6 22 h-52z" opacity=".9"/><path d="M120 8 h48 l-4 22 h-48z" opacity=".9"/><path d="M216 8 h48 l-4 22 h-48z" opacity=".9"/><path d="M312 8 h24 l18 22 h-48z" opacity=".9"/></g>
    <path d="M6 30 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0 q14 10 28 0" fill="#5c2a10" stroke="#0a0604" stroke-width="2"/>
    <!-- 商人 -->
    <path d="M222 112 q-6-44 22-50 q28 6 22 50z" fill="#2a2630" stroke="#0a0604" stroke-width="2.2"/>
    <path d="M222 112 q-6-44 22-50 q28 6 22 50z" fill="url(#shhatch)"/>
    <path d="M228 66 q16-26 32 0 q-16 12-32 0z" fill="#1a1620" stroke="#0a0604" stroke-width="2.2"/>
    <ellipse cx="244" cy="68" rx="9" ry="7" fill="#0a0806"/>
    <circle cx="240" cy="68" r="1.8" fill="#ffd87a"/><circle cx="248" cy="68" r="1.8" fill="#ffd87a"/>
    <path d="M252 96 q22 4 34 -6" fill="none" stroke="#2a2630" stroke-width="7" stroke-linecap="round"/><circle cx="288" cy="90" r="4.5" fill="#c9a77a" stroke="#0a0604" stroke-width="1.5"/>
    <!-- カウンター -->
    <rect x="150" y="106" width="200" height="34" fill="url(#shWood)" stroke="#0a0604" stroke-width="2.4"/>
    <rect x="144" y="100" width="212" height="10" fill="#8a5a30" stroke="#0a0604" stroke-width="2.4"/>
    <g stroke="#0a0604" stroke-width="1.5">
      <ellipse cx="180" cy="98" rx="9" ry="3.2" fill="#e0b04a"/><ellipse cx="180" cy="94" rx="9" ry="3.2" fill="#f2c85c"/><ellipse cx="180" cy="90" rx="9" ry="3.2" fill="#e0b04a"/>
      <ellipse cx="200" cy="98" rx="9" ry="3.2" fill="#e0b04a"/><ellipse cx="200" cy="94" rx="9" ry="3.2" fill="#f2c85c"/>
      <path d="M312 98 l16-26 l16 26z" fill="none"/><line x1="328" y1="72" x2="328" y2="98"/><line x1="308" y1="80" x2="348" y2="80"/><path d="M308 80 q-8 8 0 12 h16 q-1-6 -16-12z" fill="#c9a77a"/><path d="M348 80 q8 8 0 12 h-16 q1-6 16-12z" fill="#c9a77a"/>
    </g>
  </g>
  <!-- 吊りランタン -->
  <g>
    <circle cx="96" cy="26" r="46" fill="url(#shLamp)" class="sc-glow"/>
    <line x1="96" y1="8" x2="96" y2="18" stroke="#0a0604" stroke-width="2"/>
    <g filter="url(#shink)"><rect x="88" y="18" width="16" height="22" rx="3" fill="#ffd87a" stroke="#0a0604" stroke-width="2.2"/><line x1="96" y1="18" x2="96" y2="40" stroke="#0a0604" stroke-width="1.4"/></g>
  </g>
</svg>`;

/** 祠: 夜の石の祠。月の光、石の台と古い文字、左右の青白い炎。 */
const shrine = `
<svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="月夜の祠。石の祭壇の左右で、青白い炎が燃えている" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${INK('sr')}${HATCH('sr', '#04050c')}
    <linearGradient id="srSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0d22"/><stop offset="1" stop-color="#262a52"/></linearGradient>
    <radialGradient id="srMoon" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#e6ecff" stop-opacity=".95"/><stop offset=".5" stop-color="#8e9cff" stop-opacity=".3"/><stop offset="1" stop-color="#8e9cff" stop-opacity="0"/></radialGradient>
    <radialGradient id="srFlame" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#d8f0ff" stop-opacity="1"/><stop offset=".5" stop-color="#5aa8ff" stop-opacity=".55"/><stop offset="1" stop-color="#5aa8ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="srStone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3f58"/><stop offset=".5" stop-color="#6b7194"/><stop offset="1" stop-color="#303450"/></linearGradient>
  </defs>
  <rect width="360" height="140" fill="url(#srSky)"/>
  <circle cx="300" cy="34" r="40" fill="url(#srMoon)"/><circle cx="300" cy="34" r="13" fill="#e8edff"/>
  <g fill="#e8edff" opacity=".8"><circle cx="40" cy="20" r="1.3"/><circle cx="96" cy="38" r="1"/><circle cx="150" cy="16" r="1.4"/><circle cx="214" cy="30" r="1"/><circle cx="20" cy="60" r="1"/><circle cx="250" cy="14" r="1.1"/></g>
  <g filter="url(#srink)">
    <!-- 遠くの木々 -->
    <path d="M0 110 L20 70 L40 108 L58 62 L82 110 L100 80 L122 112 L240 112 L262 84 L284 110 L306 66 L330 112 L360 96 L360 140 L0 140z" fill="#0d1022" stroke="#04050c" stroke-width="2"/>
    <!-- 地面 -->
    <path d="M0 112 Q180 100 360 112 L360 140 L0 140z" fill="#14172e" stroke="#04050c" stroke-width="2"/>
    <!-- 石の祠 -->
    <path d="M132 112 V58 L180 28 L228 58 V112z" fill="url(#srStone)" stroke="#04050c" stroke-width="2.6"/>
    <path d="M132 112 V58 L180 28 L228 58 V112z" fill="url(#srhatch)"/>
    <path d="M150 112 V72 q0-22 30-22 q30 0 30 22 V112z" fill="#080a18" stroke="#04050c" stroke-width="2.4"/>
    <rect x="124" y="108" width="112" height="10" fill="#4a5070" stroke="#04050c" stroke-width="2.4"/><rect x="116" y="116" width="128" height="9" fill="#3a3f5c" stroke="#04050c" stroke-width="2.4"/>
    <!-- 左右の台と炎 -->
    <rect x="86" y="92" width="18" height="24" fill="#4a5070" stroke="#04050c" stroke-width="2.2"/><rect x="82" y="88" width="26" height="6" fill="#6b7194" stroke="#04050c" stroke-width="2"/>
    <rect x="256" y="92" width="18" height="24" fill="#4a5070" stroke="#04050c" stroke-width="2.2"/><rect x="252" y="88" width="26" height="6" fill="#6b7194" stroke="#04050c" stroke-width="2"/>
  </g>
  <circle cx="95" cy="74" r="30" fill="url(#srFlame)" class="sc-glow"/><circle cx="265" cy="74" r="30" fill="url(#srFlame)" class="sc-glow"/>
  <g filter="url(#srink)" class="sc-flame">
    <path d="M95 88 q-9-10 -3-22 q3 7 6 5 q-1-9 4-14 q8 14 4 31z" fill="#bfe4ff" stroke="#04050c" stroke-width="1.6"/>
    <path d="M265 88 q-9-10 -3-22 q3 7 6 5 q-1-9 4-14 q8 14 4 31z" fill="#bfe4ff" stroke="#04050c" stroke-width="1.6"/>
  </g>
  <!-- 古い文字（ほのかに光る） -->
  <g fill="none" stroke="#8cc4ff" stroke-width="2" stroke-linecap="round" opacity=".85" class="sc-glow"><path d="M170 74 h20 M180 74 v18 M172 84 h16 M176 94 q4-4 8 0"/><circle cx="180" cy="62" r="5"/></g>
</svg>`;

/** 宿屋: 夜の部屋。左に暖炉、真ん中に月の見える窓、右にベッド、梁から吊るしたランプ。 */
const inn = `
<svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="宿屋の部屋。暖炉の火がともり、窓の外には月が出ている。右にベッドがある" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${INK('in')}${HATCH('in', '#0a0504')}
    <linearGradient id="inWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1810"/><stop offset="1" stop-color="#4a2a1a"/></linearGradient>
    <radialGradient id="inFire" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="#ffc766" stop-opacity="1"/><stop offset=".5" stop-color="#e8622a" stop-opacity=".5"/><stop offset="1" stop-color="#e8622a" stop-opacity="0"/></radialGradient>
    <linearGradient id="inFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2212"/><stop offset="1" stop-color="#1c1008"/></linearGradient>
    <linearGradient id="inWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16204a"/><stop offset="1" stop-color="#2c3a78"/></linearGradient>
  </defs>
  <rect width="360" height="140" fill="url(#inWall)"/>
  <g filter="url(#inink)">
    <rect width="360" height="12" fill="#2c1a0c" stroke="#0a0504" stroke-width="2.2"/>
    <rect y="108" width="360" height="32" fill="url(#inFloor)" stroke="#0a0504" stroke-width="2.4"/>
    <g stroke="#0a0504" stroke-width="1.4" opacity=".8"><line x1="0" y1="124" x2="360" y2="124"/><line x1="60" y1="108" x2="40" y2="140"/><line x1="150" y1="108" x2="140" y2="140"/><line x1="250" y1="108" x2="258" y2="140"/><line x1="340" y1="108" x2="360" y2="140"/></g>
    <!-- 暖炉 -->
    <path d="M18 110 V58 q0-12 12-12 h60 q12 0 12 12 V110z" fill="#6a5a50" stroke="#0a0504" stroke-width="2.6"/>
    <path d="M18 110 V58 q0-12 12-12 h60 q12 0 12 12 V110z" fill="url(#inhatch)"/>
    <path d="M36 110 V72 q0-12 12-12 h24 q12 0 12 12 V110z" fill="#120804" stroke="#0a0504" stroke-width="2.2"/>
    <rect x="14" y="40" width="88" height="8" fill="#8a7a6a" stroke="#0a0504" stroke-width="2.2"/>
    <!-- 窓 -->
    <rect x="140" y="30" width="62" height="56" fill="url(#inWin)" stroke="#0a0504" stroke-width="3"/>
    <line x1="171" y1="30" x2="171" y2="86" stroke="#0a0504" stroke-width="3"/><line x1="140" y1="58" x2="202" y2="58" stroke="#0a0504" stroke-width="3"/>
    <circle cx="188" cy="44" r="7" fill="#f0f2ff"/><circle cx="154" cy="68" r="1.2" fill="#f0f2ff"/><circle cx="160" cy="40" r="1" fill="#f0f2ff"/>
    <!-- ベッド -->
    <rect x="252" y="76" width="96" height="34" fill="#5a3a22" stroke="#0a0504" stroke-width="2.6"/>
    <rect x="248" y="58" width="12" height="56" fill="#3c2414" stroke="#0a0504" stroke-width="2.4"/><rect x="342" y="66" width="10" height="48" fill="#3c2414" stroke="#0a0504" stroke-width="2.4"/>
    <path d="M262 76 q0-12 20-12 h18 q8 0 8 8 v6z" fill="#e8dcc0" stroke="#0a0504" stroke-width="2.2"/>
    <path d="M262 84 h82 v22 h-82z" fill="#7e2a2a" stroke="#0a0504" stroke-width="2.4"/><path d="M262 84 h82 v22 h-82z" fill="url(#inhatch)"/>
    <path d="M262 90 q10 6 20 0 q10 6 20 0 q10 6 20 0 q10 6 22 0" fill="none" stroke="#b34a4a" stroke-width="2"/>
    <!-- 梁から吊るしたランプ -->
    <line x1="226" y1="12" x2="226" y2="24" stroke="#0a0504" stroke-width="2"/>
    <rect x="218" y="24" width="16" height="18" rx="3" fill="#ffd87a" stroke="#0a0504" stroke-width="2.2"/>
  </g>
  <circle cx="226" cy="34" r="40" fill="url(#inFire)" opacity=".55" class="sc-glow"/>
  <circle cx="60" cy="96" r="44" fill="url(#inFire)" class="sc-glow"/>
  <g filter="url(#inink)" class="sc-flame">
    <path d="M44 108 q-4-14 6-24 q2 8 6 6 q0-10 6-16 q12 16 6 34z" fill="#ffc766" stroke="#0a0504" stroke-width="1.8"/>
    <path d="M52 108 q-2-8 4-14 q4 6 3 14z" fill="#fff0b0"/>
    <path d="M40 110 l34-8 M44 104 l30 8" stroke="#2c1a0c" stroke-width="4" stroke-linecap="round"/>
  </g>
</svg>`;

/** 挿絵の SVG（テストが、参照先の id がそろっているかを確かめる）。 */

/** スキル獲得: 書見台に開いた古い書。ページから光る文字が浮かび、左右に蝋燭。 */
const reward = `
<svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="書見台の上に開いた古い書。ページから光る文字が浮かび上がり、左右で蝋燭が燃えている" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${INK('rw')}${HATCH('rw', '#060403')}
    <linearGradient id="rwBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0b14"/><stop offset="1" stop-color="#2a1d14"/></linearGradient>
    <radialGradient id="rwGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#f2e2a8" stop-opacity=".95"/><stop offset=".45" stop-color="#c9a24a" stop-opacity=".4"/><stop offset="1" stop-color="#c9a24a" stop-opacity="0"/></radialGradient>
    <radialGradient id="rwCandle" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#e8962a" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="360" height="140" fill="url(#rwBg)"/>
  <circle cx="180" cy="64" r="70" fill="url(#rwGlow)" class="sc-glow"/>
  <g filter="url(#rwink)">
    <!-- 石の床 -->
    <path d="M0 116 Q180 106 360 116 L360 140 L0 140z" fill="#1c140e" stroke="#060403" stroke-width="2"/>
    <!-- 書見台 -->
    <path d="M166 116 L172 92 L188 92 L194 116z" fill="#4a2e18" stroke="#060403" stroke-width="2.2"/>
    <rect x="150" y="112" width="60" height="8" fill="#3a2414" stroke="#060403" stroke-width="2"/>
    <path d="M128 92 L180 80 L232 92 L224 98 L180 88 L136 98z" fill="#5c3a1e" stroke="#060403" stroke-width="2.2"/>
    <!-- 開いた書 -->
    <path d="M132 86 Q156 70 180 80 Q204 70 228 86 L228 90 Q204 76 180 86 Q156 76 132 90z" fill="#d8c79c" stroke="#060403" stroke-width="2.2"/>
    <path d="M132 86 Q156 70 180 80 L180 86 Q156 76 132 90z" fill="url(#rwhatch)"/>
    <g stroke="#7a6440" stroke-width="1.2"><path d="M144 82 q12-6 28-2"/><path d="M146 86 q12-6 26-2"/><path d="M188 80 q16-4 28 2"/><path d="M188 84 q14-4 26 2"/></g>
    <!-- 蝋燭 -->
    <rect x="60" y="88" width="12" height="28" fill="#d8c79c" stroke="#060403" stroke-width="2"/><rect x="54" y="114" width="24" height="6" fill="#5a4630" stroke="#060403" stroke-width="2"/>
    <rect x="288" y="92" width="12" height="24" fill="#d8c79c" stroke="#060403" stroke-width="2"/><rect x="282" y="114" width="24" height="6" fill="#5a4630" stroke="#060403" stroke-width="2"/>
  </g>
  <circle cx="66" cy="80" r="22" fill="url(#rwCandle)" class="sc-glow"/><circle cx="294" cy="84" r="22" fill="url(#rwCandle)" class="sc-glow"/>
  <g filter="url(#rwink)" class="sc-flame"><path d="M66 88 q-6-8 0-16 q6 8 0 16z" fill="#ffe2a0" stroke="#060403" stroke-width="1.4"/><path d="M294 92 q-6-8 0-16 q6 8 0 16z" fill="#ffe2a0" stroke="#060403" stroke-width="1.4"/></g>
  <!-- 浮かぶ光る文字 -->
  <g fill="none" stroke="#f6e6b8" stroke-width="2" stroke-linecap="round" class="sc-glow">
    <path d="M160 58 h10 M165 52 v12"/><path d="M182 44 l6 6 l-6 6 l-6 -6z"/><path d="M198 60 q6-8 12 0"/><circle cx="174" cy="32" r="3"/><path d="M150 40 l4 4 M154 40 l-4 4"/>
  </g>
</svg>`;

/** 宝箱: 石の床に、蓋の開いた宝箱。中から金の光があふれ、まわりに金貨。 */
const chest = `
<svg viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="蓋の開いた宝箱。中から金色の光があふれ、まわりに金貨が散らばっている" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${INK('ch')}${HATCH('ch', '#060403')}
    <linearGradient id="chBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0a08"/><stop offset="1" stop-color="#2e2010"/></linearGradient>
    <radialGradient id="chGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff0b0" stop-opacity="1"/><stop offset=".4" stop-color="#e0b04a" stop-opacity=".5"/><stop offset="1" stop-color="#e0b04a" stop-opacity="0"/></radialGradient>
    <linearGradient id="chWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a22"/><stop offset="1" stop-color="#3a2210"/></linearGradient>
  </defs>
  <rect width="360" height="140" fill="url(#chBg)"/>
  <!-- 石の壁の目地 -->
  <g stroke="#060403" stroke-width="1.5" opacity=".6" fill="none"><path d="M0 30 H360 M0 60 H360 M0 90 H360"/><path d="M40 0 V30 M120 0 V30 M200 0 V30 M280 0 V30 M80 30 V60 M160 30 V60 M240 30 V60 M320 30 V60 M40 60 V90 M120 60 V90 M280 60 V90"/></g>
  <circle cx="180" cy="66" r="80" fill="url(#chGlow)" class="sc-glow"/>
  <!-- 光の筋 -->
  <g fill="#f6dc8a" opacity=".22" class="sc-glow"><path d="M180 70 L130 0 H150z"/><path d="M180 70 L200 0 H222z"/><path d="M180 70 L250 0 H262z"/><path d="M180 70 L96 0 H104z"/></g>
  <g filter="url(#chink)">
    <path d="M0 118 Q180 108 360 118 L360 140 L0 140z" fill="#1e150c" stroke="#060403" stroke-width="2"/>
    <!-- 開いた蓋 -->
    <path d="M136 74 L142 40 Q180 26 218 40 L224 74z" fill="url(#chWood)" stroke="#060403" stroke-width="2.4"/>
    <path d="M136 74 L142 40 Q180 26 218 40 L224 74z" fill="url(#chhatch)"/>
    <path d="M160 72 L163 36 M197 36 L200 72" stroke="#c9a24a" stroke-width="4"/>
    <!-- 中の金貨 -->
    <path d="M138 80 Q150 64 166 72 Q180 60 196 72 Q210 64 222 80z" fill="#e8bd52" stroke="#060403" stroke-width="2"/>
    <!-- 箱 -->
    <rect x="134" y="78" width="92" height="40" rx="3" fill="url(#chWood)" stroke="#060403" stroke-width="2.4"/>
    <rect x="134" y="78" width="92" height="40" rx="3" fill="url(#chhatch)"/>
    <path d="M134 90 H226 M160 78 V118 M200 78 V118" stroke="#c9a24a" stroke-width="4"/>
    <path d="M180 86 l7 8 l-7 8 l-7 -8z" fill="#7fb6e8" stroke="#060403" stroke-width="2"/>
    <!-- 散らばった金貨 -->
    <g fill="#e8bd52" stroke="#060403" stroke-width="1.6"><ellipse cx="112" cy="120" rx="7" ry="3.5"/><ellipse cx="124" cy="126" rx="6" ry="3"/><ellipse cx="246" cy="122" rx="7" ry="3.5"/><ellipse cx="262" cy="127" rx="6" ry="3"/><ellipse cx="236" cy="130" rx="5" ry="2.5"/></g>
  </g>
  <g fill="#fff6d0" class="sc-glow"><path d="M120 50 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z"/><path d="M246 40 l1.6 5 l5 1.6 l-5 1.6 l-1.6 5 l-1.6 -5 l-5 -1.6 l5 -1.6z"/></g>
</svg>`;

export const SCENES: Record<SceneKind, string> = { shop, shrine, inn, reward, chest };

/** 挿絵つきの見出し。`caption` はひとこと（商人・宿の主人のセリフなど）。aria-live で読み上げる。 */
export function buildScene(kind: SceneKind, title: string, caption = ''): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = `scene scene--${kind}`;
  const art = document.createElement('div');
  art.className = 'scene__art';
  art.innerHTML = SCENES[kind];
  const cap = document.createElement('figcaption');
  cap.className = 'scene__caption';
  const h = document.createElement('strong');
  h.className = 'scene__title';
  h.textContent = title;
  const line = document.createElement('span');
  line.className = 'scene__line';
  line.setAttribute('aria-live', 'polite');
  line.textContent = caption;
  cap.append(h, line);
  fig.append(art, cap);
  return fig;
}
