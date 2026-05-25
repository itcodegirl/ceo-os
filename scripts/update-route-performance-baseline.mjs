import { gzipSync } from 'node:zlib';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
const baselinePath = path.resolve(process.cwd(), 'scripts', 'route-performance-baseline.json');
const routes = ['Dashboard', 'Opportunities', 'ContentOS', 'WeeklyBrief', 'ChiefOfStaff', 'Settings'];

function parseArgs(argv) {
  return new Set(Array.isArray(argv) ? argv : []);
}

function toKb(bytes) {
  return bytes / 1024;
}

function roundKb(value) {
  return Number(value.toFixed(2));
}

async function readAssetStats(assetPath) {
  const content = await readFile(assetPath);
  return {
    rawKb: roundKb(toKb(content.byteLength)),
    gzipKb: roundKb(toKb(gzipSync(content).byteLength)),
  };
}

async function collectRouteMetrics() {
  const assetNames = await readdir(distAssetsDir);
  const routeMetrics = {};

  for (const route of routes) {
    const jsAssetName = assetNames.find((name) => name.startsWith(`${route}-`) && name.endsWith('.js'));
    const cssAssetName = assetNames.find((name) => name.startsWith(`${route}-`) && name.endsWith('.css'));
    const metrics = {};

    if (jsAssetName) {
      metrics.js = await readAssetStats(path.join(distAssetsDir, jsAssetName));
    }

    if (cssAssetName) {
      metrics.css = await readAssetStats(path.join(distAssetsDir, cssAssetName));
    }

    routeMetrics[route] = metrics;
  }

  return routeMetrics;
}

function ensureReleaseGovernance(flags) {
  const isReleaseFlagPresent = flags.has('--release');
  const allowUnsafe = flags.has('--allow-nonrelease');
  const releaseApproved = process.env.ROUTE_BASELINE_REFRESH_APPROVED === 'true';
  const githubEventName = process.env.GITHUB_EVENT_NAME || '';
  // `schedule` is included so the weekly drift-prevention workflow can
  // refresh without bumping into the release-only guard. The workflow
  // still opens a PR for human review, so the governance intent (no
  // silent commits to main) is preserved.
  const isApprovedEvent = githubEventName === 'release'
    || githubEventName === 'workflow_dispatch'
    || githubEventName === 'schedule';

  if (allowUnsafe) {
    return;
  }

  if (!isReleaseFlagPresent || !releaseApproved || (!isApprovedEvent && githubEventName)) {
    throw new Error(
      'Baseline refresh is release-governed. Run with --release and ROUTE_BASELINE_REFRESH_APPROVED=true from release/workflow_dispatch/schedule automation.',
    );
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  ensureReleaseGovernance(flags);

  const nextBaseline = {
    generatedAt: new Date().toISOString().slice(0, 10),
    governance: {
      refreshMode: 'release-only',
      githubEventName: process.env.GITHUB_EVENT_NAME || 'local',
    },
    routes: await collectRouteMetrics(),
  };

  await writeFile(baselinePath, `${JSON.stringify(nextBaseline, null, 2)}\n`, 'utf-8');
  console.log(`Updated baseline: ${path.relative(process.cwd(), baselinePath)}`);
}

main().catch((error) => {
  console.error('Unable to refresh route performance baseline.', error.message || error);
  process.exit(1);
});
