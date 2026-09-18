import { createClient } from 'graphql-ws'
import { readCard, type Card } from '../model/deck'
import type { RoomState } from '../model/online'

//#region Queries

export const roomFields = `
  id hostId status version message winner score
  players { id name score wins }
  board {
    players playerIndex handSizes drawPileSize currentColor currentDirection
    playerInTurn drawnCardIndex unoVulnerablePlayer playableCards
    hand { type color number }
    topCard { type color number }
  }
`

export async function request<T>(query: string, variables: Record<string, unknown> = {}, token = ''): Promise<T>
{
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) throw new Error('The server could not complete the request')

  const result = await response.json()
  if (result.errors?.length) throw new Error(result.errors[0].message)
  return result.data
}

export function readRoom(room: RoomState): RoomState
{
  function card(value: Card): Card
  {
    const fields = Object.fromEntries(Object.entries(value).filter(([key, value]) => value != null))
    return readCard(fields)
  }

  if (room.board)
  {
    room.board.hand = room.board.hand.map(card)
    room.board.topCard = card(room.board.topCard)
  }

  return room
}

//#endregion

//#region Live updates

export function watchRoom(
  id: string,
  token: string,
  update: (room: RoomState) => void,
  connection: (connected: boolean) => void,
  failed: (message: string) => void
): () => void
{
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const client = createClient({
    url: `${protocol}//${location.host}/graphql`,
    connectionParams: { token },
    retryAttempts: 5,
    on: { closed: () => connection(false) }
  })

  const unsubscribe = client.subscribe<{ roomChanged: RoomState }>({
    query: `subscription RoomChanged($id: ID!) { roomChanged(id: $id) { ${roomFields} } }`,
    variables: { id }
  }, {
    next: result =>
    {
      if (result.errors?.length)
      {
        failed(result.errors[0].message)
      }
      else if (result.data)
      {
        update(readRoom(result.data.roomChanged))
        connection(true)
      }
    },
    error: error =>
    {
      connection(false)
      failed(Array.isArray(error) ? error[0]?.message : 'Connection lost. Use Reconnect to try again.')
    },
    complete: () => connection(false)
  })

  return () =>
  {
    unsubscribe()
    void client.dispose()
  }
}

//#endregion
