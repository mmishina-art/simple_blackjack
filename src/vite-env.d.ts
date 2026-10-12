/// <reference types="vite/client" />

/** package.json の version。vite.config.ts が埋め込む（タイトル画面に表示する） */
declare const __APP_VERSION__: string;

interface Window {
  /** 起動できたら true。public/boot.js が、起動に失敗したかの判定に使う */
  __appStarted?: boolean;
}
