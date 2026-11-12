// D1 のテストは関数を直に呼び、Worker を外から呼ばない。
// wrangler.jsonc の main（build したあとにしか無い）の代わりに渡し、build せずにテストできるようにする
export default {
	fetch: () => new Response(null, { status: 404 })
} satisfies ExportedHandler;
