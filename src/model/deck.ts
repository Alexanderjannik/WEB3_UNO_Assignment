import { Shuffler, standardShuffler } from "../utils/random_utils"

//#region Card Types and Values

export type Color = 'BLUE' | 'GREEN' | 'RED' | 'YELLOW'

export const colors: Color[] = ['BLUE', 'GREEN', 'RED', 'YELLOW']

export type CardNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const numbers: CardNumber[] = [0,1,2,3,4,5,6,7,8,9]

export type NumberedCard = {
  readonly type: 'NUMBERED'
  readonly color: Color
  readonly number: CardNumber
}

export type ActionCard = | 
{
  readonly type: 'SKIP'
  readonly color: Color
}

|

{
  readonly type: 'REVERSE'
  readonly color: Color
}

|

{
  readonly type: 'DRAW'
  readonly color: Color
}

export type ColoredCard = NumberedCard | ActionCard

export type WildCard = |
{
  readonly type: 'WILD'
}

|

{
  readonly type: 'WILD DRAW'
}

export type Card = ColoredCard | WildCard

export type Type = Card['type']

export type TypedCard<T extends Type> = Extract<Card, { type: T }>

export type DeckMemento = Card[]

//#endregion

//#region helper functions

export function hasColor(card: Card, color: Color): boolean 
{
  return 'color' in card && card.color === color
}

export function hasNumber(card: Card, number: number): boolean
{
  return card.type === 'NUMBERED' && card.number === number
}

export function cardPoints(card: Card): number 
{
  if (card.type === 'NUMBERED') 
    return card.number
  
  if (card.type === 'WILD' || card.type === 'WILD DRAW')
    return 50

  return 20
}

//#endregion

//#region validation

export function readCard(value: Record<string, unknown>): Card
{

  const type = value.type
  
  if (type === 'WILD' || type === 'WILD DRAW')
  {
    if (value.color !== undefined || value.number !== undefined)
    {
      throw new Error("Wild cards doesn't have colors or numbers")
    }
    return {type}
  }

  const color = value.color

  if (color !== 'BLUE' && color !== 'GREEN' && color !== 'RED' && color !== 'YELLOW'
  ) {
    throw new Error('Invalid card color')
  }

  if (type === 'NUMBERED')
  {
    const number = value.number

    if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 9)
    {
      throw new Error("Card number must be 0 to 9")
    }
    return {type, color, number: number as CardNumber}
  }

  if (type === 'SKIP' || type === 'REVERSE' || type === 'DRAW')
  {
    if (value.number !== undefined)
    {
      throw new Error("Action cards doesn't have numbers")
    }
    return {type: type, color: color}
  }
  throw new Error("Invalid card type")
}

//#endregion

//#region Deck interface

export interface Deck {
  readonly size: number
  deal(): Card | undefined
  top(): Card | undefined
  peek(): Card | undefined
  add(card: Card): void
  shuffle(shuffler?: Shuffler<Card>): void
  filter(predicate: (card: Card) => boolean): Deck
  toMemento(): DeckMemento
}

//#endregion

//#region Card Deck implementation

export class CardDeck implements Deck {
  private cards: Card[]
  constructor(cards: readonly Card[] = [])
  {
    this.cards = cards.map(card => (
      {...card}
    ))
  }

  static full(): CardDeck {
    const cards: Card[] = []

    for (const color of colors)
    {
      for (const number of numbers)
      {
        cards.push({type: 'NUMBERED', color, number})

        if (number !== 0) cards.push({type: 'NUMBERED', color, number})
      }

      for (let copy = 0; copy < 2; copy++)
      {
        cards.push({type: 'SKIP', color})
        cards.push({type: 'REVERSE', color})
        cards.push({type: 'DRAW', color})
      }
    }

    for (let copy = 0; copy < 4; copy++)
    {
      cards.push({type: 'WILD'})
      cards.push({type: 'WILD DRAW'})
    }

    return new CardDeck(cards)
  }

  static fromMemento(cards: Record<string, unknown>[]): CardDeck {
    return new CardDeck(cards.map(readCard))
  }

  get size(): number {
    return this.cards.length
  }

  deal(): Card | undefined {
    return this.cards.shift()
  }

  top(): Card | undefined {
    return this.cards[0]
  }

  peek(): Card | undefined {
    return this.top()
  }

  add(card: Card): void {
    this.cards.unshift(card)
  }

  shuffle(shuffler: Shuffler<Card> = standardShuffler): void {
    shuffler(this.cards)
  }

  filter(predicate: (card: Card) => boolean): Deck {
    return new CardDeck(this.cards.filter(predicate))
  }

  toMemento(): DeckMemento {
    return this.cards.map(card => ({...card}))
  }
}

//#endregion


