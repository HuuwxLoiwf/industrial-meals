import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api.js';

export const fetchNotifications = createAsyncThunk('noti/fetch', async () => {
  const { data } = await api.get('/notifications');
  return data;
});

export const markAllRead = createAsyncThunk('noti/readAll', async () => {
  await api.patch('/notifications/read-all');
  return true;
});

const slice = createSlice({
  name: 'notifications',
  initialState: { items: [], unread: 0 },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.unread = action.payload.unread;
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.unread = 0;
        state.items = state.items.map((n) => ({ ...n, read: true }));
      });
  },
});

export default slice.reducer;
