// Moi selector cua Threads gom vao mot cho duy nhat.
// Class cua Threads la chuoi bam sinh tu dong (x1lliihq, xdj266r...) nen tuyet doi
// khong dung. Chi dua vao thuoc tinh ngu nghia.
(function () {
  const TAF = window.__TAF;

  const S = {
    POST_BLOCK: 'div[data-pressable-container="true"]',
    PERMALINK: 'a[href*="/post/"]',
    PROFILE_LINK: 'a[href^="/@"]',
    TIME: 'time[datetime]',
    MEDIA: 'img[alt^="Photo by @"]',
    COMPOSER: 'div[contenteditable="true"][data-lexical-editor="true"][role="textbox"]',
    ANY_PAGELET: '[data-pagelet^="threads_post_page"]',
  };

  // /@nyu.o14/post/Dc87Hrlk5T6 -> Dc87Hrlk5T6
  function postIdFromHref(href) {
    if (!href) return null;
    const m = href.match(/\/post\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  // Link tac gia la /@username, khong phai /@username/post/ID.
  function authorFromBlock(block) {
    const links = block.querySelectorAll(S.PROFILE_LINK);
    for (const a of links) {
      const href = a.getAttribute('href') || '';
      if (/^\/@[^/]+$/.test(href)) return href.slice(2);
    }
    return null;
  }

  function permalinkFromBlock(block) {
    const a = block.querySelector(S.PERMALINK);
    if (!a) return null;
    const href = a.getAttribute('href') || '';
    return href.startsWith('http') ? href : 'https://www.threads.com' + href;
  }

  // Than bai nam o mot <span> TRAN (khong co thuoc tinh class) ben trong
  // span[dir="auto"]. Moi span khac trong khoi deu co class: ten tac gia,
  // so luot Like, nhan Translate. Hai ngoai le phai loai: <span>6d</span>
  // nam trong <abbr> ben trong <time>.
  function textFromBlock(block) {
    const parts = [];
    const spans = block.querySelectorAll('span[dir="auto"] > span:not([class])');

    for (const span of spans) {
      if (span.closest('time') || span.closest('abbr')) continue;
      const t = (span.textContent || '').trim();
      if (t) parts.push(t);
    }

    // Loai trung lap khi Threads long nhieu lop span.
    const seen = new Set();
    const unique = parts.filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });

    return unique.join(' ').replace(/\s+/g, ' ').trim();
  }

  function timestampFromBlock(block) {
    const t = block.querySelector(S.TIME);
    return t ? t.getAttribute('datetime') : null;
  }

  function hasMedia(block) {
    return !!block.querySelector(S.MEDIA);
  }

  // Tren trang chi tiet, moi pagelet la mot mach hoi thoai.
  function pageletOf(block) {
    const p = block.closest(S.ANY_PAGELET);
    return p ? p.getAttribute('data-pagelet') : null;
  }

  function isDetailPage() {
    return /\/@[^/]+\/post\/[^/?#]+/.test(location.pathname);
  }

  function postIdFromUrl() {
    return postIdFromHref(location.pathname);
  }

  // Nut Post cua o soan: div[role=button] (hoac button) chi chua chu "Post"/"Đăng".
  // Dua vao chu hien thi vi nut nay khong co thuoc tinh ngu nghia rieng.
  const POST_BUTTON_TEXT = /^(post|đăng)$/i;
  function isPostButton(target) {
    const b = target && target.closest ? target.closest('[role="button"], button') : null;
    if (!b || b.closest('#__taf_panel')) return false;
    return POST_BUTTON_TEXT.test((b.textContent || '').trim());
  }

  TAF.selectors = {
    S,
    postIdFromHref,
    authorFromBlock,
    permalinkFromBlock,
    textFromBlock,
    timestampFromBlock,
    hasMedia,
    pageletOf,
    isDetailPage,
    postIdFromUrl,
    isPostButton,
    POST_BUTTON_TEXT,
  };
})();
