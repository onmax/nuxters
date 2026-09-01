<script setup lang="ts">
import type { Marker } from 'cobe'
import { Cobe } from 'cobe-vue'
import { usePeopleMap } from '~/composables/usePeopleMap'
import { peopleMapFallback } from '~/data/people'

defineProps<{
  label?: string
}>()

const container = ref<HTMLElement>()
const size = ref(400)
const phi = ref(0)
const dragging = ref(false)
const dragStartX = ref(0)
const dragStartPhi = ref(0)
const { data: peopleMap } = usePeopleMap({ lazy: true, server: false })
const locations = computed(() => peopleMap.value?.locations ?? peopleMapFallback.locations)
const markers = computed<Marker[]>(() => locations.value.map(location => ({
  location: [location.location[0], location.location[1]],
  size: Math.min(0.045, 0.012 + Math.log2(location.people.length + 1) * 0.004),
})))

let animationFrame = 0
let resizeObserver: ResizeObserver | undefined

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  dragStartX.value = event.clientX
  dragStartPhi.value = phi.value
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value)
    phi.value = dragStartPhi.value + (event.clientX - dragStartX.value) * 0.008
}

function onPointerUp(event: PointerEvent) {
  dragging.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}

onMounted(() => {
  const resize = () => {
    if (container.value)
      size.value = Math.max(1, Math.round(Math.min(container.value.clientWidth, container.value.clientHeight)))
  }
  resizeObserver = new ResizeObserver(resize)
  if (container.value)
    resizeObserver.observe(container.value)
  resize()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    return

  let previous = performance.now()
  const rotate = (now: number) => {
    if (!dragging.value)
      phi.value += (now - previous) * 0.00014
    previous = now
    animationFrame = requestAnimationFrame(rotate)
  }
  animationFrame = requestAnimationFrame(rotate)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <figure
    ref="container"
    class="prototype-globe"
  >
    <Cobe
      :width="size"
      :height="size"
      :phi="phi"
      :theta="0.2"
      :markers="markers"
      :base-color="[0.22, 0.5, 0.52]"
      :marker-color="[0, 0.86, 0.51]"
      :glow-color="[0.015, 0.055, 0.075]"
      :dark="0.82"
      :diffuse="0.95"
      :map-brightness="3.6"
      :map-base-brightness="0.06"
      :scale="0.94"
      :aria-label="label || 'Preview of Nuxters around the world'"
      class="prototype-globe__canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    />
  </figure>
</template>

<style scoped>
.prototype-globe {
  width: 100%;
  height: 100%;
  margin: 0;
  filter: drop-shadow(0 24px 48px rgb(0 0 0 / 0.35));
}

.prototype-globe__canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}

.prototype-globe__canvas:active {
  cursor: grabbing;
}
</style>
