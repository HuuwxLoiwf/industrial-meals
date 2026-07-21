// Axios instance gắn JWT token (lưu localStorage) vào mỗi request.
import axios from 'axios';

export const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TOKEN_KEY = 'umc_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Dựng URL ảnh đầy đủ từ đường dẫn tương đối backend trả về.
export function assetUrl(path) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${SERVER_URL}${path}`;
}

const api = axios.create({
  baseURL: `${SERVER_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token hết hạn / không hợp lệ -> xóa và về trang login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      if (window.location.pathname !== '/sign-in') {
        window.location.href = '/sign-in';
      }
    }
    return Promise.reject(err);
  }
);

// Tải file (Excel...) qua axios với token, rồi lưu về máy.
export async function downloadFile(path, params, fallbackName = 'download.xlsx') {
  const res = await api.get(path, { params, responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const name = match ? match[1] : fallbackName;
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default api;
