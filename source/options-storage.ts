import GenericOptionsSync from 'webext-options-sync';

export default new GenericOptionsSync({
	defaults: {
		endpoint: 'http://127.0.0.1:8082/collect',
	},
	migrations: [
		GenericOptionsSync.migrations.removeUnused,
	],
	logging: true,
});
