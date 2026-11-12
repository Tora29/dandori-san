import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// 自分のファイルだけ runes にする。node_modules の中の古い部品は、そのまま読む
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	build: {
		// 正規表現の v フラグ（Safari 17・Chrome 112・Firefox 116 から）と Intl.Segmenter（Firefox 125 から）を使うため。
		// iOS 16 の端末は対象にしない（2026-11 に決めた）
		target: ['es2023', 'chrome120', 'edge120', 'firefox125', 'safari17', 'ios17']
	}
});
