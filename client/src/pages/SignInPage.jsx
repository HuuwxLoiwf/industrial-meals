import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';
import { login } from '../store/meSlice.js';

export default function SignInPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const error = useSelector((s) => s.me.error);
  const status = useSelector((s) => s.me.status);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const action = await dispatch(login({ email, password }));
    if (!action.error) navigate('/', { replace: true });
  };

  const loading = status === 'loading';

  return (
    <div className="min-h-screen bg-auth flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 rounded-xl overflow-hidden ring-1 ring-black/10 bg-white">
        {/* Cột giới thiệu — color-block lime, đúng vai trò "systems" block trong hệ Figma */}
        <div className="hidden lg:flex flex-col justify-between bg-block-lime p-10 text-black">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-black text-white flex items-center justify-center font-medium text-xl">
              U
            </div>
            <div>
              <div className="font-medium text-lg tracking-tight">UMC Việt Nam</div>
              <div className="text-black/60 text-sm font-mono uppercase tracking-wide">Hệ thống quản lý suất ăn</div>
            </div>
          </div>

          <div>
            <h2 className="text-[32px] font-medium leading-[1.1] tracking-tight">
              Quản lý suất ăn công nghiệp thông minh
            </h2>
            <p className="text-black/70 text-base mt-4 leading-relaxed">
              Đăng ký theo lô, tổng hợp theo phòng ban, phát cơm bằng mã QR —
              tối ưu cho nhà máy quy mô lớn.
            </p>
          </div>

          <div className="text-black/50 text-xs font-mono uppercase tracking-wide">© {new Date().getFullYear()} UMC Việt Nam</div>
        </div>

        {/* Cột form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-[28px] font-medium text-black tracking-tight">Đăng nhập</h1>
            <p className="text-black/50 text-sm mt-1">Nhập email và mật khẩu để tiếp tục</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-black mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" />
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-black mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                />
              </div>
            </div>

            {error && (
              <div className="bg-block-coral text-black text-sm rounded-md px-3.5 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-black hover:bg-black/85 text-white rounded-pill py-3 text-sm font-medium transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p className="text-sm text-black/50 mt-5 text-center">
            Chưa có tài khoản?{' '}
            <button onClick={() => navigate('/dang-ky-tai-khoan')} className="text-black font-medium hover:underline">
              Đăng ký tài khoản
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
