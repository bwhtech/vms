import type { ComputedRef } from 'vue'
import { useCall } from 'frappe-ui'

export function useRecursiveDownload<TAsset, TParams extends { token: string }>(options: {
	url: ComputedRef<string>
	baseParams: () => TParams
	pageSize: number
}) {
	const call = useCall<
		{ assets: TAsset[]; total: number },
		TParams & { recursive: boolean; page: number; page_size: number }
	>({
		url: options.url,
		method: 'GET',
		immediate: false,
	})

	async function fetchAll(): Promise<TAsset[]> {
		const collected: TAsset[] = []
		let page = 1
		for (;;) {
			const data = await call.submit({
				...options.baseParams(),
				recursive: true,
				page,
				page_size: options.pageSize,
			})
			if (!data) break
			collected.push(...data.assets)
			if (data.assets.length < options.pageSize || collected.length >= data.total) break
			page += 1
		}
		return collected
	}

	return { fetchAll }
}
