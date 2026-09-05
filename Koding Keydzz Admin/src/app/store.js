import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
import { toastOnError } from './api/toastOnError';
import { toastOnSuccess } from './api/toastOnSuccess';
import { resetCacheOnIdentityChange } from './api/resetCacheOnIdentityChange';
import authReducer from '../features/auth/authSlice';
// Ensure endpoints are injected
import '../features/auth/authApi';
import '../features/admin/adminApi';
import '../features/superadmin/superadminApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  /**
   * `toastOnError` sits AFTER the api middleware.
   *
   * Order matters: the api middleware is what turns a failed request into a
   * `rejectedWithValue` action, so anything watching for those has to run
   * after it. Placed before, it would never see a single failure.
   */
  middleware: (getDefault) => getDefault().concat(
      baseApi.middleware,
      toastOnError,
      toastOnSuccess,
      // Must come after the api middleware so `resetApiState` reaches it.
      resetCacheOnIdentityChange
    ),
});
