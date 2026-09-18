import { describe, it, expect } from '@jest/globals'
import { chooseAction } from '../../src/bots/bot'
import { UnoRound, type RoundMemento } from '../../src/model/round'

//#region Test state

function createState(): RoundMemento
{
  return {
    players: ['Player', 'Bot 1'],
    hands: [
      [{ type: 'NUMBERED', color: 'GREEN', number: 3 }],
      [{ type: 'NUMBERED', color: 'BLUE', number: 2 }, { type: 'WILD' }]
    ],
    drawPile: [{ type: 'NUMBERED', color: 'RED', number: 4 }],
    discardPile: [{ type: 'NUMBERED', color: 'BLUE', number: 5 }],
    currentColor: 'BLUE',
    currentDirection: 'clockwise',
    dealer: 0,
    playerInTurn: 1
  }
}

//#endregion

//#region Decisions

describe('Bot decisions', () =>
{
  it('sometimes says UNO and sometimes forgets', () =>
  {
    expect(chooseAction(createState(), () => 0)).toEqual({ type: 'PLAY', index: 0, sayUno: true })
    expect(chooseAction(createState(), () => 0.99)).toEqual({ type: 'PLAY', index: 0, sayUno: false })
  })

  it('sometimes catches a missed UNO and sometimes lets it go', () =>
  {
    const state = createState()
    state.unoVulnerablePlayer = 0

    expect(chooseAction(state, () => 0)).toEqual({ type: 'CATCH', player: 0 })
    expect(chooseAction(state, () => 0.99).type).toBe('PLAY')
  })

  it('draws when no card can be played', () =>
  {
    const state = createState()
    state.hands[1] = [{ type: 'NUMBERED', color: 'RED', number: 9 }]

    expect(chooseAction(state)).toEqual({ type: 'DRAW' })
  })

  it('only plays the newly drawn card after drawing', () =>
  {
    const state = createState()
    state.drawnCardIndex = 1

    expect(chooseAction(state, () => 0)).toEqual({ type: 'PLAY', index: 1, color: 'BLUE', sayUno: true })
  })

  it('does not play wild draw four while holding the current color', () =>
  {
    const state = createState()
    state.hands[1] = [{ type: 'WILD DRAW' }, { type: 'NUMBERED', color: 'BLUE', number: 2 }]

    expect(chooseAction(state, () => 0)).toEqual({ type: 'PLAY', index: 1, sayUno: true })
  })

  it('chooses the most common color in its hand for a wild', () =>
  {
    const state = createState()
    state.hands[1] = [
      { type: 'WILD' },
      { type: 'NUMBERED', color: 'GREEN', number: 3 },
      { type: 'NUMBERED', color: 'GREEN', number: 4 }
    ]

    expect(chooseAction(state)).toEqual({ type: 'PLAY', index: 0, color: 'GREEN', sayUno: false })
  })

  it('does not change the state sent to the worker', () =>
  {
    const state = createState()
    const before = JSON.stringify(state)

    chooseAction(state)

    expect(JSON.stringify(state)).toBe(before)
  })
})

//#endregion

//#region Complete rounds

describe('Bot rounds', () =>
{
  it.each([2, 3, 4])('finishes a legal round with %i players', playerCount =>
  {
    let seed = 12345
    const random = () =>
    {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }

    const round = UnoRound.create({
      players: Array.from({ length: playerCount }, (value, index) => `Player ${index}`),
      dealer: 0,
      shuffler: cards =>
      {
        for (let i = cards.length - 1; i > 0; i--)
        {
          const j = Math.floor(random() * (i + 1))
          const card = cards[i]
          cards[i] = cards[j]
          cards[j] = card
        }
      }
    })

    for (let turn = 0; turn < 2000 && !round.hasEnded(); turn++)
    {
      const action = chooseAction(round.toMemento(), random)
      const player = round.playerInTurn()!

      if (action.type === 'PLAY')
      {
        expect(round.canPlay(action.index)).toBe(true)
        if (action.sayUno) round.sayUno(player)
        round.play(action.index, action.color)
      }
      else if (action.type === 'DRAW') round.draw()
      else if (action.type === 'PASS') round.pass()
      else round.catchUnoFailure({ accuser: player, accused: action.player })
    }

    expect(round.hasEnded()).toBe(true)
    expect(round.score()).toBeGreaterThan(0)
  })
})

//#endregion
