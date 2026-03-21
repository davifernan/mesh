/**
 * callErrors.ts — User-friendly error message formatting for LiveKit/browser call errors.
 */

export function formatCallError(error: Error): string {
  const name = error.name;
  const message = error.message.toLowerCase();

  if (name === 'NotAllowedError') {
    return 'Mikrofon-Zugriff verweigert — Browser-Einstellungen prüfen';
  }
  if (name === 'NotFoundError') {
    return 'Kein Mikrofon gefunden — Gerät anschließen und neu versuchen';
  }
  if (name === 'OverconstrainedError') {
    return 'Gewähltes Gerät nicht verfügbar';
  }
  if (
    name === 'ConnectionError' ||
    message.includes('ice failed') ||
    message.includes('ice connection') ||
    message.includes('connection failed')
  ) {
    return 'Verbindung fehlgeschlagen — Firewall oder VPN?';
  }
  if (message.includes('unauthorized') || message.includes('401')) {
    return 'Authentifizierung fehlgeschlagen — erneut einloggen';
  }

  return error.message;
}
