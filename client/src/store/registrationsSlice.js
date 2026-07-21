// State đăng ký suất ăn đơn lẻ (ADMIN đăng ký hộ nhân viên) + ca ăn.
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../lib/api.js';

export const fetchShifts = createAsyncThunk('reg/fetchShifts', async () => {
  const { data } = await api.get('/shifts');
  return data;
});

// Danh sách đăng ký đơn lẻ trong ngày (ADMIN xem tất cả để biết ai đã có suất).
export const fetchRegistrationsByDate = createAsyncThunk(
  'reg/fetchByDate',
  async (date) => {
    const { data } = await api.get('/registrations', { params: { date } });
    return data;
  }
);

export const fetchMenu = createAsyncThunk('reg/fetchMenu', async (date) => {
  const { data } = await api.get('/menus', { params: { date } });
  return data;
});

// ADMIN đăng ký hộ 1 nhân viên.
export const registerMeal = createAsyncThunk(
  'reg/register',
  async ({ employeeId, mealShiftId, mealDate, mealType }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/registrations', {
        employeeId,
        mealShiftId,
        mealDate,
        mealType,
      });
      return data;
    } catch (err) {
      return rejectWithValue({
        status: err.response?.status,
        message: err.response?.data?.message || 'Đăng ký thất bại',
      });
    }
  }
);

export const cancelRegistration = createAsyncThunk(
  'reg/cancel',
  async (id) => {
    const { data } = await api.patch(`/registrations/${id}/cancel`);
    return data;
  }
);

// Đăng ký 1 ca cho nhiều ngày (cả tuần) cho 1 nhân viên.
export const registerManyDays = createAsyncThunk(
  'reg/registerManyDays',
  async ({ employeeId, mealShiftId, dates, mealType }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/registrations/batch-days', {
        employeeId,
        mealShiftId,
        dates,
        mealType,
      });
      return data;
    } catch (err) {
      return rejectWithValue({ message: err.response?.data?.message || 'Đăng ký thất bại' });
    }
  }
);

const slice = createSlice({
  name: 'registrations',
  initialState: { shifts: [], byDate: [], menu: null, status: 'idle' },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShifts.fulfilled, (state, action) => {
        state.shifts = action.payload;
      })
      .addCase(fetchMenu.fulfilled, (state, action) => {
        state.menu = action.payload;
      })
      .addCase(fetchRegistrationsByDate.fulfilled, (state, action) => {
        state.byDate = action.payload;
      })
      .addCase(registerMeal.fulfilled, (state, action) => {
        const idx = state.byDate.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) state.byDate[idx] = action.payload;
        else state.byDate.unshift(action.payload);
      })
      .addCase(cancelRegistration.fulfilled, (state, action) => {
        const idx = state.byDate.findIndex((r) => r.id === action.payload.id);
        if (idx >= 0) state.byDate[idx] = { ...state.byDate[idx], ...action.payload };
      });
  },
});

export default slice.reducer;
