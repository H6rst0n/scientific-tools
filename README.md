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
  * **GaussView 風格 VSEPR 掃把幾何整理 🧹 (具混成態感知與氫鍵保護)**：
    * **混成軌域立體數 (Steric Number) 自適應**：依據 $\sigma$ 鍵與 $\pi$ 鍵數自動匹配目標幾何：
      * $sp$ 混成（如二氧化碳 $\text{O}=\text{C}=\text{O}$、乙炔 $\text{H}-\text{C}\equiv\text{C}-\text{H}$）自動鬆弛為 **$180^\circ$ 直線形**。
      * $sp^2$ 混成（如乙烯 $\text{H}_2\text{C}=\text{CH}_2$、甲醛、苯環）自動鬆弛為 **$120^\circ$ 平面三角形**。
      * $sp^3$ 混成自動鬆弛為 **$109.5^\circ$ 正四面體**；水分子為 $104.5^\circ$、氨分子為 $107.0^\circ$。
    * **非共價氫鍵柔性保護**：VSEPR 整理時自動將氫鍵視為柔性弱作用力（平衡距離約 $1.90\text{ \AA}$），不施加共價強壓，保護超分子幾何完整。
  * **智慧化學成鍵與鍵級推算 (Bond Order & Hydrogen Bond Perception)**：
    * **自動鍵級感知**：根據 3D 空間實際鍵長與化學典型閾值（$\text{C}-\text{C}, \text{C}=\text{C}, \text{C}\equiv\text{C}, \text{C}=\text{O}, \text{C}\equiv\text{N}$ 等），結合八隅體與價態防護，載入結構時自動識別並渲染單鍵、雙鍵與三鍵。
    * **自動氫鍵偵測**：依據 IUPAC 標準幾何準則，自動掃描 $\text{D}-\text{H}\cdots\text{A}$（$\text{D, A} \in \{\text{O, N, F}\}$），滿足 $1.5 \le d \le 2.6\text{ \AA}$ 且夾角 $\ge 115^\circ$ 時自動建立氫鍵，並以專屬亮青色立體渲染。
  * **非阻塞式幾何微調懸浮面板 (Floating Adjust Dock)**：
    * 支援 **鍵長 (Bond Length)**、**鍵角 (Bond Angle)**、**二面角 (Dihedral Angle)** 即時滑桿連續微調。
    * **GaussView 鍵型與成鍵拓樸設定 (Topology Settings)**：在鍵長面板中一鍵切換兩原子成鍵狀態：
      * 🚫 **無鍵結**（清除化學鍵連線）、➖ **單鍵**（Single）、⚌ **雙鍵**（Double，渲染平行雙圓柱）、⚞ **三鍵**（Triple，渲染三圓柱）、⋯ **氫鍵**（Hydrogen Bond，渲染亮青色細柱）。
    * **維持成鍵拓樸不破壞 (Topology Preservation)**：拖曳平移、旋轉原子或拉長鍵長時，僅更新化學鍵即時距離，絕不隨意刪除已定義之化學鍵或胡亂成鍵。
    * **絕不遮擋分子視線**：採用底部半透明毛玻璃懸浮設計，拖曳滑桿時滑鼠隨時可以在畫布上自由旋轉視角。
    * **GaussView 多模式對齊**：支援 `Fixed (固定)`、`Move/Rotate Atom (單獨移動)`、`Move/Rotate Group (牽動基團)`，具備對稱拉伸旋轉與防全固定約束安全保護。
    * **直覺操作流**：點擊頂部微調工具 $\rightarrow$ 依序點擊畫布上的 2/3/4 顆原子 $\rightarrow$ 自動彈出對應調節滑桿！
  * **經典 GaussView 滑鼠與鍵盤操控**：
    * `Shift + 左鍵拖曳`：**矩形框選多個原子 (Marquee Selection)**，快速選取多個目標基團。
    * `1-2-3-4-5 點擊循環量測`：第 1 下顯示原子坐標、第 2 下量測鍵長、第 3 下量測鍵角、第 4 下量測二面角、第 5 下自動重置並開啟新量測。
    * `Alt + 滑鼠左鍵拖曳`：**繞幾何重心旋轉選中的原子群 (Rotate Selected Atoms)**。
    * `Alt + 滑鼠右鍵拖曳`：**在視野平面上平移選中的原子群 (Translate Selected Atoms)**（平移後保持既有鍵結）。
    * `Ctrl + Z / Ctrl + Y`：完備的歷史還原系統，每一步位移、筆刷、加氫、整理皆可即時復原。
  * **週期表混成片段與原子筆刷 (Brush Mode) - 具局部自動補氫**：
    * 內建 1~118 號元素週期表與混成狀態選擇器 ($sp^3, sp^2, sp$, 平面四邊形, 八面體等)。
    * **筆刷雙用**：點擊畫布既有原子即可進行元素置換；點擊空白處則直接在 3D 視角焦點平面上生成新原子。
    * **GaussView 局部自動補氫**：新增或替換原子時，自動依據目標價態與混成空間構型為該原子補足氫原子（例如點空白處放 C 自動生成 $CH_4$）。
  * **視覺與外觀深度自訂 (Appearance & Customization)**：
    * **非阻塞式懸浮工具窗 (Floating Dock)**：調整原子大小與顏色時絕不遮擋分子視野，支援拖曳滑桿時隨時以滑鼠旋轉視角即時觀察。
    * **各選色區塊內嵌「最近使用的顏色」(Recent Colors)**：在「背景色」、「特定元素」、「個別選中原子」三個區塊各自內嵌最近使用的 10 組色票，點擊精準直接套用。
    * **3D 畫布背景色**：支援自由調色盤與深藍黑、純黑、純白、科研灰一鍵切換。
    * **特定元素全域自訂**：可自由修改特定元素（如 Li, C, Fe）在全場景的顯示顏色與半徑大小倍率。
    * **個別原子單獨自訂**：可針對目前選中的特定原子單獨自訂色彩與半徑倍率（具備最高渲染優先級），支援隨時恢復預設。
    * **空間填充 (Spacefill) 滑桿**：切換為空間填充模型時，即時滑桿自由縮放范德華球體尺寸（0.3x ~ 1.6x）。
  * **透視 (Perspective) 與正交 (Orthographic) 投影一鍵切換**：
    * 支援科研出版正交無畸變視圖與立體空間透視視圖流暢切換。
  * **週期性晶體網絡與超晶胞 (Periodic Materials & Supercells)**：
    * **平滑折疊抽屜**：支援側邊欄一鍵收合至螢幕右側，釋放 0D 分子建模視野。
    * 嚴格支援正交與非正交三斜/單斜晶胞幾何運算。
    * **最小鏡像約定跨胞化學鍵全連通**：視覺擴胞時原胞與擴胞之間、擴胞與擴胞之間的實體化學鍵自動無縫連通，展現連貫晶格網絡。
    * **俐落晶格框**：擴胞時維持僅顯示主晶胞線框（12 條邊），不產生多餘雜亂外框。
    * 支援 GPU 實例化零負擔視覺擴胞（`1x1x1` ~ `5x5x5`）與物理實體超晶胞生成 (Supercell Expansion)。
  * **計算化學與晶體結構多格式互通 (Multi-Format Interoperability)**：
    * **讀入 (Import)**：
      * **VASP**：`POSCAR`、`CONTCAR`、`*.vasp`（支援 Direct 分數與 Cartesian 笛卡爾座標）。
      * **PDB**：`*.pdb`（蛋白質與生物大分子/小分子結構）。
      * **Gaussian**：`*.gjf`、`*.com`。
      * **ORCA**：`*.inp`。
      * **Tinker XYZ**：`*.arc`、`*.xyz`（支援成鍵連接清單與原子類型）。
      * **LAMMPS Data**：`*.data`、`*.lammps`（解析晶胞邊界、Masses 質量自動映射化學元素、Atoms 座標）。
      * **LAMMPS Dump**：`*.lammpstrj`、`*.dump`（讀取動態軌跡快照與邊界）。
      * **Quantum ESPRESSO**：`*.in`、`*.pwi`。
      * **CIF & XYZ**：`*.cif`、標準與 Extended XYZ (`*.xyz`)。
    * **匯出 (Export)**：Gaussian GJF, ORCA INP, VASP Direct POSCAR, Quantum ESPRESSO PWscf, Tinker Cartesian XYZ, LAMMPS Data File, CIF, XYZ, PDB。

---

### 2. ⚡ 科研能量圖繪製工具 (Reaction Energy Profile Plotter)

> 專為化學、物理與材料計算化學設計的反應位能面（PES / Reaction Coordinate Diagram）繪製工具。

* **工具入口**：[`energy-profile-plotter.html`](./energy-profile-plotter.html)
* **主要功能**：
  * 支援多反應路徑（Multi-pathway）對比與不同階層標籤定義。
  * D3.js 互動式節點能階拖曳、標籤直接編輯與即時預覽。
  * 靈活自訂畫布比例（16:9, 4:3, 1:1, 自訂像素）、字體大小與專屬色盤。
  * 支援高解析度出版級格式匯出（SVG 向量圖、300+ DPI PNG、PDF 與 JSON 專案儲存檔）。

### 3. 📈 VASP 態密度分析與繪製儀 (VASP DOS Plotter)

> 專為 VASP 第一性原理計算打造的純前端態密度 (DOS/PDOS) 視覺化與物理特徵分析工具。

* **工具入口**：[`vasp-dos-plotter.html`](./vasp-dos-plotter.html)
* **主要功能**：
  * **僅支援選取計算目錄**：直覺載入計算資料夾，自動精確讀取並交叉比對 `DOSCAR` 與 `POSCAR`/`CONTCAR`。
  * **智慧參數與自旋識別**：自動判讀費米能級 ($E_F$)、自旋極化狀態 (`ISPIN=1/2`) 以及角動量分解精度 (`LORBIT=10/11`)。
  * **多數據組與多子圖佈局**：支援載入多個計算體系（如 Pristine vs Doped），提供左右並排 (1×N)、上下直排 (N×1) 或單圖重疊對比，並可選擇共用相鄰座標軸。
  * **雙向排版與刻度控制**：支援橫向 ($E$ on X) 與縱向 ($E$ on Y，能帶對齊用)；能量軸與態密度軸均可自由自訂上下限範圍與刻度間距。
  * **精細曲線圖層系統**：預設 TDOS，支援依元素加總、指定原子序號，以及 $s, p, d, f$ 或 $t_{2g}, e_g, d_{z^2}$ 等投影軌域自訂，含多種線條樣式與半透明面積填色。
  * **科研指標與高斯平滑**：提供高斯展寬（含數值平滑說明 Banner）、費米線標記、能隙 (Band Gap) 自動偵測與 $d$ 帶中心 (d-band center) 數值積分。
  * **出版級高畫質匯出**：支援向量 SVG (字型與樣式內嵌)、300 DPI 超取樣 PNG，以及 Origin/Excel 友善之乾淨 CSV 數據檔。

---

## ⌨️ AtomCraft 3D 快捷鍵速查表

| 按鍵組合 | 動作說明 |
| :--- | :--- |
| **滑鼠左鍵拖曳** | 3D 視角立體軌道旋轉 (Orbit) |
| **滑鼠右鍵 / 滾輪拖曳** | 3D 視角平移 (Pan) |
| **滑鼠滾輪滾動** | 視角縮放 (Zoom) |
| **Shift + 左鍵拖曳** | **矩形框選多個原子 (Marquee Select)** |
| **點擊原子 (1~4下)** | 依序量測：第1下顯示坐標，第2下顯示鍵長，第3下顯示鍵角，第4下顯示二面角 |
| **點擊第 5 下** | 自動取消前 4 顆選取，重新從第 1 顆開始新循環 |
| **點擊畫布空白處** | 取消所有選取（在筆刷模式下為新增原子並自動補氫） |
| **替換筆刷模式** | 點擊週期表啟用筆刷，點擊原子直接置換並自動補氫，按 Esc 退出 |
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
