import { configureStore } from '@reduxjs/toolkit';
import meReducer from './meSlice.js';
import registrationsReducer from './registrationsSlice.js';
import notificationsReducer from './notificationsSlice.js';

export const store = configureStore({
  reducer: {
    me: meReducer,
    registrations: registrationsReducer,
    notifications: notificationsReducer,
  },
});
