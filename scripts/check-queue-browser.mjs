// Exercise the real queue module with native Web Locks in separate browser tabs.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  browser = await chromium.launch();
  const context = await browser.newContext();
  await context.route('**/queue-test', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Queue coordination test</title>' }));
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all(pages.map((page) => page.goto(`${origin}queue-test`)));
  await Promise.all(pages.map((page) => page.evaluate(async () => {
    window.queue = await import('/src/lib/offlineWriteQueue.js');
  })));
  await Promise.all(pages.map((page, tab) => page.evaluate(async (tab) => {
    for (let i = 0; i < 20; i++) await window.queue.enqueueOfflineWrite({ kind: 'test', payload: { value: `${tab}-${i}` } });
  }, tab)));
  assert.equal(await pages[0].evaluate(() => window.queue.getOfflineQueue().length), 40);

  // Both tabs try to replay the same queue. A durable counter records each
  // server-side attempt; one drainer must own the entire replay pass.
  const results = await Promise.all(pages.map((page) => page.evaluate(() => window.queue.drainOfflineQueue({
    test: async (payload) => {
      const key = `attempt:${payload.value}`;
      localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
      await new Promise((resolve) => setTimeout(resolve, 2));
    },
  }))));
  assert.equal(results.reduce((count, result) => count + result.drained, 0), 40);
  assert.equal(await pages[0].evaluate(() => window.queue.getOfflineQueue().length), 0);
  const attempts = await pages[0].evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('attempt:')).map((key) => localStorage.getItem(key)));
  assert.equal(attempts.length, 40);
  assert.ok(attempts.every((count) => count === '1'));
  console.log('Native two-tab queue check passed: 40 concurrent writes retained, 40 actions replayed exactly once.');
} finally {
  await browser?.close();
  await server.close();
}
