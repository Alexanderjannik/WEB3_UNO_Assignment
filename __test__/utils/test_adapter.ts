import { Card, CardDeck, Deck } from '../../src/model/deck'

import {
  Round,
  RoundConfig,
  RoundMemento,
  UnoRound
} from '../../src/model/round'

import {
  Game,
  GameConfig,
  GameMemento,
  UnoGame
} from '../../src/model/uno'

import {
  Randomizer,
  Shuffler,
  standardRandomizer,
  standardShuffler
} from '../../src/utils/random_utils'

export function createInitialDeck(): Deck
{
  return CardDeck.full()
}

export function createDeckFromMemento(
  cards: Record<string, string | number>[]
): Deck
{
  return CardDeck.fromMemento(cards)
}

export type HandConfig = RoundConfig

export function createRound(config: HandConfig): Round
{
  return UnoRound.create(config)
}

export function createRoundFromMemento(
  memento: unknown,
  shuffler: Shuffler<Card> = standardShuffler
): Round
{
  return UnoRound.fromMemento(memento as RoundMemento, shuffler)
}

export function createGame(config: GameConfig): Game
{
  return UnoGame.create(config)
}

export function createGameFromMemento(
  memento: unknown,
  randomizer: Randomizer = standardRandomizer,
  shuffler: Shuffler<Card> = standardShuffler
): Game
{
  return UnoGame.fromMemento(
    memento as GameMemento,
    randomizer,
    shuffler
  )
}