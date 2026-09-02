<script setup lang="ts">
const unlockList = [
  'A merged pull request',
  'A helpful issue — completed, 3+ reactions, or 5+ comments',
  'A helpful comment with 3+ reactions',
]
</script>

<template>
  <section class="overflow-hidden rounded-lg border border-slate-800 bg-linear-to-b from-slate-800/50 to-slate-900/50">
    <div class="flex flex-col items-center bg-[url('/join-gradient-bg-sm.svg')] bg-bottom bg-no-repeat px-4 py-14 text-slate-100 sm:px-6 lg:bg-[url('/join-gradient-bg.svg')] lg:px-20">
      <h2 class="text-center text-3xl font-bold sm:text-4xl">
        Become a <span class="text-green-400">Nuxter</span>
      </h2>
      <p class="mt-3 max-w-3xl text-center text-base text-slate-300 sm:text-lg">
        Connect GitHub to find your Nuxt contributions, unlock your role on Discord, and share your Nuxter profile.
      </p>

      <div class="mt-8 grid w-full max-w-4xl gap-3 text-sm text-slate-300 md:grid-cols-3">
        <div
          v-for="item in unlockList"
          :key="item"
          class="flex items-start gap-2"
        >
          <UIcon
            name="i-heroicons-check-circle-20-solid"
            class="mt-0.5 size-5 shrink-0 text-green-400"
            aria-hidden="true"
          />
          <span>{{ item }}</span>
        </div>
      </div>

      <div class="mt-8 flex w-full justify-center">
        <HomeCard />
      </div>
    </div>
  </section>
</template>
