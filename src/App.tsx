import { useState } from 'react'
import LocalGame from './components/LocalGame'
import OnlineGame from './components/OnlineGame'

export default function App()
{
  const [mode, setMode] = useState<'local' | 'online'>()

  return <main className="app">
    <h1>UNO</h1>
    {!mode && <section className="menu">
      <h2>Choose a game</h2>
      <button onClick={() => setMode('online')}>Play online</button>
      <button onClick={() => setMode('local')}>Play against bots</button>
    </section>}
    {mode === 'local' && <><LocalGame /><button className="back" onClick={() => setMode(undefined)}>Main menu</button></>}
    {mode === 'online' && <OnlineGame onBack={() => setMode(undefined)} />}
  </main>
}
