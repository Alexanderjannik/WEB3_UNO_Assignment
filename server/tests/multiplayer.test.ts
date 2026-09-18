import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createClient } from 'graphql-ws'
import WebSocket from 'ws'
import { PlayerStore } from '../players'
import { GameStore } from '../games'
import { startServer } from '../index'
import type { RoomState } from '../../src/model/online'

//#region Test setup

function storage()
{
  const directory = mkdtempSync(join(tmpdir(), 'uno-test-'))
  const filename = join(directory, 'players.json')
  const players = new PlayerStore(filename)
  const games = new GameStore(players)

  return {
    filename, players, games,
    cleanup: () =>
    {
      assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
      rmSync(directory, { recursive: true })
    }
  }
}

const fields = `id hostId status version message winner score players { id name score wins }
  board { players playerIndex handSizes drawPileSize currentColor currentDirection playerInTurn
    drawnCardIndex unoVulnerablePlayer playableCards hand { type color number } topCard { type color number } }`

//#endregion

//#region Players and room rules

test('registration, login and scores survive restarting the player store', () =>
{
  const data = storage()
  try
  {
    const account = data.players.register('Alice', 'password123')
    assert.equal(data.players.identify(account.token), account.player.id)
    assert.throws(() => data.players.register('alice', 'password123'), /already registered/)
    assert.throws(() => data.players.login('Alice', 'incorrect'), /Incorrect/)
    data.players.addScore(account.player.id, 42)

    const restored = new PlayerStore(data.filename)
    assert.equal(restored.login('Alice', 'password123').player.score, 42)
    assert.equal(restored.player(account.player.id).wins, 1)
    assert.equal(readFileSync(data.filename, 'utf8').includes('password123'), false)
    data.players.logout(account.token)
    assert.throws(() => data.players.identify(account.token), /log in/)
  }
  finally { data.cleanup() }
})

test('rooms allow two to four players, only the host can start, and outsiders cannot see a hand', () =>
{
  const data = storage()
  try
  {
    const ids = Array.from({ length: 5 }, (value, index) => data.players.register(`Player ${index}`, 'password123').player.id)
    const room = data.games.create(ids[0])
    assert.throws(() => data.games.start(room.id, ids[0]), /at least one/)
    assert.throws(() => data.games.get(room.id, ids[1]), /not in/)
    for (const id of ids.slice(1, 4)) data.games.join(room.id, id)
    assert.throws(() => data.games.join(room.id, ids[4]), /full/)
    assert.throws(() => data.games.start(room.id, ids[1]), /host/)
    assert.throws(() => data.games.create(ids[1]), /current game/)

    const started = data.games.start(room.id, ids[0])
    assert.equal(started.status, 'PLAYING')
    assert.equal(started.board!.handSizes.length, 4)
    assert.equal('hands' in started.board!, false)
    assert.equal('drawPile' in started.board!, false)
    assert.throws(() => data.games.join(room.id, ids[4]), /already started/)
  }
  finally { data.cleanup() }
})

test('server rejects out of turn, illegal and stale actions without changing the round', () =>
{
  const data = storage()
  try
  {
    const ids = ['Alice', 'Bob'].map(name => data.players.register(name, 'password123').player.id)
    const room = data.games.create(ids[0])
    data.games.join(room.id, ids[1])
    const started = data.games.start(room.id, ids[0])
    const turn = started.board!.playerInTurn!
    assert.throws(() => data.games.act(room.id, ids[1 - turn], started.version, { type: 'DRAW' }), /your turn/)
    assert.throws(() => data.games.act(room.id, ids[turn], started.version, { type: 'PLAY', index: 99 }), /cannot be played/)
    assert.equal(data.games.get(room.id, ids[0]).version, started.version)
    data.games.act(room.id, ids[turn], started.version, { type: 'DRAW' })
    assert.throws(() => data.games.act(room.id, ids[turn], started.version, { type: 'DRAW' }), /game changed/)
  }
  finally { data.cleanup() }
})

test('leaving transfers a waiting host and cancels an active round', () =>
{
  const data = storage()
  try
  {
    const ids = ['Alice', 'Bob', 'Carol'].map(name => data.players.register(name, 'password123').player.id)
    const room = data.games.create(ids[0])
    data.games.join(room.id, ids[1])
    data.games.join(room.id, ids[2])
    data.games.leave(room.id, ids[0])
    assert.equal(data.games.get(room.id, ids[1]).hostId, ids[1])
    data.games.start(room.id, ids[1])
    data.games.leave(room.id, ids[2])
    assert.equal(data.games.get(room.id, ids[1]).status, 'CANCELLED')
    assert.equal(data.players.player(ids[1]).wins, 0)
    assert.throws(() => data.games.get(room.id, ids[2]), /not in/)
  }
  finally { data.cleanup() }
})

test('room subscriptions provide the latest state and can close while waiting', async () =>
{
  const data = storage()
  try
  {
    const ids = ['Alice', 'Bob'].map(name => data.players.register(name, 'password123').player.id)
    const room = data.games.create(ids[0])
    const updates = data.games.watch(room.id, ids[0])
    assert.equal((await updates.next()).value.players.length, 1)
    data.games.join(room.id, ids[1])
    assert.equal((await updates.next()).value.players.length, 2)
    await updates.return!()
    assert.equal((await updates.next()).done, true)
  }
  finally { data.cleanup() }
})

//#endregion

//#region GraphQL and WebSocket integration

for (const playerCount of [2, 3, 4])
{
test(`${playerCount} clients play a complete round through GraphQL with private live updates`, { timeout: 30000 }, async () =>
{
  const data = storage()
  const server = await startServer(0, data.filename)
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://localhost:${address.port}/graphql`
  const clients: ReturnType<typeof createClient>[] = []

  async function query(query: string, variables = {}, token = '')
  {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables })
    })
    const result = await response.json()
    assert.equal(result.errors, undefined, JSON.stringify(result.errors))
    return result.data
  }

  try
  {
    const accounts: { token: string; player: { id: string } }[] = []
    for (const name of ['Alice', 'Bob', 'Carol', 'David'].slice(0, playerCount))
    {
      const result = await query(`mutation($name: String!) {
        register(name: $name, password: "password123") { token player { id } }
      }`, { name })
      accounts.push(result.register)
    }

    const created = await query(`mutation { createRoom { ${fields} } }`, {}, accounts[0].token)
    const id = created.createRoom.id
    const updates: RoomState[][] = Array.from({ length: playerCount }, () => [])
    const waiters: (() => void)[] = []
    const errors: unknown[] = []

    function watch(index: number): void
    {
      const client = createClient({
        url: url.replace('http:', 'ws:'), webSocketImpl: WebSocket,
        connectionParams: { token: accounts[index].token }
      })
      clients.push(client)
      client.subscribe<{ roomChanged: RoomState }>({
        query: `subscription($id: ID!) { roomChanged(id: $id) { ${fields} } }`, variables: { id }
      }, {
        next: value =>
        {
          if (value.errors) errors.push(value.errors)
          if (value.data) updates[index].push(value.data.roomChanged)
          waiters.splice(0).forEach(resolve => resolve())
        },
        error: error => errors.push(error),
        complete: () => {}
      })
    }

    async function waitFor(predicate: () => boolean): Promise<void>
    {
      while (!predicate())
      {
        await new Promise<void>((resolve, reject) =>
        {
          const timeout = setTimeout(() => reject(new Error('Subscription update timed out')), 3000)
          waiters.push(() => { clearTimeout(timeout); resolve() })
        })
      }
    }

    watch(0)
    await waitFor(() => updates[0].length > 0)
    for (let player = 1; player < playerCount; player++)
    {
      await query(`mutation($id: ID!) { joinRoom(id: $id) { id } }`, { id }, accounts[player].token)
      watch(player)
    }
    await waitFor(() => updates.every(events => events.length > 0 && events.at(-1)!.players.length === playerCount))
    let current: RoomState = (await query(`mutation($id: ID!) { startRound(id: $id) { ${fields} } }`, { id }, accounts[0].token)).startRound
    await waitFor(() => updates.every(events => events.at(-1)!.status === 'PLAYING'))
    assert.equal(updates[0].at(-1)!.board!.playerIndex, 0)
    assert.equal(updates[1].at(-1)!.board!.playerIndex, 1)
    assert.equal('hands' in updates[0].at(-1)!.board!, false)

    for (let move = 0; move < 2000 && current.status === 'PLAYING'; move++)
    {
      const turn = current.board!.playerInTurn!
      current = (await query(`query($id: ID!) { room(id: $id) { ${fields} } }`, { id }, accounts[turn].token)).room
      const board = current.board!
      const index = board.playableCards[0]
      const card = board.hand[index]
      const action = index === undefined
        ? { type: board.drawnCardIndex == null ? 'DRAW' : 'PASS' }
        : { type: 'PLAY', index, ...(card.type === 'WILD' || card.type === 'WILD DRAW' ? { color: 'BLUE' } : {}) }
      current = (await query(`mutation($id: ID!, $version: Int!, $action: Action!) {
        act(id: $id, version: $version, action: $action) { ${fields} }
      }`, { id, version: current.version, action }, accounts[turn].token)).act
    }

    assert.equal(current.status, 'FINISHED')
    await waitFor(() => updates.every(events => events.at(-1)!.status === 'FINISHED'))
    assert.equal(errors.length, 0)
    const restored = new PlayerStore(data.filename)
    const winner = restored.leaderboard().find(player => player.name === current.winner)!
    assert.equal(winner.wins, 1)
    assert.equal(winner.score, current.score)
    assert.equal(updates[0].at(-1)!.winner, updates[1].at(-1)!.winner)

    const denied = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { rooms { id } }' })
    })
    assert.ok((await denied.json()).errors)
  }
  finally
  {
    for (const client of clients) await client.dispose()
    await server.apollo.stop()
    data.cleanup()
  }
})
}

//#endregion
