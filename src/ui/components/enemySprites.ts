/** 敵IDごとのスプライト（インラインSVG）。新しい敵はここに追加する。 */
const slime = `
<svg viewBox="0 0 160 120" role="img" aria-label="スライム" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="slimeBody" cx="38%" cy="28%" r="85%">
      <stop offset="0" stop-color="#b6f7b0"/>
      <stop offset="0.55" stop-color="#4fc46d"/>
      <stop offset="1" stop-color="#238a4a"/>
    </radialGradient>
  </defs>
  <ellipse cx="80" cy="112" rx="58" ry="7" fill="rgba(0,0,0,.35)"/>
  <path d="M18 102C12 60 40 16 80 16s68 44 62 86c-2 8-14 10-22 8H40c-8 2-20 0-22-8z"
        fill="url(#slimeBody)" stroke="#1b6a37" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="52" cy="42" rx="14" ry="8" fill="#fff" opacity=".45" transform="rotate(-28 52 42)"/>
  <g class="slime-eyes">
    <ellipse cx="60" cy="68" rx="11" ry="14" fill="#fff"/>
    <ellipse cx="100" cy="68" rx="11" ry="14" fill="#fff"/>
    <circle cx="63" cy="72" r="6" fill="#16301f"/>
    <circle cx="97" cy="72" r="6" fill="#16301f"/>
    <circle cx="65" cy="69" r="2" fill="#fff"/>
    <circle cx="99" cy="69" r="2" fill="#fff"/>
  </g>
  <path d="M68 90q12 10 24 0" fill="none" stroke="#16301f" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export const ENEMY_SPRITES: Record<string, string> = { slime };
