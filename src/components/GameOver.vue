<script setup lang="ts">
//#region Props and events

defineProps<{
  winner: string
  score: number
}>()

const emit = defineEmits<{
  restart: []
  setup: []
}>()

//#endregion
</script>

<template>
  <section aria-labelledby="result-title">
    <h2 id="result-title">Round over</h2>
    <p>{{ winner }} won the round!</p>
    <p>Round score: {{ score }}</p>

    <div class="actions">
      <button type="button" @click="emit('restart')">Play again</button>
      <button type="button" @click="emit('setup')">Back to setup</button>
    </div>
  </section>
</template>

<style scoped>
.actions
{
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

button
{
  padding: 12px;
  font: inherit;
  cursor: pointer;
}
</style>
