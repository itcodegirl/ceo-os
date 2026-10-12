import { gzipSync } from 'node:zlib';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
const defaultBaselinePath = path.resolve(process.cwd(), 'scripts', 'route-performance-baseline.json');
const defaultOutputPath = path.resolve(process.cwd(), 'artifacts', 'route-size-report.md');
const routes = ['Dashboard', 'Opportunities', 'ContentOS', 'WeeklyBrief', 'ChiefOfStaff', 'Settings', 'Notebook'];

function toKb(bytes) {
  return bytes / 1024;
}

function formatKb(value) {
  return `${value.toFixed(2)} kB`;
}

function formatDelta(value) {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const options = {
    baseline: defaultBaselinePath,
    output: defaultOutputPath,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--baseline') {
      options.baseline = path.resolve(process.cwd(), args[index + 1] || defaultBaselinePath);
      index += 1;
      continue;
    }

    if (value === '--output') {
      options.output = path.resolve(process.cwd(), args[index + 1] || defaultOutputPath);
      index += 1;
    }
  }

  return options;
}

async function readAssetStats(assetPath) {
  const content = await readFile(assetPath);
  return {
    rawKb: toKb(content.byteLength),
    gzipKb: toKb(gzipSync(content).byteLength),
  };
}

async function readBaseline(baselinePath) {
  if (!existsSync(baselinePath)) {
    return {};
  }

  try {
    const raw = await readFile(baselinePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed?.routes && typeof parsed.routes === 'object' ? parsed.routes : {};
  } catch {
    return {};
  }
}

function computeDeltaPct(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) {
    return Number.NaN;
  }

  return ((current - baseline) / baseline) * 100;
}

async function collectCurrentMetrics() {
  const assetNames = await readdir(distAssetsDir);
  const metrics = {};

  for (const route of routes) {
    const jsAssetName = assetNames.find((name) => name.startsWith(`${route}-`) && name.endsWith('.js'));
    const cssAssetName = assetNames.find((name) => name.startsWith(`${route}-`) && name.endsWith('.css'));
    const routeMetrics = {};

    if (jsAssetName) {
      routeMetrics.js = await readAssetStats(path.join(distAssetsDir, jsAssetName));
    }

    if (cssAssetName) {
      routeMetrics.css = await readAssetStats(path.join(distAssetsDir, cssAssetName));
    }

    metrics[route] = routeMetrics;
  }

  return metrics;
}

function buildReportMarkdown({ baselineRoutes, currentRoutes }) {
  const generatedAt = new Date().toISOString();
  const lines = [
    '# Route Size Diff Report',
    '',
    `Generated at: ${generatedAt}`,
    '',
    '| Route | Asset | Current (raw) | Baseline (raw) | Delta (raw) | Current (gzip) | Baseline (gzip) | Delta (gzip) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  routes.forEach((route) => {
    const current = currentRoutes[route] || {};
    const baseline = baselineRoutes[route] || {};

    ['js', 'css'].forEach((assetType) => {
      if (!current[assetType]) {
        return;
      }

      const currentRaw = current[assetType].rawKb;
      const currentGzip = current[assetType].gzipKb;
      const baselineRaw = baseline?.[assetType]?.rawKb;
      const baselineGzip = baseline?.[assetType]?.gzipKb;

      const rawDelta = computeDeltaPct(currentRaw, baselineRaw);
      const gzipDelta = computeDeltaPct(currentGzip, baselineGzip);

      lines.push(
        `| ${route} | ${assetType.toUpperCase()} | ${formatKb(currentRaw)} | ${Number.isFinite(baselineRaw) ? formatKb(baselineRaw) : 'n/a'} | ${formatDelta(rawDelta)} | ${formatKb(currentGzip)} | ${Number.isFinite(baselineGzip) ? formatKb(baselineGzip) : 'n/a'} | ${formatDelta(gzipDelta)} |`,
      );
    });
  });

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [baselineRoutes, currentRoutes] = await Promise.all([
    readBaseline(options.baseline),
    collectCurrentMetrics(),
  ]);

  const report = buildReportMarkdown({
    baselineRoutes,
    currentRoutes,
  });

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, report, 'utf-8');
  console.log(`Wrote route size report: ${path.relative(process.cwd(), options.output)}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `\n${report}`, { encoding: 'utf-8', flag: 'a' });
  }
}

main().catch((error) => {
  console.error('Unable to generate route performance report.', error);
  process.exit(1);
});
