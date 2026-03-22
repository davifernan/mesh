/**
 * callErrors.ts
 *
 * User-friendly error message formatting for call/SFU errors.
 * Maps raw Error objects to short, actionable strings shown in the call UI.
 */

/** Known error patterns → user-facing messages. */
const ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/device not found/i,         'Mikrofon nicht gefunden. Schließe ein Mikrofon an und versuche es erneut.'],
  [/permission denied/i,        'Mikrofonzugriff verweigert. Bitte erlaube den Zugriff in den Browsereinstellungen.'],
  [/not allowed/i,              'Mikrofonzugriff nicht erlaubt. Bitte Berechtigungen prüfen.'],
  [/No LiveKit focus URL/i,     'Kein Voice-Server konfiguriert. Bitte einen Administrator kontaktieren.'],
  [/SFU token.*failed/i,        'Verbindung zum Voice-Server fehlgeschlagen. Bitte erneut versuchen.'],
  [/Legacy SFU.*failed/i,       'Voice-Server nicht erreichbar. Bitte erneut versuchen.'],
  [/Room not found/i,           'Raum nicht gefunden. Bitte die Seite neu laden.'],
  [/ICE.*failed/i,              'Netzwerkverbindung fehlgeschlagen. Firewall oder VPN könnte das Problem sein.'],
  [/signal.*lost/i,             'Signalverbindung unterbrochen. Verbindung wird wiederhergestellt…'],
  [/timeout/i,                  'Zeitüberschreitung bei der Verbindung. Bitte erneut versuchen.'],
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
  return `Verbindungsfehler: ${truncated}`;
}
