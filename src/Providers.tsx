'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { makeStore, onlineActions, type AppStore } from './store'

export default function Providers({ children }: { children: ReactNode })
{
  const store = useRef<AppStore | null>(null)
  if (!store.current)
  {
    store.current = makeStore()
  }

  useEffect(() =>
  {
    store.current!.dispatch(onlineActions.setToken(sessionStorage.getItem('uno-token') ?? ''))
  }, [])

  return <Provider store={store.current}>{children}</Provider>
}
