import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from './api/baseApi';
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
  middleware: (getDefault) => getDefault().concat(baseApi.middleware),
});
