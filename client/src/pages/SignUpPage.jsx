import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Building2, UserPlus, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../lib/api.js';

// Trang tự đăng ký tài khoản (dành cho trưởng bộ phận / leader của một line).
// Gửi yêu cầu -> ADMIN xét duyệt -> mới đăng nhập được.
export default function SignUpPage() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    departmentId: '',
    employeeCode: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get('/public/departments').then((r) => setDepartments(r.data)).catch(() => setDepartments([]));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.fullName.trim()) return setError('Vui lòng nhập họ tên');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Email không hợp lệ');
    if (form.password.length < 6) return setError('Mật khẩu tối thiểu 6 ký tự');
    if (form.password !== form.confirmPassword) return setError('Mật khẩu nhập lại không khớp');
    if (!form.departmentId) return setError('Vui lòng chọn bộ phận bạn phụ trách');

    setLoading(true);
    try {
      await api.post('/account-requests', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        departmentId: form.departmentId,
        employeeCode: form.employeeCode || null,
        phone: form.phone || null,
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Gửi yêu cầu thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-auth flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl ring-1 ring-black/10 p-8 text-center animate-pop">
          <div className="h-14 w-14 rounded-full bg-block-lime flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-black" />
          </div>
          <h1 className="text-[24px] font-medium text-black tracking-tight">Đã gửi yêu cầu</h1>
          <p className="text-black/60 text-sm mt-2 leading-relaxed">
            Yêu cầu mở tài khoản của bạn đã được gửi tới quản trị viên. Bạn sẽ đăng nhập được
            bằng email và mật khẩu vừa đặt <b>sau khi được duyệt</b>.
          </p>
          <button
            onClick={() => navigate('/sign-in')}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-black hover:bg-black/85 text-white rounded-pill py-3 text-sm font-medium transition"
          >
            Về trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-auth flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 rounded-xl overflow-hidden ring-1 ring-black/10 bg-white">
        {/* Cột giới thiệu */}
        <div className="hidden lg:flex flex-col justify-between bg-block-lilac p-10 text-black">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-black text-white flex items-center justify-center font-medium text-xl">U</div>
            <div>
              <div className="font-medium text-lg tracking-tight">UMC Việt Nam</div>
              <div className="text-black/60 text-sm font-mono uppercase tracking-wide">Đăng ký tài khoản</div>
            </div>
          </div>
          <div>
            <h2 className="text-[32px] font-medium leading-[1.1] tracking-tight">
              Đăng ký tài khoản trưởng bộ phận
            </h2>
            <p className="text-black/70 text-base mt-4 leading-relaxed">
              Dành cho trưởng bộ phận / leader của line phụ trách việc báo số suất ăn hằng ngày.
              Tài khoản cần được quản trị viên duyệt trước khi sử dụng.
            </p>
          </div>
          <div className="text-black/50 text-xs font-mono uppercase tracking-wide">© {new Date().getFullYear()} UMC Việt Nam</div>
        </div>

        {/* Cột form */}
        <div className="p-8 sm:p-10 max-h-screen overflow-y-auto">
          <button onClick={() => navigate('/sign-in')} className="flex items-center gap-1.5 text-sm text-black/50 hover:text-black mb-4 transition">
            <ArrowLeft size={16} /> Quay lại đăng nhập
          </button>
          <div className="mb-6">
            <h1 className="text-[28px] font-medium text-black tracking-tight">Tạo tài khoản</h1>
            <p className="text-black/50 text-sm mt-1">Điền thông tin, quản trị viên sẽ xét duyệt</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Họ tên" icon={User}>
              <input
                value={form.fullName}
                onChange={(e) => set({ fullName: e.target.value })}
                placeholder="Nguyễn Văn A"
                className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
            </Field>

            <Field label="Email" icon={Mail}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="leader@congty.com"
                className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
            </Field>

            <div>
              <label className="text-sm font-medium text-black mb-1.5 block">Bộ phận / Line phụ trách</label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" />
                <select
                  value={form.departmentId}
                  onChange={(e) => set({ departmentId: e.target.value })}
                  className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm bg-white focus:ring-2 focus:ring-black focus:outline-none transition"
                >
                  <option value="">— Chọn bộ phận —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <Field label="Mật khẩu" icon={Lock}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
            </Field>

            <Field label="Nhập lại mật khẩu" icon={Lock}>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => set({ confirmPassword: e.target.value })}
                placeholder="••••••"
                className="w-full ring-1 ring-black/15 rounded-md pl-11 pr-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-black mb-1.5 block">Mã NV <span className="text-black/40 font-normal">(nếu có)</span></label>
                <input
                  value={form.employeeCode}
                  onChange={(e) => set({ employeeCode: e.target.value })}
                  className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-black mb-1.5 block">Số điện thoại</label>
                <input
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className="w-full ring-1 ring-black/15 rounded-md px-3.5 py-3 text-sm focus:ring-2 focus:ring-black focus:outline-none transition"
                />
              </div>
            </div>

            {error && <div className="bg-block-coral text-black text-sm rounded-md px-3.5 py-3">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-black hover:bg-black/85 text-white rounded-pill py-3 text-sm font-medium transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              {loading ? 'Đang gửi...' : 'Gửi yêu cầu đăng ký'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-black mb-1.5 block">{label}</label>
      <div className="relative">
        <Icon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" />
        {children}
      </div>
    </div>
  );
}
