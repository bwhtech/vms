import { ref } from 'vue'

/** Multi-select by record name for grids and tables. */
export function useSelection() {
	const selected = ref<Set<string>>(new Set())

	function toggleSelect(name: string) {
		const next = new Set(selected.value)
		if (next.has(name)) next.delete(name)
		else next.add(name)
		selected.value = next
	}

	/** Select every item, or clear them all when every item is already selected. */
	function toggleSelectAll(items: { name: string }[]) {
		const names = items.map((item) => item.name)
		const allSelected = names.every((name) => selected.value.has(name))
		const next = new Set(selected.value)
		for (const name of names) {
			if (allSelected) next.delete(name)
			else next.add(name)
		}
		selected.value = next
	}

	function clearSelection() {
		selected.value = new Set()
	}

	return { selected, toggleSelect, toggleSelectAll, clearSelection }
}
