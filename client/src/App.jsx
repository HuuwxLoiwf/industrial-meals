import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { getToken } from './lib/api.js';
import { fetchMe } from './store/meSlice.js';
import { connectSocket } from './lib/socket.js';

import Layout from './components/Layout.jsx';
import SignInPage from './pages/SignInPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RegisterMealPage from './pages/RegisterMealPage.jsx';
import SummaryPage from './pages/SummaryPage.jsx';
import PrepMealPage from './pages/PrepMealPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import MenuAdminPage from './pages/MenuAdminPage.jsx';
import BatchRegisterPage from './pages/BatchRegisterPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import MyMealPage from './pages/MyMealPage.jsx';
import MenuBoardPage from './pages/MenuBoardPage.jsx';
import FeedbackAdminPage from './pages/FeedbackAdminPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';

export default function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const profile = useSelector((s) => s.me.profile);
  const status = useSelector((s) => s.me.status);
  const role = profile?.role;

  // Trang chủ tùy vai trò:
  // ADMIN/MANAGER/CANTEEN -> dashboard/lô; EMPLOYEE không có chức năng -> trang thông tin.
  let home = '/dashboard';
  if (role === 'MANAGER') home = '/dang-ky-lo';
  else if (role === 'EMPLOYEE') home = '/thong-tin';

  // Có token nhưng chưa có profile -> nạp hồ sơ.
  useEffect(() => {
    if (getToken() && !profile) {
      dispatch(fetchMe());
    }
  }, [dispatch, profile]);

  // Có hồ sơ hợp lệ -> mở kết nối realtime (gửi kèm JWT để server xác thực).
  useEffect(() => {
    if (profile) connectSocket();
  }, [profile]);

  // Chưa đăng nhập (không có token) -> chỉ cho vào trang login / đăng ký tài khoản.
  if (!getToken()) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/dang-ky-tai-khoan" element={<SignUpPage />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }

  // Có token nhưng đang nạp hồ sơ.
  if (!profile && status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-black/40">
        Đang tải...
      </div>
    );
  }

  // Token có nhưng nạp hồ sơ thất bại (vd bị vô hiệu hóa) -> báo lỗi.
  if (!profile) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }

  // Ép đổi mật khẩu lần đầu — chặn toàn bộ ứng dụng cho tới khi đổi xong.
  if (profile.mustChangePassword) {
    return <ChangePasswordPage forced />;
  }

  // Trang trình chiếu thực đơn: render NGOÀI Layout (toàn màn hình cho TV nhà ăn).
  if (location.pathname === '/trinh-chieu') {
    return (
      <Routes>
        <Route
          path="/trinh-chieu"
          element={
            <Guard ok={role === 'CANTEEN' || role === 'ADMIN'} home={home}>
              <MenuBoardPage />
            </Guard>
          }
        />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/sign-in" element={<Navigate to={home} replace />} />
        <Route path="/doi-mat-khau" element={<ChangePasswordPage />} />
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/thong-tin" element={<MyMealPage />} />
        <Route path="/dashboard" element={<Guard ok={role !== 'EMPLOYEE'} home={home}><DashboardPage /></Guard>} />
        {/* Đăng ký đơn lẻ (trường hợp đặc biệt): chỉ ADMIN */}
        <Route path="/dang-ky" element={<Guard ok={role === 'ADMIN'} home={home}><RegisterMealPage /></Guard>} />
        {/* Đăng ký theo lô: MANAGER + ADMIN */}
        <Route path="/dang-ky-lo" element={<Guard ok={role === 'MANAGER' || role === 'ADMIN'} home={home}><BatchRegisterPage /></Guard>} />
        <Route path="/tong-hop" element={<Guard ok={role !== 'EMPLOYEE'} home={home}><SummaryPage /></Guard>} />
        <Route path="/chuan-bi" element={<Guard ok={role === 'CANTEEN' || role === 'ADMIN' || role === 'MANAGER'} home={home}><PrepMealPage /></Guard>} />
        <Route path="/thuc-don" element={<Guard ok={role === 'CANTEEN' || role === 'ADMIN'} home={home}><MenuAdminPage /></Guard>} />
        <Route path="/gop-y" element={<Guard ok={role === 'CANTEEN' || role === 'ADMIN'} home={home}><FeedbackAdminPage /></Guard>} />
        <Route path="/bao-cao" element={<Guard ok={role === 'MANAGER' || role === 'ADMIN'} home={home}><ReportPage /></Guard>} />
        <Route path="/quan-tri" element={<Guard ok={role === 'ADMIN'} home={home}><AdminPage /></Guard>} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}

// Bảo vệ route theo vai trò: không đủ quyền -> đưa về trang chủ hợp lệ.
function Guard({ ok, home, children }) {
  if (!ok) return <Navigate to={home} replace />;
  return children;
}

