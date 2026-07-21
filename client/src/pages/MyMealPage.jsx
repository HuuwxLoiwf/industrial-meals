import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Utensils, Package, Moon, Info, ThumbsUp, ThumbsDown } from 'lucide-react';
import api, { assetUrl } from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { PageTitle, Card, EmptyState, todayStr } from '../components/ui.jsx';

const CATEGORY_LABEL = {
  MAIN: 'Món chính',
  SIDE: 'Món phụ',
  DESSERT: 'Tráng miệng',
  ALTERNATIVE: 'Món cải tiến',
};

// Trang cho EMPLOYEE: xem thực đơn hôm nay + suất ăn phòng ban mình được báo.
export default function MyMealPage() {
  const profile = useSelector((s) => s.me.profile);
  const [date, setDate] = useState(todayStr());
  const [menu, setMenu] = useState(null);
  const [dept, setDept] = useState(null);
  const [myVotes, setMyVotes] = useState({});

  const load = useCallback(async () => {
    const [menuRes, deptRes, votesRes] = await Promise.all([
      api.get('/menus', { params: { date } }),
      api.get('/batches/my-department', { params: { date } }),
      api.get('/dish-votes/mine', { params: { date } }),
    ]);
    setMenu(menuRes.data);
    setDept(deptRes.data);
    setMyVotes(Object.fromEntries(votesRes.data.map((v) => [v.dishId, v.liked])));
  }, [date]);

  const vote = useCallback(
    async (dishId, liked) => {
      setMyVotes((prev) => ({ ...prev, [dishId]: liked }));
      try {
        await api.post('/dish-votes', { dishId, menuDate: date, liked });
      } catch {
        load();
      }
    },
    [date, load]
  );

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

  const items = menu?.items || [];
  const grouped = items.reduce((acc, it) => {
    (acc[it.dish.category] ??= []).push(it.dish);
    return acc;
  }, {});

  return (
    <div>
      <PageTitle title={`Xin chào, ${profile?.fullName || ''}`} subtitle="Thực đơn & suất ăn của phòng ban bạn">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
      </PageTitle>

      {/* Suất ăn phòng ban */}
      <Card className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Package size={18} className="text-black" />
          <h2 className="font-semibold text-black">
            Suất ăn phòng {dept?.department || 'bạn'} — ngày {date}
          </h2>
        </div>
        {!dept?.department ? (
          <div className="flex items-start gap-2.5 rounded-lg bg-block-cream text-black text-sm px-4 py-3">
            <Info size={18} className="shrink-0 mt-0.5" />
            <span>Bạn chưa được gán bộ phận. Vui lòng liên hệ quản trị viên.</span>
          </div>
        ) : dept.batches.length === 0 ? (
          <EmptyState icon={Package} title="Chưa có suất ăn nào" hint="Trưởng bộ phận chưa báo suất ăn cho ngày này" />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 text-black/40">
              <span className="text-3xl font-bold text-black">{dept.total}</span>
              <span className="text-sm">suất được báo cho phòng bạn</span>
            </div>
            <div className="space-y-2 stagger">
              {dept.batches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-2.5 hover:border-black/30 transition-colors">
                  <div>
                    <div className="font-medium text-black flex items-center gap-2">
                      {b.mealShift?.name}
                      {b.batchType === 'OVERTIME_INTERN' && (
                        <span className="inline-flex items-center gap-1 text-xs text-black/70">
                          <Moon size={13} /> Tăng ca TTS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-black/40">
                      {b.mealShift?.startTime} - {b.mealShift?.endTime}
                      {b.createdBy?.fullName && ` · Báo bởi ${b.createdBy.fullName}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-black">{b.qtyStandard + b.qtyAlternative} suất</div>
                    <div className="text-xs text-black/40">
                      {b.qtyStandard} thường{b.qtyAlternative > 0 ? ` · ${b.qtyAlternative} cải tiến` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Thực đơn hôm nay */}
      <Card>
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
                      <DishCard key={dish.id} dish={dish} liked={myVotes[dish.id]} onVote={(liked) => vote(dish.id, liked)} />
                    ))}
                  </div>
                </div>
              )
          )
        )}
      </Card>

      {/* Góp ý về bữa ăn */}
      <FeedbackSection date={date} />
    </div>
  );
}

const RATING_OPTIONS = [
  { value: 'GOOD', label: '😋 Ngon' },
  { value: 'NORMAL', label: '😐 Bình thường' },
  { value: 'BAD', label: '😞 Chưa ngon' },
];

// Công nhân gửi góp ý về bữa ăn + xem lịch sử góp ý và phản hồi từ nhà ăn.
function FeedbackSection({ date }) {
  const [content, setContent] = useState('');
  const [rating, setRating] = useState('');
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState([]);

  const load = useCallback(() => api.get('/feedback/mine').then((r) => setMine(r.data)), []);
  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      await api.post('/feedback', { content, rating: rating || null, mealDate: date });
      setContent('');
      setRating('');
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Gửi góp ý thất bại');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="mt-5">
      <div className="flex items-center gap-2 mb-4">
        <Info size={18} className="text-black" />
        <h2 className="font-semibold text-black">Góp ý về bữa ăn</h2>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {RATING_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setRating(rating === o.value ? '' : o.value)}
              className={`px-3.5 py-1.5 rounded-pill text-sm font-medium transition ${
                rating === o.value ? 'bg-black text-white' : 'bg-surface-soft text-black/60 hover:text-black'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Chia sẻ ý kiến của bạn về chất lượng, khẩu vị, vệ sinh bữa ăn..."
          rows={3}
          maxLength={1000}
          className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="px-5 py-2 rounded-pill bg-black text-white text-sm font-medium disabled:opacity-50 active:scale-[0.97] transition"
        >
          {sending ? 'Đang gửi...' : 'Gửi góp ý'}
        </button>
      </form>

      {mine.length > 0 && (
        <div className="mt-5 space-y-2">
          <div className="text-xs font-mono uppercase tracking-wide text-black/40">Góp ý của bạn</div>
          {mine.map((f) => (
            <div key={f.id} className="rounded-lg border border-black/10 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-black">{f.content}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${f.status === 'RESOLVED' ? 'bg-block-lime text-black' : 'bg-block-cream text-black'}`}>
                  {f.status === 'RESOLVED' ? 'Đã phản hồi' : 'Chờ xử lý'}
                </span>
              </div>
              {f.reply && (
                <div className="mt-2 text-xs text-black/60 bg-surface-soft rounded-md px-3 py-2">
                  <b>Nhà ăn phản hồi:</b> {f.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DishCard({ dish, liked, onVote }) {
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
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <button
          onClick={() => onVote(true)}
          title="Thích món này"
          className={`h-6 w-6 rounded-full flex items-center justify-center transition ${
            liked === true ? 'bg-block-lime text-black' : 'text-black/30 hover:bg-black/5'
          }`}
        >
          <ThumbsUp size={12} />
        </button>
        <button
          onClick={() => onVote(false)}
          title="Không thích món này"
          className={`h-6 w-6 rounded-full flex items-center justify-center transition ${
            liked === false ? 'bg-block-coral text-black' : 'text-black/30 hover:bg-black/5'
          }`}
        >
          <ThumbsDown size={12} />
        </button>
      </div>
    </div>
  );
}
