import { useEffect, useState, useCallback } from 'react';
import { ChefHat, Users, Moon, Trash2 } from 'lucide-react';
import api from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { PageTitle, Card, Button, EmptyState, todayStr } from '../components/ui.jsx';

// Bảng CHUẨN BỊ SUẤT ĂN cho nhà ăn: chỉ xem tổng số cần nấu theo ca — không quét
// mã, không xác nhận phát. Nhà ăn phát khay trực tiếp theo số lượng đã đăng ký.
export default function PrepMealPage() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get('/batches/prep', { params: { date } });
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

  const totalNormal = data?.rows.reduce((s, r) => s + r.normal.standard + r.normal.alternative, 0) || 0;
  const totalOvertime = data?.rows.reduce((s, r) => s + r.overtimeIntern.standard + r.overtimeIntern.alternative, 0) || 0;

  return (
    <div>
      <PageTitle title="Chuẩn bị suất ăn" subtitle="Tổng số suất cần nấu theo ca — phát khay trực tiếp, không cần quét mã">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
      </PageTitle>

      {data && (
        <div className="grid gap-4 sm:grid-cols-3 mb-5 stagger">
          <Stat icon={ChefHat} label="Tổng số suất cần chuẩn bị" value={data.grandTotal} tone="blue" />
          <Stat icon={Users} label="Suất thường (kể cả NV tăng ca)" value={totalNormal} tone="emerald" />
          <Stat icon={Moon} label="Suất tăng ca - thực tập sinh" value={totalOvertime} tone="amber" />
        </div>
      )}

      {!data || data.rows.length === 0 ? (
        <Card>
          <EmptyState icon={ChefHat} title="Chưa có suất ăn nào" hint="Chưa có lô đăng ký cho ngày này" />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.rows.map((r) => (
            <Card key={r.shiftId} className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold text-black">{r.shiftName}</div>
                <div className="text-xs text-black/40">{r.startTime} - {r.endTime}</div>
              </div>

              <div className="flex items-center gap-6 flex-wrap">
                <MiniStat label="Thường" value={r.normal.standard + r.normal.alternative} />
                {(r.overtimeIntern.standard + r.overtimeIntern.alternative) > 0 && (
                  <MiniStat label="Tăng ca TTS" value={r.overtimeIntern.standard + r.overtimeIntern.alternative} tone="amber" />
                )}
                <div className="text-right pl-4 border-l border-black/10">
                  <div className="text-2xl font-bold text-black">{r.total}</div>
                  <div className="text-xs text-black/40">tổng suất</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConsumptionSection date={date} />
    </div>
  );
}

// Nhà ăn nhập SỐ SUẤT THỰC TẾ phát ra cuối buổi -> hệ thống tính lãng phí & tỷ lệ ăn.
function ConsumptionSection({ date }) {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});

  const load = useCallback(() => {
    api.get('/consumption', { params: { date } }).then((r) => {
      setData(r.data);
      setDraft(Object.fromEntries(r.data.rows.map((row) => [row.shiftId, row.served ?? ''])));
    });
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRow = async (shiftId) => {
    const actualServed = Number(draft[shiftId]) || 0;
    await api.put('/consumption', { date, mealShiftId: shiftId, actualServed });
    load();
  };

  if (!data) return null;

  return (
    <Card className="mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Trash2 size={18} className="text-black" />
        <h3 className="font-semibold text-black">Số suất thực ăn & lãng phí</h3>
      </div>
      <p className="text-xs text-black/60 mb-4">
        Nhập số suất thực tế đã phát ra cuối mỗi ca. Hệ thống so với số đã báo để tính lãng phí và tỷ lệ ăn.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-soft text-black/60 text-left">
            <tr>
              <th className="px-4 py-2.5">Ca</th>
              <th className="px-4 py-2.5 text-right">Số báo</th>
              <th className="px-4 py-2.5">Số thực ăn</th>
              <th className="px-4 py-2.5 text-right">Lãng phí</th>
              <th className="px-4 py-2.5 text-right">Tỷ lệ ăn</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.shiftId} className="border-t border-black/10">
                <td className="px-4 py-2.5 font-medium text-black">{r.shiftName}</td>
                <td className="px-4 py-2.5 text-right text-black/70">{r.reported}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="number"
                    min="0"
                    value={draft[r.shiftId] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.shiftId]: e.target.value }))}
                    className="w-24 ring-1 ring-black/15 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.waste != null ? <span className={r.waste > 0 ? 'text-black font-medium' : 'text-black/40'}>{r.waste}</span> : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.rate != null ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.rate >= 90 ? 'bg-block-lime text-black' : r.rate >= 70 ? 'bg-block-cream text-black' : 'bg-block-coral text-black'}`}>
                      {r.rate}%
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="outline" onClick={() => saveRow(r.shiftId)}>Lưu</Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black/10 font-semibold text-black">
              <td className="px-4 py-2.5">Tổng</td>
              <td className="px-4 py-2.5 text-right">{data.totals.reported}</td>
              <td className="px-4 py-2.5">{data.totals.served}</td>
              <td className="px-4 py-2.5 text-right">{data.totals.waste}</td>
              <td className="px-4 py-2.5 text-right">{data.totals.rate != null ? `${data.totals.rate}%` : '—'}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'bg-block-lilac text-black',
    emerald: 'bg-block-lime text-black',
    amber: 'bg-block-cream text-black',
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold text-black leading-none">{value}</div>
        <div className="text-sm text-black/60 mt-1.5">{label}</div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-black/70', amber: 'text-black' };
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${tones[tone]}`}>{value}</div>
      <div className="text-xs text-black/40">{label}</div>
    </div>
  );
}
