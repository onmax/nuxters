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
  selectContributor: [username: string]
}>()
const colorMode = useColorMode()

const MIN_SCALE = 0.74
const WORLD_SCALE = 0.9
const MAX_SCALE = 3.2
const ZOOM_STEP = 0.25
const AUTO_ROTATION_SPEED = 0.0014
const MAX_VERTICAL_ROTATION = Math.PI / 2 - 0.06
const MIN_AVATAR_CAPACITY = 64
const MAX_AVATAR_CAPACITY = 160
const container = ref<HTMLElement>()
const containerWidth = ref(640)
const pixelRatio = import.meta.client ? Math.min(window.devicePixelRatio, 2) : 1
const failed = ref(false)
const ready = ref(false)
const zoomPercent = ref(0)
const viewLatitude = ref(Math.round(0.16 * 180 / Math.PI))
const avatarMarkers = new Map<string, HTMLElement>()

interface AvatarPoint {
  id: string
  location: readonly [number, number]
  locationId: string
  offsetX: number
  offsetY: number
  selected: boolean
  username: string
}

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

function angularDistance(first: readonly [number, number], second: readonly [number, number]): number {
  const firstLatitude = first[0] * Math.PI / 180
  const secondLatitude = second[0] * Math.PI / 180
  const longitudeDelta = (first[1] - second[1]) * Math.PI / 180
  const cosine = Math.sin(firstLatitude) * Math.sin(secondLatitude)
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.cos(longitudeDelta)

  return Math.acos(clamp(cosine, -1, 1)) * 180 / Math.PI
}

function hashUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
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

const avatarDetailLevel = computed(() => {
  if (zoomPercent.value >= 80)
    return 3
  if (zoomPercent.value >= 55)
    return 2
  if (zoomPercent.value >= 25)
    return 1
  return 0
})

const avatarCapacity = computed(() => props.compact
  ? 24
  : clamp(Math.floor(containerWidth.value / 5), MIN_AVATAR_CAPACITY, MAX_AVATAR_CAPACITY))

const avatarPoints = computed<AvatarPoint[]>(() => {
  const detail = avatarDetailLevel.value
  const capacity = avatarCapacity.value
  const perLocation = [2, 3, 5, 8][detail] ?? 2
  const spreadRadius = [22, 36, 64, 100][detail] ?? 22
  const minimumLocationSpacing = [4, 3, 2, 0][detail] ?? 0
  const ranked = props.locations.toSorted((a, b) => b.people.length - a.people.length || a.label.localeCompare(b.label))
  const selected = ranked.find(location => location.id === props.selectedId)
  const points: AvatarPoint[] = []
  const occupiedOffsets = new Map<string, Array<readonly [number, number]>>()

  function offsetFor(location: PeopleLocation, username: string, personIndex: number): readonly [number, number] {
    if (personIndex === 0 || spreadRadius === 0)
      return [0, 0]

    const occupied = occupiedOffsets.get(location.id) ?? [[0, 0] as const]
    const minimumDistance = detail >= 3 ? 20 : 18

    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = hashUnit(`${username}:angle:${attempt}`) * Math.PI * 2
      const distance = spreadRadius * Math.sqrt(0.12 + hashUnit(`${username}:radius:${attempt}`) * 0.88)
      const candidate = [Math.cos(angle) * distance, Math.sin(angle) * distance] as const
      if (occupied.every(([x, y]) => Math.hypot(candidate[0] - x, candidate[1] - y) >= minimumDistance)) {
        occupied.push(candidate)
        occupiedOffsets.set(location.id, occupied)
        return candidate
      }
    }

    const angle = hashUnit(`${username}:fallback`) * Math.PI * 2
    return [Math.cos(angle) * spreadRadius, Math.sin(angle) * spreadRadius]
  }

  function add(location: PeopleLocation, personIndex: number): void {
    const username = location.people[personIndex]
    if (!username || points.length >= capacity)
      return

    const [offsetX, offsetY] = offsetFor(location, username, personIndex)
    points.push({
      id: `${location.id}-avatar-${personIndex}`,
      location: location.location,
      locationId: location.id,
      offsetX,
      offsetY,
      selected: location.id === props.selectedId,
      username,
    })
  }

  if (selected) {
    const selectedLimit = detail === 0
      ? 1
      : Math.min(selected.people.length, Math.floor(capacity * 0.45), [1, 12, 32, 72][detail] ?? 1)
    for (let personIndex = 0; personIndex < selectedLimit; personIndex++)
      add(selected, personIndex)
  }

  const candidates = ranked.filter(location => location.id !== selected?.id)
  const baseLocationLimit = Math.min(candidates.length, capacity - points.length, [96, 104, 96, 72][detail] ?? 72)
  const visibleCandidates: PeopleLocation[] = []

  for (const location of candidates) {
    if (visibleCandidates.length >= baseLocationLimit)
      break
    if (visibleCandidates.every(candidate => angularDistance(location.location, candidate.location) >= minimumLocationSpacing))
      visibleCandidates.push(location)
  }

  for (const location of visibleCandidates)
    add(location, 0)

  for (let personIndex = 1; personIndex < perLocation && points.length < capacity; personIndex++) {
    for (const location of visibleCandidates) {
      add(location, personIndex)
      if (points.length >= capacity)
        break
    }
  }

  return points
})

function markers(): Marker[] {
  const avatarLocationIds = new Set(avatarPoints.value.map(point => point.locationId))
  const locationMarkers: Marker[] = props.locations
    .filter(location => !avatarLocationIds.has(location.id))
    .map(location => ({
      location: [location.location[0], location.location[1]],
      size: clamp(0.003 + Math.log2(location.people.length + 1) * 0.0011, 0.003, 0.012),
    }))
  const anchoredAvatars: Marker[] = avatarPoints.value.map(point => ({
    id: point.id,
    location: [point.location[0], point.location[1]],
    size: 0,
  }))

  return [...locationMarkers, ...anchoredAvatars]
}

const globeMarkers = computed(markers)

function avatarMarkerStyle(point: AvatarPoint): Record<string, string> {
  return {
    '--avatar-x': `${point.offsetX}px`,
    '--avatar-y': `${point.offsetY}px`,
    'position-anchor': `--cobe-${point.id}`,
  }
}

function setAvatarMarker(id: string, element: unknown): void {
  if (element instanceof HTMLElement)
    avatarMarkers.set(id, element)
  else
    avatarMarkers.delete(id)
}

function updateAvatarVisibility(): void {
  if (avatarMarkers.size !== avatarPoints.value.length && container.value) {
    for (const marker of container.value.querySelectorAll<HTMLElement>('[data-avatar-id]')) {
      if (marker.dataset.avatarId)
        avatarMarkers.set(marker.dataset.avatarId, marker)
    }
  }

  const cosTheta = Math.cos(theta)
  const cosPhi = Math.cos(phi)
  const sinTheta = Math.sin(theta)
  const sinPhi = Math.sin(phi)
  const radius = 0.812
  const projectedLimit = 0.8 - 28 / (containerWidth.value * scale)
  const minimumDepth = Math.sqrt(Math.max(0, radius * radius - projectedLimit * projectedLimit))

  for (const point of avatarPoints.value) {
    const marker = avatarMarkers.get(point.id)
    if (!marker)
      continue

    const latitude = point.location[0] * Math.PI / 180
    const longitude = point.location[1] * Math.PI / 180 - Math.PI
    const cosLatitude = Math.cos(latitude)
    const x = -cosLatitude * Math.cos(longitude) * radius
    const y = Math.sin(latitude) * radius
    const z = cosLatitude * Math.sin(longitude) * radius
    const depth = -sinPhi * cosTheta * x + sinTheta * y + cosPhi * cosTheta * z
    marker.classList.toggle('is-visible', depth >= minimumDepth)
  }
}

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
  updateAvatarVisibility()
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
  updateAvatarVisibility()
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
    :data-avatar-count="avatarPoints.length"
    :data-avatar-detail="avatarDetailLevel"
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

    <template v-if="!failed">
      <button
        v-for="point in avatarPoints"
        :key="point.id"
        :ref="element => setAvatarMarker(point.id, element)"
        type="button"
        class="people-globe__avatar-marker"
        :class="{ 'is-selected': point.selected }"
        :data-avatar-id="point.id"
        :data-location-id="point.locationId"
        :style="avatarMarkerStyle(point)"
        :aria-label="`Open ${point.username}'s Nuxter profile`"
        @click="emit('selectContributor', point.username)"
      >
        <NuxtImg
          :src="point.username"
          width="32"
          height="32"
          alt=""
          loading="lazy"
        />
      </button>
    </template>

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

.people-globe__avatar-marker {
  position: absolute;
  z-index: 2;
  top: anchor(center);
  left: anchor(center);
  width: clamp(1.25rem, 3.8vw, 1.65rem);
  height: clamp(1.25rem, 3.8vw, 1.65rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-primary) 55%, var(--ui-border));
  border-radius: 50%;
  background: var(--ui-bg);
  box-shadow: 0 1px 5px color-mix(in srgb, var(--ui-text-highlighted) 20%, transparent);
  opacity: 0;
  cursor: pointer;
  pointer-events: auto;
  translate: calc(-50% + var(--avatar-x, 0px)) calc(-50% + var(--avatar-y, 0px));
  transition: opacity 160ms ease, translate 220ms ease;
  visibility: hidden;
  will-change: opacity, translate;
}

.people-globe__avatar-marker:hover,
.people-globe__avatar-marker:focus-visible {
  border-color: var(--ui-primary);
  outline: 2px solid color-mix(in srgb, var(--ui-primary) 55%, transparent);
  outline-offset: 2px;
  scale: 1.12;
}

.people-globe__avatar-marker.is-visible {
  opacity: 0.94;
  visibility: visible;
}

.people-globe__avatar-marker.is-selected {
  z-index: 3;
  border-color: var(--ui-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-primary) 20%, transparent), 0 2px 8px color-mix(in srgb, var(--ui-text-highlighted) 25%, transparent);
  scale: 1.06;
}

.people-globe__avatar-marker img {
  width: 100%;
  height: 100%;
  min-width: 0;
  object-fit: cover;
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
