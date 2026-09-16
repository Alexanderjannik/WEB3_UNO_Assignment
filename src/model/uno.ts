import { Card } from './deck'
import { Round, RoundMemento, UnoRound } from './round'
import {Randomizer, Shuffler, standardRandomizer, standardShuffler} from '../utils/random_utils'

//#region Types

export type GameMemento = {
  players: string[]
  targetScore: number
  scores: number[]
  cardsPerPlayer: number
  currentRound?: RoundMemento
}

export type GameConfig = {
  players?: string[]
  targetScore?: number
  randomizer?: Randomizer
  shuffler?: Shuffler<Card>
  cardsPerPlayer?: number
}

//#endregion

//#region Game interface

export interface Game
{
  readonly playerCount: number
  readonly targetScore: number

  player(index: number): string
  score(index: number): number
  winner(): number | undefined
  currentRound(): Round | undefined
  toMemento(): GameMemento
}

//#endregion

//#region Game implementation

export class UnoGame implements Game
{
  private players: string[]
  private scores: number[]
  private round: UnoRound | undefined
  private cardsPerPlayer: number

  readonly targetScore: number

  private constructor(state: GameMemento, private randomizer: Randomizer, private shuffler: Shuffler<Card>)
  {
    this.players = [...state.players]
    this.targetScore = state.targetScore
    this.scores = [...state.scores]
    this.cardsPerPlayer = state.cardsPerPlayer

    if (this.playerCount < 2 || this.playerCount > 10)
    {
      throw new Error('Use 2 to 10 players')
    }

    if (
      !Number.isFinite(this.targetScore) ||
      this.targetScore <= 0
    )
    {
      throw new Error('Target score must be positive')
    }

    if (
      this.scores.length !== this.playerCount ||
      this.scores.some(score => !Number.isFinite(score) || score < 0)
    )
    {
      throw new Error('Each player needs a nonnegative score')
    }

    if (
      !Number.isInteger(this.cardsPerPlayer) ||
      this.cardsPerPlayer < 1 ||
      this.cardsPerPlayer * this.playerCount > 100
    )
    {
      throw new Error('Invalid cards per player')
    }

    const winningScores = this.scores.filter(
      score => score >= this.targetScore
    )

    if (winningScores.length > 1)
    {
      throw new Error('Only one game winner')
    }

    if (this.winner() === undefined)
    {
      if (!state.currentRound)
      {
        throw new Error('An unfinished game needs a round')
      }

      this.round = UnoRound.fromMemento(state.currentRound, shuffler)

      if (
        this.round.playerCount !== this.playerCount ||
        this.players.some((name, i) => name !== this.round!.player(i))
      )
      {
        throw new Error('Round players must match game players')
      }

      if (this.round.hasEnded())
      {
        throw new Error('Current round must still be active')
      }

      this.listenToRound(this.round)
    }
    else if (state.currentRound !== undefined)
    {
      throw new Error('A finished game cannot have an active round')
    }
  }

  static create(
    {
      players = ['A', 'B'],
      targetScore = 500,
      randomizer = standardRandomizer,
      shuffler = standardShuffler,
      cardsPerPlayer = 7
    }: GameConfig = {}
  ): UnoGame
  
  {
    const round = UnoRound.create({
      players,
      dealer: randomizer(players.length),
      shuffler,
      cardsPerPlayer
    })

    const initialState: GameMemento = {
      players,
      targetScore,
      scores: players.map(() => 0),
      cardsPerPlayer,
      currentRound: round.toMemento()
    }

    return new UnoGame(initialState, randomizer, shuffler)
  }

  static fromMemento(
    state: GameMemento,
    randomizer = standardRandomizer,
    shuffler: Shuffler<Card> = standardShuffler
  ): UnoGame
  {
    return new UnoGame(state, randomizer, shuffler)
  }

  private listenToRound(round: UnoRound): void
  {
    round.onEnd(({ winner }) =>
    {
      this.scores[winner] += round.score()!

      if (this.winner() !== undefined)
      {
        this.round = undefined
      }
      else
      {
        this.round = UnoRound.create({
          players: this.players,
          dealer: (round.dealer + 1) % this.playerCount,
          cardsPerPlayer: this.cardsPerPlayer,
          shuffler: this.shuffler
        })

        this.listenToRound(this.round)
      }
    })
  }

  private checkPlayer(index: number): void
  {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= this.playerCount
    )
    {
      throw new Error('Invalid player index')
    }
  }

  get playerCount(): number
  {
    return this.players.length
  }

  player(index: number): string
  {
    this.checkPlayer(index)

    return this.players[index]
  }

  score(index: number): number
  {
    this.checkPlayer(index)

    return this.scores[index]
  }

  winner(): number | undefined
  {
    const index = this.scores.findIndex(
      score => score >= this.targetScore
    )

    return index === -1 ? undefined : index
  }

  currentRound(): Round | undefined
  {
    return this.round
  }

  toMemento(): GameMemento
  {
    const state: GameMemento = {
      players: [...this.players],
      targetScore: this.targetScore,
      scores: [...this.scores],
      cardsPerPlayer: this.cardsPerPlayer
    }

    if (this.round)
    {
      state.currentRound = this.round.toMemento()
    }

    return state
  }
}

//#endregion