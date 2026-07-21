import { useEffect, useState, useCallback } from 'react';
import { Utensils, ThumbsUp, ThumbsDown, ImagePlus } from 'lucide-react';
import api, { assetUrl } from '../lib/api.js';
import { PageTitle, Card, Button, EmptyState, todayStr } from '../components/ui.jsx';

const CATEGORIES = [
  { value: 'MAIN', label: 'Món chính' },
  { value: 'SIDE', label: 'Món phụ' },
  { value: 'DESSERT', label: 'Tráng miệng' },
  { value: 'ALTERNATIVE', label: 'Món cải tiến' },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

export default function MenuAdminPage() {
  const [tab, setTab] = useState('quick');
  return (
    <div>
      <PageTitle title="Quản lý thực đơn" subtitle="Lên thực đơn cả tháng & quản lý món ăn" />
      <div className="flex gap-2 mb-4 flex-wrap">
        <TabBtn active={tab === 'quick'} onClick={() => setTab('quick')}>
          ⚡ Lên thực đơn nhanh
        </TabBtn>
        <TabBtn active={tab === 'month'} onClick={() => setTab('month')}>
          Lịch tháng
        </TabBtn>
        <TabBtn active={tab === 'menu'} onClick={() => setTab('menu')}>
          Thực đơn 1 ngày
        </TabBtn>
        <TabBtn active={tab === 'dishes'} onClick={() => setTab('dishes')}>
          Kho món ăn
        </TabBtn>
        <TabBtn active={tab === 'votes'} onClick={() => setTab('votes')}>
          Bình chọn món
        </TabBtn>
        <TabBtn active={tab === 'ingredients'} onClick={() => setTab('ingredients')}>
          Nguyên liệu
        </TabBtn>
      </div>
      {tab === 'quick' && <QuickMenuTab />}
      {tab === 'month' && <MonthCalendarTab />}
      {tab === 'menu' && <DailyMenuTab />}
      {tab === 'dishes' && <DishesTab />}
      {tab === 'votes' && <DishVotesTab />}
      {tab === 'ingredients' && <IngredientsTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-pill text-sm font-medium ${
        active ? 'bg-black text-white' : 'bg-white ring-1 ring-black/15 text-black/60 hover:text-black'
      }`}
    >
      {children}
    </button>
  );
}

// ---------- Lên thực đơn nhanh cả ngày ----------
// 5 slot cố định theo cơ cấu bữa ăn: 2 món chính, 1 phụ, 1 tráng miệng, 1 cải tiến.
// Mỗi slot: chọn món có sẵn HOẶC nhập tên món mới kèm ảnh — lưu 1 lần duy nhất.
const QUICK_SLOTS = [
  { key: 'main1', category: 'MAIN', label: 'Món chính A', surface: 'bg-block-lime' },
  { key: 'main2', category: 'MAIN', label: 'Món chính B', surface: 'bg-block-lilac' },
  { key: 'side', category: 'SIDE', label: 'Món phụ', surface: 'bg-block-mint' },
  { key: 'dessert', category: 'DESSERT', label: 'Tráng miệng', surface: 'bg-block-pink' },
  { key: 'alt', category: 'ALTERNATIVE', label: 'Món cải tiến', surface: 'bg-block-cream' },
];

function QuickMenuTab() {
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [dishes, setDishes] = useState([]);
  const [slots, setSlots] = useState(() =>
    Object.fromEntries(QUICK_SLOTS.map((s) => [s.key, { mode: 'new', dishId: '', name: '', description: '', file: null, preview: null }]))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/dishes').then((r) => setDishes(r.data));
  }, []);

  // Nạp sẵn thực đơn đã có của ngày (nếu có) để sửa thay vì nhập lại từ đầu.
  useEffect(() => {
    api.get('/menus', { params: { date } }).then((r) => {
      const items = r.data.items || [];
      setNote(r.data.note || '');
      const next = Object.fromEntries(
        QUICK_SLOTS.map((s) => [s.key, { mode: 'new', dishId: '', name: '', description: '', file: null, preview: null }])
      );
      const mains = items.filter((i) => i.dish.category === 'MAIN').map((i) => i.dish);
      const bySlot = {
        main1: mains[0],
        main2: mains[1],
        side: items.find((i) => i.dish.category === 'SIDE')?.dish,
        dessert: items.find((i) => i.dish.category === 'DESSERT')?.dish,
        alt: items.find((i) => i.dish.category === 'ALTERNATIVE')?.dish,
      };
      for (const [key, dish] of Object.entries(bySlot)) {
        if (dish) next[key] = { mode: 'existing', dishId: dish.id, name: '', description: '', file: null, preview: null };
      }
      setSlots(next);
    });
  }, [date]);

  const setSlot = (key, patch) => setSlots((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const pickImage = (key, file) => {
    if (!file) return;
    setSlot(key, { file, preview: URL.createObjectURL(file) });
  };

  const isPast = date < todayStr();

  const save = async () => {
    if (isPast) return;
    const payload = [];
    for (const s of QUICK_SLOTS) {
      const v = slots[s.key];
      if (v.mode === 'existing') {
        if (v.dishId) payload.push({ key: s.key, category: s.category, dishId: v.dishId });
      } else if (v.name.trim()) {
        payload.push({ key: s.key, category: s.category, name: v.name.trim(), description: v.description });
      }
    }
    if (payload.length === 0) return alert('Chưa nhập món nào');

    setSaving(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('date', date);
      fd.append('note', note);
      fd.append('slots', JSON.stringify(payload));
      for (const s of QUICK_SLOTS) {
        const v = slots[s.key];
        if (v.mode === 'new' && v.name.trim() && v.file) fd.append(`image_${s.key}`, v.file);
      }
      const res = await api.post('/menus/quick-setup', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg(`✓ Đã lưu thực đơn ngày ${date} (${res.data.menu.items.length} món)`);
      // Nạp lại danh sách món để các món mới xuất hiện trong dropdown.
      api.get('/dishes').then((r) => setDishes(r.data));
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Lưu thực đơn thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <input
          type="date"
          value={date}
          min={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú thực đơn (tùy chọn)..."
          className="flex-1 min-w-[200px] ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <Button onClick={save} disabled={saving || isPast}>
          {saving ? 'Đang lưu...' : 'Lưu thực đơn cả ngày'}
        </Button>
      </div>
      <p className="text-xs text-black/50 mb-5">
        Nhập cả 5 món một lần. Mỗi ô: gõ tên món mới kèm ảnh, hoặc chọn lại món đã có trong kho.
        {isPast && <span className="text-black font-medium"> — Không thể sửa ngày đã qua.</span>}
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger">
        {QUICK_SLOTS.map((s) => (
          <QuickSlotCard
            key={s.key}
            slot={s}
            value={slots[s.key]}
            dishes={dishes.filter((d) => d.category === s.category)}
            onChange={(patch) => setSlot(s.key, patch)}
            onPickImage={(file) => pickImage(s.key, file)}
          />
        ))}
      </div>

      {msg && <div className="mt-4 bg-block-lime text-black text-sm rounded-md px-4 py-3">{msg}</div>}
    </Card>
  );
}

function QuickSlotCard({ slot, value, dishes, onChange, onPickImage }) {
  const selectedDish = value.mode === 'existing' ? dishes.find((d) => d.id === value.dishId) : null;
  const previewUrl = value.preview || (selectedDish ? assetUrl(selectedDish.imageUrl) : null);

  return (
    <div className={`${slot.surface} rounded-lg p-4`}>
      <div className="font-eyebrow text-xs text-black/55 mb-3">{slot.label}</div>

      {/* Chuyển giữa: món mới / chọn món có sẵn */}
      <div className="inline-flex items-center gap-1 p-0.5 bg-white/60 rounded-pill mb-3">
        <button
          type="button"
          onClick={() => onChange({ mode: 'new' })}
          className={`px-3 py-1 rounded-pill text-xs font-medium transition ${value.mode === 'new' ? 'bg-black text-white' : 'text-black/60'}`}
        >
          Món mới
        </button>
        <button
          type="button"
          onClick={() => onChange({ mode: 'existing' })}
          className={`px-3 py-1 rounded-pill text-xs font-medium transition ${value.mode === 'existing' ? 'bg-black text-white' : 'text-black/60'}`}
        >
          Món có sẵn
        </button>
      </div>

      {/* Khung ảnh + nút chọn ảnh */}
      <label className={`block h-32 rounded-md bg-white/70 ring-1 ring-black/10 overflow-hidden flex items-center justify-center mb-3 ${value.mode === 'new' ? 'cursor-pointer hover:ring-black/30' : ''} transition`}>
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="text-center text-black/35">
            <ImagePlus size={26} className="mx-auto" />
            <div className="text-xs mt-1">{value.mode === 'new' ? 'Bấm để thêm ảnh' : 'Chưa chọn món'}</div>
          </div>
        )}
        {value.mode === 'new' && (
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files[0])} />
        )}
      </label>

      {value.mode === 'new' ? (
        <>
          <input
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Tên món..."
            className="w-full bg-white ring-1 ring-black/10 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition mb-2"
          />
          <input
            value={value.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Mô tả ngắn (tùy chọn)"
            className="w-full bg-white ring-1 ring-black/10 rounded-md px-3 py-2 text-xs focus:ring-2 focus:ring-black focus:outline-none transition"
          />
        </>
      ) : (
        <select
          value={value.dishId}
          onChange={(e) => onChange({ dishId: e.target.value })}
          className="w-full bg-white ring-1 ring-black/10 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        >
          <option value="">— Chọn món —</option>
          {dishes.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ---------- Helpers ngày tháng ----------
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
// Trả về danh sách ô lịch (gồm padding đầu tháng) cho 1 tháng "YYYY-MM".
function buildCalendar(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // getUTCDay: 0=CN..6=T7 -> đổi sang 0=T2..6=CN
  const startPad = (first.getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(ymd(new Date(Date.UTC(y, m - 1, day))));
  }
  return cells;
}

// ---------- Lịch tháng ----------
function MonthCalendarTab() {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [byDate, setByDate] = useState({});
  const [editDate, setEditDate] = useState(null); // ngày đang mở modal

  const load = useCallback(async () => {
    const res = await api.get('/menus/month', { params: { month } });
    setByDate(res.data.byDate || {});
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const cells = buildCalendar(month);
  const todayKey = todayStr();
  const totalPlanned = Object.keys(byDate).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <span className="text-sm text-black/50">
          Đã lên thực đơn: <b className="text-black">{totalPlanned}</b> ngày
        </span>
        <span className="text-xs text-black/40 ml-auto">
          Bấm vào 1 ngày để chọn món / sao chép
        </span>
      </div>

      {/* Tiêu đề thứ */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-black/40">
            {w}
          </div>
        ))}
      </div>

      {/* Lưới ngày */}
      <div className="grid grid-cols-7 gap-2">
        {cells.map((key, i) => {
          if (!key) return <div key={i} />;
          const dayNum = Number(key.slice(8));
          const menu = byDate[key];
          const count = menu?.dishes?.length || 0;
          const isToday = key === todayKey;
          const isPast = key < todayKey; // ngày quá khứ -> không cho chỉnh
          return (
            <button
              key={key}
              onClick={() => !isPast && setEditDate(key)}
              disabled={isPast}
              className={`min-h-20 rounded-xl ring-1 p-2 text-left transition ${
                isPast
                  ? 'ring-black/5 bg-surface-soft opacity-50 cursor-not-allowed'
                  : 'hover:ring-black/30'
              } ${
                count > 0 && !isPast
                  ? 'ring-black/15 bg-block-lime/40'
                  : 'ring-black/10 bg-white'
              } ${isToday ? 'ring-2 ring-black' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${isToday ? 'text-black' : 'text-black/70'}`}>
                  {dayNum}
                </span>
                {count > 0 && (
                  <span className="text-[10px] bg-black text-white rounded-full px-1.5 py-0.5">
                    {count} món
                  </span>
                )}
              </div>
              {count > 0 ? (
                <div className="mt-1 text-[11px] text-black/50 leading-tight line-clamp-3">
                  {menu.dishes.slice(0, 3).map((d) => d.name).join(', ')}
                  {count > 3 ? '...' : ''}
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-black/30">Chưa có</div>
              )}
            </button>
          );
        })}
      </div>

      {editDate && (
        <DayEditorModal
          date={editDate}
          month={month}
          onClose={() => setEditDate(null)}
          onSaved={() => {
            setEditDate(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

// ---------- Modal chọn món cho 1 ngày + copy sang nhiều ngày ----------
function DayEditorModal({ date, month, onClose, onSaved }) {
  const [dishes, setDishes] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyTargets, setCopyTargets] = useState(new Set());

  useEffect(() => {
    (async () => {
      const [dishesRes, menuRes] = await Promise.all([
        api.get('/dishes'),
        api.get('/menus', { params: { date } }),
      ]);
      setDishes(dishesRes.data);
      setSelected(new Set((menuRes.data.items || []).map((i) => i.dish.id)));
      setNote(menuRes.data.note || '');
    })();
  }, [date]);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/menus', { date, dishIds: [...selected], note });
      if (showCopy && copyTargets.size > 0) {
        await api.post('/menus/copy', { fromDate: date, toDates: [...copyTargets] });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const byCat = CATEGORIES.map((c) => ({
    ...c,
    dishes: dishes.filter((d) => d.category === c.value),
  }));

  // Các ngày trong tháng để chọn copy (trừ ngày hiện tại).
  const copyCells = buildCalendar(month).filter((k) => k && k !== date);

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg ring-1 ring-black/10 w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 sticky top-0 bg-white">
          <div>
            <h3 className="font-semibold text-black">Thực đơn ngày</h3>
            <p className="text-sm text-black/50 capitalize">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-black/40 hover:text-black text-xl">
            ✕
          </button>
        </div>

        <div className="p-5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ghi chú thực đơn..."
            className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition mb-4"
          />

          {byCat.map((c) => (
            <div key={c.value} className="mb-4">
              <div className="text-xs font-mono uppercase tracking-wide text-black/40 mb-2">{c.label}</div>
              <div className="flex flex-wrap gap-2">
                {c.dishes.map((d) => {
                  const on = selected.has(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggle(d.id)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                        on ? 'ring-2 ring-black bg-block-lime/50' : 'ring-1 ring-black/15'
                      }`}
                    >
                      <DishThumb dish={d} small />
                      {d.name}
                    </button>
                  );
                })}
                {c.dishes.length === 0 && (
                  <span className="text-black/40 text-sm">Chưa có món loại này</span>
                )}
              </div>
            </div>
          ))}

          {/* Khu vực copy sang nhiều ngày */}
          <div className="border-t border-black/10 pt-4 mt-2">
            <label className="flex items-center gap-2 text-sm font-medium text-black/70">
              <input
                type="checkbox"
                checked={showCopy}
                onChange={(e) => setShowCopy(e.target.checked)}
              />
              Sao chép thực đơn này sang các ngày khác
            </label>
            {showCopy && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setCopyTargets(new Set(copyCells))}
                    className="text-xs text-black underline"
                  >
                    Chọn tất cả ngày
                  </button>
                  <button
                    onClick={() => setCopyTargets(new Set())}
                    className="text-xs text-black/40 underline"
                  >
                    Bỏ chọn
                  </button>
                  <span className="text-xs text-black/40 ml-auto">
                    Đã chọn {copyTargets.size} ngày
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {copyCells.map((k) => {
                    const on = copyTargets.has(k);
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          const next = new Set(copyTargets);
                          next.has(k) ? next.delete(k) : next.add(k);
                          setCopyTargets(next);
                        }}
                        className={`text-xs rounded py-1 ${
                          on ? 'bg-black text-white' : 'bg-surface-soft text-black/60'
                        }`}
                      >
                        {Number(k.slice(8))}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/10 sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Thực đơn ngày ----------
function DailyMenuTab() {
  const [date, setDate] = useState(todayStr());
  const [dishes, setDishes] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const [dishesRes, menuRes] = await Promise.all([
      api.get('/dishes'),
      api.get('/menus', { params: { date } }),
    ]);
    setDishes(dishesRes.data);
    setSelected(new Set((menuRes.data.items || []).map((i) => i.dish.id)));
    setNote(menuRes.data.note || '');
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    setSaved(false);
  };

  const isPast = date < todayStr();

  const save = async () => {
    if (isPast) return;
    await api.put('/menus', { date, dishIds: [...selected], note });
    setSaved(true);
  };

  const byCat = CATEGORIES.map((c) => ({
    ...c,
    dishes: dishes.filter((d) => d.category === c.value),
  }));

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          value={date}
          min={todayStr()}
          onChange={(e) => {
            setDate(e.target.value);
            setSaved(false);
          }}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú thực đơn..."
          className="flex-1 ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <Button onClick={save} disabled={isPast}>Lưu thực đơn</Button>
        {isPast && <span className="text-xs px-2 py-0.5 rounded-full bg-block-coral text-black">Không thể sửa ngày đã qua</span>}
        {saved && !isPast && <span className="text-semantic-success text-sm">✓ Đã lưu</span>}
      </div>

      {byCat.map((c) => (
        <div key={c.value} className="mb-4">
          <div className="text-xs font-mono uppercase tracking-wide text-black/40 mb-2">{c.label}</div>
          <div className="flex flex-wrap gap-2">
            {c.dishes.map((d) => {
              const on = selected.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                    on ? 'ring-2 ring-black bg-block-lime/50' : 'ring-1 ring-black/15'
                  }`}
                >
                  <DishThumb dish={d} small />
                  {d.name}
                </button>
              );
            })}
            {c.dishes.length === 0 && (
              <span className="text-black/40 text-sm">Chưa có món loại này</span>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ---------- Nguyên liệu ----------
function IngredientsTab() {
  const [date, setDate] = useState(todayStr());
  const [shopping, setShopping] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [editDish, setEditDish] = useState(null);

  const loadShopping = useCallback(() => {
    api.get('/ingredients/shopping-list', { params: { date } }).then((r) => setShopping(r.data));
  }, [date]);

  useEffect(() => {
    loadShopping();
  }, [loadShopping]);
  useEffect(() => {
    api.get('/dishes').then((r) => setDishes(r.data));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          />
          {shopping && (
            <span className="text-sm text-black/50">
              {shopping.totalStandard} suất thường · {shopping.totalAlternative} suất cải tiến
            </span>
          )}
        </div>
        <h3 className="font-semibold text-black mb-3">Nguyên liệu cần chuẩn bị</h3>
        {!shopping || shopping.ingredients.length === 0 ? (
          <EmptyState
            icon={Utensils}
            title="Chưa tính được nguyên liệu"
            hint="Cần có thực đơn + số suất đã báo + định lượng nguyên liệu cho món"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft text-black/60 text-left">
                <tr>
                  <th className="px-4 py-2.5">Nguyên liệu</th>
                  <th className="px-4 py-2.5 text-right">Tổng cần</th>
                  <th className="px-4 py-2.5">Đơn vị</th>
                </tr>
              </thead>
              <tbody>
                {shopping.ingredients.map((ing, i) => (
                  <tr key={i} className="border-t border-black/10">
                    <td className="px-4 py-2.5 font-medium text-black">{ing.name}</td>
                    <td className="px-4 py-2.5 text-right">{ing.quantity.toLocaleString('vi-VN')}</td>
                    <td className="px-4 py-2.5 text-black/60">{ing.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shopping?.missingIngredientDishes?.length > 0 && (
          <div className="mt-3 text-xs text-black/70 bg-block-cream rounded-md px-3 py-2">
            ⚠ Chưa khai báo nguyên liệu cho món: {shopping.missingIngredientDishes.join(', ')}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-black mb-1">Định lượng nguyên liệu theo món</h3>
        <p className="text-xs text-black/60 mb-3">Khai báo định lượng cho 1 suất — hệ thống tự nhân với số suất đã báo.</p>
        <div className="flex flex-wrap gap-2">
          {dishes.map((d) => (
            <button
              key={d.id}
              onClick={() => setEditDish(d)}
              className="flex items-center gap-2 rounded-lg ring-1 ring-black/15 px-2 py-1.5 text-sm hover:ring-black/30 transition"
            >
              <DishThumb dish={d} small />
              {d.name}
            </button>
          ))}
        </div>
      </Card>

      {editDish && (
        <IngredientEditorModal
          dish={editDish}
          onClose={() => setEditDish(null)}
          onSaved={() => {
            setEditDish(null);
            loadShopping();
          }}
        />
      )}
    </div>
  );
}

function IngredientEditorModal({ dish, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/ingredients/dish/${dish.id}`).then((r) => setRows(r.data.length ? r.data : [{ name: '', quantity: '', unit: 'g' }]));
  }, [dish.id]);

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { name: '', quantity: '', unit: 'g' }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      const ingredients = rows
        .filter((r) => (r.name || '').trim())
        .map((r) => ({ name: r.name.trim(), quantity: Number(r.quantity) || 0, unit: r.unit || 'g' }));
      await api.put(`/ingredients/dish/${dish.id}`, { ingredients });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade" onClick={onClose}>
      <div className="bg-white rounded-lg ring-1 ring-black/10 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-black/10">
          <h3 className="font-semibold text-black">Nguyên liệu: {dish.name}</h3>
          <p className="text-xs text-black/50">Định lượng cho 1 suất</p>
        </div>
        <div className="p-5 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={r.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="Tên nguyên liệu"
                className="flex-1 ring-1 ring-black/15 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
              <input
                type="number"
                min="0"
                value={r.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
                placeholder="SL"
                className="w-20 ring-1 ring-black/15 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
              <input
                value={r.unit}
                onChange={(e) => setRow(i, { unit: e.target.value })}
                placeholder="đv"
                className="w-16 ring-1 ring-black/15 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
              <button onClick={() => removeRow(i)} className="text-black/40 hover:text-black text-lg px-1">✕</button>
            </div>
          ))}
          <button onClick={addRow} className="text-sm text-black hover:underline">+ Thêm nguyên liệu</button>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-black/10">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Bình chọn món ăn ----------
function DishVotesTab() {
  const [date, setDate] = useState(todayStr());
  const [stats, setStats] = useState([]);

  useEffect(() => {
    api.get('/dish-votes/stats', { params: { date } }).then((r) => setStats(r.data));
  }, [date]);

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <span className="text-xs text-black/40">
          Xếp hạng theo mức độ được yêu thích (thích - không thích), giúp điều chỉnh thực đơn.
        </span>
      </div>

      {stats.length === 0 ? (
        <EmptyState icon={Utensils} title="Chưa có món nào để bình chọn" hint="Ngày này chưa lên thực đơn" />
      ) : (
        <div className="space-y-2 stagger">
          {stats.map((s) => {
            const total = s.liked + s.disliked;
            const likePct = total > 0 ? Math.round((s.liked / total) * 100) : 0;
            return (
              <div key={s.dish.id} className="flex items-center gap-3 rounded-lg border border-black/10 px-4 py-2.5">
                <DishThumb dish={s.dish} small />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-black text-sm truncate">{s.dish.name}</div>
                  {total > 0 && (
                    <div className="h-1.5 rounded-full bg-block-coral/50 mt-1.5 overflow-hidden">
                      <div className="h-full bg-block-lime" style={{ width: `${likePct}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm shrink-0">
                  <span className="flex items-center gap-1 text-black"><ThumbsUp size={14} /> {s.liked}</span>
                  <span className="flex items-center gap-1 text-black/50"><ThumbsDown size={14} /> {s.disliked}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------- Kho món ăn ----------
function DishesTab() {
  const [dishes, setDishes] = useState([]);
  const [form, setForm] = useState({ name: '', category: 'MAIN', description: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/dishes').then((r) => setDishes(r.data));
  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('category', form.category);
      fd.append('description', form.description);
      if (file) fd.append('image', file);
      await api.post('/dishes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm({ name: '', category: 'MAIN', description: '' });
      setFile(null);
      e.target.reset();
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Ẩn món này khỏi danh sách?')) return;
    await api.delete(`/dishes/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-black mb-3">Thêm món ăn mới</h3>
        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Tên món"
            className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            className="text-sm"
          />
          <Button type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Thêm món'}
          </Button>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 stagger">
        {dishes.map((d) => (
          <DishItem key={d.id} dish={d} onChanged={load} onRemove={() => remove(d.id)} />
        ))}
      </div>
    </div>
  );
}

// Một món trong kho: hiển thị ảnh (hoặc placeholder + nhắc thiếu ảnh), cho upload ảnh.
function DishItem({ dish, onChanged, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const hasImage = !!dish.imageUrl;

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', dish.name);
      fd.append('category', dish.category);
      fd.append('description', dish.description || '');
      fd.append('image', file);
      await api.put(`/dishes/${dish.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChanged();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className={`flex flex-col ${!hasImage ? 'ring-2 ring-block-coral/60' : ''}`}>
      <DishThumb dish={dish} />
      <div className="mt-2 font-medium text-black text-sm">{dish.name}</div>
      <div className="text-xs text-black/40 font-mono uppercase tracking-wide">{CAT_LABEL[dish.category]}</div>

      {!hasImage && (
        <div className="mt-1 text-[11px] text-black/70">⚠ Chưa có ảnh</div>
      )}

      <label className="mt-2 inline-block cursor-pointer text-xs text-black hover:underline">
        {uploading ? 'Đang tải...' : hasImage ? 'Đổi ảnh' : 'Thêm ảnh'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => uploadImage(e.target.files[0])}
        />
      </label>

      <Button variant="danger" className="mt-2 self-start" onClick={onRemove}>
        Xóa
      </Button>
    </Card>
  );
}

function DishThumb({ dish, small }) {
  const img = assetUrl(dish.imageUrl);
  const size = small ? 'h-8 w-8' : 'h-28 w-full';
  return (
    <div className={`${size} rounded-lg overflow-hidden bg-surface-soft flex items-center justify-center ring-1 ring-black/10`}>
      {img ? (
        <img src={img} alt={dish.name} className="h-full w-full object-contain" />
      ) : (
        <Utensils size={small ? 14 : 28} className="text-black/25" />
      )}
    </div>
  );
}
