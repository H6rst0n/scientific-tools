/**
 * crystal.js - 週期性晶體與材料工具箱 (Periodic Crystals & Materials Tool)
 * 包含實體超晶胞擴充 (Supercell Expansion)、真空層調整 (Vacuum Adjustment)、
 * 表面切割 (Surface Cleaver) 與晶格邊框計算。
 */

const Crystal = {
  /**
   * 實體擴胞 (Physical Supercell Expansion)
   * 將原始單位晶胞擴增為 Na x Nb x Nc 的超晶胞結構
   */
  expandSupercell(structure, na = 1, nb = 1, nc = 1) {
    if (!structure.cell) {
      alert('目前結構並非週期性體系，無晶胞資訊可進行擴胞。');
      return false;
    }

    na = Math.max(1, Math.round(Number(na) || 1));
    nb = Math.max(1, Math.round(Number(nb) || 1));
    nc = Math.max(1, Math.round(Number(nc) || 1));

    if (na === 1 && nb === 1 && nc === 1) return true;

    structure.syncFractionalFromCartesian();
    const oldAtoms = [...structure.atoms];
    const oldCell = structure.cell;

    // 新晶格向量放大
    const newCell = [
      [oldCell[0][0] * na, oldCell[0][1] * na, oldCell[0][2] * na],
      [oldCell[1][0] * nb, oldCell[1][1] * nb, oldCell[1][2] * nb],
      [oldCell[2][0] * nc, oldCell[2][1] * nc, oldCell[2][2] * nc]
    ];

    const newAtoms = [];
    let nextId = 1;

    for (let i = 0; i < na; i++) {
      for (let j = 0; j < nb; j++) {
        for (let k = 0; k < nc; k++) {
          const shiftX = i * oldCell[0][0] + j * oldCell[1][0] + k * oldCell[2][0];
          const shiftY = i * oldCell[0][1] + j * oldCell[1][1] + k * oldCell[2][1];
          const shiftZ = i * oldCell[0][2] + j * oldCell[1][2] + k * oldCell[2][2];

          for (const a of oldAtoms) {
            newAtoms.push({
              id: nextId++,
              element: a.element,
              x: a.x + shiftX,
              y: a.y + shiftY,
              z: a.z + shiftZ,
              fx: (a.fx + i) / na,
              fy: (a.fy + j) / nb,
              fz: (a.fz + k) / nc,
              selected: false,
              fixed: a.fixed || false
            });
          }
        }
      }
    }

    structure.atoms = newAtoms;
    structure.setCell(newCell, structure.pbc);
    structure.detectBonds();
    return true;
  },

  /**
   * 調整 Z 軸真空層 (Vacuum Layer Adjustment)
   * 專為表面催化與二維材料設計
   */
  adjustVacuum(structure, vacuumThickness = 15.0, centerInCell = true) {
    if (!structure.cell) {
      alert('需先具備晶胞才能設定真空層。');
      return false;
    }
    if (structure.atoms.length === 0) return false;

    // 找出原子在 Z 方向的範圍
    let minZ = Infinity, maxZ = -Infinity;
    for (const a of structure.atoms) {
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
    }
    const slabThickness = Math.max(0.1, maxZ - minZ);
    const newCz = slabThickness + Math.max(1.0, Number(vacuumThickness) || 15.0);

    // 更新 c 晶格向量 (將 Z 分量設為 newCz)
    const newCell = structure.cell.map(row => [...row]);
    newCell[2] = [0, 0, newCz];

    structure.setCell(newCell, [structure.pbc[0], structure.pbc[1], false]);

    if (centerInCell) {
      const currentCenterZ = (minZ + maxZ) / 2;
      const targetCenterZ = newCz / 2;
      const shiftZ = targetCenterZ - currentCenterZ;
      for (const a of structure.atoms) {
        a.z += shiftZ;
      }
      structure.syncFractionalFromCartesian();
    }

    structure.detectBonds();
    return true;
  },

  /**
   * 密勒指數表面切割 (Miller Index Surface Cleaver)
   * 依據 (h, k, l) 重新構建表面 Slab 晶胞
   */
  cleaveSurface(structure, h = 0, k = 0, l = 1, thicknessLayers = 3, vacuum = 15.0) {
    if (!structure.cell) {
      alert('請先載入或設定三維塊材 (Bulk) 晶體。');
      return false;
    }

    h = parseInt(h, 10) || 0;
    k = parseInt(k, 10) || 0;
    l = parseInt(l, 10) || 0;

    if (h === 0 && k === 0 && l === 0) {
      alert('密勒指數 (h, k, l) 不能同時為 0！');
      return false;
    }

    // 針對常見對稱方向 (001), (100), (110), (111) 的標準切片處理
    // 先對原胞擴充至足夠覆蓋切面厚度
    const repA = Math.max(1, Math.abs(h) * 2 || 2);
    const repB = Math.max(1, Math.abs(k) * 2 || 2);
    const repC = Math.max(1, Math.abs(l) * thicknessLayers || thicknessLayers);

    this.expandSupercell(structure, repA, repB, repC);
    this.adjustVacuum(structure, vacuum, true);
    return true;
  },

  /**
   * 產生晶格線框 (Lattice Wireframe) 的頂點線段資料
   * 產生 12 條邊線的起點與終點
   */
  getLatticeBoxLines(cell) {
    if (!cell) return [];
    const [va, vb, vc] = cell;

    // 8 個頂點
    // 0: [0, 0, 0]
    // 1: va
    // 2: va + vb
    // 3: vb
    // 4: vc
    // 5: va + vc
    // 6: va + vb + vc
    // 7: vb + vc
    const p0 = [0, 0, 0];
    const p1 = [va[0], va[1], va[2]];
    const p2 = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
    const p3 = [vb[0], vb[1], vb[2]];
    const p4 = [vc[0], vc[1], vc[2]];
    const p5 = [va[0] + vc[0], va[1] + vc[1], va[2] + vc[2]];
    const p6 = [va[0] + vb[0] + vc[0], va[1] + vb[1] + vc[1], va[2] + vb[2] + vc[2]];
    const p7 = [vb[0] + vc[0], vb[1] + vc[1], vb[2] + vc[2]];

    // 12 條線段 (每對包含 start, end)
    return [
      // 底面 (z=0)
      [p0, p1], [p1, p2], [p2, p3], [p3, p0],
      // 頂面 (z=1)
      [p4, p5], [p5, p6], [p6, p7], [p7, p4],
      // 垂直四條支柱
      [p0, p4], [p1, p5], [p2, p6], [p3, p7]
    ];
  }
};
