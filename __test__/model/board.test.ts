import { describe, it, expect } from '@jest/globals'
import { createBoard } from '../../src/model/board'
import { UnoRound } from '../../src/model/round'

//#region Board views

describe('Board state', () =>
{
  const round = UnoRound.fromMemento({
    players: ['Alice', 'Bob'],
    hands: [
      [{ type: 'NUMBERED', color: 'RED', number: 2 }],
      [{ type: 'WILD' }, { type: 'NUMBERED', color: 'BLUE', number: 4 }]
    ],
    drawPile: [{ type: 'NUMBERED', color: 'YELLOW', number: 9 }],
    discardPile: [{ type: 'NUMBERED', color: 'BLUE', number: 1 }],
    currentColor: 'BLUE',
    currentDirection: 'clockwise',
    dealer: 0,
    playerInTurn: 1,
    drawnCardIndex: 1
  })

  it('shows only the requesting player’s hand and public pile information', () =>
  {
    const board = createBoard(round, 0)
    expect(board.hand).toEqual(round.playerHand(0))
    expect(board.handSizes).toEqual([1, 2])
    expect(board.drawPileSize).toBe(1)
    expect(board).not.toHaveProperty('hands')
    expect(board).not.toHaveProperty('drawPile')
    expect(board).not.toHaveProperty('discardPile')
  })

  it('gives legal plays and the drawn card index only to the player in turn', () =>
  {
    const alice = createBoard(round, 0)
    const bob = createBoard(round, 1)
    expect(alice.playableCards).toEqual([])
    expect(alice.drawnCardIndex).toBeUndefined()
    expect(bob.playerIndex).toBe(1)
    expect(bob.playableCards).toEqual([1])
    expect(bob.drawnCardIndex).toBe(1)
  })
})

//#endregion
