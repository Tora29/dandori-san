import { deleteAfterMonths } from './trip-limits.js';

const tokyo = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Asia/Tokyo',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function now(): number {
	return Date.now();
}

function tokyoParts(at: number): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> {
	const parts = { year: '', month: '', day: '', hour: '', minute: '' };
	for (const { type, value } of tokyo.formatToParts(at)) {
		if (
			type === 'year' ||
			type === 'month' ||
			type === 'day' ||
			type === 'hour' ||
			type === 'minute'
		) {
			parts[type] = value;
		}
	}
	return parts;
}

export function tokyoDate(at: number): string {
	const { year, month, day } = tokyoParts(at);
	return `${year}-${month}-${day}`;
}

export function tokyoTime(at: number): string {
	const { hour, minute } = tokyoParts(at);
	return `${hour}:${minute}`;
}

function parseDate(date: string): { year: number; month: number; day: number } | null {
	const match = datePattern.exec(date);
	if (match === null) {
		return null;
	}
	const [, year, month, day] = match.map(Number);
	if (year === undefined || month === undefined || day === undefined) {
		return null;
	}
	return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year: number, month: number, day: number): string {
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidDate(date: string): boolean {
	const parsed = parseDate(date);
	if (parsed === null) {
		return false;
	}
	const { year, month, day } = parsed;
	// Date.UTC は 0〜99 年を 1900 年代として扱うので、使う年だけに絞る
	return (
		year >= 2000 &&
		year <= 2999 &&
		month >= 1 &&
		month <= 12 &&
		day >= 1 &&
		day <= daysInMonth(year, month)
	);
}

function requireDate(date: string): { year: number; month: number; day: number } {
	const parsed = isValidDate(date) ? parseDate(date) : null;
	if (parsed === null) {
		// 日にちは暗号にする中身なので、エラーの文に値を入れない
		throw new RangeError('日にちの形が違います');
	}
	return parsed;
}

// その月に同じ日が無いときは、その月の末日にする（cloudflare.md 4章）
export function addMonths(date: string, months: number): string {
	const { year, month, day } = requireDate(date);
	const index = year * 12 + (month - 1) + months;
	const nextYear = Math.floor(index / 12);
	const nextMonth = (index % 12) + 1;
	return formatDate(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth)));
}

export function endOfMonth(date: string): string {
	const { year, month } = requireDate(date);
	return formatDate(year, month, daysInMonth(year, month));
}

// 最終日の3か月後の月の末日。D1 にそのまま置くので、最終日を逆算できないよう月までにぼかす（cloudflare.md 4章）
export function deleteOnFor(endDate: string): string {
	return endOfMonth(addMonths(endDate, deleteAfterMonths));
}

export function daysBetween(from: string, to: string): number {
	const a = requireDate(from);
	const b = requireDate(to);
	const dayMs = 24 * 60 * 60 * 1000;
	return (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / dayMs;
}
