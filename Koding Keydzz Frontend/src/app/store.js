import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from './api/baseApi'
import { toastOnError } from './api/toastOnError'
import { toastOnSuccess } from './api/toastOnSuccess'
import authReducer from '../features/auth/authSlice'
import avatarReducer from '../features/avatar/avatarSlice'

// Import API slices so their endpoints are injected/registered.
import '../features/auth/authApi'
import '../features/student/studentApi'
import '../features/avatar/avatarApi'
import '../features/shop/shopApi'
import '../features/quiz/quizApi'
import '../features/games/gamesApi'
import '../features/playground/playgroundApi'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    avatar: avatarReducer,
  },
  /**
   * `toastOnError` runs AFTER the api middleware, which is what turns a failed
   * request into a `rejectedWithValue` action. Placed before it, it would
   * never see a single failure.
   */
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware, toastOnError, toastOnSuccess),
})
