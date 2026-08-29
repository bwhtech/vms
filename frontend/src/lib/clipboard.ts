/**
 * Copy text to the clipboard.
 *
 * `navigator.clipboard` needs the document focused, which an upload that
 * finished while the user was in another tab cannot promise. The hidden
 * textarea is the fallback that still works there.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		return copyWithTextarea(text)
	}
}

function copyWithTextarea(text: string): boolean {
	const textarea = document.createElement('textarea')
	textarea.value = text
	textarea.setAttribute('readonly', '')
	textarea.className = 'fixed left-0 top-0 opacity-0'
	document.body.appendChild(textarea)
	textarea.select()
	try {
		return document.execCommand('copy')
	} catch {
		return false
	} finally {
		textarea.remove()
	}
}
