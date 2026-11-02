import { localWebStatusSchema } from '../../shared/local-web';
import type { LocalWebStatus } from '../../shared/local-web';

export async function getLocalWebStatus(): Promise<LocalWebStatus> {
  const response = await fetch('/api/status', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Local status request failed.');
  return localWebStatusSchema.parse(await response.json());
}
