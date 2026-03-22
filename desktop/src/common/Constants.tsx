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
// Copyright 2025-2026 mesh Contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const APP_PROTOCOL = 'mesh';

// Bundled web app — served via custom app:// protocol from resources/webapp/
// This is the default when no custom instance URL is configured.
export const BUNDLED_APP_SCHEME = 'app';
export const BUNDLED_APP_HOST = 'mesh';
export const BUNDLED_APP_ORIGIN = `${BUNDLED_APP_SCHEME}://${BUNDLED_APP_HOST}`;
export const BUNDLED_APP_URL = `${BUNDLED_APP_ORIGIN}/`;

// Remote instance URLs — used when the user has configured a custom hosted instance.
// MESH_APP_URL env var overrides for development / CI builds.
export const STABLE_APP_URL = process.env.MESH_APP_URL ?? null;
export const CANARY_APP_URL = process.env.MESH_CANARY_URL ?? STABLE_APP_URL;
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;
