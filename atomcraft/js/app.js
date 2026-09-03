/**
 * app.js - AtomCraft 3D 核心主程式控制器 (GaussView 體驗對齊版)
 * 整合：
 * 1. 透視 (Perspective) / 正交 (Orthographic) 投影一鍵切換
 * 2. 幾何微調浮動懸浮面板 (不擋分子視野，支援點工具後選原子自動彈出，拖曳防消失)
 * 3. 週期表原子替換/新增筆刷 (點擊原子替換，點擊空白處即時在平面上新增原子)
 * 4. 歷史紀錄與多格式匯入匯出
 */

class App {
  constructor() {
    this.structure = new Structure();
    this.renderer = null;
    this.controller = null;

    // 幾何微調懸浮面板狀態
    this.isAdjustDockOpen = false;
    this.adjustDockType = null; // 'bond' | 'angle' | 'dihedral'

    // 歷史紀錄 (Undo / Redo)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 40;

    this.init();
  }

  init() {
    // 1. 初始化 3D 渲染器
    this.renderer = new MoleculeRenderer('viewport');

    // 2. 初始化 GaussView 互動控制器
    this.controller = new InteractionController(this);

    // 3. 綁定全域 UI 事件與選單
    this.bindUIEvents();

    // 4. 初始化週期表對話框
    this.initPeriodicTableModal();

    // 5. 綁定檔案拖曳 (Drag & Drop)
    this.bindFileDrop();

    // 6. 載入初始範例
    this.loadPreset('caffeine');

    console.log('AtomCraft 3D (GaussView Full Edition) initialized.');
  }

  /**
   * 儲存歷史紀錄快照 (Undo)
   */
  pushHistory() {
    this.undoStack.push(this.structure.clone());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  /**
   * 復原 (Undo)
   */
  undo() {
    if (this.undoStack.length === 0) {
      this.showToast('已經是最早的歷史狀態');
      return;
    }
    this.redoStack.push(this.structure.clone());
    this.structure = this.undoStack.pop();
    this.controller.structure = this.structure;
    this.controller.clearSelection();
    this.closeAdjustDock();
    this.renderer.update(this.structure);
    this.updateUI();
    this.showToast('已復原上一步 (Undo)');
  }

  /**
   * 重做 (Redo)
   */
  redo() {
    if (this.redoStack.length === 0) {
      this.showToast('已經是最新的歷史狀態');
      return;
    }
    this.undoStack.push(this.structure.clone());
    this.structure = this.redoStack.pop();
    this.controller.structure = this.structure;
    this.controller.clearSelection();
    this.closeAdjustDock();
    this.renderer.update(this.structure);
    this.updateUI();
    this.showToast('已重做 (Redo)');
  }

  updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = (this.undoStack.length === 0);
    if (btnRedo) btnRedo.disabled = (this.redoStack.length === 0);
  }

  /**
   * 執行 GaussView 風格 VSEPR 掃把整理 🧹
   */
  runVSEPRClean() {
    if (this.structure.atoms.length === 0) return;
    this.pushHistory();

    const hasSelected = this.structure.atoms.some(a => a.selected);
    VSEPR.cleanGeometry(this.structure, hasSelected);

    this.renderer.update(this.structure);
    this.updateUI();
    this.showToast(hasSelected ? '已對選中原子完成 VSEPR 幾何整理 🧹' : '已完成整體 VSEPR 幾何整理 🧹');
  }

  /**
   * 自動加氫
   */
  addHydrogens() {
    if (this.structure.atoms.length === 0) return;
    this.pushHistory();
    const hasSelected = this.structure.atoms.some(a => a.selected);
    VSEPR.addHydrogens(this.structure, hasSelected);
    this.renderer.update(this.structure);
    this.updateUI();
    this.showToast('已補足氫原子 (+H)');
  }

  /**
   * 去除氫原子
   */
  removeHydrogens() {
    if (this.structure.atoms.length === 0) return;
    this.pushHistory();
    const hasSelected = this.structure.atoms.some(a => a.selected);
    VSEPR.removeHydrogens(this.structure, hasSelected);
    this.renderer.update(this.structure);
    this.updateUI();
    this.showToast('已移除氫原子 (-H)');
  }

  /**
   * 居中結構
   */
  centerStructure() {
    if (this.structure.atoms.length === 0) return;
    this.pushHistory();
    this.structure.center(false);
    this.renderer.resetCamera(this.structure);
    this.renderer.update(this.structure);
    this.updateUI();
    this.showToast('已居中對齊');
  }

  /**
   * 清空畫布
   */
  clearStructure() {
    if (this.structure.atoms.length === 0) return;
    if (confirm('確定要清空目前畫布上的所有原子與晶胞嗎？')) {
      this.pushHistory();
      this.structure.clear();
      this.controller.clearSelection();
      this.closeAdjustDock();
      this.renderer.update(this.structure);
      this.renderer.resetCamera(this.structure);
      this.updateUI();
      this.setMeasurementDisplay('');
      this.showToast('畫布已清空');
    }
  }

  /**
   * 載入內建模範結構
   */
  loadPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;
    this.pushHistory();
    this.structure = preset.build();
    this.controller.structure = this.structure;
    this.controller.clearSelection();
    this.closeAdjustDock();
    this.renderer.update(this.structure);
    this.renderer.resetCamera(this.structure);
    this.updateUI();
    this.setMeasurementDisplay('');
    this.showToast(`已載入範例：${preset.name}`);
  }

  /**
   * 解析文字並載入結構
   */
  loadFromText(text, filename = '') {
    try {
      this.pushHistory();
      const s = Parsers.parse(text, filename);
      if (s.atoms.length === 0) {
        alert('無法從此檔案解析出有效的原子座標，請確認格式是否正確。');
        return;
      }
      this.structure = s;
      this.controller.structure = this.structure;
      this.controller.clearSelection();
      this.closeAdjustDock();
      this.renderer.update(this.structure);
      this.renderer.resetCamera(this.structure);
      this.updateUI();
      this.setMeasurementDisplay('');
      this.showToast(`成功載入：${this.structure.title || filename} (${this.structure.atoms.length} 個原子)`);
    } catch (err) {
      console.error(err);
      alert(`檔案解析失敗: ${err.message}`);
    }
  }

  /**
   * 拖曳檔案處理
   */
  bindFileDrop() {
    const dropZone = window;

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('drag-active');

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.loadFromText(evt.target.result, file.name);
        };
        reader.readAsText(file);
      }
    });
  }

  /**
   * 初始化 GaussView 風格週期表
   */
  initPeriodicTableModal() {
    const grid = document.getElementById('ptable-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (const elem of PERIODIC_TABLE_DATA) {
      const info = getElementInfo(elem.sym);
      const cell = document.createElement('div');
      cell.className = `ptable-cell cat-${elem.cat}`;
      cell.style.gridRow = elem.row;
      cell.style.gridColumn = elem.col;
      cell.dataset.sym = elem.sym;
      cell.innerHTML = `
        <div class="ptable-num">${elem.num}</div>
        <div class="ptable-sym" style="color: ${info.color === '#FFFFFF' ? '#e2e8f0' : info.color}">${elem.sym}</div>
        <div class="ptable-name">${elem.nameZh}</div>
      `;

      cell.addEventListener('click', () => {
        this.selectPeriodicElement(elem.sym);
      });

      grid.appendChild(cell);
    }

    this.selectPeriodicElement('C');
  }

  /**
   * 點選週期表中的特定元素
   */
  selectPeriodicElement(sym) {
    this.controller.activeElement = sym;

    document.querySelectorAll('.ptable-cell').forEach(c => {
      c.classList.toggle('selected', c.dataset.sym === sym);
    });

    const elemInfo = getElementInfo(sym);
    const titleEl = document.getElementById('ptable-selected-title');
    if (titleEl) {
      titleEl.innerHTML = `已選中：<b style="color: ${elemInfo.color}">${sym}</b> (${elemInfo.nameZh} / ${elemInfo.name} - No.${elemInfo.number})`;
    }

    const hybridContainer = document.getElementById('ptable-hybrid-list');
    if (!hybridContainer) return;

    hybridContainer.innerHTML = '';
    const hybrids = getHybridizationsForElement(sym);
    this.controller.activeHybrid = hybrids[0].id;

    for (const h of hybrids) {
      const btn = document.createElement('button');
      btn.className = `btn-hybrid ${h.id === this.controller.activeHybrid ? 'active' : ''}`;
      btn.textContent = h.nameZh;
      btn.dataset.id = h.id;

      btn.addEventListener('click', () => {
        this.controller.activeHybrid = h.id;
        document.querySelectorAll('.btn-hybrid').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateElementFragmentBadge();
      });

      hybridContainer.appendChild(btn);
    }

    this.updateElementFragmentBadge();
  }

  /**
   * 更新頂部工具列上的元素/混成片段標籤
   */
  updateElementFragmentBadge() {
    const badge = document.getElementById('btn-elem-fragment');
    if (!badge) return;

    const sym = this.controller.activeElement;
    const hybrids = getHybridizationsForElement(sym);
    const curH = hybrids.find(h => h.id === this.controller.activeHybrid) || hybrids[0];
    const elemInfo = getElementInfo(sym);

    badge.innerHTML = `⊞ 元素: <b style="color: ${elemInfo.color}; margin: 0 3px;">${sym}</b> (${curH.nameZh})`;
  }

  /**
   * 啟動原子替換/新增筆刷模式
   */
  activateBrushMode(elem) {
    this.controller.isBrushMode = true;
    this.controller.brushElement = elem || this.controller.activeElement;
    document.body.classList.add('brush-mode-active');
    this.updateUI();
    this.showToast(`🖌️ 替換/新增筆刷啟動：點擊原子替換，點擊空白處新增 ${this.controller.brushElement} (按 Esc 退出)`);
  }

  /**
   * 退出筆刷模式
   */
  deactivateBrushMode() {
    this.controller.isBrushMode = false;
    document.body.classList.remove('brush-mode-active');
    this.updateUI();
    this.showToast('已退出筆刷模式');
  }

  /**
   * 綁定主工具列按鈕與全域事件
   */
  bindUIEvents() {
    // 1. 週期表開啟與關閉
    const btnElem = document.getElementById('btn-elem-fragment');
    const modalPtable = document.getElementById('modal-ptable');
    const closePtable = document.getElementById('btn-close-ptable');

    if (btnElem && modalPtable) {
      btnElem.addEventListener('click', () => modalPtable.classList.add('show'));
    }
    if (closePtable && modalPtable) {
      closePtable.addEventListener('click', () => modalPtable.classList.remove('show'));
    }

    // 週期表「啟用替換筆刷」按鈕
    const btnStartBrush = document.getElementById('btn-start-brush');
    if (btnStartBrush) {
      btnStartBrush.addEventListener('click', () => {
        modalPtable.classList.remove('show');
        this.activateBrushMode(this.controller.activeElement);
      });
    }

    // 筆刷 HUD 退出按鈕
    const btnExitBrush = document.getElementById('btn-exit-brush');
    if (btnExitBrush) {
      btnExitBrush.addEventListener('click', () => {
        this.deactivateBrushMode();
      });
    }

    // 2. 透視 (Perspective) / 正交 (Orthographic) 投影一鍵切換開關
    const btnToggleProj = document.getElementById('btn-toggle-projection');
    if (btnToggleProj) {
      btnToggleProj.addEventListener('click', () => {
        const nextOrtho = !this.renderer.isOrthographic;
        this.renderer.setProjection(nextOrtho);
        this.updateUI();
        this.showToast(nextOrtho ? '已切換為正交投影 (Orthographic)' : '已切換為透視投影 (Perspective)');
      });
    }

    // 3. 綁定幾何微調懸浮控制板 (非阻塞式 Dock)
    this.bindGeometryAdjustDock();

    // 4. 顯示風格切換
    const styleSelect = document.getElementById('select-style');
    if (styleSelect) {
      styleSelect.addEventListener('change', (e) => {
        this.renderer.setStyle(e.target.value);
        this.renderer.update(this.structure);
      });
    }

    // 5. 視角對齊按鈕
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        if (v === 'reset') this.renderer.resetCamera(this.structure);
        else if (['x', 'y', 'z'].includes(v)) this.renderer.alignCamera(v, this.structure);
      });
    });

    // 6. 週期性視覺擴胞滑桿
    ['na', 'nb', 'nc'].forEach((axis, idx) => {
      const slider = document.getElementById(`slider-${axis}`);
      const valSpan = document.getElementById(`val-${axis}`);
      if (slider && valSpan) {
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10) || 1;
          valSpan.textContent = `${val}x`;
          this.renderer.visualReplicas[idx] = val;
          this.renderer.update(this.structure);
        });
      }
    });

    // 7. 實體擴胞按鈕
    const btnExpandSupercell = document.getElementById('btn-expand-supercell');
    if (btnExpandSupercell) {
      btnExpandSupercell.addEventListener('click', () => {
        const na = parseInt(document.getElementById('input-expand-na').value, 10) || 1;
        const nb = parseInt(document.getElementById('input-expand-nb').value, 10) || 1;
        const nc = parseInt(document.getElementById('input-expand-nc').value, 10) || 1;
        this.pushHistory();
        if (Crystal.expandSupercell(this.structure, na, nb, nc)) {
          this.renderer.resetCamera(this.structure);
          this.renderer.update(this.structure);
          this.updateUI();
          this.showToast(`已實體擴胞為 ${na}x${nb}x${nc} (${this.structure.atoms.length} 個原子)`);
        }
      });
    }

    // 8. 檔案選取上傳 input
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (evt) => {
            this.loadFromText(evt.target.result, file.name);
          };
          reader.readAsText(file);
          e.target.value = '';
        }
      });
    }

    // 9. 匯出對話框管理
    this.bindExportModal();
  }

  /**
   * 綁定 GaussView 幾何微調按鈕與懸浮滑桿面板 (Dock)
   */
  bindGeometryAdjustDock() {
    const btnModBond = document.getElementById('btn-mod-bond');
    const btnModAngle = document.getElementById('btn-mod-angle');
    const btnModDihedral = document.getElementById('btn-mod-dihedral');

    // 點擊「調整鍵長」
    if (btnModBond) {
      btnModBond.addEventListener('click', () => {
        if (this.controller.selectedSequence.length === 2) {
          this.openBondAdjustDock();
        } else {
          this.controller.activeTool = 'mod_bond';
          this.controller.clearSelection();
          this.closeAdjustDock();
          this.renderer.update(this.structure);
          this.updateUI();
          this.showToast('📏 鍵長微調模式：請在畫布上點選 2 個原子');
        }
      });
    }

    // 點擊「調整鍵角」
    if (btnModAngle) {
      btnModAngle.addEventListener('click', () => {
        if (this.controller.selectedSequence.length === 3) {
          this.openAngleAdjustDock();
        } else {
          this.controller.activeTool = 'mod_angle';
          this.controller.clearSelection();
          this.closeAdjustDock();
          this.renderer.update(this.structure);
          this.updateUI();
          this.showToast('📐 鍵角微調模式：請依序點選 3 個原子 (第2顆為頂點)');
        }
      });
    }

    // 點擊「調整二面角」
    if (btnModDihedral) {
      btnModDihedral.addEventListener('click', () => {
        if (this.controller.selectedSequence.length === 4) {
          this.openDihedralAdjustDock();
        } else {
          this.controller.activeTool = 'mod_dihedral';
          this.controller.clearSelection();
          this.closeAdjustDock();
          this.renderer.update(this.structure);
          this.updateUI();
          this.showToast('🔗 二面角微調模式：請依序點選 4 個原子');
        }
      });
    }

    // 面板控制件
    const slider = document.getElementById('slider-adjust');
    const input = document.getElementById('input-adjust');
    const selMode1 = document.getElementById('adjust-mode-1');
    const selMode2 = document.getElementById('adjust-mode-2');
    const btnClose = document.getElementById('btn-dock-close');

    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeAdjustDock());
    }

    // 兩端模式約束防護：不允許兩端皆設為 fixed
    const checkModesSafety = (changedId) => {
      if (!selMode1 || !selMode2) return;
      if (selMode1.value === 'fixed' && selMode2.value === 'fixed') {
        if (changedId === 1) {
          selMode2.value = 'group';
        } else {
          selMode1.value = 'group';
        }
        this.showToast('⚠️ 兩端不可皆固定，已自動將另一側設為活動');
      }
    };

    if (selMode1) {
      selMode1.addEventListener('change', () => {
        checkModesSafety(1);
        if (slider) this.applyAdjustValue(parseFloat(slider.value));
      });
    }

    if (selMode2) {
      selMode2.addEventListener('change', () => {
        checkModesSafety(2);
        if (slider) this.applyAdjustValue(parseFloat(slider.value));
      });
    }

    // 在 pointerdown 時僅儲存 1 次歷史快照 (防止高頻拖曳時壓爆堆疊或造成卡頓)
    if (slider) {
      slider.addEventListener('pointerdown', () => {
        this.pushHistory();
      });
      slider.addEventListener('input', (e) => {
        this.applyAdjustValue(parseFloat(e.target.value));
      });
    }

    if (input) {
      input.addEventListener('change', (e) => {
        this.pushHistory();
        this.applyAdjustValue(parseFloat(e.target.value));
      });
    }
  }

  /**
   * 開啟鍵長懸浮調整面板
   */
  openBondAdjustDock() {
    const seq = this.controller.selectedSequence;
    if (seq.length !== 2) return;
    const [i1, i2] = seq;
    const a = this.structure.atoms[i1];
    const b = this.structure.atoms[i2];
    const curLen = GeometryAdjuster.getBondLength(this.structure, i1, i2);

    this.isAdjustDockOpen = true;
    this.adjustDockType = 'bond';

    document.getElementById('adjust-dock-title').textContent = `📏 調整鍵長: ${a.element}${i1+1} - ${b.element}${i2+1}`;
    document.getElementById('adjust-dock-unit').textContent = 'Å';

    const l1 = document.getElementById('adjust-mode-label-1');
    const l2 = document.getElementById('adjust-mode-label-2');
    const s1 = document.getElementById('adjust-mode-1');
    const s2 = document.getElementById('adjust-mode-2');
    if (l1) l1.textContent = `${a.element}${i1+1}:`;
    if (l2) l2.textContent = `${b.element}${i2+1}:`;

    const bondOptions = `
      <option value="fixed">Fixed (固定)</option>
      <option value="group">Move Group (基團)</option>
      <option value="atom">Move Atom (單獨)</option>
    `;
    if (s1) { s1.innerHTML = bondOptions; s1.value = 'fixed'; }
    if (s2) { s2.innerHTML = bondOptions; s2.value = 'group'; }

    const slider = document.getElementById('slider-adjust');
    const input = document.getElementById('input-adjust');
    if (slider) {
      slider.min = '0.3';
      slider.max = '6.0';
      slider.step = '0.01';
      slider.value = curLen.toFixed(3);
    }
    if (input) {
      input.value = curLen.toFixed(3);
    }
    const dock = document.getElementById('adjust-dock');
    if (dock) dock.style.display = 'flex';
  }

  /**
   * 開啟鍵角懸浮調整面板
   */
  openAngleAdjustDock() {
    const seq = this.controller.selectedSequence;
    if (seq.length !== 3) return;
    const [i1, i2, i3] = seq;
    const a = this.structure.atoms[i1];
    const b = this.structure.atoms[i2];
    const c = this.structure.atoms[i3];
    const curAngle = GeometryAdjuster.getBondAngle(this.structure, i1, i2, i3);

    this.isAdjustDockOpen = true;
    this.adjustDockType = 'angle';

    document.getElementById('adjust-dock-title').textContent = `📐 調整鍵角: ${a.element}${i1+1} - ${b.element}${i2+1} - ${c.element}${i3+1}`;
    document.getElementById('adjust-dock-unit').textContent = '°';

    const l1 = document.getElementById('adjust-mode-label-1');
    const l2 = document.getElementById('adjust-mode-label-2');
    const s1 = document.getElementById('adjust-mode-1');
    const s2 = document.getElementById('adjust-mode-2');
    if (l1) l1.textContent = `${a.element}${i1+1}:`;
    if (l2) l2.textContent = `${c.element}${i3+1}:`;

    const angleOptions = `
      <option value="fixed">Fixed (固定)</option>
      <option value="group">Rotate Group (基團)</option>
      <option value="atom">Rotate Atom (單獨)</option>
    `;
    if (s1) { s1.innerHTML = angleOptions; s1.value = 'fixed'; }
    if (s2) { s2.innerHTML = angleOptions; s2.value = 'group'; }

    const slider = document.getElementById('slider-adjust');
    const input = document.getElementById('input-adjust');
    if (slider) {
      slider.min = '10';
      slider.max = '179';
      slider.step = '0.5';
      slider.value = curAngle.toFixed(1);
    }
    if (input) {
      input.value = curAngle.toFixed(1);
    }
    const dock = document.getElementById('adjust-dock');
    if (dock) dock.style.display = 'flex';
  }

  /**
   * 開啟二面角懸浮調整面板
   */
  openDihedralAdjustDock() {
    const seq = this.controller.selectedSequence;
    if (seq.length !== 4) return;
    const [i1, i2, i3, i4] = seq;
    const p1 = this.structure.atoms[i1];
    const p2 = this.structure.atoms[i2];
    const p3 = this.structure.atoms[i3];
    const p4 = this.structure.atoms[i4];
    const curDihedral = GeometryAdjuster.getDihedralAngle(this.structure, i1, i2, i3, i4);

    this.isAdjustDockOpen = true;
    this.adjustDockType = 'dihedral';

    document.getElementById('adjust-dock-title').textContent = `🔗 調整二面角: ${p1.element}${i1+1}-${p2.element}${i2+1}-${p3.element}${i3+1}-${p4.element}${i4+1}`;
    document.getElementById('adjust-dock-unit').textContent = '°';

    const l1 = document.getElementById('adjust-mode-label-1');
    const l2 = document.getElementById('adjust-mode-label-2');
    const s1 = document.getElementById('adjust-mode-1');
    const s2 = document.getElementById('adjust-mode-2');
    if (l1) l1.textContent = `${p1.element}${i1+1}側:`;
    if (l2) l2.textContent = `${p4.element}${i4+1}側:`;

    const dihedralOptions = `
      <option value="fixed">Fixed (固定)</option>
      <option value="group">Rotate Group (基團)</option>
    `;
    if (s1) { s1.innerHTML = dihedralOptions; s1.value = 'fixed'; }
    if (s2) { s2.innerHTML = dihedralOptions; s2.value = 'group'; }

    const slider = document.getElementById('slider-adjust');
    const input = document.getElementById('input-adjust');
    if (slider) {
      slider.min = '-180';
      slider.max = '180';
      slider.step = '0.5';
      slider.value = curDihedral.toFixed(1);
    }
    if (input) {
      input.value = curDihedral.toFixed(1);
    }
    const dock = document.getElementById('adjust-dock');
    if (dock) dock.style.display = 'flex';
  }

  /**
   * 套用微調數值
   */
  applyAdjustValue(val) {
    const seq = this.controller.selectedSequence;
    const mode1 = document.getElementById('adjust-mode-1')?.value || 'fixed';
    const mode2 = document.getElementById('adjust-mode-2')?.value || 'group';
    const slider = document.getElementById('slider-adjust');
    const input = document.getElementById('input-adjust');

    if (this.adjustDockType === 'bond' && seq.length === 2) {
      if (isNaN(val) || val <= 0) return;
      if (slider) slider.value = val;
      if (input) input.value = val.toFixed(3);
      GeometryAdjuster.setBondLength(this.structure, seq[0], seq[1], val, mode1, mode2);
    } else if (this.adjustDockType === 'angle' && seq.length === 3) {
      if (isNaN(val) || val <= 0 || val >= 180) return;
      if (slider) slider.value = val;
      if (input) input.value = val.toFixed(1);
      GeometryAdjuster.setBondAngle(this.structure, seq[0], seq[1], seq[2], val, mode1, mode2);
    } else if (this.adjustDockType === 'dihedral' && seq.length === 4) {
      if (isNaN(val)) return;
      if (slider) slider.value = val;
      if (input) input.value = val.toFixed(1);
      GeometryAdjuster.setDihedralAngle(this.structure, seq[0], seq[1], seq[2], seq[3], val, mode1, mode2);
    }

    this.renderer.update(this.structure);
    this.controller.updateMeasurementDisplay();
    this.updateStatus();
  }

  /**
   * 關閉微調懸浮面板
   */
  closeAdjustDock() {
    this.isAdjustDockOpen = false;
    const dock = document.getElementById('adjust-dock');
    if (dock) dock.style.display = 'none';
  }

  /**
   * 匯出彈窗事件綁定
   */
  bindExportModal() {
    const modal = document.getElementById('modal-export');
    const btnOpen = document.getElementById('btn-open-export');
    const btnClose = document.getElementById('btn-close-export');
    const formatSelect = document.getElementById('export-format');
    const textarea = document.getElementById('export-preview');
    const btnCopy = document.getElementById('btn-copy-export');
    const btnDownload = document.getElementById('btn-download-export');

    if (!modal) return;

    const refreshPreview = () => {
      const fmt = formatSelect.value;
      const charge = parseInt(document.getElementById('export-charge').value, 10) || 0;
      const mult = parseInt(document.getElementById('export-mult').value, 10) || 1;
      const route = document.getElementById('export-route').value;
      let text = '';

      if (fmt === 'xyz') text = Parsers.exportXYZ(this.structure);
      else if (fmt === 'gjf') text = Parsers.exportGaussian(this.structure, { charge, mult, route });
      else if (fmt === 'orca') text = Parsers.exportORCA(this.structure, { charge, mult, header: route });
      else if (fmt === 'vasp') text = Parsers.exportVASP(this.structure, { direct: true });
      else if (fmt === 'qe') text = Parsers.exportQE(this.structure);
      else if (fmt === 'cif') text = Parsers.exportCIF(this.structure);
      else if (fmt === 'pdb') text = Parsers.exportPDB(this.structure);

      textarea.value = text;
    };

    btnOpen.addEventListener('click', () => {
      document.getElementById('export-charge').value = this.structure.charge || 0;
      document.getElementById('export-mult').value = this.structure.multiplicity || 1;
      refreshPreview();
      modal.classList.add('show');
    });

    btnClose.addEventListener('click', () => modal.classList.remove('show'));

    formatSelect.addEventListener('change', () => {
      const fmt = formatSelect.value;
      const routeInput = document.getElementById('export-route');
      if (fmt === 'gjf') routeInput.value = '#p b3lyp/6-31g(d) opt freq';
      else if (fmt === 'orca') routeInput.value = '! B3LYP def2-SVP Opt';
      refreshPreview();
    });

    ['export-charge', 'export-mult', 'export-route'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', refreshPreview);
    });

    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(textarea.value).then(() => {
        this.showToast('已複製座標內容至剪貼簿！');
      });
    });

    btnDownload.addEventListener('click', () => {
      const fmt = formatSelect.value;
      const extMap = {
        xyz: 'xyz',
        gjf: 'gjf',
        orca: 'inp',
        vasp: 'POSCAR',
        qe: 'in',
        cif: 'cif',
        pdb: 'pdb'
      };
      const filename = fmt === 'vasp' ? 'POSCAR' : `structure.${extMap[fmt] || 'txt'}`;
      const blob = new Blob([textarea.value], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast(`已下載 ${filename}`);
    });
  }

  /**
   * 更新 UI 介面、按鈕可用狀態與狀態列
   */
  updateUI() {
    this.updateStatus();
    this.updateUndoRedoButtons();
    this.updateElementFragmentBadge();

    // 1. 更新相機投影模式按鈕標籤
    const btnToggleProj = document.getElementById('btn-toggle-projection');
    if (btnToggleProj) {
      btnToggleProj.innerHTML = this.renderer.isOrthographic ? '📐 正交 (Orthographic)' : '👁️ 透視 (Perspective)';
      btnToggleProj.title = this.renderer.isOrthographic ? '點擊切換為透視投影 (Perspective)' : '點擊切換為正交投影 (Orthographic)';
    }

    // 2. 更新 GaussView 三大微調按鈕啟用與高亮狀態
    const btnModBond = document.getElementById('btn-mod-bond');
    const btnModAngle = document.getElementById('btn-mod-angle');
    const btnModDihedral = document.getElementById('btn-mod-dihedral');

    if (btnModBond) {
      btnModBond.disabled = false;
      btnModBond.classList.toggle('active-tool', this.controller.activeTool === 'mod_bond');
    }
    if (btnModAngle) {
      btnModAngle.disabled = false;
      btnModAngle.classList.toggle('active-tool', this.controller.activeTool === 'mod_angle');
    }
    if (btnModDihedral) {
      btnModDihedral.disabled = false;
      btnModDihedral.classList.toggle('active-tool', this.controller.activeTool === 'mod_dihedral');
    }

    // 3. 更新筆刷 HUD 條
    const brushHud = document.getElementById('brush-hud');
    if (brushHud) {
      brushHud.style.display = this.controller.isBrushMode ? 'flex' : 'none';
      const label = document.getElementById('brush-hud-label');
      if (label) {
        label.innerHTML = `🖌️ 筆刷模式中：點擊原子替換，點擊空白處新增 <b>${this.controller.brushElement}</b>`;
      }
    }

    // 4. 更新週期性面板透明度
    const crystalPanel = document.getElementById('crystal-panel');
    if (crystalPanel) {
      crystalPanel.style.opacity = this.structure.cell ? '1' : '0.45';
    }
  }

  /**
   * 更新底部狀態列文字
   */
  updateStatus() {
    const nTotal = this.structure.atoms.length;
    const nSelected = this.structure.atoms.filter(a => a.selected).length;
    const formula = this.structure.getFormula();
    const mw = this.structure.getMolecularWeight();

    const elAtoms = document.getElementById('status-atoms');
    const elFormula = document.getElementById('status-formula');
    const elCell = document.getElementById('status-cell');

    if (elAtoms) {
      elAtoms.textContent = `原子數: ${nTotal}${nSelected > 0 ? ` (已選中 ${nSelected})` : ''} | 鍵數: ${this.structure.bonds.length}`;
    }
    if (elFormula) {
      elFormula.textContent = `化學式: ${formula} (${mw.toFixed(2)} g/mol)`;
    }
    if (elCell) {
      if (this.structure.cell) {
        const p = this.structure.getCellParameters();
        elCell.textContent = `晶胞: a=${p.a.toFixed(2)} b=${p.b.toFixed(2)} c=${p.c.toFixed(2)} Å (α=${p.alpha.toFixed(1)}° β=${p.beta.toFixed(1)}° γ=${p.gamma.toFixed(1)}°) V=${p.volume.toFixed(1)} Å³`;
      } else {
        elCell.textContent = '晶胞: 孤立分子 (0D 非週期性)';
      }
    }
  }

  /**
   * 設定量測數值顯示
   */
  setMeasurementDisplay(html) {
    const el = document.getElementById('status-measurement');
    if (el) {
      el.innerHTML = html ? `📏 ${html}` : '';
    }
  }

  /**
   * 輕量 Toast 提示訊息
   */
  showToast(msg, duration = 2500) {
    let toast = document.getElementById('toast-msg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-msg';
      toast.className = 'toast-notification';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
}

// 頁面載入完成後啟動 App
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
