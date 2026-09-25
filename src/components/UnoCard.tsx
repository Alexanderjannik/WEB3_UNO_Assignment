import type { Card } from '../model/deck'

export default function UnoCard({ card }: { card: Card })
{
  const color = 'color' in card ? card.color : 'WILD'
  const symbol = card.type === 'NUMBERED' ? String(card.number) : {
    SKIP: '⊘', REVERSE: '↔', DRAW: '+2', WILD: 'W', 'WILD DRAW': '+4'
  }[card.type]
  const description = card.type === 'NUMBERED' ? `${color} ${card.number}` : `${color} ${card.type}`

  return <div className={`uno-card ${color.toLowerCase()}`} role="img" aria-label={description}>
    <span className="card-color">{color}</span>
    <strong className="card-symbol">{symbol}</strong>
    <span className="card-type">{card.type === 'NUMBERED' ? card.number : card.type}</span>
  </div>
}
