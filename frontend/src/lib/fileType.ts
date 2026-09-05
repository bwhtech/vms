export type FileKind = 'video' | 'image' | 'audio' | 'file'

export const RAW_EXTENSIONS = ['arw', 'cr2', 'cr3', 'dng', 'nef', 'orf', 'raf', 'rw2']

export interface FileKindStyle {
	icon: string
	/** Badge-style "subtle" pairing: tinted background + darker ink. */
	tile: string
	/** Ink colour alone, for inline icons. */
	ink: string
}

export const FILE_KIND_STYLE: Record<FileKind, FileKindStyle> = {
	video: {
		icon: 'lucide-film',
		tile: 'bg-surface-violet-2 text-ink-violet-7',
		ink: 'text-ink-violet-7',
	},
	image: {
		icon: 'lucide-image',
		tile: 'bg-surface-blue-2 text-ink-blue-7',
		ink: 'text-ink-blue-7',
	},
	audio: {
		icon: 'lucide-music',
		tile: 'bg-surface-amber-2 text-ink-amber-7',
		ink: 'text-ink-amber-7',
	},
	file: {
		icon: 'lucide-file',
		tile: 'bg-surface-gray-2 text-ink-gray-6',
		ink: 'text-ink-gray-5',
	},
}

export function fileKind(fileType?: string | null): FileKind {
	if (fileType?.startsWith('video/')) return 'video'
	if (fileType?.startsWith('image/')) return 'image'
	if (fileType?.startsWith('audio/')) return 'audio'
	return 'file'
}

export function fileKindStyle(fileType?: string | null): FileKindStyle {
	return FILE_KIND_STYLE[fileKind(fileType)]
}
