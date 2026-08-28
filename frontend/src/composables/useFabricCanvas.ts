import { ref } from 'vue'
import type { AnnotationJson } from '@/types'

/** W0 facade; W5 owns the fabric-backed implementation. */
export function useFabricCanvas() {
	const data = ref<AnnotationJson | null>(null)

	return {
		data,
		capture: () => data.value,
		load: (annotation: AnnotationJson | null) => {
			data.value = annotation
		},
		clear: () => {
			data.value = null
		},
	}
}
