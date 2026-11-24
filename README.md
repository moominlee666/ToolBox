# Lumatek

在瀏覽器中使用的靜態工具箱，提供 Log 整理、AES-CBC 加解密、MD5 Hash 及 PDF 保護工具。

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

## 部署到 GitHub Pages

1. 將專案推送至 GitHub repository，並確認 `index.html` 位於 repository 根目錄。
2. 在 repository 的 **Settings → Pages** 中，將 **Source** 設為 **Deploy from a branch**。
3. 選擇要部署的分支（例如 `main`）及 **/ (root)**，然後儲存。
4. 等待部署完成，從 Pages 設定頁取得網站網址。

GitHub Pages 的可用性取決於 repository 的可見度和帳戶方案；公開 repository 的內容也會公開。
