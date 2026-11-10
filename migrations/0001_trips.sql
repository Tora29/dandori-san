-- 〜_sealed の列は、端末がしおりの鍵から作った鍵で AES-GCM にした暗号文（#lib/crypto/trip-crypto.ts）。
-- サーバーは中身を読めず、中身の決まりは端末で確かめる。暗号にする前に決まった長さまで詰め物をするので、暗号文の長さは列ごとに決まっている。
-- ID は端末が乱数で作る。ID の大きさから、作った時期や件数が分からないようにするため（cloudflare.md 2章）。
-- STRICT にして、数の列に文字が入るのを防ぐ
CREATE TABLE trips (
	id INTEGER PRIMARY KEY,
	-- 札の SHA-256。鍵も札も D1 には置かない
	access_hash TEXT NOT NULL UNIQUE CHECK (length(access_hash) = 64),
	title_sealed TEXT NOT NULL CHECK (length(title_sealed) = 298),
	start_date_sealed TEXT NOT NULL CHECK (length(start_date_sealed) = 63),
	end_date_sealed TEXT NOT NULL CHECK (length(end_date_sealed) = 63),
	organizer_id INTEGER,
	-- 消す Worker が読むので暗号にできない。最終日を逆算できないよう、月の末日にぼかす（cloudflare.md 4章）。
	-- date() は形の違う値で NULL を返し、= の比べ方では CHECK を通ってしまうので IS で比べる
	delete_on TEXT NOT NULL CHECK (date(delete_on) IS delete_on),
	-- 時刻にすると、直しが増えた日から旅行の日が分かるので、直すたびに増える番号にする
	plans_revision INTEGER NOT NULL DEFAULT 1 CHECK (plans_revision >= 1),
	version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
	-- 幹事は、同じしおりの人だけを指せる
	FOREIGN KEY (id, organizer_id) REFERENCES members (trip_id, id)
) STRICT;

CREATE TABLE members (
	id INTEGER PRIMARY KEY,
	trip_id INTEGER NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
	-- 名前を入れた順。ID は乱数なので、並び順はしおりの中だけの番号で決める
	seq INTEGER NOT NULL CHECK (seq >= 1),
	name_sealed TEXT NOT NULL CHECK (length(name_sealed) = 170),
	-- 暗号文は毎回変わるので、同じ呼び名を断るのは、しおりごとの鍵で作った HMAC で比べる
	name_index TEXT NOT NULL CHECK (length(name_index) = 64),
	added_by INTEGER,
	version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
	UNIQUE (trip_id, id),
	UNIQUE (trip_id, seq),
	UNIQUE (trip_id, name_index),
	-- 足した人は、同じしおりの人だけを指せる（cloudflare.md 1章）
	FOREIGN KEY (trip_id, added_by) REFERENCES members (trip_id, id)
) STRICT;

-- 消す Worker が、消す日を過ぎたしおりを探すため
CREATE INDEX trips_delete_on ON trips (delete_on);

-- 消したしおりのリンクと、打ちまちがえたリンクを見分けるため（cloudflare.md 4章）
CREATE TABLE deleted_trips (
	access_hash TEXT PRIMARY KEY NOT NULL CHECK (length(access_hash) = 64),
	deleted_on TEXT NOT NULL CHECK (date(deleted_on) IS deleted_on)
) STRICT;

-- 消した日から1年で、この印も消すため
CREATE INDEX deleted_trips_deleted_on ON deleted_trips (deleted_on);
