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

import fs from 'node:fs';
import path from 'node:path';
import {BUILD_CHANNEL} from '@electron/common/BuildChannel';
import {BUNDLED_APP_URL, CANARY_APP_URL, STABLE_APP_URL} from '@electron/common/Constants';
import log from 'electron-log';

const CONFIG_FILE_NAME = 'settings.json';

interface DesktopConfig {
	app_url?: string;
}

let config: DesktopConfig = {};
let configPath: string | null = null;

function saveDesktopConfig(): void {
	if (!configPath) {
		log.warn('Desktop config path not initialised; cannot save settings');
		return;
	}

	try {
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
		log.info('Saved desktop config to', configPath, {app_url: config.app_url ?? '(default)'});
	} catch (error) {
		log.error('Failed to save desktop config:', error);
	}
}

export function loadDesktopConfig(userDataPath: string): void {
	configPath = path.join(userDataPath, CONFIG_FILE_NAME);
	try {
		if (fs.existsSync(configPath)) {
			const data = fs.readFileSync(configPath, 'utf-8');
			config = JSON.parse(data) as DesktopConfig;
			log.info('Loaded desktop config from', configPath, {app_url: config.app_url ?? '(default)'});
		}
	} catch (error) {
		log.error('Failed to load desktop config:', error);
	}
}

export function getAppUrl(): string {
	// 1. Dev override via env var: MESH_APP_URL=http://localhost:8080 npm run dev
	if (process.env.MESH_APP_URL) {
		return process.env.MESH_APP_URL;
	}
	// 2. User-configured custom instance (saved in settings.json)
	//    Power users who self-host can point the desktop app at their own URL.
	if (config.app_url) {
		return config.app_url;
	}
	// 3. Canary remote URL (only if explicitly set at build time via MESH_CANARY_URL)
	if (BUILD_CHANNEL === 'canary' && CANARY_APP_URL) {
		return CANARY_APP_URL;
	}
	// 4. Stable remote URL (only if explicitly set at build time via MESH_APP_URL)
	if (STABLE_APP_URL) {
		return STABLE_APP_URL;
	}
	// 5. Default: bundled web app served via app://mesh/ protocol
	//    No remote URL needed — the web app is included in the Electron package.
	//    Users enter their Matrix homeserver in the login screen.
	return BUNDLED_APP_URL;
}

export function getCustomAppUrl(): string | null {
	return config.app_url ?? null;
}

export function setCustomAppUrl(appUrl: string | null): void {
	if (appUrl) {
		config.app_url = appUrl;
	} else {
		delete config.app_url;
	}

	saveDesktopConfig();
}
