import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import api from '../lib/api.js';
import { socket } from '../lib/socket.js';
import { PageTitle, Card, Button, EmptyState, Tabs, todayStr } from '../components/ui.jsx';

const RATING_LABEL = {
  GOOD: { text: '😋 Ngon', cls: 'bg-block-lime text-black' },
  NORMAL: { text: '😐 Bình thường', cls: 'bg-block-cream text-black' },
  BAD: { text: '😞 Chưa ngon', cls: 'bg-block-coral text-black' },
};

// Trang nhà ăn/admin xem & phản hồi góp ý của công nhân về bữa ăn.
export default function FeedbackAdminPage() {
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState([]);
  const [replyMap, setReplyMap] = useState({});

  const load = useCallback(async () => {
    const res = await api.get('/feedback', { params: status === 'ALL' ? {} : { status } });
    setList(res.data);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load();
    socket.on('feedback:created', refresh);
    return () => socket.off('feedback:created', refresh);
  }, [load]);

  const sendReply = async (id) => {
    const reply = (replyMap[id] || '').trim();
    if (!reply) return;
    await api.patch(`/feedback/${id}/reply`, { reply });
    setReplyMap((m) => ({ ...m, [id]: '' }));
    load();
  };

  return (
    <div>
      <PageTitle title="Góp ý bữa ăn" subtitle="Phản hồi ý kiến của công nhân về chất lượng suất ăn" />

      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[
          { value: 'OPEN', label: 'Chờ xử lý' },
          { value: 'RESOLVED', label: 'Đã phản hồi' },
          { value: 'ALL', label: 'Tất cả' },
        ]}
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={MessageSquare} title="Không có góp ý" hint="Góp ý mới của công nhân sẽ hiển thị tại đây" />
        </Card>
      ) : (
        <div className="space-y-3 stagger">
          {list.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-black">{f.employee?.fullName || 'Ẩn danh'}</span>
                    <span className="text-xs text-black/40">
                      {f.employee?.department?.name || '—'} · {new Date(f.mealDate).toLocaleDateString('vi-VN')}
                    </span>
                    {f.rating && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${RATING_LABEL[f.rating].cls}`}>
                        {RATING_LABEL[f.rating].text}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-black/80 mt-2">{f.content}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${f.status === 'RESOLVED' ? 'bg-block-lime text-black' : 'bg-block-cream text-black'}`}>
                  {f.status === 'RESOLVED' ? 'Đã phản hồi' : 'Chờ xử lý'}
                </span>
              </div>

              {f.status === 'RESOLVED' ? (
                <div className="mt-3 text-sm text-black/60 bg-surface-soft rounded-md px-3 py-2">
                  <b>Phản hồi{f.repliedByName ? ` (${f.repliedByName})` : ''}:</b> {f.reply}
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    value={replyMap[f.id] || ''}
                    onChange={(e) => setReplyMap((m) => ({ ...m, [f.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && sendReply(f.id)}
                    placeholder="Nhập phản hồi cho công nhân..."
                    className="flex-1 ring-1 ring-black/15 rounded-md px-3.5 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                  />
                  <Button size="sm" onClick={() => sendReply(f.id)}>
                    <Send size={14} /> Gửi
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
