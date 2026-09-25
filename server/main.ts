import { startServer } from './index'

//#region Start server

const port = Number(process.env.PORT ?? 4000)

startServer(port, process.env.PLAYER_FILE ?? 'data/players.json').then(() =>
{
  console.log(`UNO server: http://localhost:${port}`)
}).catch(error =>
{
  console.error(error)
  process.exitCode = 1
})

//#endregion
