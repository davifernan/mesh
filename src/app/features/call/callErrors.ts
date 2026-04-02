/**
 * callErrors.ts
 *
 * User-friendly error message formatting for call/SFU errors.
 * Maps raw Error objects to short, actionable strings shown in the call UI.
 */

/** Known error patterns → user-facing messages. */
const ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/device not found/i,         'Microphone not found. Please connect a microphone and try again.'],
  [/permission denied/i,        'Microphone access denied. Please allow access in your browser settings.'],
  [/not allowed/i,              'Microphone access not permitted. Please check your permissions.'],
  [/No LiveKit focus URL/i,     'No voice server configured. Please contact an administrator.'],
  [/SFU token.*failed/i,        'Connection to voice server failed. Please try again.'],
  [/Legacy SFU.*failed/i,       'Voice server unreachable. Please try again.'],
  [/Room not found/i,           'Room not found. Please reload the page.'],
  [/ICE.*failed/i,              'Network connection failed. A firewall or VPN may be the cause.'],
  [/signal.*lost/i,             'Signal connection lost. Attempting to reconnect…'],
  [/timeout/i,                  'Connection timed out. Please try again.'],
];

/**
 * Converts a raw call Error into a short, user-readable message.
 *
 * @param err - The error thrown during call setup or runtime.
 * @returns A localized, non-technical string suitable for display in the call UI.
 */
export function formatCallError(err: unknown): string {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : String(err);

  for (const [pattern, friendly] of ERROR_PATTERNS) {
    if (pattern.test(message)) return friendly;
  }

  // Generic fallback — show a truncated raw message so devs can still diagnose
  const truncated = message.length > 120 ? `${message.slice(0, 120)}…` : message;
  return `Connection error: ${truncated}`;
}
