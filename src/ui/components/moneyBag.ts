/**
 * お金（ゴールド）の選択肢・表示に使うドル袋（Money Bag）の絵。
 * スキル（丸メダル）や道具（角丸四角）・防具（盾）・遺物（六角形）と明確に区別するため、
 * 丸枠を持たず、革・麻の巾着袋（ドル袋）のシルエットそのもので描く。
 */
export function moneyBagSvg(): string {
  return `<svg class="moneybag-svg" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="mbBag" cx="38%" cy="40%" r="58%">
      <stop offset="0%" stop-color="#9e7336"/>
      <stop offset="35%" stop-color="#6e4c1e"/>
      <stop offset="70%" stop-color="#3e260c"/>
      <stop offset="100%" stop-color="#180e04"/>
    </radialGradient>
    <linearGradient id="mbFrill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#aa7e3c"/>
      <stop offset="50%" stop-color="#6c481a"/>
      <stop offset="100%" stop-color="#2a1606"/>
    </linearGradient>
    <linearGradient id="mbRope" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff2b2"/>
      <stop offset="40%" stop-color="#e6c878"/>
      <stop offset="80%" stop-color="#a67c24"/>
      <stop offset="100%" stop-color="#4a340a"/>
    </linearGradient>
    <linearGradient id="mbGold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffce8"/>
      <stop offset="30%" stop-color="#fae086"/>
      <stop offset="70%" stop-color="#d4a438"/>
      <stop offset="100%" stop-color="#7a5210"/>
    </linearGradient>
    <filter id="mbShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.8"/>
    </filter>
  </defs>

  <g filter="url(#mbShadow)">
    <!-- 上部の口布（フリル） -->
    <path d="M 19 16 C 16.5 11.5, 14 9, 15.5 7.5 C 17.5 7, 19.5 9.5, 21.5 8 C 23.5 6.5, 25 7, 26.5 8 C 28.5 9.5, 30.5 7, 32.5 7.5 C 34 9, 31.5 11.5, 29 16 Z"
          fill="url(#mbFrill)" stroke="#1a0e04" stroke-width="1.2" stroke-linejoin="round"/>
    <!-- 口布のひだ・陰影 -->
    <path d="M 21.5 8.5 C 22 11, 21.5 13.5, 21 16 M 26.5 8.5 C 26 11, 26.5 13.5, 27 16"
          stroke="#180e04" stroke-width="1" fill="none" opacity="0.7"/>

    <!-- 袋の胴体 -->
    <path d="M 19 15.5
             C 12.5 17, 7 23, 7 31
             C 7 39.5, 12.5 44, 19 44.5
             L 29 44.5
             C 35.5 44, 41 39.5, 41 31
             C 41 23, 35.5 17, 29 15.5
             Z"
          fill="url(#mbBag)" stroke="#1a0e04" stroke-width="1.4" stroke-linejoin="round"/>

    <!-- 本体の陰影・ハッチング（右下の影） -->
    <path d="M 33 42 C 37 38, 38.5 34, 38.5 30
             M 29 43.5 C 34 41.5, 36.5 36.5, 36.5 33
             M 25 44 C 30 42.5, 33 39, 34 35"
          stroke="#0e0702" stroke-width="0.9" fill="none" opacity="0.65" stroke-linecap="round"/>

    <!-- 本体のハイライト（左上の光） -->
    <path d="M 13 23 C 10 27, 10 32, 13 36"
          stroke="#f0d78c" stroke-width="1.1" fill="none" opacity="0.35" stroke-linecap="round"/>

    <!-- 縛り紐（首まわり） -->
    <rect x="18" y="14.2" width="12" height="3.2" rx="1.6"
          fill="url(#mbRope)" stroke="#1a0e04" stroke-width="1"/>
    <!-- 結び目 -->
    <ellipse cx="24" cy="15.8" rx="2.4" ry="2"
             fill="url(#mbRope)" stroke="#1a0e04" stroke-width="0.9"/>
    <!-- 垂れ下がる紐の端 -->
    <path d="M 23 16.5 Q 20 20, 18.5 24"
          stroke="url(#mbRope)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M 23 16.5 Q 20 20, 18.5 24"
          stroke="#1a0e04" stroke-width="0.6" fill="none" opacity="0.7"/>
    <circle cx="18.5" cy="24" r="1.3" fill="url(#mbRope)" stroke="#1a0e04" stroke-width="0.7"/>

    <path d="M 25 16.5 Q 26.5 20.5, 28 25"
          stroke="url(#mbRope)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M 25 16.5 Q 26.5 20.5, 28 25"
          stroke="#1a0e04" stroke-width="0.6" fill="none" opacity="0.7"/>
    <circle cx="28" cy="25" r="1.3" fill="url(#mbRope)" stroke="#1a0e04" stroke-width="0.7"/>

    <!-- 「$」マーク（ドル袋の象徴） -->
    <!-- 縦棒（上下の貫通バー） -->
    <path d="M 24 21.5 L 24 39.5"
          stroke="#180e04" stroke-width="3" stroke-linecap="round"/>
    <path d="M 24 22 L 24 39"
          stroke="url(#mbGold)" stroke-width="1.8" stroke-linecap="round"/>

    <!-- 「S」文字（クラシック・ボールドセリフ） -->
    <path d="M 28.5 25.5
             C 28 24.2, 26.5 23.2, 24 23.2
             C 21.2 23.2, 19.5 24.5, 19.5 26.5
             C 19.5 28.4, 21 29.3, 23.5 30
             L 24.5 30.3
             C 27.2 31.1, 29 32.2, 29 34.5
             C 29 36.8, 27 38.2, 24 38.2
             C 21 38.2, 19.2 37, 18.8 35"
          stroke="#180e04" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M 28.5 25.5
             C 28 24.2, 26.5 23.2, 24 23.2
             C 21.2 23.2, 19.5 24.5, 19.5 26.5
             C 19.5 28.4, 21 29.3, 23.5 30
             L 24.5 30.3
             C 27.2 31.1, 29 32.2, 29 34.5
             C 29 36.8, 27 38.2, 24 38.2
             C 21 38.2, 19.2 37, 18.8 35"
          stroke="url(#mbGold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>

  <!-- 金貨のきらめき（スパークル） -->
  <path d="M 39 10 L 40 12.5 L 42.5 13.5 L 40 14.5 L 39 17 L 38 14.5 L 35.5 13.5 L 38 12.5 Z"
        fill="url(#mbGold)" stroke="#1a0e04" stroke-width="0.6"/>
  <circle cx="39" cy="13.5" r="0.8" fill="#ffffff"/>

  <path d="M 7 37 L 7.8 38.8 L 9.6 39.5 L 7.8 40.2 L 7 42 L 6.2 40.2 L 4.4 39.5 L 6.2 38.8 Z"
        fill="url(#mbGold)" stroke="#1a0e04" stroke-width="0.5"/>
</svg>`;
}
