// eslint-disable-next-line
import browser from 'webextension-polyfill';
import { Result } from './types';

document.addEventListener('DOMContentLoaded', () => {
	const refresh = document.getElementById('refresh');
	const info = document.getElementById('info');
	const refCount = document.getElementById('ref-count');
	const refKeys = document.getElementById('ref-keys');
	const funcCount = document.getElementById('func-count');
	const funcKeys = document.getElementById('func-keys');
	const flagsElement = document.getElementById('flags');
	const errorElement = document.getElementById('error');

	refresh?.addEventListener('click', ev => {
		console.log('refresh');

		browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => {
			if (!tabs || tabs.length === 0) return console.log('No active tabs found.');
			for (const tab of tabs) {
				const tabId = tab.id;
				if (!tabId) continue;

				browser.tabs.sendMessage(tabId, {
					type: 'request',
				});
			}
		});

		window.close();
	});

	// Wait for info
	browser.runtime.onMessage.addListener((ev: {type: string | null | undefined, result: Result | null | undefined, extraFlags: string[]}, sender) => {
		console.log('message received', ev);
		if (ev?.type === 'info' && ev?.result) {
			let { refMissmatches, funcMissmatches, flags, error } = ev.result;
			if (ev.extraFlags) {
				flags.push(...ev.extraFlags);
			}

			if (info && refCount && refKeys && funcCount && funcKeys && flagsElement && errorElement) {
				refCount.textContent = refMissmatches.length.toString();
				refKeys.textContent = refMissmatches.join(', ');
				funcCount.textContent = funcMissmatches.length.toString();
				funcKeys.textContent = funcMissmatches.map(m => m.keys.join('.')).join(', ');
				flagsElement.textContent = flags.join(', ');
				errorElement.textContent = error ? 'Error: '+error : '';
			}
		}
	});

	// Request info
	browser.runtime.sendMessage({
		type: 'info-request'
	});
});
