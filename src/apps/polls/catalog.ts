import { registerApp } from '../../app/state/microappCatalog';
import buildConfig from '../../../build.config';

// Runtime URL (Docker): injected by docker-entrypoint.sh into window.__BC_MICROAPPS__
// before the ES module bundle executes, so this side-effect reads the correct value.
// Dev fallback: build.config.ts (set pollsWidgetUrl there for local testing).
const pollsUrl: string =
  (window as any).__BC_MICROAPPS__?.pollsWidgetUrl ||
  buildConfig.pollsWidgetUrl;

if (pollsUrl) {
  registerApp({
    id: 'polls',
    name: 'Polls',
    description: 'Create polls and votes for the room',
    icon: '🗳️',
    category: 'decide',
    widgetUrl: `${pollsUrl}?widgetId=$matrix_widget_id&parentUrl=$matrix_client_origin`,
  });
}
