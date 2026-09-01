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
  <section class="people-section">
    <header class="section-heading">
      <p class="eyebrow">
        Global community
      </p>
      <h1>People like you build Nuxt <span>around the globe.</span></h1>
      <p>Meet the contributors behind Nuxt across 164 countries.</p>
    </header>

    <dl class="stats">
      <div><dt>Nuxters</dt><dd>26,287</dd></div>
      <div><dt>On the map</dt><dd>13,634</dd></div>
      <div><dt>Countries</dt><dd>164</dd></div>
    </dl>

    <button
      type="button"
      class="peek"
      :class="{ expanded }"
      :aria-expanded="expanded"
      @click="toggle"
    >
      <div class="peek-copy">
        <span class="peek-kicker">{{ expanded ? 'Global people map' : 'Explore the community' }}</span>
        <strong>{{ expanded ? 'Nuxters, everywhere.' : 'See where Nuxters build from' }}</strong>
        <span class="peek-hint">{{ expanded ? 'Click to collapse' : 'Click to expand the globe' }} <span aria-hidden="true">↗</span></span>
      </div>

      <div class="globe-wrap">
        <PrototypeGlobe />
      </div>

      <div
        v-if="expanded"
        class="location-list"
        aria-label="Popular locations"
      >
        <div><span>United Kingdom</span><b>221</b></div>
        <div><span>China</span><b>209</b></div>
        <div><span>Japan</span><b>205</b></div>
        <div><span>Canada</span><b>184</b></div>
        <div class="active">
          <span>India</span><b>158</b>
        </div>
      </div>
    </button>
  </section>
</template>

<style scoped>
.people-section {
  color: #fff;
}

.section-heading {
  margin-bottom: 24px;
}

.eyebrow {
  margin-bottom: 8px !important;
  color: #00dc82 !important;
  font-size: 12px !important;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.section-heading h1 {
  margin: 0;
  max-width: 760px;
  font-size: clamp(30px, 5vw, 48px);
  font-weight: 700;
  letter-spacing: -.035em;
  line-height: 1.04;
}

.section-heading h1 span,
.stats dd {
  color: #00dc82;
}

.section-heading p {
  margin: 12px 0 0;
  color: #94a3b8;
  font-size: 15px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin: 0;
  border-block: 1px solid #1e293b;
}

.stats div {
  padding: 18px 0;
}

.stats div + div {
  padding-left: 24px;
  border-left: 1px solid #1e293b;
}

.stats dt {
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.stats dd {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.peek {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  width: 100%;
  min-height: 168px;
  margin-top: 20px;
  overflow: hidden;
  border: 1px solid #1e293b;
  border-radius: 14px;
  background: #0b1324;
  color: inherit;
  text-align: left;
  isolation: isolate;
}

.peek::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(circle at 78% 55%, rgb(0 220 130 / .14), transparent 36%);
  content: '';
}

.peek:focus-visible {
  outline: 2px solid #00dc82;
  outline-offset: 4px;
}

.peek-copy {
  display: flex;
  align-self: center;
  flex-direction: column;
  gap: 7px;
  padding: 28px 30px;
}

.peek-kicker,
.peek-hint {
  color: #94a3b8;
  font-size: 12px;
}

.peek-kicker {
  color: #00dc82;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.peek-copy strong {
  max-width: 370px;
  font-size: clamp(20px, 3vw, 30px);
  letter-spacing: -.02em;
  line-height: 1.08;
}

.globe-wrap {
  align-self: center;
  width: 260px;
  height: 260px;
  margin-right: -18px;
  view-transition-name: peek-globe;
}

.peek.expanded {
  grid-template-columns: minmax(190px, .72fr) minmax(340px, 1.25fr) minmax(150px, .55fr);
  min-height: 500px;
}

.expanded .globe-wrap {
  align-self: center;
  justify-self: center;
  width: min(46vw, 470px);
  height: min(46vw, 470px);
  margin: 0;
}

.location-list {
  align-self: center;
  padding: 20px 24px 20px 0;
  color: #94a3b8;
  font-size: 12px;
}

.location-list div {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 9px 10px;
  border-bottom: 1px solid #1e293b;
}

.location-list b {
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.location-list .active {
  background: #1e293b;
  color: #fff;
}

:global(::view-transition-group(peek-globe)) {
  animation-duration: 280ms;
  animation-timing-function: cubic-bezier(.77, 0, .175, 1);
}

:global(::view-transition-old(peek-globe)),
:global(::view-transition-new(peek-globe)) {
  animation-duration: 280ms;
}

@media (max-width: 720px) {
  .stats div + div { padding-left: 14px; }
  .peek { grid-template-columns: 1fr 132px; }
  .peek-copy { padding: 22px 20px; }
  .globe-wrap { width: 180px; height: 180px; }
  .peek.expanded { grid-template-columns: 1fr; padding-bottom: 22px; }
  .expanded .globe-wrap { grid-row: 1; width: min(86vw, 390px); height: min(86vw, 390px); }
  .location-list { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  :global(::view-transition-group(peek-globe)) { animation-duration: 1ms; }
}
</style>
