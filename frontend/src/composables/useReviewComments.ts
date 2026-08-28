import { computed, ref, watch, type Ref } from 'vue'
import { useCall } from 'frappe-ui'
import type { AnnotationJson, ReviewComment } from '@/types'

type CommentSort = 'timestamp' | 'recent'
type VersionFilter = number | 'all'

interface CommentMutationResponse {
	status: string
}

interface AnnotationResponse {
	annotation_data: string | null
	has_annotation: number
	video_timestamp: number | null
}

export function useReviewComments(assetId: string, token: string | null, version: Ref<number>) {
	const sortBy = ref<CommentSort>('recent')
	const versionFilter = ref<VersionFilter>(version.value)

	const request = useCall<
		ReviewComment[],
		{
			asset_name: string
			sort_by: CommentSort
			token?: string
			version?: number
		}
	>({
		url: '/api/v2/method/vms.review_api.get_comments',
		method: 'GET',
		params: () => ({
			asset_name: assetId,
			sort_by: sortBy.value,
			...(token ? { token } : {}),
			...(versionFilter.value === 'all' ? {} : { version: versionFilter.value }),
		}),
		cacheKey: ['review-comments', assetId, token ?? 'session'],
	})

	const addRequest = useCall<
		ReviewComment,
		{
			asset_name: string
			comment_text: string
			video_timestamp?: number
			parent_comment?: string
			annotation_data?: string
			token?: string
			guest_name?: string
		}
	>({
		url: '/api/v2/method/vms.review_api.add_comment',
		method: 'POST',
		immediate: false,
	})
	const editRequest = useCall<CommentMutationResponse, { comment_name: string; comment_text: string }>({
		url: '/api/v2/method/vms.review_api.edit_comment',
		method: 'POST',
		immediate: false,
	})
	const deleteRequest = useCall<CommentMutationResponse, { comment_name: string }>({
		url: '/api/v2/method/vms.review_api.delete_comment',
		method: 'POST',
		immediate: false,
	})
	const resolveRequest = useCall<
		CommentMutationResponse,
		{ comment_name: string; is_resolved: number }
	>({
		url: '/api/v2/method/vms.review_api.resolve_comment',
		method: 'POST',
		immediate: false,
	})
	const annotationRequest = useCall<
		AnnotationResponse,
		{ comment_name: string; token?: string }
	>({
		url: '/api/v2/method/vms.review_api.get_annotation_data',
		method: 'GET',
		immediate: false,
	})
	const updateAnnotationRequest = useCall<
		CommentMutationResponse,
		{ comment_name: string; annotation_data: string }
	>({
		url: '/api/v2/method/vms.review_api.update_annotation',
		method: 'POST',
		immediate: false,
	})

	watch([sortBy, versionFilter], () => void request.reload())
	watch(version, (next, previous) => {
		if (versionFilter.value === previous) versionFilter.value = next
	})

	async function reload() {
		await request.reload()
	}

	async function add(params: {
		text: string
		timestamp?: number
		parent?: string
		annotation?: AnnotationJson
		guestName?: string
	}) {
		await addRequest.submit({
			asset_name: assetId,
			comment_text: params.text,
			...(params.timestamp == null ? {} : { video_timestamp: params.timestamp }),
			...(params.parent ? { parent_comment: params.parent } : {}),
			...(params.annotation ? { annotation_data: JSON.stringify(params.annotation) } : {}),
			...(token ? { token } : {}),
			...(params.guestName ? { guest_name: params.guestName } : {}),
		})
		await reload()
	}

	async function edit(name: string, text: string) {
		await editRequest.submit({ comment_name: name, comment_text: text })
		await reload()
	}

	async function remove(name: string) {
		await deleteRequest.submit({ comment_name: name })
		await reload()
	}

	async function resolve(name: string, resolved: boolean) {
		await resolveRequest.submit({ comment_name: name, is_resolved: resolved ? 1 : 0 })
		await reload()
	}

	async function getAnnotation(name: string): Promise<AnnotationResponse | null> {
		return annotationRequest.submit({
			comment_name: name,
			...(token ? { token } : {}),
		})
	}

	async function updateAnnotation(name: string, annotation: AnnotationJson) {
		await updateAnnotationRequest.submit({
			comment_name: name,
			annotation_data: JSON.stringify(annotation),
		})
		await reload()
	}

	return {
		list: computed(() => request.data ?? []),
		loading: computed(() => request.loading),
		reload,
		add,
		edit,
		remove,
		resolve,
		sortBy,
		versionFilter,
		adding: computed(() => addRequest.loading),
		updatingAnnotation: computed(() => updateAnnotationRequest.loading),
		getAnnotation,
		updateAnnotation,
	}
}
