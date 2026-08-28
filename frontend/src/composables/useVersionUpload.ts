/**
 * New-version upload flow: file picker → upload to R2 → confirm_upload(version_of).
 *
 * Port of the React "versionOf" path (VersionSheet / InboxPage → UploadDialog).
 * The backend swaps the uploaded file onto the target asset in place, so all
 * links, comments and share URLs survive. Bypasses the upload queue: one file,
 * one asset, awaited by the caller.
 */
import { ref, type Ref } from 'vue'
import { useOverlays } from '@/composables/useOverlays'
import { uploadFile } from '@/composables/useUpload'

const ACCEPT = 'video/*,audio/*,image/*,.mkv,.avi,.m4v'

const uploading: Ref<boolean> = ref(false)
const progress: Ref<number> = ref(0)

/** Open the full queue-backed upload dialog in single-file version mode. */
function openVersionUpload(assetName: string, onDone?: () => void): void {
	const { openUpload } = useOverlays()
	openUpload({ versionOf: assetName, onDone })
}

function pickFile(): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = ACCEPT
		input.style.display = 'none'
		let settled = false
		const finish = (file: File | null) => {
			if (settled) return
			settled = true
			input.remove()
			resolve(file)
		}
		input.addEventListener('change', () => finish(input.files?.[0] ?? null))
		input.addEventListener('cancel', () => finish(null))
		document.body.appendChild(input)
		input.click()
	})
}

/** Prompt for a file and upload it as the next version of `assetName`. Resolves once confirmed. */
async function uploadNewVersion(assetName: string): Promise<void> {
	if (uploading.value) return
	const file = await pickFile()
	if (!file) return

	uploading.value = true
	progress.value = 0
	try {
		await uploadFile(
			file,
			{ versionOf: assetName },
			(p) => {
				progress.value = p
			},
			new AbortController().signal,
		)
	} finally {
		uploading.value = false
	}
}

export function useVersionUpload(): {
	openVersionUpload(assetName: string, onDone?: () => void): void
	uploadNewVersion(assetName: string): Promise<void>
	uploading: Ref<boolean>
	progress: Ref<number>
} {
	return { openVersionUpload, uploadNewVersion, uploading, progress }
}
