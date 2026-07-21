// Component UI dùng chung — hệ thống editorial đen-trắng + pastel color-block (theo DESIGN-figma.md).
import { Loader2 } from 'lucide-react';

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-8 animate-in">
      <div>
        <h1 className="text-[28px] sm:text-[32px] font-medium text-black tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-[15px] text-black/50 mt-2">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// hover: bật hiệu ứng nâng nhẹ khi rê chuột (dùng cho card bấm được).
export function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-white rounded-lg ring-1 ring-black/10 p-5 ${
        hover ? 'hover-lift cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Thẻ thống kê: mỗi tone là một pastel color-block của hệ Figma thay vì nền nhạt + icon màu.
const STAT_TONES = {
  blue: 'bg-block-lilac text-black',
  sky: 'bg-block-mint text-black',
  indigo: 'bg-block-lilac text-black',
  violet: 'bg-block-pink text-black',
  amber: 'bg-block-cream text-black',
  rose: 'bg-block-coral text-black',
  emerald: 'bg-block-lime text-black',
  slate: 'bg-surface-soft text-black',
};

export function StatCard({ icon: Icon, label, value, tone = 'blue', hint }) {
  return (
    <div className={`relative rounded-lg p-5 overflow-hidden transition-transform duration-200 hover:-translate-y-1 group ${STAT_TONES[tone]}`}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="h-11 w-11 shrink-0 rounded-full bg-white/70 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0">
          {/* key={value} -> re-mount khi số đổi để chạy lại animation nảy */}
          <div key={value} className="text-[28px] font-medium leading-none animate-bounce-num tracking-tight">
            {value}
          </div>
          <div className="text-sm text-black/60 truncate mt-1.5">{label}</div>
          {hint && <div className="text-xs text-black/40 mt-0.5">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

const STATUS_STYLE = {
  PENDING: 'bg-block-cream text-black',
  APPROVED: 'bg-block-lime text-black',
  CANCELLED: 'bg-black/5 text-black/50',
};
const STATUS_LABEL = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã đăng ký',
  CANCELLED: 'Đã hủy',
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLE[status] || 'bg-black/5 text-black/60'
      }`}
    >
      {STATUS_LABEL[status] || status}
    </span>
  );
}

const MEALTYPE_STYLE = {
  STANDARD: 'bg-block-mint text-black',
  ALTERNATIVE: 'bg-block-lilac text-black',
};
const MEALTYPE_LABEL = { STANDARD: 'Suất thường', ALTERNATIVE: 'Suất cải tiến' };

export function MealTypeBadge({ type }) {
  if (!type) return null;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${MEALTYPE_STYLE[type]}`}>
      {MEALTYPE_LABEL[type]}
    </span>
  );
}

// Button: pill là hình dạng duy nhất, đúng theo "Don't square off CTAs".
export function Button({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) {
  const variants = {
    primary: 'bg-black hover:bg-black/85 active:bg-black/75 text-white',
    outline: 'bg-white ring-1 ring-black/15 hover:ring-black/30 text-black',
    ghost: 'text-black/60 hover:bg-black/5',
    danger: 'bg-block-coral hover:brightness-95 text-black',
    success: 'bg-block-lime hover:brightness-95 text-black',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm',
  };
  return (
    <button
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" />}
      {children}
    </button>
  );
}

// Nút chuyển tab: selected = nền đen (giống button-primary) theo đúng nguyên tắc pricing-tab-selected.
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-surface-soft rounded-pill mb-5">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-1.5 rounded-pill text-sm font-medium transition-all duration-200 ${
            value === t.value ? 'bg-black text-white' : 'text-black/50 hover:text-black'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Ô nhập chuẩn.
export function Input({ className = '', ...props }) {
  return (
    <input
      className={`bg-white ring-1 ring-black/15 rounded-md px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black focus:outline-none transition ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`bg-white ring-1 ring-black/15 rounded-md px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-black focus:outline-none transition ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Trạng thái rỗng.
export function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade">
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-surface-soft text-black/40 flex items-center justify-center mb-3">
          <Icon size={24} />
        </div>
      )}
      <div className="text-sm font-medium text-black/70">{title}</div>
      {hint && <div className="text-xs text-black/40 mt-1">{hint}</div>}
    </div>
  );
}

// Khối skeleton loading (nhấp nháy) — dùng khi chờ dữ liệu.
export function Skeleton({ className = '' }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

// Lưới skeleton cho các thẻ thống kê.
export function StatSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-soft rounded-lg p-5 flex items-center gap-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// "YYYY-MM-DD" hôm nay theo giờ Việt Nam (UTC+7).
// Không dùng toISOString() trực tiếp: trước 7h sáng VN nó vẫn là ngày hôm qua (UTC).
export function todayStr() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
