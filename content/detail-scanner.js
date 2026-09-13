// Quet trang chi tiet post. Chay NGAY khi nguoi dung bam vao o binh luan.
// Khong cho, khong cuon, khong IntersectionObserver. Doc thang cay DOM dang co.
(function () {
  const TAF = window.__TAF;
  const sel = TAF.selectors;

  function blockOf(el) {
    return el.closest(sel.S.POST_BLOCK);
  }

  // Tra ve { post, opComments, rootAuthor } hoac { error }.
  function collect(maxOpComments) {
    const rootPagelet = document.querySelector(sel.S.ROOT_PAGELET);
    if (!rootPagelet) {
      // Khong doan bua. Thieu pagelet goc thi moi reply deu co the bi hieu
      // nham la bai goc, nen dung han thay vi quet lien.
      return { error: 'Khong tim thay khoi bai goc (threads_post_page_0). Threads co the da doi cau truc.' };
    }

    const rootBlock = rootPagelet.querySelector(sel.S.POST_BLOCK);
    if (!rootBlock) return { error: 'Khong doc duoc noi dung bai goc.' };

    const post = TAF.extractPost(rootBlock);
    if (!post) return { error: 'Khong trich xuat duoc bai goc.' };

    const rootAuthor = post.author;
    const blocks = Array.from(document.querySelectorAll(sel.S.POST_BLOCK));

    // Ho so tung khoi de phan loai, giu nguyen thu tu tai lieu.
    const entries = blocks.map((b) => ({
      block: b,
      author: sel.authorFromBlock(b),
      text: sel.textFromBlock(b),
      pagelet: sel.pageletOf(b),
      isRoot: b === rootBlock,
    }));

    const opComments = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.isRoot) continue;
      if (e.author !== rootAuthor) continue;
      if (!e.text) continue;

      const prev = entries[i - 1];
      // Chi gan ngu canh khi khoi lien truoc CHAC CHAN cung pagelet va cua
      // tac gia khac. Moi truong hop con lai mac dinh standalone:
      // tha thieu ngu canh con hon gan nham loi nguoi la vao mieng chu post.
      const isReply =
        prev &&
        !prev.isRoot &&
        prev.pagelet &&
        e.pagelet &&
        prev.pagelet === e.pagelet &&
        prev.author &&
        prev.author !== rootAuthor &&
        prev.text;

      if (isReply) {
        opComments.push({ kind: 'reply', context: prev.text, text: e.text });
      } else {
        opComments.push({ kind: 'standalone', text: e.text });
      }
    }

    // Giu N cai MOI NHAT, van theo thu tu thoi gian. Comment muon phan anh
    // trang thai hien tai: ngan sach da chot, da mua hay chua.
    const limit = maxOpComments || 10;
    const trimmed = opComments.length > limit ? opComments.slice(-limit) : opComments;

    return {
      post: { author: post.author, text: post.text, postId: post.postId, permalink: post.permalink },
      opComments: trimmed,
      totalOpComments: opComments.length,
      rootAuthor,
    };
  }

  // O soan reply cua BAI GOC co aria-placeholder "Reply to {tac gia}".
  // O soan cua tung reply co placeholder khac, bam vao do khong kich hoat gi.
  function isRootComposer(el, rootAuthor) {
    if (!el || !el.matches || !el.matches(sel.S.COMPOSER)) return false;
    const ph = el.getAttribute('aria-placeholder') || '';
    if (!rootAuthor) return /^reply to/i.test(ph);
    return ph.toLowerCase().startsWith('reply to ' + rootAuthor.toLowerCase());
  }

  function composerIsEmpty(el) {
    return (el.textContent || '').trim() === '';
  }

  TAF.detailScanner = { collect, isRootComposer, composerIsEmpty, blockOf };
})();
