/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

export const APP_PROTOCOL = 'bettercord';

// Required: set BETTERCORD_APP_URL before building the desktop app.
// Example: BETTERCORD_APP_URL=https://chat.example.com npm run build:desktop
if (!process.env.BETTERCORD_APP_URL) {
  throw new Error(
    '[BetterCord] BETTERCORD_APP_URL is not set. ' +
      'Set it to your web app URL before building the desktop app.',
  );
}

export const STABLE_APP_URL = process.env.BETTERCORD_APP_URL;
export const CANARY_APP_URL = process.env.BETTERCORD_CANARY_URL ?? STABLE_APP_URL;
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;
