declare const db: D1Database;
declare const env: { DB: D1Database };
declare const session: D1DatabaseSession;
declare const maybeDb: D1Database | undefined;
declare const id: string;
declare const name: string;
declare const ids: string[];

const fixed = 'SELECT * FROM trips WHERE id = ?';

export function cases(): unknown[] {
	return [
		// ruleid: d1-sql-built-from-values
		db.prepare(`SELECT * FROM trips WHERE id = '${id}'`),
		// ruleid: d1-sql-built-from-values
		db.prepare('SELECT * FROM trips WHERE id = ' + id),
		// ruleid: d1-sql-built-from-values
		db.exec(`DELETE FROM trips WHERE id = '${id}'`),
		// ruleid: d1-sql-built-from-values
		env.DB.prepare(`SELECT * FROM trips WHERE id = ${id}`),
		// ? を並べる形と一緒に、値をつないだもの
		// ruleid: d1-sql-built-from-values
		db.prepare(
			`SELECT * FROM m WHERE id IN (${ids.map(() => '?').join(',')}) AND name = '${name}'`
		),
		// 並べる区切りに値を入れたもの
		// ruleid: d1-sql-built-from-values
		db.prepare(`SELECT * FROM m WHERE id IN (${ids.map(() => '?').join(`,${name}`)})`),
		// ruleid: d1-sql-built-from-values
		env.DB.withSession().prepare(`SELECT * FROM trips WHERE id = '${id}'`),
		// ruleid: d1-sql-built-from-values
		session.prepare(`SELECT * FROM trips WHERE id = '${id}'`),
		// ruleid: d1-sql-built-from-values
		maybeDb?.prepare(`SELECT * FROM trips WHERE id = '${id}'`),
		// ruleid: d1-sql-built-from-values
		env['DB'].prepare(`SELECT * FROM trips WHERE id = '${id}'`),
		// ok: d1-sql-built-from-values
		db.prepare('SELECT * FROM trips WHERE id = ?').bind(id),
		// ok: d1-sql-built-from-values
		db
			.prepare(
				`
			SELECT *
			FROM trips
			WHERE id = ?
		`
			)
			.bind(id),
		// ok: d1-sql-built-from-values
		db.prepare(fixed).bind(id),
		// ok: d1-sql-built-from-values
		db.prepare(`SELECT * FROM plans WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids),
		// ok: d1-sql-built-from-values
		session.prepare('SELECT 1').bind(),
		// ok: d1-sql-built-from-values
		/^\d+$/.exec(id)
	];
}
