import * as _ from 'lodash'
import { Card, Color, cardPoints, colors, createInitialDeck, hasColor } from './deck'
import { Shuffler, standardShuffler } from '../utils/random_utils'

export type Round = {
  readonly players: readonly string[]
  readonly playerCount: number
  readonly hands: readonly (readonly Card[])[]
  readonly drawPile: readonly Card[]
  readonly discardPile: readonly Card[]
  readonly currentColor: Color
  readonly currentDirection: 'clockwise' | 'counterclockwise'
  readonly dealer: number
  readonly playerInTurn?: number
  readonly drawnCardIndex?: number
  readonly unoDeclaredBy?: number
  readonly unoVulnerablePlayer?: number
  readonly wildDrawFourChallenge?: {
    readonly challenger: number
    readonly offender: number
    readonly previousColor: Color
  }
  readonly shuffler: Shuffler<Card>
}

export function createRound(
  players: string[],
  dealer: number,
  shuffler: Shuffler<Card> = standardShuffler,
  cardsPerPlayer = 7
): Round
{
  if (players.length < 2 || players.length > 10) throw new Error('Use 2 to 10 players')
  if (!Number.isInteger(dealer) || dealer < 0 || dealer >= players.length) throw new Error('Invalid dealer')
  if (!Number.isInteger(cardsPerPlayer) || cardsPerPlayer < 1 || players.length * cardsPerPlayer > 100)
  {
    throw new Error('Invalid number of cards per player')
  }

  let deck = shuffler(createInitialDeck())
  const hands: Card[][] = []
  for (let player = 0; player < players.length; player++)
  {
    hands.push(deck.slice(0, cardsPerPlayer))
    deck = deck.slice(cardsPerPlayer)
  }

  let top = deck[0]
  while (top && !('color' in top))
  {
    deck = shuffler([...deck.slice(1), top])
    top = deck[0]
  }
  if (!top || !('color' in top)) throw new Error('Could not select a starting card')
  deck = deck.slice(1)

  let round: Round = {
    players: [...players],
    playerCount: players.length,
    hands,
    drawPile: deck,
    discardPile: [top],
    currentColor: top.color,
    currentDirection: 'clockwise',
    dealer,
    playerInTurn: (dealer + 1) % players.length,
    shuffler
  }

  if (top.type === 'REVERSE')
  {
    const reversed = { ...round, currentDirection: 'counterclockwise' as const }
    round = {
      ...reversed,
      playerInTurn: players.length === 2 ? dealer : nextPlayer(reversed, dealer)
    }
  }
  else if (top.type === 'SKIP')
  {
    round = { ...round, playerInTurn: nextPlayer(round, round.playerInTurn!) }
  }
  else if (top.type === 'DRAW')
  {
    round = giveCards(round, round.playerInTurn!, 2)
    round = { ...round, playerInTurn: nextPlayer(round, round.playerInTurn!) }
  }

  return round
}

function checkPlayer(round: Round, player: number): void
{
  if (!Number.isInteger(player) || player < 0 || player >= round.players.length) throw new Error('Invalid player index')
}

function activePlayer(round: Round): number
{
  if (round.playerInTurn === undefined) throw new Error('The round has ended')
  return round.playerInTurn
}

function nextPlayer(round: Round, player: number, steps = 1): number
{
  const direction = round.currentDirection === 'clockwise' ? 1 : -1
  return (player + direction * steps + round.players.length) % round.players.length
}

export function topOfDiscard(round: Round): Card
{
  const top = round.discardPile[0]
  if (!top) throw new Error('The discard pile is empty')
  return top
}

export function hasEnded(round: Round): boolean
{
  return winner(round) !== undefined
}

export function winner(round: Round): number | undefined
{
  if (round.wildDrawFourChallenge) return undefined
  const index = round.hands.findIndex(hand => hand.length === 0)
  return index === -1 ? undefined : index
}

export function score(round: Round): number | undefined
{
  const winningPlayer = winner(round)
  if (winningPlayer === undefined) return undefined
  return _.sumBy(round.hands.filter((_, index) => index !== winningPlayer), hand => _.sumBy(hand, cardPoints))
}

export function canPlay(index: number, round: Round): boolean
{
  if (round.playerInTurn === undefined || !Number.isInteger(index) || round.wildDrawFourChallenge) return false
  const hand = round.hands[round.playerInTurn]
  const card = hand[index]
  if (!card || (round.drawnCardIndex !== undefined && index !== round.drawnCardIndex)) return false
  if (card.type === 'WILD') return true
  if (card.type === 'WILD DRAW') return true
  if (card.color === round.currentColor) return true

  const top = topOfDiscard(round)
  return card.type === 'NUMBERED'
    ? top.type === 'NUMBERED' && card.number === top.number
    : card.type === top.type
}

export function canPlayAny(round: Round): boolean
{
  if (round.playerInTurn === undefined) return false
  return round.hands[round.playerInTurn].some((_, index) => canPlay(index, round))
}

function refillDrawPile(round: Round): Pick<Round, 'drawPile' | 'discardPile'>
{
  if (round.drawPile.length > 0 || round.discardPile.length <= 1)
  {
    return { drawPile: round.drawPile, discardPile: round.discardPile }
  }
  const [top, ...rest] = round.discardPile
  return { drawPile: round.shuffler(rest), discardPile: [top] }
}

function giveCards(round: Round, player: number, count: number): Round
{
  let next = round
  for (let i = 0; i < count; i++)
  {
    const piles = refillDrawPile(next)
    const card = piles.drawPile[0]
    if (!card) break
    const hands = next.hands.map((hand, index) => index === player ? [...hand, card] : hand)
    next = { ...next, ...piles, drawPile: piles.drawPile.slice(1), hands }
    const refilled = refillDrawPile(next)
    next = { ...next, ...refilled }
  }
  return next
}

export function play(index: number, color: Color | undefined, round: Round): Round
{
  const player = activePlayer(round)
  if (round.wildDrawFourChallenge) throw new Error('Accept or challenge the Wild Draw Four first')
  if (!canPlay(index, round)) throw new Error('That card cannot be played')
  const card = round.hands[player][index]

  if ('color' in card)
  {
    if (color !== undefined) throw new Error('Choose a color only for wild cards')
  }
  else if (!color || !colors.includes(color))
  {
    throw new Error('Choose a valid color for the wild card')
  }

  const saidUno = round.unoDeclaredBy === player
  const hands = round.hands.map((hand, playerIndex) => playerIndex === player ? hand.filter((_, cardIndex) => cardIndex !== index) : hand)
  const currentColor = 'color' in card ? card.color : color!
  const previousColor = round.currentColor
  const unoVulnerablePlayer = hands[player].length === 1 && !saidUno ? player : undefined
  const afterDiscard: Round = {
    ...round,
    hands,
    discardPile: [card, ...round.discardPile],
    currentColor,
    drawnCardIndex: undefined,
    unoDeclaredBy: undefined,
    unoVulnerablePlayer
  }

  if (card.type === 'WILD DRAW')
  {
    return {
      ...afterDiscard,
      playerInTurn: nextPlayer(afterDiscard, player),
      wildDrawFourChallenge: { challenger: nextPlayer(afterDiscard, player), offender: player, previousColor }
    }
  }

  let next = afterDiscard
  let steps = 1
  if (card.type === 'REVERSE')
  {
    next = { ...next, currentDirection: round.currentDirection === 'clockwise' ? 'counterclockwise' : 'clockwise' }
    if (round.players.length === 2) steps = 2
  }
  if (card.type === 'SKIP') steps = 2
  if (card.type === 'DRAW')
  {
    next = giveCards(next, nextPlayer(next, player), 2)
    steps = 2
  }

  next = { ...next, playerInTurn: nextPlayer(next, player, steps) }
  return winner(next) === undefined ? next : { ...next, playerInTurn: undefined, unoVulnerablePlayer: undefined }
}

export function draw(round: Round): Round
{
  const player = activePlayer(round)
  if (round.wildDrawFourChallenge) throw new Error('Accept or challenge the Wild Draw Four first')
  if (round.drawnCardIndex !== undefined) throw new Error('Play the drawn card or pass')
  let next: Round = { ...round, unoVulnerablePlayer: undefined, unoDeclaredBy: undefined }
  const previousSize = round.hands[player].length
  next = giveCards(next, player, 1)
  if (next.hands[player].length > previousSize)
  {
    const drawnCardIndex = previousSize
    next = { ...next, drawnCardIndex }
    if (canPlay(drawnCardIndex, next)) return next
  }
  return { ...next, drawnCardIndex: undefined, playerInTurn: nextPlayer(next, player) }
}

export function pass(round: Round): Round
{
  const player = activePlayer(round)
  if (round.drawnCardIndex === undefined) throw new Error('Draw before passing')
  return { ...round, drawnCardIndex: undefined, unoDeclaredBy: undefined, unoVulnerablePlayer: undefined, playerInTurn: nextPlayer(round, player) }
}

export function sayUno(player: number, round: Round): Round
{
  activePlayer(round)
  checkPlayer(round, player)
  const unoVulnerablePlayer = round.unoVulnerablePlayer === player ? undefined : round.unoVulnerablePlayer
  const unoDeclaredBy = round.playerInTurn === player && round.hands[player].length === 2 ? player : round.unoDeclaredBy
  return { ...round, unoDeclaredBy, unoVulnerablePlayer }
}

export function checkUnoFailure({ accuser, accused }: { accuser: number; accused: number }, round: Round): boolean
{
  activePlayer(round)
  checkPlayer(round, accuser)
  checkPlayer(round, accused)
  return accuser !== accused && round.unoVulnerablePlayer === accused
}

export function catchUnoFailure({ accuser, accused }: { accuser: number; accused: number }, round: Round): Round
{
  if (!checkUnoFailure({ accuser, accused }, round)) return round
  return { ...giveCards(round, accused, 4), unoVulnerablePlayer: undefined }
}

export function challengeWildDrawFour(player: number, round: Round): Round
{
  const challenge = round.wildDrawFourChallenge
  if (!challenge || player !== challenge.challenger) throw new Error('Only the next player can challenge the Wild Draw Four')
  const offenderHasColor = round.hands[challenge.offender].some(card => hasColor(card, challenge.previousColor))
  let next: Round = { ...round, wildDrawFourChallenge: undefined, unoVulnerablePlayer: undefined }
  if (offenderHasColor)
  {
    next = giveCards(next, challenge.offender, 4)
    next = { ...next, playerInTurn: challenge.challenger }
  }
  else
  {
    next = giveCards(next, challenge.challenger, 6)
    next = { ...next, playerInTurn: nextPlayer(next, challenge.challenger) }
  }
  return winner(next) === undefined ? next : { ...next, playerInTurn: undefined }
}

export function acceptWildDrawFour(player: number, round: Round): Round
{
  const challenge = round.wildDrawFourChallenge
  if (!challenge || player !== challenge.challenger) throw new Error('Only the next player can accept the Wild Draw Four')
  const next = giveCards({ ...round, wildDrawFourChallenge: undefined, unoVulnerablePlayer: undefined }, player, 4)
  const result = { ...next, playerInTurn: nextPlayer(next, player) }
  return winner(result) === undefined ? result : { ...result, playerInTurn: undefined }
}
