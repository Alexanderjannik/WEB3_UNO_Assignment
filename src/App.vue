<script setup lang="ts">
import { ref } from 'vue'
import LocalGame from './components/LocalGame.vue'
import OnlineGame from './components/OnlineGame.vue'

//#region Game mode

const mode = ref<'local' | 'online' | undefined>(undefined)

//#endregion
</script>

<template>
  <main class="app">
    <h1>UNO</h1>
    <section v-if="!mode" class="menu">
      <h2>Choose a game</h2>
      <button type="button" @click="mode = 'online'">Play online</button>
      <button type="button" @click="mode = 'local'">Play against bots</button>
    </section>
    <template v-else-if="mode === 'local'">
      <LocalGame />
      <button type="button" class="back" @click="mode = undefined">Main menu</button>
    </template>
    <OnlineGame v-else @back="mode = undefined" />
  </main>
</template>

<style scoped>
.app
{
  max-width: 960px;
  margin: 40px auto;
  padding: 24px;
  font-family: Arial, sans-serif;
}

h1
{
  margin-top: 0;
}

.menu
{
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 360px;
}

button
{
  padding: 12px;
  font: inherit;
  cursor: pointer;
}

.back
{
  margin-top: 24px;
}
</style>
