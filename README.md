# Lumatek

在瀏覽器中使用的靜態工具箱。目前提供 Log 整理工具，AES 加解密頁面則僅供版面預覽，功能尚未實作。

## 使用方式

直接用瀏覽器開啟 `index.html`，或開啟部署後的網站，從工具選單切換頁面。將 Log 貼到輸入框後，頁面會自動擷取並格式化 JSON，並產生遮罩後的原始 Log；兩份結果都可以複製。即使 Log 不包含 JSON，仍會產生遮罩後的原始 Log。資料只在瀏覽器本機處理，不會上傳。

頁面右上角可切換淺色與深色模式；偏好設定會儲存在瀏覽器中。

格式化 JSON 保留原始資料。遮罩後的 Log 會辨識名稱包含 `key`、`token`、`secret`、`password`、`passwd`、`authorization`、`cookie` 或 `session` 的欄位。較長的字串會保留首尾各兩個字元；`uid`、`player_id` 和 `player_name` 不會遮罩。

**分享前請自行檢查**：其他名稱或格式的敏感資料可能不會被辨識，遮罩也不會完全隱藏較長的值。

## 部署到 GitHub Pages

1. 將專案推送至 GitHub repository，並確認 `index.html` 位於 repository 根目錄。
2. 在 repository 的 **Settings → Pages** 中，將 **Source** 設為 **Deploy from a branch**。
3. 選擇要部署的分支（例如 `main`）及 **/ (root)**，然後儲存。
4. 等待部署完成，從 Pages 設定頁取得網站網址。

GitHub Pages 的可用性取決於 repository 的可見度和帳戶方案；公開 repository 的內容也會公開。
