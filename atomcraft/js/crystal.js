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

  // ================= 數學與晶體幾何輔助函式 =================
  _gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  },

  _extGcd(a, b) {
    if (b === 0) return [a, 1, 0];
    const [g, x1, y1] = this._extGcd(b, a % b);
    return [g, y1, x1 - Math.floor(a / b) * y1];
  },

  /**
   * 求解密勒指數 (h, k, l) 表面平面的最小二維整數基底 (u, v)
   * 滿足 h*u1 + k*u2 + l*u3 = 0, h*v1 + k*v2 + l*v3 = 0, 且 u × v = (h, k, l)
   */
  findSurfaceBasis(h, k, l) {
    const g = this._gcd(this._gcd(h, k), l) || 1;
    h = Math.round(h / g);
    k = Math.round(k / g);
    l = Math.round(l / g);

    if (h === 0 && k === 0) {
      const res = [[1, 0, 0], [0, l > 0 ? 1 : -1, 0]];
      res.u = res[0]; res.v = res[1];
      return res;
    }
    if (h === 0 && l === 0) {
      const res = [[0, 0, 1], [k > 0 ? 1 : -1, 0, 0]];
      res.u = res[0]; res.v = res[1];
      return res;
    }
    if (k === 0 && l === 0) {
      const res = [[0, 1, 0], [0, 0, h > 0 ? 1 : -1]];
      res.u = res[0]; res.v = res[1];
      return res;
    }

    const [d, p, q] = this._extGcd(h, k);
    const u = [-Math.round(k / d), Math.round(h / d), 0];
    const v = [-p * l, -q * l, d];
    const res = [u, v];
    res.u = u; res.v = v;
    return res;
  },

  /**
   * 計算特定密勒指數 (h, k, l) 之晶面間距 d_hkl 與表面法向 (Materials Studio 標準)
   */
  calculatePlaneSpacing(cell, h, k, l) {
    if (!cell || cell.length !== 3) return null;
    const [va, vb, vc] = cell;
    const cross = (a, b) => [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

    const vol = dot(va, cross(vb, vc));
    if (Math.abs(vol) < 1e-6) return null;

    // 倒易晶格基底 (不含 2pi 因數，倒易向量長度即為 1/d)
    const b1 = cross(vb, vc).map(x => x / vol);
    const b2 = cross(vc, va).map(x => x / vol);
    const b3 = cross(va, vb).map(x => x / vol);

    const ghkl = [
      h * b1[0] + k * b2[0] + l * b3[0],
      h * b1[1] + k * b2[1] + l * b3[1],
      h * b1[2] + k * b2[2] + l * b3[2]
    ];
    const gLen = Math.hypot(ghkl[0], ghkl[1], ghkl[2]);
    if (gLen < 1e-7) return null;

    const d_hkl = 1.0 / gLen;
    const normalUnit = [ghkl[0] / gLen, ghkl[1] / gLen, ghkl[2] / gLen];
    const [uBasis, vBasis] = this.findSurfaceBasis(h, k, l);

    return {
      d_hkl,
      normalUnit,
      uBasis,
      vBasis,
      reciprocalVectors: [b1, b2, b3]
    };
  },

  /**
   * 真空層即時分析探測器 (Vacuum Layer Analyzer)
   * 探測任意晶胞體系在指定軸方向（預設 Z，可選 X/Y/Z）之材料邊界、材料厚度、上方真空與下方真空
   * @param {Structure} structure 
   * @param {string} axis 'x' | 'y' | 'z'
   */
  analyzeVacuum(structure, axis = 'z') {
    if (!structure || !structure.cell || structure.atoms.length === 0) return null;

    const ax = (axis || 'z').toLowerCase();
    const axIdx = ax === 'x' ? 0 : (ax === 'y' ? 1 : 2);
    const coordKey = ax;

    let min = Infinity, max = -Infinity;
    for (const a of structure.atoms) {
      const val = a[coordKey];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    if (max < min) return null;

    const slabThickness = Math.max(0.01, max - min);
    const cellVec = structure.cell[axIdx];
    const cellLength = Math.hypot(cellVec[0], cellVec[1], cellVec[2]);

    // 相對於原點 0 的下方真空與上方真空
    const bottomVacuum = Math.max(0, min);
    const topVacuum = Math.max(0, cellLength - max);
    const totalVacuum = Math.max(0, cellLength - slabThickness);

    return {
      axis: ax,
      axisIndex: axIdx,
      minCoord: Number(min.toFixed(4)),
      maxCoord: Number(max.toFixed(4)),
      slabThickness: Number(slabThickness.toFixed(4)),
      cellLength: Number(cellLength.toFixed(4)),
      bottomVacuum: Number(bottomVacuum.toFixed(4)),
      topVacuum: Number(topVacuum.toFixed(4)),
      totalVacuum: Number(totalVacuum.toFixed(4))
    };
  },

  /**
   * 調整真空層厚度 (Asymmetric Vacuum Adjustment)
   * 支援材料上方真空與下方真空獨立精確設定，支援 X/Y/Z 軸向選取，保留晶格幾何方向不強行破壞非正交角
   * @param {Structure} structure 
   * @param {Object|number} options 傳入物件 { axis, topVacuum, bottomVacuum, center } 或舊版數值
   */
  adjustVacuum(structure, options = {}, legacyCenter = false) {
    if (!structure || !structure.cell) {
      alert('需先具備晶胞才能設定真空層。');
      return false;
    }
    if (structure.atoms.length === 0) return false;

    let axis = 'z';
    let topVac = 15.0;
    let botVac = 0.0;
    let center = false;

    if (typeof options === 'number' || typeof options === 'string') {
      topVac = Math.max(0, Number(options) || 15.0);
      botVac = 0.0;
      center = Boolean(legacyCenter);
    } else if (typeof options === 'object') {
      axis = (options.axis || 'z').toLowerCase();
      topVac = Math.max(0, Number(options.topVacuum ?? 15.0));
      botVac = Math.max(0, Number(options.bottomVacuum ?? 0.0));
      center = Boolean(options.center);
    }

    const axIdx = axis === 'x' ? 0 : (axis === 'y' ? 1 : 2);
    const coordKey = axis;

    let min = Infinity, max = -Infinity;
    for (const a of structure.atoms) {
      const val = a[coordKey];
      if (val < min) min = val;
      if (val > max) max = val;
    }

    const slabThickness = Math.max(0.01, max - min);

    if (center) {
      const tot = topVac + botVac;
      topVac = tot / 2;
      botVac = tot / 2;
    }

    const newLength = slabThickness + topVac + botVac;

    // 1. 平移原子座標使底端落在 botVac
    const targetMin = botVac;
    const shift = targetMin - min;
    for (const a of structure.atoms) {
      a[coordKey] += shift;
    }

    // 2. 更新指定軸晶格向量長度 (非正交晶胞等比例縮放該向量長度，正交晶胞直接賦值)
    const newCell = structure.cell.map(r => [...r]);
    const oldVec = newCell[axIdx];
    const oldLen = Math.hypot(oldVec[0], oldVec[1], oldVec[2]);

    if (oldLen < 1e-4) {
      newCell[axIdx] = [0, 0, 0];
      newCell[axIdx][axIdx] = newLength;
    } else {
      const scale = newLength / oldLen;
      newCell[axIdx] = [oldVec[0] * scale, oldVec[1] * scale, oldVec[2] * scale];
    }

    const newPbc = [...structure.pbc];
    newPbc[axIdx] = false; // 真空方向週期性關閉

    structure.setCell(newCell, newPbc);
    structure.detectBonds();
    return true;
  },

  /**
   * Materials Studio 風格密勒指數表面切割 (MS Style Surface Cleaver)
   * 包含：(h, k, l) 切面、d_hkl 間距、面內基底向量 (U, V)、層數/厚度、截面平移 (Fractional Shift / Termination)、上下獨立真空層
   * @param {Structure} structure 
   * @param {Object|number} options 傳入物件或舊版 h 參數
   */
  cleaveSurface(structure, h = 0, k = 0, l = 1, thicknessLayers = 3, vacuum = 15.0) {
    if (!structure || !structure.cell) {
      alert('請先載入或設定三維塊材 (Bulk) 晶體。');
      return false;
    }
    if (structure.atoms.length === 0) return false;

    let opts = {};
    if (typeof h === 'object') {
      opts = h;
    } else {
      opts = {
        h: parseInt(h, 10) || 0,
        k: parseInt(k, 10) || 0,
        l: parseInt(l, 10) || 0,
        layers: parseInt(thicknessLayers, 10) || 3,
        topVacuum: parseFloat(vacuum) || 15.0,
        bottomVacuum: 0.0,
        shift: 0.0
      };
    }

    const millH = parseInt(opts.h, 10) || 0;
    const millK = parseInt(opts.k, 10) || 0;
    const millL = parseInt(opts.l, 10) || 0;

    if (millH === 0 && millK === 0 && millL === 0) {
      alert('密勒指數 (h, k, l) 不能同時為 0！');
      return false;
    }

    const planeInfo = this.calculatePlaneSpacing(structure.cell, millH, millK, millL);
    if (!planeInfo) {
      alert('無法計算該晶面之倒易空間向量，請確認晶格是否退化。');
      return false;
    }

    const { d_hkl, normalUnit, uBasis, vBasis } = planeInfo;
    const [va, vb, vc] = structure.cell;

    // 依使用者輸入判定層數 (若指定 thickness 則轉化為層數)
    let nLayers = parseInt(opts.layers, 10) || 1;
    if (opts.thickness && Number(opts.thickness) > 0) {
      nLayers = Math.max(1, Math.ceil(Number(opts.thickness) / d_hkl));
    }

    const shiftFrac = Math.max(0, Math.min(1.0, parseFloat(opts.shift || 0.0)));
    const topVac = Math.max(0, parseFloat(opts.topVacuum ?? 15.0));
    const botVac = Math.max(0, parseFloat(opts.bottomVacuum ?? 0.0));

    // 面內基底向量在真實空間的座標
    const vecU = [
      uBasis[0] * va[0] + uBasis[1] * vb[0] + uBasis[2] * vc[0],
      uBasis[0] * va[1] + uBasis[1] * vb[1] + uBasis[2] * vc[1],
      uBasis[0] * va[2] + uBasis[1] * vb[2] + uBasis[2] * vc[2]
    ];
    const vecV = [
      vBasis[0] * va[0] + vBasis[1] * vb[0] + vBasis[2] * vc[0],
      vBasis[0] * va[1] + vBasis[1] * vb[1] + vBasis[2] * vc[1],
      vBasis[0] * va[2] + vBasis[1] * vb[2] + vBasis[2] * vc[2]
    ];

    // 建立正交變換矩陣：將表面法向對齊 +Z，vecU 對齊 +X
    const cross = (a, b) => [
      a[1]*b[2] - a[2]*b[1],
      a[2]*b[0] - a[0]*b[2],
      a[0]*b[1] - a[1]*b[0]
    ];
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const norm = v => {
      const len = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / len, v[1] / len, v[2] / len];
    };

    const zAxis = normalUnit;
    const xAxis = norm(vecU);
    const yAxis = cross(zAxis, xAxis);

    // 旋轉矩陣 R 的三列 (將任意向量轉至 Slab 參考坐標系)
    const R = [xAxis, yAxis, zAxis];

    const uRot = [dot(R[0], vecU), dot(R[1], vecU), dot(R[2], vecU)];
    const vRot = [dot(R[0], vecV), dot(R[1], vecV), dot(R[2], vecV)];

    const det2D = uRot[0] * vRot[1] - uRot[1] * vRot[0];
    if (Math.abs(det2D) < 1e-6) {
      alert('面內基底向量退化，請檢查密勒指數。');
      return false;
    }

    // 擴胞搜尋半徑
    const maxHkl = Math.max(Math.abs(millH), Math.abs(millK), Math.abs(millL));
    const searchR = Math.max(2, maxHkl * 2 + nLayers);

    // 確保原子具有分數座標
    structure.syncFractionalFromCartesian();
    const bulkAtoms = structure.atoms;

    const slabAtoms = [];
    const seen = new Set();

    for (let ni = -searchR; ni <= searchR; ni++) {
      for (let nj = -searchR; nj <= searchR; nj++) {
        for (let nk = -searchR; nk <= searchR; nk++) {
          for (const a of bulkAtoms) {
            const totFx = a.fx + ni;
            const totFy = a.fy + nj;
            const totFz = a.fz + nk;

            // 沿切面法向之晶面層數座標
            const zeta = millH * totFx + millK * totFy + millL * totFz;
            const zetaShift = zeta - shiftFrac;

            if (zetaShift >= -1e-5 && zetaShift < nLayers - 1e-5) {
              // 笛卡爾座標 (原 Bulk 坐標系)
              const rx = totFx * va[0] + totFy * vb[0] + totFz * vc[0];
              const ry = totFx * va[1] + totFy * vb[1] + totFz * vc[1];
              const rz = totFx * va[2] + totFy * vb[2] + totFz * vc[2];

              // 旋轉至 Slab 坐標系
              const rRot = [
                dot(R[0], [rx, ry, rz]),
                dot(R[1], [rx, ry, rz]),
                dot(R[2], [rx, ry, rz])
              ];

              // 檢測是否落在 2D 表面晶胞 [0, 1) x [0, 1) 內
              const s2 = (rRot[1] * uRot[0] - rRot[0] * uRot[1]) / det2D;
              const s1 = (rRot[0] - s2 * vRot[0]) / uRot[0];

              if (s1 >= -1e-5 && s1 < 1.0 - 1e-5 && s2 >= -1e-5 && s2 < 1.0 - 1e-5) {
                const key = `${a.element}_${s1.toFixed(4)}_${s2.toFixed(4)}_${zetaShift.toFixed(4)}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  slabAtoms.push({
                    element: a.element,
                    x: rRot[0],
                    y: rRot[1],
                    z: rRot[2]
                  });
                }
              }
            }
          }
        }
      }
    }

    if (slabAtoms.length === 0) {
      alert('切片範圍內未截取到任何原子，請適度調整層數或截面平移 (Shift)。');
      return false;
    }

    // 取得 Z 方向極值並配置上下真空層
    let minZ = Infinity, maxZ = -Infinity;
    for (const a of slabAtoms) {
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
    }
    const slabThick = maxZ - minZ;
    const finalLz = slabThick + topVac + botVac;
    const zShift = botVac - minZ;

    const newAtoms = [];
    let nextId = 1;
    for (const a of slabAtoms) {
      newAtoms.push({
        id: nextId++,
        element: a.element,
        x: Number(a.x.toFixed(5)),
        y: Number(a.y.toFixed(5)),
        z: Number((a.z + zShift).toFixed(5)),
        fx: 0, fy: 0, fz: 0,
        selected: false,
        fixed: false
      });
    }

    const newCell = [
      [Number(uRot[0].toFixed(5)), Number(uRot[1].toFixed(5)), 0.0],
      [Number(vRot[0].toFixed(5)), Number(vRot[1].toFixed(5)), 0.0],
      [0.0, 0.0, Number(finalLz.toFixed(5))]
    ];

    structure.atoms = newAtoms;
    structure.setCell(newCell, [true, true, false]);
    structure.detectBonds();

    return {
      success: true,
      d_hkl: Number(d_hkl.toFixed(4)),
      slabThickness: Number(slabThick.toFixed(4)),
      layers: nLayers,
      atomCount: newAtoms.length,
      cell: newCell
    };
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
