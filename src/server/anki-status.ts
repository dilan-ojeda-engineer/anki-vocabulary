import { z } from 'zod';
import {
  AnkiConnectClient,
  AnkiConnectError,
} from '../integrations/anki/client';
import {
  collectionSchema,
  deckSchema,
  descriptionSchema,
} from '../integrations/anki/schemas';
import { localWebStatusSchema } from '../shared/local-web';
import type { LocalWebStatus } from '../shared/local-web';

const requiredMethods = ['collection.get', 'decks.list'] as const;

export interface AnkiReadClient {
  call<S extends z.ZodType>(
    method: string,
    params: Readonly<Record<string, unknown>>,
    schema: S,
  ): Promise<z.output<S>>;
}

export function createAnkiReadClient(endpoint: string): AnkiReadClient {
  return new AnkiConnectClient(endpoint);
}

function unavailableReason(
  error: unknown,
): Extract<LocalWebStatus['anki'], { status: 'unavailable' }>['reason'] {
  if (!(error instanceof AnkiConnectError))
    return 'unsupported-or-invalid-response';
  if (error.code === 'TRANSPORT') return 'not-running-or-unreachable';
  if (error.code === 'REMOTE') return 'request-rejected';
  return 'unsupported-or-invalid-response';
}

export async function readAnkiStatus(
  client: AnkiReadClient,
): Promise<LocalWebStatus> {
  try {
    const description = await client.call(
      'api.describe',
      {},
      descriptionSchema,
    );
    const supported = new Set(
      description.methods
        .filter((method) => method.available)
        .map((method) => method.name),
    );
    if (requiredMethods.some((method) => !supported.has(method)))
      return localWebStatusSchema.parse({
        server: { status: 'ready' },
        anki: {
          status: 'unavailable',
          reason: 'unsupported-or-invalid-response',
        },
      });

    const collection = await client.call(
      'collection.get',
      {},
      collectionSchema,
    );
    const decks = await client.call(
      'decks.list',
      { session: collection.session },
      z.array(deckSchema),
    );
    return localWebStatusSchema.parse({
      server: { status: 'ready' },
      anki: {
        status: 'connected',
        ankiVersion: description.ankiVersion,
        profile: collection.profile,
        decks: decks
          .map(({ id, name, kind }) => ({ id, name, kind }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      },
    });
  } catch (error) {
    return localWebStatusSchema.parse({
      server: { status: 'ready' },
      anki: { status: 'unavailable', reason: unavailableReason(error) },
    });
  }
}
