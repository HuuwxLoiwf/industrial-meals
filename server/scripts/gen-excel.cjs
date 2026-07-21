// Tạo file Excel danh sách nhân viên mẫu: Ca sáng + Ca tối
const XLSX = require('xlsx');
const path = require('path');

const hoList = ['Nguyen','Tran','Le','Pham','Hoang','Vu','Dang','Bui','Do','Ho','Ngo','Duong','Ly','Dinh','Ma','Dao','Truong','Luong','Phan','Vo'];
const tenNam = ['Van An','Van Binh','Van Cuong','Van Dung','Van Hung','Van Khai','Van Long','Van Minh','Van Nam','Van Phu','Van Quang','Van Son','Van Thanh','Van Tuan','Van Vinh','Huu Loi','Duc Manh','Quoc Bao','Trong Nghia','Cong Hau'];
const tenNu = ['Thi Anh','Thi Bich','Thi Chi','Thi Dao','Thi Em','Thi Giang','Thi Hoa','Thi Huong','Thi Lan','Thi Mai','Thi Ngoc','Thi Oanh','Thi Phuong','Thi Quynh','Thi Thu','Thi Thuy','Thi Tuyen','Thi Uyen','Thi Viet','Thi Xuan'];
const depts = ['Phong San Xuat','Phong Ky Thuat','Phong Kinh Doanh','Phong Nhan Su','Phong Tai Chinh','Phong Chat Luong','Phong Logistics','Phong IT','Phong Hanh Chinh','Phong Bao Tri'];

function makeName(idx) {
  const isNam = idx % 2 === 0;
  const ho = hoList[idx % hoList.length];
  const ten = isNam ? tenNam[Math.floor(idx / 2) % tenNam.length] : tenNu[Math.floor(idx / 2) % tenNu.length];
  return ho + ' ' + ten;
}

function makeEmail(prefix, idx) {
  return `${prefix}${String(idx).padStart(3,'0')}@umc.com.vn`;
}

function makePhone(idx) {
  return '09' + String(10000000 + idx).slice(1);
}

function makeRows(prefix, emailOverride, count) {
  const rows = [];
  let empIdx = 1;
  // Thêm email test ở đầu
  if (emailOverride) {
    rows.push({
      'Mã NV': `NV-${prefix.toUpperCase()}-000`,
      'Họ và tên': prefix === 'sang' ? 'Huu Loi' : 'Dh Loi',
      'Email': emailOverride,
      'Số điện thoại': '0900000000',
      'Bộ phận': depts[0],
      'Ca': prefix === 'sang' ? 'Ca sáng' : 'Ca tối',
    });
  }
  for (let i = 1; i <= count; i++) {
    rows.push({
      'Mã NV': `NV-${prefix.toUpperCase()}-${String(i).padStart(3,'0')}`,
      'Họ và tên': makeName(i),
      'Email': makeEmail(prefix, i),
      'Số điện thoại': makePhone(i),
      'Bộ phận': depts[(i - 1) % depts.length],
      'Ca': prefix === 'sang' ? 'Ca sáng' : 'Ca tối',
    });
  }
  return rows;
}

const sang = makeRows('sang', 'huuloi21082004@gmail.com', 200);
const toi  = makeRows('toi',  'dhloi686868@gmail.com',    200);

const wb = XLSX.utils.book_new();

function addSheet(wb, rows, sheetName) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Column widths
  ws['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 32 }, { wch: 14 }, { wch: 22 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

addSheet(wb, sang, 'Ca sáng');
addSheet(wb, toi,  'Ca tối');

const outPath = path.join(__dirname, '..', 'danh-sach-nhan-vien.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Đã tạo:', outPath);
