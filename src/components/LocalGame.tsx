import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  acceptWildDrawFour, catchUnoFailure, challengeWildDrawFour, draw,
  hasEnded, pass, play, sayUno, score, winner, type Round
} from '../model/round'
import { chooseAction } from '../bots/bot'
import { createBoard } from '../model/board'
import { localActions, type AppDispatch, type RootState } from '../store'
import type { Color } from '../model/deck'
import GameBoard from './GameBoard'

export default function LocalGame()
{
  const dispatch = useDispatch<AppDispatch>()
  const { round, message } = useSelector((state: RootState) => state.local)
  const [name, setName] = useState('')
  const [botCount, setBotCount] = useState(1)

  function update(action: (round: Round) => Round, success = ''): void
  {
    if (!round) return
    try
    {
      const next = action(round)
      dispatch(localActions.updateLocalRound({ round: next, message: success }))
    }
    catch (error)
    {
      dispatch(localActions.setLocalMessage(error instanceof Error ? error.message : 'Cannot complete that action'))
    }
  }

  function botTurn(current: Round): void
  {
    const player = current.playerInTurn
    if (player === undefined) return
    const action = chooseAction(current)
    const playerName = current.players[player]
    let next = current
    let status = ''

    if (action.type === 'CATCH')
    {
      next = catchUnoFailure({ accuser: player, accused: action.player }, current)
      status = `${playerName} caught ${current.players[action.player]}. Four cards drawn.`
    }
    else if (action.type === 'CHALLENGE')
    {
      const challenge = current.wildDrawFourChallenge!
      const offenderHadColor = current.hands[challenge.offender]
        .some(card => 'color' in card && card.color === challenge.previousColor)
      next = challengeWildDrawFour(player, current)
      status = offenderHadColor
        ? `${playerName} successfully challenged the Wild Draw Four.`
        : `${playerName}'s challenge failed and they draw six cards.`
    }
    else if (action.type === 'ACCEPT')
    {
      next = acceptWildDrawFour(player, current)
      status = `${playerName} accepted the Wild Draw Four and drew four cards.`
    }
    else if (action.type === 'DRAW')
    {
      next = draw(current)
      status = `${playerName} drew a card`
    }
    else if (action.type === 'PASS')
    {
      next = pass(current)
      status = `${playerName} passed`
    }
    else
    {
      if (action.sayUno) next = sayUno(player, next)
      next = play(action.index, action.color, next)
      status = action.sayUno ? `${playerName} said UNO!` : `${playerName} played a card`
    }
    dispatch(localActions.updateLocalRound({ round: next, message: status }))
  }

  useEffect(() =>
  {
    if (!round || round.playerInTurn === undefined || round.playerInTurn === 0) return
    const timer = window.setTimeout(() =>
    {
      try { botTurn(round) }
      catch (error) { dispatch(localActions.setLocalMessage(error instanceof Error ? error.message : 'Bot error')) }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [round])

  if (!round)
  {
    return <section>
      <h2>Game setup</h2>
      <form className="setup-form" onSubmit={event =>
      {
        event.preventDefault()
        const players = [name.trim(), ...Array.from({ length: botCount }, (_, index) => `Bot ${index + 1}`)]
        dispatch(localActions.startLocalGame({ players, dealer: Math.floor(Math.random() * players.length) }))
      }}>
        <label htmlFor="player-name">Your name</label>
        <input
          id="player-name"
          value={name}
          onChange={event => setName(event.target.value)}
          maxLength={30}
          placeholder="Enter your name"
          required
        />
        <label htmlFor="bot-count">Number of bots</label>
        <select id="bot-count" value={botCount} onChange={event => setBotCount(Number(event.target.value))}>
          <option value={1}>1 bot</option><option value={2}>2 bots</option><option value={3}>3 bots</option>
        </select>
        <button type="submit" disabled={!name.trim()}>Start round</button>
      </form>
    </section>
  }

  if (hasEnded(round))
  {
    return <section aria-labelledby="result-title">
      <h2 id="result-title">Round over</h2>
      <p>{round.players[winner(round)!]} won!</p><p>Round score: {score(round)}</p>
      <div className="actions">
        <button onClick={() => dispatch(localActions.startLocalGame({
          players: [...round.players],
          dealer: Math.floor(Math.random() * round.players.length)
        }))}>
          Play again
        </button>
        <button onClick={() => dispatch(localActions.stopLocalGame())}>Back to setup</button>
      </div>
    </section>
  }

  return <section>
    <GameBoard state={createBoard(round, 0)}
      onPlay={(index: number, color?: Color) => update(value => play(index, color, value), 'You played a card')}
      onDraw={() => update(draw, 'You drew a card')}
      onPass={() => update(pass, 'You passed')}
      onUno={() => update(value => sayUno(0, value), 'You said UNO!')}
      onCatch={player =>
      {
        const next = catchUnoFailure({ accuser: 0, accused: player }, round)
        dispatch(localActions.updateLocalRound({
          round: next,
          message: next === round ? 'No missed UNO to catch' : `${round.players[player]} draws four cards`
        }))
      }}
      onChallenge={() =>
      {
        const challenge = round.wildDrawFourChallenge
        if (!challenge) return
        const offenderHadColor = round.hands[challenge.offender]
          .some(card => 'color' in card && card.color === challenge.previousColor)
        const message = offenderHadColor
          ? 'Challenge successful. The player who played the card draws four.'
          : 'Challenge unsuccessful. You draw six cards.'
        update(value => challengeWildDrawFour(value.playerInTurn!, value), message)
      }}
      onAccept={() => update(
        value => acceptWildDrawFour(value.playerInTurn!, value),
        'You accepted the penalty and drew four cards.'
      )} />
    <p role="status">{message}</p>
    <button onClick={() => dispatch(localActions.stopLocalGame())}>Back to setup</button>
  </section>
}
