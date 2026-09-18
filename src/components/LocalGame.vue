<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, triggerRef } from 'vue'
import GameSetup from './GameSetup.vue'
import GameBoard from './GameBoard.vue'
import GameOver from './GameOver.vue'
import { UnoRound } from '../model/round'
import { createBoard } from '../model/board'
import { standardRandomizer } from '../utils/random_utils'
import type { Color } from '../model/deck'
import type { BotRequest, BotResponse } from '../bots/bot'

//#region State

const round = shallowRef<UnoRound | undefined>(undefined)
const message = ref('')
let botTimer: ReturnType<typeof setTimeout> | undefined
let bots: Worker[] = []
let requestId = 0

const state = computed(() =>
{
  return round.value?.toMemento()
})

const board = computed(() =>
{
  return round.value ? createBoard(round.value, 0) : undefined
})

//#endregion

//#region Round setup

function startRound(players: string[]): void
{
  stopBots()
  round.value = UnoRound.create({
    players,
    dealer: standardRandomizer(players.length)
  })
  for (let player = 1; player < players.length; player++)
  {
    const bot = new Worker(new URL('../bots/bot.worker.ts', import.meta.url), { type: 'module' })

    bot.onmessage = (event: MessageEvent<BotResponse>) => receiveBotAction(player, event.data)
    bot.onerror = () =>
    {
      stopBots()
      message.value = 'Bot error. Start a new round from setup.'
    }

    bots.push(bot)
  }
  message.value = ''
  scheduleBot()
}

function returnToSetup(): void
{
  stopBots()
  round.value = undefined
  message.value = ''
}

onUnmounted(stopBots)

//#endregion

//#region Player actions

function updateRound(action: () => void): void
{
  try
  {
    message.value = ''
    action()
    triggerRef(round)
    scheduleBot()
  }
  catch (error)
  {
    message.value = error instanceof Error ? error.message : 'Cannot complete that action'
  }
}

function playCard(index: number, color?: Color): void
{
  if (round.value?.playerInTurn() !== 0) return

  updateRound(() => round.value!.play(index, color))
}

function drawCard(): void
{
  if (round.value?.playerInTurn() !== 0) return

  updateRound(() => round.value!.draw())
}

function passTurn(): void
{
  if (round.value?.playerInTurn() !== 0) return

  updateRound(() => round.value!.pass())
}

function sayUno(): void
{
  if (!round.value || round.value.hasEnded()) return

  updateRound(() => round.value!.sayUno(0))
  message.value = 'You said UNO!'
}

function catchUno(player: number): void
{
  if (!round.value || round.value.hasEnded()) return

  updateRound(() =>
  {
    const caught = round.value!.catchUnoFailure({ accuser: 0, accused: player })

    message.value = caught ? `${round.value!.player(player)} draws four cards` : 'No missed UNO to catch'
  })
}

//#endregion

//#region Bot turns

function scheduleBot(): void
{
  clearTimeout(botTimer)
  requestId++

  const player = round.value?.playerInTurn()

  if (round.value?.hasEnded())
  {
    stopBots()
    return
  }

  if (player !== undefined && player !== 0)
  {
    botTimer = setTimeout(() =>
    {
      const request: BotRequest = { id: requestId, state: round.value!.toMemento() }

      bots[player - 1].postMessage(request)
    }, 1000)
  }
}

function stopBots(): void
{
  clearTimeout(botTimer)
  requestId++

  for (const bot of bots)
  {
    bot.terminate()
  }

  bots = []
}

function receiveBotAction(player: number, response: BotResponse): void
{
  const currentRound = round.value

  if (!currentRound || response.id !== requestId || currentRound.playerInTurn() !== player) return

  updateRound(() =>
  {
    const action = response.action
    const name = currentRound.player(player)

    if (action.type === 'CATCH')
    {
      currentRound.catchUnoFailure({ accuser: player, accused: action.player })
      message.value = `${name} caught ${currentRound.player(action.player)}. Four cards drawn.`
    }
    else if (action.type === 'DRAW')
    {
      currentRound.draw()
      message.value = `${name} drew a card`
    }
    else if (action.type === 'PASS')
    {
      currentRound.pass()
      message.value = `${name} passed`
    }
    else
    {
      if (action.sayUno)
      {
        currentRound.sayUno(player)
      }

      currentRound.play(action.index, action.color)
      message.value = action.sayUno ? `${name} said UNO!` : `${name} played a card`
    }
  })
}

//#endregion
</script>

<template>
  <section>

    <GameSetup
      v-if="!state"
      @start="startRound"
    />

    <GameOver
      v-else-if="state.playerInTurn === undefined"
      :winner="state.players[round!.winner()!]"
      :score="round!.score()!"
      @restart="startRound(state.players)"
      @setup="returnToSetup"
    />

    <template v-else>
      <GameBoard
        :state="board!"
        @play="playCard"
        @draw="drawCard"
        @pass="passTurn"
        @uno="sayUno"
        @catch-uno="catchUno"
      />

      <p role="status">{{ message }}</p>

      <button type="button" @click="returnToSetup">
        Back to setup
      </button>
    </template>
  </section>
</template>

<style scoped>
button
{
  padding: 12px;
  font: inherit;
  cursor: pointer;
}
</style>
