// State phiên đăng nhập: profile nhân viên + login/logout (JWT thuần).
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { setToken, getToken } from '../lib/api.js';
import { disconnectSocket } from '../lib/socket.js';

// Đăng nhập bằng email + mật khẩu.
export const login = createAsyncThunk(
  'me/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      return data.employee;
    } catch (err) {
      return rejectWithValue({
        status: err.response?.status,
        message: err.response?.data?.message || 'Đăng nhập thất bại',
      });
    }
  }
);

// Nạp hồ sơ khi đã có token (lần vào lại app).
export const fetchMe = createAsyncThunk('me/fetch', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/me');
    return data;
  } catch (err) {
    return rejectWithValue({
      status: err.response?.status,
      message: err.response?.data?.message || 'Không tải được hồ sơ',
    });
  }
});

const meSlice = createSlice({
  name: 'me',
  initialState: {
    profile: null,
    // 'idle' | 'loading' | 'succeeded' | 'failed'
    status: getToken() ? 'loading' : 'idle',
    error: null,
    errorStatus: null,
  },
  reducers: {
    logout: (state) => {
      setToken(null);
      disconnectSocket();
      state.profile = null;
      state.status = 'idle';
      state.error = null;
      state.errorStatus = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || 'Đăng nhập thất bại';
        state.errorStatus = action.payload?.status ?? null;
      })
      .addCase(fetchMe.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message || action.error.message;
        state.errorStatus = action.payload?.status ?? null;
      });
  },
});

export const { logout } = meSlice.actions;
export default meSlice.reducer;
