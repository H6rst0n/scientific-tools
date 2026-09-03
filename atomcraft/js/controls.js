/**
 * controls.js - 滑鼠與鍵盤互動控制器 (GaussView 風格精準對齊版)
 * 1. 1 -> 2 -> 3 -> 4 -> 5(重設) 原子點擊循環選取與即時測量
 * 2. 全域無障礙 Ctrl + Z / Ctrl + Y 復原重做 (含中文輸入法 KeyCode 兼容)
 * 3. 視角旋轉、平移、縮放無縫整合，零切換負擔
 */

class InteractionController {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer;
    this.structure = app.structure;

    // GaussView 1-2-3-4-5 點擊循環選取序號陣列 [idx0, idx1, idx2, idx3]
    this.selectedSequence = [];

    // 當前週期表選定之元素與混成幾何片段
    this.activeElement = 'C';
    this.activeHybrid = 'sp3';

    // 原子連續替換筆刷模式
    this.isBrushMode = false;
    this.brushElement = 'C';

    // 進行中的幾何微調工具 (null | 'mod_bond' | 'mod_angle' | 'mod_dihedral')
    this.activeTool = null;

    // 拖曳狀態追蹤
    this.isDragging = false;
    this.dragMode = null; // 'orbit' | 'pan' | 'move_atoms' | 'rotate_atoms'
    this.prevMousePos = { x: 0, y: 0 };
    this.dragStartPos = { x: 0, y: 0 };

    this.initEventListeners();
  }

  initEventListeners() {
    const dom = this.renderer.renderer.domElement;

    // 1. 滑鼠事件
    dom.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    dom.addEventListener('pointermove', (e) => this.onPointerMove(e));
    dom.addEventListener('pointerup', (e) => this.onPointerUp(e));

    // 禁用右鍵預設選單以利右鍵平移
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // 2. 全域鍵盤快捷鍵 (使用捕獲階段 capture: true，確保不被輸入框或焦點阻斷)
    window.addEventListener('keydown', (e) => this.onKeyDown(e), { capture: true });
  }

  onPointerDown(e) {
    this.dragStartPos = { x: e.clientX, y: e.clientY };
    this.prevMousePos = { x: e.clientX, y: e.clientY };

    const selectedAtoms = this.structure.atoms.filter(a => a.selected);

    // Shift + 左鍵拖曳 -> 框選多個原子 (Marquee Box Selection)
    if (e.shiftKey && e.button === 0) {
      this.isDragging = true;
      this.dragMode = 'box_select';
      this.boxSelectStart = { x: e.clientX, y: e.clientY };
      this.renderer.controls.enabled = false;
      let box = document.getElementById('marquee-selection-box');
      if (!box) {
        box = document.createElement('div');
        box.id = 'marquee-selection-box';
        box.className = 'marquee-selection-box';
        document.body.appendChild(box);
      }
      box.style.left = `${e.clientX}px`;
      box.style.top = `${e.clientY}px`;
      box.style.width = '0px';
      box.style.height = '0px';
      box.style.display = 'block';
      return;
    }

    // GaussView 規範：Alt + 左鍵拖曳 -> 繞重心旋轉選中原子 (Rotate selected atoms)
    if (e.altKey && e.button === 0 && selectedAtoms.length > 0) {
      this.isDragging = true;
      this.dragMode = 'rotate_atoms';
      this.renderer.controls.enabled = false;
      this.app.pushHistory();
      return;
    }

    // GaussView 規範：Alt + 右鍵拖曳 -> 在視野平面平移選中原子 (Translate selected atoms)
    if (e.altKey && e.button === 2 && selectedAtoms.length > 0) {
      this.isDragging = true;
      this.dragMode = 'move_atoms';
      this.renderer.controls.enabled = false;
      this.app.pushHistory();
      return;
    }

    // 兼容量測或備用旋轉 (Ctrl + Shift + 左鍵)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.button === 0 && selectedAtoms.length > 0) {
      this.isDragging = true;
      this.dragMode = 'rotate_atoms';
      this.renderer.controls.enabled = false;
      this.app.pushHistory();
      return;
    }

    this.isDragging = true;
    this.dragMode = 'view';
    this.renderer.controls.enabled = true;
  }

  onPointerMove(e) {
    const dx = e.clientX - this.prevMousePos.x;
    const dy = e.clientY - this.prevMousePos.y;
    this.prevMousePos = { x: e.clientX, y: e.clientY };

    if (!this.isDragging) return;

    if (this.dragMode === 'box_select' && this.boxSelectStart) {
      const box = document.getElementById('marquee-selection-box');
      if (box) {
        const left = Math.min(this.boxSelectStart.x, e.clientX);
        const top = Math.min(this.boxSelectStart.y, e.clientY);
        const width = Math.abs(e.clientX - this.boxSelectStart.x);
        const height = Math.abs(e.clientY - this.boxSelectStart.y);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
        box.style.width = `${width}px`;
        box.style.height = `${height}px`;
      }
      return;
    }

    if (this.dragMode === 'move_atoms') {
      // 沿相機視野平面平移選中原子
      const cam = this.renderer.camera;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

      const factor = 0.02 * (cam.position.length() / 25);
      const moveVec = right.multiplyScalar(dx * factor).add(up.multiplyScalar(-dy * factor));

      this.structure.translate(moveVec.x, moveVec.y, moveVec.z, true);
      this.renderer.update(this.structure);
      this.app.updateStatus();
    } else if (this.dragMode === 'rotate_atoms') {
      // 繞選中原子幾何中心旋轉
      const cam = this.renderer.camera;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);

      const center = this.structure.getCenter(true);
      const rotSpeed = 0.015;

      if (Math.abs(dx) > 0.5) {
        this.structure.rotate([up.x, up.y, up.z], dx * rotSpeed, center, true);
      }
      if (Math.abs(dy) > 0.5) {
        this.structure.rotate([right.x, right.y, right.z], dy * rotSpeed, center, true);
      }
      this.renderer.update(this.structure);
      this.app.updateStatus();
    }
  }

  onPointerUp(e) {
    if (this.dragMode === 'box_select' && this.boxSelectStart) {
      const box = document.getElementById('marquee-selection-box');
      if (box) box.style.display = 'none';

      const minX = Math.min(this.boxSelectStart.x, e.clientX);
      const maxX = Math.max(this.boxSelectStart.x, e.clientX);
      const minY = Math.min(this.boxSelectStart.y, e.clientY);
      const maxY = Math.max(this.boxSelectStart.y, e.clientY);
      const width = maxX - minX;
      const height = maxY - minY;

      this.isDragging = false;
      this.dragMode = null;
      this.renderer.controls.enabled = true;

      if (width > 6 || height > 6) {
        const rect = this.renderer.container ? this.renderer.container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        let newlySelectedCount = 0;

        for (let i = 0; i < this.structure.atoms.length; i++) {
          const atom = this.structure.atoms[i];
          const pos = new THREE.Vector3(atom.x, atom.y, atom.z);
          pos.project(this.renderer.camera);

          // 位於鏡頭前方且在螢幕框內
          if (pos.z < 1) {
            const screenX = ((pos.x + 1) / 2) * rect.width + rect.left;
            const screenY = ((-pos.y + 1) / 2) * rect.height + rect.top;

            if (screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY) {
              if (!atom.selected) {
                atom.selected = true;
                newlySelectedCount++;
                if (!this.selectedSequence.includes(i)) {
                  this.selectedSequence.push(i);
                }
              }
            }
          }
        }

        this.renderer.update(this.structure);
        this.updateMeasurementDisplay();
        this.app.updateUI();
        this.app.showToast(`框選加入 ${newlySelectedCount} 個原子 (共選中 ${this.structure.atoms.filter(a => a.selected).length} 個)`);
        return;
      }
    }

    const totalDist = Math.hypot(e.clientX - this.dragStartPos.x, e.clientY - this.dragStartPos.y);

    if (this.isDragging) {
      this.isDragging = false;
      this.renderer.controls.enabled = true;

      if (this.dragMode === 'move_atoms' || this.dragMode === 'rotate_atoms') {
        this.structure.updateBondDistances();
        this.renderer.update(this.structure);
      }
    }

    // 移動距離小於 5 像素視為點擊 (Click / Pick)
    if (totalDist < 5 && e.button === 0) {
      this.handleClick(e);
    }
  }

  /**
   * GaussView 風格核心選取與量測邏輯 (1 -> 2 -> 3 -> 4 -> 5 循環) 與替換/新增筆刷
   */
  handleClick(e) {
    // 互斥安全防護：若當前已啟動幾何微調工具，強制退出筆刷模式，避免誤改原子
    if (this.activeTool && this.isBrushMode) {
      if (this.app && this.app.deactivateBrushMode) {
        this.app.deactivateBrushMode(true);
      } else {
        this.isBrushMode = false;
      }
    }

    const pickedIdx = this.renderer.pickAtom(e.clientX, e.clientY, this.structure);

    // 【替換/新增筆刷模式】：點中原子替換，點擊空白處直接在視野平面新增原子！
    if (this.isBrushMode) {
      if (pickedIdx >= 0) {
        // 點中既有原子：替換為當前元素，並自動進行局部補氫 (GaussView Style)
        this.app.pushHistory();
        const oldElem = this.structure.atoms[pickedIdx].element;
        this.structure.atoms[pickedIdx].element = this.brushElement;
        VSEPR.saturateAtom(this.structure, pickedIdx, this.activeHybrid);
        this.renderer.update(this.structure);
        this.app.updateUI();
        this.app.showToast(`已將原子 #${pickedIdx + 1} (${oldElem}) 替換為 ${this.brushElement} 並自動補氫`);
      } else {
        // 點擊空白處：在相機視野目標平面上新增原子，並自動進行局部補氫 (如放 C 自動生成 CH4)
        this.app.pushHistory();
        const rect = this.renderer.container ? this.renderer.container.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.renderer.camera);

        const target = (this.renderer.controls && this.renderer.controls.target) || new THREE.Vector3(0, 0, 0);
        const camDir = new THREE.Vector3();
        if (this.renderer.camera && this.renderer.camera.getWorldDirection) {
          this.renderer.camera.getWorldDirection(camDir);
        } else {
          camDir.set(0, 0, -1);
        }
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir.negate(), target);

        const hitPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, hitPoint);

        if (hitPoint) {
          this.structure.addAtom(this.brushElement, hitPoint.x, hitPoint.y, hitPoint.z);
          const newIdx = this.structure.atoms.length - 1;
          VSEPR.saturateAtom(this.structure, newIdx, this.activeHybrid);
          this.renderer.update(this.structure);
          if (this.structure.atoms.length === 1) {
            this.renderer.resetCamera(this.structure);
          }
          this.app.updateUI();
          this.app.showToast(`已在空白處新增 ${this.brushElement} 原子並自動補氫 (#${newIdx + 1})`);
        }
      }
      return;
    }

    if (pickedIdx >= 0) {
      // 點中原子
      const currentSeq = this.selectedSequence;
      const existPos = currentSeq.indexOf(pickedIdx);

      if (currentSeq.length === 0) {
        // 【第 1 下】：選取第 1 顆原子
        this.clearSelection();
        this.selectedSequence = [pickedIdx];
        this.structure.atoms[pickedIdx].selected = true;
      } else if (currentSeq.length === 1) {
        // 【第 2 下】：選取第 2 顆原子 (顯示鍵長)
        if (existPos === -1) {
          this.selectedSequence.push(pickedIdx);
          this.structure.atoms[pickedIdx].selected = true;
        }
      } else if (currentSeq.length === 2) {
        // 【第 3 下】：選取第 3 顆原子 (顯示鍵角)
        if (existPos === -1) {
          this.selectedSequence.push(pickedIdx);
          this.structure.atoms[pickedIdx].selected = true;
        }
      } else if (currentSeq.length === 3) {
        // 【第 4 下】：選取第 4 顆原子 (顯示二面角)
        if (existPos === -1) {
          this.selectedSequence.push(pickedIdx);
          this.structure.atoms[pickedIdx].selected = true;
        }
      } else if (currentSeq.length >= 4) {
        // 【第 5 下】：自動取消前 4 顆，重新從第 1 顆開始循環！
        this.clearSelection();
        this.selectedSequence = [pickedIdx];
        this.structure.atoms[pickedIdx].selected = true;
      }

      this.updateMeasurementDisplay();

      // 若使用者事先點選了微調工具按鈕，達標後自動彈出滑桿面板
      if (this.activeTool === 'mod_bond' && this.selectedSequence.length === 2) {
        this.app.openBondAdjustDock();
        this.activeTool = null;
      } else if (this.activeTool === 'mod_angle' && this.selectedSequence.length === 3) {
        this.app.openAngleAdjustDock();
        this.activeTool = null;
      } else if (this.activeTool === 'mod_dihedral' && this.selectedSequence.length === 4) {
        this.app.openDihedralAdjustDock();
        this.activeTool = null;
      }
    } else {
      // 點擊空白處：取消所有選取，清空量測資訊，並關閉微調面板
      this.clearSelection();
      this.app.setMeasurementDisplay('');
      this.app.closeAdjustDock();
    }

    this.renderer.update(this.structure);
    this.app.updateUI();
  }

  /**
   * 清除所有原子的選取狀態與序列
   */
  clearSelection() {
    for (const a of this.structure.atoms) a.selected = false;
    this.selectedSequence = [];
  }

  /**
   * 更新右下角量測資訊
   */
  updateMeasurementDisplay() {
    const seq = this.selectedSequence;
    const atoms = this.structure.atoms;
    let html = '';

    if (seq.length === 1) {
      const a = atoms[seq[0]];
      html = `<span class="badge-atom">${a.element}${seq[0] + 1}</span> 座標: (${a.x.toFixed(3)}, ${a.y.toFixed(3)}, ${a.z.toFixed(3)})`;
    } else if (seq.length === 2) {
      const a = atoms[seq[0]];
      const b = atoms[seq[1]];
      const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      html = `鍵長: <span class="badge-atom">${a.element}${seq[0] + 1}</span> - <span class="badge-atom">${b.element}${seq[1] + 1}</span> = <b>${dist.toFixed(4)} Å</b>`;
    } else if (seq.length === 3) {
      const a = atoms[seq[0]];
      const b = atoms[seq[1]]; // 頂點
      const c = atoms[seq[2]];

      const v1 = [a.x - b.x, a.y - b.y, a.z - b.z];
      const v2 = [c.x - b.x, c.y - b.y, c.z - b.z];
      const d1 = Math.hypot(...v1);
      const d2 = Math.hypot(...v2);
      const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot / (d1 * d2)))) * (180 / Math.PI);

      html = `鍵角: <span class="badge-atom">${a.element}${seq[0] + 1}</span> - <span class="badge-atom">${b.element}${seq[1] + 1}</span> - <span class="badge-atom">${c.element}${seq[2] + 1}</span> = <b>${angle.toFixed(2)}°</b>`;
    } else if (seq.length === 4) {
      const [i1, i2, i3, i4] = seq;
      const p1 = atoms[i1];
      const p2 = atoms[i2];
      const p3 = atoms[i3];
      const p4 = atoms[i4];

      const b1 = [p2.x - p1.x, p2.y - p1.y, p2.z - p1.z];
      const b2 = [p3.x - p2.x, p3.y - p2.y, p3.z - p2.z];
      const b3 = [p4.x - p3.x, p4.y - p3.y, p4.z - p3.z];

      const n1 = [b1[1]*b2[2] - b1[2]*b2[1], b1[2]*b2[0] - b1[0]*b2[2], b1[0]*b2[1] - b1[1]*b2[0]];
      const n2 = [b2[1]*b3[2] - b2[2]*b3[1], b2[2]*b3[0] - b2[0]*b3[2], b2[0]*b3[1] - b2[1]*b3[0]];

      const b2Len = Math.hypot(...b2);
      const b2Unit = [b2[0] / b2Len, b2[1] / b2Len, b2[2] / b2Len];
      const m = [n1[1]*b2Unit[2] - n1[2]*b2Unit[1], n1[2]*b2Unit[0] - n1[0]*b2Unit[2], n1[0]*b2Unit[1] - n1[1]*b2Unit[0]];

      const x = n1[0]*n2[0] + n1[1]*n2[1] + n1[2]*n2[2];
      const y = m[0]*n2[0] + m[1]*n2[1] + m[2]*n2[2];
      const dihedral = Math.atan2(y, x) * (180 / Math.PI);

      html = `二面角: <span class="badge-atom">${p1.element}${i1 + 1}</span>-<span class="badge-atom">${p2.element}${i2 + 1}</span>-<span class="badge-atom">${p3.element}${i3 + 1}</span>-<span class="badge-atom">${p4.element}${i4 + 1}</span> = <b>${dihedral.toFixed(2)}°</b>`;
    }

    this.app.setMeasurementDisplay(html);
  }

  /**
   * 插入目前選中的混成片段 (Fragment Insertion)
   */
  insertCurrentFragment() {
    this.app.pushHistory();

    const elem = this.activeElement || 'C';
    const hybrid = this.activeHybrid || 'sp3';
    const hybrids = getHybridizationsForElement(elem);
    const targetHybrid = hybrids.find(h => h.id === hybrid) || hybrids[0];

    const center = this.renderer.controls.target;
    // 建立中心原子
    const centerAtom = this.structure.addAtom(elem, center.x, center.y, center.z);
    const bondDist = VSEPR.getIdealBondLength(elem, 'H');

    // 根據混成方向生成配位原子/氫原子
    for (const d of targetHybrid.dirs) {
      let [dx, dy, dz] = d;
      const len = Math.hypot(dx, dy, dz);
      dx /= len; dy /= len; dz /= len;

      this.structure.addAtom('H', center.x + dx * bondDist, center.y + dy * bondDist, center.z + dz * bondDist);
    }

    this.structure.detectBonds();
    this.renderer.update(this.structure);
    this.app.updateUI();
    this.app.showToast(`已新增 ${elem} (${targetHybrid.nameZh}) 片段`);
  }

  onKeyDown(e) {
    const isEscape = (e.key === 'Escape' || e.code === 'Escape');

    // 忽略在文字輸入框內的輸入 (若按 Escape 則強制 blur 輸入框並繼續向下執行全域取消)
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      if (isEscape) {
        if (e.target.blur) e.target.blur();
      } else {
        return;
      }
    }

    // 1. 全域 Ctrl + Z (復原) - 支援 Windows 中文輸入法 KeyZ
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.code === 'KeyZ')) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        this.app.redo();
      } else {
        this.app.undo();
      }
      return;
    }

    // 2. 全域 Ctrl + Y (重做)
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || e.code === 'KeyY')) {
      e.preventDefault();
      e.stopPropagation();
      this.app.redo();
      return;
    }

    // 3. Delete / Backspace 刪除選中原子
    if (e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete' || e.code === 'Backspace') {
      const selectedCount = this.structure.atoms.filter(a => a.selected).length;
      if (selectedCount > 0) {
        e.preventDefault();
        this.app.pushHistory();
        this.structure.atoms = this.structure.atoms.filter(a => !a.selected);
        this.clearSelection();
        this.structure.syncFractionalFromCartesian();
        this.structure.detectBonds();
        this.renderer.update(this.structure);
        this.app.updateUI();
        this.app.setMeasurementDisplay('');
        this.app.showToast(`已刪除 ${selectedCount} 個原子`);
      }
      return;
    }

    // 4. Space 或 Ctrl + E: 觸發 VSEPR 掃把整理 🧹
    if (e.key === ' ' || e.code === 'Space' || ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'e' || e.code === 'KeyE'))) {
      e.preventDefault();
      this.app.runVSEPRClean();
      return;
    }

    // 5. Ctrl + A: 全選
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
      e.preventDefault();
      for (const a of this.structure.atoms) a.selected = true;
      this.renderer.update(this.structure);
      this.app.updateUI();
      return;
    }

    // 6. Escape: 全面退出視窗、退出微調面板、關閉外觀面板、退出筆刷模式、或取消所有選取
    if (isEscape) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();

      // (1) 優先關閉開啟中的模態視窗 (元素週期表、快捷鍵說明、匯出等)
      const modalPtable = document.getElementById('modal-ptable');
      if (modalPtable && modalPtable.classList.contains('show')) {
        modalPtable.classList.remove('show');
        return;
      }
      const modalShortcuts = document.getElementById('modal-shortcuts');
      if (modalShortcuts && modalShortcuts.classList.contains('show')) {
        modalShortcuts.classList.remove('show');
        return;
      }
      const modalExport = document.getElementById('modal-export');
      if (modalExport && modalExport.classList.contains('show')) {
        modalExport.classList.remove('show');
        return;
      }

      // (2) 關閉外觀色彩懸浮面版
      const appDock = document.getElementById('appearance-dock');
      if (appDock && appDock.style.display !== 'none') {
        appDock.style.display = 'none';
        return;
      }

      // (3) 關閉幾何微調滑桿面版
      if (this.app.isAdjustDockOpen) {
        this.app.closeAdjustDock();
        return;
      }

      // (4) 徹底退出筆刷模式與幾何微調模式 (兩者同步解除，絕不殘留)
      let stateChanged = false;
      if (this.isBrushMode || document.body.classList.contains('brush-mode-active')) {
        if (this.app && this.app.deactivateBrushMode) {
          this.app.deactivateBrushMode(false);
        } else {
          this.isBrushMode = false;
        }
        stateChanged = true;
      }
      if (this.activeTool) {
        this.activeTool = null;
        this.app.showToast('已取消幾何微調模式');
        stateChanged = true;
      }
      if (stateChanged) {
        this.app.updateUI();
        return;
      }

      // (5) 取消所有選取的原子
      if (this.selectedSequence.length > 0 || this.structure.atoms.some(a => a.selected)) {
        this.clearSelection();
        this.renderer.update(this.structure);
        this.app.setMeasurementDisplay('');
        this.app.updateUI();
        this.app.showToast('已取消選取');
        return;
      }
    }

    // 7. H / Shift + H: 加去氫
    if (e.key.toLowerCase() === 'h' || e.code === 'KeyH') {
      this.app.pushHistory();
      if (e.shiftKey) {
        VSEPR.removeHydrogens(this.structure, false);
        this.app.showToast('已移除氫原子 (-H)');
      } else {
        VSEPR.addHydrogens(this.structure, false);
        this.app.showToast('已補足氫原子 (+H)');
      }
      this.renderer.update(this.structure);
      this.app.updateUI();
      return;
    }
  }
}
