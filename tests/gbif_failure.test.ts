import { describe, it, expect, vi } from 'vitest';
import { matchSpecies } from '../scripts/ingest/gbif.js';

describe('GBIF Error Handling & Quality Filter', () => {
  it('strictly rejects non-Aves taxa with loud error', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        usageKey: 5219404,
        scientificName: 'Panthera leo',
        canonicalName: 'Panthera leo',
        class: 'Mammalia',
      }),
    } as any);

    try {
      await expect(matchSpecies('Panthera leo')).rejects.toThrow(
        /Taxon verification failed.*expected "Aves"/i
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it(
    'fails loudly on network/API failure and does not fabricate data',
    async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      try {
        await expect(matchSpecies('Falco amurensis')).rejects.toThrow(/Exceeded max retries/i);
      } finally {
        global.fetch = originalFetch;
      }
    },
    15000 // 15 second test timeout for retry backoff
  );
});
