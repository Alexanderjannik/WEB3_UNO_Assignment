import { makeExecutableSchema } from '@graphql-tools/schema'
import type { PlayerAction, RoomState } from '../src/model/online'
import { PlayerStore } from './players'
import { GameStore } from './games'

//#region Schema

const typeDefs = `
  enum Color { BLUE GREEN RED YELLOW }
  enum ActionType { PLAY DRAW PASS UNO CATCH }
  enum RoomStatus { WAITING PLAYING FINISHED CANCELLED }

  type Player { id: ID!, name: String!, score: Int!, wins: Int! }
  type Login { token: String!, player: Player! }
  type Card { type: String!, color: Color, number: Int }
  type Board {
    players: [String!]!
    playerIndex: Int!
    hand: [Card!]!
    handSizes: [Int!]!
    topCard: Card!
    drawPileSize: Int!
    currentColor: Color!
    currentDirection: String!
    playerInTurn: Int
    drawnCardIndex: Int
    unoVulnerablePlayer: Int
    playableCards: [Int!]!
  }
  type Room {
    id: ID!
    hostId: ID!
    players: [Player!]!
    status: RoomStatus!
    version: Int!
    message: String!
    board: Board
    winner: String
    score: Int
  }
  input Action {
    type: ActionType!
    index: Int
    color: Color
    accused: Int
  }
  type Query {
    me: Player!
    rooms: [Room!]!
    currentRoom: Room
    room(id: ID!): Room!
    leaderboard: [Player!]!
  }
  type Mutation {
    register(name: String!, password: String!): Login!
    login(name: String!, password: String!): Login!
    logout: Boolean!
    createRoom: Room!
    joinRoom(id: ID!): Room!
    startRound(id: ID!): Room!
    leaveRoom(id: ID!): Boolean!
    act(id: ID!, version: Int!, action: Action!): Room!
  }
  type Subscription { roomChanged(id: ID!): Room! }
`

//#endregion

//#region Resolvers

export type Context = { token: string }

export function createSchema(players: PlayerStore, games: GameStore)
{
  const identify = (context: Context) => players.identify(context.token)

  return makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: {
        me: (parent: unknown, args: unknown, context: Context) => players.player(identify(context)),
        rooms: (parent: unknown, args: unknown, context: Context) =>
        {
          identify(context)
          return games.list()
        },
        currentRoom: (parent: unknown, args: unknown, context: Context) => games.current(identify(context)),
        room: (parent: unknown, { id }: { id: string }, context: Context) => games.get(id, identify(context)),
        leaderboard: (parent: unknown, args: unknown, context: Context) =>
        {
          identify(context)
          return players.leaderboard()
        }
      },
      Mutation: {
        register: (parent: unknown, { name, password }: { name: string; password: string }) => players.register(name, password),
        login: (parent: unknown, { name, password }: { name: string; password: string }) => players.login(name, password),
        logout: (parent: unknown, args: unknown, context: Context) =>
        {
          const player = identify(context)
          const room = games.current(player)
          if (room) games.leave(room.id, player)
          players.logout(context.token)
          return true
        },
        createRoom: (parent: unknown, args: unknown, context: Context) => games.create(identify(context)),
        joinRoom: (parent: unknown, { id }: { id: string }, context: Context) => games.join(id, identify(context)),
        startRound: (parent: unknown, { id }: { id: string }, context: Context) => games.start(id, identify(context)),
        leaveRoom: (parent: unknown, { id }: { id: string }, context: Context) => games.leave(id, identify(context)),
        act: (parent: unknown, args: { id: string; version: number; action: PlayerAction }, context: Context) =>
          games.act(args.id, identify(context), args.version, args.action)
      },
      Subscription: {
        roomChanged: {
          subscribe: (parent: unknown, { id }: { id: string }, context: Context) => games.watch(id, identify(context)),
          resolve: (room: RoomState, args: unknown, context: Context) =>
          {
            identify(context)
            return room
          }
        }
      }
    }
  })
}

//#endregion
