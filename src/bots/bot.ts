import { colors, type Color } from '../model/deck'
import { canPlay, challengeWildDrawFour, type Round } from '../model/round'

//#region Bot actions

export type BotAction =
  | { type: 'PLAY'; index: number; color?: Color; sayUno: boolean }
  | { type: 'DRAW' }
  | { type: 'PASS' }
  | { type: 'CATCH'; player: number }
  | { type: 'CHALLENGE' }
  | { type: 'ACCEPT' }

//#endregion

//#region Bot decisions

export function chooseAction(round: Round, random = Math.random): BotAction
{
  const player = round.playerInTurn
  if (player === undefined) throw new Error('The round has ended')

  if (round.wildDrawFourChallenge)
  {
    if (challengeWildDrawFour(player, round).hands[player].length === round.hands[player].length) return { type: 'CHALLENGE' }
    return random() < 0.5 ? { type: 'CHALLENGE' } : { type: 'ACCEPT' }
  }

  if (round.unoVulnerablePlayer !== undefined && round.unoVulnerablePlayer !== player && random() < 0.5)
  {
    return { type: 'CATCH', player: round.unoVulnerablePlayer }
  }

  const hand = round.hands[player]
  const index = hand.findIndex((_, cardIndex) => canPlay(cardIndex, round))
  if (index === -1) return { type: round.drawnCardIndex === undefined ? 'DRAW' : 'PASS' }

  const action: BotAction = { type: 'PLAY', index, sayUno: hand.length === 2 && random() < 0.8 }
  if (!('color' in hand[index]))
  {
    let mostCards = -1
    for (const color of colors)
    {
      const count = hand.filter(card => 'color' in card && card.color === color).length
      if (count > mostCards)
      {
        action.color = color
        mostCards = count
      }
    }
  }
  return action
}

//#endregion
