import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Player } from '../src/model/online'

//#region Types

type SavedPlayer = Player & {
  salt: string
  passwordHash: string
}

type Session = {
  playerId: string
  expires: number
}

//#endregion

//#region Player storage

export class PlayerStore
{
  private players: SavedPlayer[]
  private sessions = new Map<string, Session>()

  constructor(private filename: string)
  {
    this.players = existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : []
  }

  private save(players: SavedPlayer[]): void
  {
    mkdirSync(dirname(this.filename), { recursive: true })
    writeFileSync(`${this.filename}.tmp`, JSON.stringify(players, null, 2))
    renameSync(`${this.filename}.tmp`, this.filename)
    this.players = players
  }

  player(id: string): Player
  {
    const player = this.players.find(player => player.id === id)

    if (!player) throw new Error('Player not found')

    return { id: player.id, name: player.name, score: player.score, wins: player.wins }
  }

  addScore(id: string, score: number): void
  {
    this.save(this.players.map(player => player.id === id
      ? { ...player, score: player.score + score, wins: player.wins + 1 }
      : player))
  }

  leaderboard(): Player[]
  {
    return this.players.map(player => this.player(player.id))
      .sort((a, b) => b.score - a.score).slice(0, 10)
  }

  //#endregion

  //#region Registration and login

  register(name: string, password: string): { token: string; player: Player }
  {
    name = name.trim()

    if (!/^[a-zA-Z0-9 _-]{2,30}$/.test(name))
    {
      throw new Error('Use 2 to 30 letters, numbers, spaces, underscores or hyphens for your name')
    }

    if (password.length < 8 || password.length > 128)
    {
      throw new Error('Use a password with 8 to 128 characters')
    }

    if (this.players.some(player => player.name.toLowerCase() === name.toLowerCase()))
    {
      throw new Error('That name is already registered')
    }

    const salt = randomBytes(16).toString('hex')
    const player: SavedPlayer = {
      id: randomUUID(), name, score: 0, wins: 0, salt,
      passwordHash: scryptSync(password, salt, 64).toString('hex')
    }

    this.save([...this.players, player])
    return this.createSession(player.id)
  }

  login(name: string, password: string): { token: string; player: Player }
  {
    const player = this.players.find(player => player.name.toLowerCase() === name.trim().toLowerCase())

    if (!player || password.length > 128 || !timingSafeEqual(
      scryptSync(password, player.salt, 64), Buffer.from(player.passwordHash, 'hex')))
    {
      throw new Error('Incorrect name or password')
    }

    return this.createSession(player.id)
  }

  private createSession(playerId: string): { token: string; player: Player }
  {
    const token = randomBytes(32).toString('hex')
    this.sessions.set(token, { playerId, expires: Date.now() + 24 * 60 * 60 * 1000 })
    return { token, player: this.player(playerId) }
  }

  identify(token: string): string
  {
    const session = this.sessions.get(token)

    if (!session || session.expires < Date.now())
    {
      this.sessions.delete(token)
      throw new Error('Please log in again')
    }

    return session.playerId
  }

  logout(token: string): void
  {
    this.sessions.delete(token)
  }

  //#endregion
}
