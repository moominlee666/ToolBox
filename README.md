# Lumatek

在瀏覽器中使用的靜態工具箱，提供 Log 整理、AES-CBC 加解密、MD5 Hash、PDF 保護及 PDF 文字編輯工具。

## 使用方式

直接用瀏覽器開啟 `index.html`，或開啟部署後的網站，從工具選單切換頁面。將 Log 貼到輸入框後，頁面會自動擷取並格式化 JSON，並產生遮罩後的原始 Log；兩份結果都可以複製。即使 Log 不包含 JSON，仍會產生遮罩後的原始 Log。資料只在瀏覽器本機處理，不會上傳。

頁面右上角可切換淺色與深色模式；偏好設定會儲存在瀏覽器中。

格式化 JSON 保留原始資料。遮罩後的 Log 會辨識名稱包含 `key`、`token`、`secret`、`password`、`passwd`、`authorization`、`cookie` 或 `session` 的欄位。較長的字串會保留首尾各兩個字元；`uid`、`player_id` 和 `player_name` 不會遮罩。

**分享前請自行檢查**：其他名稱或格式的敏感資料可能不會被辨識，遮罩也不會完全隱藏較長的值。

## AES-CBC 加解密

在 AES 頁面輸入內容、KEY、IV，選擇各自的編碼及 padding，再點選加密或解密。明文使用 UTF-8，密文支援 Base64、Base64URL 或 Hex；KEY 與 IV 支援 UTF-8、Hex 或 Base64。Base64 輸入也接受 Base64URL 字元及省略的尾端 `=`；選擇 Base64URL 時，加密結果不含尾端 `=`。KEY 必須為 16、24 或 32 bytes，IV 必須為 16 bytes。

Padding 可選 PKCS#7（預設）或 None。None 不新增或移除任何填充，加密明文的 UTF-8 位元組長度必須是 16 的倍數；解密時保留所有字元，無效的 UTF-8 序列會以替代字元顯示，與 .NET 的 `Encoding.UTF8.GetString` 預設行為一致。

另有 JDB 相容選項：加密使用 PKCS#7，解密使用 None，對應 `Aes.Create()` 的預設加密及 `PaddingMode.None` 解密。解密結果會保留填充字元；若要輸出不含尾端 `=` 的密文，請選擇 Base64URL。

加密與解密在本機處理，不會上傳內容。PKCS#7 的 AES-128 和 AES-256 使用瀏覽器的 Web Crypto API；AES-192 和 None padding 使用本機打包的 `@noble/ciphers`，以相容瀏覽器的限制。此功能需要安全環境，例如 HTTPS、localhost 或支援的本機檔案頁面。UTF-8 KEY 會直接編碼為位元組，不會進行密碼衍生。

加密時應使用每次全新且不可預測的 IV。AES-CBC 不提供資料完整性驗證，無法保證密文未被修改或 KEY／IV 正確；新系統建議選用具驗證功能的加密模式。

部署時須一併上傳 `aes-crypto.js` 及 `vendor` 目錄。AES-192 相容程式已打包在 `vendor` 中；若需重新打包，可執行 `npm install` 和 `npm run build:aes`，並以 `npm test` 執行測試。套件授權見 `vendor/NOBLE-CIPHERS-LICENSE.txt`。

## MD5 Hash

輸入 Request Data 字串，可選填 Agent ID 與 Agent Secret。工具會依序直接串接三者，將結果以 UTF-8 計算 MD5，輸出雜湊前字串及小寫十六進位雜湊值。內容不會自動格式化或驗證為 JSON，空白及換行都會影響結果；比對欄位會逐字比對雜湊前字串，並標示差異。差異過多或比對逾時時，只顯示第一處差異。

也可切換至「純字串比對」，自行輸入 Hash 前字串與比對字串，不需要填寫 Request Data，也不計算 MD5。

雜湊前字串包含輸入的 Agent Secret，分享時請留意。MD5 不適合新系統的安全驗證或密碼儲存。計算與比對在瀏覽器本機進行；部署時須上傳 `vendor/md5-hash.js` 和 `vendor/md5-diff.js`。可執行 `npm install`、`npm run build:md5` 和 `npm run build:diff` 重新打包，套件授權見 `vendor/NOBLE-HASHES-LICENSE.txt` 和 `vendor/DIFF-LICENSE.txt`。

## PDF 保護

選擇一個或多個未加密的 PDF，設定浮水印文字、開啟密碼或兩者皆設定。浮水印可選中央、直列三個或分散排列，並調整深淺。單一檔案下載 PDF，多個檔案下載 ZIP；部分失敗時會列出原因。PDF 與密碼只在瀏覽器處理，不會上傳。

浮水印是覆蓋在頁面上的圖片，無法防止移除或複製；ZIP 本身不加密。已加密的 PDF 請先解除密碼。此功能須透過 HTTPS 或 localhost 開啟網站，無法直接從 `file:` 網址使用。

本機若已安裝 Python，可在專案根目錄執行 `python -m http.server 8000 --bind 127.0.0.1`，再開啟 `http://localhost:8000`。

部署時須上傳 `pdf-lock/assets`。重新建置需要 Node.js 24，執行 `npm install`、`npm run build:pdf` 與 `npm test`；套件授權見 `pdf-lock/licenses`。

## PDF 文字編輯

選擇可選取文字的 PDF，在頁面預覽中點選要修改的文字區段，輸入新文字並確認修改；可以調整字體大小。通常會選取整行，若同一行有分離區段則選取點擊的區段。水平文字與斜向浮水印重疊時，會優先選取水平文字。留空新文字可刪除所選區段。修改後檢查預覽，再下載新的 PDF；原始檔案不會被覆寫。

字型可選擇支援繁體中文的 Noto Sans TC，或 Public Sans 的一般、中等、半粗及粗體。Public Sans 不支援中文；如需輸入中文，請選擇 Noto Sans TC。工具不會自動辨識原文字型或字重，請自行選擇並檢查預覽。

修改時會自動擷取點選字元的文字填色與透明度，套用至新文字。若選取區段含有多種顏色，新文字只使用點選字元的顏色；描邊等不支援的文字繪製方式會顯示錯誤，不會套用修改。顏色以 PDF 文字資料為準，浮水印及其他重疊內容可能影響預覽的視覺效果。

工具會移除所選區段的原文，再寫入新文字並完整重存，而不是只用色塊遮蓋。每次修改前會確認：重疊的圖片、線條、註解或表單欄位也可能被移除，新文字的字型、顏色與排版可能和原文不同。請保留原始檔，並檢查輸出。PDF 其他位置或中繼資料可能另有相同文字，不能將此功能視為完整敏感資料清除工具。

目前僅支援可選取、水平且由左至右的單行文字；不支援掃描圖片或直排文字，部分受密碼或數位簽章保護的文件可能無法修改。資料在瀏覽器本機處理；此功能須透過 HTTPS 或 localhost 開啟。

部署時須上傳 `pdf-lock/assets`、`pdf-edit/NotoSansTC.ttf` 及 `pdf-edit/PublicSans-*.ttf`；重新建置使用 `npm run build:pdf`。PDF 引擎與字型授權檔位於 `pdf-edit`。

PDF 編輯引擎目前依賴受 [Zod 記憶體耗盡問題](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)影響的版本；處理不受信任的文件可能導致瀏覽器工作程序耗盡記憶體。上游尚未提供相容的修正版本，請避免開啟不受信任的 PDF。

## 部署到 GitHub Pages

1. 將專案推送至 GitHub repository，並確認 `index.html` 位於 repository 根目錄。
2. 在 repository 的 **Settings → Pages** 中，將 **Source** 設為 **Deploy from a branch**。
3. 選擇要部署的分支（例如 `main`）及 **/ (root)**，然後儲存。
4. 等待部署完成，從 Pages 設定頁取得網站網址。

GitHub Pages 的可用性取決於 repository 的可見度和帳戶方案；公開 repository 的內容也會公開。
