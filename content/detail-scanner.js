// Quet trang chi tiet post. Chay NGAY khi nguoi dung bam vao o binh luan.
// Khong cho, khong cuon, khong IntersectionObserver. Doc thang cay DOM dang co.
(function () {
  const TAF = window.__TAF;
  const sel = TAF.selectors;

  function blockOf(el) {
    return el.closest(sel.S.POST_BLOCK);
  }

  // Bai can tra loi la khoi co ma bai trung voi URL. KHONG lay theo pagelet so 0:
  // Threads co ban de threads_post_page_0 rong va dat bai goc o page_1, con khi mo
  // link cua mot comment thi page_0 lai la bai cha chu khong phai bai dang mo.
  function findRootBlock(blocks) {
    const postId = sel.postIdFromUrl();
    if (!postId) return null;
    return blocks.find((b) => sel.postIdFromHref(sel.permalinkFromBlock(b)) === postId) || null;
  }

  // Tra ve { post, parents, opComments, rootAuthor } hoac { error }.
  function collect(maxOpComments) {
    const all = Array.from(document.querySelectorAll(sel.S.POST_BLOCK));
    // Uu tien khoi thuoc trang chi tiet (threads_post_page_*), bo khoi o cot khac.
    // Threads doi cau truc ma khong con pagelet thi dung tat ca.
    const inPagelet = all.filter((b) => sel.pageletOf(b));
    const blocks = inPagelet.length ? inPagelet : all;
    if (!blocks.length) return { error: 'Khong tim thay khoi bai viet nao tren trang.' };

    const rootBlock = findRootBlock(blocks);
    if (!rootBlock) return { error: 'Khong tim thay bai co ma ' + sel.postIdFromUrl() + ' tren trang.' };

    const post = TAF.extractPost(rootBlock);
    if (!post) return { error: 'Khong trich xuat duoc bai goc.' };

    const rootAuthor = post.author;
    const rootIndex = blocks.indexOf(rootBlock);

    // Mo link cua mot comment: cac bai phia tren la bai cha, gui kem de AI hieu ngu canh.
    const parents = blocks
      .slice(0, rootIndex)
      .map((b) => ({ author: sel.authorFromBlock(b), text: sel.textFromBlock(b) }))
      .filter((p) => p.author && p.text);

    // Ho so tung khoi de phan loai, giu nguyen thu tu tai lieu.
    const entries = blocks.map((b) => ({
      block: b,
      author: sel.authorFromBlock(b),
      text: sel.textFromBlock(b),
      pagelet: sel.pageletOf(b),
      isRoot: b === rootBlock,
    }));

    const opComments = [];
    // Chi xet cac khoi SAU bai dang mo. Khoi phia tren la bai cha, da nam trong parents.
    for (let i = rootIndex + 1; i < entries.length; i++) {
      const e = entries[i];
      if (e.author !== rootAuthor) continue;
      if (!e.text) continue;

      const prev = entries[i - 1];
      // Chi gan ngu canh khi khoi lien truoc CHAC CHAN cung pagelet va cua
      // tac gia khac. Moi truong hop con lai mac dinh standalone:
      // tha thieu ngu canh con hon gan nham loi nguoi la vao mieng chu post.
      const isReply =
        i - 1 > rootIndex &&
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
      parents,
      opComments: trimmed,
      totalOpComments: opComments.length,
      rootAuthor,
    };
  }

  // O soan reply cua BAI GOC co aria-placeholder chua ten tac gia bai goc,
  // vd "Reply to {tac gia}..." hoac "Trả lời {tac gia}...". O soan cua tung reply
  // chua ten nguoi viet reply do, bam vao khong kich hoat gi.
  // Khong dua vao chu "Reply to": Threads doi chu nay theo ngon ngu giao dien,
  // con username thi giong nhau o moi ngon ngu.
  function isRootComposer(el, rootAuthor) {
    if (!el || !el.matches || !el.matches(sel.S.COMPOSER)) return false;
    const ph = (el.getAttribute('aria-placeholder') || '').toLowerCase();
    if (!rootAuthor) return !!ph;

    const name = rootAuthor.toLowerCase();
    let i = ph.indexOf(name);
    while (i !== -1) {
      // Truoc ten phai la dau cach, @ hoac dau chuoi, de "an" khong khop vao "hoan".
      const before = i === 0 ? '' : ph[i - 1];
      if (!/[a-z0-9._]/.test(before)) return true;
      i = ph.indexOf(name, i + 1);
    }
    return false;
  }

  function composerIsEmpty(el) {
    return (el.textContent || '').trim() === '';
  }

  TAF.detailScanner = { collect, isRootComposer, composerIsEmpty, blockOf };
})();
