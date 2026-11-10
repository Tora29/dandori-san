import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		// 最初のテストを書くまでは、テストが無くても通す
		passWithNoTests: true,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					expect: { requireAssertions: true },
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
