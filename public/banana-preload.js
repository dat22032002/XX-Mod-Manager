// Preload cho khung web Banana (1.5.25 test3) — chạy trong khung web
// trước mọi script của trang, có quyền Node (require electron) dù trang
// không có. 2 việc:
//  (1) Nút bên hông chuột: khung web không tự xử lý nút quay lại/tới
//      (nút 3/4) nên nghe mouseup rồi lùi/tới lịch sử của khung.
//  (2) Kéo ảnh ra khỏi khung: kéo-thả HTML thường không xuyên qua được
//      ranh giới webview nên khi bắt đầu kéo 1 tấm ảnh thì gửi địa chỉ
//      ảnh về trang chủ (sendToHost), trang chủ tải về file tạm rồi
//      nhờ tiến trình chính bắt đầu cú kéo ở mức hệ điều hành.
// File này nằm trong public/ nên Vite chép nguyên sang dist/ (không
// đóng gói) — xem preloadUrl trong bananaSection.vue.
(function () {
  'use strict';
  var ipcRenderer = null;
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (_e) {
    // Không có ipcRenderer thì vẫn làm được nút chuột (1), chỉ mất kéo ảnh (2).
  }

  // (1) Nút bên hông chuột (quay lại / tới).
  window.addEventListener('mouseup', function (e) {
    if (e.button === 3) {
      e.preventDefault();
      e.stopPropagation();
      window.history.back();
    } else if (e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
      window.history.forward();
    }
  }, true);

  // (2) Bắt đầu kéo 1 tấm ảnh: chỉ nhận ảnh có địa chỉ http(s) tải
  // được (ảnh data:/blob: không có địa chỉ để tải thì để mặc định).
  document.addEventListener('dragstart', function (e) {
    if (!ipcRenderer) return;
    var target = e.target;
    var img = target && target.closest ? target.closest('img') : null;
    if (!img) return;
    var src = img.currentSrc || img.src || '';
    if (!/^https?:\/\//i.test(src)) return;
    e.preventDefault();
    try {
      ipcRenderer.sendToHost('gb-drag-image', { url: src });
    } catch (_err) { /* khung đóng giữa lúc kéo: thôi */ }
  }, true);

  // Báo cho trang chủ biết preload đã chạy (để kiểm tra).
  if (ipcRenderer) {
    try {
      ipcRenderer.sendToHost('gb-preload-ready');
    } catch (_e) { /* bỏ qua */ }
  }
})();
