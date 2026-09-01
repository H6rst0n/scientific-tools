# 🔬 科學與實用腳本工具箱 (Tools Hub)

這是一個純前端、輕量化、免安裝環境的**在線科學與實用工具平台**，可直接託管於 **GitHub Pages** 提供線上使用。

所有工具皆採用純客戶端（Client-side）技術開發，**數據與計算全程於使用者本機瀏覽器內執行**，兼具運算效能與資料隱私安全。

---

## 🚀 已收錄工具清單

| 工具名稱 | 英文名稱 | 分類 | 檔案路徑 | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| **科研能量圖繪製工具** | Reaction Energy Profile Plotter | 科研繪圖 | [`energy-profile-plotter.html`](./energy-profile-plotter.html) | 專業化學/物理反應自由能坐標圖 (PES) 繪製與匯出，支援多路徑比對、D3.js 互動編輯與高解析度 SVG/PNG/PDF 匯出。 |

---

## 🛠️ GitHub Pages 部署步驟（5 分鐘完成）

### 步驟 1：在 GitHub 建立儲存庫 (Repository)
1. 登入 [GitHub](https://github.com/)。
2. 點擊右上角的 **+** 號，選擇 **New repository**。
3. 輸入 Repository 名稱（例如：`scientific-tools` 或 `my-tools`）。
4. 選擇 **Public**（公開），點擊 **Create repository**。

### 步驟 2：將本機專案推送到 GitHub
開啟終端機（PowerShell 或 CMD），在專案資料夾內依序執行以下指令：

```bash
# 1. 初始化 Git 倉庫
git init

# 2. 加入所有檔案
git add .

# 3. 提交變更
git commit -m "feat: initial commit with tool hub and energy profile plotter"

# 4. 指定主分支為 main
git branch -M main

# 5. 關聯遠端 GitHub 倉庫（請替換為您自己的帳號與倉庫名稱）
git remote add origin https://github.com/<您的GitHub帳號>/<您的倉庫名稱>.git

# 6. 推送至 GitHub
git push -u origin main
```

### 步驟 3：在 GitHub 啟用 GitHub Pages
1. 進入您剛建立的 GitHub 倉庫頁面。
2. 點擊上方導航欄的 **Settings**（設定）。
3. 在左側選單點選 **Pages**。
4. 在 **Build and deployment** 區塊：
   - **Source**: 選擇 `Deploy from a branch`。
   - **Branch**: 選擇 `main` 分支，資料夾選擇 `/(root)`。
   - 點擊 **Save**（儲存）。
5. 等待 1~2 分鐘，頁面頂部會出現您的專屬網站網址：
   `https://<您的GitHub帳號>.github.io/<您的倉庫名稱>/`

---

## ➕ 如何新增更多腳本工具？

當您開發出新的單頁 HTML 工具時，只需要兩步即可整合到首頁：

1. **放置檔案**：將新的 HTML 檔案放入專案中（例如 `tools/new-tool.html` 或直接放在根目錄）。
2. **更新清單**：打開 `index.html`，在內部的 `TOOLS_DATA` 陣列中新增一筆工具資訊：

```javascript
{
  id: 'unit-converter',
  title: '物理化學單位換算器',
  titleEn: 'Physical Chemistry Unit Converter',
  description: '支援 eV, Hartree, kcal/mol, kJ/mol 等能量單位精確雙向換算。',
  category: '數據分析',
  tags: ['單位換算', '量子化學', '能量'],
  icon: '🔄',
  badge: 'NEW',
  url: './unit-converter.html',
  version: 'v1.0.0',
  updatedAt: '2026-09'
}
```

3. 執行 `git add .`、`git commit -m "add: new tool"`、`git push`，GitHub Pages 便會自動更新！

---

## 💻 本地端預覽與測試

若要在本機直接開啟測試：
- 直接雙擊 `index.html` 或用瀏覽器開啟即可。
- 或在 VS Code 中使用 `Live Server` 外掛插件預覽。
