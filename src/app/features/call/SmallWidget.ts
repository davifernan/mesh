import {
  ClientWidgetApi,
  Widget,
  WidgetDriver,
  type Capability,
  type IRoomEvent,
} from 'matrix-widget-api';
import {
  MatrixEvent,
  type MatrixClient,
  RoomEvent,
  RoomStateEvent,
  type Room,
} from 'matrix-js-sdk';

export interface IApp {
  id: string;
  name: string;
  type: string;
  url: string;
  roomId?: string;
  creatorUserId: string;
  data?: Record<string, unknown>;
}

function toRoomEvent(event: MatrixEvent): IRoomEvent {
  const roomId = event.getRoomId();
  const eventId = event.getId();
  const sender = event.getSender();

  if (!roomId || !eventId || !sender) {
    throw new Error('Matrix event is missing required widget fields');
  }

  const stateKey = event.getStateKey();

  return {
    type: event.getType(),
    sender,
    event_id: eventId,
    room_id: roomId,
    ...(stateKey !== undefined ? { state_key: stateKey } : {}),
    origin_server_ts: event.getTs(),
    content: (event.getContent() ?? {}) as Record<string, unknown>,
    unsigned: (event.getUnsigned() ?? {}) as Record<string, unknown>,
  };
}

class MatrixWidgetDriver extends WidgetDriver {
  private viewedRoomId: string | null;

  constructor(
    private readonly mx: MatrixClient,
    initialRoomId?: string,
  ) {
    super();
    this.viewedRoomId = initialRoomId ?? null;
  }

  public setViewedRoomId(roomId: string | null): void {
    this.viewedRoomId = roomId;
  }

  override validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    return Promise.resolve(new Set(requested));
  }

  override async sendEvent(
    eventType: string,
    content: unknown,
    stateKey: string | null = null,
    roomId: string | null = null,
  ): Promise<{ roomId: string; eventId: string }> {
    const targetRoomId = roomId ?? this.viewedRoomId;
    if (!targetRoomId) {
      throw new Error('No viewed room available for widget event');
    }

    const response =
      stateKey !== null
        ? await this.mx.sendStateEvent(
            targetRoomId,
            eventType as never,
            (content ?? {}) as Record<string, unknown>,
            stateKey,
          )
        : await this.mx.sendEvent(
            targetRoomId,
            eventType as never,
            (content ?? {}) as Record<string, unknown>,
          );

    return { roomId: targetRoomId, eventId: response.event_id };
  }

  override readStateEvents(
    eventType: string,
    stateKey: string | undefined,
    limit: number,
    roomIds: string[] | null = null,
  ): Promise<IRoomEvent[]> {
    const targetRoomIds = roomIds ?? (this.viewedRoomId ? [this.viewedRoomId] : []);
    const perRoomLimit = limit > 0 ? limit : Number.MAX_SAFE_INTEGER;

    return Promise.resolve(
      targetRoomIds.flatMap((roomId) => {
        const room = this.mx.getRoom(roomId);
        if (!room) return [];

        const events =
          stateKey === undefined
            ? room.currentState.getStateEvents(eventType)
            : [room.currentState.getStateEvents(eventType, stateKey)].filter(
                (event): event is MatrixEvent => event !== null,
              );

        return events.slice(0, perRoomLimit).map(toRoomEvent);
      }),
    );
  }

  override readRoomState(roomId: string, eventType: string, stateKey: string | undefined): Promise<IRoomEvent[]> {
    const room = this.mx.getRoom(roomId);
    if (!room) return Promise.resolve([]);

    const events =
      stateKey === undefined
        ? room.currentState.getStateEvents(eventType)
        : [room.currentState.getStateEvents(eventType, stateKey)].filter(
            (event): event is MatrixEvent => event !== null,
          );

    return Promise.resolve(events.map(toRoomEvent));
  }
}

export class SmallWidget {
  private readonly widget: Widget;
  private readonly driver: MatrixWidgetDriver;
  private messaging: ClientWidgetApi | null = null;
  private room: Room | null = null;

  private readonly onTimeline = (
    event: MatrixEvent,
    room?: Room,
    toStartOfTimeline?: boolean,
    removed?: boolean,
    data?: { liveEvent?: boolean },
  ): void => {
    if (!this.messaging || !room || room !== this.room || removed || toStartOfTimeline || !data?.liveEvent || event.isState()) {
      return;
    }

    void this.messaging.feedEvent(toRoomEvent(event));
  };

  private readonly onStateEvent = (event: MatrixEvent): void => {
    if (!this.messaging || !this.room || !event.isState() || event.getRoomId() !== this.room.roomId) {
      return;
    }

    void this.messaging.feedStateUpdate(toRoomEvent(event));
  };

  constructor(
    app: IApp,
    mx: MatrixClient,
  ) {
    this.widget = new Widget(app);
    this.driver = new MatrixWidgetDriver(mx, app.roomId);
    this.room = app.roomId ? mx.getRoom(app.roomId) : null;
  }

  startMessaging(iframe: HTMLIFrameElement): void {
    if (this.messaging) return;

    this.messaging = new ClientWidgetApi(this.widget, iframe, this.driver);

    if (this.widget.roomId) {
      this.driver.setViewedRoomId(this.widget.roomId);
      this.messaging.setViewedRoomId(this.widget.roomId);
      this.room?.on(RoomEvent.Timeline, this.onTimeline);
      this.room?.currentState.on(RoomStateEvent.Events, this.onStateEvent);
    }
  }

  stopMessaging(): void {
    this.room?.off(RoomEvent.Timeline, this.onTimeline);
    this.room?.currentState.off(RoomStateEvent.Events, this.onStateEvent);

    if (!this.messaging) return;
    this.messaging.stop();
    this.messaging = null;
  }
}

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
