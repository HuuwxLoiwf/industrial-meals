import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  ClipboardList,
  UtensilsCrossed,
  Moon,
  Package,
  Users,
  Building2,
  Salad,
  Soup,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import api from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { PageTitle, Card, StatCard, StatusBadge, MealTypeBadge, EmptyState, StatSkeleton, Skeleton } from '../components/ui.jsx';

export default function DashboardPage() {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get('/summary/dashboard');
    setData(res.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();
    socket.on('registration:created', refresh);
    socket.on('registration:updated', refresh);
    socket.on('dish-vote:updated', refresh);
    return () => {
      socket.off('registration:created', refresh);
      socket.off('registration:updated', refresh);
      socket.off('dish-vote:updated', refresh);
    };
  }, [load]);

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  if (!data) {
    return (
      <div>
        <PageTitle title="Bảng điều khiển" subtitle="Tổng quan hệ thống suất ăn" />
        <StatSkeleton count={4} />
        <div className="mt-4">
          <StatSkeleton count={4} />
        </div>
        <div className="grid gap-5 lg:grid-cols-5 mt-6">
          <Skeleton className="h-80 lg:col-span-3" />
          <Skeleton className="h-80 lg:col-span-2" />
        </div>
      </div>
    );
  }

  const c = data.cards;

  return (
    <div>
      <PageTitle title="Bảng điều khiển" subtitle={`Tổng quan hệ thống — ${today}`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4 stagger">
        <StatCard icon={ClipboardList} tone="blue" label="Tổng suất đã báo hôm nay" value={c.todayRegistered} />
        <StatCard icon={Package} tone="violet" label="Lô đăng ký hôm nay" value={c.todayBatchCount} />
        <StatCard icon={Moon} tone="amber" label="Suất tăng ca - TTS" value={c.todayOvertimeIntern} />
        <StatCard icon={UtensilsCrossed} tone="emerald" label="Đã nhận (suất cá nhân)" value={c.todayReceived} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 stagger">
        <StatCard icon={Users} tone="indigo" label="Tổng nhân viên" value={c.employees} />
        <StatCard icon={Building2} tone="slate" label="Bộ phận" value={c.departments} />
        <StatCard icon={Salad} tone="sky" label="Suất thường (nay)" value={c.todayStandard} />
        <StatCard icon={Soup} tone="violet" label="Suất cải tiến (nay)" value={c.todayAlternative} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Biểu đồ theo ca */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-black">Suất ăn theo ca hôm nay</h3>
              <p className="text-xs text-black/40 mt-0.5">Số lượng đăng ký theo từng khung giờ</p>
            </div>
            <div className="flex gap-3 text-xs text-black/60">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-black" /> Ca ngày
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-block-lilac" /> Ca đêm
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.shiftChart} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
              <XAxis dataKey="name" fontSize={12} stroke="#8a8a8a" tickLine={false} axisLine={false} />
              <YAxis fontSize={12} allowDecimals={false} stroke="#8a8a8a" tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: '#f7f7f5' }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'Inter' }}
                formatter={(v) => [`${v} suất`, 'Đăng ký']}
                labelFormatter={(l) => `Ca ${l}`}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={700} animationEasing="ease-out">
                {data.shiftChart.map((entry, i) => (
                  <Cell key={i} fill={entry.period === 'NIGHT' ? '#c5b0f4' : '#000000'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Hoạt động gần đây */}
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-black mb-4">Hoạt động gần đây</h3>
          {data.recent.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Chưa có hoạt động" hint="Đăng ký mới sẽ hiển thị tại đây" />
          ) : (
            <ul className="space-y-1 stagger">
              {data.recent.map((r) => (
                <li key={r.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-surface-soft transition-colors">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-black text-white flex items-center justify-center text-sm font-semibold">
                    {r.employee.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-black truncate">{r.employee}</div>
                    <div className="text-xs text-black/40">
                      {r.department} · Ca {r.shift}
                    </div>
                    <div className="flex gap-1.5 mt-1">
                      <StatusBadge status={r.status} />
                      <MealTypeBadge type={r.mealType} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Hàng dưới: suất ăn theo phòng ban + món bình chọn nổi bật */}
      <div className="grid gap-5 lg:grid-cols-5 mt-5">
        <Card className="lg:col-span-3">
          <div className="mb-4">
            <h3 className="font-semibold text-black">Suất ăn theo phòng ban hôm nay</h3>
            <p className="text-xs text-black/40 mt-0.5">Tổng số suất đã báo theo lô, theo từng phòng ban</p>
          </div>
          {!data.departmentChart || data.departmentChart.length === 0 ? (
            <EmptyState icon={Building2} title="Chưa có lô nào hôm nay" hint="Số suất theo phòng ban sẽ hiển thị tại đây" />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, data.departmentChart.length * 44)}>
              <BarChart data={data.departmentChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" horizontal={false} />
                <XAxis type="number" fontSize={12} allowDecimals={false} stroke="#8a8a8a" tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={130} fontSize={12} stroke="#8a8a8a" tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: '#f7f7f5' }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e6e6e6', fontSize: 13, fontFamily: 'Inter' }}
                  formatter={(v) => [`${v} suất`, 'Đã báo']}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#000000" isAnimationActive animationDuration={700} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="mb-4">
            <h3 className="font-semibold text-black">Món được bình chọn hôm nay</h3>
            <p className="text-xs text-black/40 mt-0.5">Xếp theo mức yêu thích của công nhân</p>
          </div>
          {!data.topDishVotes || data.topDishVotes.length === 0 ? (
            <EmptyState icon={ThumbsUp} title="Chưa có bình chọn" hint="Công nhân chưa đánh giá món hôm nay" />
          ) : (
            <ul className="space-y-2 stagger">
              {data.topDishVotes.map((d, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-black/10 px-3 py-2">
                  <span className="text-sm font-semibold text-black/30 w-4 shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium text-black flex-1 truncate">{d.name}</span>
                  <span className="flex items-center gap-1 text-sm text-black shrink-0"><ThumbsUp size={13} /> {d.liked}</span>
                  <span className="flex items-center gap-1 text-sm text-black/50 shrink-0"><ThumbsDown size={13} /> {d.disliked}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
