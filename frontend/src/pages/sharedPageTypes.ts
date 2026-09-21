export interface SharedScope {
	name: string
	project_name?: string
	status?: string
	description?: string
	folder_name?: string
	breadcrumb: Array<{ name: string; folder_name: string }>
	subfolders: Array<{ name: string; folder_name: string }>
}

export interface SharedAsset {
	name: string
	file_name: string
	category: string
	file_size?: number
	file_type?: string
	uploaded_at?: string
	creation: string
	thumbnail_url?: string
}

export interface SharedAssetsResponse {
	assets: SharedAsset[]
	total: number
	page: number
	page_size: number
	total_pages: number
}

export interface ScopeParams {
	project?: string
	folder?: string
	current?: string
	token: string
}

export type SharedAssetParams = ScopeParams & { asset_name: string }
