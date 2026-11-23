// Danh sách địa chỉ quảng cáo/theo dõi bị chặn trong khung web Banana
// (1.5.25) — CHỈ áp cho session của khung Banana (partition
// persist:gamebanana, xem electron/main.js), không đụng phần khác của
// app. Khớp theo hậu tố: chặn cả tên miền con (vd
// securepubads.g.doubleclick.net). Giữ đơn giản: 1 danh sách + khớp
// hậu tố, không kéo bộ máy chặn quảng cáo nặng về.
// Gồm 14 địa chỉ Đạt dặn + các địa chỉ thấy trong probe trang Banana
// thật (playwire, moatads, openx, mathtag, pubmatic, intergi, btloader,
// googletagmanager) + vài tên quảng cáo/theo dõi phổ biến khác.
const GB_AD_BLOCKLIST = [
  // Đạt dặn (14):
  'doubleclick.net',
  'criteo.com',
  'rubiconproject.com',
  'adnxs.com',
  'amazon-adsystem.com',
  'scorecardresearch.com',
  'adform.net',
  '360yield.com',
  'intentiq.com',
  'liadm.com',
  'ads.linkedin.com',
  'eyeota.net',
  'rlcdn.com',
  'intergient.com',
  // Thấy trong probe trang Banana thật:
  'googletagmanager.com',
  'moatads.com',
  'openx.net',
  'mathtag.com',
  'playwire.com',
  'intergi.com',
  'btloader.com',
  'pubmatic.com',
  // Quảng cáo/theo dõi phổ biến khác:
  'googlesyndication.com',
  'googleadservices.com',
  'google-analytics.com',
  'googletagservices.com',
  'quantserve.com',
  'outbrain.com',
  'taboola.com',
  'adsrvr.org',
  'demdex.net',
  'addthis.com',
  'facebook.net',
  'smartadserver.com',
  'casalemedia.com',
  'advertising.com',
  'mookie1.com',
  'bluekai.com',
  'krxd.net',
  'agkn.com',
  'rfihub.com',
  'bidswitch.net',
  'triplelift.com',
  'indexww.com',
  'yieldmo.com',
  'gumgum.com',
  'sharethrough.com',
  'connatix.com',
  'aniview.com',
];

// Địa chỉ này có nằm trong danh sách chặn không (khớp hậu tố: đúng tên
// miền hoặc tên miền con của nó; 'notdoubleclick.net' thì KHÔNG khớp
// 'doubleclick.net' vì thiếu dấu chấm phân cách).
function isGbAdUrl(url) {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch (_e) {
    return false;
  }
  if (!host) return false;
  return GB_AD_BLOCKLIST.some((d) => host === d || host.endsWith('.' + d));
}

module.exports = { GB_AD_BLOCKLIST, isGbAdUrl };
