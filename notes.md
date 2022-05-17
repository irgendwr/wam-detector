# Notes

Regex for filtering results:
- Gov domains that do not automatically redirect to https:
  `[\w.]+gov[\w.]*(,[\w]+){3},False`
- Gov pages that did not produce a result:
  `[\w.]+gov[\w.]*,-1`
- ...

```javascript
/**
 * Observes overwrites of a property.
 * @param {Object} obj Parent object
 * @param {String} prop Property name
 * @param {Function} hook Hook function.
 */
function observeOverwrites(obj, prop, hook) {
    let shadow = Symbol();
    try {
        Object.defineProperties(obj, {
            [shadow]: { value: obj[prop], writable: true },
            [prop]: {
                set: value => {
                    console.warn(prop+" was overwritten. stack:", (new Error()).stack);
                    if (hook) hook();
                    obj[shadow] = value;
                },
                get: () => obj[shadow],
            }
        });
    } catch { /* ignore error */ }
};

/**
 * Adds a hook to a function.
 * @param {Object} obj Parent object
 * @param {String} prop Property name
 * @param {Function} hook Hook function.
 */
function hookFunction(obj, prop, hook) {
    let orig = obj[prop];
    obj[prop] = (...args) => {
        hook(...args);
        return orig(...args);
    }
}

observeOverwrites(window, 'fetch');
hookFunction(Object, 'defineProperty', (obj, prop, descriptor) => {
    if (obj !== window) return;
    console.warn(prop+" was overwritten. stack:", (new Error()).stack);
});
hookFunction(Object, 'defineProperties', (obj, props) => {
    if (obj !== window) return;
    console.warn("multiple properties overwritten:", Object.keys(props), "stack:", (new Error()).stack);
});
```

Load polyfill library:

```javascript
var script = document.createElement('script');
script.src = "https://polyfill.io/v3/polyfill.js?features=fetch&flags=always";
document.body.append(script);
```

Example modification:

```javascript
console.warn = (...x)=>{console.log("MODIFIED", ...x)}
```

List keys by type:

```javascript
types = {};

for (const key of Object.getOwnPropertyNames(window)) {
	const value = window[key]
	const type = typeof value
	if (!types[type]) {
		types[type] = {count: 0, keys: []}
	}
	types[type].count++;
	types[type].keys.push(key);
}
```

Count lines of code: `wc -l source/*.{js,ts,html,css,json} scripts/*.py Makefile`
