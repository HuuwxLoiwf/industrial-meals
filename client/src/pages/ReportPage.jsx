import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Download, TrendingUp, Moon, Award, ClipboardList, UtensilsCrossed, Wallet } from 'lucide-react';
import api, { downloadFile } from '../lib/api.js';
import { PageTitle, Card, Button, StatCard, EmptyState, Tabs } from '../components/ui.jsx';

// Module 7: Báo cáo thống kê theo tháng (gộp cá nhân + lô).
export default function ReportPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingDept, setDownloadingDept] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get('/summary/monthly', { params: { month } });
    setData(res.data);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const fmtVND = (n) => n.toLocaleString('vi-VN') + ' đ';

  const exportExcel = async () => {
    setDownloading(true);
    try {
      await downloadFile('/export/monthly', { month }, `bao-cao-thang-${month}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  const exportByDepartment = async () => {
    setDownloadingDept(true);
    try {
      await downloadFile('/export/monthly-by-department', { month }, `bao-cao-chi-phi-theo-bo-phan-${month}.xlsx`);
    } finally {
      setDownloadingDept(false);
    }
  };

  return (
    <div>
      <PageTitle title="Báo cáo thống kê" subtitle="Suất ăn & chi phí theo tháng">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <Button variant="outline" onClick={exportExcel} disabled={downloading}>
          <Download size={16} />
          {downloading ? 'Đang xuất...' : 'Xuất Excel'}
        </Button>
        <Button variant="outline" onClick={exportByDepartment} disabled={downloadingDept}>
          <Download size={16} />
          {downloadingDept ? 'Đang xuất...' : 'Xuất theo bộ phận'}
        </Button>
      </PageTitle>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Tổng quan' },
          { value: 'advanced', label: 'Phân tích nâng cao' },
        ]}
      />

      {tab === 'advanced' && <AdvancedAnalytics month={month} />}

      {tab === 'overview' && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-4 mb-5 stagger">
            <StatCard icon={ClipboardList} tone="blue" label="Tổng suất đã báo" value={data.totals.registered} />
            <StatCard icon={UtensilsCrossed} tone="sky" label="Suất thường" value={data.totals.standard} />
            <StatCard icon={UtensilsCrossed} tone="violet" label="Suất cải tiến" value={data.totals.alternative} />
            <StatCard
              icon={Wallet}
              tone="rose"
              label="Chi phí ước tính"
              value={fmtVND(data.totals.estimatedCost)}
              hint={`${fmtVND(data.pricing.priceStandard)}/suất thường, ${fmtVND(data.pricing.priceAlternative)}/suất cải tiến`}
            />
          </div>

          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-black" />
              <h3 className="text-sm font-semibold text-black">Suất ăn theo ngày</h3>
            </div>
            {data.days.length === 0 ? (
              <EmptyState icon={TrendingUp} title="Chưa có dữ liệu" hint="Chưa có đăng ký nào trong tháng này" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.days} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(8)} fontSize={12} stroke="#8a8a8a" tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} allowDecimals={false} stroke="#8a8a8a" tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'Inter' }}
                    labelFormatter={(d) => `Ngày ${d}`}
                  />
                  <Legend />
                  <Bar dataKey="registered" name="Đã báo" fill="#000000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// Phân tích nâng cao: món phổ biến, xu hướng suất tăng ca thực tập sinh.
function AdvancedAnalytics({ month }) {
  const [a, setA] = useState(null);

  useEffect(() => {
    api.get('/summary/analytics', { params: { month } }).then((r) => setA(r.data));
  }, [month]);

  if (!a) return <p className="text-black/40 text-sm">Đang tải...</p>;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3 stagger">
        <StatCard icon={ClipboardList} tone="blue" label="Tổng suất đã báo" value={a.totals.registered} />
        <StatCard icon={Moon} tone="amber" label="Suất tăng ca - TTS" value={a.totals.overtimeIntern} />
        <StatCard icon={Award} tone="violet" label="Suất cải tiến" value={a.totals.alternative} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Món phổ biến */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-black" />
            <h3 className="text-sm font-semibold text-black">Món được lên thực đơn nhiều nhất</h3>
          </div>
          {a.popularDishes.length === 0 ? (
            <EmptyState icon={Award} title="Chưa có dữ liệu" />
          ) : (
            <ul className="space-y-2">
              {a.popularDishes.map((d, i) => (
                <li key={d.name} className="flex items-center gap-3">
                  <span className="h-6 w-6 shrink-0 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-black/80">{d.name}</span>
                  <span className="text-sm font-semibold text-black/50">{d.count} lần</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Xu hướng tăng ca thực tập sinh */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Moon size={18} className="text-black" />
            <h3 className="text-sm font-semibold text-black">Suất tăng ca thực tập sinh theo ngày</h3>
          </div>
          {a.overtimeInternByDay.length === 0 ? (
            <EmptyState icon={Moon} title="Chưa có dữ liệu" hint="Chưa có lô tăng ca TTS nào trong tháng" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={a.overtimeInternByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(8)} fontSize={12} stroke="#8a8a8a" tickLine={false} axisLine={false} />
                <YAxis fontSize={12} allowDecimals={false} stroke="#8a8a8a" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'Inter' }} labelFormatter={(d) => `Ngày ${d}`} formatter={(v) => [`${v} suất`, 'Tăng ca TTS']} />
                <Bar dataKey="count" name="Tăng ca TTS" fill="#f3c9b6" stroke="none" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}
