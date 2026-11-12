import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// テストのファイルごとの D1 の外で動き、何度も呼ばれることがある。当てていないものだけを当てるので、何度呼んでもよい
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
