// Entry point. Chi con mot che do:
//   Bam vao o binh luan cua bai goc -> panel chon danh muc -> bam Tao -> AI soan.
// Khong quet feed, khong goi API khi luot. Moi request deu do nguoi dung bam Tao.
(function () {
  const TAF = window.__TAF;
  const sel = TAF.selectors;

  // KHONG luu comment. Ket qua AI chi song trong bo nho trang, du de bam lai
  // vao o soan ma khong ton them request. Chi luu khi nguoi dung bam Post.

  let busy = false;
  let activeComposer = null;
  let activeCollected = null;
  let activePostId = null;
  let pending = null; // ket qua vua sinh cho activePostId
  const postedIds = new Set(); // bai da ghi nhan Post trong lan tai trang nay
  let lastView = null; // trang thai panel gan nhat, de ve lai khi danh muc doi

  const FAIL_MSG = 'Không chèn được vào ô soạn. Bấm "Chép để dán tay" rồi Ctrl+V.';

  // Danh muc chon san: lan tao gan nhat cua bai nay, khong thi lua chon lan truoc.
  function currentSelection() {
    const names = (TAF.categories || []).map((c) => c.name);
    const want = (pending && pending.categories) || TAF.settings.lastCategories || [];
    const picked = names.filter((n) => want.includes(n));
    if (picked.length) return picked;
    return names.length === 1 ? names : [];
  }

  function show(view) {
    lastView = view;
    TAF.panel.render({
      categories: TAF.categories,
      selected: view.selected || currentSelection(),
      maxLinks: TAF.settings.maxLinks,
      canRegenerate: !!pending,
      ...view,
    });
  }

  function showPending(message) {
    show({
      phase: 'done',
      message,
      productName: pending.productName,
      reason: pending.reason,
      text: pending.finalComment,
      selected: pending.categories,
    });
  }

  async function ask(categories) {
    const composer = activeComposer;
    if (!composer || busy || !categories || !categories.length) return;
    const selected = categories;
    const catText = categories.length > 2 ? categories.length + ' danh mục' : categories.join(' + ');

    // Quet lai ngay luc bam Tao: nguoi dung co the da cuon them comment.
    const collected = TAF.detailScanner.collect(TAF.settings.maxOpComments);
    if (collected.error) {
      show({ phase: 'error', message: 'Không đọc được bài viết: ' + collected.error, selected });
      return;
    }
    activeCollected = collected;

    busy = true;
    const n = collected.opComments.length;
    const total = collected.totalOpComments;
    const note = total > n ? n + '/' + total : String(n);
    TAF.panel.render({
      phase: 'busy',
      message:
        (pending ? 'Đang viết lại… ' : 'Đang soạn… ') +
        '(' + catText + ' · đọc ' + note + ' comment của chủ post)',
    });

    // Nguoi dung bat dau go trong luc cho thi huy viec dien.
    let cancelled = false;
    const onType = () => {
      cancelled = true;
    };
    composer.addEventListener('input', onType, { once: true });

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_COMMENT',
        payload: {
          post: collected.post,
          opComments: collected.opComments,
          categories,
          maxLinks: TAF.settings.maxLinks,
        },
      });

      composer.removeEventListener('input', onType);

      if (!res || !res.ok) {
        show({ phase: 'error', message: 'Lỗi AI: ' + ((res && res.error) || 'không rõ'), selected });
        return;
      }

      if (!res.productId) {
        show({
          phase: 'skipped',
          message: 'AI không thấy sản phẩm nào trong ' + catText + ' hợp với bài này. Thử thêm danh mục khác.',
          reason: res.reason,
          selected,
        });
        return;
      }

      pending = {
        postId: activePostId,
        productId: res.productId,
        productIds: res.productIds || [res.productId],
        productName: res.productName,
        categories,
        category: res.category,
        comment: res.comment,
        finalComment: res.finalComment || res.comment,
        reason: res.reason,
      };

      if (cancelled) {
        showPending('Bạn đang tự gõ nên không điền đè lên.');
        return;
      }

      await TAF.panel.clearComposer(composer);
      const r = await TAF.panel.insert(composer, pending.finalComment);

      show({
        phase: 'done',
        message: r.ok ? 'Đã điền. Đọc lại rồi tự bấm Post.' : FAIL_MSG,
        insertFailed: !r.ok,
        text: pending.finalComment,
        productName: pending.productName,
        reason: pending.reason,
        selected,
      });
    } catch (e) {
      composer.removeEventListener('input', onType);
      show({ phase: 'error', message: 'Lỗi: ' + e.message, selected });
    } finally {
      busy = false;
    }
  }

  TAF.panel.setHandler(async (action, value) => {
    if (action === 'categories') {
      // Nho lua chon cho lan sau. Luu vao settings nen moi tab deu dung chung.
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', patch: { lastCategories: value } });
      if (lastView) lastView = { ...lastView, selected: value };
      return;
    }
    if (action === 'maxLinks') {
      // Cap nhat ngay trong tab nay, khong cho storage.onChanged, de bam Tao lien van dung so moi.
      TAF.settings = { ...TAF.settings, maxLinks: value };
      chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', patch: { maxLinks: value } });
      return;
    }
    if (action === 'generate') {
      await ask(value);
    }
  });

  // Catalog nap lai (sua file Excel) thi ve lai hang danh muc neu panel dang mo.
  TAF.onStateChange = (changes) => {
    if (changes.categories && lastView && !busy && activeComposer) show(lastView);
  };

  function onComposerFocus(composer) {
    if (busy) return;
    if (!TAF.settings.enabled) return;

    const postId = sel.postIdFromUrl();
    if (!postId) return;

    const collected = TAF.detailScanner.collect(TAF.settings.maxOpComments);
    if (collected.error) {
      // Loi cau truc DOM la viec cua nguoi phat trien, khong phai cua nguoi dung.
      // Ghi log chu khong bat panel len chan duong go reply.
      TAF.warn(collected.error);
      return;
    }

    // Chi nhan o soan cua bai goc, khong phai o cua tung reply.
    if (!TAF.detailScanner.isRootComposer(composer, collected.rootAuthor)) {
      TAF.log('khong phai o binh luan cua bai goc, bo qua');
      return;
    }

    // Bam lai dung o dang mo thi khong ve lai, tranh mat lua chon dang do.
    const sameComposer = composer === activeComposer && postId === activePostId;

    if (postId !== activePostId) {
      pending = null;
      lastView = null;
      activePostId = postId;
    }
    activeComposer = composer;
    activeCollected = collected;

    TAF.panel.ensure(composer);
    if (sameComposer && lastView) return;

    // Da sinh trong lan tai trang nay: hien lai ket qua, khong goi AI.
    if (pending) {
      showPending('Đã soạn cho bài này. Đổi danh mục rồi bấm "Đổi comment" nếu muốn bản khác.');
      return;
    }

    show({
      phase: 'pick',
      message: 'Chọn một hoặc nhiều danh mục rồi bấm Tạo. Chỉ sản phẩm trong các danh mục đã chọn được gửi cho AI.',
    });
  }

  function startDetailTrigger() {
    const handler = (ev) => {
      if (ev.target.closest && ev.target.closest('#__taf_panel')) return;
      const el = ev.target.closest ? ev.target.closest(sel.S.COMPOSER) : null;
      if (el) onComposerFocus(el);
    };
    document.addEventListener('focusin', handler, true);
    document.addEventListener('click', handler, true);
  }

  // Tat extension trong popup: dong panel ngay.
  const prevOnState = TAF.onStateChange;
  TAF.onStateChange = (changes) => {
    if (changes.settings && !TAF.settings.enabled) TAF.panel.hide();
    prevOnState(changes);
  };

  // ---------- Ghi nhan bam Post ----------
  //
  // Extension KHONG bao gio tu bam Post. Chi nghe nguoi dung bam (hoac Ctrl+Enter),
  // roi xac nhan bang cach cho o soan rong lai hoac bien mat. Bam Post ma bi loi
  // (o soan van con chu) thi khong tinh.

  function watchPosted(composer) {
    if (!pending || pending.postId !== sel.postIdFromUrl()) return;
    if (postedIds.has(pending.postId)) return;

    const text = (composer.textContent || '').trim();
    if (!text) return;

    const snapshot = {
      ...pending,
      comment: text,
      post: activeCollected ? activeCollected.post : null,
    };

    const started = Date.now();
    const timer = setInterval(() => {
      const gone = !document.body.contains(composer);
      const empty = (composer.textContent || '').trim() === '';
      if (gone || empty) {
        clearInterval(timer);
        if (postedIds.has(snapshot.postId)) return;
        postedIds.add(snapshot.postId);

        const post = snapshot.post || {};
        chrome.runtime.sendMessage({
          type: 'MARK_POSTED',
          info: {
            postId: snapshot.postId,
            permalink: post.permalink || location.origin + location.pathname,
            author: post.author || '',
            postText: post.text || '',
            productId: snapshot.productId,
            productIds: snapshot.productIds,
            productName: snapshot.productName,
            category: snapshot.category,
            comment: snapshot.comment,
          },
        });
        TAF.log('da dang', snapshot.postId);
        if (lastView && !gone) {
          show({ ...lastView, message: 'Đã ghi nhận bài này vào danh sách Đã đăng.' });
        }
      } else if (Date.now() - started > 5000) {
        clearInterval(timer);
      }
    }, 200);
  }

  function startPostWatcher() {
    document.addEventListener(
      'click',
      (ev) => {
        if (!activeComposer || !TAF.settings.enabled) return;
        if (!sel.isPostButton(ev.target)) return;
        watchPosted(activeComposer);
      },
      true
    );

    document.addEventListener(
      'keydown',
      (ev) => {
        if (ev.key !== 'Enter' || !(ev.ctrlKey || ev.metaKey)) return;
        const composer = ev.target.closest ? ev.target.closest(sel.S.COMPOSER) : null;
        if (composer && composer === activeComposer) watchPosted(composer);
      },
      true
    );
  }

  // ---------- Khoi dong ----------

  (async function init() {
    await TAF.loadState();
    startDetailTrigger();
    startPostWatcher();
    TAF.log('khoi dong xong. danh muc:', TAF.categories.length, '| bat:', TAF.settings.enabled);
  })();
})();
