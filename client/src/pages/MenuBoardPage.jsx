import { useEffect, useState, useCallback } from 'react';
import { Utensils, Maximize2, Minimize2, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { assetUrl } from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { todayStr } from '../components/ui.jsx';

// MÀN HÌNH TRÌNH CHIẾU THỰC ĐƠN — mở trên TV/bảng lớn tại nhà ăn.
// Bố cục poster theo design system: món chính A (khối lime, trái) — món chính B
// (khối lilac, phải) — dải cream bên dưới cho món cải tiến + món phụ/tráng miệng.
// Tự cập nhật realtime khi nhà ăn đổi thực đơn; đồng hồ chạy từng giây.
export default function MenuBoardPage() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null);
  const [voteStats, setVoteStats] = useState({});
  const [boardSummary, setBoardSummary] = useState(null);
  const [thanks, setThanks] = useState(false);
  const [now, setNow] = useState(new Date());
  const [isFull, setIsFull] = useState(false);

  const load = useCallback(async () => {
    const [menuRes, votesRes, boardRes] = await Promise.all([
      api.get('/menus', { params: { date: todayStr() } }),
      api.get('/dish-votes/stats', { params: { date: todayStr() } }),
      api.get('/board/quick-rating/summary'),
    ]);
    setMenu(menuRes.data);
    setVoteStats(Object.fromEntries(votesRes.data.map((s) => [s.dish.id, s])));
    setBoardSummary(boardRes.data);
  }, []);

  // Đánh giá nhanh ẩn danh ngay trên màn hình TV (không cần đăng nhập).
  const sendQuickRating = useCallback(
    async (rating) => {
      try {
        await api.post('/board/quick-rating', { rating });
        setThanks(true);
        setTimeout(() => setThanks(false), 2000);
        const r = await api.get('/board/quick-rating/summary');
        setBoardSummary(r.data);
      } catch {
        /* bỏ qua lỗi mạng tạm thời trên màn hình công cộng */
      }
    },
    []
  );

  // Nạp thực đơn + tự làm mới mỗi 5 phút (phòng khi socket rớt trên TV treo lâu ngày).
  useEffect(() => {
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  // Realtime: nhà ăn sửa thực đơn hoặc có bình chọn mới -> bảng cập nhật ngay.
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

  // Đồng hồ chạy từng giây.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFull(true);
    } else {
      document.exitFullscreen?.();
      setIsFull(false);
    }
  };

  const items = menu?.items || [];
  const dishes = items.map((i) => i.dish);
  const mains = dishes.filter((d) => d.category === 'MAIN');
  const alternatives = dishes.filter((d) => d.category === 'ALTERNATIVE');
  const sides = dishes.filter((d) => d.category === 'SIDE');
  const desserts = dishes.filter((d) => d.category === 'DESSERT');

  const dishA = mains[0] || null;
  const dishB = mains[1] || null;
  const extraMains = mains.slice(2);

  const dateLabel = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Dải đen trên cùng: eyebrow + đồng hồ (marquee-strip style) */}
      <div className="bg-inverse-canvas text-inverse-ink flex items-center justify-between px-8 py-3">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 rounded-full bg-white text-black flex items-center justify-center font-medium">U</div>
          <span className="font-eyebrow text-sm text-white/70">UMC Việt Nam — Nhà ăn</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-eyebrow text-sm text-white/70 capitalize">{dateLabel}</span>
          <span className="font-mono text-2xl font-medium tabular-nums">{timeLabel}</span>
          <button
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition"
            title="Toàn màn hình"
          >
            {isFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={() => navigate('/thuc-don')}
            className="h-9 w-9 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition"
            title="Thoát trình chiếu"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tiêu đề */}
      <div className="text-center pt-8 pb-6 animate-in">
        <div className="font-eyebrow text-sm text-black/50 mb-2">Thực đơn hôm nay</div>
        <h1 className="font-display text-5xl font-light text-ink">Hôm nay ăn gì?</h1>
      </div>

      {dishes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-black/40 animate-fade">
          <Utensils size={56} className="mb-4" />
          <div className="text-2xl font-light">Nhà ăn chưa cập nhật thực đơn hôm nay</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 px-8 pb-8 max-w-[1600px] w-full mx-auto">
          {/* Hai món chính chia đôi màn hình 50/50: A trái (lime) — B phải (lilac) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 stagger">
            <MainDishBlock dish={dishA} label="Món chính A" surface="bg-block-lime" votes={dishA && voteStats[dishA.id]} />
            <MainDishBlock dish={dishB} label="Món chính B" surface="bg-block-lilac" votes={dishB && voteStats[dishB.id]} />
          </div>

          {/* Dải dưới ngang: món phụ + tráng miệng + món cải tiến chung một hàng */}
          <div className="bg-block-cream rounded-lg p-6 animate-in">
            <div className="font-eyebrow text-xs text-black/50 mb-3">Món phụ · Tráng miệng · Món cải tiến</div>
            {sides.length + desserts.length + alternatives.length + extraMains.length === 0 ? (
              <div className="text-black/40 text-lg font-light">Hôm nay chưa có món phụ / cải tiến</div>
            ) : (
              <div className="flex flex-wrap items-stretch gap-4">
                {[...sides, ...desserts].map((d) => (
                  <SmallDish key={d.id} dish={d} />
                ))}
                {[...alternatives, ...extraMains].map((d) => (
                  <SmallDish key={d.id} dish={d} big accent />
                ))}
              </div>
            )}
          </div>

          {/* Thanh đánh giá nhanh — công nhân bấm ngay trên màn hình, không cần đăng nhập */}
          <QuickRatingBar summary={boardSummary} thanks={thanks} onRate={sendQuickRating} />
        </div>
      )}
    </div>
  );
}

// Thanh đánh giá nhanh ẩn danh ngay trên TV nhà ăn.
function QuickRatingBar({ summary, thanks, onRate }) {
  const OPTIONS = [
    { value: 'GOOD', emoji: '😋', label: 'Ngon', key: 'good', surface: 'hover:bg-block-lime' },
    { value: 'NORMAL', emoji: '😐', label: 'Bình thường', key: 'normal', surface: 'hover:bg-block-cream' },
    { value: 'BAD', emoji: '😞', label: 'Chưa ngon', key: 'bad', surface: 'hover:bg-block-coral' },
  ];
  return (
    <div className="bg-inverse-canvas text-inverse-ink rounded-lg px-8 py-5 flex items-center justify-between gap-6 flex-wrap animate-in">
      <div>
        <div className="font-eyebrow text-xs text-white/50 mb-1">Đánh giá bữa ăn hôm nay</div>
        <div className="text-2xl font-light">
          {thanks ? 'Cảm ơn bạn đã đánh giá! 🎉' : 'Bữa ăn hôm nay thế nào?'}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onRate(o.value)}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg bg-white/10 ${o.surface} hover:text-black transition-all duration-200 active:scale-95 px-7 py-3 min-w-[120px]`}
          >
            <span className="text-4xl leading-none">{o.emoji}</span>
            <span className="text-sm font-medium">{o.label}</span>
            {summary && <span className="text-xs opacity-70 font-mono">{summary[o.key]} lượt</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Khối món chính cỡ lớn (poster): ảnh to + tên món display size.
function MainDishBlock({ dish, label, surface, votes }) {
  const img = dish ? assetUrl(dish.imageUrl) : null;
  return (
    <div className={`${surface} rounded-lg p-8 flex flex-col animate-in`}>
      <div className="flex items-center justify-between mb-4">
        <div className="font-eyebrow text-sm text-black/55">{label}</div>
        {votes && (votes.liked > 0 || votes.disliked > 0) && (
          <div className="flex items-center gap-3 bg-white/60 rounded-pill px-3 py-1">
            <span className="flex items-center gap-1 text-sm font-medium text-black"><ThumbsUp size={14} /> {votes.liked}</span>
            <span className="flex items-center gap-1 text-sm font-medium text-black/50"><ThumbsDown size={14} /> {votes.disliked}</span>
          </div>
        )}
      </div>
      {!dish ? (
        <div className="flex-1 flex items-center justify-center text-black/35 text-xl font-light">
          Chưa có món
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center justify-center min-h-[220px]">
            {img ? (
              <img
                src={img}
                alt={dish.name}
                className="max-h-[38vh] max-w-full object-contain rounded-md"
              />
            ) : (
              <Utensils size={80} className="text-black/20" />
            )}
          </div>
          <div className="mt-6">
            <div className="font-display text-4xl font-medium text-ink leading-tight">{dish.name}</div>
            {dish.description && (
              <div className="text-black/60 text-lg font-light mt-2">{dish.description}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Món nhỏ trong dải dưới. accent = món cải tiến (làm nổi bật, gắn nhãn).
function SmallDish({ dish, big = false, accent = false }) {
  const img = assetUrl(dish.imageUrl);
  const size = big ? 'h-24 w-32' : 'h-20 w-24';
  return (
    <div className={`flex items-center gap-3 rounded-md p-2.5 pr-5 ${accent ? 'bg-white ring-2 ring-block-lilac' : 'bg-white/55'}`}>
      <div className={`${size} rounded-sm overflow-hidden bg-white flex items-center justify-center shrink-0`}>
        {img ? (
          <img src={img} alt={dish.name} className="h-full w-full object-contain" />
        ) : (
          <Utensils size={22} className="text-black/25" />
        )}
      </div>
      <div>
        {accent && <div className="font-eyebrow text-[10px] text-black/45 mb-0.5">Món cải tiến</div>}
        <div className={`font-medium text-ink ${big ? 'text-xl' : 'text-base'}`}>{dish.name}</div>
      </div>
    </div>
  );
}
