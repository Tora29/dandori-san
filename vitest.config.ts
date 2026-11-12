import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// D1 の方は SvelteKit を読まない。adapter-cloudflare が cloudflare:workers を差し替えてしまうため
export default defineConfig(async () => ({
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					// extends に道を書いた project には、上の expect が引き継がれない
					expect: { requireAssertions: true },
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/lib/server/db/**']
				}
			},
			{
				plugins: [
					cloudflareTest({
						main: './src/lib/server/db/test-worker.ts',
						wrangler: { configPath: './wrangler.jsonc' },
						miniflare: {
							bindings: {
								TEST_MIGRATIONS: await readD1Migrations(
									path.join(import.meta.dirname, 'migrations')
								)
							}
						}
					})
				],
				test: {
					name: 'db',
					include: ['src/lib/server/db/**/*.test.ts'],
					setupFiles: ['src/lib/server/db/apply-migrations.ts']
				}
			}
		]
	}
}));
