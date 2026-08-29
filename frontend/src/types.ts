/**
 * DocType and API shapes as the frontend consumes them. Field names mirror the
 * Frappe DocType JSONs and the dicts returned by `vms/api.py`,
 * `vms/review_api.py`, `vms/transcription.py` and `vms/tools_api.py`.
 */

export type Bool = 0 | 1

export const ASSET_STATUSES = ['Uploading', 'Processing', 'Ready', 'Error'] as const
export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_CATEGORIES = ['Footage', 'For Review', 'Deliverable'] as const
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const PROJECT_STATUSES = [
	'Open',
	'In Progress',
	'In Review',
	'Completed',
	'Archived',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export interface Project {
	name: string
	project_name: string
	description?: string
	status: ProjectStatus
	owner_user: string
	due_date?: string
	thumbnail_url?: string
	share_token?: string | null
	/** Identity — see `lib/project.ts`. All optional; a bare row shows a folder. */
	icon?: string | null
	color?: string | null
	avatar?: string | null
	avatar_style?: string | null
	avatar_seed?: string | null
	avatar_options?: string | null
	creation: string
	modified: string
}

export interface Folder {
	name: string
	folder_name: string
	project: string
	parent_folder?: string | null
	deleted_at?: string | null
	deleted_by?: string | null
	deleter_name?: string
	project_name?: string
	creation: string
	modified: string
}

export interface Asset {
	name: string
	project?: string
	folder?: string
	file_name: string
	r2_key: string
	file_size?: number
	file_type?: string
	status: AssetStatus
	category: AssetCategory
	uploaded_by: string
	uploader_name?: string
	uploader_image?: string | null
	uploaded_at?: string
	duration_seconds?: number
	thumbnail_url?: string
	version?: number
	is_public_review?: Bool
	review_token?: string | null
	tags?: string[]
	card_color?: string | null
	deleted_at?: string | null
	deleted_by?: string | null
	deleter_name?: string
	project_name?: string
	creation: string
	modified: string
}

/** `review_api.get_review_data` — the asset as the review page sees it. */
export interface ReviewAsset {
	name: string
	file_name: string
	file_type?: string
	file_size?: number
	status: AssetStatus
	category: AssetCategory
	duration_seconds?: number
	uploaded_by: string
	uploaded_at?: string
	project?: { name: string; project_name: string } | null
	folder?: { name: string; folder_name: string } | null
	is_public_review?: Bool
	/** Only present for authenticated users. */
	review_token?: string | null
	transcription_status?: string
	proxy_status?: string
	split_from?: { name: string; file_name: string } | null
	split_parts?: { name: string; file_name: string }[] | null
	youtube_upload_status?: string
	youtube_video_id?: string
	youtube_video_url?: string
	youtube_channel?: string
	youtube_channel_name?: string
	youtube_title?: string
	youtube_description?: string
	youtube_privacy?: string
	version?: number
}

export interface ReviewComment {
	name: string
	asset: string
	parent_comment?: string | null
	/** HTML from the comment editor; mentions are `<span class="mention" data-id>`. */
	comment_text: string
	video_timestamp?: number | null
	commented_by?: string
	guest_name?: string | null
	commenter_name: string
	commenter_image?: string | null
	is_resolved: Bool
	has_annotation: Bool
	is_edited: Bool
	annotation_data?: string | null
	version?: number
	creation: string
	modified: string
}

/**
 * Serialized fabric canvas stored in `VMS Review Comment.annotation_data`.
 * Coordinates are normalized to 0-1 against `_canvasWidth` / `_canvasHeight`
 * so an annotation replays at any player size.
 */
export interface AnnotationJson {
	_normalized: boolean
	_canvasWidth: number
	_canvasHeight: number
	objects: Record<string, unknown>[]
	version: string
}

/** One row of `get_asset_versions`. */
export interface AssetVersion {
	version_number: number
	file_name: string
	file_size: number
	file_type: string
	uploaded_by: string
	uploaded_at: string
	thumbnail_url?: string
	uploader_name: string
	uploader_image?: string
	is_current?: boolean
}

export interface AssetVersionsResponse {
	current: AssetVersion
	versions: AssetVersion[]
	total_versions: number
}

export type TranscriptionStatus = '' | 'Processing' | 'Complete' | 'Error'

/** `transcription.get_transcription`. */
export interface Transcription {
	transcription_status: TranscriptionStatus
	/** Markdown with `**[MM:SS]**` timestamps. */
	transcription: string
	/** Raw speaker label → display name. */
	speaker_names: Record<string, string>
}

export type CompressJobStatus = 'Queued' | 'Uploading' | 'Processing' | 'Complete' | 'Error'

export interface CompressJob {
	name: string
	original_file_name: string
	original_size: number
	compressed_size: number
	status: CompressJobStatus
	progress: number
	creation: string
}

export interface CompressStatus {
	job_name: string
	status: CompressJobStatus | string
	progress: number
	original_file_name: string
	original_size: number
	compressed_size: number
	compressed_file_name: string
	error_message: string
	download_url?: string
}

export type AuditAction = 'Download' | 'Delete' | 'Permanent Delete' | 'Rename' | 'Restore'

export interface AuditLog {
	name: string
	action: AuditAction
	asset_name: string
	user: string
	timestamp: string
	file_name?: string
	file_type?: string
	project?: string
	project_name?: string
	file_size?: number
	user_full_name: string
	user_image?: string | null
}

/** A `Notification Log` row. */
export interface Notification {
	name: string
	subject: string
	email_content: string | null
	type: string
	read: Bool
	from_user: string
	document_type: string | null
	document_name: string | null
	creation: string
	link: string | null
}

export interface SessionUser {
	name: string
	full_name: string
	user_image?: string | null
}

export interface UploadUrlResponse {
	upload_url: string
	r2_key: string
	asset_name: string
}

export interface ViewUrlResponse {
	url: string
}

export interface ConfirmUploadResponse {
	status: string
	asset_name: string
}

export type SettingsTab =
	| 'profile'
	| 'appearance'
	| 'general'
	| 'transcription'
	| 'youtube'
	| 'users'

/** What the upload dialog needs from whoever opened it. */
export interface UploadContext {
	project?: string
	folder?: string
	/** Upload as a new version of this asset instead of a new asset. */
	versionOf?: string
	/** The opener's own refresh — the dialog does not know what to reload.
	 *  Receives the assets that uploaded, in queue order. */
	onDone?: (assetNames: string[]) => void
	/** Asset category sent to get_upload_url. Defaults to "Footage". */
	category?: string
	/** Overrides file.name as the stored file name. */
	fileName?: string
	/** Files the dialog queues as soon as it opens (paste). */
	files?: File[]
	/** Every settled batch, failures included — a silent paste reports itself. */
	onSettled?: (result: UploadResult) => void
}

/** What became of one batch of uploads. */
export interface UploadResult {
	uploaded: string[]
	failed: { fileName: string; error?: string }[]
}

export type UploadStatus = 'queued' | 'uploading' | 'confirming' | 'done' | 'error' | 'cancelled'

export interface UploadItem {
	id: string
	file: File
	status: UploadStatus
	/** 0-100 */
	progress: number
	assetName?: string
	error?: string
}
