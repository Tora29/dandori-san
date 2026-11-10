import { memberRecordSchema, tripRecordSchema } from '#lib/trip-records.js';
import * as z from 'zod';

export type Row = Record<string, unknown>;

// D1 の行（snake_case）を、端末に返す記録（camelCase）に直す。直すのはここだけ（code.md 1章）

export const tripRowSchema = z
	.object({
		id: z.unknown(),
		title_sealed: z.unknown(),
		start_date_sealed: z.unknown(),
		end_date_sealed: z.unknown(),
		organizer_id: z.unknown(),
		delete_on: z.unknown(),
		plans_revision: z.unknown(),
		version: z.unknown()
	})
	.transform((row) => ({
		id: row.id,
		titleSealed: row.title_sealed,
		startDateSealed: row.start_date_sealed,
		endDateSealed: row.end_date_sealed,
		organizerId: row.organizer_id,
		deleteOn: row.delete_on,
		plansRevision: row.plans_revision,
		version: row.version
	}))
	.pipe(tripRecordSchema);

export const memberRowSchema = z
	.object({
		id: z.unknown(),
		trip_id: z.unknown(),
		name_sealed: z.unknown(),
		name_index: z.unknown(),
		added_by: z.unknown(),
		version: z.unknown()
	})
	.transform((row) => ({
		id: row.id,
		tripId: row.trip_id,
		nameSealed: row.name_sealed,
		nameIndex: row.name_index,
		addedBy: row.added_by,
		version: row.version
	}))
	.pipe(memberRecordSchema);
