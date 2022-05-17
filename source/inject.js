import browser from 'webextension-polyfill';
import injectedFunction from './injected-script.js';

console.log('[WAM-DETECTOR] Injecting script...');

let myPort = browser.runtime.connect({name:"port-from-cs"});
myPort.postMessage({type: "hello"});


// Receive messages from background script:
myPort.onMessage.addListener(handleMessage);
// Receive messages from popup:
browser.runtime.onMessage.addListener(handleMessage);

function handleMessage(ev) {
	//console.debug("In content script, received message: ", ev);
	if (ev.type === 'request') {
		window.postMessage({
			type: 'wam-verification-request',
			sender: 'content-script'
		});
	}
}

// Receive messages from page:
window.addEventListener('message', ev => {
	if (ev.source == window &&
		ev.data &&
		ev.data.type &&
		ev.data.sender == 'page') {
		
		// Forward to background script:
		myPort.postMessage(ev.data);
	}
});

// Convert the function call to a string containing JavaScript code.
const code = stringifyFunctionCall(injectedFunction);

// Works on both Firefox and Chromium,
// but Firefox still applies the SCP, which means this might not succeed.
injectScript(code);

// Only works with Firefox:
// window.eval(code);
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#using_eval_in_content_scripts
// And it also has the Xray Vision API:
// https://firefox-source-docs.mozilla.org/dom/scriptSecurity/xray_vision.html#waiving-xray-vision

/**
 * Stringifies a function and argument.
 * @param {Function} fn Function
 * @param {...*} args Argument to be encoded by JSON.stringify();
 * This will not work for all possible values. Special cases are not handled here.
 * See following link for a more robust solution: https://stackoverflow.com/a/40572286/4884643
 */
function stringifyFunctionCall(fn, ...args) {
	// Stringify function, call with stringified arguments
	return `(${fn.toString()}).apply(null,${JSON.stringify(args)});`;
}

/**
 * Injects JavaScript code into the current page.
 * This code will be run in the context of the web-page,
 * as opposed to in the context of this content script.
 * @param {string} code JavaScript code
 */
function injectScript(code) {
	// Create new script element.
	const script = document.createElement('script');
	// Alternatively inject file: script.setAttribute('src', '...');
	script.textContent = code;
	// Prepend script to head, fallback to document root node.
	(document.head || document.documentElement).prepend(script);
	// Remove script after it was executed.
	//script.remove();
}
