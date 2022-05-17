export const status = {
	BATCH_ERROR: -2,
	ERROR: -1,
	NOT_MODIFIED: 0,
	MODIFIED: 1,
	POLYFILL_LIBRARY: 2,
	STACK_TRACE: 3,
};

export const patterns = {
	// Regex that matches Firefox's internal page URIs:
	// about:<something>[#<something]
	about: /^about:\w+(?:#\w+)?$/,
};

export const schemes = {
	chrome: 'chrome://',
	edge: 'edge://',
};

export const uris = {
	aboutBlank: 'about:blank',
	chromeWebstore: 'https://chrome.google.com/webstore',
	mozillaAddons: 'https://addons.mozilla.org/',
};

// Some URL patterns are redundant.
// This was done to document known URLs and in case we need to remove broad patterns due to false-positives.
// Pattern documentation: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns
export const polyfillPatterns = [
	// 'polyfill' in path
	'*://*/*polyfill',
	'*://*/*polyfill?*',
	'*://*/*polyfill*',
	'*://*/*polyfill*?*',
	// 'polyfill(.min).js' in path
	'*://*/*polyfill.js',
	'*://*/*polyfill.js?*',
	'*://*/*polyfill.min.js',
	'*://*/*polyfill.min.js?*',
	'*://*/*webcomponentsjs*',
	'*://*/*webcomponentsjs*?*',
	'*://*/*webcomponents-loader.js',
	'*://*/*webcomponents-loader.js?*',
	// es*-shim
	'*://*/*es5-shim*',
	'*://*/*es5-shim*?*',
	'*://*/*es6-shim*',
	'*://*/*es6-shim*?*',
	'*://*/*es7-shim*',
	'*://*/*es7-shim*?*',
	// polyfill APIs
	'*://polyfill.io/*/',
	'*://*.polyfill.io/*/',
	'*://polyfill.web-cell.dev/*.js',
	'*://polyfill.web-cell.dev/*.js?*',
	'*://polyfill.kaiyuanshe.cn/*.js',
	'*://polyfill.kaiyuanshe.cn/*.js?*',
	'*://polyfill.app/api/*',
	'*://polyfill.app/api/*?*',
	'*://polyfill.dev/api/*',
	'*://polyfill.app/api/*?*',
	// CDNs + polyfill libraries
	'*://unpkg.com/@webcomponents/webcomponentsjs*',
	'*://unpkg.com/*core-js*',
	'*://unpkg.com/*whatwg-fetch*',
	'*://unpkg.com/*polyfill*',
	'*://cdn.jsdelivr.net/npm/@webcomponents/webcomponentsjs*',
	'*://cdn.jsdelivr.net/*core-js*',
	'*://cdn.jsdelivr.net/*whatwg-fetch*',
	'*://cdn.jsdelivr.net/*polyfill*',
	'*://cdnjs.cloudflare.com/*webcomponentsjs*',
	'*://cdnjs.cloudflare.com/*core-js*',
	'*://cdnjs.cloudflare.com/*whatwg-fetch*',
	'*://cdnjs.cloudflare.com/*polyfill*',
];

/* Examples of polyfill URLs:
 - https://polyfill.io/v3/polyfill.min.js?features=fetch%2ClocalStorage|always
 - https://unpkg.com/@webcomponents/webcomponentsjs@2.6.0/webcomponents-bundle.js
 - https://cdnjs.cloudflare.com/ajax/libs/babel-polyfill/6.26.0/polyfill.min.js
 - https://cdn.jsdelivr.net/npm/babel-polyfill@6.26.0/lib/index.min.js
*/
