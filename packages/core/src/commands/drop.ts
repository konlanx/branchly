import type { DatasourceAdapter } from '../interfaces';
import { type Manifest, type ManifestEntry, removeEntry } from '../manifest';
import type { Reporter } from '../runtime/reporter';

export const dropEntries = (
  datasource: DatasourceAdapter,
  reporter: Reporter,
  entries: readonly ManifestEntry[],
  manifest: Manifest,
): Promise<Manifest> =>
  entries.reduce(async (previous, entry) => {
    const current = await previous;
    await datasource.destroy(entry.key);
    reporter.step(`dropped ${entry.key} (branch "${entry.ref}")`);
    return removeEntry(current, entry.key);
  }, Promise.resolve(manifest));
