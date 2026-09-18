import { colors, type Color } from '../model/deck'
import { UnoRound, type RoundMemento } from '../model/round'

//#region Messages

export type BotAction =
  | { type: 'PLAY'; index: number; color?: Color; sayUno: boolean }
  | { type: 'DRAW' }
  | { type: 'PASS' }
  | { type: 'CATCH'; player: number }

export type BotRequest = {
  id: number
  state: RoundMemento
}

export type BotResponse = {
  id: number
  action: BotAction
}

//#endregion

//#region Bot decisions

export function chooseAction(state: RoundMemento, random = Math.random): BotAction
{
  const round = UnoRound.fromMemento(state)
  const player = round.playerInTurn()

  if (player === undefined)
  {
    throw new Error('The round has ended')
  }

  if (state.unoVulnerablePlayer !== undefined && state.unoVulnerablePlayer !== player && random() < 0.5)
  {
    return { type: 'CATCH', player: state.unoVulnerablePlayer }
  }

  const hand = round.playerHand(player)
  const index = hand.findIndex((card, index) => round.canPlay(index))

  if (index === -1)
  {
    return { type: state.drawnCardIndex === undefined ? 'DRAW' : 'PASS' }
  }

  const action: BotAction = {
    type: 'PLAY',
    index,
    sayUno: hand.length === 2 && random() < 0.8
  }

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
