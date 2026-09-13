// Panel dieu khien noi tren trang Threads, dat canh o soan reply.
// TUYET DOI khong bam nut Post.
//
// Nguyen tac chuyen dong:
//   - Panel la popover, hien tu goc gan o soan chu khong tu giua chinh no.
//   - Vao bang ease-out manh, duoi 200ms. Ra nhanh hon vao.
//   - Khong bao gio scale tu 0. Vat the that khong hien ra tu hu vo.
//   - Nut co :active scale(0.97) de bam thay phan hoi ngay.
//   - Ton trong prefers-reduced-motion: bo chuyen dong, giu mo dan.
(function () {
  const TAF = window.__TAF;
  const ID = '__taf_panel';
  const STYLE_ID = '__taf_panel_style';

  let el = null;
  let anchorEl = null;
  let onAction = null; // callback do observer.js gan

  const CSS = [
    '#' + ID + ' {',
    '  --bg: #16161a; --bg-soft: #1d1d23; --line: #2e2e37;',
    '  --fg: #f2f2f4; --dim: #9a9aa4; --accent: #6d9bff;',
    '  --ok: #4ade80; --danger: #f97066;',
    '  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);',
    '  position: fixed; z-index: 2147483647;',
    '  width: 332px; max-height: 72vh; overflow-y: auto; overscroll-behavior: contain;',
    '  padding: 12px; border-radius: 14px;',
    '  background: var(--bg); color: var(--fg); border: 1px solid var(--line);',
    '  box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 12px 32px -8px rgba(0,0,0,.55);',
    '  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  transform-origin: var(--taf-origin, left top);',
    '  opacity: 1; transform: scale(1);',
    '  transition: opacity 140ms var(--ease-out), transform 140ms var(--ease-out);',
    '}',
    // Khong bao gio tu scale(0). 0.96 du thay chuyen dong ma van co hinh dang.
    '#' + ID + '[data-state="closed"] {',
    '  opacity: 0; transform: scale(0.96);',
    '  transition-duration: 110ms;', // ra nhanh hon vao
    '  pointer-events: none;',
    '}',
    '#' + ID + '::-webkit-scrollbar { width: 8px; }',
    '#' + ID + '::-webkit-scrollbar-thumb { background: var(--line); border-radius: 99px; }',

    '#' + ID + ' .taf-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }',
    '#' + ID + ' .taf-title {',
    '  flex:1; font-size:11px; font-weight:600; letter-spacing:.06em;',
    '  text-transform:uppercase; color:var(--dim);',
    '}',
    '#' + ID + ' .taf-msg { margin-bottom:10px; color:#d4d4da; }',
    '#' + ID + ' .taf-msg[data-tone="error"] { color: var(--danger); }',
    '#' + ID + ' .taf-msg[data-tone="ok"] { color: var(--ok); }',
    '#' + ID + ' .taf-product { margin-bottom:4px; color:var(--accent); font-weight:500; }',
    '#' + ID + ' .taf-reason { color:var(--dim); font-size:12px; margin-bottom:10px; }',
    '#' + ID + ' .taf-row { display:flex; gap:6px; flex-wrap:wrap; }',
    '#' + ID + ' .taf-label-sm { font-size:11px; color:var(--dim); margin-bottom:6px; }',
    '#' + ID + ' .taf-links { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }',
    '#' + ID + ' .taf-links .taf-label-sm { margin-bottom:0; }',
    '#' + ID + ' .taf-stepper { display:inline-flex; align-items:center; border:1px solid var(--line); border-radius:8px; overflow:hidden; }',
    '#' + ID + ' .taf-stepper button { border:0; border-radius:0; padding:4px 10px; font-size:14px; }',
    '#' + ID + ' .taf-step-value { min-width:22px; text-align:center; font-weight:600; font-variant-numeric:tabular-nums; }',
    '#' + ID + ' .taf-cats { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }',
    '#' + ID + ' button[data-kind="chip"] { padding: 6px 10px; border-radius: 99px; color: #c9c9d1; }',
    '#' + ID + ' button[data-kind="chip"][aria-pressed="true"] {',
    '  background: rgba(109,155,255,.16); border-color: var(--accent); color: var(--fg);',
    '}',

    '#' + ID + ' button {',
    '  font: 500 12px/1.2 inherit; padding: 7px 12px; border-radius: 8px; cursor: pointer;',
    '  background: transparent; color: var(--fg); border: 1px solid var(--line);',
    '  transition: transform 140ms var(--ease-out), background-color 140ms ease,',
    '              border-color 140ms ease, color 140ms ease;',
    '}',
    '#' + ID + ' button:active { transform: scale(0.97); }',
    '@media (hover: hover) and (pointer: fine) {',
    '  #' + ID + ' button:hover { background: var(--bg-soft); border-color: #3d3d48; }',
    '  #' + ID + ' button[data-kind="primary"]:hover { background: #5c8df5; }',
    '}',
    '#' + ID + ' button[data-kind="primary"] {',
    '  background: var(--accent); border-color: var(--accent); color: #08080c; font-weight: 600;',
    '}',
    '#' + ID + ' button[data-kind="danger"] { color: var(--danger); border-color: #4a2523; }',
    '#' + ID + ' button[data-kind="icon"] { padding: 4px 8px; color: var(--dim); }',
    '#' + ID + ' button[data-done="true"] { color: var(--ok); border-color: #25402f; }',
    '#' + ID + ' button:disabled { opacity:.45; cursor:default; transform:none; }',

    // Doi nhan nut: lam mo trong luc doi de hai trang thai khong chong len nhau.
    '#' + ID + ' button .taf-label {',
    '  display:inline-block; transition: filter 160ms ease, opacity 160ms ease;',
    '}',
    '#' + ID + ' button[data-swapping="true"] .taf-label { filter: blur(2px); opacity:.5; }',

    '#' + ID + ' details { margin-top:12px; border-top:1px solid var(--line); padding-top:10px; }',
    '#' + ID + ' summary {',
    '  cursor:pointer; font-size:12px; color:var(--dim); list-style:none; user-select:none;',
    '}',
    '#' + ID + ' summary::-webkit-details-marker { display:none; }',
    '#' + ID + ' summary::before {',
    '  content: "› "; display:inline-block; transition: transform 160ms var(--ease-out);',
    '}',
    '#' + ID + ' details[open] summary::before { transform: rotate(90deg); }',

    '#' + ID + ' .taf-entry {',
    '  margin-top:8px; padding:9px; border:1px solid var(--line); border-radius:9px;',
    '  background: var(--bg-soft);',
    '  opacity:0; transform: translateY(4px);',
    '  animation: taf-in 200ms var(--ease-out) forwards;',
    '}',
    '#' + ID + ' .taf-entry:nth-child(2) { animation-delay: 30ms; }',
    '#' + ID + ' .taf-entry:nth-child(3) { animation-delay: 60ms; }',
    '#' + ID + ' .taf-entry:nth-child(4) { animation-delay: 90ms; }',
    '@keyframes taf-in { to { opacity:1; transform: translateY(0); } }',

    '#' + ID + ' .taf-meta { font-size:11px; color:#82828c; margin-bottom:5px; }',
    '#' + ID + ' pre {',
    '  margin:0; white-space:pre-wrap; word-break:break-word;',
    '  font: 12px/1.55 ui-monospace, Menlo, Consolas, monospace; color:#e2e2e8;',
    '}',

    '@media (prefers-reduced-motion: reduce) {',
    '  #' + ID + ', #' + ID + ' button, #' + ID + ' .taf-entry, #' + ID + ' summary::before {',
    '    transition-property: opacity; animation: none; transform: none !important;',
    '  }',
    '  #' + ID + ' .taf-entry { opacity: 1; }',
    '}',
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function build() {
    injectStyle();
    const p = document.createElement('div');
    p.id = ID;
    p.setAttribute('data-state', 'closed');
    // Bam trong panel khong duoc lam mat focus cua o soan.
    p.addEventListener('mousedown', (e) => e.preventDefault());
    document.body.appendChild(p);
    return p;
  }

  function ensure(anchor) {
    if (!el || !document.body.contains(el)) el = build();
    if (anchor) anchorEl = anchor;
    position();
    if (el.getAttribute('data-state') === 'closed') {
      // Mot frame o trang thai dong de trinh duyet co diem bat dau cho transition.
      requestAnimationFrame(() => el.setAttribute('data-state', 'open'));
    }
    return el;
  }

  function position() {
    if (!el || !anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const w = 332;
    const gap = 12;

    let left = r.right + gap;
    let originX = 'left';
    if (left + w > window.innerWidth - 8) {
      left = Math.max(8, r.left - w - gap);
      originX = 'right';
    }

    el.style.left = left + 'px';
    el.style.top = Math.max(8, Math.min(r.top, window.innerHeight - 180)) + 'px';
    el.style.setProperty('--taf-origin', originX + ' top');
  }

  window.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);

  function hide() {
    if (el) el.setAttribute('data-state', 'closed');
  }

  function btn(label, title, kind) {
    const b = document.createElement('button');
    const span = document.createElement('span');
    span.className = 'taf-label';
    span.textContent = label;
    b.append(span);
    if (title) b.title = title;
    if (kind) b.setAttribute('data-kind', kind);

    // Doi nhan co lam mo, de hai trang thai khong chong len nhau.
    b.setLabel = (text, done) => {
      b.setAttribute('data-swapping', 'true');
      setTimeout(() => {
        span.textContent = text;
        b.removeAttribute('data-swapping');
        if (done) b.setAttribute('data-done', 'true');
      }, 160);
    };
    return b;
  }

  // Khop MAX_LINKS_LIMIT trong background/ai-service.js.
  const LINKS_MIN = 1;
  const LINKS_MAX = 5;
  function clampLinks(n) {
    const v = Math.round(Number(n));
    return Number.isFinite(v) ? Math.min(LINKS_MAX, Math.max(LINKS_MIN, v)) : LINKS_MIN;
  }

  // state: { phase: 'pick'|'busy'|'done'|'skipped'|'error', message, text, maxLinks,
  //          categories, selected: string[], productName, reason, insertFailed, canRegenerate }
  function render(state) {
    const p = ensure();
    p.textContent = '';

    const head = document.createElement('div');
    head.className = 'taf-head';

    const title = document.createElement('span');
    title.className = 'taf-title';
    title.textContent = 'Affiliate Finder';

    const close = btn('✕', 'Đóng panel', 'icon');
    close.addEventListener('click', hide);

    head.append(title, close);
    p.append(head);

    if (state.message) {
      const msg = document.createElement('div');
      msg.className = 'taf-msg';
      msg.textContent = state.message;
      if (state.phase === 'error') msg.setAttribute('data-tone', 'error');
      p.append(msg);
    }

    if (state.productName) {
      const prod = document.createElement('div');
      prod.className = 'taf-product';
      prod.textContent = state.productName;
      p.append(prod);
    }

    if (state.reason) {
      const r = document.createElement('div');
      r.className = 'taf-reason';
      r.textContent = state.reason;
      p.append(r);
    }

    if (state.phase === 'busy') return p;

    // ----- So link moi comment (1..5) -----
    // Doi so link khong goi AI, chi luu lai; bam Tao / Doi comment moi ap dung.
    let links = clampLinks(state.maxLinks);
    const linkRow = document.createElement('div');
    linkRow.className = 'taf-links';

    const linkText = document.createElement('span');
    linkText.className = 'taf-label-sm';
    linkText.textContent = 'Số link mỗi comment';

    const stepper = document.createElement('div');
    stepper.className = 'taf-stepper';
    const down = btn('−', 'Giảm số link');
    const value = document.createElement('span');
    value.className = 'taf-step-value';
    const up = btn('+', 'Tăng số link');
    const paint = () => {
      value.textContent = String(links);
      down.disabled = links <= LINKS_MIN;
      up.disabled = links >= LINKS_MAX;
    };
    const step = (d) => {
      const next = clampLinks(links + d);
      if (next === links) return;
      links = next;
      paint();
      onAction('maxLinks', links);
    };
    down.addEventListener('click', () => step(-1));
    up.addEventListener('click', () => step(1));
    paint();
    stepper.append(down, value, up);

    linkRow.append(linkText, stepper);
    p.append(linkRow);

    // ----- Chon danh muc (mot hoac nhieu) -----
    // Chi san pham thuoc cac danh muc dang chon moi duoc gui len AI.
    const cats = state.categories || [];
    const names = cats.map((c) => c.name);
    // Giu thu tu theo sheet de khoi danh sach gui AI on dinh (cache duoc).
    let selected = names.filter((n) => (state.selected || []).includes(n));
    let createBtn = null;

    const label = document.createElement('div');
    label.className = 'taf-label-sm';
    const updateLabel = () => {
      if (!cats.length) {
        label.textContent = 'Chưa nạp catalog. Mở popup extension, bấm Reload catalog.';
        return;
      }
      const n = cats
        .filter((c) => selected.includes(c.name))
        .reduce((sum, c) => sum + c.count, 0);
      label.textContent = selected.length
        ? 'Danh mục · đã chọn ' + selected.length + ' (' + n + ' sản phẩm)'
        : 'Danh mục · chọn một hoặc nhiều';
    };
    updateLabel();
    p.append(label);

    if (cats.length) {
      const chips = document.createElement('div');
      chips.className = 'taf-cats';
      for (const c of cats) {
        const chip = btn(c.name, c.count + ' sản phẩm', 'chip');
        chip.setAttribute('aria-pressed', String(selected.includes(c.name)));
        chip.addEventListener('click', () => {
          const on = !selected.includes(c.name);
          selected = names.filter((n) => (n === c.name ? on : selected.includes(n)));
          chip.setAttribute('aria-pressed', String(on));
          if (createBtn) createBtn.disabled = selected.length === 0;
          updateLabel();
          onAction('categories', selected.slice());
        });
        chips.append(chip);
      }
      p.append(chips);
    }

    // ----- Hang nut -----
    const row = document.createElement('div');
    row.className = 'taf-row';

    createBtn = btn(
      state.canRegenerate ? 'Đổi comment' : 'Tạo',
      state.canRegenerate ? 'Gọi AI viết lại bản khác theo các danh mục đang chọn' : 'Gọi AI chọn sản phẩm và soạn comment',
      'primary'
    );
    createBtn.disabled = selected.length === 0;
    createBtn.addEventListener('click', () => {
      if (selected.length) onAction('generate', selected.slice());
    });
    row.append(createBtn);

    // Duong lui khi moi cach chen deu that bai.
    if (state.insertFailed && state.text) {
      const copy = btn('Chép để dán tay', 'Chép comment vào clipboard');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(state.text);
          copy.setLabel('Đã chép', true);
        } catch (e) {
          copy.setLabel('Chép lỗi');
        }
      });
      row.append(copy);
    }

    p.append(row);

    return p;
  }

  // ---------- Chen text vao o soan ----------

  // Khi o soan con rong, Lexical chua thiet lap vi tri con tro noi bo nen no
  // bo qua su kien dan dau tien. Ban mot su kien dan RONG de ep no dung state
  // selection len truoc. Day chinh la ly do truoc kia phai bam "Doi comment"
  // moi chen duoc: nhanh do goi clearComposer truoc, vo tinh lam viec nay.
  function prime(composer) {
    // Thu con tro ve CUOI chu khong quet chon het, neu khong su kien dan rong
    // se xoa sach chu dang co trong o soan.
    placeCaretAtEnd(composer);

    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', '');
      composer.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      );
    } catch (e) {
      /* khong moi duoc thi van thu chen binh thuong */
    }
  }

  function placeCaretAtEnd(composer) {
    composer.focus();
    const range = document.createRange();
    range.selectNodeContents(composer);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function readText(composer) {
    return (composer.innerText || composer.textContent || '').trim();
  }

  // Lexical cap nhat DOM o microtask/frame sau chu KHONG dong bo. Kiem tra ngay
  // sau khi ban su kien se thay DOM chua doi va ket luan sai la that bai. Doi hai
  // frame la du de Lexical dung xong state va ve lai DOM.
  function nextFrames(n) {
    return new Promise((resolve) => {
      let left = n;
      const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
  }

  // Threads dung Lexical (xac nhan qua data-lexical-editor="true").
  //
  // Lexical KHONG doc DOM lam nguon su that, no giu state rieng va ve lai DOM.
  // Vi vay gan textContent truc tiep la vo nghia: chu hien ra roi bien mat,
  // va nut Post van bi vo hieu hoa vi state noi bo van rong.
  //
  // Thu lan luot 3 cach, dung ngay khi mot cach an:
  //   1. Gia lap DAN. Lexical co handler paste rieng va doc clipboardData,
  //      day la cach chay on dinh nhat.
  //   2. beforeinput voi inputType insertFromPaste, kem dataTransfer.
  //   3. execCommand('insertText'). Da deprecated va hay bi chan, de cuoi.
  async function insert(composer, text) {
    prime(composer);
    await nextFrames(1);

    const strategies = [
      function paste() {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        composer.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
        );
      },

      function beforeInputPaste() {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const opts = {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          dataTransfer: dt,
        };
        composer.dispatchEvent(new InputEvent('beforeinput', opts));
        composer.dispatchEvent(new InputEvent('input', opts));
      },

      function execCommandInsert() {
        document.execCommand('insertText', false, text);
      },
    ];

    for (const run of strategies) {
      const before = readText(composer);
      try {
        placeCaretAtEnd(composer);
        run();
      } catch (e) {
        TAF.log('chen that bai bang', run.name, e.message);
        continue;
      }

      await nextFrames(2);

      const after = readText(composer);
      if (after.length > before.length) {
        TAF.log('chen thanh cong bang', run.name);
        return { ok: true, method: run.name };
      }
    }

    return { ok: false, method: null };
  }

  async function clearComposer(composer) {
    function selectAll() {
      composer.focus();
      const range = document.createRange();
      range.selectNodeContents(composer);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    // execCommand('delete') bi Lexical chan y het insertText, nen cung phai
    // co chuoi phuong an du phong.
    const strategies = [
      function pasteEmpty() {
        const dt = new DataTransfer();
        dt.setData('text/plain', '');
        composer.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
        );
      },
      function beforeInputDelete() {
        const opts = { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' };
        composer.dispatchEvent(new InputEvent('beforeinput', opts));
        composer.dispatchEvent(new InputEvent('input', opts));
      },
      function execCommandDelete() {
        document.execCommand('delete', false);
      },
    ];

    for (const run of strategies) {
      try {
        selectAll();
        run();
      } catch (e) {
        continue;
      }
      await nextFrames(2);
      if (readText(composer) === '') return true;
    }
    return readText(composer) === '';
  }

  TAF.panel = {
    render,
    hide,
    ensure,
    insert,
    clearComposer,
    setHandler(fn) {
      onAction = fn;
    },
  };
})();
