//#region Card types

export type Color = 'BLUE' | 'GREEN' | 'RED' | 'YELLOW'

export const colors: readonly Color[] = ['BLUE', 'GREEN', 'RED', 'YELLOW']

export type CardNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type NumberedCard = {
  readonly type: 'NUMBERED'
  readonly color: Color
  readonly number: CardNumber
}

export type ActionCard =
  | { readonly type: 'SKIP'; readonly color: Color }
  | { readonly type: 'REVERSE'; readonly color: Color }
  | { readonly type: 'DRAW'; readonly color: Color }

export type WildCard =
  | { readonly type: 'WILD' }
  | { readonly type: 'WILD DRAW' }

export type ColoredCard = NumberedCard | ActionCard
export type Card = ColoredCard | WildCard
export type Type = Card['type']
export type Deck = readonly Card[]

//#endregion

//#region Card helpers

export function hasColor(card: Card, color: Color): boolean
{
  return 'color' in card && card.color === color
}

export function cardPoints(card: Card): number
{
  if (card.type === 'NUMBERED') return card.number
  if (card.type === 'WILD' || card.type === 'WILD DRAW') return 50
  return 20
}

export function readCard(value: Record<string, unknown>): Card
{
  const type = value.type
  if (type === 'WILD' || type === 'WILD DRAW') return { type }

  const color = value.color
  if (color !== 'BLUE' && color !== 'GREEN' && color !== 'RED' && color !== 'YELLOW')
  {
    throw new Error('Invalid card color')
  }

  if (type === 'NUMBERED')
  {
    const number = value.number
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 9)
    {
      throw new Error('Card number must be 0 to 9')
    }
    return { type, color, number: number as CardNumber }
  }

  if (type === 'SKIP' || type === 'REVERSE' || type === 'DRAW') return { type, color }
  throw new Error('Invalid card type')
}

export function createInitialDeck(): Card[]
{
  const cards: Card[] = []

  for (const color of colors)
  {
    for (let number = 0; number <= 9; number++)
    {
      cards.push({ type: 'NUMBERED', color, number: number as CardNumber })
      if (number > 0) cards.push({ type: 'NUMBERED', color, number: number as CardNumber })
    }

    for (let copy = 0; copy < 2; copy++)
    {
      cards.push({ type: 'SKIP', color }, { type: 'REVERSE', color }, { type: 'DRAW', color })
    }
  }

  for (let copy = 0; copy < 4; copy++)
  {
    cards.push({ type: 'WILD' }, { type: 'WILD DRAW' })
  }

  return cards
}

//#endregion
