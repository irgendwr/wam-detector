import browser from 'webextension-polyfill';
import optionsStorage from './options-storage';
import { TabData, Result, Options } from './types';
import { polyfillPatterns, status } from './constants';
import { sendToCollector, clearAction, showStatus } from './util';

// Extension options
let options: Options;

// Tab data
let tabdata: TabData[] = [];


async function init() {
	options = await optionsStorage.getAll();

	// Clear action once a new page starts loading
	browser.webNavigation.onBeforeNavigate.addListener(clearAction);
	browser.webNavigation.onCommitted.addListener(clearAction);

	// Listen for pages to finish loading
	browser.webNavigation.onDOMContentLoaded.addListener(onDOMContentLoaded);

	// Detect requests to Polyfill libraries
	browser.webRequest.onCompleted.addListener(onPolyfillRequest, {
		urls: polyfillPatterns,
		types: ['script', 'xmlhttprequest', 'object'] // top level: 'main_frame'
	});

	// TODO: this could also be interesting:
	// browser.webRequest.onBeforeRedirect

	// Communication between different contexts
	browser.runtime.onConnect.addListener(onConnected);
	browser.runtime.onMessage.addListener(handleMessage);

	// Cleanup when tab is closed
	browser.tabs.onRemoved.addListener(onTabClosed);
}

// Called when a new page loads the content script
function onConnected(port: browser.Runtime.Port) {
	const tabId = port.sender?.tab?.id;
	if (tabId === undefined) return console.error('connected: tab is undefined');

	// If set, clear previous timer
	let timer = tabdata[tabId]?.timer;
	if (timer) clearTimeout(timer);

	// Request verification results after waiting 1s
	timer = setTimeout(requestResult, 1000, port);

	// Initialize new tab data
	tabdata[tabId] = {
		port: port,
		results: null,
		extraFlags: [],
		timer: timer,
	};

	// Handle received messages
	port.onMessage.addListener(ev => {
		if (ev?.type === 'result' && ev.result) {
			onResult(port, ev);
		} else if (ev?.type === 'overwrite' && ev.keys && ev.stack) {
			onOverwrite(port, ev);
		}
	});
}

// Called once a page has finished loading
function onDOMContentLoaded(details: browser.WebNavigation.OnDOMContentLoadedDetailsType) {
	void browser.tabs.executeScript(details.tabId, {
		code: 'console.log("[WAM-DETECTOR] onDOMContentLoaded");',
		runAt: 'document_start',
		allFrames: true,
	});

	const tab = tabdata[details.tabId];
	if (tab) {
		// If set, clear previous timer
		if (tab.timer) clearTimeout(tab.timer);

		// Request verification results after waiting 1s
		tab.timer = setTimeout(requestResult, 1000, tab.port);
	}
}

// Called when a Polyfill library was requested
function onPolyfillRequest(details: browser.WebRequest.OnCompletedDetailsType) {
	const targetURL = details.documentUrl || details.originUrl || details.initiator || details.url;

	const tab = tabdata[details.tabId];
	const polyfillFlag = 'polyfill-library';
	if (tab && !tab.extraFlags.includes(polyfillFlag)) {
		tab.extraFlags.push(polyfillFlag)
	}

	const data = {
		polyfill: details.url,
		type: details.type,
		cache: details.fromCache,
		method: details.method,
		status: details.statusCode,
		// Firefox only:
		size: details.responseSize,
		thirdParty: details.thirdParty,
	};

	sendToCollector(options.endpoint, {
		uri: targetURL,
		status: status.POLYFILL_LIBRARY,
		result: data,
	});
}

// Called when a new result is available
function onResult(port: browser.Runtime.Port, ev: {result: Result}) {
	if (port.sender?.tab?.id === undefined) return console.error('onResult: tab is undefined');
	const tabId = port.sender.tab.id;
	const count = Math.max(ev.result.refMissmatches.length, ev.result.funcMissmatches.length);
	
	showStatus(tabId, count);

	let data = tabdata[tabId];
	if (data) {
		data.results = ev.result;
	}

	/* if (count > 0) {
		browser.notifications.create({
			type: 'basic',
			iconUrl: browser.runtime.getURL('images/icon-red.png'),
			title: 'Potential API Manipulation',
			message: 'The website overwrites: ' + keys.join(", "),
		});
	} */

	sendToCollector(options.endpoint, {
		uri: port.sender.url,
		status: count === 0 ? status.NOT_MODIFIED : status.MODIFIED,
		result: ev.result,
	});
}

// Called when an API was overwritten
function onOverwrite(port: browser.Runtime.Port, ev: {keys: string[]|Set<string>, stack: string}) {
	if (port.sender?.tab?.id === undefined) return console.error('onOverwrite: tab is undefined');

	sendToCollector(options.endpoint, {
		uri: port.sender.url,
		status: status.STACK_TRACE,
		result: {
			keys: ev.keys,
			stack: ev.stack,
		},
	});
}

// Request verification
function requestResult(port: browser.Runtime.Port) {
	port.postMessage({
		type: 'request'
	});
}

// Called when a new message is received
function handleMessage(ev: any, sender: browser.Runtime.MessageSender): void | Promise<any> {
	//console.log("handleMessage", ev);

	switch (ev.type) {
	case 'refresh':
		// This is handled in the content script.
		break;

	case 'info-request':
		browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => {
			if (tabs.length >= 1 && tabs[0]?.id) {
				const tabId = tabs[0]?.id;

				const data = tabdata[tabId];

				browser.runtime.sendMessage({
					type: 'info',
					result: data?.results,
					extraFlags: data?.extraFlags
				});
			}
		});
		break;

	default:
		break;
	}
}

// Cleanup data of closed tabs
function onTabClosed(tabId: number, removeInfo: browser.Tabs.OnRemovedRemoveInfoType) {
	if (tabdata[tabId]) {
		delete tabdata[tabId];
	}
}

void init();
