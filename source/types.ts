import browser from 'webextension-polyfill';

// Tab data
export interface TabData {
	// Communication port
	port: browser.Runtime.Port,
	// Result data
	results: Result | null,
	extraFlags: string[],
	timer: NodeJS.Timeout | null,
};


// Results
export interface Result {
	// Reference missmatches (list of keys)
	refMissmatches: string[],
	// Function missmatches
	funcMissmatches: FuncMissmatch[],
	// Error (optional; success is also allowed :p)
	error: string | null | undefined,
	// Flags can indicate various additional findings
	flags: string[]
};

// Function missmatch
export interface FuncMissmatch {
	// Array of keys in hierarchical order
	keys: string[],
	// This is currently always true, since only missmatches are stored.
	missmatch: boolean,
	// Indicates whether the associated .toString() function was overwritten.
	toStringOverwrite: boolean,
	// String value of the function. This represents the function's code
	stringValue: string,
};

// Extension options
export interface Options {
	// Data collection endpoint
	endpoint: string,
}
