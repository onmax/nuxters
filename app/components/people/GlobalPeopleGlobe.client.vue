<script setup lang="ts">
import type { COBEOptions, Marker } from 'cobe'
import type { PeopleLocation } from '~/data/people'
import { Cobe } from 'cobe-vue'

const props = defineProps<{
  compact?: boolean
  locations: readonly PeopleLocation[]
  selectedId?: string
}>()

const emit = defineEmits<{
  collapse: []
  reset: []
}>()
const colorMode = useColorMode()

const MIN_SCALE = 0.74
const WORLD_SCALE = 0.9
const MAX_SCALE = 3.2
const ZOOM_STEP = 0.25
const AUTO_ROTATION_SPEED = 0.0014
const MAX_VERTICAL_ROTATION = Math.PI / 2 - 0.06
const container = ref<HTMLElement>()
const containerWidth = ref(640)
const pixelRatio = import.meta.client ? Math.min(window.devicePixelRatio, 2) : 1
const failed = ref(false)
const ready = ref(false)
const zoomPercent = ref(0)
const viewLatitude = ref(Math.round(0.16 * 180 / Math.PI))

let animationFrame = 0
let lastFrameTime = 0
let resizeObserver: ResizeObserver | undefined
let reducedMotion: MediaQueryList | undefined
let phi = 0
let theta = 0.16
let scale = WORLD_SCALE
const renderPhi = ref(phi)
const renderTheta = ref(theta)
const renderScale = ref(scale)
let targetPhi = phi
let targetTheta = theta
let targetScale = scale
let pointerId: number | undefined
let pointerStartX = 0
let pointerStartY = 0
let pointerStartPhi = 0
let pointerStartTheta = 0
let pinchStartDistance = 0
let pinchStartScale = scale
const activePointers = new Map<number, { x: number, y: number }>()

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function shortestAngle(from: number, to: number): number {
  const fullTurn = Math.PI * 2
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

function pointerDistance(): number | undefined {
  const [first, second] = [...activePointers.values()]
  if (!first || !second)
    return undefined

  return Math.hypot(second.x - first.x, second.y - first.y)
}

function locationAngles([latitude, longitude]: readonly [number, number]): readonly [number, number] {
  return [Math.PI - (longitude * Math.PI / 180 - Math.PI / 2), latitude * Math.PI / 180]
}

function globeTheme(): Pick<COBEOptions, 'baseColor' | 'dark' | 'diffuse' | 'glowColor' | 'mapBaseBrightness' | 'mapBrightness' | 'markerColor'> {
  return colorMode.value === 'dark'
    ? {
        baseColor: [0.28, 0.5, 0.58],
        dark: 0.78,
        diffuse: 0.95,
        glowColor: [0.025, 0.065, 0.085],
        mapBaseBrightness: 0.06,
        mapBrightness: 3.6,
        markerColor: [0, 0.86, 0.51],
      }
    : {
        baseColor: [0.97, 0.99, 1],
        dark: 0.25,
        diffuse: 0.85,
        glowColor: [1, 1, 1],
        mapBaseBrightness: 0.03,
        mapBrightness: 1.45,
        markerColor: [0, 0.72, 0.43],
      }
}

const theme = computed(globeTheme)
const globeMarkers = computed<Marker[]>(() => props.locations.map(location => ({
  location: [location.location[0], location.location[1]],
  size: clamp(0.003 + Math.log2(location.people.length + 1) * 0.0011, 0.003, 0.012),
})))

function updateZoomPercent(): void {
  zoomPercent.value = Math.round((targetScale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE) * 100)
}

function setZoom(next: number): void {
  targetScale = clamp(next, MIN_SCALE, MAX_SCALE)
  updateZoomPercent()
}

function setVerticalRotation(next: number): void {
  targetTheta = clamp(next, -MAX_VERTICAL_ROTATION, MAX_VERTICAL_ROTATION)
  viewLatitude.value = Math.round(targetTheta * 180 / Math.PI)
}

function zoomIn(): void {
  setZoom(targetScale + ZOOM_STEP)
}

function zoomOut(): void {
  setZoom(targetScale - ZOOM_STEP)
}

function resetView(): void {
  targetPhi = 0
  setVerticalRotation(0.16)
  setZoom(WORLD_SCALE)
  emit('reset')
}

function focusSelected(): void {
  const location = props.locations.find(candidate => candidate.id === props.selectedId)
  if (!location)
    return

  const [nextPhi, nextTheta] = locationAngles(location.location)
  targetPhi = nextPhi
  setVerticalRotation(nextTheta)
  setZoom(MAX_SCALE)
}

function onPointerDown(event: PointerEvent): void {
  const canvas = event.currentTarget as HTMLCanvasElement
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  canvas.setPointerCapture(event.pointerId)

  if (activePointers.size === 1) {
    pointerId = event.pointerId
    pointerStartX = event.clientX
    pointerStartY = event.clientY
    pointerStartPhi = targetPhi
    pointerStartTheta = targetTheta
    return
  }

  if (activePointers.size === 2) {
    pinchStartDistance = pointerDistance() ?? 0
    pinchStartScale = targetScale
    pointerId = undefined
  }
}

function onPointerMove(event: PointerEvent): void {
  if (!activePointers.has(event.pointerId))
    return

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (activePointers.size >= 2) {
    const distance = pointerDistance()
    if (distance !== undefined && pinchStartDistance > 0)
      setZoom(pinchStartScale * distance / pinchStartDistance)
    return
  }

  if (pointerId !== event.pointerId)
    return

  targetPhi = pointerStartPhi + (event.clientX - pointerStartX) / 150
  setVerticalRotation(
    pointerStartTheta + (event.clientY - pointerStartY) / 260,
  )
}

function onPointerEnd(event: PointerEvent): void {
  activePointers.delete(event.pointerId)
  const canvas = event.currentTarget as HTMLCanvasElement
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId)

  const remainingPointer = activePointers.entries().next().value as [number, { x: number, y: number }] | undefined
  if (!remainingPointer) {
    pointerId = undefined
    return
  }

  pointerId = remainingPointer[0]
  pointerStartX = remainingPointer[1].x
  pointerStartY = remainingPointer[1].y
  pointerStartPhi = targetPhi
  pointerStartTheta = targetTheta
}

function onWheel(event: WheelEvent): void {
  const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 120 : 1)
  setZoom(targetScale * Math.exp(-delta * 0.0026))
}

function resize(): void {
  if (!container.value)
    return

  containerWidth.value = Math.max(280, Math.round(container.value.getBoundingClientRect().width))
}

function animate(timestamp = performance.now()): void {
  const elapsed = lastFrameTime ? Math.min(timestamp - lastFrameTime, 250) : 16.67
  lastFrameTime = timestamp

  if (activePointers.size === 0 && !props.selectedId && !reducedMotion?.matches)
    targetPhi += AUTO_ROTATION_SPEED * elapsed / 16.67

  const directManipulation = activePointers.size > 0
  const rotationProgress = directManipulation ? 1 : 1 - Math.exp(-elapsed / 180)
  const scaleProgress = directManipulation ? 1 : 1 - Math.exp(-elapsed / 120)
  phi += shortestAngle(phi, targetPhi) * rotationProgress
  theta += (targetTheta - theta) * rotationProgress
  scale += (targetScale - scale) * scaleProgress

  if (container.value)
    container.value.dataset.renderedLatitude = String(Math.round(theta * 180 / Math.PI))

  renderPhi.value = phi
  renderTheta.value = theta
  renderScale.value = scale
  animationFrame = requestAnimationFrame(animate)
}

watch(() => props.selectedId, () => {
  if (props.selectedId)
    focusSelected()
})

onMounted(async () => {
  await nextTick()
  if (!container.value)
    return

  resize()
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateZoomPercent()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container.value)
  ready.value = true
  lastFrameTime = performance.now()
  animationFrame = requestAnimationFrame(animate)
  focusSelected()
})

onErrorCaptured(() => {
  failed.value = true
  return false
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div
    ref="container"
    class="people-globe"
    :class="{ 'people-globe--compact': compact }"
    :data-latitude="viewLatitude"
    :data-ready="ready || undefined"
    :data-zoom="zoomPercent"
  >
    <Cobe
      v-if="!failed"
      :width="containerWidth"
      :height="containerWidth"
      :device-pixel-ratio="pixelRatio"
      :phi="renderPhi"
      :theta="renderTheta"
      :scale="renderScale"
      :markers="globeMarkers"
      :base-color="theme.baseColor"
      :dark="theme.dark"
      :diffuse="theme.diffuse"
      :glow-color="theme.glowColor"
      :map-base-brightness="theme.mapBaseBrightness"
      :map-brightness="theme.mapBrightness"
      :marker-color="theme.markerColor"
      :map-samples="18_000"
      :marker-elevation="0.012"
      :opacity="1"
      class="people-globe__canvas"
      aria-hidden="true"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @wheel.prevent="onWheel"
    />

    <div
      v-else
      class="people-globe__fallback"
      role="status"
    >
      <UIcon
        name="i-lucide-globe-2"
        aria-hidden="true"
      />
      <p>The interactive globe is unavailable on this device.</p>
    </div>

    <div
      v-if="!compact"
      class="people-globe__curtain"
      aria-hidden="true"
    />

    <div
      v-if="!compact"
      class="people-globe__controls"
      role="group"
      aria-label="Globe controls"
    >
      <UButton
        type="button"
        aria-label="Collapse map"
        title="Collapse map"
        icon="i-lucide-minimize-2"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="rounded-none"
        @click="emit('collapse')"
      />
      <UButton
        type="button"
        aria-label="Zoom out"
        icon="i-lucide-minus"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="rounded-none"
        :disabled="zoomPercent === 0"
        @click="zoomOut"
      />
      <UButton
        type="button"
        aria-label="Reset world view"
        icon="i-lucide-house"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="rounded-none"
        @click="resetView"
      />
      <UButton
        type="button"
        aria-label="Zoom in"
        icon="i-lucide-plus"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        class="rounded-none"
        :disabled="zoomPercent === 100"
        @click="zoomIn"
      />
    </div>

    <p
      class="sr-only"
      aria-live="polite"
    >
      Globe zoom is {{ zoomPercent }} percent.
    </p>
  </div>
</template>

<style scoped>
.people-globe {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  isolation: isolate;
  opacity: 0.45;
  transition: opacity 500ms ease;
}

.people-globe[data-ready] {
  opacity: 1;
}

.people-globe--compact {
  width: min(100%, 30rem);
}

.people-globe__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.people-globe__canvas:active {
  cursor: grabbing;
}

.people-globe__fallback {
  position: absolute;
  inset: 12%;
  display: grid;
  place-content: center;
  gap: 0.75rem;
  border: 1px solid var(--ui-border);
  border-radius: 50%;
  color: var(--ui-text-muted);
  text-align: center;
}

.people-globe__fallback :deep(svg) {
  width: 2rem;
  height: 2rem;
  margin-inline: auto;
}

.people-globe__controls {
  position: absolute;
  z-index: 3;
  top: 14%;
  right: 7%;
  display: grid;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  background: color-mix(in srgb, var(--ui-bg) 90%, transparent);
  backdrop-filter: blur(0.75rem);
}

.people-globe__curtain {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: radial-gradient(ellipse 52% 115% at 100% 50%, var(--people-panel-bg, var(--ui-bg-elevated)) 0 18%, color-mix(in srgb, var(--people-panel-bg, var(--ui-bg-elevated)) 70%, transparent) 42%, transparent 72%);
  pointer-events: none;
}

.people-globe__controls :deep(button) {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  color: var(--ui-text-muted);
  transition: background 140ms ease, color 140ms ease;
}

.people-globe__controls :deep(button + button) {
  border-top: 1px solid var(--ui-border);
}

.people-globe__controls :deep(button:hover:not(:disabled)),
.people-globe__controls :deep(button:focus-visible) {
  background: var(--ui-bg-elevated);
  color: var(--ui-text-highlighted);
}

.people-globe__controls :deep(button:focus-visible) {
  outline: 2px solid var(--ui-primary);
  outline-offset: -2px;
}

.people-globe__controls :deep(button:disabled) {
  cursor: not-allowed;
  opacity: 0.35;
}

@media (max-width: 640px) {
  .people-globe__controls {
    top: 12%;
    right: 4%;
  }
}

@media (max-width: 900px) {
  .people-globe__curtain {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .people-globe {
    transition: none;
  }
}
</style>
