import { ref, type Ref } from 'vue'
import type { AnnotationJson, ReviewComment } from '@/types'

/**
 * W0-compatible facade. W5 replaces the empty methods with the review API
 * implementation without changing the contract consumed by `useReview`.
 */
export function useReviewComments(_assetId: string, _token: string | null, _version: Ref<number>) {
	const list = ref<ReviewComment[]>([])
	const loading = ref(false)

	return {
		list,
		loading,
		reload: () => undefined,
		add: async (_params: {
			text: string
			timestamp?: number
			parent?: string
			annotation?: AnnotationJson
			guestName?: string
		}) => undefined,
		edit: async (_name: string, _text: string) => undefined,
		remove: async (_name: string) => undefined,
		resolve: async (_name: string, _resolved: boolean) => undefined,
	}
}
