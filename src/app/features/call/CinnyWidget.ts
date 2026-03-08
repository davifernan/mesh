import { Widget } from 'matrix-widget-api';

// Minimal widget app definition matching IWidget (creatorUserId is required by matrix-widget-api)
export interface IApp {
  id: string;
  name: string;
  type: string;
  url: string;
  roomId?: string;
  creatorUserId: string;
  data?: Record<string, unknown>;
}

// Wrapper class for the widget definition
export class CinnyWidget extends Widget {
  public constructor(private rawDefinition: IApp) {
    super(rawDefinition);
  }
}
