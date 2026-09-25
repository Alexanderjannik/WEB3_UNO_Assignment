import App from '../App'
import Providers from '../Providers'

export const dynamic = 'force-static'

export default function Home()
{
  return <main className="app">
    <h1>UNO</h1>
    <Providers>
      <App />
    </Providers>
  </main>
}
