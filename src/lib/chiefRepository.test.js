import { describe, expect, it, vi, beforeEach } from 'vitest';

async function loadChiefRepositoryWithSupabaseMock(mockDefinition) {
  vi.resetModules();
  if (mockDefinition?.isSupabaseConfigured) {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
  } else {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  }
  vi.doMock('./supabaseAdapter', () => ({
    isSupabaseAdapterEnabled: Boolean(mockDefinition?.isSupabaseConfigured),
    getSupabaseAdapter: vi.fn(async () => (
      mockDefinition?.isSupabaseConfigured
        ? {
            getSupabaseClient: mockDefinition.getSupabaseClient || vi.fn(async () => mockDefinition.supabaseClient || null),
            requireSupabaseUserId: mockDefinition.requireSupabaseUserId || vi.fn(async () => ''),
          }
        : null
    )),
  }));
  return import('./chiefRepository');
}

describe('chiefRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('falls back to local storage when Supabase auth is required while loading workspace', async () => {
    const authRequiredError = new Error('Auth required');
    authRequiredError.code = 'SUPABASE_AUTH_REQUIRED';

    window.localStorage.setItem('ceo-os-chief-notes', 'Legacy notes');
    window.localStorage.setItem(
      'ceo-os-chief-responses',
      JSON.stringify([
        {
          id: 'r1',
          title: 'Legacy output',
          content: 'Legacy content',
          source: 'proxy',
          structuredPayload: {
            priorities: [],
            opportunities: [],
            contentItems: [],
            tasks: [],
          },
        },
      ]),
    );

    const { loadChiefWorkspace } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: true,
      supabaseClient: {},
      requireSupabaseUserId: vi.fn(async () => {
        throw authRequiredError;
      }),
    });

    const workspace = await loadChiefWorkspace();

    expect(workspace.source).toBe('local');
    expect(workspace.notes).toBe('Legacy notes');
    expect(workspace.responses).toEqual([
      {
        id: 'r1',
        title: 'Legacy output',
        content: 'Legacy content',
        source: 'proxy',
        fallbackReason: '',
        errorCode: '',
        errorMessage: '',
        structuredPayload: {
          priorities: [],
          opportunities: [],
          contentItems: [],
          tasks: [],
        },
      },
    ]);
  });

  it('creates a local session and persists notes when Supabase auth is required', async () => {
    const authRequiredError = new Error('Auth required');
    authRequiredError.code = 'SUPABASE_AUTH_REQUIRED';

    const { createChiefSession } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: true,
      supabaseClient: {},
      requireSupabaseUserId: vi.fn(async () => {
        throw authRequiredError;
      }),
    });

    const session = await createChiefSession({
      actionKey: 'summarize',
      notes: 'Temporary notes',
    });

    expect(session.source).toBe('local');
    // Writes use the versioned-envelope shape so future schema migrations
    // can lift this entry without touching call sites.
    const persistedNotes = JSON.parse(window.localStorage.getItem('ceo-os-chief-notes'));
    expect(persistedNotes).toMatchObject({
      schemaVersion: 1,
      domain: 'chiefNotes',
      model: 'ChiefNotes',
      data: 'Temporary notes',
    });
    expect(typeof session.id).toBe('string');
    expect(session.id).toBeTruthy();
  });

  it('creates a Supabase draft session when notes are saved before generation', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const insert = vi.fn(async () => ({ error: null }));
    const chiefSessionsQuery = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle,
            })),
          })),
        })),
      })),
      insert,
    };
    const supabaseClient = {
      from: vi.fn(() => chiefSessionsQuery),
    };

    const { saveChiefNotes } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: true,
      supabaseClient,
      requireSupabaseUserId: vi.fn(async () => 'user-1'),
    });

    await expect(saveChiefNotes('Draft strategy notes')).resolves.toBe('Draft strategy notes');

    const persistedNotes = JSON.parse(window.localStorage.getItem('ceo-os-chief-notes'));
    expect(persistedNotes).toMatchObject({
      schemaVersion: 1,
      domain: 'chiefNotes',
      model: 'ChiefNotes',
      data: 'Draft strategy notes',
    });
    expect(supabaseClient.from).toHaveBeenCalledWith('chief_sessions');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      action_key: 'draft',
      notes: 'Draft strategy notes',
    });
  });

  it('saves output to local storage when Supabase auth is required', async () => {
    const authRequiredError = new Error('Auth required');
    authRequiredError.code = 'SUPABASE_AUTH_REQUIRED';

    const { saveChiefOutput } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: true,
      supabaseClient: {},
      requireSupabaseUserId: vi.fn(async () => {
        throw authRequiredError;
      }),
    });

    const output = await saveChiefOutput({
      sessionId: 'session-1',
      outputType: 'response',
      title: 'Fallback response',
      content: 'Fallback output text',
      structuredPayload: {
        priorities: [],
        opportunities: [],
        contentItems: [],
        tasks: [],
      },
      source: 'proxy',
    });

    const persistedRaw = window.localStorage.getItem('ceo-os-chief-responses');
    const persisted = JSON.parse(persistedRaw);

    expect(output.title).toBe('Fallback response');
    // Responses are now wrapped in a versioned envelope (was a bare array).
    expect(persisted).toMatchObject({
      schemaVersion: 1,
      domain: 'chiefResponses',
      model: 'ChiefResponse[]',
    });
    expect(Array.isArray(persisted.data)).toBe(true);
    expect(persisted.data).toHaveLength(1);
    expect(persisted.data[0].title).toBe('Fallback response');
  });

  it('rejects local note saves when browser storage fails', async () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new Error('storage full');
    });

    const { saveChiefNotes } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: false,
    });

    try {
      await expect(saveChiefNotes('Important founder notes')).rejects.toThrow(
        'Failed to persist chief notes to localStorage',
      );
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });

  it('reads versioned-envelope chief notes back to a plain string', async () => {
    // Simulate a previously-persisted envelope write.
    window.localStorage.setItem(
      'ceo-os-chief-notes',
      JSON.stringify({
        schemaVersion: 1,
        domain: 'chiefNotes',
        model: 'ChiefNotes',
        data: 'Envelope-wrapped founder notes',
      }),
    );

    const { loadChiefWorkspace } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: false,
    });

    const workspace = await loadChiefWorkspace();
    expect(workspace.notes).toBe('Envelope-wrapped founder notes');
  });

  it('upgrades a legacy bare-string chief notes entry on the next save', async () => {
    // Older install: bare string at the chief-notes key, no envelope.
    window.localStorage.setItem('ceo-os-chief-notes', 'Legacy bare string');

    const { loadChiefWorkspace, saveChiefNotes } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: false,
    });

    // Read path tolerates the legacy shape without losing the value or
    // triggering storage-corruption preservation.
    const before = await loadChiefWorkspace();
    expect(before.notes).toBe('Legacy bare string');

    await saveChiefNotes('Migrated to envelope');

    const raw = window.localStorage.getItem('ceo-os-chief-notes');
    // After the next save the entry is now a versioned envelope.
    const persisted = JSON.parse(raw);
    expect(persisted).toMatchObject({
      schemaVersion: 1,
      domain: 'chiefNotes',
      data: 'Migrated to envelope',
    });

    // And the next read still returns the plain string.
    const after = await loadChiefWorkspace();
    expect(after.notes).toBe('Migrated to envelope');
  });

  it('reads versioned-envelope chief responses back through normalizeChiefResponse', async () => {
    // A previously-persisted envelope around the response history.
    window.localStorage.setItem(
      'ceo-os-chief-responses',
      JSON.stringify({
        schemaVersion: 1,
        domain: 'chiefResponses',
        model: 'ChiefResponse[]',
        data: [
          {
            id: 'r-env-1',
            title: 'Envelope output',
            content: 'Envelope content',
            source: 'proxy',
            structuredPayload: {
              priorities: [],
              opportunities: [],
              contentItems: [],
              tasks: [],
            },
          },
        ],
      }),
    );

    const { loadChiefWorkspace } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: false,
    });

    const workspace = await loadChiefWorkspace();
    expect(workspace.responses).toEqual([
      {
        id: 'r-env-1',
        title: 'Envelope output',
        content: 'Envelope content',
        source: 'proxy',
        fallbackReason: '',
        errorCode: '',
        errorMessage: '',
        structuredPayload: {
          priorities: [],
          opportunities: [],
          contentItems: [],
          tasks: [],
        },
      },
    ]);
  });

  it('rejects local output saves when browser storage fails', async () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new Error('storage full');
    });

    const { saveChiefOutput } = await loadChiefRepositoryWithSupabaseMock({
      isSupabaseConfigured: false,
    });

    try {
      await expect(saveChiefOutput({
        sessionId: 'session-1',
        outputType: 'response',
        title: 'Fallback response',
        content: 'Fallback output text',
        structuredPayload: {
          priorities: [],
          opportunities: [],
          contentItems: [],
          tasks: [],
        },
        source: 'proxy',
      })).rejects.toThrow('Failed to persist chief responses to localStorage');
    } finally {
      window.localStorage.setItem = originalSetItem;
    }
  });

});
