// Kill port 5000 rồi khởi động server
import { execSync, spawn } from 'child_process';

try {
  // Windows: tìm và kill process đang dùng port 5000
  const result = execSync(
    'for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":5000 " ^| findstr "LISTENING"\') do taskkill /F /PID %a',
    { shell: 'cmd.exe', stdio: 'pipe' }
  );
} catch {
  // Không có process nào → bình thường
}

// Chờ 500ms rồi khởi động
setTimeout(() => {
  const child = spawn('node', ['--watch', 'src/server.js'], {
    stdio: 'inherit',
    shell: false,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}, 500);
