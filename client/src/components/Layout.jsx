import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchNotifications, markAllRead } from '../store/notificationsSlice.js';
import { socket } from '../lib/socket.js';
import {
  LayoutDashboard,
  PackagePlus,
  ClipboardList,
  Table2,
  UtensilsCrossed,
  Utensils,
  MonitorPlay,
  ChefHat,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  KeyRound,
  Bell,
} from 'lucide-react';
import { logout } from '../store/meSlice.js';

// Menu chia nhóm, mỗi mục có icon Lucide, hiển thị theo role.
const NAV_GROUPS = [
  {
    title: 'Tổng quan',
    items: [
      { to: '/dashboard', label: 'Bảng điều khiển', icon: LayoutDashboard, roles: ['MANAGER', 'ADMIN', 'CANTEEN'] },
      { to: '/thong-tin', label: 'Suất ăn của tôi', icon: Utensils, roles: ['EMPLOYEE'] },
    ],
  },
  {
    title: 'Suất ăn',
    items: [
      { to: '/dang-ky-lo', label: 'Đăng ký theo lô', icon: PackagePlus, roles: ['MANAGER', 'ADMIN'] },
      { to: '/dang-ky', label: 'Đăng ký suất ăn', icon: ClipboardList, roles: ['ADMIN'] },
      { to: '/tong-hop', label: 'Tổng hợp', icon: Table2, roles: ['MANAGER', 'ADMIN', 'CANTEEN'] },
      { to: '/chuan-bi', label: 'Chuẩn bị suất ăn', icon: UtensilsCrossed, roles: ['CANTEEN', 'ADMIN', 'MANAGER'] },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { to: '/thuc-don', label: 'Quản lý thực đơn', icon: ChefHat, roles: ['CANTEEN', 'ADMIN'] },
      { to: '/trinh-chieu', label: 'Trình chiếu thực đơn', icon: MonitorPlay, roles: ['CANTEEN', 'ADMIN'] },
      { to: '/gop-y', label: 'Góp ý bữa ăn', icon: MessageSquare, roles: ['CANTEEN', 'ADMIN'] },
      { to: '/bao-cao', label: 'Báo cáo', icon: BarChart3, roles: ['MANAGER', 'ADMIN'] },
      { to: '/quan-tri', label: 'Quản trị', icon: Settings, roles: ['ADMIN'] },
    ],
  },
];

const ROLE_LABEL = {
  EMPLOYEE: 'Nhân viên',
  MANAGER: 'Trưởng bộ phận',
  CANTEEN: 'Nhà ăn',
  ADMIN: 'Quản trị viên',
};

export default function Layout({ children }) {
  const profile = useSelector((s) => s.me.profile);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const role = profile?.role || 'EMPLOYEE';
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notiOpen, setNotiOpen] = useState(false);
  const { items: notifications, unread } = useSelector((s) => s.notifications);

  // Nạp thông báo + lắng nghe realtime.
  useEffect(() => {
    dispatch(fetchNotifications());
    const onNew = () => dispatch(fetchNotifications());
    socket.on('notification:created', onNew);
    return () => socket.off('notification:created', onNew);
  }, [dispatch]);

  const openNoti = () => {
    setNotiOpen((v) => !v);
    if (unread > 0) dispatch(markAllRead());
  };

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => n.roles.includes(role)),
  })).filter((g) => g.items.length > 0);

  const initials = (profile?.fullName || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase();

  const SidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center font-medium text-black">
          U
        </div>
        <div className="leading-tight">
          <div className="font-medium text-white text-[15px] tracking-tight">UMC Việt Nam</div>
          <div className="text-[11px] font-mono uppercase tracking-wide text-white/40">Quản lý suất ăn</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-2 text-[11px] font-mono uppercase tracking-wide text-white/35">
              {group.title}
            </div>
            <ul className="space-y-1">
              {group.items.map((n) => {
                const Icon = n.icon;
                return (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 px-3 py-2.5 rounded-pill text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-white text-black'
                            : 'text-white/60 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={18}
                            strokeWidth={2}
                            className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? '' : ''}`}
                          />
                          {n.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          onClick={() => dispatch(logout())}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-pill text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          <LogOut size={18} />
          Đăng xuất
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar desktop */}
      <aside className="w-64 shrink-0 bg-black hidden md:flex flex-col">
        {SidebarContent}
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-black flex flex-col animate-slide-left">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-black/10 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-black/60 hover:text-black"
            >
              <Menu size={22} />
            </button>
            <div className="text-sm text-black/40 hidden sm:block">
              Xin chào, <span className="text-black font-medium">{profile?.fullName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Chuông thông báo */}
            <div className="relative">
              <button onClick={openNoti} className="relative text-black/60 hover:text-black transition-transform active:scale-90">
                <Bell size={20} className={unread > 0 ? 'animate-[shake_0.5s_ease]' : ''} />
                {unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-accent-magenta text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unread}
                  </span>
                )}
              </button>
              {notiOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotiOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg ring-1 ring-black/10 py-1 z-50 animate-pop origin-top-right" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                    <div className="px-4 py-2 border-b border-black/5 text-sm font-medium text-black">
                      Thông báo
                    </div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-black/40">Chưa có thông báo</div>
                    ) : (
                      <div className="stagger">
                        {notifications.map((n) => (
                          <div key={n.id} className="px-4 py-2.5 border-b border-black/5 last:border-0 hover:bg-surface-soft transition-colors">
                            <div className="text-sm font-medium text-black">{n.title}</div>
                            {n.body && <div className="text-xs text-black/50 mt-0.5">{n.body}</div>}
                            <div className="text-[11px] text-black/35 mt-1">
                              {new Date(n.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <span className="px-3 py-1 rounded-pill bg-surface-soft text-black text-xs font-medium font-mono uppercase tracking-wide">
              {ROLE_LABEL[role]}
            </span>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="h-9 w-9 rounded-full bg-black text-white flex items-center justify-center text-sm font-medium transition-transform hover:scale-105 active:scale-95"
              >
                {initials}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg ring-1 ring-black/10 py-1 z-50 animate-pop origin-top-right" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                    <div className="px-4 py-2 border-b border-black/5">
                      <div className="text-sm font-medium text-black truncate">{profile?.fullName}</div>
                      <div className="text-xs text-black/40 truncate">{profile?.email}</div>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/doi-mat-khau');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-black/70 hover:bg-surface-soft"
                    >
                      <KeyRound size={16} /> Đổi mật khẩu
                    </button>
                    <button
                      onClick={() => dispatch(logout())}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-black/70 hover:bg-surface-soft"
                    >
                      <LogOut size={16} /> Đăng xuất
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {/* key theo route -> mỗi lần chuyển trang chạy lại hiệu ứng xuất hiện */}
          <div key={location.pathname} className="animate-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
