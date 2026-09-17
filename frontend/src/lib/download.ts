export function triggerDownload(url: string, fileName: string) {
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = fileName
	anchor.rel = 'noopener'
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
}
