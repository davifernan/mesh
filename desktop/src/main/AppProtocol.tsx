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

import path from 'node:path';
import {BUNDLED_APP_HOST, BUNDLED_APP_SCHEME} from '@electron/common/Constants';
import {net, protocol} from 'electron';
import log from 'electron-log';

/**
 * Must be called BEFORE app.whenReady() — registers the app:// scheme
 * as a privileged standard scheme so Electron treats it like https://.
 * This enables:
 *   - fetch() calls within the page (supportFetchAPI)
 *   - Secure context APIs (mic, camera, E2EE crypto) (secure)
 *   - Standard URL resolution so absolute paths (/config.json) work (standard)
 *   - CORS headers on responses (corsEnabled)
 */
export function registerSchemesAsPrivileged(): void {
	protocol.registerSchemesAsPrivileged([
		{
			scheme: BUNDLED_APP_SCHEME,
			privileges: {
				secure: true,
				standard: true,
				supportFetchAPI: true,
				corsEnabled: true,
				stream: true,
			},
		},
	]);
}

/**
 * Must be called AFTER app.whenReady() — wires up the request handler.
 *
 * Routing logic:
 *   - Requests with a file extension → serve the asset directly from resources/webapp/
 *   - All other paths (SPA routes like /home/space/room) → serve index.html
 *
 * This means users can reload the window at any SPA route and still get the app.
 */
export function registerAppProtocol(): void {
	const webappDir = path.join(process.resourcesPath, 'webapp');

	protocol.handle(BUNDLED_APP_SCHEME, (request) => {
		const url = new URL(request.url);

		// Only handle requests for our host
		if (url.host !== BUNDLED_APP_HOST) {
			return new Response('Not found', {status: 404});
		}

		let relPath = url.pathname;
		if (relPath === '/' || relPath === '') {
			relPath = '/index.html';
		}

		const ext = path.extname(relPath);

		if (ext) {
			// Static asset — serve directly
			const filePath = path.join(webappDir, relPath);
			log.debug(`[AppProtocol] asset: ${relPath}`);
			return net.fetch(`file://${filePath}`);
		}

		// SPA route — always serve index.html, React Router handles the rest
		const indexPath = path.join(webappDir, 'index.html');
		log.debug(`[AppProtocol] SPA route ${relPath} → index.html`);
		return net.fetch(`file://${indexPath}`);
	});

	log.info(`[AppProtocol] Registered ${BUNDLED_APP_SCHEME}://${BUNDLED_APP_HOST}/ → ${webappDir}`);
}
