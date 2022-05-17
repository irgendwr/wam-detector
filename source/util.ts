import browser from 'webextension-polyfill';
import { Result } from './types';
import { patterns, schemes, uris } from './constants';

export function sendToCollector(endpoint: string, data: { uri?: string; status: number, result: Result|object; }) {
	if (!endpoint) return;
	try {
		fetch(endpoint, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(data)
		}).catch(error => {
			console.debug('Unable to send data to collector. Make sure that it\'s running and that the configured address is correct.', error);
		})
	} catch {}
};

export function clearAction(details: (browser.WebNavigation.OnBeforeNavigateDetailsType | browser.WebNavigation.OnCommittedDetailsType)) {
	const { url, tabId } = details;
	// Disable on pages that do not support script injection.
	// Disable on internal schemes
	if (url.startsWith(schemes.chrome) || url.startsWith(schemes.edge)
	// Disable on about: pages, except about:blank (new/empty page)
	|| (patterns.about.test(url) && url !== uris.aboutBlank)
	// Disable on addon pages
	|| url.startsWith(uris.chromeWebstore) || url.startsWith(uris.mozillaAddons)) {
		// Disable and set grey icon
		browser.browserAction.disable(tabId);
		browser.browserAction.setIcon({
			path: 'images/icon-grey.png',
			tabId: tabId,
		});
	} else {
		// Enable and set yellow icon
		browser.browserAction.enable(tabId);
		browser.browserAction.setIcon({
			path: 'images/icon-yellow.png',
			tabId: tabId,
		});
	}

	// Clear text
	browser.browserAction.setBadgeText({
		text: null,
		tabId: tabId,
	});
};

export function showStatus(tabId: number, count: number) {	
	browser.browserAction.enable(tabId);

	const modified = count > 0;
	const icon = 'images/icon-' + (modified ? 'red' : 'green') + '.png';
	const text = modified ? count.toString() : '';

	browser.browserAction.setIcon({
		path: icon,
		tabId: tabId,
	});
	browser.browserAction.setBadgeText({
		text: text,
		tabId: tabId,
	});
};
