import { registerApp } from '../../app/state/microappCatalog';
import buildConfig from '../../../build.config';

// Runtime URL (Docker): injected by docker-entrypoint.sh into window.__BC_MICROAPPS__
// before the ES module bundle executes, so this side-effect reads the correct value.
// Dev fallback: build.config.ts (set whiteboardWidgetUrl there for local testing).
const whiteboardUrl: string =
  (window as any).__BC_MICROAPPS__?.whiteboardWidgetUrl ||
  buildConfig.whiteboardWidgetUrl;

if (whiteboardUrl) {
  registerApp({
    id: 'whiteboard',
    name: 'Whiteboard',
    description: 'Collaborate on a shared real-time whiteboard',
    icon: '🖊️',
    category: 'collaborate',
    widgetUrl: `${whiteboardUrl}?widgetId=$matrix_widget_id&parentUrl=$matrix_client_origin`,
    waitForIframeLoad: false, // nordeck widget sends ContentLoaded first; parent must wait for it
  });
}
