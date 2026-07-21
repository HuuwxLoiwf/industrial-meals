import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../lib/api.js';
import { PageTitle, Card, Button, Input, Select } from '../components/ui.jsx';

const TABS = [
  { key: 'account-requests', label: 'Duyệt tài khoản' },
  { key: 'employees', label: 'Nhân viên' },
  { key: 'departments', label: 'Bộ phận' },
  { key: 'shifts', label: 'Ca ăn' },
  { key: 'pricing', label: 'Đơn giá suất ăn' },
  { key: 'closed-periods', label: 'Chốt sổ tháng' },
  { key: 'non-service', label: 'Ngày nghỉ lễ' },
  { key: 'notifications', label: 'Thông báo' },
  { key: 'audit', label: 'Nhật ký' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('employees');
  return (
    <div>
      <PageTitle title="Quản trị hệ thống" subtitle="Quản lý nhân viên, bộ phận, ca ăn, thông báo" />
      <div className="inline-flex items-center gap-1 p-1 bg-surface-soft rounded-pill mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-pill text-sm font-medium transition ${
              tab === t.key ? 'bg-black text-white' : 'text-black/50 hover:text-black'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'account-requests' && <AccountRequestsTab />}
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'shifts' && <ShiftsTab />}
      {tab === 'pricing' && <PricingTab />}
      {tab === 'closed-periods' && <ClosedPeriodsTab />}
      {tab === 'non-service' && <NonServiceDaysTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

// ---------- Đơn giá suất ăn ----------
function PricingTab() {
  const [pricing, setPricing] = useState(null);
  const [form, setForm] = useState({ priceStandard: '', priceAlternative: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/summary/pricing').then((r) => {
      setPricing(r.data);
      setForm({ priceStandard: r.data.priceStandard, priceAlternative: r.data.priceAlternative });
    });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/summary/pricing', form);
      setPricing(res.data);
      setMsg('Đã lưu đơn giá');
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!pricing) return null;

  return (
    <Card className="max-w-lg">
      <h3 className="font-semibold text-black mb-1">Đơn giá suất ăn</h3>
      <p className="text-xs text-black/60 mb-4">
        Dùng để tính chi phí ước tính trong báo cáo tháng. Suất thường và suất cải tiến có thể có giá khác nhau.
      </p>
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className="text-xs text-black/60 mb-1 block">Đơn giá suất thường (VND)</label>
          <Input
            type="number"
            min="0"
            value={form.priceStandard}
            onChange={(e) => setForm({ ...form, priceStandard: e.target.value })}
            className="w-full"
          />
        </div>
        <div>
          <label className="text-xs text-black/60 mb-1 block">Đơn giá suất cải tiến (VND)</label>
          <Input
            type="number"
            min="0"
            value={form.priceAlternative}
            onChange={(e) => setForm({ ...form, priceAlternative: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đơn giá'}</Button>
          {msg && <span className="text-semantic-success text-sm">{msg}</span>}
        </div>
      </form>
    </Card>
  );
}

// ---------- Chốt sổ tháng ----------
function ClosedPeriodsTab() {
  const [periods, setPeriods] = useState([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/closed-periods').then((r) => setPeriods(r.data));
  useEffect(() => {
    load();
  }, []);

  const close = async (e) => {
    e.preventDefault();
    if (!confirm(`Chốt sổ tháng ${month}? Sau khi chốt, không ai có thể thêm/sửa/xóa đăng ký, lô suất ăn hay thực đơn của các ngày trong tháng này.`)) return;
    setBusy(true);
    try {
      await api.post('/closed-periods', { month, note: note || null });
      setNote('');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Chốt sổ thất bại');
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (p) => {
    if (!confirm(`Mở lại kỳ ${p.month}? Dữ liệu tháng này sẽ có thể sửa/xóa trở lại.`)) return;
    await api.delete(`/closed-periods/${p.month}`);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-lg">
        <h3 className="font-semibold text-black mb-1">Chốt sổ tháng</h3>
        <p className="text-xs text-black/60 mb-4">
          Khóa toàn bộ đăng ký, lô suất ăn và thực đơn của các ngày trong tháng đã chốt để số liệu
          quyết toán với kế toán không bị sửa đổi sau đó. Có thể mở lại nếu chốt nhầm.
        </p>
        <form onSubmit={close} className="space-y-3">
          <div>
            <label className="text-xs text-black/60 mb-1 block">Tháng</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full" />
          </div>
          <div>
            <label className="text-xs text-black/60 mb-1 block">Ghi chú (tùy chọn)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd: Đã đối chiếu với kế toán" className="w-full" />
          </div>
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? 'Đang chốt sổ...' : `Chốt sổ tháng ${month}`}
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-black/10 font-semibold text-black">Các kỳ đã chốt</div>
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-black/60 text-left">
            <tr>
              <th className="px-4 py-2.5">Tháng</th>
              <th className="px-4 py-2.5">Người chốt</th>
              <th className="px-4 py-2.5">Ghi chú</th>
              <th className="px-4 py-2.5">Thời điểm chốt</th>
              <th className="px-4 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-t border-black/10">
                <td className="px-4 py-2.5 font-medium text-black">{p.month}</td>
                <td className="px-4 py-2.5 text-black/60">{p.closedBy?.fullName || '—'}</td>
                <td className="px-4 py-2.5 text-black/60">{p.note || '—'}</td>
                <td className="px-4 py-2.5 text-black/60">{new Date(p.createdAt).toLocaleString('vi-VN')}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="outline" size="sm" onClick={() => reopen(p)}>Mở lại</Button>
                </td>
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-black/40">Chưa chốt sổ tháng nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Duyệt yêu cầu mở tài khoản ----------
const REQ_STATUS = {
  PENDING: { label: 'Chờ duyệt', cls: 'bg-block-cream text-black' },
  APPROVED: { label: 'Đã duyệt', cls: 'bg-block-lime text-black' },
  REJECTED: { label: 'Đã từ chối', cls: 'bg-block-coral text-black' },
};
const ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Trưởng bộ phận' },
  { value: 'EMPLOYEE', label: 'Nhân viên' },
  { value: 'CANTEEN', label: 'Nhà ăn' },
  { value: 'ADMIN', label: 'Quản trị' },
];

function AccountRequestsTab() {
  const [status, setStatus] = useState('PENDING');
  const [list, setList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [edit, setEdit] = useState({}); // { [id]: { role, departmentId, employeeCode } }
  const [busy, setBusy] = useState(null);

  const load = () =>
    api.get('/account-requests', { params: status === 'ALL' ? {} : { status } }).then((r) => setList(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data));
  }, []);

  const setField = (id, patch) => setEdit((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const approve = async (r) => {
    const patch = edit[r.id] || {};
    if (!confirm(`Duyệt tài khoản cho ${r.fullName} (${r.email})?`)) return;
    setBusy(r.id);
    try {
      await api.post(`/account-requests/${r.id}/approve`, {
        role: patch.role || r.requestedRole,
        departmentId: patch.departmentId || r.departmentId,
        employeeCode: patch.employeeCode || r.employeeCode || undefined,
      });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Duyệt thất bại');
    } finally {
      setBusy(null);
    }
  };

  const reject = async (r) => {
    const note = prompt(`Từ chối yêu cầu của ${r.fullName}?\nLý do (tùy chọn):`);
    if (note === null) return;
    setBusy(r.id);
    try {
      await api.post(`/account-requests/${r.id}/reject`, { note });
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 p-1 bg-surface-soft rounded-pill">
        {[
          { v: 'PENDING', l: 'Chờ duyệt' },
          { v: 'APPROVED', l: 'Đã duyệt' },
          { v: 'REJECTED', l: 'Đã từ chối' },
          { v: 'ALL', l: 'Tất cả' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setStatus(t.v)}
            className={`px-3.5 py-1.5 rounded-pill text-sm font-medium transition ${
              status === t.v ? 'bg-black text-white' : 'text-black/50 hover:text-black'
            }`}
          >
            {t.l}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Card>
          <p className="text-black/40 text-sm text-center py-8">Không có yêu cầu nào.</p>
        </Card>
      ) : (
        <div className="space-y-3 stagger">
          {list.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-black">{r.fullName}</div>
                  <div className="text-xs text-black/50 mt-0.5">
                    {r.email}
                    {r.phone && ` · ${r.phone}`}
                    {r.departmentName && ` · ${r.departmentName}`}
                  </div>
                  <div className="text-xs text-black/40 mt-0.5">
                    Gửi lúc {new Date(r.createdAt).toLocaleString('vi-VN')}
                    {r.reviewedByName && ` · Xử lý bởi ${r.reviewedByName}`}
                  </div>
                  {r.reviewNote && <div className="text-xs text-black/60 mt-1">Lý do: {r.reviewNote}</div>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${REQ_STATUS[r.status].cls}`}>
                  {REQ_STATUS[r.status].label}
                </span>
              </div>

              {r.status === 'PENDING' && (
                <div className="mt-4 pt-3 border-t border-black/10 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-black/50 mb-1 block">Vai trò</label>
                    <Select
                      value={edit[r.id]?.role ?? r.requestedRole}
                      onChange={(e) => setField(r.id, { role: e.target.value })}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-black/50 mb-1 block">Bộ phận</label>
                    <Select
                      value={edit[r.id]?.departmentId ?? (r.departmentId || '')}
                      onChange={(e) => setField(r.id, { departmentId: e.target.value })}
                    >
                      <option value="">— Không —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-black/50 mb-1 block">Mã NV</label>
                    <Input
                      value={edit[r.id]?.employeeCode ?? (r.employeeCode || '')}
                      onChange={(e) => setField(r.id, { employeeCode: e.target.value })}
                      placeholder="Tự sinh nếu bỏ trống"
                      className="w-40"
                    />
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <Button variant="danger" size="sm" disabled={busy === r.id} onClick={() => reject(r)}>
                      Từ chối
                    </Button>
                    <Button variant="success" size="sm" disabled={busy === r.id} onClick={() => approve(r)}>
                      {busy === r.id ? 'Đang xử lý...' : 'Duyệt'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Ngày nghỉ lễ / không phục vụ ----------
function NonServiceDaysTab() {
  const [days, setDays] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/non-service-days').then((r) => setDays(r.data));
  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!date) return alert('Chọn ngày');
    setBusy(true);
    try {
      await api.post('/non-service-days', { date, reason: reason || null });
      setDate('');
      setReason('');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Thêm thất bại');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d) => {
    if (!confirm(`Mở lại ngày ${d.date} thành ngày phục vụ bình thường?`)) return;
    await api.delete(`/non-service-days/${d.date}`);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="max-w-lg">
        <h3 className="font-semibold text-black mb-1">Đánh dấu ngày nghỉ / không phục vụ</h3>
        <p className="text-xs text-black/60 mb-4">
          Vào ngày đã đánh dấu, hệ thống sẽ chặn mọi đăng ký suất ăn và báo lô (kể cả lịch định kỳ tự động).
        </p>
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-black/60 mb-1 block">Ngày</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-black/60 mb-1 block">Lý do (tùy chọn)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="vd: Nghỉ lễ 30/4" className="w-full" />
          </div>
          <Button type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Thêm'}</Button>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-black/10 font-semibold text-black">Danh sách ngày nghỉ</div>
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-black/60 text-left">
            <tr>
              <th className="px-4 py-2.5">Ngày</th>
              <th className="px-4 py-2.5">Lý do</th>
              <th className="px-4 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.id} className="border-t border-black/10">
                <td className="px-4 py-2.5 font-medium text-black">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                </td>
                <td className="px-4 py-2.5 text-black/60">{d.reason || '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="outline" size="sm" onClick={() => remove(d)}>Mở lại</Button>
                </td>
              </tr>
            ))}
            {days.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-black/40">Chưa có ngày nghỉ nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ---------- Gửi thông báo ----------
function NotificationsTab() {
  const [form, setForm] = useState({ title: '', body: '', targetRole: '' });
  const [msg, setMsg] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.post('/notifications', { ...form, targetRole: form.targetRole || null });
    setForm({ title: '', body: '', targetRole: '' });
    setMsg('Đã gửi thông báo');
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <Card>
      <h3 className="font-semibold text-black mb-3">Gửi thông báo</h3>
      <form onSubmit={send} className="space-y-3 max-w-lg">
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Tiêu đề (vd: Thực đơn tuần mới đã cập nhật)"
          className="w-full"
        />
        <textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Nội dung..."
          rows={3}
          className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <Select
          value={form.targetRole}
          onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
        >
          <option value="">Tất cả mọi người</option>
          <option value="EMPLOYEE">Chỉ nhân viên</option>
          <option value="MANAGER">Chỉ trưởng bộ phận</option>
          <option value="CANTEEN">Chỉ nhà ăn</option>
        </Select>
        <div className="flex items-center gap-3">
          <Button type="submit">Gửi thông báo</Button>
          {msg && <span className="text-semantic-success text-sm">{msg}</span>}
        </div>
      </form>
    </Card>
  );
}

// ---------- Nhật ký hoạt động ----------
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    api.get('/audit', { params: { page, pageSize: 30 } }).then((r) => {
      setLogs(r.data.data);
      setTotalPages(r.data.totalPages);
    });
  }, [page]);

  const ACTION_LABEL = {
    EMPLOYEE_CREATE: 'Thêm nhân viên',
    EMPLOYEE_UPDATE: 'Sửa thông tin nhân viên',
    EMPLOYEE_DEACTIVATE: 'Vô hiệu hóa nhân viên',
    EMPLOYEE_REACTIVATE: 'Kích hoạt lại nhân viên',
    EMPLOYEE_IMPORT: 'Import danh sách nhân viên',
    PASSWORD_RESET: 'Đặt lại mật khẩu',
    PASSWORD_CHANGE: 'Đổi mật khẩu',
    MENU_UPDATE: 'Cập nhật thực đơn',
    DEPARTMENT_CREATE: 'Thêm bộ phận',
    DEPARTMENT_UPDATE: 'Sửa bộ phận',
    DEPARTMENT_DELETE: 'Xóa bộ phận',
    SHIFT_CREATE: 'Thêm ca ăn',
    SHIFT_UPDATE: 'Sửa ca ăn',
    SHIFT_DELETE: 'Xóa ca ăn',
    DISH_CREATE: 'Thêm món ăn',
    DISH_UPDATE: 'Sửa món ăn',
    DISH_DELETE: 'Ẩn món ăn',
    DISH_RESTORE: 'Khôi phục món ăn',
    BATCH_CREATE: 'Đăng ký lô suất ăn',
    BATCH_UPDATE: 'Sửa lô suất ăn',
    BATCH_DELETE: 'Xóa lô suất ăn',
    REGISTRATION_CREATE: 'Đăng ký suất ăn đơn lẻ',
    REGISTRATION_CREATE_BATCH_DAYS: 'Đăng ký suất ăn nhiều ngày',
    REGISTRATION_CANCEL: 'Hủy suất ăn đơn lẻ',
    NOTIFICATION_SEND: 'Gửi thông báo',
    PERIOD_CLOSE: 'Chốt sổ tháng',
    PERIOD_REOPEN: 'Mở lại kỳ đã chốt',
    WEEKLY_SCHEDULE_CREATE: 'Tạo lịch định kỳ',
    WEEKLY_SCHEDULE_UPDATE: 'Sửa lịch định kỳ',
    WEEKLY_SCHEDULE_DELETE: 'Xóa lịch định kỳ',
    NON_SERVICE_DAY_CREATE: 'Thêm ngày nghỉ',
    NON_SERVICE_DAY_DELETE: 'Bỏ ngày nghỉ',
    FEEDBACK_REPLY: 'Phản hồi góp ý',
    CONSUMPTION_RECORD: 'Ghi số suất thực ăn',
    ACCOUNT_REQUEST_APPROVE: 'Duyệt tài khoản đăng ký',
    ACCOUNT_REQUEST_REJECT: 'Từ chối tài khoản đăng ký',
    MENU_QUICK_SETUP: 'Lên thực đơn nhanh cả ngày',
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-black/60 text-left">
            <tr>
              <th className="px-4 py-2.5">Thời gian</th>
              <th className="px-4 py-2.5">Người thực hiện</th>
              <th className="px-4 py-2.5">Hành động</th>
              <th className="px-4 py-2.5">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-black/10">
                <td className="px-4 py-2.5 text-black/60">{new Date(l.createdAt).toLocaleString('vi-VN')}</td>
                <td className="px-4 py-2.5 font-medium text-black">{l.actorName || '—'}</td>
                <td className="px-4 py-2.5">{ACTION_LABEL[l.action] || l.action}</td>
                <td className="px-4 py-2.5 text-black/60">{l.detail || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/40">Chưa có nhật ký nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-black/10">
          <span className="text-sm text-black/60">Trang {page}/{totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Bộ phận ----------
function DepartmentsTab() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }

  const load = () => api.get('/departments').then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/departments', { name });
    setName('');
    load();
  };

  const saveEdit = async () => {
    if (!editing.name.trim()) return;
    await api.put(`/departments/${editing.id}`, { name: editing.name });
    setEditing(null);
    load();
  };

  // Xóa bộ phận: nếu backend báo 409 (còn nhân viên) -> hỏi xác nhận force.
  const remove = async (d) => {
    if (!confirm(`Xóa bộ phận "${d.name}"?`)) return;
    try {
      await api.delete(`/departments/${d.id}`);
      load();
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data;
        if (confirm(`${data.message}\n\nBạn có chắc muốn xóa? Nhân viên sẽ về trạng thái "Chưa phân bộ phận".`)) {
          await api.delete(`/departments/${d.id}?force=1`);
          load();
        }
      } else {
        alert(err.response?.data?.message || 'Xóa thất bại');
      }
    }
  };

  return (
    <Card>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên bộ phận mới..."
          className="flex-1"
        />
        <Button type="submit">Thêm</Button>
      </form>
      <ul className="divide-y divide-black/10">
        {list.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-2">
            {editing?.id === d.id ? (
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                className="flex-1 ring-1 ring-black/30 rounded-md px-2 py-1 text-sm mr-2 focus:ring-2 focus:ring-black focus:outline-none transition"
              />
            ) : (
              <span>
                {d.name}{' '}
                <span className="text-black/40 text-sm">
                  ({d._count?.employees || 0} nhân viên)
                </span>
              </span>
            )}
            <div className="flex gap-2">
              {editing?.id === d.id ? (
                <>
                  <Button variant="outline" size="sm" onClick={saveEdit}>Lưu</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Hủy</Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ id: d.id, name: d.name })}>Sửa</Button>
                  <Button variant="danger" size="sm" onClick={() => remove(d)}>Xóa</Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Ca ăn ----------
function ShiftsTab() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    name: '',
    startTime: '',
    endTime: '',
    order: 0,
    period: 'DAY',
    cutoffTime: '',
    maxCapacity: '',
  });

  const load = () => api.get('/shifts').then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    if (form.startTime && form.endTime && form.startTime === form.endTime) {
      return alert('Giờ bắt đầu và kết thúc không được trùng nhau');
    }
    try {
      await api.post('/shifts', { ...form, order: Number(form.order) });
      setForm({ name: '', startTime: '', endTime: '', order: 0, period: 'DAY', cutoffTime: '', maxCapacity: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Thêm ca ăn thất bại');
    }
  };
  const updateCutoff = async (s, cutoffTime) => {
    await api.put(`/shifts/${s.id}`, { ...s, cutoffTime });
    load();
  };
  const updateCapacity = async (s, maxCapacity) => {
    await api.put(`/shifts/${s.id}`, { ...s, maxCapacity: maxCapacity || null });
    load();
  };
  // Xóa ca ăn: nếu backend báo 409 (còn đăng ký/lô) -> hỏi xác nhận force.
  const remove = async (s) => {
    if (!confirm(`Xóa ca "${s.name}"?`)) return;
    try {
      await api.delete(`/shifts/${s.id}`);
      load();
    } catch (err) {
      if (err.response?.status === 409) {
        const data = err.response.data;
        if (confirm(`${data.message}\n\nBạn có chắc muốn xóa kèm toàn bộ dữ liệu liên quan?`)) {
          await api.delete(`/shifts/${s.id}?force=1`);
          load();
        }
      } else {
        alert(err.response?.data?.message || 'Xóa thất bại');
      }
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-black mb-3">Thêm ca ăn</h3>
      <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-5">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Tên ca"
        />
        <Input
          type="time"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
        />
        <Input
          type="time"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
        />
        <Select
          value={form.period}
          onChange={(e) => setForm({ ...form, period: e.target.value })}
        >
          <option value="DAY">Ca ngày</option>
          <option value="NIGHT">Ca đêm</option>
        </Select>
        <Input
          type="time"
          value={form.cutoffTime}
          onChange={(e) => setForm({ ...form, cutoffTime: e.target.value })}
          title="Hạn chót đăng ký"
        />
        <Input
          type="number"
          min="0"
          value={form.maxCapacity}
          onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })}
          placeholder="Công suất bếp (tùy chọn)"
        />
        <Button type="submit">Thêm</Button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-black/60 text-left">
            <tr>
              <th className="px-4 py-2.5">Tên ca</th>
              <th className="px-4 py-2.5">Giờ</th>
              <th className="px-4 py-2.5">Loại</th>
              <th className="px-4 py-2.5">Hạn chót đăng ký</th>
              <th className="px-4 py-2.5">Công suất bếp</th>
              <th className="px-4 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-t border-black/10">
                <td className="px-4 py-2.5 font-medium text-black">{s.name}</td>
                <td className="px-4 py-2.5 text-black/60">
                  {s.startTime} - {s.endTime}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-md ${
                      s.period === 'NIGHT' ? 'bg-block-lilac text-black' : 'bg-block-mint text-black'
                    }`}
                  >
                    {s.period === 'NIGHT' ? 'Ca đêm' : 'Ca ngày'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="time"
                    defaultValue={s.cutoffTime || ''}
                    onBlur={(e) => e.target.value !== (s.cutoffTime || '') && updateCutoff(s, e.target.value)}
                    className="ring-1 ring-black/15 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-black focus:outline-none transition"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min="0"
                    defaultValue={s.maxCapacity ?? ''}
                    placeholder="Không giới hạn"
                    onBlur={(e) => Number(e.target.value || 0) !== (s.maxCapacity ?? 0) && updateCapacity(s, e.target.value)}
                    className="ring-1 ring-black/15 rounded-md px-2 py-1 text-xs w-28 focus:ring-2 focus:ring-black focus:outline-none transition"
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="danger" size="sm" onClick={() => remove(s)}>
                    Xóa
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-black/40 mt-2">
        Hạn chót đăng ký: sau giờ này không thể đăng ký/hủy suất cho ngày hôm đó. Công suất bếp: tổng số suất
        tối đa bếp nấu được cho ca đó (để trống = không giới hạn).
      </p>
    </Card>
  );
}

// ---------- Import Excel/CSV ----------
function ImportEmployees({ onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/employees/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult({ ok: true, ...res.data });
      onDone?.();
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.message || 'Import thất bại' });
    } finally {
      setBusy(false);
      setFile(null);
      e.target.reset();
    }
  };

  return (
    <Card>
      <h3 className="font-semibold text-black mb-1">Import danh sách nhân viên</h3>
      <p className="text-xs text-black/60 mb-3">
        File Excel (.xlsx) hoặc CSV. Cột: <b>Mã NV, Họ và tên, Email, Số điện thoại, Bộ phận</b>.
        Mỗi sheet sẽ được gộp lại (vd: "Ca sáng", "Ca tối"). <b>Tên Bộ phận phải khớp đúng</b> tên
        đã có trong tab "Bộ phận" — hệ thống không tự tạo bộ phận mới để tránh phòng ban rác do lỗi chính tả.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files[0])}
          className="text-sm"
        />
        <Button type="submit" disabled={busy || !file}>
          {busy ? 'Đang import...' : 'Tải lên & import'}
        </Button>
      </form>

      {result && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-sm ${
            result.ok ? 'bg-block-lime text-black' : 'bg-block-coral text-black'
          }`}
        >
          {result.ok ? (
            <>
              ✓ Thêm mới <b>{result.created}</b>, cập nhật <b>{result.updated}</b>, bỏ qua{' '}
              <b>{result.skipped}</b>.
              {result.errors?.length > 0 && (
                <div className="mt-2 text-black/70 space-y-1 max-h-40 overflow-y-auto">
                  <div className="font-medium">{result.errors.length} dòng lỗi:</div>
                  {result.errors.slice(0, 20).map((e, i) => (
                    <div key={i}>
                      Dòng {e.row}{e.email ? ` (${e.email})` : ''}: {e.message}
                    </div>
                  ))}
                  {result.errors.length > 20 && <div>... và {result.errors.length - 20} lỗi khác</div>}
                </div>
              )}
            </>
          ) : (
            <>✕ {result.message}</>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------- Nhân viên ----------
function EmployeesTab() {
  const myId = useSelector((s) => s.me.profile?.id);
  const [list, setList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, pageSize: 20 });
  const [form, setForm] = useState({
    employeeCode: '',
    fullName: '',
    email: '',
    role: 'EMPLOYEE',
    departmentId: '',
  });
  const [editing, setEditing] = useState(null); // nhân viên đang sửa thông tin

  const [includeInactive, setIncludeInactive] = useState(false);

  const load = () =>
    api
      .get('/employees', {
        params: { search, page, pageSize: 20, includeInactive: includeInactive ? 1 : undefined },
      })
      .then((r) => {
        setList(r.data.data);
        setMeta({ total: r.data.total, totalPages: r.data.totalPages, pageSize: r.data.pageSize });
      });

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, includeInactive]);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data));
  }, []);

  // Đổi từ khóa tìm -> về trang 1.
  const onSearch = (v) => {
    setSearch(v);
    setPage(1);
  };

  const add = async (e) => {
    e.preventDefault();
    if (!form.employeeCode.trim() || !form.fullName.trim()) {
      return alert('Nhập mã NV và họ tên');
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return alert('Email không đúng định dạng');
    }
    try {
      await api.post('/employees', { ...form, departmentId: form.departmentId || null });
      setForm({ employeeCode: '', fullName: '', email: '', role: 'EMPLOYEE', departmentId: '' });
      setPage(1);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Thêm nhân viên thất bại (có thể mã NV hoặc email đã tồn tại)');
    }
  };
  const updateRole = async (emp, role) => {
    try {
      await api.put(`/employees/${emp.id}`, { role });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Đổi vai trò thất bại');
      load(); // reload để select trả về giá trị cũ
    }
  };
  const remove = async (id) => {
    if (id === myId) return alert('Không thể tự vô hiệu hóa chính mình.');
    if (!confirm('Vô hiệu hóa nhân viên này? Lịch sử đăng ký/báo cáo vẫn được giữ lại.')) return;
    try {
      await api.delete(`/employees/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Vô hiệu hóa thất bại');
    }
  };
  const reactivate = async (emp) => {
    if (!confirm(`Kích hoạt lại tài khoản ${emp.fullName}?`)) return;
    await api.post(`/employees/${emp.id}/reactivate`);
    load();
  };
  const resetPassword = async (emp) => {
    if (!confirm(`Đặt lại mật khẩu cho ${emp.fullName} về mã NV?`)) return;
    const res = await api.post(`/employees/${emp.id}/reset-password`);
    alert(`${res.data.message}\nMật khẩu mới: ${res.data.defaultPassword}`);
  };
  const saveEdit = async () => {
    if (!editing.fullName.trim()) return alert('Nhập họ tên');
    if (editing.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) {
      return alert('Email không đúng định dạng');
    }
    try {
      await api.put(`/employees/${editing.id}`, {
        fullName: editing.fullName,
        email: editing.email || null,
        phone: editing.phone || null,
        departmentId: editing.departmentId || null,
      });
      setEditing(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Cập nhật thất bại');
    }
  };

  return (
    <div className="space-y-4">
      <ImportEmployees onDone={load} />
      <Card>
        <h3 className="font-semibold text-black mb-3">Thêm nhân viên</h3>
        <form onSubmit={add} className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <Input
            value={form.employeeCode}
            onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
            placeholder="Mã NV"
          />
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Họ tên"
          />
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
          />
          <Select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="EMPLOYEE">Nhân viên</option>
            <option value="MANAGER">Trưởng bộ phận</option>
            <option value="CANTEEN">Nhà ăn</option>
            <option value="ADMIN">Quản trị</option>
          </Select>
          <Select
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">— Bộ phận —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Button type="submit">Thêm</Button>
        </form>
        <p className="text-xs text-black/40 mt-2">
          Mật khẩu mặc định = mã NV (viết thường). Nhân viên buộc đổi khi đăng nhập lần đầu.
        </p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-black/10 flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Tìm theo tên / mã / email..."
            className="flex-1"
          />
          <label className="flex items-center gap-1.5 text-sm text-black/60 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
            />
            Hiện cả đã vô hiệu hóa
          </label>
          <span className="text-sm text-black/40 shrink-0">{meta.total} nhân viên</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-black/60 text-left">
              <tr>
                <th className="px-4 py-2.5">Mã</th>
                <th className="px-4 py-2.5">Họ tên</th>
                <th className="px-4 py-2.5">Bộ phận</th>
                <th className="px-4 py-2.5">Vai trò</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={`border-t border-black/10 hover:bg-surface-soft/60 ${e.status === 'INACTIVE' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2.5 text-black/60">{e.employeeCode}</td>
                  <td className="px-4 py-2.5 font-medium text-black">{e.fullName}</td>
                  <td className="px-4 py-2.5 text-black/60">{e.department?.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={e.role}
                      disabled={e.id === myId}
                      title={e.id === myId ? 'Không thể tự đổi vai trò của chính mình' : ''}
                      onChange={(ev) => updateRole(e, ev.target.value)}
                      className="ring-1 ring-black/15 rounded-md px-2 py-1 text-xs bg-white disabled:opacity-50 focus:ring-2 focus:ring-black focus:outline-none transition"
                    >
                      <option value="EMPLOYEE">Nhân viên</option>
                      <option value="MANAGER">Trưởng BP</option>
                      <option value="CANTEEN">Nhà ăn</option>
                      <option value="ADMIN">Quản trị</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-md ${e.status === 'INACTIVE' ? 'bg-block-coral text-black' : 'bg-block-lime text-black'}`}>
                      {e.status === 'INACTIVE' ? 'Đã vô hiệu hóa' : 'Đang hoạt động'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing({ ...e, departmentId: e.department?.id || '' })}>
                        Sửa
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => resetPassword(e)}>
                        Reset MK
                      </Button>
                      {e.status === 'INACTIVE' ? (
                        <Button variant="success" size="sm" onClick={() => reactivate(e)}>
                          Kích hoạt lại
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={e.id === myId}
                          title={e.id === myId ? 'Không thể tự vô hiệu hóa chính mình' : ''}
                          onClick={() => remove(e.id)}
                        >
                          Vô hiệu hóa
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-black/40">
                    Không tìm thấy nhân viên nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/10">
            <span className="text-sm text-black/60">
              Trang {page}/{meta.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg ring-1 ring-black/10 w-full max-w-md p-5 animate-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-black mb-4">Sửa thông tin: {editing.employeeCode}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-black/60 mb-1 block">Họ tên</label>
                <Input
                  value={editing.fullName}
                  onChange={(ev) => setEditing({ ...editing, fullName: ev.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-black/60 mb-1 block">Email</label>
                <Input
                  type="email"
                  value={editing.email || ''}
                  onChange={(ev) => setEditing({ ...editing, email: ev.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-black/60 mb-1 block">Số điện thoại</label>
                <Input
                  value={editing.phone || ''}
                  onChange={(ev) => setEditing({ ...editing, phone: ev.target.value })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-black/60 mb-1 block">Bộ phận</label>
                <Select
                  value={editing.departmentId}
                  onChange={(ev) => setEditing({ ...editing, departmentId: ev.target.value })}
                  className="w-full"
                >
                  <option value="">— Bộ phận —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
              <Button onClick={saveEdit}>Lưu</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
