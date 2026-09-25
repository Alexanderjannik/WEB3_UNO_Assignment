import { Card } from './deck'
import { Round, createRound, hasEnded, score as roundScore, winner as roundWinner } from './round'
import { Randomizer, Shuffler, standardRandomizer, standardShuffler } from '../utils/random_utils'

export type Props = {
  players?: string[]
  targetScore?: number
  randomizer?: Randomizer
  shuffler?: Shuffler<Card>
  cardsPerPlayer?: number
}

export type Game = {
  readonly players: readonly string[]
  readonly playerCount: number
  readonly targetScore: number
  readonly scores: readonly number[]
  readonly winner?: number
  readonly currentRound?: Round
  readonly randomizer: Randomizer
  readonly shuffler: Shuffler<Card>
  readonly cardsPerPlayer: number
}

export function createGame({
  players = ['A', 'B'],
  targetScore = 500,
  randomizer = standardRandomizer,
  shuffler = standardShuffler,
  cardsPerPlayer = 7
}: Props = {}): Game
{
  if (players.length < 2 || players.length > 10) throw new Error('Use 2 to 10 players')
  if (!Number.isFinite(targetScore) || targetScore <= 0) throw new Error('Target score must be positive')
  const dealer = randomizer(players.length)
  if (!Number.isInteger(dealer) || dealer < 0 || dealer >= players.length) throw new Error('Invalid dealer')
  const currentRound = createRound(players, dealer, shuffler, cardsPerPlayer)
  return {
    players: [...players],
    playerCount: players.length,
    targetScore,
    scores: players.map(() => 0),
    currentRound,
    randomizer,
    shuffler,
    cardsPerPlayer
  }
}

export function play(action: (round: Round) => Round, game: Game): Game
{
  if (!game.currentRound) throw new Error('The game has ended')
  const currentRound = action(game.currentRound)
  if (!hasEnded(currentRound)) return { ...game, currentRound }

  const handWinner = roundWinner(currentRound)!
  const points = roundScore(currentRound)!
  const scores = game.scores.map((score, player) => player === handWinner ? score + points : score)
  const winner = scores.findIndex(score => score >= game.targetScore)
  if (winner !== -1) return { ...game, scores, winner, currentRound: undefined }

  const nextDealer = (currentRound.dealer + 1) % game.playerCount
  const nextRound = createRound(game.players as string[], nextDealer, game.shuffler, game.cardsPerPlayer)
  return { ...game, scores, currentRound: nextRound }
}
