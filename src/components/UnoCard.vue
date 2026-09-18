<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../model/deck'

//#region Props

const props = defineProps<{
  card: Card
}>()

//#endregion

//#region Card display

const color = computed(() =>
{
  return 'color' in props.card ? props.card.color : 'WILD'
})

const symbol = computed(() =>
{
  if (props.card.type === 'NUMBERED')
  {
    return String(props.card.number)
  }

  const symbols = {
    SKIP: '⊘',
    REVERSE: '↔',
    DRAW: '+2',
    WILD: 'W',
    'WILD DRAW': '+4'
  }

  return symbols[props.card.type]
})

const description = computed(() =>
{
  if (props.card.type === 'NUMBERED')
  {
    return `${color.value} ${props.card.number}`
  }

  if ('color' in props.card)
  {
    return `${color.value} ${props.card.type}`
  }

  return props.card.type
})

//#endregion
</script>

<template>
  <div
    class="uno-card"
    :class="color.toLowerCase()"
    role="img"
    :aria-label="description"
  >
    <span class="card-color">{{ color }}</span>

    <strong class="card-symbol">{{ symbol }}</strong>

    <span class="card-type">
      {{ card.type === 'NUMBERED' ? card.number : card.type }}
    </span>
  </div>
</template>

<style scoped>
.uno-card
{
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100px;
  height: 150px;
  padding: 10px;
  border: 3px solid white;
  border-radius: 12px;
  box-shadow: 0 2px 6px #0003;
  color: white;
}

.red
{
  background-color: #b91c1c;
}

.blue
{
  background-color: #1d4ed8;
}

.green
{
  background-color: #166534;
}

.yellow
{
  background-color: #facc15;
  color: #222;
}

.wild
{
  background-color: #222;
}

.card-symbol
{
  align-self: center;
  font-size: 40px;
}

.card-color,
.card-type
{
  font-size: 11px;
  font-weight: bold;
}

.card-type
{
  text-align: right;
}
</style>
