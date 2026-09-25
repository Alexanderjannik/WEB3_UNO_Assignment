import { useEffect, useState } from 'react'
import { colors, type Color } from '../model/deck'
import type { BoardState } from '../model/board'
import UnoCard from './UnoCard'

//#region Props

type Props = {
  state: BoardState
  busy?: boolean
  onPlay: (index: number, color?: Color) => void
  onDraw: () => void
  onPass: () => void
  onUno: () => void
  onCatch: (player: number) => void
  onChallenge: () => void
  onAccept: () => void
}

//#endregion

export default function GameBoard({
  state, busy = false, onPlay, onDraw, onPass, onUno, onCatch, onChallenge, onAccept
}: Props)
{
  const [selectedCard, setSelectedCard] = useState<number>()

  useEffect(() => setSelectedCard(undefined), [state])

  const opponents = state.players.map((name, index) => ({ name, index }))
    .filter(player => player.index !== state.playerIndex)
  const inTurn = state.playerInTurn === state.playerIndex
  const mustAnswer = state.wildDrawFourChallenger === state.playerIndex

  function selectCard(index: number): void
  {
    if (busy || !state.playableCards.includes(index)) return

    if ('color' in state.hand[index]) onPlay(index)
    else setSelectedCard(index)
  }

  return <section className="game-board">
    <h2>Round in progress</h2>

    <div className="opponents">
      {opponents.map(({ name, index }) =>
        <article
          key={index}
          className={`opponent ${state.playerInTurn === index ? 'active' : ''}`}
        >
          <h3>{name}</h3>
          <p>{state.handSizes[index]} cards</p>
          {state.playerInTurn === index && <span>In turn</span>}
          {state.handSizes[index] === 1 &&
            <button disabled={busy} onClick={() => onCatch(index)}>
              Catch missed UNO
            </button>}
        </article>)}
    </div>

    <div className="round-status" aria-live="polite">
      {state.playerInTurn != null &&
        <p><strong>{state.players[state.playerInTurn]}'s turn</strong></p>}
      <p>Current color: {state.currentColor}</p>
      <p>
        Direction: {state.currentDirection === 'clockwise' ? 'Clockwise' : 'Counterclockwise'}
      </p>
    </div>

    <div className="piles">
      <div className="pile">
        <h3>Draw pile</h3>
        <div className="draw-pile">
          <strong>UNO</strong>
          <span>{state.drawPileSize} cards</span>
        </div>
      </div>
      <div className="pile">
        <h3>Discard pile</h3>
        <UnoCard card={state.topCard} />
      </div>
    </div>

    <section>
      <h3>
        {state.players[state.playerIndex]} — your hand ({state.hand.length} cards)
      </h3>
      <div className="hand">
        {state.hand.map((card, index) =>
          <button
            key={index}
            className="hand-card"
            disabled={busy || !state.playableCards.includes(index) || selectedCard !== undefined}
            onClick={() => selectCard(index)}
          >
            <UnoCard card={card} />
          </button>)}
      </div>
    </section>

    {selectedCard !== undefined &&
      <section className="color-choice" aria-label="Choose a wild card color">
        <h3>Choose a color</h3>
        {colors.map(color =>
          <button
            key={color}
            disabled={busy}
            onClick={() =>
            {
              onPlay(selectedCard, color)
              setSelectedCard(undefined)
            }}
          >
            {color}
          </button>)}
        <button onClick={() => setSelectedCard(undefined)}>Cancel</button>
      </section>}

    {inTurn && state.drawnCardIndex != null && <p>Play the drawn card or pass.</p>}

    {mustAnswer &&
      <section className="challenge" aria-label="Wild Draw Four decision">
        <p>You were given a Wild Draw Four. Challenge it or accept the four-card penalty.</p>
        <button disabled={busy} onClick={onChallenge}>Challenge</button>
        <button disabled={busy} onClick={onAccept}>Accept and draw four</button>
      </section>}

    <div className="actions">
      <button
        disabled={busy || !inTurn || mustAnswer || state.drawnCardIndex != null || selectedCard !== undefined}
        onClick={onDraw}
      >
        Draw card
      </button>
      <button
        disabled={busy || !inTurn || mustAnswer || state.drawnCardIndex == null || selectedCard !== undefined}
        onClick={onPass}
      >
        Pass
      </button>
      <button
        disabled={busy || mustAnswer || (!(inTurn && state.hand.length === 2) && state.unoVulnerablePlayer !== state.playerIndex)}
        onClick={onUno}
      >
        UNO!
      </button>
    </div>
  </section>
}
