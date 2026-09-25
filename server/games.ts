import { randomBytes } from 'node:crypto'
import { PubSub } from 'graphql-subscriptions'
import {
  acceptWildDrawFour, catchUnoFailure, challengeWildDrawFour, createRound,
  draw, hasEnded, pass, play, sayUno, score, winner, type Round
} from '../src/model/round'
import { createBoard } from '../src/model/board'
import type { PlayerAction, RoomState } from '../src/model/online'
import { standardRandomizer } from '../src/utils/random_utils'
import { PlayerStore } from './players'

//#region Room

type Room = {
  id: string
  hostId: string
  players: string[]
  status: RoomState['status']
  version: number
  message: string
  round?: Round
}

//#endregion

//#region Games

export class GameStore
{
  private rooms = new Map<string, Room>()
  private playerRooms = new Map<string, string>()
  private events = new PubSub()

  constructor(private players: PlayerStore)
  {
  }

  //#region Lobby

  list(): RoomState[]
  {
    return [...this.rooms.values()].filter(room => room.status === 'WAITING' && room.players.length < 4)
      .map(room => this.view(room))
  }

  current(player: string): RoomState | undefined
  {
    const id = this.playerRooms.get(player)
    return id ? this.get(id, player) : undefined
  }

  create(player: string): RoomState
  {
    if (this.playerRooms.has(player)) throw new Error('Leave your current game first')

    let id = randomBytes(3).toString('hex').toUpperCase()
    while (this.rooms.has(id)) id = randomBytes(3).toString('hex').toUpperCase()

    const room: Room = {
      id,
      hostId: player,
      players: [player],
      status: 'WAITING',
      version: 0,
      message: `${this.players.player(player).name} created the game`
    }

    this.rooms.set(id, room)
    this.playerRooms.set(player, id)
    return this.get(id, player)
  }

  join(id: string, player: string): RoomState
  {
    if (this.playerRooms.has(player)) throw new Error('Leave your current game first')

    const room = this.find(id)
    if (room.status !== 'WAITING') throw new Error('That game has already started')
    if (room.players.length === 4) throw new Error('That game is full')

    room.players.push(player)
    this.playerRooms.set(player, id)
    room.message = `${this.players.player(player).name} joined`
    this.notify(room)
    return this.get(id, player)
  }

  start(id: string, player: string): RoomState
  {
    const room = this.member(id, player)
    if (room.hostId !== player) throw new Error('Only the host can start the round')
    if (room.status !== 'WAITING') throw new Error('That game has already started')
    if (room.players.length < 2) throw new Error('Wait for at least one other player')

    const names = room.players.map(id => this.players.player(id).name)
    room.round = createRound(names, standardRandomizer(names.length))
    room.status = 'PLAYING'
    room.message = 'The round has started'
    this.notify(room)
    return this.get(id, player)
  }

  leave(id: string, player: string): boolean
  {
    const room = this.member(id, player)
    this.playerRooms.delete(player)
    room.message = `${this.players.player(player).name} left the game`

    if (room.status === 'WAITING')
    {
      room.players = room.players.filter(id => id !== player)
      if (room.hostId === player) room.hostId = room.players[0]
    }
    else if (room.status === 'PLAYING')
    {
      room.status = 'CANCELLED'
      room.message += '. The round was cancelled.'
    }

    this.notify(room)
    if (![...this.playerRooms.values()].includes(id)) this.rooms.delete(id)
    return true
  }

  //#endregion

  //#region Round actions

  act(id: string, player: string, version: number, action: PlayerAction): RoomState
  {
    const room = this.member(id, player)
    if (room.status !== 'PLAYING' || !room.round) throw new Error('There is no active round')
    if (room.version !== version) throw new Error('The game changed. Try your action again.')

    const index = room.players.indexOf(player)
    const name = this.players.player(player).name
    let round = room.round
    let message: string

    if (action.type === 'UNO')
    {
      round = sayUno(index, round)
      message = `${name} said UNO!`
    }
    else if (action.type === 'CATCH')
    {
      if (action.accused === undefined) throw new Error('Choose a player to accuse')
      const caught = catchUnoFailure({ accuser: index, accused: action.accused }, round)
      message = caught === round
        ? `${name} made an unsuccessful UNO accusation`
        : `${name} caught ${round.players[action.accused]}. Four cards drawn.`
      round = caught
    }
    else
    {
      if (round.playerInTurn !== index) throw new Error('Wait for your turn')

      if (action.type === 'PLAY')
      {
        if (action.index === undefined) throw new Error('Choose a card')
        round = play(action.index, action.color, round)
        message = `${name} played a card`
      }
      else if (action.type === 'DRAW')
      {
        round = draw(round)
        message = `${name} drew a card`
      }
      else if (action.type === 'PASS')
      {
        round = pass(round)
        message = `${name} passed`
      }
      else if (action.type === 'CHALLENGE')
      {
        const challenge = round.wildDrawFourChallenge
        if (!challenge) throw new Error('There is no Wild Draw Four to challenge')
        const offenderHadColor = round.hands[challenge.offender]
          .some(card => 'color' in card && card.color === challenge.previousColor)
        round = challengeWildDrawFour(index, round)
        message = offenderHadColor
          ? `${name} successfully challenged the Wild Draw Four.`
          : `${name}'s challenge failed and they draw six cards.`
      }
      else if (action.type === 'ACCEPT')
      {
        round = acceptWildDrawFour(index, round)
        message = `${name} accepted the Wild Draw Four and drew four cards.`
      }
      else throw new Error('Unknown action')
    }

    if (hasEnded(round))
    {
      this.players.addScore(room.players[winner(round)!], score(round)!)
      room.status = 'FINISHED'
      message = `${round.players[winner(round)!]} won the round!`
    }

    room.round = round
    room.message = message
    this.notify(room)
    return this.get(id, player)
  }

  //#endregion

  //#region Views and notifications

  private find(id: string): Room
  {
    const room = this.rooms.get(id)
    if (!room) throw new Error('Game not found')
    return room
  }

  private member(id: string, player: string): Room
  {
    const room = this.find(id)
    if (this.playerRooms.get(player) !== id) throw new Error('You are not in that game')
    return room
  }

  get(id: string, player: string): RoomState
  {
    return this.view(this.member(id, player), player)
  }

  private view(room: Room, player?: string): RoomState
  {
    const round = room.round
    const roundWinner = round ? winner(round) : undefined
    return {
      id: room.id, hostId: room.hostId, status: room.status,
      players: room.players.map(id => this.players.player(id)),
      version: room.version, message: room.message,
      board: round && player && room.status !== 'CANCELLED'
        ? createBoard(round, room.players.indexOf(player)) : undefined,
      winner: round && roundWinner !== undefined ? round.players[roundWinner] : undefined,
      score: round ? score(round) : undefined
    }
  }

  private notify(room: Room): void
  {
    room.version++
    for (const player of room.players)
    {
      if (this.playerRooms.get(player) === room.id)
      {
        void this.events.publish(`${room.id}:${player}`, this.view(room, player))
      }
    }
  }

  watch(id: string, player: string): AsyncIterableIterator<RoomState>
  {
    this.member(id, player)
    const updates = this.events.asyncIterableIterator<RoomState>(`${id}:${player}`)
    let next = updates.next()
    const initial = this.get(id, player)
    let first = true
    let closed = false

    return {
      [Symbol.asyncIterator]() { return this },
      async next()
      {
        if (closed) return { done: true, value: undefined }
        if (first)
        {
          first = false
          return { done: false, value: initial }
        }

        const update = await next
        if (!update.done) next = updates.next()
        return update
      },
      async return()
      {
        closed = true
        return updates.return!()
      }
    }
  }

  //#endregion
}

//#endregion
