import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createRound, type Round } from './model/round'
import type { Player, RoomState } from './model/online'

//#region Local game

type LocalState = {
  round?: Round
  message: string
}

const initialLocalState: LocalState = { message: '' }

const localSlice = createSlice({
  name: 'local',
  initialState: initialLocalState,
  reducers: {
    startLocalGame(_state, action: PayloadAction<{ players: string[]; dealer: number }>): LocalState
    {
      return { round: createRound(action.payload.players, action.payload.dealer), message: '' }
    },
    updateLocalRound(_state, action: PayloadAction<{ round: Round; message: string }>): LocalState
    {
      return action.payload
    },
    stopLocalGame(): LocalState
    {
      return initialLocalState
    },
    setLocalMessage(state, action: PayloadAction<string>): LocalState
    {
      return { ...state, message: action.payload }
    }
  }
})

//#endregion

//#region Online game

type OnlineState = {
  token: string
  player?: Player
  room?: RoomState
  rooms: RoomState[]
  scores: Player[]
  connected: boolean
  busy: boolean
  error: string
}

const initialOnlineState: OnlineState = {
  token: '',
  rooms: [], scores: [], connected: false, busy: false, error: ''
}

const onlineSlice = createSlice({
  name: 'online',
  initialState: initialOnlineState,
  reducers: {
    setToken(state, action: PayloadAction<string>): OnlineState
    {
      return { ...state, token: action.payload }
    },
    setAccount(state, action: PayloadAction<{ token: string; player: Player }>): OnlineState
    {
      return { ...state, token: action.payload.token, player: action.payload.player, error: '' }
    },
    setLobby(state, action: PayloadAction<{ rooms: RoomState[]; scores: Player[] }>): OnlineState
    {
      return { ...state, rooms: action.payload.rooms, scores: action.payload.scores }
    },
    setRoom(state, action: PayloadAction<RoomState | undefined>): OnlineState
    {
      return { ...state, room: action.payload }
    },
    updateRoom(state, action: PayloadAction<RoomState>): OnlineState
    {
      const next = action.payload
      if (state.room && state.room.id === next.id && next.version < state.room.version) return state
      return { ...state, room: next }
    },
    setConnected(state, action: PayloadAction<boolean>): OnlineState
    {
      return { ...state, connected: action.payload }
    },
    setBusy(state, action: PayloadAction<boolean>): OnlineState
    {
      return { ...state, busy: action.payload }
    },
    setError(state, action: PayloadAction<string>): OnlineState
    {
      return { ...state, error: action.payload }
    },
    clearAccount(state): OnlineState
    {
      return { ...initialOnlineState, token: '', busy: state.busy }
    }
  }
})

//#endregion

export const localActions = localSlice.actions
export const onlineActions = onlineSlice.actions

export function makeStore()
{
  return configureStore({
    reducer: { local: localSlice.reducer, online: onlineSlice.reducer },
    middleware: getDefaultMiddleware => getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['local/updateLocalRound'],
        ignoredPaths: ['local.round']
      }
    })
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
