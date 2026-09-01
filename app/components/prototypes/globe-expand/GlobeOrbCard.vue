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
    class="orb-section"
    :class="{ expanded }"
  >
    <div class="intro">
      <p class="eyebrow">
        Nuxt is global
      </p>
      <h1>26,287 people.<br><span>One community.</span></h1>
      <p>Open the globe to meet contributors building Nuxt around the world.</p>
    </div>

    <button
      type="button"
      class="orb-card"
      :aria-expanded="expanded"
      @click="toggle"
    >
      <div class="orb-globe">
        <PrototypeGlobe />
      </div>
      <div class="orb-label">
        <span>{{ expanded ? '164 countries' : 'Explore the globe' }}</span>
        <UIcon
          :name="expanded ? 'i-ph-minus' : 'i-ph-arrow-up-right'"
          aria-hidden="true"
        />
      </div>
    </button>

    <div
      v-if="expanded"
      class="expanded-copy"
    >
      <p>From Amsterdam to Tokyo, every marker represents someone who helped Nuxt move forward.</p>
      <dl>
        <div><dt>On the map</dt><dd>13,634</dd></div>
        <div><dt>Countries</dt><dd>164</dd></div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.orb-section {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  align-items: center;
  min-height: 520px;
  overflow: hidden;
  border-block: 1px solid #1e293b;
  color: #fff;
}

.intro {
  position: relative;
  z-index: 2;
  max-width: 540px;
  padding: 64px 0;
}

.eyebrow {
  margin: 0 0 14px;
  color: #00dc82;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.intro h1 {
  margin: 0;
  font-size: clamp(44px, 7vw, 74px);
  font-weight: 700;
  letter-spacing: -.055em;
  line-height: .94;
}

.intro h1 span {
  color: #00dc82;
}

.intro > p:last-child {
  max-width: 440px;
  margin: 20px 0 0;
  color: #94a3b8;
  font-size: 16px;
  line-height: 1.6;
}

.orb-card {
  position: relative;
  z-index: 3;
  width: 280px;
  border: 0;
  background: transparent;
  color: #fff;
}

.orb-card:focus-visible {
  outline: 2px solid #00dc82;
  outline-offset: 6px;
  border-radius: 999px;
}

.orb-card:active .orb-globe {
  transform: scale(.98);
}

.orb-globe {
  width: 280px;
  height: 280px;
  transition: transform 140ms cubic-bezier(.23, 1, .32, 1);
  view-transition-name: orb-globe;
}

.orb-label {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 600;
}

.expanded {
  grid-template-columns: minmax(0, 1fr) minmax(420px, .95fr);
  min-height: 690px;
}

.expanded .intro {
  align-self: start;
}

.expanded .orb-card {
  grid-column: 2;
  grid-row: 1 / span 2;
  width: min(48vw, 570px);
}

.expanded .orb-globe {
  width: min(48vw, 570px);
  height: min(48vw, 570px);
}

.expanded-copy {
  align-self: start;
  max-width: 480px;
  margin-top: -110px;
  padding-bottom: 64px;
  color: #94a3b8;
  line-height: 1.6;
}

.expanded-copy dl {
  display: flex;
  gap: 44px;
  margin: 28px 0 0;
}

.expanded-copy dt {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.expanded-copy dd {
  margin: 3px 0 0;
  color: #00dc82;
  font-size: 25px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

:global(::view-transition-group(orb-globe)) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(.77, 0, .175, 1);
}

@media (max-width: 720px) {
  .orb-section,
  .expanded { grid-template-columns: 1fr; min-height: auto; padding: 42px 0 54px; }
  .intro { padding: 0; }
  .intro h1 { font-size: clamp(42px, 13vw, 62px); }
  .orb-card,
  .expanded .orb-card { grid-column: 1; grid-row: auto; justify-self: center; width: min(88vw, 470px); margin-top: 30px; }
  .orb-globe,
  .expanded .orb-globe { width: min(88vw, 470px); height: min(88vw, 470px); }
  .expanded-copy { margin: 28px 0 0; padding: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .orb-globe { transition: none; }
  :global(::view-transition-group(orb-globe)) { animation-duration: 1ms; }
}
</style>
