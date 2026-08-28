import type { BadgeProps } from 'frappe-ui'
import type { AssetStatus } from '@/types'

export type BadgeTheme = NonNullable<BadgeProps['theme']>

/**
 * How asset attributes render. Every badge colour in the app resolves through
 * this file so a status never picks up a raw Tailwind colour utility at the
 * call site.
 */

const ASSET_STATUS_THEME: Record<AssetStatus, BadgeTheme> = {
	Uploading: 'gray',
	Processing: 'blue',
	Ready: 'green',
	Error: 'red',
}

export function assetStatusTheme(status: AssetStatus | string | null | undefined): BadgeTheme {
	return (status && ASSET_STATUS_THEME[status as AssetStatus]) || 'gray'
}

const CATEGORY_THEME: Record<string, BadgeTheme> = {
	Footage: 'gray',
	'For Review': 'amber',
	Deliverable: 'green',
}

export function categoryTheme(category: string | null | undefined): BadgeTheme {
	return (category && CATEGORY_THEME[category]) || 'gray'
}
