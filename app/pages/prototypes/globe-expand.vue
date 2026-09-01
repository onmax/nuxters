<script setup lang="ts">
import GlobeMapPortal from '~/components/prototypes/globe-expand/GlobeMapPortal.vue'
import GlobeOrbCard from '~/components/prototypes/globe-expand/GlobeOrbCard.vue'
import GlobePeekStrip from '~/components/prototypes/globe-expand/GlobePeekStrip.vue'

definePageMeta({ colorMode: 'dark' })

useSeoMeta({ title: 'Globe expansion prototypes · Nuxters' })

const variants = [
  { name: 'Peek strip', component: GlobePeekStrip },
  { name: 'Orb card', component: GlobeOrbCard },
  { name: 'Map portal', component: GlobeMapPortal },
] as const

const route = useRoute()
const requestedVariant = Number(route.query.v)
const selected = ref(requestedVariant >= 1 && requestedVariant <= variants.length ? requestedVariant - 1 : 0)
const renderKey = ref(0)
const picker = ref<HTMLElement>()
const pickerItems = ref<HTMLElement[]>([])
const pickerReady = ref(false)
const highlightStyle = reactive({ width: '0px', transform: 'translateX(0px)' })
const currentVariant = computed(() => variants[selected.value]!)

function setPickerItem(element: unknown, index: number) {
  if (element instanceof HTMLElement)
    pickerItems.value[index] = element
}

function moveHighlight() {
  const item = pickerItems.value[selected.value]
  if (!item)
    return

  highlightStyle.width = `${item.offsetWidth}px`
  highlightStyle.transform = `translateX(${item.offsetLeft}px)`
}

function setActive(index: number) {
  if (index < 0 || index >= variants.length)
    return

  selected.value = index
  renderKey.value++
  const url = new URL(location.href)
  url.searchParams.set('v', String(index + 1))
  history.replaceState(null, '', url)
  nextTick(moveHighlight)
}

function replay() {
  renderKey.value++
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
    return
  if (event.metaKey || event.ctrlKey || event.altKey)
    return

  const number = Number.parseInt(event.key, 10)
  if (number >= 1 && number <= variants.length)
    setActive(number - 1)
  else if (event.key === 'ArrowRight')
    setActive((selected.value + 1) % variants.length)
  else if (event.key === 'ArrowLeft')
    setActive((selected.value - 1 + variants.length) % variants.length)
  else if (event.key === 'r' || event.key === 'R')
    replay()
}

onMounted(() => {
  addEventListener('keydown', onKeydown)
  addEventListener('resize', moveHighlight)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    moveHighlight()
    pickerReady.value = true
  }))
})

onBeforeUnmount(() => {
  removeEventListener('keydown', onKeydown)
  removeEventListener('resize', moveHighlight)
})
</script>

<template>
  <div class="prototype-route">
    <main class="prototype-page">
      <div class="prototype-context">
        <span>Interaction study</span>
        <p>Click the globe surface to expand and collapse it. Drag the globe to rotate.</p>
      </div>

      <component
        :is="currentVariant.component"
        :key="renderKey"
      />
    </main>

    <Teleport to="body">
      <nav
        ref="picker"
        class="proto-picker"
        aria-label="Prototype variants"
        :data-ready="pickerReady ? '' : undefined"
      >
        <span
          class="proto-picker-highlight"
          aria-hidden="true"
          :style="highlightStyle"
        />
        <button
          v-for="(variant, index) in variants"
          :key="variant.name"
          :ref="element => setPickerItem(element, index)"
          class="proto-picker-item"
          :data-active="selected === index ? '' : undefined"
          :aria-current="selected === index ? 'true' : undefined"
          @click="setActive(index)"
        >
          {{ variant.name }}
        </button>
        <span
          class="proto-picker-divider"
          aria-hidden="true"
        />
        <button
          class="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          @click="replay"
        >
          ↻
        </button>
      </nav>
    </Teleport>
  </div>
</template>

<style scoped>
.prototype-page {
  min-height: calc(100vh - 80px);
  padding: 42px 0 120px;
}

.prototype-context {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 42px;
  padding-bottom: 14px;
  border-bottom: 1px solid #1e293b;
  color: #64748b;
  font-size: 12px;
}

.prototype-context span {
  color: #00dc82;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.prototype-context p {
  margin: 0;
}

.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}

.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}

.proto-picker-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
  transition: color 150ms ease-out;
}

.proto-picker-item:hover {
  color: rgba(255, 255, 255, 0.85);
}

.proto-picker-item:active {
  transform: scale(0.97);
}

.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.proto-picker-item[data-active] {
  color: #fff;
}

.proto-picker-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}

.proto-picker-replay {
  padding: 0 10px;
  font-size: 14px;
}

.proto-picker[data-position="top"] {
  bottom: auto;
  top: 24px;
}

@media (max-width: 640px) {
  .prototype-page { padding-top: 24px; }
  .prototype-context { flex-direction: column; gap: 6px; margin-bottom: 28px; }
  .proto-picker-item { padding-inline: 9px; font-size: 12px; }
}
</style>
