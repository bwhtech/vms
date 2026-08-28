import { computed, ref, shallowRef } from 'vue'
import {
	Canvas,
	FabricObject,
	Line,
	PencilBrush,
	Polygon,
	Rect,
	Triangle,
	type TPointerEventInfo,
} from 'fabric'
import type { AnnotationJson } from '@/types'

export type DrawingTool = 'select' | 'arrow' | 'freehand' | 'line' | 'rectangle' | 'triangle'

export const ANNOTATION_COLORS = [
	'#ef4444',
	'#f97316',
	'#eab308',
	'#22c55e',
	'#3b82f6',
	'#ffffff',
] as const

const MAX_HISTORY = 50
const STROKE_WIDTH = 3
type JsonObject = Record<string, unknown>
type Shape = Line | Rect | Triangle

const canvas = shallowRef<Canvas | null>(null)
const data = ref<AnnotationJson | null>(null)
const activeTool = ref<DrawingTool>('freehand')
const activeColor = ref<string>(ANNOTATION_COLORS[0])
const history: string[] = []
const redoStack: string[] = []
const loading = ref(false)
const readOnly = ref(false)
const historyRevision = ref(0)
const drawing = {
	active: false,
	startX: 0,
	startY: 0,
	object: null as Shape | null,
}

export function useFabricCanvas() {
	return {
		canvas,
		data,
		activeTool,
		activeColor,
		canUndo: computed(() => historyRevision.value > 0 && history.length > 1),
		canRedo: computed(() => historyRevision.value > 0 && redoStack.length > 0),
		init,
		dispose,
		resize,
		capture,
		load,
		loadForDisplay,
		clear,
		hasContent,
		changeTool,
		changeColor,
		undo,
		redo,
	}
}

function init(element: HTMLCanvasElement, width: number, height: number, locked = false) {
	void dispose()
	readOnly.value = locked
	canvas.value = new Canvas(element, {
		width: safeDimension(width),
		height: safeDimension(height),
		selection: false,
		renderOnAddRemove: true,
	})
	resetHistory()
	applyToolMode()
	return canvas.value
}

async function dispose() {
	const instance = canvas.value
	canvas.value = null
	drawing.active = false
	drawing.object = null
	if (instance && !instance.destroyed) await instance.dispose()
	resetHistory(false)
}

async function resize(width: number, height: number) {
	const instance = canvas.value
	if (!instance) return
	const nextWidth = safeDimension(width)
	const nextHeight = safeDimension(height)
	if (instance.width === nextWidth && instance.height === nextHeight) return
	const normalized = normalizedCanvas(instance)
	instance.setDimensions({ width: nextWidth, height: nextHeight })
	if (normalized) await loadForDisplay(normalized, readOnly.value, false)
}

function capture(): AnnotationJson | null {
	const annotation = canvas.value ? normalizedCanvas(canvas.value) : data.value
	data.value = annotation
	return annotation
}

function load(annotation: AnnotationJson | null) {
	data.value = annotation ? clone(annotation) : null
}

async function loadForDisplay(
	annotation: AnnotationJson,
	locked = false,
	initializeHistory = true,
) {
	const instance = canvas.value
	if (!instance) return
	readOnly.value = locked
	loading.value = true
	try {
		await instance.loadFromJSON(denormalize(annotation, instance.width, instance.height))
		instance.forEachObject((object) => setObjectInteractive(object, !locked))
		instance.requestRenderAll()
		if (initializeHistory) resetHistory(true)
		applyToolMode()
	} finally {
		loading.value = false
	}
}

function clear() {
	data.value = null
	canvas.value?.clear()
	resetHistory()
	applyToolMode()
}

function hasContent() {
	return Boolean(canvas.value?.getObjects().length)
}

function changeTool(tool: DrawingTool) {
	activeTool.value = tool
	applyToolMode()
}

function changeColor(color: string) {
	activeColor.value = color
	if (canvas.value?.freeDrawingBrush) canvas.value.freeDrawingBrush.color = color
	applyToolMode()
}

async function undo() {
	if (!canvas.value || history.length <= 1) return
	const current = history.pop()
	if (current) redoStack.push(current)
	await restoreHistory(history.at(-1))
}

async function redo() {
	const next = redoStack.pop()
	if (!canvas.value || !next) return
	history.push(next)
	await restoreHistory(next)
}

async function restoreHistory(serialized: string | undefined) {
	const instance = canvas.value
	if (!instance || !serialized) return
	loading.value = true
	try {
		await instance.loadFromJSON(serialized)
		instance.requestRenderAll()
		applyToolMode()
	} finally {
		loading.value = false
		bumpHistoryRevision()
	}
}

function applyToolMode() {
	const instance = canvas.value
	if (!instance) return
	instance.off('mouse:down')
	instance.off('mouse:move')
	instance.off('mouse:up')
	instance.off('object:modified')
	instance.isDrawingMode = false

	if (readOnly.value) {
		instance.selection = false
		instance.defaultCursor = 'default'
		instance.forEachObject((object) => setObjectInteractive(object, false))
		return
	}
	if (activeTool.value === 'freehand') {
		instance.selection = false
		instance.isDrawingMode = true
		instance.freeDrawingBrush = new PencilBrush(instance)
		instance.freeDrawingBrush.color = activeColor.value
		instance.freeDrawingBrush.width = STROKE_WIDTH
		instance.on('mouse:up', saveHistory)
		return
	}
	if (activeTool.value === 'select') {
		instance.selection = true
		instance.defaultCursor = 'default'
		instance.forEachObject((object) => setObjectInteractive(object, true))
		instance.on('object:modified', saveHistory)
		return
	}
	instance.selection = false
	instance.defaultCursor = 'crosshair'
	instance.forEachObject((object) => setObjectInteractive(object, false))
	instance.on('mouse:down', beginShape)
	instance.on('mouse:move', updateShape)
	instance.on('mouse:up', finishShape)
}

function beginShape(event: TPointerEventInfo) {
	const instance = canvas.value
	if (!instance) return
	const point = instance.getScenePoint(event.e)
	drawing.active = true
	drawing.startX = point.x
	drawing.startY = point.y
	drawing.object = createShape(activeTool.value, point.x, point.y)
	if (drawing.object) instance.add(drawing.object)
}

function updateShape(event: TPointerEventInfo) {
	const instance = canvas.value
	const shape = drawing.object
	if (!instance || !drawing.active || !shape) return
	const point = instance.getScenePoint(event.e)
	if (shape instanceof Line) {
		shape.set({ x2: point.x, y2: point.y })
	} else {
		const width = point.x - drawing.startX
		const height = point.y - drawing.startY
		shape.set({
			left: width < 0 ? point.x : drawing.startX,
			top: height < 0 ? point.y : drawing.startY,
			width: Math.abs(width),
			height: Math.abs(height),
		})
	}
	instance.requestRenderAll()
}

function finishShape(event: TPointerEventInfo) {
	const instance = canvas.value
	const shape = drawing.object
	if (!instance || !drawing.active || !shape) return
	drawing.active = false
	if (activeTool.value === 'arrow' && shape instanceof Line) addArrowHead(instance, shape, event)
	drawing.object = null
	saveHistory()
}

function createShape(tool: DrawingTool, x: number, y: number): Shape | null {
	const shared = {
		stroke: activeColor.value,
		strokeWidth: STROKE_WIDTH,
		selectable: false,
		evented: false,
	}
	if (tool === 'line' || tool === 'arrow') return new Line([x, y, x, y], shared)
	if (tool === 'rectangle') {
		return new Rect({ ...shared, left: x, top: y, width: 0, height: 0, fill: 'transparent' })
	}
	if (tool === 'triangle') {
		return new Triangle({
			...shared,
			left: x,
			top: y,
			width: 0,
			height: 0,
			fill: 'transparent',
		})
	}
	return null
}

function addArrowHead(instance: Canvas, line: Line, event: TPointerEventInfo) {
	const point = instance.getScenePoint(event.e)
	const startX = line.x1 ?? point.x
	const startY = line.y1 ?? point.y
	const deltaX = point.x - startX
	const deltaY = point.y - startY
	const length = Math.hypot(deltaX, deltaY)
	if (length <= 5) return
	const headLength = Math.min(15, length * 0.3)
	const angle = Math.atan2(deltaY, deltaX)
	instance.add(
		new Polygon(
			[
				{ x: point.x, y: point.y },
				{
					x: point.x - headLength * Math.cos(angle - Math.PI / 6),
					y: point.y - headLength * Math.sin(angle - Math.PI / 6),
				},
				{
					x: point.x - headLength * Math.cos(angle + Math.PI / 6),
					y: point.y - headLength * Math.sin(angle + Math.PI / 6),
				},
			],
			{
				fill: activeColor.value,
				stroke: activeColor.value,
				strokeWidth: 1,
				selectable: false,
				evented: false,
			},
		),
	)
}

function saveHistory() {
	if (!canvas.value || loading.value) return
	const serialized = JSON.stringify(canvas.value.toJSON())
	if (history.at(-1) === serialized) return
	if (history.length >= MAX_HISTORY) history.shift()
	history.push(serialized)
	redoStack.splice(0)
	bumpHistoryRevision()
}

function resetHistory(includeCurrent = true) {
	history.splice(0)
	redoStack.splice(0)
	if (includeCurrent && canvas.value) history.push(JSON.stringify(canvas.value.toJSON()))
	bumpHistoryRevision()
}

function bumpHistoryRevision() {
	historyRevision.value += 1
}

function setObjectInteractive(object: FabricObject, interactive: boolean) {
	object.set({ selectable: interactive, evented: interactive })
}

function normalizedCanvas(instance: Canvas): AnnotationJson | null {
	if (!instance.getObjects().length) return null
	const width = safeDimension(instance.width)
	const height = safeDimension(instance.height)
	const json = clone(instance.toJSON()) as AnnotationJson
	json.objects.forEach((object) => scaleObject(object, 1 / width, 1 / height))
	json._normalized = true
	json._canvasWidth = width
	json._canvasHeight = height
	return json
}

function denormalize(annotation: AnnotationJson, width: number, height: number): AnnotationJson {
	const json = clone(annotation)
	if (json._normalized) json.objects.forEach((object) => scaleObject(object, width, height))
	return json
}

function scaleObject(object: JsonObject, xScale: number, yScale: number) {
	for (const key of ['left', 'width', 'x1', 'x2']) scaleNumber(object, key, xScale)
	for (const key of ['top', 'height', 'y1', 'y2']) scaleNumber(object, key, yScale)
	for (const key of ['radius', 'strokeWidth']) scaleNumber(object, key, Math.min(xScale, yScale))
	if (Array.isArray(object.path)) {
		for (const segment of object.path as unknown[][]) {
			for (let index = 1; index < segment.length; index += 2) {
				if (typeof segment[index] === 'number') segment[index] = segment[index] * xScale
				if (typeof segment[index + 1] === 'number') segment[index + 1] = segment[index + 1] * yScale
			}
		}
	}
	if (Array.isArray(object.points)) {
		for (const point of object.points as { x: number; y: number }[]) {
			point.x *= xScale
			point.y *= yScale
		}
	}
}

function scaleNumber(object: JsonObject, key: string, scale: number) {
	if (typeof object[key] === 'number') object[key] *= scale
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T
}

function safeDimension(value: number | undefined) {
	return Math.max(1, Math.floor(value ?? 1))
}
