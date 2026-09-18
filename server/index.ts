import { createServer } from 'node:http'
import { resolve } from 'node:path'
import express from 'express'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@as-integrations/express5'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/use/ws'
import { PlayerStore } from './players'
import { GameStore } from './games'
import { createSchema, type Context } from './schema'

//#region Server

export async function startServer(port = 4000, filename = 'data/players.json')
{
  const players = new PlayerStore(filename)
  const games = new GameStore(players)
  const schema = createSchema(players, games)
  const app = express()
  const httpServer = createServer(app)
  const sockets = new WebSocketServer({ server: httpServer, path: '/graphql' })
  const subscriptions = useServer({
    schema,
    context: context => ({ token: String(context.connectionParams?.token ?? '') })
  }, sockets)

  const apollo = new ApolloServer<Context>({
    schema,
    includeStacktraceInErrorResponses: false,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart()
        {
          return { async drainServer() { await subscriptions.dispose() } }
        }
      }
    ]
  })

  await apollo.start()
  app.use('/graphql', express.json({ limit: '32kb' }), expressMiddleware(apollo, {
    context: async ({ req }) => ({ token: req.headers.authorization?.replace(/^Bearer /, '') ?? '' })
  }))
  app.use(express.static(resolve('dist')))

  await new Promise<void>((resolve, reject) =>
  {
    httpServer.once('error', reject)
    httpServer.listen(port, resolve)
  })

  return { httpServer, apollo }
}

//#endregion
