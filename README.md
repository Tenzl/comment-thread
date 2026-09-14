# Threads Affiliate Finder

Chrome Extension giúp bạn trả lời bài viết trên Threads bằng comment gợi ý sản phẩm affiliate.
Bạn bấm vào ô bình luận, chọn một hoặc nhiều danh mục, bấm **Tạo**: AI chọn một hoặc vài sản phẩm (tuỳ số link bạn cho phép) trong các danh mục đó
và soạn comment kể trải nghiệm, extension gắn link rồi điền sẵn vào ô Reply.

**Không bao giờ tự bấm Post.** Extension chỉ điền sẵn, bạn đọc lại rồi tự gửi.

## Cách hoạt động

```
A. NẠP CATALOG (không gọi AI)
   data/seeding.xlsx (mặc định) hoặc file .xlsx khác bạn chỉ định trong Settings
        ↓
   đọc file → so SHA-256 với lần trước → trùng thì thôi
        ↓
   giải nén xlsx, đọc từng sheet: mỗi sheet là một DANH MỤC
        ↓
   mỗi dòng: { id "sheet-STT", tên, danh mục, giá = cột Giá, mô tả = cột Mô tả, note = cột Note, link }
        ↓
   lưu vào chrome.storage

B. SINH COMMENT (đúng 1 request mỗi lần bấm Tạo)
   mở post chi tiết, bấm ô Reply của bài gốc
        ↓
   panel hiện: [Chăm sóc da mặt - body] [Trang điểm] [Ăn uống]  [Tạo]
        ↓ bật một hoặc nhiều danh mục, bấm Tạo
   quét DOM: bài gốc + tối đa 10 comment của chủ post
        ↓
   gửi DeepSeek:
     system = prompt + DANH SÁCH SẢN PHẨM của các danh mục đã chọn, nhóm theo "## tên danh mục"
              "2-1 | Kẹp mi WOSADO | giá: 89k | mô tả: ... | note: ..."
     user   = bài viết + phần chủ post nói thêm
        ↓
   AI trả {products: [{productId, label}] tối đa N món, comment, reason}
        ↓
   kiểm tra mã thuộc các danh mục đã chọn → ghép link → điền vào ô Reply
        ↓
   bạn đọc lại rồi tự bấm Post → extension ghi nhận bài vào "Bài đã đăng"
```

Lướt feed không phát sinh request nào. AI chỉ được gọi khi bạn bấm **Tạo** hoặc **Đổi comment**.

## Cài đặt

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Bấm **Load unpacked**, trỏ vào thư mục này.
3. Mở **Settings** của extension (nút ⚙ trong popup):
   - Nhập **DeepSeek API key**, bấm **Test kết nối**, bấm **Lưu**.
   - Không cần làm gì với catalog: extension tự đọc `data/seeding.xlsx`.
4. Tải lại tab Threads đang mở sẵn.

Chỉ khi dùng file .xlsx **nằm ngoài** thư mục extension mới cần mở **Details** của extension
và bật **"Allow access to file URLs"**.

## Popup

Bấm icon extension để mở popup:

- **Công tắc Bật/Tắt**: tắt thì bấm ô bình luận không hiện panel nào.
- **Thống kê** tổng cộng:
  - *Đã mở*: số bài đã bấm Tạo cho AI soạn.
  - *Đã đăng*: số bài bạn đã bấm Post comment đó.
  Mỗi bài chỉ tính một lần, bấm Đổi comment hay Post lại không tăng số.
- **Catalog**: số sản phẩm, file đang dùng, các danh mục, nút **Reload catalog**.
- **Bài đã đăng**: link các bài bạn đã Post (tác giả, sản phẩm đã gắn, giờ đăng). Bấm để mở lại bài,
  ✕ để xoá khỏi danh sách, **Chép tất cả link** để lấy mỗi link một dòng. Danh sách lưu vĩnh viễn.

## Catalog: seeding.xlsx

Mỗi **sheet là một danh mục**, tên sheet chính là tên hiển thị trên panel. Trong mỗi sheet:

| Dòng | Nội dung |
|---|---|
| 1 | tiêu đề tuỳ ý, ví dụ `Link rút gọn - CHĂM SÓC DA` |
| 2 | dòng tiêu đề cột: `STT \| Tên sản phẩm \| Link rút gọn \| Mô tả \| Giá \| Note` |
| 3 trở đi | mỗi dòng một sản phẩm |

| Cột | Dùng để |
|---|---|
| `STT` | tạo mã sản phẩm `<số thứ tự sheet>-<STT>`, ví dụ `2-15` |
| `Tên sản phẩm` | gửi cho AI, hiện trên panel |
| `Link rút gọn` | link gắn vào cuối comment. Ô không phải URL thì lấy hyperlink của ô |
| `Giá` | tuỳ chọn. Số (`89000`) hoặc chữ (`89k`, `89.000đ`, `1,2tr`). Xem mục yếu tố giá bên dưới |
| `Mô tả` | **thông tin sản phẩm** gửi cho AI: công dụng, hợp với ai, cảm giác khi dùng |
| `Note` | **lời dặn AI** cách viết về riêng món này, đóng vai prompt cho từng sản phẩm |

Extension tìm dòng tiêu đề trong 10 dòng đầu theo chữ "Tên sản phẩm" và "Link", nên thêm dòng
tiêu đề phía trên không làm hỏng việc đọc. Dòng thiếu tên hoặc thiếu link bị bỏ qua.
Thêm sheet mới có đúng dòng tiêu đề là có thêm danh mục mới.

### Cột Mô tả và Note quyết định chất lượng comment

Mỗi cột một vai trò, đừng trộn:

- **Mô tả** là sự thật về sản phẩm. AI chỉ kể những gì tên và mô tả cho biết, không bịa công dụng.
  Mô tả trống thì AI đoán công dụng qua tên.
  ```
  Kem dưỡng ẩm cho da khô, thấm nhanh không bết, dùng được cả ngày lẫn đêm
  ```
- **Note** là lời dặn cách viết về món này: nên nhấn điểm nào, hợp bài kiểu nào, tránh nói gì.
  Note không thêm được công dụng ngoài mô tả và không đè được các quy tắc chung của prompt.
  ```
  nhấn vụ không bết, hợp bài than da khô mùa lạnh, đừng nói trị mụn
  ```
- **Giá** ghi riêng ở cột `Giá`. Giá nằm trong Mô tả hay Note thì AI không bao giờ dùng.

### Yếu tố giá

AI chỉ nhắc giá của một món khi đủ cả 3 điều: chủ post nói tầm giá bằng con số rõ ràng
("dưới 200k", "tầm 150k"), món có giá ở cột `Giá`, và giá món thấp hơn hoặc bằng tầm đó.
Chủ post không nói tầm giá, hoặc giá món cao hơn, thì comment không nhắc gì tới tiền.

### Sửa file thì tự cập nhật

Sửa trong Excel rồi **Save**. Extension kiểm tra lại file khi:

- Chrome khởi động,
- mở popup,
- trước mỗi lần gọi AI (tối đa 30 giây một lần).

Muốn nạp ngay thì bấm **Reload catalog** trong popup. File không đổi (hash trùng) thì không parse lại.

## Sinh comment

Khi bấm **Tạo**, extension gom bài viết cùng tối đa 10 comment **của chính chủ post**, phân biệt hai loại:

- **Trả lời người khác**: gom kèm câu đứng trước làm ngữ cảnh, vì `"dạ loại này ạ c"`
  đứng một mình thì AI không hiểu "loại này" là gì.
- **Tự bổ sung vào bài của mình**: không gắn ngữ cảnh. Đây thường là thông tin quan trọng nhất.

Mỗi nút danh mục trên panel bật/tắt độc lập, chọn được một hoặc nhiều cái. Panel hiện số danh mục
và số sản phẩm đang chọn. Chỉ sản phẩm trong các danh mục đã chọn được gửi lên, nên prompt gọn và AI
không chọn nhầm sang nhóm không liên quan. Danh sách luôn xếp theo thứ tự sheet trong file dù bạn bấm
chọn theo thứ tự nào, nên cùng một bộ danh mục thì khối này giống hệt nhau và DeepSeek cache được từ
lần gọi thứ hai. Panel nhớ bộ danh mục bạn chọn lần trước.

AI không thấy món nào hợp thì panel báo bỏ qua, bạn bật thêm danh mục khác rồi bấm lại.

### Nhiều link trong một comment

Trên panel cạnh ô bình luận, ngay trên hàng danh mục có bộ chỉnh **Số link mỗi comment** (− / +, từ 1 đến 5,
mặc định 1). Đổi số không gọi AI, chỉ được nhớ lại cho các lần sau; bấm Tạo / Đổi comment mới áp dụng. Con số được gửi kèm bài viết dưới dạng
`SỐ LINK TỐI ĐA: N` (nằm trong user message, nên đổi số không làm mất cache của prompt + danh sách).

- AI chọn **từ 1 đến N** món bổ trợ nhau (dưỡng môi + son, serum + kem dưỡng). Không đủ món thật sự
  hợp thì chọn ít hơn chứ không nhét cho đủ.
- Comment dài thêm khoảng 1 dòng / 15 chữ cho mỗi món, kể như combo đang xài và nhắc từng món bằng
  tên lóng (`label`).
- Extension kiểm tra từng mã: bỏ mã trùng, bỏ mã ngoài danh mục đã chọn (ghi vào nhật ký AI), cắt nếu quá N.

Cách gắn link:

```
1 link                          nhiều link
──────                          ──────────
môi tui cũng nứt nẻ y chang     môi tui cũng nứt y chang
xài con dưỡng môi 1 tuần là     xài dưỡng môi torriden xong đánh son bbia lên mướt
mềm hẳn
                                dưỡng môi torriden: https://s.shopee.vn/...
https://s.shopee.vn/...         son bbia: https://s.shopee.vn/...
```

Nhiều link thì mỗi dòng có tên lóng đứng trước để người đọc biết link nào là món nào.

### Prompt: giọng gen Z

Trên Threads, comment nghe như AI hoặc quảng cáo (câu tròn trịa, khen có cấu trúc, có giá, có lời mời)
bị lướt qua, bị report. Vì vậy prompt mặc định bắt AI đóng vai một người dùng gen Z gõ vội:

- 1 món thì 1 đến 3 dòng, dưới 45 chữ; mỗi món thêm khoảng 1 dòng. Độ dài đổi nhịp mỗi lần. Viết thường, gần như không chấm câu.
- Từ đệm (á, nè, nha, luôn, thiệt), teencode và từ lóng vừa phải (tối đa 2-3 cái), tối đa 1 emoji.
- Xưng hô theo chủ post, không rõ thì "tui"/"bà". Gọi sản phẩm bằng tên lóng ngắn ("con serum", "em son này").
- Kể ngôi thứ nhất về việc chính mình xài, đôi khi than vặt một điểm trừ nhỏ (bao bì, mấy bữa đầu) cho thật.
- Có ví dụ đúng giọng và ví dụ **sai giọng** để AI tránh văn phong kiểu "tình trạng", "sử dụng",
  "cải thiện đáng kể", "phù hợp với nhu cầu", liệt kê ưu nhược.
- **Cấm** giá và số tiền (trừ trường hợp ở mục yếu tố giá), "sale", "giảm giá", "voucher", "freeship", lời mời chào kiểu người bán, link, tên sàn.
- Link do extension tự tra từ mã sản phẩm rồi ghép vào cuối. AI bị cấm tự chèn link vì nó sẽ bịa URL.

Prompt mặc định nằm trong `background/ai-service.js`, chỉnh được trong Settings mà không phải sửa code.
Danh sách sản phẩm luôn được nối sau prompt, kể cả khi bạn dùng prompt riêng.

## Panel cạnh ô bình luận

| Hành động | Kết quả |
|---|---|
| Bấm ô Reply của bài gốc | Hiện bộ chỉnh số link, hàng danh mục + nút **Tạo**, chưa gọi AI |
| Bật một hoặc nhiều danh mục, bấm **Tạo** | Gọi AI, điền comment + link |
| Đổi danh mục, bấm **Đổi comment** | Gọi AI viết bản mới, ghi đè bản đang có |
| Chèn thất bại | Hiện nút **Chép để dán tay** |
| Bấm **Post** (hoặc Ctrl+Enter) | Ô soạn trống lại thì ghi nhận vào Bài đã đăng |

Comment sinh ra chỉ nằm trong bộ nhớ của trang, bấm lại vào ô soạn thì hiện lại mà không tốn request.
Tải lại trang là mất. Chỉ bài bạn đã Post mới được lưu (link bài, tác giả, sản phẩm, nội dung comment).

## Nhật ký AI

Settings có mục **Nhật ký AI** giữ 50 lần gọi gần nhất, mỗi mục mở ra xem được:

- Nguyên **nội dung đã gửi lên AI**, gồm bài gốc, comment của chủ post và danh sách sản phẩm của các danh mục đã chọn
- **JSON thô** model trả về, chưa qua xử lý
- Comment cuối cùng đã ghép link, lý do AI chọn món đó, và số token đã dùng

Khi comment ra không đúng ý, đây là chỗ để biết sai ở bước nào: gửi thiếu dữ liệu lên,
hay dữ liệu đủ mà model viết dở. Hai trường hợp này sửa hai chỗ khác nhau: một bên
sửa selector hoặc cột Mô tả / Note, một bên sửa prompt.

## Chèn vào ô soạn của Threads

Threads dùng Lexical, và Lexical **không coi DOM là nguồn sự thật**. Nó giữ state riêng
rồi vẽ lại DOM, nên gán chữ trực tiếp là vô nghĩa: chữ hiện ra rồi biến mất, và nút Post
vẫn bị vô hiệu hoá vì state nội bộ vẫn rỗng.

Extension thử lần lượt ba cách, dừng ngay khi một cách ăn:

1. **Giả lập dán.** Lexical có handler paste riêng và đọc `clipboardData`. Đây là cách chạy
   ổn định nhất và thường là cách thành công.
2. **`beforeinput`** với `inputType: insertFromPaste` kèm `dataTransfer`.
3. **`execCommand('insertText')`.** Đã deprecated và hay bị chặn nên để cuối.

Trước khi chèn, extension **mồi editor** bằng một sự kiện dán rỗng với con trỏ thu về cuối.
Khi ô soạn còn trống, Lexical chưa dựng vị trí con trỏ nội bộ nên nó bỏ qua sự kiện dán đầu
tiên. Thiếu bước này thì lần bấm đầu không chèn được, phải bấm Đổi comment mới ăn.

Việc kiểm chứng phải **chờ hai frame** rồi mới đọc lại ô soạn. Lexical vẽ lại DOM ở frame
sau chứ không đồng bộ, nên kiểm tra ngay lập tức sẽ tưởng là thất bại và thử tiếp hai cách
nữa, làm chữ vào ba lần.

Mỗi cách đều được kiểm chứng bằng cách đọc lại nội dung ô soạn, không tin vào giá trị trả
về của hàm. Nếu cả ba đều hỏng, panel hiện nút **Sao chép để dán tay** để bạn vẫn lấy được
comment ra và Ctrl+V.

Nút xoá ô soạn cũng dùng chuỗi phương án y hệt, vì `execCommand('delete')` bị Lexical chặn
giống `insertText`.

## Ba chốt an toàn

- Chỉ nhận ô bình luận của **bài gốc**. Bấm vào ô soạn của một reply thì không kích hoạt gì.
- Chỉ gọi AI khi bạn **bấm Tạo / Đổi comment**.
- Bắt đầu gõ trong lúc đang chờ AI thì huỷ việc điền, không ghi đè chữ bạn gõ.

## Cấu trúc mã nguồn

```
manifest.json
data/seeding.xlsx            catalog: mỗi sheet một danh mục
content/
  namespace.js               window.__TAF, chạy đầu tiên
  selectors.js               MỌI selector Threads gom một chỗ (kể cả nút Post)
  post-extractor.js          DOM -> object post chuẩn hoá
  reply-injector.js          panel chọn danh mục + chèn text vào Lexical
  detail-scanner.js          gom bài gốc + comment của chủ post
  observer.js                entry point: panel, gọi AI, ghi nhận bấm Post
background/
  service-worker.js          định tuyến message
  catalog.js                 đọc xlsx, so hash, tự nạp lại
  ai-service.js              prompt + gọi DeepSeek
  ai-log.js                  nhật ký 50 lần gọi gần nhất
  stats.js                   thống kê Đã mở / Đã đăng, danh sách bài đã đăng
shared/
  xlsx.js                    giải nén + parse .xlsx không cần thư viện
  settings.js
popup/                       bật/tắt, thống kê, bài đã đăng
options/                     Settings
```

Content script trong MV3 không dùng được ES module, nên các file trong `content/` chia sẻ state
qua namespace toàn cục `window.__TAF` và phải giữ đúng thứ tự khai báo trong `manifest.json`.

## Khi Threads đổi giao diện

Toàn bộ selector nằm trong `content/selectors.js`. Extension chỉ dựa vào thuộc tính ngữ nghĩa
(`data-pressable-container`, `data-pagelet`, `aria-placeholder`), riêng nút Post nhận theo chữ `Post`/`Đăng` chứ không dùng class, vì class
của Threads là chuỗi băm sinh tự động và đổi liên tục.

Bật **"In log gỡ lỗi ra Console"** trong Settings để xem extension đọc được gì trên từng post.

## Giới hạn đã biết

- Quét ngay tại thời điểm bấm Tạo và không tự cuộn trang. Chưa cuộn qua phần comment thì DOM chưa
  có đủ. Panel hiện số comment đã đọc được, thấy số nhỏ bất thường thì cuộn xuống rồi bấm lại.
- Nút Post được nhận theo chữ hiển thị. Threads đổi chữ trên nút thì thống kê Đã đăng ngừng tăng;
  sửa `POST_BUTTON_TEXT` trong `content/selectors.js`.
- Chỉ ghi nhận Post cho bài mà extension đã soạn comment trong lần tải trang đó.
