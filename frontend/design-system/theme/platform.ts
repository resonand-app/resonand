/**
 * Whether this device's keyboard shortcut key is ⌘ rather than Ctrl.
 *
 * `keyboard.ts` (`UI-4g`) already answers `metaKey || ctrlKey` for the one chord in the product,
 * so the binding itself has always worked everywhere -- what was wrong was only the two
 * characters `SearchField` printed next to it, hard-coded to the Mac's own symbol regardless of
 * who was looking at it. `userAgentData` is the modern, structured answer where a browser gives
 * one; `platform` is the older field every browser still fills in -- deprecated in the spec, but
 * not removed, and there is nothing else to fall back to for the rest.
 */
export function isApplePlatform(
  platform: string = typeof navigator === 'undefined'
    ? ''
    : ((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ?? navigator.platform),
): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}
