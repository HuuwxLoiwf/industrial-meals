import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { KeyRound, Loader2 } from 'lucide-react';
import api from '../lib/api.js';
import { fetchMe } from '../store/meSlice.js';

// Trang đổi mật khẩu. Dùng cho cả ép đổi lần đầu (forced) và đổi tự nguyện.
export default function ChangePasswordPage({ forced = false }) {
  const dispatch = useDispatch();
  const profile = useSelector((s) => s.me.profile);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return setMsg({ ok: false, text: 'Mật khẩu mới tối thiểu 6 ký tự' });
    if (newPassword !== confirm) return setMsg({ ok: false, text: 'Xác nhận mật khẩu không khớp' });
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/auth/change-password', { oldPassword, newPassword });
      await dispatch(fetchMe()); // cập nhật mustChangePassword = false
      setMsg({ ok: true, text: 'Đổi mật khẩu thành công' });
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'Đổi mật khẩu thất bại' });
    } finally {
      setBusy(false);
    }
  };

  const inner = (
    <div className="w-full max-w-md bg-white rounded-lg ring-1 ring-black/10 p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-full bg-block-lilac text-black flex items-center justify-center">
          <KeyRound size={20} />
        </div>
        <div>
          <h1 className="font-bold text-black text-lg">Đổi mật khẩu</h1>
          {forced && (
            <p className="text-xs text-black/70">
              Đây là lần đăng nhập đầu — vui lòng đổi mật khẩu để tiếp tục.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3 mt-4">
        {!forced && (
          <div>
            <label className="text-sm font-medium text-black mb-1 block">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full ring-1 ring-black/15 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-black mb-1 block">Mật khẩu mới</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            className="w-full ring-1 ring-black/15 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-black mb-1 block">Xác nhận mật khẩu mới</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full ring-1 ring-black/15 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
          />
        </div>

        {msg && (
          <div
            className={`text-sm rounded-lg px-3 py-2 ${
              msg.ok ? 'bg-block-lime text-black' : 'bg-block-coral text-black'
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-black hover:bg-black/85 text-white rounded-pill py-2.5 text-sm font-semibold transition disabled:opacity-50"
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          Đổi mật khẩu
        </button>
      </form>
    </div>
  );

  // Forced: full màn hình chặn. Bình thường: nằm trong Layout.
  if (forced) {
    return (
      <div className="min-h-screen bg-auth flex items-center justify-center p-4">
        <div>
          <div className="text-center mb-4">
            <div className="text-black/50 text-sm">Xin chào, {profile?.fullName}</div>
          </div>
          {inner}
        </div>
      </div>
    );
  }
  return <div className="flex justify-center py-4">{inner}</div>;
}
