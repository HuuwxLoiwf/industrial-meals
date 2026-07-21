import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Sun, Moon, Check, X, Utensils, Info, CalendarDays, UserSearch } from 'lucide-react';
import {
  fetchShifts,
  fetchRegistrationsByDate,
  fetchMenu,
  registerMeal,
  cancelRegistration,
  registerManyDays,
} from '../store/registrationsSlice.js';
import api, { assetUrl } from '../lib/api.js';
import { PageTitle, Card, Button, StatusBadge, EmptyState, todayStr } from '../components/ui.jsx';

const CATEGORY_LABEL = {
  MAIN: 'Món chính',
  SIDE: 'Món phụ',
  DESSERT: 'Tráng miệng',
  ALTERNATIVE: 'Món cải tiến',
};

// Đăng ký suất ăn đơn lẻ — trường hợp đặc biệt (không thuộc lô nào).
// ADMIN chọn đích danh nhân viên rồi đăng ký hộ.
export default function RegisterMealPage() {
  const dispatch = useDispatch();
  const { shifts, byDate, menu } = useSelector((s) => s.registrations);
  const [date, setDate] = useState(todayStr());
  const [mealType, setMealType] = useState('STANDARD');
  const [employee, setEmployee] = useState(null); // { id, fullName, employeeCode }

  useEffect(() => {
    dispatch(fetchShifts());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchRegistrationsByDate(date));
    dispatch(fetchMenu(date));
  }, [dispatch, date]);

  // Đăng ký của nhân viên đang chọn, trong ngày đang chọn.
  const regByShift = {};
  if (employee) {
    for (const r of byDate) {
      if (r.employeeId === employee.id && r.mealDate?.slice(0, 10) === date) {
        regByShift[r.mealShiftId] = r;
      }
    }
  }
  const activeReg = Object.values(regByShift).find((r) => r.status !== 'CANCELLED');

  const handleToggle = async (shift) => {
    if (!employee) return alert('Chọn nhân viên trước');
    const existing = regByShift[shift.id];
    if (existing && existing.status !== 'CANCELLED') {
      if (!window.confirm(`Hủy suất ăn ca ${shift.startTime} - ${shift.endTime} của ${employee.fullName}?`)) return;
      await dispatch(cancelRegistration(existing.id));
    } else {
      const typeLabel = mealType === 'ALTERNATIVE' ? 'Suất cải tiến' : 'Suất thường';
      if (
        !window.confirm(
          `Xác nhận đăng ký suất ăn cho ${employee.fullName}?\n\nCa: ${shift.startTime} - ${shift.endTime}\nLoại: ${typeLabel}\nNgày: ${date}\n\nMỗi ngày chỉ được 1 suất.`
        )
      )
        return;
      const action = await dispatch(
        registerMeal({ employeeId: employee.id, mealShiftId: shift.id, mealDate: date, mealType })
      );
      if (action.error) alert(action.payload?.message || 'Đăng ký thất bại');
    }
    dispatch(fetchRegistrationsByDate(date));
  };

  const dayShifts = shifts.filter((s) => s.period === 'DAY');
  const nightShifts = shifts.filter((s) => s.period === 'NIGHT');

  const items = menu?.items || [];
  const grouped = items.reduce((acc, it) => {
    (acc[it.dish.category] ??= []).push(it.dish);
    return acc;
  }, {});

  return (
    <div>
      <PageTitle title="Đăng ký suất ăn đơn lẻ" subtitle="Trường hợp đặc biệt (không thuộc lô nào) — chọn nhân viên rồi đăng ký hộ">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
      </PageTitle>

      {/* Chọn nhân viên */}
      <Card className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <UserSearch size={18} className="text-black" />
          <h2 className="font-semibold text-black">Chọn nhân viên</h2>
        </div>
        <EmployeePicker value={employee} onChange={setEmployee} />
      </Card>

      {!employee ? (
        <EmptyState icon={UserSearch} title="Chưa chọn nhân viên" hint="Tìm và chọn 1 nhân viên để đăng ký suất ăn cho họ" />
      ) : (
        <>
          {/* Thực đơn trong ngày */}
          <Card className="mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Utensils size={18} className="text-black" />
              <h2 className="font-semibold text-black">Thực đơn ngày {date}</h2>
            </div>
            {items.length === 0 ? (
              <EmptyState icon={Utensils} title="Chưa có thực đơn" hint="Nhà ăn chưa lên thực đơn cho ngày này" />
            ) : (
              ['MAIN', 'SIDE', 'DESSERT', 'ALTERNATIVE'].map(
                (cat) =>
                  grouped[cat]?.length > 0 && (
                    <div key={cat} className="mb-5 last:mb-0">
                      <div className="text-xs font-mono uppercase tracking-wide text-black/40 mb-2.5">
                        {CATEGORY_LABEL[cat]}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {grouped[cat].map((dish) => (
                          <DishCard key={dish.id} dish={dish} />
                        ))}
                      </div>
                    </div>
                  )
              )
            )}
          </Card>

          {/* Chọn loại suất */}
          <Card className="mb-5">
            <h2 className="font-semibold text-black mb-3">Chọn loại suất khi đăng ký</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <MealTypeButton
                active={mealType === 'STANDARD'}
                onClick={() => setMealType('STANDARD')}
                title="Suất thường"
                desc="2 món chính + phụ + tráng miệng"
              />
              <MealTypeButton
                active={mealType === 'ALTERNATIVE'}
                onClick={() => setMealType('ALTERNATIVE')}
                title="Suất cải tiến"
                desc="Bún / miến thay 2 món chính"
              />
            </div>
          </Card>

          {activeReg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-block-cream text-black text-sm px-4 py-3">
              <Info size={18} className="shrink-0 mt-0.5" />
              <span>
                {employee.fullName} đã có 1 suất cho ngày này. Mỗi ngày chỉ được 1 suất — hủy suất hiện tại nếu muốn đổi ca.
              </span>
            </div>
          )}

          <ShiftGroup
            title="Ca ngày"
            subtitle="40 phút/suất"
            icon={Sun}
            shifts={dayShifts}
            regByShift={regByShift}
            onToggle={handleToggle}
            activeReg={activeReg}
          />
          <ShiftGroup
            title="Ca đêm"
            subtitle="45 phút/suất"
            icon={Moon}
            shifts={nightShifts}
            regByShift={regByShift}
            onToggle={handleToggle}
            activeReg={activeReg}
          />

          {shifts.length === 0 && (
            <EmptyState icon={Utensils} title="Chưa có ca ăn" hint="Vui lòng liên hệ quản trị viên" />
          )}

          {shifts.length > 0 && (
            <WeekRegister
              employee={employee}
              shifts={shifts}
              mealType={mealType}
              onDone={() => dispatch(fetchRegistrationsByDate(date))}
            />
          )}
        </>
      )}
    </div>
  );
}

// Ô tìm kiếm + chọn nhân viên (gọi API /employees với debounce đơn giản).
function EmployeePicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.get('/employees', { params: { search: query, pageSize: 8 } }).then((r) => setResults(r.data.data));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md ring-1 ring-black/15 bg-block-lime/30 px-4 py-2.5">
        <div>
          <div className="font-medium text-black">{value.fullName}</div>
          <div className="text-xs text-black/50">
            {value.employeeCode} {value.department?.name ? `· ${value.department.name}` : ''}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange(null)}>
          Đổi
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Tìm theo tên / mã NV / email..."
        className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
      />
      {open && results.length > 0 && (
        <div
          className="absolute z-10 mt-1 w-full bg-white rounded-md ring-1 ring-black/10 max-h-64 overflow-y-auto"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
        >
          {results.map((e) => (
            <button
              key={e.id}
              onClick={() => {
                onChange(e);
                setQuery('');
                setResults([]);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-surface-soft border-b border-black/5 last:border-0"
            >
              <div className="font-medium text-black text-sm">{e.fullName}</div>
              <div className="text-xs text-black/40">
                {e.employeeCode} {e.department?.name ? `· ${e.department.name}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Đăng ký nhanh 1 ca cho nhiều ngày tới (cả tuần) cho 1 nhân viên.
function WeekRegister({ employee, shifts, mealType, onDone }) {
  const dispatch = useDispatch();
  const [shiftId, setShiftId] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!shiftId) return alert('Chọn ca ăn');
    const dates = [];
    const base = new Date(todayStr() + 'T00:00:00.000Z');
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const shift = shifts.find((s) => s.id === shiftId);
    if (!window.confirm(`Đăng ký ca ${shift.startTime}-${shift.endTime} cho ${employee.fullName} trong ${days} ngày tới?`)) return;
    setBusy(true);
    try {
      const action = await dispatch(
        registerManyDays({ employeeId: employee.id, mealShiftId: shiftId, dates, mealType })
      );
      if (action.error) {
        alert(action.payload?.message || 'Đăng ký thất bại');
      } else {
        const r = action.payload;
        alert(`Đã đăng ký ${r.created} ngày. Bỏ qua/lỗi: ${r.skipped + (r.errors?.length || 0)}.`);
        onDone();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays size={18} className="text-black" />
        <h3 className="font-semibold text-black">Đăng ký nhanh nhiều ngày</h3>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-black/50 mb-1 block">Ca ăn</label>
          <select
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          >
            <option value="">— Chọn ca —</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.startTime}-{s.endTime})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-black/50 mb-1 block">Số ngày tới</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          >
            <option value={3}>3 ngày</option>
            <option value={5}>5 ngày</option>
            <option value={7}>7 ngày</option>
            <option value={14}>14 ngày</option>
          </select>
        </div>
        <Button onClick={submit} disabled={busy}>
          {busy ? 'Đang đăng ký...' : 'Đăng ký loạt'}
        </Button>
      </div>
      <p className="text-xs text-black/40 mt-2">
        Áp dụng loại suất đang chọn ở trên. Ngày đã có suất ca khác sẽ được bỏ qua.
      </p>
    </Card>
  );
}

function DishCard({ dish }) {
  const img = assetUrl(dish.imageUrl);
  return (
    <div className="w-32 text-center">
      <div className="h-24 w-32 rounded-lg overflow-hidden bg-surface-soft flex items-center justify-center ring-1 ring-black/10">
        {img ? (
          <img src={img} alt={dish.name} className="h-full w-full object-contain" />
        ) : (
          <Utensils size={26} className="text-black/25" />
        )}
      </div>
      <div className="text-xs mt-1.5 text-black/80 font-medium leading-tight">{dish.name}</div>
    </div>
  );
}

function MealTypeButton({ active, onClick, title, desc }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 text-left rounded-lg border p-3.5 transition ${
        active
          ? 'border-black bg-block-lime/40 ring-1 ring-black'
          : 'border-black/15 hover:border-black/30'
      }`}
    >
      <span
        className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          active ? 'border-black bg-black' : 'border-black/25'
        }`}
      >
        {active && <Check size={12} className="text-white" strokeWidth={3} />}
      </span>
      <span>
        <span className="block font-semibold text-black text-sm">{title}</span>
        <span className="block text-xs text-black/50 mt-0.5">{desc}</span>
      </span>
    </button>
  );
}

const TYPE_LABEL = { STANDARD: 'Suất thường', ALTERNATIVE: 'Suất cải tiến' };

function ShiftGroup({ title, subtitle, icon: Icon, shifts, regByShift, onToggle, activeReg }) {
  if (shifts.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-black/50" />
        <h3 className="font-semibold text-black">{title}</h3>
        <span className="text-xs text-black/40">· {subtitle}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shifts.map((shift) => {
          const reg = regByShift[shift.id];
          const active = reg && reg.status !== 'CANCELLED';
          const lockedByOther = activeReg && !active;
          return (
            <div
              key={shift.id}
              className={`flex items-center justify-between rounded-xl border p-4 transition ${
                active
                  ? 'border-black/30 bg-block-lime/20'
                  : lockedByOther
                  ? 'border-black/10 bg-surface-soft opacity-60'
                  : 'border-black/10 bg-white hover:border-black/30'
              }`}
            >
              <div>
                <div className="font-semibold text-black">
                  {shift.startTime} - {shift.endTime}
                </div>
                {active && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    <StatusBadge status={reg.status} />
                    <span className="text-xs text-black/50">{TYPE_LABEL[reg.mealType]}</span>
                  </div>
                )}
              </div>
              <Button variant={active ? 'danger' : 'primary'} onClick={() => onToggle(shift)} disabled={lockedByOther}>
                {active ? <X size={16} /> : <Check size={16} />}
                {active ? 'Hủy' : 'Đăng ký'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
