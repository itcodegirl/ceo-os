import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Token contrast regression test.
 *
 * Reads tokens.css raw and asserts that the critical text-on-background
 * pairs meet WCAG AA (4.5:1 for normal text, 3:1 for large). The pair list
 * deliberately includes the slots that recently regressed — soft-token text
 * colors, action-button foreground, status pills — so any future change to
 * the related tokens has to keep contrast in range before it ships.
 *
 * The parser is intentionally minimal — it only handles the constructs that
 * appear in tokens.css (hex, rgb/rgba, color-mix on two solid colors, and
 * var() references). Linear-gradient and other compound values are skipped
 * at the call site, since a gradient doesn't have a single contrast number.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TOKENS_CSS_PATH = join(__dirname, 'tokens.css');

function loadTokensCss() {
  return readFileSync(TOKENS_CSS_PATH, 'utf8');
}

function extractBlock(source, openingSelector) {
  const start = source.indexOf(openingSelector);
  if (start === -1) return '';
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) return '';
  let depth = 1;
  let i = braceStart + 1;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') depth -= 1;
    i += 1;
  }
  return source.slice(braceStart + 1, i - 1);
}

function stripComments(source) {
  // Block comments only; tokens.css doesn't use line comments.
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseTokenBlock(blockSource) {
  const tokens = new Map();
  const stripped = stripComments(blockSource);
  const declarations = stripped.split(';');
  for (const raw of declarations) {
    const decl = raw.trim();
    if (!decl.startsWith('--')) continue;
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const name = decl.slice(0, colon).trim();
    const value = decl.slice(colon + 1).trim();
    tokens.set(name, value);
  }
  return tokens;
}

function buildThemeMaps() {
  const css = loadTokensCss();
  const darkBlock = extractBlock(css, ':root');
  const lightBlock = extractBlock(css, ':root[data-theme="light"]');
  const dark = parseTokenBlock(darkBlock);
  const light = new Map(dark);
  for (const [name, value] of parseTokenBlock(lightBlock)) {
    light.set(name, value);
  }
  return { dark, light };
}

function parseHexColor(value) {
  const m = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (!m) return null;
  const hex = m[1];
  let r;
  let g;
  let b;
  let a = 1;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16) / 255;
  } else {
    return null;
  }
  return { r, g, b, a };
}

function parseRgbColor(value) {
  const m = value.match(/^rgba?\(\s*([^)]+)\s*\)$/i);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts.length >= 4 ? Number(parts[3]) : 1;
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return { r, g, b, a };
}

function splitTopLevelArgs(inner) {
  const args = [];
  let depth = 0;
  let buffer = '';
  for (const ch of inner) {
    if (ch === '(') {
      depth += 1;
      buffer += ch;
    } else if (ch === ')') {
      depth -= 1;
      buffer += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(buffer.trim());
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  if (buffer.trim()) args.push(buffer.trim());
  return args;
}

function resolveToColor(value, tokens, seen = new Set()) {
  if (!value) return null;
  const trimmed = value.trim();

  if (trimmed.startsWith('var(')) {
    const inner = trimmed.slice(4, trimmed.lastIndexOf(')'));
    const args = splitTopLevelArgs(inner);
    const name = args[0];
    if (seen.has(name)) return null;
    seen.add(name);
    if (tokens.has(name)) {
      const resolved = resolveToColor(tokens.get(name), tokens, seen);
      if (resolved) return resolved;
    }
    if (args.length > 1) {
      return resolveToColor(args.slice(1).join(', '), tokens, seen);
    }
    return null;
  }

  if (trimmed.startsWith('#')) {
    return parseHexColor(trimmed);
  }
  if (/^rgba?\(/i.test(trimmed)) {
    return parseRgbColor(trimmed);
  }
  if (trimmed.startsWith('color-mix(')) {
    const inner = trimmed.slice('color-mix('.length, trimmed.lastIndexOf(')'));
    const args = splitTopLevelArgs(inner);
    if (args.length < 3) return null;
    const colorASpec = args[1];
    const colorBSpec = args[2];
    const colorA = parseColorMixOperand(colorASpec, tokens, seen);
    const colorB = parseColorMixOperand(colorBSpec, tokens, seen);
    if (!colorA || !colorB) return null;
    const totalPct = colorA.pct + colorB.pct || 100;
    const wA = colorA.pct / totalPct;
    const wB = colorB.pct / totalPct;
    return {
      r: colorA.color.r * wA + colorB.color.r * wB,
      g: colorA.color.g * wA + colorB.color.g * wB,
      b: colorA.color.b * wA + colorB.color.b * wB,
      a: colorA.color.a * wA + colorB.color.a * wB,
    };
  }
  return null;
}

function parseColorMixOperand(spec, tokens, seen) {
  const pctMatch = spec.match(/(.*?)\s+(\d+(?:\.\d+)?)%\s*$/);
  if (pctMatch) {
    const color = resolveToColor(pctMatch[1].trim(), tokens, new Set(seen));
    if (!color) return null;
    return { color, pct: Number(pctMatch[2]) };
  }
  const color = resolveToColor(spec.trim(), tokens, new Set(seen));
  if (!color) return null;
  return { color, pct: 50 };
}

function composeOver(foreground, background) {
  const alpha = foreground.a;
  if (alpha >= 1) {
    return { r: foreground.r, g: foreground.g, b: foreground.b, a: 1 };
  }
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

function relativeLuminance(rgb) {
  const linearize = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes = buildThemeMaps();

function resolveOnPageBg(token, themeName) {
  const tokens = themeName === 'light' ? themes.light : themes.dark;
  const pageBg = resolveToColor(tokens.get('--bg'), tokens);
  expect(pageBg, `--bg unresolved for ${themeName}`).not.toBeNull();
  const raw = resolveToColor(tokens.get(token), tokens);
  expect(raw, `${token} unresolved for ${themeName}`).not.toBeNull();
  return composeOver(raw, pageBg);
}

function ratio(textToken, bgTokenOrColor, themeName) {
  const tokens = themeName === 'light' ? themes.light : themes.dark;
  const text = resolveOnPageBg(textToken, themeName);
  const bg = typeof bgTokenOrColor === 'string'
    ? (bgTokenOrColor === '--bg'
      ? resolveToColor(tokens.get('--bg'), tokens)
      : resolveOnPageBg(bgTokenOrColor, themeName))
    : bgTokenOrColor;
  return contrastRatio(text, bg);
}

// Critical text-on-bg pairs that must meet WCAG AA. minRatio defaults to
// 4.5 (normal text); use 3.0 for tokens used exclusively in large/heading
// contexts. The list intentionally includes the slots fixed in this PR so a
// future change to those tokens has to clear the bar before it lands.
const PAIRS = [
  // Core text on the page background
  { text: '--text', bg: '--bg', theme: 'dark', min: 4.5 },
  { text: '--text', bg: '--bg', theme: 'light', min: 4.5 },
  { text: '--text-strong', bg: '--bg', theme: 'dark', min: 4.5 },
  { text: '--text-strong', bg: '--bg', theme: 'light', min: 4.5 },
  { text: '--text-muted', bg: '--bg', theme: 'dark', min: 4.5 },
  { text: '--text-muted', bg: '--bg', theme: 'light', min: 4.5 },
  { text: '--text-soft', bg: '--bg', theme: 'dark', min: 4.5 },
  { text: '--text-soft', bg: '--bg', theme: 'light', min: 4.5 },
  { text: '--text-soft-strong', bg: '--bg', theme: 'dark', min: 4.5 },
  { text: '--text-soft-strong', bg: '--bg', theme: 'light', min: 4.5 },
  // Sidebar muted — audit flagged this one specifically
  { text: '--text-sidebar-muted', bg: '--bg', theme: 'dark', min: 4.5 },
  { text: '--text-sidebar-muted', bg: '--bg', theme: 'light', min: 4.5 },
  // Action button (fixed in this PR — was --accent-soft producing ~1.1:1 in light)
  { text: '--accent-soft-strong', bg: '--bg-accent-subtle', theme: 'dark', min: 4.5 },
  { text: '--accent-soft-strong', bg: '--bg-accent-subtle', theme: 'light', min: 4.5 },
  // Content status pills (fixed in this PR — were --info-soft / --warning-soft / --success-soft)
  { text: '--pill-low-text', bg: '--pill-low-bg', theme: 'dark', min: 4.5 },
  { text: '--pill-low-text', bg: '--pill-low-bg', theme: 'light', min: 4.5 },
  { text: '--pill-medium-text', bg: '--pill-medium-bg', theme: 'dark', min: 4.5 },
  { text: '--pill-medium-text', bg: '--pill-medium-bg', theme: 'light', min: 4.5 },
  { text: '--pill-high-text', bg: '--pill-high-bg', theme: 'dark', min: 4.5 },
  { text: '--pill-high-text', bg: '--pill-high-bg', theme: 'light', min: 4.5 },
];

describe('design-token contrast (regression)', () => {
  it.each(PAIRS)(
    '$theme: $text on $bg meets WCAG AA ($min:1)',
    ({ text, bg, theme, min }) => {
      const r = ratio(text, bg, theme);
      expect(
        r,
        `Expected ${theme} contrast(${text} on ${bg}) >= ${min}:1, got ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(min);
    },
  );

  it('parser sanity: --bg, --text resolve to solid colors in both themes', () => {
    for (const themeName of ['dark', 'light']) {
      const tokens = themeName === 'light' ? themes.light : themes.dark;
      const bg = resolveToColor(tokens.get('--bg'), tokens);
      const text = resolveToColor(tokens.get('--text'), tokens);
      expect(bg).not.toBeNull();
      expect(text).not.toBeNull();
      expect(bg.a).toBe(1);
      expect(text.a).toBe(1);
    }
  });
});
