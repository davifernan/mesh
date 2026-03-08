// src/app/pages/client/call/VoiceCallLayoutStore.ts
import { atom } from 'jotai';

export type VoiceLayoutMode = 'grid' | 'focus';

export interface VoiceCallLayoutState {
  layoutMode: VoiceLayoutMode;
  pinnedParticipantId: string | null;
  isCarouselExpanded: boolean;
}

export const voiceCallLayoutAtom = atom<VoiceCallLayoutState>({
  layoutMode: 'grid',
  pinnedParticipantId: null,
  isCarouselExpanded: false,
});

/** Whether the call stats panel is open. Shared between NativeCallView and NativeCallControlBar. */
export const showStatsAtom = atom(false);

// Helper: set pinned participant and switch to focus mode
export const pinParticipantAtom = atom(
  null,
  (_get, set, participantId: string | null) => {
    set(voiceCallLayoutAtom, (prev) => ({
      ...prev,
      layoutMode: participantId ? 'focus' : 'grid',
      pinnedParticipantId: participantId,
    }));
  }
);
