import type { Card, Color } from './deck'
import { canPlay, topOfDiscard, type Round } from './round'

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
  wildDrawFourChallenger?: number | null
  playableCards: number[]
}

export function createBoard(round: Round, player: number): BoardState
{
  const hand = round.hands[player]

  return {
    players: [...round.players],
    playerIndex: player,
    hand,
    handSizes: round.hands.map(hand => hand.length),
    topCard: topOfDiscard(round),
    drawPileSize: round.drawPile.length,
    currentColor: round.currentColor,
    currentDirection: round.currentDirection,
    playerInTurn: round.playerInTurn,
    drawnCardIndex: round.playerInTurn === player ? round.drawnCardIndex : undefined,
    unoVulnerablePlayer: round.unoVulnerablePlayer,
    wildDrawFourChallenger: round.wildDrawFourChallenge?.challenger,
    playableCards: round.playerInTurn === player
      ? hand.map((card, index) => index).filter(index => canPlay(index, round))
      : []
  }
}

//#endregion
