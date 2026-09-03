# 🔬 科學與實用腳本工具箱 (Scientific & Utility Tools Hub)

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?style=flat-square&logo=github)](https://pages.github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Pure Client-Side](https://img.shields.io/badge/Computation-100%25%20Client--Side-orange?style=flat-square)]()
[![Three.js](https://img.shields.io/badge/WebGL-Three.js%20r128-black?style=flat-square&logo=three.js)]()

歡迎使用 **科學與實用腳本工具箱**！這是一個專為計算化學家、材料科學家、物理研究員與學生打造的純前端、免安裝輕量化在線研究工具平台。

所有工具皆採用 **100% 純前端技術（Client-side WebGL / SVG / Canvas）** 開發，無需安裝 Python、Java 或編譯環境，打開瀏覽器或放上 GitHub Pages 即可直接運行。數據計算與繪圖均在使用者本地瀏覽器記憶體中完成，具有極高的安全與隱私性。

🌐 **線上使用入口**：[點此立即前往工具箱首頁](https://h6rst0n.github.io/scientific-tools/)

---

## 🛠️ 收錄工具一覽

### 1. ⚛️ AtomCraft 3D | 計算化學與晶體材料建模工具 (AtomCraft 3D Builder)

> 讓化學家在瀏覽器中擁有媲美 **GaussView** 的流暢直覺編輯手感，兼具 **VESTA / Materials Studio** 的晶體材料與週期性超晶胞處理能力！

* **工具入口**：[`atomcraft/index.html`](./atomcraft/index.html)
* **核心功能亮點**：
  * **GaussView 風格 VSEPR 掃把幾何整理 🧹**：
    * 基於價層電子對互斥理論（VSEPR）、元素共價半徑與混成軌域幾何模板（$sp^3$ 四面體、$sp^2$ 平面三角形、$sp$ 直線形、八面體、平面四邊形等），一鍵快速鬆弛並整理分子立體構型。
  * **非阻塞式幾何微調懸浮面板 (Floating Adjust Dock)**：
    * 支援 **鍵長 (Bond Length)**、**鍵角 (Bond Angle)**、**二面角 (Dihedral Angle)** 即時滑桿連續微調。
    * **絕不遮擋分子視線**：採用底部半透明毛玻璃懸浮設計，拖曳滑桿時滑鼠隨時可以在畫布上自由旋轉視角。
    * **GaussView 多模式對齊**：支援 `Fixed (固定)`、`Move/Rotate Atom (單獨移動)`、`Move/Rotate Group (牽動基團)`，具備對稱拉伸旋轉與防全固定約束安全保護。
    * **直覺操作流**：點擊頂部微調工具 $\rightarrow$ 依序點擊畫布上的 2/3/4 顆原子 $\rightarrow$ 自動彈出對應調節滑桿！
  * **經典 GaussView 滑鼠與鍵盤操控**：
    * `1-2-3-4-5 點擊循環量測`：第 1 下顯示原子坐標、第 2 下量測鍵長、第 3 下量測鍵角、第 4 下量測二面角、第 5 下自動重置並開啟新量測。
    * `Alt + 滑鼠左鍵拖曳`：**繞幾何重心旋轉選中的原子群 (Rotate Selected Atoms)**。
    * `Alt + 滑鼠右鍵拖曳`：**在視野平面上平移選中的原子群 (Translate Selected Atoms)**。
    * `Ctrl + Z / Ctrl + Y`：完備的歷史還原系統，每一步位移、筆刷、加氫、整理皆可即時復原。
  * **週期表混成片段與原子筆刷 (Brush Mode)**：
    * 內建 1~118 號元素週期表與混成狀態選擇器。
    * **筆刷雙用**：啟用筆刷後，點擊畫布既有原子即可進行元素置換；**點擊空白處則直接在 3D 視角焦點平面上生成新原子**，無中生有快速建模。
  * **透視 (Perspective) 與正交 (Orthographic) 投影一鍵切換**：
    * 支援科研出版正交無畸變視圖與立體空間透視視圖流暢切換。
  * **週期性晶體網絡與超晶胞 (Periodic Materials & Supercells)**：
    * 嚴格支援正交與非正交三斜/單斜晶胞幾何運算。
    * **最小鏡像約定跨胞化學鍵全連通**：視覺擴胞時原胞與擴胞之間、擴胞與擴胞之間的實體化學鍵自動無縫連通，展現連貫晶格網絡。
    * **俐落晶格框**：擴胞時維持僅顯示主晶胞線框（12 條邊），不產生多餘雜亂外框。
    * 支援 GPU 實例化零負擔視覺擴胞（`1x1x1` ~ `5x5x5`）與物理實體超晶胞生成 (Supercell Expansion)。
  * **計算化學與晶體結構多格式互通**：
    * **讀入 (Import)**：Gaussian (`.gjf`/`.com`), ORCA (`.inp`), VASP (`POSCAR`/`CONTCAR`), Quantum ESPRESSO (`.in`), Extended XYZ, CIF, PDB。
    * **匯出 (Export)**：Gaussian GJF, ORCA INP, VASP Direct POSCAR, Quantum ESPRESSO PWscf, CIF, XYZ, PDB。

---

### 2. ⚡ 科研能量圖繪製工具 (Reaction Energy Profile Plotter)

> 專為化學、物理與材料計算化學設計的反應位能面（PES / Reaction Coordinate Diagram）繪製工具。

* **工具入口**：[`energy-profile-plotter.html`](./energy-profile-plotter.html)
* **主要功能**：
  * 支援多反應路徑（Multi-pathway）對比與不同階層標籤定義。
  * D3.js 互動式節點能階拖曳、標籤直接編輯與即時預覽。
  * 靈活自訂畫布比例（16:9, 4:3, 1:1, 自訂像素）、字體大小與專屬色盤。
  * 支援高解析度出版級格式匯出（SVG 向量圖、300+ DPI PNG、PDF 與 JSON 專案儲存檔）。

---

## ⌨️ AtomCraft 3D 快捷鍵速查表

| 按鍵組合 | 動作說明 |
| :--- | :--- |
| **滑鼠左鍵拖曳** | 3D 視角立體軌道旋轉 (Orbit) |
| **滑鼠右鍵 / 滾輪拖曳** | 3D 視角平移 (Pan) |
| **滑鼠滾輪滾動** | 視角縮放 (Zoom) |
| **點擊原子 (1~4下)** | 依序量測：第1下顯示坐標，第2下顯示鍵長，第3下顯示鍵角，第4下顯示二面角 |
| **點擊第 5 下** | 自動取消前 4 顆選取，重新從第 1 顆開始新循環 |
| **點擊畫布空白處** | 取消所有原子選取（在筆刷模式下則為新增原子） |
| **Alt + 左鍵拖曳** | **旋轉選中的原子群 (Rotate Selected Atoms)** |
| **Alt + 右鍵拖曳** | **平移選中的原子群 (Translate Selected Atoms)** |
| **Ctrl + Z / Ctrl + Y** | 復原上一步 (Undo) / 重做 (Redo) |
| **Space / Ctrl + E** | 🧹 觸發 VSEPR 掃把立體幾何整理 |
| **H / Shift + H** | 自動補足氫原子 (+H) / 移除氫原子 (-H) |
| **Ctrl + A** | 全選畫布上的所有原子 |
| **Delete / Backspace** | 刪除目前選中的所有原子 |
| **Esc** | 關閉微調懸浮面板、退出筆刷模式或取消所有選取 |
| **檔案直接拖曳** | 支援將 XYZ / GJF / ORCA / POSCAR / CIF / PDB 拖入視窗直接載入 |

---

## 💻 離線與本機使用

本專案所有相依函式庫均已本機化打包於倉庫內，完全支援無網路離線運行：

1. 點擊 GitHub 頁面右上角 `Code` $\rightarrow$ `Download ZIP` 下載解壓縮（或使用 `git clone`）。
2. 直接雙擊 `index.html` 即可瀏覽工具首頁，或直接開啟 `atomcraft/index.html` 進入 3D 建模工具。

---

## 🧪 測試驗證

本專案附帶自動化驗證測試套件，包含 61 項數學精度與互動邏輯斷言：
* **測試頁面**：[`atomcraft/test_suite.html`](./atomcraft/test_suite.html)
* **涵蓋範圍**：分數坐標雙向轉換、VASP/Gaussian/ORCA 讀寫解析、VSEPR 鍵角修正、晶格頂點正交性、GaussView 1-2-3-4-5 選取循環、幾何多模式拉伸、Alt 滑鼠拖曳模式以及跨晶胞週期性鍵結完整性。

---

## 📄 免責與商標聲明 (Disclaimer & Trademarks)

- **AtomCraft 3D** 是一套獨立的原創開源純前端研究與教學工具。
- 文中提及之所有產品名稱、商標與註冊商標（包括 Gaussian®, GaussView®, VESTA®, VASP®, Materials Studio®, ORCA®）均屬其各自擁有者之財產。文中對其之提及僅作為學術操作習慣對齊、相容性說明與數據格式互通之描述性引用，不代表任何官方背書、附屬或合作關係。
- 檔案匯入匯出與相容性功能純粹基於科學研究之互通性（Interoperability）實作。

---

## 📜 開源授權 (License)

本專案採用 [MIT License](LICENSE) 授權開放原始碼。
