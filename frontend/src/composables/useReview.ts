import { computed, inject, provide, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useCall } from 'frappe-ui'
import type { AnnotationJson, ReviewAsset } from '@/types'
import { useFabricCanvas } from '@/composables/useFabricCanvas'
import { useReviewComments } from '@/composables/useReviewComments'
import { useSession } from '@/composables/useSession'

export interface ReviewApi {
	asset: ComputedRef<ReviewAsset | null>
	loading: ComputedRef<boolean>
	error: ComputedRef<unknown>
	reload(): void
	isGuest: ComputedRef<boolean>
	token: string | null
	guestName: Ref<string>
	currentTime: Ref<number>
	duration: Ref<number>
	seekTo(time: number): void
	player: Ref<HTMLVideoElement | null>
	comments: ReturnType<typeof useReviewComments>
	annotation: {
		mode: Ref<'off' | 'edit' | 'view'>
		data: Ref<AnnotationJson | null>
		start(): void
		view(json: AnnotationJson, time: number): void
		capture(): AnnotationJson | null
		clear(): void
	}
	panels: {
		versions: Ref<boolean>
		transcription: Ref<boolean>
		youtube: Ref<boolean>
		split: Ref<boolean>
	}
}

const REVIEW_KEY = Symbol('vms-review')

export function provideReview(options: { assetId: string; token: string | null }): ReviewApi {
	const { isGuest } = useSession()
	const version = ref(1)
	const currentTime = ref(0)
	const duration = ref(0)
	const player = ref<HTMLVideoElement | null>(null)
	const guestName = ref(localStorage.getItem('vms_guest_name') ?? '')
	const canvas = useFabricCanvas()
	const mode = ref<'off' | 'edit' | 'view'>('off')

	const request = useCall<ReviewAsset, { asset_name: string; token?: string }>({
		url: '/api/v2/method/vms.review_api.get_review_data',
		method: 'GET',
		params: {
			asset_name: options.assetId,
			...(options.token ? { token: options.token } : {}),
		},
		cacheKey: ['review-data', options.assetId, options.token ?? 'session'],
		onSuccess: (asset) => {
			version.value = asset.version ?? 1
		},
	})

	watch(guestName, (name) => localStorage.setItem('vms_guest_name', name))

	const comments = useReviewComments(options.assetId, options.token, version)
	const api: ReviewApi = {
		asset: computed(() => request.data ?? null),
		loading: computed(() => request.loading),
		error: computed(() => request.error),
		reload: () => {
			void request.reload()
		},
		isGuest,
		token: options.token,
		guestName,
		currentTime,
		duration,
		seekTo: (time) => {
			if (!player.value) return
			player.value.currentTime = Math.max(0, Math.min(time, player.value.duration || 0))
			currentTime.value = player.value.currentTime
		},
		player,
		comments,
		annotation: {
			mode,
			data: canvas.data,
			start: () => {
				mode.value = 'edit'
				canvas.clear()
			},
			view: (json, time) => {
				canvas.load(json)
				mode.value = 'view'
				api.seekTo(time)
			},
			capture: canvas.capture,
			clear: () => {
				canvas.clear()
				mode.value = 'off'
			},
		},
		panels: {
			versions: ref(false),
			transcription: ref(false),
			youtube: ref(false),
			split: ref(false),
		},
	}

	provide(REVIEW_KEY, api)
	return api
}

export function useReview(): ReviewApi {
	const review = inject<ReviewApi>(REVIEW_KEY)
	if (!review) throw new Error('useReview() must be called below provideReview()')
	return review
}
