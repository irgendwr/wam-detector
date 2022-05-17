// Add an 'overwrite' API to the window object that can later be called to overwrite certain browser APIs.
window.overwrite = {

	// This example overwrites fetch and logs a warning on each call.
	fetch: () => {
		const originalFetch = window.fetch;

		window.fetch = (input, init) => {
			console.warn('The fetch function was overwritten with a custom function.');
			originalFetch(input, init);
			// Here an attacker could exfiltrate data, eg. via a second originalFetch(...) call
		};
	},

	// This example overwrites console.log() and console.info()
	property: () => {
		const originalLog = window.console.log;
		const originalInfo = window.console.info;
		const originalWarn = window.console.warn;

		window.console.log = (...args) => {
			originalWarn('The console.log function was overwritten with a custom function.');
			return originalLog(...args);
		};

		window.console.info = (...args) => {
			originalWarn('The console.info function was overwritten with a custom function.');
			return originalInfo(...args);
		};
	},

};
