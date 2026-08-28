/**
 * Direct-to-R2 upload protocol.
 *
 * Port of frontend-react/src/hooks/useUpload.ts. The wire protocol is kept
 * byte-for-byte: presigned single PUT for files up to the server's multipart
 * threshold (2 GB), S3 multipart (50 MB parts, server-decided) above it.
 * Queueing and reactive state live in useUploadQueue.ts.
 */
import { call } from 'frappe-ui'

import type { UploadContext, UploadItem, UploadStatus } from '@/types'

export type { UploadContext, UploadItem, UploadStatus }

export interface UploadUrlResponse {
	upload_url?: string
	r2_key: string
	asset_name: string
	multipart: boolean
	upload_id?: string
	part_size?: number
}

interface ConfirmUploadResponse {
	status: string
	asset_name: string
	version_of?: string
	version?: number
}

export const MAX_CONCURRENT = 2
export const MAX_PART_RETRIES = 3

export const TERMINAL_STATUSES: readonly UploadStatus[] = ['done', 'error', 'cancelled']

export function isTerminal(status: UploadStatus): boolean {
	return TERMINAL_STATUSES.includes(status)
}

export function isAbortError(e: unknown): boolean {
	return e instanceof DOMException && e.name === 'AbortError'
}

function abortError(): DOMException {
	return new DOMException('Upload cancelled', 'AbortError')
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

/**
 * Upload `file` to R2 under the given context and confirm it with the backend.
 * Resolves with the confirmed asset name (the target asset when `ctx.versionOf`
 * is set). Rejects with an AbortError DOMException when `signal` aborts.
 * On any failure the temporary backend record is cleaned up (fail_upload /
 * abort_multipart) before rejecting.
 */
export async function uploadFile(
	file: File,
	ctx: UploadContext,
	onProgress: (p: number) => void,
	signal: AbortSignal,
): Promise<{ assetName: string }> {
	let assetName: string | undefined
	let isMultipart = false
	let uploadId: string | undefined
	try {
		if (signal.aborted) throw abortError()
		onProgress(0)

		// Step 1: Get presigned URL (or multipart init)
		const data = await call<UploadUrlResponse>('vms.api.get_upload_url', {
			file_name: ctx.fileName ?? file.name,
			content_type: file.type || 'application/octet-stream',
			file_size: file.size,
			project: ctx.project || undefined,
			category: ctx.category || 'Footage',
			folder: ctx.folder || undefined,
		})
		assetName = data.asset_name
		isMultipart = data.multipart
		uploadId = data.upload_id

		// Step 2: Upload to R2
		if (data.multipart && data.upload_id && data.part_size) {
			await uploadMultipart(
				file,
				data.asset_name,
				data.r2_key,
				data.upload_id,
				data.part_size,
				onProgress,
				signal,
			)
		} else if (data.upload_url) {
			await uploadSinglePut(file, data.upload_url, onProgress, signal)
		} else {
			throw new Error('Invalid upload response from server')
		}

		// Step 3: Confirm upload
		onProgress(100)
		const confirmed = await call<ConfirmUploadResponse>('vms.api.confirm_upload', {
			asset_name: data.asset_name,
			file_size: file.size,
			...(ctx.versionOf ? { version_of: ctx.versionOf } : {}),
		})

		return { assetName: confirmed?.asset_name || data.asset_name }
	} catch (e) {
		// Clean up the backend asset record
		if (assetName) {
			if (isMultipart && uploadId) {
				call('vms.api.abort_multipart', { asset_name: assetName, upload_id: uploadId }).catch(
					() => {},
				)
			} else {
				call('vms.api.fail_upload', { asset_name: assetName }).catch(() => {})
			}
		}
		throw e
	}
}

/** Upload a small file in a single PUT request, with retries + exponential backoff. */
export async function uploadSinglePut(
	file: File,
	uploadUrl: string,
	onProgress: (p: number) => void,
	signal: AbortSignal,
): Promise<void> {
	let lastError: Error | undefined
	for (let attempt = 0; attempt < MAX_PART_RETRIES; attempt++) {
		if (signal.aborted) throw abortError()
		try {
			await new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest()
				const onAbort = () => xhr.abort()
				const cleanup = () => signal.removeEventListener('abort', onAbort)
				signal.addEventListener('abort', onAbort)

				xhr.open('PUT', uploadUrl)
				xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
				}
				xhr.onload = () => {
					cleanup()
					if (xhr.status >= 200 && xhr.status < 300) resolve()
					else reject(new Error(`Upload failed with status ${xhr.status}`))
				}
				xhr.onerror = () => {
					cleanup()
					reject(new Error('Network error during upload'))
				}
				xhr.onabort = () => {
					cleanup()
					reject(abortError())
				}
				xhr.send(file)
			})
			return // Success — exit retry loop
		} catch (e) {
			if (isAbortError(e)) throw e
			lastError = e instanceof Error ? e : new Error('Upload failed')
			if (attempt < MAX_PART_RETRIES - 1) {
				onProgress(0)
				await sleep(1000 * 2 ** attempt)
			}
		}
	}
	throw lastError || new Error('Upload failed after retries')
}

/** Upload a large file using S3 multipart upload. */
export async function uploadMultipart(
	file: File,
	assetName: string,
	r2Key: string,
	uploadId: string,
	partSize: number,
	onProgress: (p: number) => void,
	signal: AbortSignal,
): Promise<void> {
	const fileSize = file.size
	const totalParts = Math.ceil(fileSize / partSize)
	const parts: { PartNumber: number; ETag: string }[] = []
	let totalBytesUploaded = 0

	for (let partNum = 1; partNum <= totalParts; partNum++) {
		if (signal.aborted) throw abortError()

		const start = (partNum - 1) * partSize
		const end = Math.min(start + partSize, fileSize)
		const blob = file.slice(start, end)
		const partBytesBeforeThis = totalBytesUploaded

		// Upload part with retries (includes getting presigned URL)
		let etag: string | undefined
		let lastError: Error | undefined
		for (let attempt = 0; attempt < MAX_PART_RETRIES; attempt++) {
			if (signal.aborted) throw abortError()
			try {
				const partRes = await call<{ url: string }>('vms.api.get_part_upload_url', {
					r2_key: r2Key,
					upload_id: uploadId,
					part_number: partNum,
				})
				etag = await uploadPart(
					partRes.url,
					blob,
					(loaded) => onProgress(Math.round(((partBytesBeforeThis + loaded) / fileSize) * 100)),
					signal,
				)
				break
			} catch (e) {
				if (isAbortError(e)) throw e
				lastError = e instanceof Error ? e : new Error('Part upload failed')
				if (attempt < MAX_PART_RETRIES - 1) await sleep(1000 * 2 ** attempt)
			}
		}

		if (!etag) throw lastError || new Error(`Failed to upload part ${partNum}`)

		parts.push({ PartNumber: partNum, ETag: etag })
		totalBytesUploaded = end
	}

	await call('vms.api.complete_multipart', {
		asset_name: assetName,
		upload_id: uploadId,
		parts: JSON.stringify(parts),
	})
}

/** Upload a single chunk via XHR, returning the ETag from the response. */
function uploadPart(
	url: string,
	blob: Blob,
	onProgress: (loaded: number) => void,
	signal: AbortSignal,
): Promise<string> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) {
			reject(abortError())
			return
		}

		const xhr = new XMLHttpRequest()
		const onAbort = () => xhr.abort()
		const cleanup = () => signal.removeEventListener('abort', onAbort)
		signal.addEventListener('abort', onAbort)

		xhr.open('PUT', url)
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(e.loaded)
		}
		xhr.onload = () => {
			cleanup()
			if (xhr.status >= 200 && xhr.status < 300) {
				const rawEtag = xhr.getResponseHeader('ETag')
				if (!rawEtag) {
					reject(new Error('Missing ETag header — re-save R2 credentials in Settings to fix CORS'))
				} else {
					// S3/R2 returns ETags with surrounding quotes — strip them
					resolve(rawEtag.replace(/^"|"$/g, ''))
				}
			} else {
				reject(new Error(`Part upload failed with status ${xhr.status}`))
			}
		}
		xhr.onerror = () => {
			cleanup()
			reject(new Error('Network error during part upload'))
		}
		xhr.onabort = () => {
			cleanup()
			reject(abortError())
		}
		xhr.send(blob)
	})
}
