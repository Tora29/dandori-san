import { randomId } from './crypto/random-id.js';
import type { SealedColumn } from './crypto/sealed-format.js';
import type { TripCrypto } from './crypto/trip-crypto.js';
import { deleteOnFor } from './time.js';
import { nameMaxLength, titleMaxLength } from './trip-limits.js';
import type { MemberRecord, NewMemberRecord, NewTripRecord, TripRecord } from './trip-records.js';
import {
	areReadableDates,
	isReadableText,
	nameSchema,
	newTripSchema,
	type NewTrip
} from './trip-rules.js';

// 新しく作る行の版。暗号の追加データに入れるので、D1 の版の番号と同じにする
const firstVersion = 1;

// 読めない欄は null にし、しおり全体は止めない。
// リンクを知る人が決まりに合わない中身を書いても、端末の版の違いで読めなくても、ほかの所は見られて直せるように（code.md 5章）
export interface OpenedTrip {
	id: number;
	title: string | null;
	startDate: string | null;
	endDate: string | null;
	organizerId: number | null;
	deleteOn: string;
	plansRevision: number;
	version: number;
}

export interface OpenedMember {
	id: number;
	tripId: number;
	name: string | null;
	// 呼び名の HMAC と合わない。だれかが HMAC だけを書き換え、同じ呼び名を二重に入れたおそれがある
	nameIndexMismatch: boolean;
	addedBy: number | null;
	version: number;
}

export async function sealNewTrip(
	tripCrypto: TripCrypto,
	input: NewTrip,
	today: string
): Promise<NewTripRecord> {
	const trip = newTripSchema(today).parse(input);
	const id = randomId();
	const organizerId = randomId();
	const [titleSealed, startDateSealed, endDateSealed, nameSealed, nameIndex] = await Promise.all([
		tripCrypto.seal('trips.title', id, firstVersion, trip.title),
		tripCrypto.seal('trips.start_date', id, firstVersion, trip.startDate),
		tripCrypto.seal('trips.end_date', id, firstVersion, trip.endDate),
		tripCrypto.seal('members.name', organizerId, firstVersion, trip.organizerName),
		tripCrypto.nameIndex(trip.organizerName)
	]);
	return {
		id,
		titleSealed,
		startDateSealed,
		endDateSealed,
		deleteOn: deleteOnFor(trip.endDate),
		organizer: { id: organizerId, nameSealed, nameIndex, addedBy: null }
	};
}

async function openText(
	tripCrypto: TripCrypto,
	column: SealedColumn,
	rowId: number,
	version: number,
	sealed: string,
	maxLength: number
): Promise<string | null> {
	const value = await tripCrypto.open(column, rowId, version, sealed);
	return value !== null && isReadableText(value, maxLength) ? value : null;
}

export async function openTrip(tripCrypto: TripCrypto, record: TripRecord): Promise<OpenedTrip> {
	const [title, startDate, endDate] = await Promise.all([
		openText(
			tripCrypto,
			'trips.title',
			record.id,
			record.version,
			record.titleSealed,
			titleMaxLength
		),
		tripCrypto.open('trips.start_date', record.id, record.version, record.startDateSealed),
		tripCrypto.open('trips.end_date', record.id, record.version, record.endDateSealed)
	]);
	// はじめと終わりは組で確かめる。片方だけ読めても、日のタブを正しく作れないため
	const dates = startDate !== null && endDate !== null && areReadableDates(startDate, endDate);
	return {
		id: record.id,
		title,
		startDate: dates ? startDate : null,
		endDate: dates ? endDate : null,
		organizerId: record.organizerId,
		deleteOn: record.deleteOn,
		plansRevision: record.plansRevision,
		version: record.version
	};
}

export async function sealNewMember(
	tripCrypto: TripCrypto,
	input: { name: string; addedBy: number | null }
): Promise<NewMemberRecord> {
	const name = nameSchema.parse(input.name);
	const id = randomId();
	const [nameSealed, nameIndex] = await Promise.all([
		tripCrypto.seal('members.name', id, firstVersion, name),
		tripCrypto.nameIndex(name)
	]);
	return { id, nameSealed, nameIndex, addedBy: input.addedBy };
}

export async function openMember(
	tripCrypto: TripCrypto,
	record: MemberRecord
): Promise<OpenedMember> {
	const name = await openText(
		tripCrypto,
		'members.name',
		record.id,
		record.version,
		record.nameSealed,
		nameMaxLength
	);
	return {
		id: record.id,
		tripId: record.tripId,
		name,
		nameIndexMismatch: name !== null && (await tripCrypto.nameIndex(name)) !== record.nameIndex,
		addedBy: record.addedBy,
		version: record.version
	};
}
