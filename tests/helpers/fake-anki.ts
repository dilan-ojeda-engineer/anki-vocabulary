import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AnkiConnectClient } from '../../src/integrations/anki/client';

type FakeNote = {
  id: string;
  noteType: { id: string; name: string };
  fields: Record<string, string>;
  tags: string[];
  cardIds: string[];
  modifiedAt: string;
};
export function fakeAnki() {
  const state = {
    session: 'session-one',
    profile: 'Disposable',
    lost: 'none' as 'none' | 'before' | 'after',
    lostUpdate: 'none' as 'none' | 'before' | 'after',
    updateCount: 0,
    patches: [] as Record<string, string>[],
    cardFlags: 0,
    studied: false,
    changeCardOnUpdate: false,
    updateAvailable: true,
    editorConflictOnUpdate: false,
    duplicates: false,
    unavailable: false,
    disconnectDuringMedia: false,
    model: null as null | Record<string, unknown>,
    notes: [] as FakeNote[],
    media: new Map<string, string>(),
    operations: new Map<string, unknown>(),
    calls: [] as string[],
  };
  const fetcher: typeof fetch = async (_url, init) => {
    if (state.unavailable) throw new Error('fake-disconnected');
    const request = z
      .object({
        id: z.number(),
        method: z.string(),
        params: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(String(init?.body)));
    const { method, params } = request;
    state.calls.push(method);
    let result: unknown;
    const reply = (value: unknown) =>
      new Response(
        JSON.stringify({ jsonrpc: '2.0', id: request.id, result: value }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    const failure = (type: string) =>
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: 'Fake failure', data: { type } },
        }),
      );
    if (params.session && params.session !== state.session)
      return failure('collectionChanged');
    switch (method) {
      case 'api.describe':
        result = {
          apiMajor: 1,
          ankiVersion: 'fake',
          methods: [
            'collection.get',
            'decks.list',
            'noteTypes.list',
            'noteTypes.get',
            'noteTypes.create',
            'notes.search',
            'notes.get',
            'notes.create',
            ...(state.updateAvailable ? ['notes.update'] : []),
            'cards.get',
            'media.get',
            'media.store',
            'operations.get',
          ].map((name) => ({ name, available: true, reason: null })),
        };
        break;
      case 'collection.get':
        result = {
          profile: state.profile,
          session: state.session,
          scheduler: 'fsrs',
        };
        break;
      case 'decks.list':
        result = [
          { id: '2', name: 'English::Test', kind: 'normal', presetId: '1' },
          { id: '3', name: 'Other', kind: 'normal', presetId: '1' },
        ];
        break;
      case 'noteTypes.list':
        result = state.model ? [{ id: '10', name: state.model.name }] : [];
        break;
      case 'noteTypes.get':
        result = state.model;
        break;
      case 'noteTypes.create':
        state.model = {
          ...params,
          id: '10',
          templates: (params.templates as object[]).map((template) => ({
            ...template,
            deck: null,
          })),
        };
        delete state.model.session;
        result = state.model;
        break;
      case 'notes.search': {
        const source = String(params.query).slice('AvSourceId:'.length);
        const found = state.notes.filter(
          (note) => note.fields.AvSourceId === source,
        );
        result = {
          ids:
            state.duplicates && found[0]
              ? [found[0].id, found[0].id]
              : found.map((note) => note.id),
          nextCursor: null,
        };
        break;
      }
      case 'notes.get':
        result = state.notes.find((note) => note.id === params.id);
        break;
      case 'notes.create': {
        const lost = state.lost;
        state.lost = 'none';
        if (lost === 'before') throw new Error('response lost before commit');
        const id = String(100 + state.notes.length);
        const cardId = String(200 + state.notes.length);
        const note: FakeNote = {
          id,
          noteType: { id: '10', name: String(state.model?.name) },
          fields: z.record(z.string(), z.string()).parse(params.fields),
          tags: [],
          cardIds: [cardId],
          modifiedAt: '2026-11-03T00:00:00Z',
        };
        state.notes.push(note);
        if (lost === 'after') throw new Error('response lost after commit');
        result = { noteId: id, cardIds: [cardId] };
        break;
      }
      case 'cards.get': {
        const note = state.notes.find((note) =>
          note.cardIds.includes(String(params.id)),
        )!;
        result = {
          id: params.id,
          noteId: note.id,
          deck: { id: '2', name: 'English::Test' },
          homeDeck: null,
          templateIndex: 0,
          flags: state.cardFlags,
          modifiedAt: 'now',
          scheduling: {
            type: state.studied ? 'review' : 'new',
            queue: state.studied ? 'review' : 'new',
            due: state.studied
              ? { kind: 'day', day: 42 }
              : { kind: 'position', position: 1 },
            intervalDays: state.studied ? 17 : 0,
            learningIntervalSeconds: null,
            remainingSteps: 0,
            repetitions: state.studied ? 5 : 0,
            lapses: 0,
            sm2EasePermille: 2500,
            fsrsMemory: null,
            desiredRetention: null,
          },
        };
        break;
      }
      case 'notes.update': {
        if (state.editorConflictOnUpdate) return failure('editorConflict');
        const lost = state.lostUpdate;
        state.lostUpdate = 'none';
        if (lost === 'before')
          throw new Error('response lost before update commit');
        const note = state.notes.find((item) => item.id === params.id);
        if (!note) return failure('notFound');
        const patch = z
          .object({ fields: z.record(z.string(), z.string()) })
          .parse(params.patch);
        state.patches.push(patch.fields);
        state.updateCount++;
        Object.assign(note.fields, patch.fields);
        note.modifiedAt = `update-${state.updateCount}`;
        if (state.changeCardOnUpdate) state.cardFlags++;
        if (lost === 'after')
          throw new Error('response lost after update commit');
        result = note;
        break;
      }
      case 'media.get':
        if (!state.media.has(String(params.filename)))
          return failure('notFound');
        result = {
          filename: params.filename,
          data: state.media.get(String(params.filename)),
        };
        break;
      case 'media.store': {
        const filename = String(params.filename);
        if (state.media.has(filename)) return failure('conflict');
        const data = z.object({ data: z.string() }).parse(params.source).data;
        state.media.set(filename, data);
        if (state.disconnectDuringMedia) {
          state.disconnectDuringMedia = false;
          state.unavailable = true;
        }
        const operationId = `op${state.operations.size}`;
        state.operations.set(operationId, {
          filename,
          status: 'stored',
          sha256: createHash('sha256')
            .update(Buffer.from(data, 'base64'))
            .digest('hex'),
        });
        result = { operationId, method: 'media.store', session: state.session };
        break;
      }
      case 'operations.get':
        result = {
          operationId: params.operationId,
          method: 'media.store',
          session: state.session,
          state: 'succeeded',
          result: state.operations.get(String(params.operationId)),
        };
        break;
      default:
        throw new Error(`Unexpected fake method ${method}`);
    }
    return reply(result);
  };
  return {
    state,
    client: new AnkiConnectClient('http://127.0.0.1:8765/api/v1', fetcher),
  };
}
export function wave(seed = 0) {
  const b = Buffer.alloc(46);
  b.write('RIFF');
  b.writeUInt32LE(38, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(2, 40);
  b.writeInt16LE(seed, 44);
  return b;
}
