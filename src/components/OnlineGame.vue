<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import GameBoard from './GameBoard.vue'
import type { Color } from '../model/deck'
import type { Player, PlayerAction, RoomState } from '../model/online'
import { readRoom, request, roomFields, watchRoom } from '../utils/online_client'

//#region State

const emit = defineEmits<{ back: [] }>()
const name = ref('')
const password = ref('')
const registering = ref(false)
const token = ref(sessionStorage.getItem('uno-token') ?? '')
const player = ref<Player>()
const room = ref<RoomState>()
const rooms = ref<RoomState[]>([])
const scores = ref<Player[]>([])
const gameCode = ref('')
const error = ref('')
const busy = ref(false)
const connected = ref(false)
let stopWatching: (() => void) | undefined

async function run(action: () => Promise<void>): Promise<void>
{
  if (busy.value) return
  busy.value = true
  error.value = ''

  try { await action() }
  catch (problem) { error.value = problem instanceof Error ? problem.message : 'Something went wrong' }
  finally { busy.value = false }
}

//#endregion

//#region Login

async function authenticate(): Promise<void>
{
  await run(async () =>
  {
    const operation = registering.value ? 'register' : 'login'
    const result = await request<{ account: { token: string; player: Player } }>(`
      mutation Account($name: String!, $password: String!) {
        account: ${operation}(name: $name, password: $password) { token player { id name score wins } }
      }`, { name: name.value, password: password.value })

    token.value = result.account.token
    player.value = result.account.player
    sessionStorage.setItem('uno-token', token.value)
    password.value = ''
    await loadLobby()
  })
}

async function loadLobby(): Promise<void>
{
  const result = await request<{ rooms: RoomState[]; leaderboard: Player[]; currentRoom?: RoomState }>(`
    query Lobby {
      rooms { ${roomFields} }
      leaderboard { id name score wins }
      currentRoom { ${roomFields} }
    }`, {}, token.value)

  rooms.value = result.rooms
  scores.value = result.leaderboard
  if (result.currentRoom) enterRoom(result.currentRoom)
}

onMounted(() => run(async () =>
{
  if (!token.value) return

  try
  {
    const result = await request<{ me: Player }>('query { me { id name score wins } }', {}, token.value)
    player.value = result.me
  }
  catch (problem)
  {
    token.value = ''
    sessionStorage.removeItem('uno-token')
    throw problem
  }

  await loadLobby()
}))

async function logout(): Promise<void>
{
  await run(async () =>
  {
    await request('mutation { logout }', {}, token.value)
    resetLogin()
  })
}

function resetLogin(): void
{
  stopWatching?.()
  room.value = undefined
  player.value = undefined
  token.value = ''
  password.value = ''
  error.value = ''
  sessionStorage.removeItem('uno-token')
}

//#endregion

//#region Rooms and updates

function updateRoom(next: RoomState): void
{
  if (!room.value || next.id !== room.value.id || next.version < room.value.version) return
  room.value = readRoom(next)
}

function enterRoom(next: RoomState): void
{
  stopWatching?.()
  room.value = readRoom(next)
  reconnect()
}

function reconnect(): void
{
  if (!room.value) return
  stopWatching?.()
  connected.value = false
  error.value = ''
  stopWatching = watchRoom(room.value.id, token.value, updateRoom,
    value => connected.value = value, message => error.value = message)
}

async function createRoom(): Promise<void>
{
  await run(async () =>
  {
    const result = await request<{ createRoom: RoomState }>(`mutation { createRoom { ${roomFields} } }`, {}, token.value)
    enterRoom(result.createRoom)
  })
}

async function joinRoom(id: string): Promise<void>
{
  await run(async () =>
  {
    const result = await request<{ joinRoom: RoomState }>(`
      mutation Join($id: ID!) { joinRoom(id: $id) { ${roomFields} } }
    `, { id: id.trim().toUpperCase() }, token.value)
    enterRoom(result.joinRoom)
  })
}

async function startRound(): Promise<void>
{
  await run(async () =>
  {
    const result = await request<{ startRound: RoomState }>(`
      mutation Start($id: ID!) { startRound(id: $id) { ${roomFields} } }
    `, { id: room.value!.id }, token.value)
    updateRoom(result.startRound)
  })
}

async function leaveRoom(): Promise<void>
{
  await run(async () =>
  {
    await request('mutation Leave($id: ID!) { leaveRoom(id: $id) }', { id: room.value!.id }, token.value)
    stopWatching?.()
    room.value = undefined
    await loadLobby()
  })
}

onUnmounted(() => stopWatching?.())

//#endregion

//#region Playing

async function act(action: PlayerAction): Promise<void>
{
  if (!room.value || !connected.value) return
  await run(async () =>
  {
    const result = await request<{ act: RoomState }>(`
      mutation Act($id: ID!, $version: Int!, $action: Action!) {
        act(id: $id, version: $version, action: $action) { ${roomFields} }
      }`, { id: room.value!.id, version: room.value!.version, action }, token.value)
    updateRoom(result.act)
  })
}

function play(index: number, color?: Color): void
{
  void act({ type: 'PLAY', index, color })
}

//#endregion
</script>

<template>
  <section>
    <template v-if="!player">
      <h2>{{ registering ? 'Register' : 'Log in' }}</h2>
      <form class="account" @submit.prevent="authenticate">
        <label for="account-name">Player name</label>
        <input id="account-name" v-model="name" required maxlength="30" autocomplete="username" />
        <label for="account-password">Password</label>
        <input id="account-password" v-model="password" type="password" required
          :minlength="registering ? 8 : undefined" maxlength="128"
          :autocomplete="registering ? 'new-password' : 'current-password'" />
        <p v-if="registering">Name: 2–30 characters. Password: 8–128 characters.</p>
        <button :disabled="busy">{{ registering ? 'Create account' : 'Log in' }}</button>
        <button type="button" :disabled="busy" @click="registering = !registering">
          {{ registering ? 'Back to login' : 'Register' }}
        </button>
      </form>
    </template>

    <template v-else-if="!room">
      <h2>Lobby</h2>
      <p>Logged in as {{ player.name }}</p>
      <div class="actions">
        <button type="button" :disabled="busy" @click="createRoom">Create game</button>
        <button type="button" :disabled="busy" @click="run(loadLobby)">Refresh games</button>
        <button type="button" :disabled="busy" @click="logout">Log out</button>
      </div>
      <form class="join" @submit.prevent="joinRoom(gameCode)">
        <label for="game-code">Game code</label>
        <input id="game-code" v-model="gameCode" required maxlength="6" />
        <button :disabled="busy || !gameCode.trim()">Join game</button>
      </form>
      <h3>Open games</h3>
      <p v-if="rooms.length === 0">No open games.</p>
      <ul>
        <li v-for="game in rooms" :key="game.id">
          {{ game.players[0].name }}'s game ({{ game.players.length }}/4)
          <button type="button" :disabled="busy" @click="joinRoom(game.id)">Join {{ game.id }}</button>
        </li>
      </ul>
      <h3>Scores</h3>
      <table>
        <thead><tr><th>Player</th><th>Points</th><th>Rounds won</th></tr></thead>
        <tbody>
          <tr v-for="entry in scores" :key="entry.id">
            <td>{{ entry.name }}</td><td>{{ entry.score }}</td><td>{{ entry.wins }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else>
      <p>Game code: <strong>{{ room.id }}</strong></p>
      <p v-if="!connected" role="status">
        Connecting…
        <button type="button" @click="reconnect">Reconnect</button>
      </p>
      <template v-if="room.status === 'WAITING'">
        <h2>Waiting for players</h2>
        <p>Share the code. Start with 2–4 players.</p>
        <ul>
          <li v-for="member in room.players" :key="member.id">
            {{ member.name }} {{ member.id === room.hostId ? '(host)' : '' }}
          </li>
        </ul>
        <button v-if="player?.id === room.hostId" type="button"
          :disabled="busy || !connected || room.players.length < 2" @click="startRound">Start round</button>
        <p v-else>Waiting for host.</p>
      </template>

      <GameBoard v-else-if="room.status === 'PLAYING' && room.board"
        :state="room.board" :busy="busy || !connected"
        @play="play" @draw="act({ type: 'DRAW' })" @pass="act({ type: 'PASS' })"
        @uno="act({ type: 'UNO' })" @catch-uno="accused => act({ type: 'CATCH', accused })" />

      <template v-else-if="room.status === 'FINISHED'">
        <h2>Round over</h2>
        <p>{{ room.winner }} won!</p>
        <p>Round score: {{ room.score }}</p>
      </template>

      <h2 v-else>Round cancelled</h2>
      <p v-if="room.status !== 'FINISHED'" role="status">{{ room.message }}</p>
      <p v-if="room.status === 'PLAYING'">Leaving cancels the round for everyone.</p>
      <button type="button" :disabled="busy" @click="leaveRoom">
        {{ room.status === 'FINISHED' || room.status === 'CANCELLED' ? 'Back to lobby' : 'Leave game' }}
      </button>
    </template>

    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="error && player" type="button" :disabled="busy" @click="resetLogin">Back to login</button>
    <button v-if="!room" type="button" class="back" :disabled="busy" @click="emit('back')">Main menu</button>
  </section>
</template>

<style scoped>
.account
{
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 360px;
}

.actions,
.join
{
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

input,
button
{
  padding: 12px;
  font: inherit;
  border: 1px solid #999;
  border-radius: 6px;
}

button
{
  cursor: pointer;
}

button:disabled
{
  opacity: 0.55;
  cursor: not-allowed;
}

li
{
  margin-bottom: 12px;
}

table
{
  border-collapse: collapse;
}

th,
td
{
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.back
{
  margin-top: 24px;
}
</style>
