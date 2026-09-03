# ⚛️ AtomCraft 3D | 計算化學與晶體材料建模工具

> **AtomCraft 3D** 是一款純前端、免安裝、支援 WebGL 硬體加速的 3D 計算化學與材料科學建模工具。
> 結合 **GaussView** 的直覺編輯與微調手感，以及 **VESTA / Materials Studio** 的晶體材料與週期性超晶胞處理能力。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Pure Client-Side](https://img.shields.io/badge/Client--Side-100%25%20In--Browser-brightgreen?style=flat-square)]()
[![Three.js](https://img.shields.io/badge/3D%20Engine-Three.js%20r128-black?style=flat-square&logo=three.js)]()

---

## 🌟 核心特色

1. **VSEPR 幾何掃把快速優化 🧹**
   * 一鍵基於 VSEPR 混成軌域幾何模板與共價半徑鬆弛化學結構，快速整理化學鍵長與空間鍵角。
2. **非阻塞懸浮微調控制面板 (Floating Adjust Dock)**
   * 支援 **鍵長 (Bond Length)**、**鍵角 (Bond Angle)** 與 **二面角 (Dihedral Angle)** 連續調節。
   * 採用底部半透明毛玻璃懸浮設計，拖動滑桿時滑鼠隨時可以在畫布上自由旋轉縮放視角。
   * 支援 **Fixed (固定)**、**Move/Rotate Atom (單獨移動)**、**Move/Rotate Group (牽動基團)** 自由搭配，具備對稱拉伸與兩端全固定之約束保護。
3. **GaussView 操作慣例與快捷鍵**
   * `1-2-3-4-5` 點擊循環量測：1點看坐標、2點量鍵長、3點量鍵角、4點量二面角、第5下重啟新循環。
   * `Alt + 左鍵拖曳`：**繞幾何重心旋轉選中的原子群 (Rotate Selected)**。
   * `Alt + 右鍵拖曳`：**在視野平面上平移選中的原子群 (Translate Selected)**。
   * `Ctrl + Z / Ctrl + Y`：動作完整歷史復原重做。
4. **週期表與筆刷模式 (Brush Mode)**
   * 內建 1~118 號元素與混成狀態 ($sp^3, sp^2, sp$, 平面四邊形, 八面體等)。
   * 筆刷支援：點擊既有原子置換元素，點擊畫布空白處直接在視野平面上生成新原子。
5. **透視 (Perspective) / 正交 (Orthographic) 雙投影一鍵切換**
   * 科研出版級正交無畸變視圖與空間立體感透視視圖流暢無縫切換。
6. **週期性晶體網絡與超晶胞 (Periodic Materials & Supercells)**
   * 最小鏡像約定 (Minimum Image Convention) 跨胞化學鍵全連通，展現無瑕晶格網絡。
   * 擴胞時維持僅顯示主晶胞線框（12 條邊），視野俐落清爽。
   * 支援 GPU 視覺擴胞（`1x1x1` ~ `5x5x5`）與物理超晶胞生成 (Supercell Expansion)。
7. **多格式計算化學相容**
   * **Import**：Gaussian (`.gjf`/`.com`), ORCA (`.inp`), VASP (`POSCAR`/`CONTCAR`), Quantum ESPRESSO (`.in`), Extended XYZ, CIF, PDB。
   * **Export**：Gaussian GJF, ORCA INP, VASP Direct POSCAR, Quantum ESPRESSO PWscf, CIF, XYZ, PDB。

---

## ⌨️ 快捷鍵一覽

| 按鍵組合 | 功能說明 |
| :--- | :--- |
| **滑鼠左鍵拖曳** | 3D 視角軌道旋轉 (Orbit) |
| **滑鼠右鍵 / 滾輪拖曳** | 3D 視角平移 (Pan) |
| **滑鼠滾輪滾動** | 視角縮放 (Zoom) |
| **點擊原子 (1~4下)** | 依序量測：第1下坐標、第2下鍵長、第3下鍵角、第4下二面角 |
| **點擊第 5 下** | 自動取消前 4 顆選取，重新從第 1 顆開始新循環 |
| **點擊畫布空白處** | 取消選取（筆刷模式下為新增原子） |
| **Alt + 左鍵拖曳** | 旋轉選中的原子群 (Rotate Selected) |
| **Alt + 右鍵拖曳** | 平移選中的原子群 (Translate Selected) |
| **Ctrl + Z / Ctrl + Y** | 復原 (Undo) / 重做 (Redo) |
| **Space / Ctrl + E** | 🧹 觸發 VSEPR 掃把立體幾何整理 |
| **H / Shift + H** | 自動補氫 (+H) / 移除氫 (-H) |
| **Ctrl + A** | 全選所有原子 |
| **Delete / Backspace** | 刪除選中的原子 |
| **Esc** | 關閉微調面板、退出筆刷模式或取消所有選取 |

---

## 📄 免責與商標聲明 (Disclaimer & Trademarks)

- **AtomCraft 3D** 是一套獨立的原創開源純前端研究與教學工具。
- 文中提及之所有產品名稱、商標與註冊商標（包括 Gaussian®, GaussView®, VESTA®, VASP®, Materials Studio®, ORCA®）均屬其各自擁有者之財產。文中對其之提及僅作為學術操作習慣對齊、相容性說明與數據格式互通之描述性引用，不代表任何官方背書、附屬或合作關係。
- 檔案匯入匯出功能純粹基於科學研究之互通性（Interoperability）實作。
