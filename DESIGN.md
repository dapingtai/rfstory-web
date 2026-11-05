# RFStory 設計與實作契約

## 品牌來源
直接採用使用者提供的 RFStory 需求文件；不套用 FARobot 或其他品牌。核心：照片優先、專業但簡潔、即時預覽、預設不裁切。預設模板為底片紀錄。

## 色彩
深色：背景 #0B0B0D、面板 #161618、浮層 #202023、文字 #F5F5F5、次文字 #9A9A9F、邊框 #303034、強調 #D6D3CD。
淺色：背景 #FAFAF9、面板 #FFFFFF、文字 #18181B、次文字 #71717A、邊框 #E4E4E7、強調 #292524。
CSS 六核心變數為 --bg --surface --fg --muted --border --accent；透明與狀態使用 color-mix 推導。所有字面色彩集中於 :root 或主題 token 宣告。

## 字體、空間與動態
品牌與行銷展示字：Georgia、Noto Serif TC、serif；操作介面：Manrope、Noto Sans TC、system-ui、sans-serif；數值：JetBrains Mono、ui-monospace、monospace。頁面標題採 serif，編輯器控制採 sans。8px 空間基線，邊框 1px，圓角 6–8px。字級 12/13/14/16/20/28/40/64；行高 1.5，展示標題 1.08。動態 150ms，僅狀態回饋，尊重 reduced-motion。

## 頁面契約
index.html 僅為精緻產品入口與簡潔導覽，完整品牌首頁 landing.html，工作室 studio.html，模板 gallery.html，設計系統 components.html。所有連結相對路徑。
studio.html?empty=1 進入空白狀態；studio.html?template=classic-white / dark-gallery / film-archive / editorial / technical-exif / signature 套用對應模板。預設 film-archive。
手機網頁沿用 studio.html 的響應式行為；mobile-studio.html 與 mobile-export.html 提供直接進入對應行動工作流程的獨立入口。桌面匯出以 dialog 呈現而非把多個狀態堆在長頁面。

## 攝影與檔案
如使用公開攝影素材，下載至專案 assets 並在 SOURCES.md 註明；不得假裝素材是使用者作品。無法取得照片時提供可上傳的誠實空白狀態，不以 SVG 風景代替照片。
實際支援本機 JPEG/PNG/WebP。RAW 檔選取後顯示「此原型尚未接入 RAW 解碼，請先轉為 JPEG、PNG 或 WebP」；不得虛構解析成功。瀏覽器本地處理，不虛構伺服器上傳進度。未實作 EXIF 解析時所有資訊為手動輸入，不冒稱自動讀取；原始值未知時顯示缺漏。GPS 預設不顯示，Canvas 匯出不複製原始 metadata。

## 元件與狀態
Button/IconButton/Input/Select/Slider/Checkbox/Tabs/Accordion/Dialog/Toast/Progress/Skeleton/ColorPicker 為可複用 class 與 DOM 區塊；攝影元件 UploadZone/Thumbnail/PhotoCanvas/FramePreview/TemplateCard/MetadataItem/Inspector/ExportPreview/AspectRatioSelector。按鈕提供 hover/focus-visible/active/disabled；輸入提供 label，錯誤具 aria-live；dialog 可 Escape 關閉及原生焦點管理。
照片框設定、文字、EXIF 手動欄位、比例應即時更新；格式 JPEG/PNG/WebP，匯出與預覽共用畫布渲染以確保一致。限制畫布尺寸避免記憶體過量，無來源照片時不可下載。

## 響應式與可及性
桌面三欄：左素材/模板、中央最大畫布、右 Inspector。平板收合側欄；手機全寬畫布、水平模板列、固定底部操作與設定 sheet。360–1920px 不水平溢出。手機點擊目標至少 44px；數值用 tabular-nums；圖示按鈕有中文 aria-label。

## 驗收與已知界線
交付可操作的 HTML 原型，非 Nuxt 正式專案；不新增框架依賴或後端。RAW 解碼、完整 EXIF 解析為後續整合項，介面誠實揭露。需檢查本機載入、六模板、保留比例、手動資訊、undo/redo、預設儲存、匯出下載、深淺主題、手機面板、鍵盤與錯誤恢復。
