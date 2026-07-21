import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import api, { downloadFile } from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { PageTitle, Card, Tabs, Button, todayStr } from '../components/ui.jsx';

// Module 6: Tổng hợp suất ăn — 2 góc nhìn: theo ca, và theo phòng ban (danh sách NV).
export default function SummaryPage() {
  const [tab, setTab] = useState('shift');
  const [date, setDate] = useState(todayStr());

  return (
    <div>
      <PageTitle title="Tổng hợp suất ăn" subtitle="Số lượng theo ca ăn & theo phòng ban">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <Button variant="outline" onClick={() => downloadFile('/export/daily', { date }, `bao-cao-ngay-${date}.xlsx`)}>
          <Download size={16} /> Xuất Excel
        </Button>
      </PageTitle>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'shift', label: 'Theo ca ăn' },
          { value: 'dept', label: 'Theo phòng ban' },
        ]}
      />

      {tab === 'shift' ? <ShiftView date={date} /> : <DepartmentView date={date} />}
    </div>
  );
}

// ---------- Góc nhìn theo ca ăn (bảng cũ) ----------
function ShiftView({ date }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get('/summary/daily', { params: { date } });
    setData(res.data);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();
    socket.on('registration:created', refresh);
    socket.on('registration:updated', refresh);
    socket.on('receipt:created', refresh);
    return () => {
      socket.off('registration:created', refresh);
      socket.off('registration:updated', refresh);
      socket.off('receipt:created', refresh);
    };
  }, [load]);

  const shifts = data?.shifts || [];

  // Tổng theo từng ca (cột).
  const colTotals = {};
  for (const row of data?.rows || []) {
    for (const s of shifts) {
      colTotals[s.id] = (colTotals[s.id] || 0) + (row.shifts[s.id]?.registered || 0);
    }
  }

  return (
    <div>
      {data && (
        <div className="grid gap-3 sm:grid-cols-4 mb-5 stagger">
          <Stat label="Tổng đăng ký" value={data.totals.registered} tone="bg-surface-soft" />
          <Stat label="Suất thường" value={data.totals.standard ?? 0} tone="bg-block-mint" />
          <Stat label="Suất cải tiến" value={data.totals.alternative ?? 0} tone="bg-block-lilac" />
          <Stat label="Đã nhận (suất cá nhân)" value={data.totals.received} tone="bg-block-lime" />
        </div>
      )}

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-black/60">
            <tr>
              <th className="px-4 py-2 text-left">Bộ phận</th>
              {shifts.map((s) => (
                <th key={s.id} className="px-4 py-2 text-center">
                  {s.name}
                </th>
              ))}
              <th className="px-4 py-2 text-center">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((row) => (
              <tr key={row.department} className="border-t border-black/10">
                <td className="px-4 py-2 font-medium">{row.department}</td>
                {shifts.map((s) => (
                  <td key={s.id} className="px-4 py-2 text-center">
                    {row.shifts[s.id]?.registered || 0}
                  </td>
                ))}
                <td className="px-4 py-2 text-center font-semibold">{row.total}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={shifts.length + 2} className="px-4 py-6 text-center text-black/40">
                  Chưa có đăng ký cho ngày này.
                </td>
              </tr>
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="bg-surface-soft font-semibold">
              <tr>
                <td className="px-4 py-2">Tổng cộng</td>
                {shifts.map((s) => (
                  <td key={s.id} className="px-4 py-2 text-center">
                    {colTotals[s.id] || 0}
                  </td>
                ))}
                <td className="px-4 py-2 text-center">{data.totals.registered}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}

// ---------- Góc nhìn theo phòng ban (danh sách nhân viên) ----------
function DepartmentView({ date }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async () => {
    const res = await api.get('/summary/by-department', { params: { date } });
    setData(res.data);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();
    socket.on('registration:created', refresh);
    socket.on('registration:updated', refresh);
    return () => {
      socket.off('registration:created', refresh);
      socket.off('registration:updated', refresh);
    };
  }, [load]);

  const toggle = (key) => {
    const next = new Set(expanded);
    next.has(key) ? next.delete(key) : next.add(key);
    setExpanded(next);
  };

  const depts = data?.departments || [];

  return (
    <div>
      {data && (
        <div className="grid gap-3 sm:grid-cols-3 mb-5 stagger">
          <Stat label="Tổng nhân viên" value={data.totals.employees} tone="bg-surface-soft" />
          <Stat label="Đã đăng ký" value={data.totals.registered} tone="bg-block-lime" />
          <Stat
            label="Chưa đăng ký"
            value={data.totals.employees - data.totals.registered}
            tone="bg-block-cream"
          />
        </div>
      )}

      <div className="space-y-3">
        {depts.map((d) => {
          const key = d.departmentId || '__none__';
          const open = expanded.has(key);
          return (
            <Card key={key} className="p-0 overflow-hidden">
              <button
                onClick={() => toggle(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-soft"
              >
                <div className="flex items-center gap-2">
                  <span className="text-black/40">
                    {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <span className="font-semibold text-black">{d.department}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-black/50">
                    {d.employeeCount} người
                  </span>
                  <span className="rounded-full bg-block-lime text-black px-2.5 py-0.5 font-medium">
                    {d.registeredCount} suất
                  </span>
                </div>
              </button>

              {open && (
                <table className="w-full text-sm border-t border-black/10">
                  <thead className="bg-surface-soft text-black/50 text-left">
                    <tr>
                      <th className="px-4 py-2">Mã NV</th>
                      <th className="px-4 py-2">Họ tên</th>
                      <th className="px-4 py-2">Trạng thái</th>
                      <th className="px-4 py-2">Ca đã chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.members.map((m) => (
                      <tr key={m.id} className="border-t border-black/5">
                        <td className="px-4 py-2 text-black/50">{m.employeeCode}</td>
                        <td className="px-4 py-2 font-medium">{m.fullName}</td>
                        <td className="px-4 py-2">
                          {m.registered ? (
                            <span className="text-semantic-success">✓ Đã đăng ký</span>
                          ) : (
                            <span className="text-black/40">Chưa đăng ký</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-black/60">
                          {m.shift || '—'}
                          {m.mealType === 'ALTERNATIVE' && (
                            <span className="ml-1 text-xs text-black/50 italic">(cải tiến)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          );
        })}

        {data && depts.length === 0 && (
          <Card>
            <p className="text-black/40 text-sm text-center py-4">Chưa có phòng ban nào.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = 'bg-surface-soft' }) {
  return (
    <Card className={tone}>
      <div className="text-sm text-black/60">{label}</div>
      <div className="text-2xl font-bold text-black">{value}</div>
    </Card>
  );
}
