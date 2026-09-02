<script setup lang="ts">
const unlockList = [
  'A merged pull request',
  'A helpful issue — completed, 3+ reactions, or 5+ comments',
  'A helpful comment with 3+ reactions',
]
</script>

<template>
  <section class="overflow-hidden rounded-lg border border-slate-800 bg-linear-to-b from-slate-800/50 to-slate-900/50">
    <div class="flex flex-col items-start bg-[url('/join-gradient-bg-sm.svg')] bg-bottom bg-no-repeat px-5 py-12 text-slate-100 sm:items-center sm:px-8 sm:py-14 lg:bg-[url('/join-gradient-bg.svg')] lg:px-20">
      <h2 class="text-left text-3xl font-bold sm:text-center sm:text-4xl">
        Become a <span class="text-green-400">Nuxter</span>
      </h2>
      <p class="mt-3 max-w-3xl text-left text-base text-slate-300 sm:text-center sm:text-lg">
        Connect GitHub to find your Nuxt contributions, unlock your role on Discord, and share your Nuxter profile.
      </p>

      <div class="mt-8 grid w-full max-w-2xl gap-3 text-sm text-slate-300 sm:text-base">
        <div
          v-for="item in unlockList"
          :key="item"
          class="grid grid-cols-[1.25rem_1fr] items-start gap-3 leading-6"
        >
          <UIcon
            name="i-lucide-circle-check-big"
            class="mt-0.5 size-5 text-green-400"
            aria-hidden="true"
          />
          <span>{{ item }}</span>
        </div>
      </div>

      <div class="mt-8 flex w-full justify-start sm:justify-center">
        <HomeCard />
      </div>
    </div>
  </section>
</template>
