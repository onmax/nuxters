<script setup lang="ts">
import PrototypeGlobe from './PrototypeGlobe.vue'

const expanded = ref(false)

async function toggle() {
  const update = async () => {
    expanded.value = !expanded.value
    await nextTick()
  }
  const startViewTransition = document.startViewTransition?.bind(document)

  if (!startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await update()
    return
  }

  try {
    const transition = startViewTransition(update)
    transition.ready.catch(() => {})
    transition.updateCallbackDone.catch(() => {})
    transition.finished.catch(() => {})
  }
  catch {
    await update()
  }
}
</script>

<template>
  <section
    class="portal-section"
    :class="{ expanded }"
  >
    <div class="portal-heading">
      <div>
        <p>People map</p>
        <h1>Nuxt is built everywhere.</h1>
      </div>
      <button
        type="button"
        :aria-expanded="expanded"
        @click="toggle"
      >
        {{ expanded ? 'Close map' : 'Open map' }}
        <UIcon
          :name="expanded ? 'i-ph-minus' : 'i-ph-arrows-out-simple'"
          aria-hidden="true"
        />
      </button>
    </div>

    <button
      type="button"
      class="map-viewport"
      :aria-label="expanded ? 'Collapse global people map' : 'Expand global people map'"
      :aria-expanded="expanded"
      @click="toggle"
    >
      <div class="map-copy">
        <span>13,634 contributors mapped</span>
        <strong>{{ expanded ? 'Drag the real globe to explore' : 'A small world, built together.' }}</strong>
      </div>

      <div class="portal-globe">
        <PrototypeGlobe />
      </div>

      <div class="map-meta">
        <span>164 countries</span>
        <span>Live community data</span>
      </div>
    </button>

    <div
      v-if="expanded"
      class="map-footer"
    >
      <p>Each point is grouped to protect contributor privacy.</p>
      <div>
        <span><i class="green" /> Europe</span>
        <span><i class="blue" /> Asia Pacific</span>
        <span><i class="amber" /> Americas</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.portal-section {
  padding: 30px 0 52px;
  border-top: 1px solid #1e293b;
  color: #fff;
}

.portal-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 24px;
  margin-bottom: 20px;
}

.portal-heading p {
  margin: 0 0 7px;
  color: #00dc82;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.portal-heading h1 {
  margin: 0;
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 700;
  letter-spacing: -.035em;
}

.portal-heading button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border: 1px solid #334155;
  border-radius: 999px;
  background: transparent;
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 600;
  transition: border-color 150ms ease, color 150ms ease, transform 140ms cubic-bezier(.23, 1, .32, 1);
}

.portal-heading button:hover {
  border-color: #64748b;
  color: #fff;
}

.portal-heading button:active {
  transform: scale(.97);
}

.portal-heading button:focus-visible,
.map-viewport:focus-visible {
  outline: 2px solid #00dc82;
  outline-offset: 3px;
}

.map-viewport {
  position: relative;
  display: grid;
  grid-template-columns: minmax(210px, .7fr) minmax(300px, 1.3fr);
  width: 100%;
  min-height: 220px;
  overflow: hidden;
  border: 1px solid #1e293b;
  border-radius: 10px;
  background:
    linear-gradient(90deg, rgb(2 6 23 / .98), rgb(7 25 32 / .78)),
    repeating-linear-gradient(0deg, transparent 0 31px, rgb(148 163 184 / .04) 32px),
    repeating-linear-gradient(90deg, transparent 0 31px, rgb(148 163 184 / .04) 32px);
  color: inherit;
  text-align: left;
}

.map-copy {
  z-index: 2;
  display: flex;
  align-self: center;
  flex-direction: column;
  gap: 8px;
  padding: 34px;
}

.map-copy span,
.map-meta,
.map-footer {
  color: #64748b;
  font-size: 12px;
}

.map-copy strong {
  max-width: 330px;
  font-size: clamp(22px, 3vw, 34px);
  letter-spacing: -.03em;
  line-height: 1.06;
}

.portal-globe {
  position: absolute;
  top: 50%;
  right: 4%;
  width: 370px;
  height: 370px;
  transform: translateY(-50%);
  view-transition-name: portal-globe;
}

.map-meta {
  position: absolute;
  right: 18px;
  bottom: 14px;
  display: flex;
  gap: 18px;
}

.expanded .map-viewport {
  min-height: 610px;
}

.expanded .portal-globe {
  right: 10%;
  width: min(56vw, 590px);
  height: min(56vw, 590px);
}

.expanded .map-copy {
  align-self: start;
  padding-top: 46px;
}

.map-footer {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 15px 4px 0;
}

.map-footer p {
  margin: 0;
}

.map-footer div {
  display: flex;
  gap: 18px;
}

.map-footer span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-footer i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.green { background: #00dc82; }
.blue { background: #38bdf8; }
.amber { background: #f59e0b; }

:global(::view-transition-group(portal-globe)) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(.77, 0, .175, 1);
}

@media (max-width: 720px) {
  .portal-heading { align-items: center; }
  .portal-heading button { flex: none; }
  .map-viewport { grid-template-columns: 1fr; min-height: 360px; }
  .map-copy { align-self: start; padding: 24px; }
  .portal-globe,
  .expanded .portal-globe { top: auto; right: 50%; bottom: -92px; width: 340px; height: 340px; transform: translateX(50%); }
  .expanded .map-viewport { min-height: 560px; }
  .expanded .portal-globe { bottom: -25px; width: min(94vw, 480px); height: min(94vw, 480px); }
  .map-meta { right: auto; left: 18px; }
  .map-footer { flex-direction: column; }
  .map-footer div { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .portal-heading button { transition: border-color 150ms ease, color 150ms ease; }
  :global(::view-transition-group(portal-globe)) { animation-duration: 1ms; }
}
</style>
