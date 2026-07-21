import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Users, Moon, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../lib/api.js';
import { PageTitle, Card, Button, Tabs, todayStr } from '../components/ui.jsx';

const WEEKDAY_LABEL = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };
const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7];

// Leader/quản lý ca báo TỔNG SỐ suất cho 1 ca để nhà ăn chuẩn bị — không cần
// quét mã hay xác nhận phát, nhà ăn phát khay trực tiếp theo số đã đăng ký.
// 2 loại lô: NORMAL (suất thường, gồm cả NV chính thức tăng ca) và
// OVERTIME_INTERN (báo thêm suất tăng ca cho thực tập sinh).
export default function BatchRegisterPage() {
  const role = useSelector((s) => s.me.profile?.role);
  const isAdmin = role === 'ADMIN';
  const [date, setDate] = useState(todayStr());
  const [batchType, setBatchType] = useState('NORMAL');
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState({ mealShiftId: '', departmentId: '', qtyStandard: '', qtyAlternative: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const loadBatches = useCallback(async () => {
    const res = await api.get('/batches/mine', { params: { date } });
    setBatches(res.data);
  }, [date]);

  useEffect(() => {
    api.get('/shifts').then((r) => setShifts(r.data));
    // ADMIN cần danh sách phòng ban để chọn đích danh khi báo lô.
    if (isAdmin) api.get('/departments').then((r) => setDepartments(r.data));
  }, [isAdmin]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.mealShiftId) return alert('Chọn ca ăn');
    if (isAdmin && !form.departmentId) return alert('Chọn phòng ban');
    const std = Number(form.qtyStandard) || 0;
    const alt = Number(form.qtyAlternative) || 0;
    if (std + alt <= 0) return alert('Nhập số suất');
    const typeLabel = batchType === 'OVERTIME_INTERN' ? 'tăng ca (thực tập sinh)' : 'thường';
    if (!window.confirm(`Báo ${std} suất thường + ${alt} suất cải tiến (${typeLabel}) cho ngày ${date}?`)) return;

    setSaving(true);
    try {
      await api.post('/batches', {
        mealShiftId: form.mealShiftId,
        mealDate: date,
        qtyStandard: std,
        qtyAlternative: alt,
        note: form.note,
        batchType,
        ...(isAdmin ? { departmentId: form.departmentId } : {}),
      });
      setForm({ mealShiftId: '', departmentId: '', qtyStandard: '', qtyAlternative: '', note: '' });
      loadBatches();
    } catch (err) {
      const data = err.response?.data;
      // Đã báo trùng ca+ngày+loại -> gợi ý sửa lô cũ ngay thay vì báo lỗi khô khan.
      if (err.response?.status === 409 && data?.existingBatchId) {
        if (window.confirm(`${data.message}\n\nMở lô đã có để sửa số suất ngay?`)) {
          const existing = batches.find((b) => b.id === data.existingBatchId);
          if (existing) startEdit(existing);
        }
      } else {
        alert(data?.message || 'Đăng ký thất bại');
      }
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (b) => {
    setEditingId(b.id);
    setForm({
      mealShiftId: b.mealShiftId,
      departmentId: b.departmentId || '',
      qtyStandard: String(b.qtyStandard),
      qtyAlternative: String(b.qtyAlternative),
      note: b.note || '',
    });
    setBatchType(b.batchType || 'NORMAL');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm({ mealShiftId: '', departmentId: '', qtyStandard: '', qtyAlternative: '', note: '' });
  };
  const saveEdit = async () => {
    const std = Number(form.qtyStandard) || 0;
    const alt = Number(form.qtyAlternative) || 0;
    if (std + alt <= 0) return alert('Nhập số suất');
    setSaving(true);
    try {
      await api.put(`/batches/${editingId}`, { qtyStandard: std, qtyAlternative: alt, note: form.note });
      cancelEdit();
      loadBatches();
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Xóa lô đăng ký này?')) return;
    try {
      await api.delete(`/batches/${id}`);
      loadBatches();
    } catch (err) {
      alert(err.response?.data?.message || 'Xóa thất bại');
    }
  };

  const isPast = date < todayStr();
  const visibleBatches = batches.filter((b) => (b.batchType || 'NORMAL') === batchType);

  return (
    <div>
      <PageTitle title="Đăng ký theo lô" subtitle="Báo tổng số suất ăn cho cả ca — nhà ăn phát khay trực tiếp, không cần quét mã">
        <input
          type="date"
          value={date}
          min={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
      </PageTitle>

      <Tabs
        value={batchType}
        onChange={setBatchType}
        tabs={[
          { value: 'NORMAL', label: 'Suất thường' },
          { value: 'OVERTIME_INTERN', label: 'Tăng ca - Thực tập sinh' },
        ]}
      />

      {batchType === 'OVERTIME_INTERN' && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-block-cream text-black text-sm px-4 py-3">
          <Moon size={18} className="shrink-0 mt-0.5" />
          <span>
            Dùng mục này để báo suất ăn tăng ca cho <b>thực tập sinh</b>. Nhân viên chính thức
            tăng ca đã có suất trong lô "Suất thường" — không cần báo lại.
          </span>
        </div>
      )}

      {/* Form đăng ký / sửa */}
      <Card className="mb-5">
        <h2 className="font-semibold text-black mb-3">
          {editingId
            ? 'Sửa lô đã báo'
            : batchType === 'OVERTIME_INTERN'
            ? 'Báo suất tăng ca thực tập sinh'
            : 'Thêm lô suất ăn'}
        </h2>
        <form onSubmit={editingId ? (e) => { e.preventDefault(); saveEdit(); } : submit} className={`grid grid-cols-2 gap-3 items-end ${isAdmin ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
          {isAdmin && (
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-black/50 mb-1 block">Phòng ban</label>
              <select
                value={form.departmentId}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition disabled:bg-surface-soft"
              >
                <option value="">— Chọn phòng —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-black/50 mb-1 block">Ca ăn</label>
            <select
              value={form.mealShiftId}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, mealShiftId: e.target.value })}
              className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition disabled:bg-surface-soft"
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
            <label className="text-xs text-black/50 mb-1 block">Suất thường</label>
            <input
              type="number"
              min="0"
              value={form.qtyStandard}
              onChange={(e) => setForm({ ...form, qtyStandard: e.target.value })}
              placeholder="0"
              className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
            />
          </div>
          <div>
            <label className="text-xs text-black/50 mb-1 block">Suất cải tiến</label>
            <input
              type="number"
              min="0"
              value={form.qtyAlternative}
              onChange={(e) => setForm({ ...form, qtyAlternative: e.target.value })}
              placeholder="0"
              className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
            />
          </div>
          <div>
            <label className="text-xs text-black/50 mb-1 block">Ghi chú</label>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Tùy chọn"
              className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
            />
          </div>
          <div className={`col-span-2 flex gap-2 ${isAdmin ? 'sm:col-span-6' : 'sm:col-span-5'}`}>
            <Button type="submit" disabled={saving || isPast} className="flex-1">
              {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Báo suất ăn'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Hủy sửa
              </Button>
            )}
          </div>
        </form>
        {isPast && <p className="text-black/70 text-sm mt-2">Không thể đăng ký cho ngày đã qua.</p>}
      </Card>

      {/* Danh sách lô đã đăng ký */}
      <h2 className="font-semibold text-black mb-3">
        Đã báo cho ngày {date} ({batchType === 'OVERTIME_INTERN' ? 'tăng ca TTS' : 'suất thường'})
      </h2>
      {visibleBatches.length === 0 ? (
        <Card>
          <p className="text-black/50 text-sm">Chưa có lô nào cho ngày này.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {visibleBatches.map((b) => {
            const totalQty = b.qtyStandard + b.qtyAlternative;
            return (
              <Card key={b.id} className="flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-black">{b.mealShift?.name}</div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(b)} className="text-black/60 hover:text-black text-xs hover:underline">
                      Sửa
                    </button>
                    <button onClick={() => remove(b.id)} className="text-black/60 hover:text-black text-xs hover:underline">
                      Xóa
                    </button>
                  </div>
                </div>
                <div className="text-xs text-black/50 mb-3">
                  {b.mealShift?.startTime} - {b.mealShift?.endTime}
                  {isAdmin && b.departmentName && <span className="text-black/70"> · {b.departmentName}</span>}
                </div>

                <div className="flex items-center gap-2 mb-3 text-black/40">
                  <Users size={28} />
                  <span className="text-3xl font-bold text-black">{totalQty}</span>
                  <span className="text-sm">suất</span>
                </div>

                <div className="text-sm space-y-1">
                  <Row label="Suất thường" value={b.qtyStandard} />
                  <Row label="Suất cải tiến" value={b.qtyAlternative} />
                </div>
                {b.note && <div className="text-xs text-black/40 mt-2">{b.note}</div>}
              </Card>
            );
          })}
        </div>
      )}

      <WeeklyScheduleSection shifts={shifts} isAdmin={isAdmin} departments={departments} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-black/60">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// Lịch đăng ký định kỳ theo tuần: đặt 1 lần "thứ mấy + ca + số suất", hệ thống
// tự sinh lô hàng ngày (xem server/src/lib/generateSchedules.js) — leader không
// cần vào báo thủ công mỗi ngày cho các ca cố định lặp lại hàng tuần.
function WeeklyScheduleSection({ shifts, isAdmin, departments }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ mealShiftId: '', departmentId: '', weekdays: [], qtyStandard: '', qtyAlternative: '', batchType: 'NORMAL', note: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get('/weekly-schedules');
    setTemplates(res.data);
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggleWeekday = (w) => {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(w) ? f.weekdays.filter((x) => x !== w) : [...f.weekdays, w].sort(),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.mealShiftId) return alert('Chọn ca ăn');
    if (isAdmin && !form.departmentId) return alert('Chọn phòng ban');
    if (form.weekdays.length === 0) return alert('Chọn ít nhất 1 thứ trong tuần');
    const std = Number(form.qtyStandard) || 0;
    const alt = Number(form.qtyAlternative) || 0;
    if (std + alt <= 0) return alert('Nhập số suất');
    setSaving(true);
    try {
      await api.post('/weekly-schedules', {
        mealShiftId: form.mealShiftId,
        weekdays: form.weekdays,
        qtyStandard: std,
        qtyAlternative: alt,
        batchType: form.batchType,
        note: form.note,
        ...(isAdmin ? { departmentId: form.departmentId } : {}),
      });
      setForm({ mealShiftId: '', departmentId: '', weekdays: [], qtyStandard: '', qtyAlternative: '', batchType: 'NORMAL', note: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Tạo lịch định kỳ thất bại');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (tpl) => {
    await api.put(`/weekly-schedules/${tpl.id}`, { active: !tpl.active });
    load();
  };

  const remove = async (tpl) => {
    if (!confirm(`Xóa lịch định kỳ "${tpl.mealShift?.name}"?`)) return;
    await api.delete(`/weekly-schedules/${tpl.id}`);
    load();
  };

  return (
    <div className="mt-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-black font-semibold mb-3"
      >
        <CalendarClock size={18} />
        Lịch đăng ký định kỳ theo tuần
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="space-y-4 animate-in">
          <p className="text-xs text-black/50 -mt-2">
            Đặt lịch 1 lần cho các ca lặp lại hàng tuần (vd: thứ 2-6 luôn báo 50 suất ca sáng) — hệ
            thống sẽ tự sinh lô mỗi ngày, không cần vào báo thủ công.
          </p>

          <Card>
            <h3 className="font-semibold text-black mb-3">Thêm lịch định kỳ mới</h3>
            <form onSubmit={submit} className="space-y-3">
              <div className={`grid grid-cols-2 gap-3 ${isAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
                {isAdmin && (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-black/50 mb-1 block">Phòng ban</label>
                    <select
                      value={form.departmentId}
                      onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                      className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                    >
                      <option value="">— Chọn phòng —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs text-black/50 mb-1 block">Ca ăn</label>
                  <select
                    value={form.mealShiftId}
                    onChange={(e) => setForm({ ...form, mealShiftId: e.target.value })}
                    className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                  >
                    <option value="">— Chọn ca —</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-black/50 mb-1 block">Loại lô</label>
                  <select
                    value={form.batchType}
                    onChange={(e) => setForm({ ...form, batchType: e.target.value })}
                    className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                  >
                    <option value="NORMAL">Suất thường</option>
                    <option value="OVERTIME_INTERN">Tăng ca TTS</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-black/50 mb-1 block">Suất thường</label>
                  <input
                    type="number"
                    min="0"
                    value={form.qtyStandard}
                    onChange={(e) => setForm({ ...form, qtyStandard: e.target.value })}
                    className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-black/50 mb-1 block">Suất cải tiến</label>
                  <input
                    type="number"
                    min="0"
                    value={form.qtyAlternative}
                    onChange={(e) => setForm({ ...form, qtyAlternative: e.target.value })}
                    className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-black/50 mb-1 block">Lặp lại vào các thứ</label>
                <div className="flex gap-1.5">
                  {WEEKDAY_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => toggleWeekday(w)}
                      className={`h-9 w-11 rounded-md text-sm font-medium transition ${
                        form.weekdays.includes(w) ? 'bg-black text-white' : 'bg-surface-soft text-black/50 hover:text-black'
                      }`}
                    >
                      {WEEKDAY_LABEL[w]}
                    </button>
                  ))}
                </div>
              </div>

              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú (tùy chọn)"
                className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />

              <Button type="submit" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Thêm lịch định kỳ'}
              </Button>
            </form>
          </Card>

          {templates.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
              {templates.map((tpl) => (
                <Card key={tpl.id} className={!tpl.active ? 'opacity-50' : ''}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-black">{tpl.mealShift?.name}</div>
                    <div className="flex gap-2">
                      <button onClick={() => toggleActive(tpl)} className="text-black/60 hover:text-black text-xs hover:underline">
                        {tpl.active ? 'Tạm dừng' : 'Kích hoạt'}
                      </button>
                      <button onClick={() => remove(tpl)} className="text-black/60 hover:text-black text-xs hover:underline">
                        Xóa
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-black/50 mb-2">
                    {isAdmin && tpl.departmentName && <span className="text-black/70">{tpl.departmentName} · </span>}
                    {tpl.weekdays.map((w) => WEEKDAY_LABEL[w]).join(', ')}
                    {tpl.batchType === 'OVERTIME_INTERN' && ' · Tăng ca TTS'}
                  </div>
                  <div className="text-sm text-black/70">
                    {tpl.qtyStandard} thường{tpl.qtyAlternative > 0 ? ` · ${tpl.qtyAlternative} cải tiến` : ''}
                  </div>
                  {tpl.note && <div className="text-xs text-black/40 mt-1">{tpl.note}</div>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
