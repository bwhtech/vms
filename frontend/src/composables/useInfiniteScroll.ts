import { onScopeDispose, watch, type Ref } from 'vue'

export function useInfiniteScroll(
	target: Ref<HTMLElement | null>,
	busy: Ref<boolean>,
	canLoad: () => boolean,
	onLoadMore: () => void,
) {
	let observer: IntersectionObserver | undefined
	let intersecting = false

	function maybeLoad() {
		if (intersecting && !busy.value && canLoad()) onLoadMore()
	}

	watch(
		target,
		(el) => {
			observer?.disconnect()
			observer = undefined
			intersecting = false
			if (!el) return
			observer = new IntersectionObserver(
				(entries) => {
					intersecting = entries[entries.length - 1]?.isIntersecting ?? false
					maybeLoad()
				},
				{ rootMargin: '600px 0px' },
			)
			observer.observe(el)
		},
		{ immediate: true },
	)

	watch(busy, (now, before) => {
		if (before && !now) maybeLoad()
	})

	onScopeDispose(() => observer?.disconnect())
}
