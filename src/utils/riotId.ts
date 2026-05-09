/**
 * Normalize pasted Riot IDs: clients sometimes insert full-width # (U+FF03) / small-number sign # (U+FE5F),
 * stray zero-width chars, odd spaces, etc. Game names may include ASCII spaces ("miffy lvr#sharp").
 */

const FULLWIDTH_HASH = /\uFF03/g;
const SMALL_NUM_SIGN_HASH = /\uFE5F/g;
const BOM_OR_ZW_JOINER = /\uFEFF|\u2060|\u200B|\u200C|\u200D/g;

/** Turn common lookalikes into ASCII `#` without altering the gamer/tag content otherwise. */

export function normalizeRiotIdInput(raw: string): string {
  return raw
    .replace(BOM_OR_ZW_JOINER, '')
    .trim()
    .replace(FULLWIDTH_HASH, '#')
    .replace(SMALL_NUM_SIGN_HASH, '#')
    /** Collapse pasted tabs/newlines/non-breaking spacing so `miffy⏎lvr` still parses cleanly */

    .replace(/\s+/g, ' ')
    .trim();
}

export function isLikelyRiotId(raw: string): boolean {
  const value = normalizeRiotIdInput(raw);
  const hashIdx = value.indexOf('#');

  /** Require a `#` separator with visible text on BOTH sides */

  if (hashIdx <= 0 || hashIdx >= value.length - 1) return false;

  const game = value.slice(0, hashIdx).trim();
  const tag = value.slice(hashIdx + 1).trim();

  if (!game.length || !tag.length) return false;
  /** Game IDs never contain `#` before the divider */

  if (game.includes('#')) return false;

  /** Basic length caps mimic Riot ergonomics */

  return game.length <= 64 && tag.length <= 32;
}
