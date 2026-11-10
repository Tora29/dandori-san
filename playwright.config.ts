import { defineConfig, devices } from '@playwright/test';

const inCi = process.env['CI'] !== undefined;

export default defineConfig({
	// build を含むので、既定の 60 秒では足りないことがある
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !inCi,
		timeout: 180_000
	},
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	forbidOnly: inCi,
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		// 使う人の6割ほどが iPhone の Safari で、暗号は端末の中（Web Crypto）で動くため
		{ name: 'webkit', use: { ...devices['iPhone 15'] } }
	]
});
