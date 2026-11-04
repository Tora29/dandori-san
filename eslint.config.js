import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

// sveltekit.md 1章の「使わない」。覚えている古い書き方で書いても、ここで止まる
const oldSvelteKit = 'SvelteKit 3 では使わない（sveltekit.md 1章）';
const oldSvelte = 'Svelte 5 の runes では使わない（sveltekit.md 1章）';
const timeMessage =
	'日にちと時刻は #lib/time.js の関数で扱う。動いている場所のタイムゾーンに左右されるため（code.md 2章）';

const sqlNow = "/'now'|CURRENT_(DATE|TIME|TIMESTAMP)|unixepoch\\(\\s*\\)/i";

// no-restricted-syntax は、後ろの設定が前の設定を丸ごと置き換える。ファイルごとに組を選んで渡す
const timeSyntax = [
	{
		selector:
			'CallExpression[callee.property.name=/^(get|set)(FullYear|Month|Date|Day|Hours|Minutes|Seconds|Milliseconds)$/]',
		message: timeMessage
	},
	{
		selector:
			'CallExpression[callee.property.name=/^(toDateString|toTimeString|toLocaleDateString|toLocaleTimeString|getTimezoneOffset)$/]',
		message: timeMessage
	},
	{
		selector:
			'CallExpression[callee.property.name=/^(slice|substring|split)$/][callee.object.callee.property.name="toISOString"]',
		message: timeMessage
	},
	{ selector: 'NewExpression[callee.name="Date"][arguments.length>1]', message: timeMessage },
	{
		selector: 'NewExpression[callee.name="Date"][arguments.0.type=/^(Literal|TemplateLiteral)$/]',
		message: timeMessage
	},
	{
		selector: 'CallExpression[callee.object.name="Date"][callee.property.name="parse"]',
		message: timeMessage
	},
	{
		selector:
			':matches(NewExpression, CallExpression)[callee.object.name="Intl"][callee.property.name="DateTimeFormat"]',
		message: timeMessage
	},
	{
		selector: `CallExpression[callee.property.name=/^(prepare|exec)$/] :matches(Literal[value=${sqlNow}], TemplateElement[value.raw=${sqlNow}])`,
		message: `SQL の今の時刻は UTC になる。日本時間の今日はバインドして渡す。${timeMessage}`
	}
];

const unsafeHtmlSyntax = [
	{
		selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
		message: '入れた文字が HTML として動く。textContent を使う（sveltekit.md 4章）'
	},
	{
		selector:
			'CallExpression[callee.property.name=/^(insertAdjacentHTML|setHTMLUnsafe|createContextualFragment)$/]',
		message: '入れた文字が HTML として動く（sveltekit.md 4章）'
	},
	{
		selector:
			'CallExpression[callee.object.name="document"][callee.property.name=/^(write|writeln)$/]',
		message: '入れた文字が HTML として動く（sveltekit.md 4章）'
	}
];

const oldKitSyntax = [
	{
		selector: 'Property[key.name="invalidateAll"]',
		message: `goto や update の refreshAll を使う。${oldSvelteKit}`
	},
	{
		selector:
			':matches(MemberExpression[object.name="platform"], MemberExpression[object.property.name="platform"])[property.name="env"]',
		message: `import { env } from "cloudflare:workers" を使う。${oldSvelteKit}`
	},
	{
		selector:
			':matches(VariableDeclarator[init.name="platform"], VariableDeclarator[init.property.name="platform"]) > ObjectPattern > Property[key.name="env"]',
		message: `import { env } from "cloudflare:workers" を使う。${oldSvelteKit}`
	}
];

const oldSvelteSyntax = [
	{ selector: 'SvelteDirective[kind="EventHandler"]', message: `onclick={…} と書く。${oldSvelte}` },
	{
		selector: 'SvelteElement[name.name="slot"]',
		message: `{@render children?.()} と snippet を使う。${oldSvelte}`
	},
	{ selector: 'SvelteReactiveStatement', message: `$derived か $effect を使う。${oldSvelte}` },
	{
		selector: 'ExportNamedDeclaration > VariableDeclaration[kind="let"]',
		message: `let { … } = $props() を使う。${oldSvelte}`
	},
	{
		selector: 'Identifier[name=/^\\$\\$(props|restProps|slots)$/]',
		message: `$props() を使う。${oldSvelte}`
	},
	{
		selector: 'SvelteAttribute[key.name=/^data-sveltekit-/] > SvelteLiteral[value="off"]',
		message: `"off" ではなく false と書く。${oldSvelteKit}`
	},
	{
		// a11y などのコンパイラの警告を、コメントで黙らせないため
		selector: 'SvelteHTMLComment[value=/svelte-ignore/]',
		message: 'svelte-ignore で警告を消さない。警告の元を直す'
	}
];

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// Semgrep のルールのテスト。わざと穴のある書き方を置いていて、tsconfig にも入れていない
	globalIgnores(['.semgrep/']),
	js.configs.recommended,
	ts.configs.strictTypeChecked,
	ts.configs.stylisticTypeChecked,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		// 規則をコメントで外すと、レビューで気づきにくいため
		linterOptions: { noInlineConfig: true },
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			// 定義の無い変数は TypeScript が見つけるので、ESLint では見ない
			// https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',

			curly: 'error',
			eqeqeq: 'error',
			'default-case-last': 'error',
			'logical-assignment-operators': 'error',
			'no-alert': 'error',
			'no-await-in-loop': 'error',
			'no-caller': 'error',
			// Workers のログで見るため、error と warn だけは残せる（外のエラー記録のサービスは使わない）
			'no-console': ['error', { allow: ['error', 'warn'] }],
			'no-else-return': 'error',
			'no-eval': 'error',
			'no-extend-native': 'error',
			'no-implicit-coercion': 'error',
			'no-labels': 'error',
			'no-lonely-if': 'error',
			'no-multi-assign': 'error',
			'no-nested-ternary': 'error',
			'no-new-func': 'error',
			'no-new-wrappers': 'error',
			'no-param-reassign': 'error',
			'no-promise-executor-return': 'error',
			'no-proto': 'error',
			'no-restricted-globals': [
				'error',
				{ name: 'isNaN', message: 'Number.isNaN を使う' },
				{ name: 'isFinite', message: 'Number.isFinite を使う' }
			],
			'no-return-assign': 'error',
			'no-script-url': 'error',
			'no-self-compare': 'error',
			'no-sequences': 'error',
			'no-template-curly-in-string': 'error',
			'no-unmodified-loop-condition': 'error',
			'no-unneeded-ternary': 'error',
			'no-unreachable-loop': 'error',
			'no-useless-computed-key': 'error',
			'no-useless-concat': 'error',
			'no-useless-rename': 'error',
			'no-useless-return': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'operator-assignment': 'error',
			'prefer-object-has-own': 'error',
			'prefer-object-spread': 'error',
			'prefer-template': 'error',
			radix: 'error',
			'symbol-description': 'error',
			yoda: 'error',
			// 本体の prefer-const は、let { … } = $props() まで const にさせてしまう
			'prefer-const': 'off',
			'svelte/prefer-const': 'error',

			'default-param-last': 'off',
			'@typescript-eslint/default-param-last': 'error',
			'@typescript-eslint/consistent-type-exports': 'error',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/method-signature-style': ['error', 'property'],
			'@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'@typescript-eslint/no-unsafe-type-assertion': 'error',
			'@typescript-eslint/no-useless-empty-export': 'error',
			'@typescript-eslint/prefer-readonly': 'error',
			'@typescript-eslint/require-array-sort-compare': 'error',
			// 人数・金額・時刻を文の中に出すことが多いので、数だけは許す
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowAny: false,
					allowBoolean: false,
					allowNever: false,
					allowNullish: false,
					allowNumber: true,
					allowRegExp: false
				}
			],
			'@typescript-eslint/strict-boolean-expressions': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': [
				'error',
				{ requireDefaultForNonUnion: true }
			],

			// HTML のコメントの eslint-disable は noInlineConfig が効かず、規則を外せてしまう
			'svelte/comment-directive': 'off',
			'svelte/block-lang': ['error', { script: 'ts', style: null }],
			'svelte/button-has-type': 'error',
			'svelte/no-bind-value-on-checkable-inputs': 'error',
			'svelte/no-conflicting-module-names': 'error',
			'svelte/no-ignored-unsubscribe': 'error',
			'svelte/no-inline-styles': 'error',
			'svelte/no-nested-style-tag': 'error',
			'svelte/no-target-blank': 'error',
			'svelte/prefer-class-directive': 'error',
			'svelte/prefer-derived-over-derived-by': 'error',
			'svelte/require-event-prefix': 'error',
			'svelte/require-store-callbacks-use-set-param': 'error',
			'svelte/require-stores-init': 'error',
			'svelte/spaced-html-comment': 'error',
			'svelte/valid-compile': 'error',
			'svelte/valid-style-parse': 'error',

			'no-restricted-imports': [
				'error',
				{
					paths: [
						{ name: '$app/stores', message: `$app/state を使う。${oldSvelteKit}` },
						{ name: '$app/environment', message: `$app/env を使う。${oldSvelteKit}` },
						{ name: '$service-worker', message: `$app/manifest などを使う。${oldSvelteKit}` },
						{
							name: '$app/paths',
							importNames: ['base', 'assets'],
							message: `resolve()・asset() を使う。${oldSvelteKit}`
						},
						{
							name: '$app/navigation',
							importNames: ['invalidateAll'],
							message: `refreshAll() を使う。${oldSvelteKit}`
						},
						{
							name: '$app/server',
							importNames: ['query', 'form', 'command', 'prerender', 'requested'],
							message: 'remote functions は試験的な機能なので使わない（sveltekit.md 1章）'
						},
						{
							name: '@sveltejs/kit',
							importNames: ['json', 'text'],
							message: `Response.json()・new Response() を使う。${oldSvelteKit}`
						}
					],
					patterns: [
						{
							group: ['$env/*'],
							message: `$app/env/private・$app/env/public を使う。${oldSvelteKit}`
						},
						{ group: ['$lib', '$lib/*'], message: `#lib/foo.js を使う。${oldSvelteKit}` },
						{
							group: ['@cloudflare/vitest-pool-workers', '@cloudflare/vitest-pool-workers/*'],
							message: '@cloudflare/vitest-plugin を使う（sveltekit.md 5章）'
						},
						{ group: ['@material/*'], message: '部品集は入れない（design-principles.md 2章）' },
						{
							group: ['drizzle-orm', 'drizzle-orm/*', '@prisma/*', 'kysely'],
							message: 'ORM は使わない（AGENTS.md）'
						}
					]
				}
			],

			'no-restricted-syntax': ['error', ...timeSyntax, ...unsafeHtmlSyntax, ...oldKitSyntax]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		},
		rules: {
			// Service Worker などの .ts では、ブラウザの addEventListener や self をそのまま使う
			'svelte/no-add-event-listener': 'error',
			'svelte/no-top-level-browser-globals': 'error'
		}
	},
	{
		files: ['**/*.svelte'],
		rules: {
			'no-restricted-syntax': [
				'error',
				...timeSyntax,
				...unsafeHtmlSyntax,
				...oldKitSyntax,
				...oldSvelteSyntax
			]
		}
	},
	{
		files: ['src/lib/time.ts'],
		rules: { 'no-restricted-syntax': ['error', ...unsafeHtmlSyntax, ...oldKitSyntax] }
	},
	{
		// expect(obj.fn) や expect.any() は、テストの書き方として正しい
		files: ['**/*.test.ts', '**/*.spec.ts', 'e2e/**/*.ts'],
		rules: {
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/unbound-method': 'off'
		}
	},
	{
		// tsconfig に入れていない設定のファイル
		files: ['**/*.{js,mjs,cjs}'],
		extends: [ts.configs.disableTypeChecked]
	}
);
