import type { Color } from './deck'
import type { BoardState } from './board'

//#region Players and rooms

export type Player = {
  id: string
  name: string
  score: number
  wins: number
}

export type RoomState = {
  id: string
  hostId: string
  players: Player[]
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED'
  version: number
  message: string
  board?: BoardState | null
  winner?: string | null
  score?: number | null
}

export type PlayerAction = {
  type: 'PLAY' | 'DRAW' | 'PASS' | 'UNO' | 'CATCH'
  index?: number
  color?: Color
  accused?: number
}

//#endregion
