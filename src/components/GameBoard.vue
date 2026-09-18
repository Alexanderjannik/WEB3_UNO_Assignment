<script setup lang="ts">
import { ref, watch } from 'vue'
import { colors, type Color } from '../model/deck'
import type { RoundMemento } from '../model/round'
import UnoCard from './UnoCard.vue'

//#region Props and events

const props = defineProps<{
  state: RoundMemento
  playableCards: number[]
}>()

const emit = defineEmits<{
  play: [index: number, color?: Color]
  draw: []
  pass: []
  uno: []
  catchUno: [player: number]
}>()

//#endregion

//#region Card selection

const selectedCard = ref<number | undefined>(undefined)

watch(() => props.state, () =>
{
  selectedCard.value = undefined
})

function selectCard(index: number): void
{
  if (!props.playableCards.includes(index)) return

  const card = props.state.hands[0][index]

  if ('color' in card)
  {
    emit('play', index)
  }
  else
  {
    selectedCard.value = index
  }
}

function chooseColor(color: Color): void
{
  if (selectedCard.value === undefined) return

  emit('play', selectedCard.value, color)
  selectedCard.value = undefined
}

//#endregion
</script>

<template>
  <section class="game-board">
    <h2>Round in progress</h2>

    <div class="opponents">
      <article
        v-for="(name, index) in state.players.slice(1)"
        :key="index"
        class="opponent"
        :class="{ active: state.playerInTurn === index + 1 }"
      >
        <h3>{{ name }}</h3>

        <p>{{ state.hands[index + 1].length }} cards</p>

        <span v-if="state.playerInTurn === index + 1">
          In turn
        </span>

        <button
          v-if="state.hands[index + 1].length === 1"
          type="button"
          @click="emit('catchUno', index + 1)"
        >
          Catch missed UNO
        </button>
      </article>
    </div>

    <div class="round-status" aria-live="polite">
      <p v-if="state.playerInTurn !== undefined">
        <strong>
          {{ state.players[state.playerInTurn] }}'s turn
        </strong>
      </p>

      <p>Current color: {{ state.currentColor }}</p>

      <p>
        Direction:
        {{ state.currentDirection === 'clockwise'
          ? 'Clockwise'
          : 'Counterclockwise' }}
      </p>
    </div>

    <div class="piles">
      <div class="pile">
        <h3>Draw pile</h3>

        <div class="draw-pile">
          <strong>UNO</strong>
          <span>{{ state.drawPile.length }} cards</span>
        </div>
      </div>

      <div class="pile">
        <h3>Discard pile</h3>

        <UnoCard
          v-if="state.discardPile[0]"
          :card="state.discardPile[0]"
        />
      </div>
    </div>

    <section>
      <h3>
        {{ state.players[0] }} — your hand
        ({{ state.hands[0].length }} cards)
      </h3>

      <div class="hand">
        <button
          v-for="(card, index) in state.hands[0]"
          :key="index"
          type="button"
          class="hand-card"
          :disabled="!playableCards.includes(index) || selectedCard !== undefined"
          @click="selectCard(index)"
        >
          <UnoCard :card="card" />
        </button>
      </div>
    </section>

    <section v-if="selectedCard !== undefined" class="color-choice" aria-label="Choose a wild card color">
      <h3>Choose a color</h3>
      <button v-for="color in colors" :key="color" type="button" @click="chooseColor(color)">
        {{ color }}
      </button>
      <button type="button" @click="selectedCard = undefined">Cancel</button>
    </section>

    <p v-if="state.playerInTurn === 0 && state.drawnCardIndex !== undefined">
      Play the card you just drew, or pass.
    </p>

    <div class="actions">
      <button
        type="button"
        :disabled="state.playerInTurn !== 0 || state.drawnCardIndex !== undefined || selectedCard !== undefined"
        @click="emit('draw')"
      >
        Draw card
      </button>
      <button
        type="button"
        :disabled="state.playerInTurn !== 0 || state.drawnCardIndex === undefined || selectedCard !== undefined"
        @click="emit('pass')"
      >
        Pass
      </button>
      <button
        type="button"
        :disabled="!(state.playerInTurn === 0 && state.hands[0].length === 2) && state.unoVulnerablePlayer !== 0"
        @click="emit('uno')"
      >
        UNO!
      </button>
    </div>
  </section>
</template>

<style scoped>
.game-board
{
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.opponents
{
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.opponent
{
  min-width: 120px;
  padding: 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
}

.opponent.active
{
  border-color: #1d4ed8;
  background-color: #eff6ff;
}

.opponent h3
{
  margin-top: 0;
}

.round-status p
{
  margin: 6px 0;
}

.piles
{
  display: flex;
  flex-wrap: wrap;
  gap: 40px;
}

.pile h3
{
  margin-top: 0;
}

.draw-pile
{
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100px;
  height: 150px;
  color: white;
  background-color: #222;
  border: 3px solid white;
  border-radius: 12px;
  box-shadow: 0 2px 6px #0003;
}

.hand
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

button:disabled
{
  cursor: not-allowed;
  opacity: 0.55;
}

.hand-card
{
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
}

.hand-card:focus-visible
{
  outline: 3px solid #222;
  outline-offset: 3px;
}

.actions,
.color-choice
{
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.color-choice h3
{
  width: 100%;
}
</style>
