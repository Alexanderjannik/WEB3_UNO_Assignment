import { Card, cardPoints } from './deck'

//#region Hand interface

export interface Hand {
  readonly cards: readonly Card[]
  readonly size: number
  add(card: Card): void
  remove(index: number): Card
  score(): number
  toMemento(): Card[]
}

//#endregion

//#region Player Hand implementation

export class PlayerHand implements Hand {
  private heldCards: Card[]

  constructor(cards: readonly Card[] = []) {
    this.heldCards = cards.map(card => ({ ...card }))
  }

  get cards(): readonly Card[] 
  { 
    return this.heldCards 
  }

  get size(): number 
  { 
    return this.heldCards.length 
  }

  add(card: Card): void 
  { 
    this.heldCards.push(card) 
  }

  remove(index: number): Card {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) 
      throw new Error('Invalid card index')

    return this.heldCards.splice(index, 1)[0]
  }

  score(): number 
  { 
    return this.heldCards.reduce((sum, card) => sum + cardPoints(card), 0) 
  }

  toMemento(): Card[] 
  { 
    return this.heldCards.map(card => ({ ...card })) 
  }
}

//#endregion
