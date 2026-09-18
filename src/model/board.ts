import type { Card, Color } from './deck'
import type { Round } from './round'

//#region Board state

export type BoardState = {
  players: string[]
  playerIndex: number
  hand: readonly Card[]
  handSizes: number[]
  topCard: Card
  drawPileSize: number
  currentColor: Color
  currentDirection: string
  playerInTurn?: number | null
  drawnCardIndex?: number | null
  unoVulnerablePlayer?: number | null
  playableCards: number[]
}

export function createBoard(round: Round, player: number): BoardState
{
  const state = round.toMemento()
  const hand = round.playerHand(player)

  return {
    players: state.players,
    playerIndex: player,
    hand,
    handSizes: state.hands.map(hand => hand.length),
    topCard: round.discardPile().top()!,
    drawPileSize: round.drawPile().size,
    currentColor: state.currentColor,
    currentDirection: state.currentDirection,
    playerInTurn: state.playerInTurn,
    drawnCardIndex: state.playerInTurn === player ? state.drawnCardIndex : undefined,
    unoVulnerablePlayer: state.unoVulnerablePlayer,
    playableCards: state.playerInTurn === player
      ? hand.map((card, index) => index).filter(index => round.canPlay(index))
      : []
  }
}

//#endregion
