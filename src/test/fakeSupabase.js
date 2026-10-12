import { isoToMicros, withMicroseconds } from './timestampPrecision';

export const FAKE_USER_ID = 'user-1';

const ITEM_TABLES = ['notebook_cards', 'notebook_questions', 'notebook_ideas'];

/**
 * In-memory stand-in for the synced tables (notebook pages and items,
 * reminders), behaving like PostgREST + Postgres where the sync code cares:
 * server-stamped microsecond `updated_at` (the set_updated_at trigger), the
 * ms-range update guard, primary keys, `upsert`, the items' page foreign key,
 * and `on delete set null` (which re-stamps the item through its trigger).
 */
export function createFakeSupabase() {
  const tables = Object.fromEntries(['notebook_pages', ...ITEM_TABLES, 'reminders'].map((name) => [name, []]));
  let clock = Date.parse('2026-10-04T10:00:00.000Z');
  let failNext = null;
  let loseNextResponse = false;
  const stamp = () => {
    clock += 1000;
    return withMicroseconds(new Date(clock).toISOString(), 417);
  };
  const clone = (row) => JSON.parse(JSON.stringify(row));

  function from(table) {
    const rows = tables[table];
    const state = { op: 'select', filters: [], payload: null };
    const matches = (row) => state.filters.every(([kind, column, value]) => {
      if (kind === 'eq') return row[column] === value;
      if (kind === 'gte') return isoToMicros(row[column]) >= isoToMicros(value);
      return isoToMicros(row[column]) < isoToMicros(value);
    });
    // A write that commits but whose response never arrives (dropped connection).
    const respond = (data) => {
      if (!loseNextResponse) return { data, error: null };
      loseNextResponse = false;
      return { data: null, error: new TypeError('Failed to fetch') };
    };

    const insert = (next) => {
      if (next.page_id && ITEM_TABLES.includes(table) && !tables.notebook_pages.some((page) => page.id === next.page_id)) {
        return { data: null, error: { code: '23503', message: 'violates foreign key constraint' } };
      }
      const now = stamp();
      const row = { ...clone(next), created_at: next.created_at ?? now, updated_at: now };
      rows.push(row);
      return respond([clone(row)]);
    };

    const run = () => {
      if (failNext) {
        const error = failNext;
        failNext = null;
        return { data: null, error };
      }
      if (state.op === 'select') return { data: rows.filter(matches).map(clone), error: null };
      if (state.op === 'insert') {
        if (rows.some((row) => row.id === state.payload.id)) {
          return { data: null, error: { code: '23505', message: 'duplicate key value' } };
        }
        return insert(state.payload);
      }
      if (state.op === 'upsert') {
        const existing = rows.find((row) => row.id === state.payload.id);
        if (!existing) return insert(state.payload);
        Object.assign(existing, clone(state.payload), { updated_at: stamp() });
        return respond([clone(existing)]);
      }
      if (state.op === 'update') {
        const hits = rows.filter(matches);
        hits.forEach((row) => Object.assign(row, clone(state.payload), { updated_at: stamp() }));
        return respond(hits.map(clone));
      }
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (!matches(rows[index])) continue;
        const [removed] = rows.splice(index, 1);
        if (table === 'notebook_pages') {
          ITEM_TABLES.forEach((itemTable) => tables[itemTable]
            .filter((item) => item.page_id === removed.id)
            .forEach((item) => Object.assign(item, { page_id: null, updated_at: stamp() })));
        }
      }
      return { data: null, error: null };
    };

    const builder = {
      select: () => builder,
      insert: (payload) => { state.op = 'insert'; state.payload = payload; return builder; },
      upsert: (payload) => { state.op = 'upsert'; state.payload = payload; return builder; },
      update: (payload) => { state.op = 'update'; state.payload = payload; return builder; },
      delete: () => { state.op = 'delete'; return builder; },
      eq: (column, value) => { state.filters.push(['eq', column, value]); return builder; },
      gte: (column, value) => { state.filters.push(['gte', column, value]); return builder; },
      lt: (column, value) => { state.filters.push(['lt', column, value]); return builder; },
      async maybeSingle() {
        const result = run();
        return result.error ? result : { data: result.data?.[0] ?? null, error: null };
      },
      async single() {
        const result = run();
        if (result.error) return result;
        return result.data?.length ? { data: result.data[0], error: null } : { data: null, error: { code: 'PGRST116' } };
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    client: { from },
    tables,
    failNextWith(error) { failNext = error; },
    loseNextResponse() { loseNextResponse = true; },
    editElsewhere(table, id, changes) {
      Object.assign(tables[table].find((row) => row.id === id), changes, { updated_at: stamp() });
    },
    insertElsewhere(table, row) {
      const now = stamp();
      tables[table].push({ user_id: FAKE_USER_ID, created_at: now, updated_at: now, ...row });
    },
    deleteElsewhere(table, id) {
      from(table).delete().eq('id', id).then(() => {});
    },
  };
}
