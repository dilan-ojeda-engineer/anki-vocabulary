import { extractAudioItems } from './audio-plan';
import type { AudioReview } from './audio-generation';
import type { NoteLoaded } from './note-update';

export const audioPlacementLabel = (id: string) =>
  id === 'target'
    ? 'Target'
    : id === 'frontExample'
      ? 'Front example'
      : `Additional example ${Number(id.split(':')[1]) + 1}`;

/** UI guidance only. Approval, cache validity and update safety are checked again by the server. */
export function planNoteAudio(loaded: NoteLoaded, review: AudioReview) {
  const original = extractAudioItems(loaded.fields);
  const existing = new Set(loaded.audio.map((item) => item.placementId));
  return review.items.map((item) => {
    const hasExisting = existing.has(item.placementId);
    const unchanged =
      original.find((old) => old.placementId === item.placementId)?.text ===
      item.text;
    const ready = item.audioState === 'complete' && !!item.artifactKey;
    const required = hasExisting && !unchanged;
    return {
      ...item,
      label: audioPlacementLabel(item.placementId),
      hasExisting,
      unchanged,
      ready,
      required,
      needsAudio: required && !ready,
    };
  });
}
