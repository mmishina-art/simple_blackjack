export type Platform = 'ios' | 'android' | 'pc';

/** 端末の種類を判定する。iPadOS は Mac を名乗るので、タッチできる Mac は iPad とみなす。 */
export function detectPlatform(userAgent: string, platform = '', maxTouchPoints = 0): Platform {
  if (/iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(userAgent)) return 'android';
  return 'pc';
}
