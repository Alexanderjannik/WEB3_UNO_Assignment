import { Card, CardDeck, Color, Deck, colors, hasColor } from './deck'
import { PlayerHand } from './hand'
import { Shuffler, standardShuffler } from '../utils/random_utils'

export type RoundMemento = {
  players: string[]
  hands: Card[][]
  drawPile: Card[]
  discardPile: Card[]
  currentColor: Color
  currentDirection: 'clockwise' | 'counterclockwise'
  dealer: number
  playerInTurn?: number
  drawnCardIndex?: number
  unoDeclaredBy?: number
  unoVulnerablePlayer?: number
}

export type RoundConfig = {
  players: string[]
  dealer: number
  shuffler?: Shuffler<Card>
  cardsPerPlayer?: number
}

export type RoundEnd = { winner: number }

export interface Round {
  readonly playerCount: number
  readonly dealer: number
  player(index: number): string
  playerHand(index: number): readonly Card[]
  playerInTurn(): number | undefined
  drawPile(): Deck
  discardPile(): Deck
  canPlay(index: number): boolean
  canPlayAny(): boolean
  play(index: number, color?: Color): Card
  draw(): void
  pass(): void
  sayUno(player: number): void
  catchUnoFailure(players: { accuser: number; accused: number }): boolean
  hasEnded(): boolean
  winner(): number | undefined
  score(): number | undefined
  onEnd(callback: (event: RoundEnd) => void): void
  toMemento(): RoundMemento
}

export class UnoRound implements Round {
  private players: string[]
  private hands: PlayerHand[]
  private drawCards: CardDeck
  private discardedCards: CardDeck
  private currentColor: Color
  private direction: number
  private turn: number | undefined
  private drawnCardIndex: number | undefined
  private unoDeclaredBy: number | undefined
  private unoVulnerablePlayer: number | undefined
  private endCallbacks: ((event: RoundEnd) => void)[] = []
  readonly dealer: number

  private constructor(
  state: RoundMemento,
  private shuffler: Shuffler<Card>
)
{
  this.players = [...state.players]

  if (this.players.length < 2 || this.players.length > 10)
  {
    throw new Error('Use 2 to 10 players')
  }

  this.checkPlayer(state.dealer)
  this.dealer = state.dealer

  if (state.hands.length !== this.playerCount)
  {
    throw new Error('Each player needs a hand')
  }

  this.hands = state.hands.map(cards =>
  {
    const validatedDeck = CardDeck.fromMemento(cards)
    const validatedCards = validatedDeck.toMemento()

    return new PlayerHand(validatedCards)
  })

  const emptyHands = this.hands.filter(hand => hand.size === 0)

  if (emptyHands.length > 1)
  {
    throw new Error('Only one player can win')
  }

  this.drawCards = CardDeck.fromMemento(state.drawPile)
  this.discardedCards = CardDeck.fromMemento(state.discardPile)

  const top = this.discardedCards.top()

  if (!top)
  {
    throw new Error('The discard pile cannot be empty')
  }

  if (!colors.includes(state.currentColor))
  {
    throw new Error('Invalid current color')
  }

  if ('color' in top && top.color !== state.currentColor)
  {
    throw new Error('Color must match the top card')
  }

  this.currentColor = state.currentColor

  if (state.currentDirection !== 'clockwise' && state.currentDirection !== 'counterclockwise')
  {
    throw new Error('Invalid direction')
  }

  this.direction = state.currentDirection === 'clockwise' ? 1 : -1

  const roundHasEnded = this.hasEnded()

  this.turn = roundHasEnded ? undefined : state.playerInTurn

  if (!roundHasEnded)
  {
    if (this.turn === undefined)
    {
      throw new Error('An active round needs a player in turn')
    }

    this.checkPlayer(this.turn)
  }

  this.drawnCardIndex = state.drawnCardIndex
  this.unoDeclaredBy = state.unoDeclaredBy
  this.unoVulnerablePlayer = state.unoVulnerablePlayer

  if (this.drawnCardIndex !== undefined)
  {
    if (this.turn === undefined)
    {
      throw new Error('Invalid drawn card index')
    }

    const lastCardIndex = this.hands[this.turn].size - 1

    if (this.drawnCardIndex !== lastCardIndex)
    {
      throw new Error('Invalid drawn card index')
    }
  }

  if (this.unoDeclaredBy !== undefined)
  {
    this.checkPlayer(this.unoDeclaredBy)
  }

  if (this.unoVulnerablePlayer !== undefined)
  {
    this.checkPlayer(this.unoVulnerablePlayer)
  }
}

  static create({players, dealer, shuffler = standardShuffler, cardsPerPlayer = 7}: RoundConfig): UnoRound
{
  if (players.length < 2 || players.length > 10)
  {
    throw new Error('Use 2 to 10 players')
  }

  if (!Number.isInteger(dealer) || dealer < 0 ||dealer >= players.length)
  {
    throw new Error('Invalid dealer')
  }

  if (!Number.isInteger(cardsPerPlayer) || cardsPerPlayer < 1 || players.length * cardsPerPlayer > 100)
  {
    throw new Error('Invalid number of cards per player')
  }

  const deck = CardDeck.full()

  deck.shuffle(shuffler)

  const hands: Card[][] = []

  for (let player = 0; player < players.length; player++)
  {
    const hand: Card[] = []

    for (let i = 0; i < cardsPerPlayer; i++)
    {
      const card = deck.deal()!

      hand.push(card)
    }

    hands.push(hand)
  }

  let top = deck.deal()!

  while (!('color' in top))
  {
    deck.add(top)
    deck.shuffle(shuffler)

    top = deck.deal()!
  }

  const initialState: RoundMemento = {
    players,
    hands,
    dealer,
    drawPile: deck.toMemento(),
    discardPile: [top],
    currentColor: top.color,
    currentDirection: 'clockwise',
    playerInTurn: (dealer + 1) % players.length
  }

  const round = new UnoRound(initialState, shuffler)

  if (top.type === 'REVERSE')
  {
    round.direction = -1

    round.turn = dealer
  }

  else if (top.type === 'SKIP')

  {
    round.turn = round.nextPlayer(round.turn!)
  }

  else if (top.type === 'DRAW')

  {
    round.giveCards(round.turn!, 2)

    round.turn = round.nextPlayer(round.turn!)
  }

  return round
}

  static fromMemento(state: RoundMemento, shuffler: Shuffler<Card> = standardShuffler): UnoRound
{
  return new UnoRound(state, shuffler)
}

get playerCount(): number
{
  return this.players.length
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

private activePlayer(): number
{
  if (this.turn === undefined)
  {
    throw new Error('The round has ended')
  }

  return this.turn
}

private nextPlayer(from: number, steps = 1): number
{
  return (from + this.direction * steps + this.playerCount) % this.playerCount
}

player(index: number): string
{
  this.checkPlayer(index)

  return this.players[index]
}

playerHand(index: number): readonly Card[]
{
  this.checkPlayer(index)

  return this.hands[index].cards
}

playerInTurn(): number | undefined
{
  return this.turn
}

drawPile(): Deck
{
  return this.drawCards
}

discardPile(): Deck
{
  return this.discardedCards
}

winner(): number | undefined
{
  const winner = this.hands.findIndex(hand => hand.size === 0)

  return winner === -1 ? undefined : winner
}

hasEnded(): boolean
{
  return this.winner() !== undefined
}

score(): number | undefined
{
  if (!this.hasEnded())
  {
    return undefined
  }

  return this.hands.reduce((total, hand) => total + hand.score(), 0)
}

 canPlay(index: number): boolean
{
  if (this.turn === undefined || !Number.isInteger(index))
  {
    return false
  }

  const hand = this.hands[this.turn]
  const card = hand.cards[index]

  if (!card)
  {
    return false
  }

  if (
    this.drawnCardIndex !== undefined &&
    index !== this.drawnCardIndex
  )
  {
    return false
  }

  if (card.type === 'WILD')
  {
    return true
  }

  if (card.type === 'WILD DRAW')
  {
    const hasMatchingColor = hand.cards.some(
      other => hasColor(other, this.currentColor)
    )

    return !hasMatchingColor
  }

  if (card.color === this.currentColor)
  {
    return true
  }

  const top = this.discardedCards.top()!

  if (card.type === 'NUMBERED')
  {
    return top.type === 'NUMBERED' && card.number === top.number
  }

  return card.type === top.type
}

canPlayAny(): boolean
{
  if (this.turn === undefined)
  {
    return false
  }

  const hand = this.hands[this.turn]

  return hand.cards.some((card, index) => this.canPlay(index))
}

play(index: number, color?: Color): Card
{
  const player = this.activePlayer()

  if (!this.canPlay(index))
  {
    throw new Error('That card cannot be played')
  }

  const card = this.hands[player].cards[index]

  if ('color' in card)
  {
    if (color !== undefined)
    {
      throw new Error('Choose a color only for wild cards')
    }
  }
  else if (color === undefined || !colors.includes(color))
  {
    throw new Error('Choose a valid color for the wild card')
  }

  this.unoVulnerablePlayer = undefined

  const saidUno = this.unoDeclaredBy === player

  this.unoDeclaredBy = undefined
  this.drawnCardIndex = undefined

  this.hands[player].remove(index)
  this.discardedCards.add(card)

  this.currentColor = 'color' in card ? card.color : color!

  if (this.hands[player].size === 1 && !saidUno)
  {
    this.unoVulnerablePlayer = player
  }

  let steps = 1

  if (card.type === 'REVERSE')
  {
    this.direction *= -1

    if (this.playerCount === 2)
    {
      steps = 2
    }
  }

  if (card.type === 'SKIP')
  {
    steps = 2
  }

  if (card.type === 'DRAW' || card.type === 'WILD DRAW')
  {
    const nextPlayer = this.nextPlayer(player)
    const cardsToDraw = card.type === 'DRAW' ? 2 : 4

    this.giveCards(nextPlayer, cardsToDraw)

    steps = 2
  }

  const winner = this.winner()

  if (winner !== undefined)
  {
    this.turn = undefined
    this.unoVulnerablePlayer = undefined

    for (const callback of this.endCallbacks)
    {
      callback({ winner })
    }
  }
  else
  {
    this.turn = this.nextPlayer(player, steps)
  }

  return card
}

  private refillDrawPile(): void
{
  if (this.drawCards.size > 0 || this.discardedCards.size <= 1)
  {
    return
  }

  const top = this.discardedCards.deal()!

  this.drawCards = new CardDeck(this.discardedCards.toMemento())
  this.drawCards.shuffle(this.shuffler)

  this.discardedCards = new CardDeck([top])
}

private giveCards(player: number, count: number): void
{
  for (let i = 0; i < count; i++)
  {
    this.refillDrawPile()

    const card = this.drawCards.deal()

    if (!card)
    {
      break
    }

    this.hands[player].add(card)

    this.refillDrawPile()
  }
}

draw(): void
{
  const player = this.activePlayer()

  if (this.drawnCardIndex !== undefined)
  {
    throw new Error('Play the drawn card or pass')
  }

  this.unoVulnerablePlayer = undefined
  this.unoDeclaredBy = undefined

  const previousSize = this.hands[player].size

  this.giveCards(player, 1)

  if (this.hands[player].size > previousSize)
  {
    this.drawnCardIndex = previousSize

    if (this.canPlay(previousSize))
    {
      return
    }
  }

  this.drawnCardIndex = undefined
  this.turn = this.nextPlayer(player)
}

pass(): void
{
  const player = this.activePlayer()

  if (this.drawnCardIndex === undefined)
  {
    throw new Error('Draw before passing')
  }

  this.drawnCardIndex = undefined
  this.unoDeclaredBy = undefined
  this.unoVulnerablePlayer = undefined

  this.turn = this.nextPlayer(player)
}

sayUno(player: number): void
{
  this.activePlayer()
  this.checkPlayer(player)

  if (this.unoVulnerablePlayer === player)
  {
    this.unoVulnerablePlayer = undefined
  }

  if (this.turn === player && this.hands[player].size === 2)
  {
    this.unoDeclaredBy = player
  }
}

catchUnoFailure(
  { accuser, accused }: { accuser: number; accused: number }
): boolean
{
  this.activePlayer()

  this.checkPlayer(accuser)
  this.checkPlayer(accused)

  if (accuser === accused || this.unoVulnerablePlayer !== accused)
  {
    return false
  }

  this.giveCards(accused, 4)

  this.unoVulnerablePlayer = undefined

  return true
}

onEnd(callback: (event: RoundEnd) => void): void
{
  this.endCallbacks.push(callback)
}

    toMemento(): RoundMemento
  {
    const state: RoundMemento = {
      players: [...this.players],
      hands: this.hands.map(hand => hand.toMemento()),
      drawPile: this.drawCards.toMemento(),
      discardPile: this.discardedCards.toMemento(),
      currentColor: this.currentColor,
      currentDirection: this.direction === 1 ? 'clockwise' : 'counterclockwise',
      dealer: this.dealer,
      playerInTurn: this.turn
    }

    if (this.drawnCardIndex !== undefined)
    {
      state.drawnCardIndex = this.drawnCardIndex
    }

    if (this.unoDeclaredBy !== undefined)
    {
      state.unoDeclaredBy = this.unoDeclaredBy
    }

    if (this.unoVulnerablePlayer !== undefined)
    {
      state.unoVulnerablePlayer = this.unoVulnerablePlayer
    }

    return state
  }
}
