export default () => {
	// This code will run as the first script in the context of the page.
	// WARNING: Special care is required when accessing existing functions, since the pages JavaScript code could overwrite globals or prototypes.

	// Anonymous function wrapper
	(() => {
		const prefix = "[WAM-DETECTOR]";
		// See https://developer.mozilla.org/en-US/docs/Web/API/Window
		const ignore = [
			"mozInnerScreenX", "mozInnerScreenY",
			"innerHeight", "innerWidth",
			"outerHeight", "outerWidth",
			"height", "width",
			"pageXOffset", "pageYOffset",
			"scrollMaxX", "scrollMaxY",
			"scrollX", "scrollY",
			"screenX", "screenY",
			"screenLeft", "screenTop",
			"devicePixelRatio",
			"length", "location", "name",
			"locationbar", "menubar", "screen",
			"personalbar", "sidebar", "scrollbars",
			"frameElement", "event", "closed",
			"opener", "origin",
			"isSecureContext", "visualViewport",
			"document", "clientInformation",
			/* self */
			"window", "self", "frames", "parent", "top",
			/* deprecated */
			"content", "_content", "status",
			"defaultStatus", "dialogArguments",
			"mozPaintCount", "orientation",
			"returnValue",
		];
		// References to original properties
		const refs = {
			console: window.console,
			postMessage: window.postMessage,
		};

		const {log, error, info, warn, debug} = refs.console;
		const postMessage = (...args) => refs.postMessage.apply(window, args);
		const funcToString = Function.prototype.toString;
		const getOwnPropertyNames = Object.getOwnPropertyNames;
		const getPrototypeOf = Object.getPrototypeOf;
		const entries = Object.entries;

		let count = 1;

		log(prefix, 'Successfully injected.');

		for (const key of getOwnPropertyNames(window)) {
			const value = window[key];

			// Ignore properties defined above
			if (ignore.includes(key)) continue;

			// Ignore numbers, strings and undefined
			let type = typeof value;
			if (type === 'number' || type === 'string' || type === 'undefined') continue;

			// Ignore empty values
			if (value === null) continue;

			// Ignore event handlers
			if (key.startsWith("on")) continue;

			// Ignore cyclic references
			if (value === window) continue;
			refs[key] = value;
			count++;
		}

		log(prefix, `Stored ${count} references.`);
		Object.freeze(refs);

		/**
		 * Removes prefixes from a string, if found.
		 * Returns either with first found prefix removed, or unchanged string if none found.
		 * @param {String} str String
		 * @param {String[]} prefixes Array of prefixes to remove
		 * @returns {String}
		 */
		const removePrefixes = (str, prefixes) => {
			for (const prefix of prefixes) {
				if (str.startsWith(prefix)) {
					return str.substring(prefix.length);
				}
			}
			return str;
		};

		/**
		 * Returns the expected string representation of built-in functions.
		 * @param {String} name Name of the function.
		 * @returns {String}
		 */
		const builtinFuncString = name => {
			return funcToString.apply(funcToString).replace('toString', name);
			// Firefox:
			//return `function ${name}() {\n    [native code]\n}`;
			// Chromium:
			//return `function ${name}() { [native code] }`;
		};

		/**
		 * Observes overwrites of a property.
		 * @param {Object} obj Parent object
		 * @param {String} prop Property name
		 * @param {Function} hook Hook function.
		 */
		const observeOverwrites = (obj, prop, hook) => {
			try {
				let shadow = obj[prop];
				Object.defineProperty(obj, prop, {
					set: value => {
						if (hook) hook();
						shadow = value;
					},
					get: () => shadow,
				});
			} catch { /* ignore error */ }
		};

		/**
		 * Adds a hook to a function.
		 * @param {Object} obj Parent object
		 * @param {String} prop Property name
		 * @param {Function} hook Hook function.
		 */
		const hookFunction = (obj, prop, hook) => {
			let orig = obj[prop];
			obj[prop] = (...args) => {
				hook(...args);
				return orig(...args);
			}
		};

		const verifyObject = (obj, depth=0, keys=[], seen=[], result={missmatches: []/*, error: null */}) => {
			let objects = [];
		
			const objtype = typeof obj;
			if (objtype !== 'object') {
				error(prefix, 'Invalid type:', objtype);
				return;
			}

			let propertyNames = new Set(getOwnPropertyNames(obj));
			// Only check initial properties of the window object.
			if (depth === 0) {
				propertyNames = new Set(getOwnPropertyNames(refs));
			} else {
				// Add properties of the prototype
				let proto = getPrototypeOf(obj);
				if (proto !== null && typeof proto === 'object') {
					let protoPropertyNames = getOwnPropertyNames(proto);
					for (let proto_key of protoPropertyNames) {
						if (['constructor', '__proto__'].includes(proto_key)) continue;
						propertyNames.add(proto_key);
					}
				}
			}
		
			for (let item_key of propertyNames) {
				const value = obj[item_key];
				const type = typeof value;

				// Skip properties that start with an underscore, dollar or at
				// e.g. __zone_symbol__X
				if (item_key.startsWith('_') || item_key.startsWith('$') || item_key.startsWith('@')) continue;
				// Skip custom properties
				if (item_key.startsWith('jscomp_')
				|| item_key.startsWith('nr@')
				|| item_key.startsWith('Symbol(')
				|| item_key.startsWith('closure_')
				|| item_key.startsWith('jQuery')
				) continue;
				// Skip history state object
				if (depth === 1 && keys.at(-1) === 'history' && item_key === 'state') continue;
				
				if (type === 'function') {
					let missmatch = false, toStringOverwrite = false;
					let stringValue = funcToString.apply(value)

					if (stringValue !== builtinFuncString(item_key)) {
						// Ignore event handlers
						if (item_key.startsWith('on')) {
							//info(prefix, Skipped callback: d=${depth}, k=${keys.join('.')}.${item_key}`)
							continue;
						}
						// TODO: put this somewhere else?
						// webkit is weird. why are you making this harder for me? qwq
						if (item_key === 'WebKitCSSMatrix' && depth === 0) item_key = 'DOMMatrix';
						if (item_key === 'webkitSpeechRecognitionError' && depth === 0) item_key = 'SpeechRecognitionErrorEvent';
						// chrome is weird. why are you making this harder for me? qwq
						if (keys.at(-1) === 'chrome' && ['loadTimes', 'csi'].includes(item_key) && depth === 1) item_key = '';
						if (stringValue == builtinFuncString(removePrefixes(item_key, ['webkit', 'WebKit']))) {
							//info(prefix, `Mismatch only because of Webkits weird quirks: d=${depth}, k=${keys.join('.')}.${item_key}`)
							continue;
						}
						// Not native code.
						warn(prefix, `Mismatch: d=${depth}, k=${keys.join('.')}.${item_key}\nstring value:`, stringValue);
						missmatch = true;
					}
					if (value.toString !== funcToString) {
						//log(prefix, `toString() was overwritten: d=${depth}, k=${keys.join('.')}.${item_key}`);
						toStringOverwrite = true;
					}

					if (missmatch) {
						result.missmatches.push({
							keys: [...keys, item_key],
							missmatch: missmatch,
							toStringOverwrite: toStringOverwrite,
							stringValue: stringValue,
						});
					}
				} else if (type === 'object') {
					if (value === obj || seen.includes(value)) { info(prefix, `skipped ${item_key} because it was already verified (might be a cyclic reference)`, keys); continue;}
					if (value === null) { info(prefix, `skipped ${item_key} because it's null`, keys); continue;}
					
					objects.push([item_key, value]);
				}
			}
		
			//info(prefix, 'finished one pass of depth', depth, 'in', keys.join('.'))
			//info(prefix, objects.length + ' objects in queue')
		
			if (depth > 10) {
				error(prefix, 'max depth reached:', keys.join('.'));
				result.error = 'MAX_DEPTH';
				return;
			}
		
			let newSeen = [...seen, obj];
		
			for (const [item_key, item] of objects) {
				verifyObject(item, depth+1, [...keys, item_key], newSeen, result);
			}
		
			// Only return the result on the original invocation of the function.
			if (depth === 0) return result;
		}

		const verifyReferences = () => {
			let missmatches = [];

			// Verify that the stored references still match the window properties.
			for (const [key, value] of entries(refs)) {
				if (window[key] !== value) {
					missmatches.push(key);
				}
			}

			const count = missmatches.length
			if (count === 0) {
				info(prefix, 'All references seem to match.');
			} else {
				warn(prefix, `Reference does not match for ${count} properties:`, missmatches);
			}

			let funcResult = verifyObject(window);

			let result = {
				refMissmatches: missmatches,
				funcMissmatches: funcResult.missmatches,
				flags: [],
			}
			if (funcResult.error) {
				result.error = funcResult.error;
			}

			// Detect 'shimmed' flags
			if (HTMLElement.shimmed) {
				result.flags.push('HTMLElement.shimmed');
			}
			if (HTMLElement.es5Shimmed) {
				// This flag is found in Google services like https://www.youtube.com/
				result.flags.push('HTMLElement.es5Shimmed');
			}
			if (HTMLElement.es6Shimmed) {
				result.flags.push('HTMLElement.es6Shimmed');
			}
			if (HTMLElement.es7Shimmed) {
				result.flags.push('HTMLElement.es7Shimmed');
			}

			// Detect core-js
			// https://github.com/zloirock/core-js/issues/726
			// https://github.com/zloirock/core-js/issues/51
			if (Object.prototype.hasOwnProperty.call(window, '__core-js_shared__')) {
				result.flags.push('core-js');
				info(prefix, 'This page uses core-js with the following version(s):', window['__core-js_shared__'].versions);
			}

			postMessage({
				sender: 'page',
				type: 'result',
				result: result
			});

			return result;
		};

		try {
			// Make the function globally available
			Object.defineProperty(window, 'verifyReferences', {
				value: verifyReferences,
				enumerable: false,
				writable: false,
				configurable: false,
			});
			Object.freeze(window.verifyReferences);
			Object.defineProperty(window, 'verifyObject', {
				value: verifyObject,
				enumerable: false,
				writable: false,
				configurable: false,
			});
			Object.freeze(window.verifyObject);
		} catch (e) {
			warn(prefix, 'Error on window.verifyReferences() definition. This can happen due to an auto-reload during development.')
		}

		let cooldown = null;
		const onOverwrite = (props, stack) => {
			//log(prefix, 'onOverwrite:', props);

			if (cooldown) clearTimeout(cooldown);
			cooldown = setTimeout(verifyReferences, 200);

			postMessage({
				sender: 'page',
				type: 'overwrite',
				keys: props,
				stack: stack,
			});
		};

		// Watch for overwrites.
		for (const key in refs) {
			observeOverwrites(window, key, () => {
				warn(key+" was overwritten. stack:", (new Error()).stack);
				onOverwrite([key], (new Error()).stack);
			});
		}

		// Watch for overwrites of child properties.
		/*
		for (const parentkey of ['crypto', 'Math']) {
			const parent = window[parentkey];

			for (const key of getOwnPropertyNames(parent)) {
				observeOverwrites(parent, key, () => {
					let fullkey = parentkey+"."+key;
					warn(fullkey+" was overwritten. stack:", (new Error()).stack);
					onOverwrite([fullkey], (new Error()).stack);
				});
			}
		}
		*/
		for (const key of ['log', 'debug', 'info', 'trace', 'table', 'dir', 'clear', 'assert', 'error', 'warn']) {
			observeOverwrites(console, key, () => {
				let fullkey = 'console.'+key;
				warn(prefix, fullkey+' was overwritten. stack:', (new Error()).stack);
				onOverwrite([fullkey], (new Error()).stack);
			});
		}
		observeOverwrites(history, 'pushState', () => {
			let fullkey = 'history.pushState';
			warn(prefix, fullkey+" was overwritten. stack:", (new Error()).stack);
			onOverwrite([fullkey], (new Error()).stack);
		});
		observeOverwrites(history, 'replaceState', () => {
			let fullkey = 'history.replaceState';
			warn(prefix, fullkey+' was overwritten. stack:', (new Error()).stack);
			onOverwrite([fullkey], (new Error()).stack);
		});

		// Hook into functions that can be used to overwrite properties.
		hookFunction(Object, 'defineProperty', (obj, prop, descriptor) => {
			let prefix = '';

			// Ignore non-window properties,
			// but include child properties of window properties
			if (obj !== window) {
				let isChildProp = false;

				for (const key in refs) {
					if (obj === refs[key]) {
						isChildProp = true;
						prefix = key+".";
						break;
					}
				}

				if (!isChildProp) return;
			} else {
				// Ignore new window properties
				if (!Object.prototype.hasOwnProperty.call(refs, prop)) return;
			}

			let key = prefix+prop;

			warn(prefix, key+' was overwritten. stack:', (new Error()).stack);
			onOverwrite([key], (new Error()).stack);
		});
		hookFunction(Object, 'defineProperties', (obj, props) => {
			let keys = Object.keys(props);

			// Ignore non-window properties,
			// but include child properties of window properties
			if (obj !== window) {
				let isChildProp = false;

				for (const refkey in refs) {
					if (obj === refs[refkey]) {
						isChildProp = true;

						// Ignore new window properties
						keys = keys.filter(key =>
							Object.prototype.hasOwnProperty.call(obj, key)
						);
						// Return if no keys are left
						if (keys.length === 0) return;

						// Add prefix
						keys = keys.map(key => refkey+"."+key);

						break;
					}
				}

				if (!isChildProp) return;
			} else {
				// Ignore new window properties
				keys = keys.filter(key =>
					Object.prototype.hasOwnProperty.call(refs, key)
				);
				// Return if no keys are left
				if (keys.length === 0) return;
			}

			warn(prefix, 'multiple properties overwritten:', keys, 'stack:', (new Error()).stack);
			onOverwrite(keys, (new Error()).stack);
		});

		window.addEventListener('message', ev => {
			if (ev.source == window &&
				ev.data.sender && ev.data.type &&
				ev.data.sender == 'content-script' &&
				ev.data.type == 'wam-verification-request') {
					info(prefix, 'Received verification request.');
					verifyReferences();
					ev.preventDefault();
			}
		});
	})();
};
