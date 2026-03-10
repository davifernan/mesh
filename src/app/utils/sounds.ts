// Notification sounds — backed by /public/sound/message.mp3 from the call sound library.
// All functions share the same asset at different volume levels to preserve
// the original semantic hierarchy (mention > reply > reaction > current room > other room).
// Callers are responsible for checking user settings before calling.

import { playCallSound, CallSoundType } from './callSounds';

/** C5->E5 two-tone ascending — urgent mention alert */
export function playMentionSound(): void {
  playCallSound(CallSoundType.Message, { volume: 1.0 });
}

/** Single A4 soft beep — activity in current room */
export function playCurrentRoomSound(): void {
  playCallSound(CallSoundType.Message, { volume: 0.4 });
}

/** Low Eb4 tick, very quiet — activity in another room */
export function playOtherRoomSound(): void {
  playCallSound(CallSoundType.Message, { volume: 0.2 });
}

/** Very brief click — someone started typing */
export function playTypingSound(): void {
  playCallSound(CallSoundType.Message, { volume: 0.1 });
}

/** Sparkle tones — reaction received */
export function playReactionSound(): void {
  playCallSound(CallSoundType.Message, { volume: 0.6 });
}

/** Three-step sweep — reply to your message */
export function playReplyToMeSound(): void {
  playCallSound(CallSoundType.Message, { volume: 0.8 });
}

/** Plays when a new viewer starts watching a screen share */
export function playViewerJoinSound(): void {
  playCallSound(CallSoundType.ViewerJoin, { volume: 0.5 });
}

/** Plays when a viewer stops watching a screen share */
export function playViewerLeaveSound(): void {
  playCallSound(CallSoundType.ViewerLeave, { volume: 0.5 });
}
