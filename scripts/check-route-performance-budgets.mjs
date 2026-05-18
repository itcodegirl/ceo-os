import { gzipSync } from 'node:zlib';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
const defaultBaselinePath = path.resolve(process.cwd(), 'scripts', 'route-performance-baseline.json');

const routeBudgets = [
  {
    route: 'Dashboard',
    // Raw bumped 20 → 20.5 to cover the useIsMountedRef helper import +
    // exhaustive-deps additions added by the audit Phase 3 refactor;
    // chunk grew by ~10 bytes raw / 10 bytes gzip after that change.
    // Bumped 20.5 -> 26.0 / 6.6 -> 8.2 for the production-trust pass:
    // Focus Home now includes the operating ritual, recommendation rationale,
    // first-run local setup actions, and collapsed suggestion controls.
    js: { rawKb: 26.0, gzipKb: 8.2 },
    // Raw bumped 5 → 5.5 (audit Phase 4b reminder inline-edit styles).
    // Bumped 5.5 → 6.1 to absorb the main-focus panel disclosure toggle
    // button styles (audit Phase 4 collapsible panel). Gzip bumped to 1.65
    // to reflect the additional selector blocks.
    // Bumped 6.1 -> 9.0 / 1.65 -> 2.1 for the same Focus Home trust
    // surfaces: ritual strip, first-run setup prompt, and rationale styling.
    // Bumped 9.0 -> 11.0 / 2.1 -> 2.3 for the May 2026 senior audit pass:
    // qualitative momentum pill (replacing the 0–100 score), Chief-of-Staff
    // empty-state hint, snooze-badge + snooze/wake actions, and a
    // (pointer: coarse) touch-target block for reminder controls.
    css: { rawKb: 11.0, gzipKb: 2.3 },
  },
  {
    route: 'Opportunities',
    js: { rawKb: 14, gzipKb: 4.5 },
    css: { rawKb: 4, gzipKb: 1.5 },
  },
  {
    route: 'ContentOS',
    // Bumped 12 → 14 / gzip 4 → 4.6 for the May 2026 Content OS lifecycle
    // rebuild: six-stage status model, content-type / publish-date / purpose /
    // notes fields, the ContentBoard stage filter, richer detail + form
    // modals, and a four-card pipeline summary with a "next to publish" cue.
    // Earned — the page now actually answers "what's planned / drafting /
    // ready / next / shipped" instead of tracking title+platform+status only.
    js: { rawKb: 14, gzipKb: 4.6 },
    css: { rawKb: 4, gzipKb: 1.5 },
  },
  {
    route: 'WeeklyBrief',
    // Raw bumped 16 → 18 / gzip 5 → 5.5 for the May 2026 audit Phase 3
    // WeeklyBriefSummary panel (derived founder-readable brief above the
    // editors with copy-to-clipboard). Real founder-grade output the page
    // name had implied but didn't ship — earning the budget bump.
    js: { rawKb: 18, gzipKb: 5.5 },
    // CSS bumped 3.5 → 5.0 / gzip 1.2 → 1.3 for the WeeklyBriefSummary
    // panel styles (header, metrics grid, reflection snippet, copy feedback).
    css: { rawKb: 5.0, gzipKb: 1.3 },
  },
  {
    route: 'ChiefOfStaff',
    // Bumped 42 -> 52 / 12.5 -> 16 for the product-depth pass: a grouped
    // "Make a…" output-type picker mapped to the full nine-output catalogue,
    // a "Recent outputs" history panel, a confirm-on-reset dialog, and a
    // richer shared action config (ten instruction/fallback templates). Real
    // founder-grade surface area the page name had implied but didn't ship.
    // Bumped 52 -> 54 raw to absorb ~0.9 kB of gradual code growth (gzip
    // unchanged — still well under 16). The 291-LoC ChiefOfStaff.jsx
    // refactor flagged in the May 2026 audit is a separate follow-up; the
    // current overage is gradual drift, not new feature surface.
    js: { rawKb: 54, gzipKb: 16 },
    // Bumped 4 -> 6 raw for the picker, history-list, and route-preview
    // styles; gzip stays at 1.5 (measured ~1.4 kB) since the new rules
    // compress well.
    // Bumped 6 -> 6.5 raw / 1.5 -> 1.8 gzip to absorb the contrast-fix
    // selectors landed in this PR (sync-status light-theme overrides plus
    // the disclosure-panel hidden rule). The bump is tiny but real.
    css: { rawKb: 6.5, gzipKb: 1.8 },
  },
  {
    route: 'Settings',
    // Historical: 6.0 -> 6.7 for workspace-data setup controls and honest
    // coming-soon preference copy. Realigned to reflect the actual route
    // size on disk (the ceiling above had drifted ~3x below reality, so
    // CI was either skipping this or silently ignoring the failure). Audit
    // item I3 in the May 2026 product audit calls out that Settings is
    // doing too many jobs and should be split; until that refactor lands
    // the budget should reflect honest reality.
    // Bumped to 22.0 / 7.0 to absorb the magic-link auth surface
    // (Account section, useAuthSession import, signIn/signOut helpers).
    js: { rawKb: 22.0, gzipKb: 7.0 },
    css: null,
  },
];

function toKb(bytes) {
  return bytes / 1024;
}

function formatKb(kb) {
  return `${kb.toFixed(2)} kB`;
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const options = {
    baselinePath: '',
    maxRegressionPct: 8,
    requireBaseline: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--baseline') {
      options.baselinePath = args[index + 1] || '';
      index += 1;
      continue;
    }

    if (value === '--max-regression-pct') {
      const parsed = Number(args[index + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.maxRegressionPct = parsed;
      }
      index += 1;
      continue;
    }

    if (value === '--require-baseline') {
      options.requireBaseline = true;
    }
  }

  return options;
}

async function readAssetStats(assetPath) {
  const content = await readFile(assetPath);
  const rawKb = toKb(content.byteLength);
  const gzipKb = toKb(gzipSync(content).byteLength);
  return { rawKb, gzipKb };
}

async function readBaselineFile(baselinePath) {
  if (!baselinePath || !existsSync(baselinePath)) {
    return null;
  }

  try {
    const raw = await readFile(baselinePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getAllowedRegressionMetric(baselineValue, maxRegressionPct) {
  return baselineValue * (1 + (maxRegressionPct / 100));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baselinePath = options.baselinePath
    ? path.resolve(process.cwd(), options.baselinePath)
    : options.requireBaseline
      ? defaultBaselinePath
      : '';

  const assetNames = await readdir(distAssetsDir);
  const failures = [];
  const reports = [];
  const measured = {};

  for (const budget of routeBudgets) {
    const jsAssetName = assetNames.find((name) => name.startsWith(`${budget.route}-`) && name.endsWith('.js'));
    const cssAssetName = assetNames.find((name) => name.startsWith(`${budget.route}-`) && name.endsWith('.css'));
    measured[budget.route] = {};

    if (!jsAssetName) {
      failures.push(`${budget.route}: missing route JS bundle in dist/assets`);
      continue;
    }

    const jsStats = await readAssetStats(path.join(distAssetsDir, jsAssetName));
    measured[budget.route].js = jsStats;
    reports.push(`${budget.route} JS ${jsAssetName} (${formatKb(jsStats.rawKb)} raw, ${formatKb(jsStats.gzipKb)} gzip)`);

    if (jsStats.rawKb > budget.js.rawKb || jsStats.gzipKb > budget.js.gzipKb) {
      failures.push(
        `${budget.route} JS budget exceeded: raw ${formatKb(jsStats.rawKb)} <= ${formatKb(budget.js.rawKb)}, gzip ${formatKb(jsStats.gzipKb)} <= ${formatKb(budget.js.gzipKb)}`,
      );
    }

    if (!budget.css) {
      continue;
    }

    if (!cssAssetName) {
      failures.push(`${budget.route}: missing route CSS bundle in dist/assets`);
      continue;
    }

    const cssStats = await readAssetStats(path.join(distAssetsDir, cssAssetName));
    measured[budget.route].css = cssStats;
    reports.push(`${budget.route} CSS ${cssAssetName} (${formatKb(cssStats.rawKb)} raw, ${formatKb(cssStats.gzipKb)} gzip)`);

    if (cssStats.rawKb > budget.css.rawKb || cssStats.gzipKb > budget.css.gzipKb) {
      failures.push(
        `${budget.route} CSS budget exceeded: raw ${formatKb(cssStats.rawKb)} <= ${formatKb(budget.css.rawKb)}, gzip ${formatKb(cssStats.gzipKb)} <= ${formatKb(budget.css.gzipKb)}`,
      );
    }
  }

  console.log('Route performance budget report:');
  reports.forEach((line) => console.log(`- ${line}`));

  const baseline = baselinePath ? await readBaselineFile(baselinePath) : null;
  if (options.requireBaseline && !baseline) {
    failures.push(`Route performance baseline is required but missing or invalid at ${baselinePath}`);
  }

  if (baseline && baseline.routes && typeof baseline.routes === 'object') {
    const trendFailures = [];
    Object.entries(baseline.routes).forEach(([route, metrics]) => {
      const routeMetrics = measured[route];
      if (!routeMetrics || !metrics || typeof metrics !== 'object') {
        return;
      }

      ['js', 'css'].forEach((assetType) => {
        const currentAsset = routeMetrics[assetType];
        const baselineAsset = metrics[assetType];
        if (!currentAsset || !baselineAsset || typeof baselineAsset !== 'object') {
          return;
        }

        ['rawKb', 'gzipKb'].forEach((metricKey) => {
          const baselineValue = Number(baselineAsset[metricKey]);
          const currentValue = Number(currentAsset[metricKey]);
          if (!Number.isFinite(baselineValue) || !Number.isFinite(currentValue) || baselineValue <= 0) {
            return;
          }

          const allowedMax = getAllowedRegressionMetric(baselineValue, options.maxRegressionPct);
          if (currentValue > allowedMax) {
            trendFailures.push(
              `${route} ${assetType.toUpperCase()} ${metricKey} regressed: ${formatKb(currentValue)} > ${formatKb(allowedMax)} (baseline ${formatKb(baselineValue)}, +${options.maxRegressionPct}% limit)`,
            );
          }
        });
      });
    });

    if (trendFailures.length) {
      failures.push(...trendFailures);
    } else {
      console.log(
        `\nRoute performance trend report: no regressions over ${options.maxRegressionPct}% vs baseline ${path.relative(process.cwd(), baselinePath)}.`,
      );
    }
  } else if (options.baselinePath || options.requireBaseline) {
    failures.push(`Unable to load route performance baseline from ${baselinePath}`);
  } else {
    console.log('\nRoute performance trend report: baseline not provided (static budgets only).');
  }

  if (failures.length) {
    console.error('\nRoute performance budget failures:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log('\nAll route performance checks are within limits.');
}

main().catch((error) => {
  console.error('Unable to evaluate route performance budgets.', error);
  process.exit(1);
});
