declare const db: D1Database;
declare const id: string;
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
		db.prepare(`SELECT * FROM plans WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids)
	];
}
