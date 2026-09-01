import { describe, expect, it } from 'vitest';
import {
  getOpsSloSnapshotsSource,
  listOpsSloSnapshots,
} from './opsSloSnapshotsRepository';

describe('src/lib/experimental/telemetry/opsSloSnapshotsRepository', () => {
  it('returns local fallback snapshots when supabase is unavailable', async () => {
    const rows = await listOpsSloSnapshots({ limit: 2 });

    expect(getOpsSloSnapshotsSource()).toBe('local');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      runId: expect.any(String),
      routeTrendOutcome: expect.any(String),
    });
  });
});
