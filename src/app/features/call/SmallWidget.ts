/**
 * SmallWidget — lightweight Matrix Widget API bridge for generic (non-call) room widgets.
 *
 * Provides startMessaging / stopMessaging around an iframe and a createVirtualWidget
 * helper that builds the IApp definition from room context.
 *
 * This does NOT handle call/voice widgets — those use the native LiveKit engine.
 */

import { ClientWidgetApi, Widget, WidgetDriver } from 'matrix-widget-api';
import type { MatrixClient } from 'matrix-js-sdk';

export interface IApp {
  id: string;
  name: string;
  type: string;
  url: string;
  roomId?: string;
  creatorUserId: string;
  data?: Record<string, unknown>;
}

/** Minimal WidgetDriver that accepts all capability requests (no UI required for generic embeds). */
class StubWidgetDriver extends WidgetDriver {
  override validateCapabilities(requested: Set<string>) {
    return Promise.resolve(requested);
  }
}

export class SmallWidget {
  private widget: Widget;
  private messaging: ClientWidgetApi | null = null;

  constructor(app: IApp) {
    this.widget = new Widget(app);
  }

  startMessaging(iframe: HTMLIFrameElement): void {
    if (this.messaging) return;
    // ClientWidgetApi starts messaging automatically on construction.
    this.messaging = new ClientWidgetApi(this.widget, iframe, new StubWidgetDriver());
  }

  stopMessaging(): void {
    if (!this.messaging) return;
    this.messaging.stop();
    this.messaging = null;
  }
}

/**
 * Builds an IApp for a room widget, substituting Matrix template variables
 * and setting required Widget API query parameters.
 *
 * @param mx           MatrixClient instance
 * @param widgetId     Unique widget ID (stateKey of im.vector.modular.widgets)
 * @param userId       The local user's Matrix ID
 * @param name         Widget display name
 * @param type         Widget type (e.g. 'm.custom', 'jitsi', etc.)
 * @param resolvedUrl  URL with template vars already substituted + widgetId/parentUrl set
 * @param _waitForIframeLoad  (unused — kept for API compat; widget signals via ContentLoaded)
 * @param data         Additional widget data
 * @param roomId       Room the widget belongs to
 */
export function createVirtualWidget(
  mx: MatrixClient,
  widgetId: string,
  userId: string,
  name: string,
  type: string,
  resolvedUrl: URL,
  _waitForIframeLoad: boolean,
  data: Record<string, unknown>,
  roomId: string,
): IApp {
  return {
    id: widgetId,
    name,
    type,
    url: resolvedUrl.toString(),
    roomId,
    creatorUserId: userId,
    data,
  };
}
