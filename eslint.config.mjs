import domdomegg from 'eslint-config-domdomegg';

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
export default [
	...domdomegg,
	{
		rules: {
			// Pulumi resources are constructed for their side effects (registering
			// the resource), so `new Resource(...)` without assignment is idiomatic.
			'no-new': 'off',
		},
	},
];
