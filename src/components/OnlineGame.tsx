import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { Color } from '../model/deck'
import type { Player, PlayerAction, RoomState } from '../model/online'
import { onlineActions, type AppDispatch, type RootState } from '../store'
import { readRoom, request, roomFields, watchRoom } from '../utils/online_client'
import GameBoard from './GameBoard'

export default function OnlineGame({ onBack }: { onBack: () => void })
{
  const dispatch = useDispatch<AppDispatch>()
  const online = useSelector((state: RootState) => state.online)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [gameCode, setGameCode] = useState('')
  const [connectionAttempt, setConnectionAttempt] = useState(0)

  function clearAccount(): void
  {
    sessionStorage.removeItem('uno-token')
    dispatch(onlineActions.clearAccount())
  }

  async function run(action: () => Promise<void>): Promise<void>
  {
    if (online.busy) return
    dispatch(onlineActions.setBusy(true))
    dispatch(onlineActions.setError(''))
    try { await action() }
    catch (error) { dispatch(onlineActions.setError(error instanceof Error ? error.message : 'Something went wrong')) }
    finally { dispatch(onlineActions.setBusy(false)) }
  }

  async function loadLobby(token = online.token): Promise<void>
  {
    const result = await request<{ rooms: RoomState[]; leaderboard: Player[]; currentRoom?: RoomState }>(`
      query Lobby {
        rooms { ${roomFields} }
        leaderboard { id name score wins }
        currentRoom { ${roomFields} }
      }`, {}, token)
    dispatch(onlineActions.setLobby({ rooms: result.rooms, scores: result.leaderboard }))
    if (result.currentRoom) dispatch(onlineActions.setRoom(readRoom(result.currentRoom)))
  }

  useEffect(() =>
  {
    if (!online.token || online.player) return
    void run(async () =>
    {
      try
      {
        const result = await request<{ me: Player }>('query { me { id name score wins } }', {}, online.token)
        dispatch(onlineActions.setAccount({ token: online.token, player: result.me }))
      }
      catch
      {
        clearAccount()
        return
      }
      await loadLobby(online.token)
    })
  }, [])

  useEffect(() =>
  {
    if (!online.room || !online.token) return
    const subscription = watchRoom(online.room.id, online.token, value => dispatch(onlineActions.setConnected(value)))
      .subscribe({
        next: room => dispatch(onlineActions.updateRoom(room)),
        error: error =>
        {
          dispatch(onlineActions.setError(error instanceof Error
            ? error.message
            : 'Connection lost. Use Reconnect to try again.'))
        }
      })
    return () => subscription.unsubscribe()
  }, [online.room?.id, online.token, connectionAttempt])

  async function authenticate(): Promise<void>
  {
    await run(async () =>
    {
      const operation = registering ? 'register' : 'login'
      const result = await request<{ account: { token: string; player: Player } }>(`
        mutation Account($name: String!, $password: String!) {
          account: ${operation}(name: $name, password: $password) { token player { id name score wins } }
        }`, { name, password })
      sessionStorage.setItem('uno-token', result.account.token)
      dispatch(onlineActions.setAccount(result.account))
      setPassword('')
      await loadLobby(result.account.token)
    })
  }

  async function logout(): Promise<void>
  {
    await run(async () =>
    {
      await request('mutation { logout }', {}, online.token)
      clearAccount()
    })
  }

  async function createRoom(): Promise<void>
  {
    await run(async () =>
    {
      const result = await request<{ createRoom: RoomState }>(
        `mutation { createRoom { ${roomFields} } }`, {}, online.token)
      dispatch(onlineActions.setRoom(readRoom(result.createRoom)))
    })
  }

  async function joinRoom(id: string): Promise<void>
  {
    await run(async () =>
    {
      const result = await request<{ joinRoom: RoomState }>(
        `mutation Join($id: ID!) { joinRoom(id: $id) { ${roomFields} } }`,
        { id: id.trim().toUpperCase() }, online.token)
      dispatch(onlineActions.setRoom(readRoom(result.joinRoom)))
    })
  }

  async function startRound(): Promise<void>
  {
    if (!online.room) return
    await run(async () =>
    {
      const result = await request<{ startRound: RoomState }>(
        `mutation Start($id: ID!) { startRound(id: $id) { ${roomFields} } }`,
        { id: online.room!.id }, online.token)
      dispatch(onlineActions.updateRoom(readRoom(result.startRound)))
    })
  }

  async function leaveRoom(): Promise<void>
  {
    if (!online.room) return
    await run(async () =>
    {
      await request('mutation Leave($id: ID!) { leaveRoom(id: $id) }', { id: online.room!.id }, online.token)
      dispatch(onlineActions.setRoom(undefined))
      await loadLobby()
    })
  }

  async function act(action: PlayerAction): Promise<void>
  {
    if (!online.room || !online.connected) return
    await run(async () =>
    {
      const result = await request<{ act: RoomState }>(`mutation Act($id: ID!, $version: Int!, $action: Action!) {
        act(id: $id, version: $version, action: $action) { ${roomFields} }
      }`, { id: online.room!.id, version: online.room!.version, action }, online.token)
      dispatch(onlineActions.updateRoom(readRoom(result.act)))
    })
  }

  if (!online.player)
  {
    return <section>
      <h2>{registering ? 'Register' : 'Log in'}</h2>
      <form className="account" onSubmit={event => { event.preventDefault(); void authenticate() }}>
        <label htmlFor="account-name">Player name</label>
        <input
          id="account-name"
          value={name}
          onChange={event => setName(event.target.value)}
          required
          maxLength={30}
          autoComplete="username"
        />
        <label htmlFor="account-password">Password</label>
        <input
          id="account-password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          type="password"
          required
          minLength={registering ? 8 : undefined}
          maxLength={128}
          autoComplete={registering ? 'new-password' : 'current-password'}
        />
        {registering && <p>Name: 2–30 characters. Password: 8–128 characters.</p>}
        <button disabled={online.busy}>{registering ? 'Create account' : 'Log in'}</button>
        <button
          type="button"
          disabled={online.busy}
          onClick={() => setRegistering(!registering)}
        >
          {registering ? 'Back to login' : 'Register'}
        </button>
      </form>
      {online.error && <p role="alert">{online.error}</p>}
      <button className="back" disabled={online.busy} onClick={onBack}>Main menu</button>
    </section>
  }

  if (!online.room)
  {
    return <section>
      <h2>Lobby</h2><p>Logged in as {online.player.name}</p>
      <div className="actions">
        <button disabled={online.busy} onClick={() => void createRoom()}>Create game</button>
        <button disabled={online.busy} onClick={() => void run(loadLobby)}>Refresh games</button>
        <button disabled={online.busy} onClick={() => void logout()}>Log out</button>
      </div>
      <form className="join" onSubmit={event => { event.preventDefault(); void joinRoom(gameCode) }}>
        <label htmlFor="game-code">Game code</label>
        <input
          id="game-code"
          value={gameCode}
          onChange={event => setGameCode(event.target.value)}
          required
          maxLength={6}
        />
        <button disabled={online.busy || !gameCode.trim()}>Join game</button>
      </form>
      <h3>Open games</h3>
      {online.rooms.length === 0
        ? <p>No open games.</p>
        : <ul>
            {online.rooms.map(game =>
              <li key={game.id}>
                {game.players[0].name}'s game ({game.players.length}/4)
                <button disabled={online.busy} onClick={() => void joinRoom(game.id)}>
                  Join {game.id}
                </button>
              </li>)}
          </ul>}
      <h3>Scores</h3>
      <table>
        <thead><tr><th>Player</th><th>Points</th><th>Rounds won</th></tr></thead>
        <tbody>
          {online.scores.map(entry =>
            <tr key={entry.id}>
              <td>{entry.name}</td>
              <td>{entry.score}</td>
              <td>{entry.wins}</td>
            </tr>)}
        </tbody>
      </table>
      {online.error && <p role="alert">{online.error}</p>}
      <button className="back" onClick={onBack}>Main menu</button>
    </section>
  }

  const room = online.room
  return <section>
    <p>Game code: <strong>{room.id}</strong></p>
    {!online.connected &&
      <p role="status">
        Connecting…
        <button onClick={() => setConnectionAttempt(connectionAttempt + 1)}>
          Reconnect
        </button>
      </p>}
    {room.status === 'WAITING' && <>
      <h2>Waiting for players</h2>
      <p>Share the code. Start with 2–4 players.</p>
      <ul>
        {room.players.map(member =>
          <li key={member.id}>
            {member.name} {member.id === room.hostId ? '(host)' : ''}
          </li>)}
      </ul>
      {online.player.id === room.hostId
        ? <button
            disabled={online.busy || !online.connected || room.players.length < 2}
            onClick={() => void startRound()}
          >
            Start round
          </button>
        : <p>Waiting for host.</p>}
    </>}
    {room.status === 'PLAYING' && room.board && <GameBoard state={room.board} busy={online.busy || !online.connected}
      onPlay={(index: number, color?: Color) => void act({ type: 'PLAY', index, color })}
      onDraw={() => void act({ type: 'DRAW' })} onPass={() => void act({ type: 'PASS' })}
      onUno={() => void act({ type: 'UNO' })} onCatch={accused => void act({ type: 'CATCH', accused })}
      onChallenge={() => void act({ type: 'CHALLENGE' })} onAccept={() => void act({ type: 'ACCEPT' })} />}
    {room.status === 'FINISHED' && <><h2>Round over</h2><p>{room.winner} won!</p><p>Round score: {room.score}</p></>}
    {room.status === 'CANCELLED' && <h2>Round cancelled</h2>}
    {room.status !== 'FINISHED' && <p role="status">{room.message}</p>}
    {room.status === 'PLAYING' && <p>Leaving cancels the round for everyone.</p>}
    <button disabled={online.busy} onClick={() => void leaveRoom()}>
      {room.status === 'FINISHED' || room.status === 'CANCELLED' ? 'Back to lobby' : 'Leave game'}
    </button>
    {online.error && <p role="alert">{online.error}</p>}
    {online.error && <button disabled={online.busy} onClick={clearAccount}>Back to login</button>}
  </section>
}
