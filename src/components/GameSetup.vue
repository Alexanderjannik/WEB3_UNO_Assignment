<script setup lang="ts">
import { ref } from 'vue'

//#region Setup state

const playerName = ref('')
const botCount = ref(1)

const emit = defineEmits<{
  start: [players: string[]]
}>()

//#endregion

//#region Start game

function startGame(): void
{
  const name = playerName.value.trim()

  if (name.length === 0 || !Number.isInteger(botCount.value) || botCount.value < 1 || botCount.value > 3)
  {
    return
  }

  const players = [name]

  for (let i = 1; i <= botCount.value; i++)
  {
    players.push(`Bot ${i}`)
  }

  emit('start', players)
}

//#endregion
</script>

<template>
  <section>
    <h2>Set up your game</h2>

    <form class="setup-form" @submit.prevent="startGame">
      <label for="player-name">Your name</label>

      <input
        id="player-name"
        v-model="playerName"
        type="text"
        maxlength="30"
        placeholder="Enter your name"
        autocomplete="nickname"
        required
      />

      <label for="bot-count">Number of bots</label>

      <select id="bot-count" v-model="botCount">
        <option :value="1">1 bot</option>
        <option :value="2">2 bots</option>
        <option :value="3">3 bots</option>
      </select>

      <button
        type="submit"
        :disabled="playerName.trim().length === 0"
      >
        Start round
      </button>
    </form>
  </section>
</template>

<style scoped>
.setup-form
{
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 360px;
}

input,
select,
button
{
  padding: 12px;
  font: inherit;
  border: 1px solid #999;
  border-radius: 6px;
}

button
{
  margin-top: 12px;
  color: white;
  background-color: #222;
  cursor: pointer;
}

button:disabled
{
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
