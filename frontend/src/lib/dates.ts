import { dayjs } from 'frappe-ui'

/** Frappe stores dates as `YYYY-MM-DD` and datetimes as `YYYY-MM-DD HH:mm:ss`. */
export const DATE_FORMAT = 'YYYY-MM-DD'

export function today(): string {
	return dayjs().format(DATE_FORMAT)
}

export function formatDate(value: string | null | undefined, format = 'D MMM YYYY'): string {
	if (!value) return ''
	return dayjs(value).format(format)
}

export function formatDateTime(value: string | null | undefined): string {
	return formatDate(value, 'D MMM YYYY, h:mm A')
}

/** `3 minutes ago`, `in 2 days`. */
export function fromNow(value: string | null | undefined): string {
	if (!value) return ''
	return dayjs(value).fromNow()
}

export function isToday(value: string | null | undefined): boolean {
	if (!value) return false
	return dayjs(value).isSame(dayjs(), 'day')
}

/** A due date is overdue once its day is strictly before today. */
export function isOverdue(dueDate: string | null | undefined): boolean {
	if (!dueDate) return false
	return dayjs(dueDate).isBefore(dayjs().startOf('day'))
}

export function dayLabel(date: string): string {
	const d = dayjs(date)
	if (d.isSame(dayjs(), 'day')) return 'Today'
	if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Yesterday'
	if (d.isSame(dayjs(), 'year')) return d.format('D MMMM')
	return d.format('D MMMM YYYY')
}

/**
 * Group records into day buckets, newest day first, preserving the input order
 * inside each bucket. Used by the inbox, trash and the notifications panel.
 */
export function groupByDay<T>(
	items: T[],
	getDate: (item: T) => string,
): { date: string; label: string; items: T[] }[] {
	const buckets = new Map<string, T[]>()
	for (const item of items) {
		const key = dayjs(getDate(item)).format(DATE_FORMAT)
		const bucket = buckets.get(key)
		if (bucket) bucket.push(item)
		else buckets.set(key, [item])
	}
	return [...buckets.entries()]
		.sort((a, b) => (a[0] < b[0] ? 1 : -1))
		.map(([date, group]) => ({ date, label: dayLabel(date), items: group }))
}

export { dayjs }
