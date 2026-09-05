/**
 * vsepr.js - GaussView 風格 VSEPR 幾何整理與自動加氫工具 (VSEPR Geometric Clean 🧹)
 * 純幾何與彈簧力場放鬆演算法，微秒級完成結構修復與角度標準化
 */

const VSEPR = {
  /**
   * 取得理想鍵長 (Å)，支援共價單/雙/三鍵與氫鍵
   */
  getIdealBondLength(elemA, elemB, order = 1) {
    if (order === 'hb') {
      return 1.90; // 氫鍵非共價平衡長度約 1.90 Å
    }
    const pair = [elemA, elemB].sort().join('-');
    const ord = typeof order === 'number' ? order : 1;

    if (pair === 'C-C') {
      if (ord === 3) return 1.20;
      if (ord === 2) return 1.34;
      return 1.54;
    }
    if (pair === 'C-O') {
      if (ord === 2) return 1.22;
      return 1.43;
    }
    if (pair === 'C-N') {
      if (ord === 3) return 1.16;
      if (ord === 2) return 1.28;
      return 1.47;
    }
    if (pair === 'N-N') {
      if (ord === 3) return 1.10;
      if (ord === 2) return 1.25;
      return 1.45;
    }
    if (pair === 'O-O') {
      if (ord === 2) return 1.21;
      return 1.48;
    }

    const infoA = getElementInfo(elemA) || {};
    const infoB = getElementInfo(elemB) || {};
    const rA = infoA.covRadius || 0.77;
    const rB = infoB.covRadius || 0.77;
    let base = rA + rB;
    if (ord === 2) base *= 0.89;
    if (ord === 3) base *= 0.80;
    return Math.max(0.6, base);
  },

  /**
   * 根據中心原子、配位數與 pi 鍵數判定理想 VSEPR 混成目標幾何構型
   */
  getTargetGeometry(centerElem, neighborCount, piBonds = 0, isPlanarN = false) {
    const sym = centerElem;

    if (neighborCount === 1) {
      return { type: 'single', angles: [] };
    }

    if (neighborCount === 2) {
      // 判斷直線 (180°) 或是角形 (104.5° ~ 120°)
      if (['Be', 'Hg', 'Zn', 'Cd'].includes(sym)) {
        return { type: 'linear', angle: 180 };
      }
      // 碳原子具有 2 個配位且有 2 個以上 pi 鍵 (如 O=C=O, H-C#C-H)：sp 混成，直線形 180°！
      if (sym === 'C' && piBonds >= 2) {
        return { type: 'linear', angle: 180 };
      }
      // 氮原子具有 2 個配位且有 1 個 pi 鍵 (如 -N=O, -N=N-)：sp2 混成，角形 120°
      if (sym === 'N' && piBonds >= 1) {
        return { type: 'bent', angle: 120.0 };
      }
      if (['O', 'S', 'Se'].includes(sym)) {
        return { type: 'bent', angle: 104.5 }; // 水分子型
      }
      return { type: 'bent', angle: 109.5 };
    }

    if (neighborCount === 3) {
      // 判斷平面三角形 (120°) 或是三角錐 (107°)
      if (['B', 'Al'].includes(sym)) {
        return { type: 'trigonal_planar', angle: 120 };
      }
      // 碳原子具有 3 個配位且有 pi 鍵 (如乙烯 H2C=CH2, 甲醛 H2C=O, 苯環)：sp2 混成，平面三角形 120°！
      if (sym === 'C' && piBonds >= 1) {
        return { type: 'trigonal_planar', angle: 120.0 };
      }
      if (['N', 'P', 'As'].includes(sym)) {
        if (piBonds >= 1 || isPlanarN) return { type: 'trigonal_planar', angle: 120.0 }; // 平面醯胺與環中芳香氮
        return { type: 'pyramidal', angle: 107.0 }; // 氨分子型
      }
      return { type: 'trigonal_planar', angle: 120 };
    }

    if (neighborCount === 4) {
      // 判斷平面四方 (90°) 或是正四面體 (109.47°)
      if (['Pd', 'Pt', 'Au', 'Ni'].includes(sym)) {
        return { type: 'square_planar', angle: 90 };
      }
      return { type: 'tetrahedral', angle: 109.47 };
    }

    if (neighborCount === 5) {
      return { type: 'trigonal_bipyramidal', angleEq: 120, angleAx: 180 };
    }

    if (neighborCount >= 6) {
      return { type: 'octahedral', angle: 90 };
    }

    return { type: 'default', angle: 109.5 };
  },

  /**
   * 搜尋包含相鄰兩鍵路徑 (u - c - w) 的最小環大小 (3 ~ 6 元環)
   * 若不屬於 3~6 元環則返回 0
   */
  findSmallestRingForAngle(c, u, w, covNeighbors) {
    if (u === w) return 0;
    // BFS 尋找 u 到 w 且不經過 c 的最短路徑
    const queue = [[u, 0]];
    const visited = new Set([c, u]);
    while (queue.length > 0) {
      const [curr, depth] = queue.shift();
      if (depth >= 4) continue; // 超過 4 步代表環大於 6 元 (4 + 2 = 6)
      for (const nbr of covNeighbors[curr]) {
        if (nbr === w) {
          return depth + 3; // 找到長度為 (depth+1) + 2 = depth + 3 的環 (3, 4, 5, 6)
        }
        if (!visited.has(nbr)) {
          visited.add(nbr);
          queue.push([nbr, depth + 1]);
        }
      }
    }
    return 0;
  },

  /**
   * 取得三原子鍵角 (u - c - w) 之目標幾何角度
   * 智慧融合環感知 (Ring Perception) 與混成態 (Hybridization)
   */
  getTargetAngle(c, u, w, atoms, covNeighbors, piCount) {
    const ringSize = VSEPR.findSmallestRingForAngle(c, u, w, covNeighbors);
    if (ringSize === 3) return 60.0;
    if (ringSize === 4) return 90.0;
    if (ringSize === 5) return 108.0; // 五元環內角 108° (咪唑、咖啡因、環戊烷)
    if (ringSize === 6) {
      const isAromaticOrSp2 = (piCount[c] > 0 || (['C', 'N'].includes(atoms[c].element) && covNeighbors[c].length === 3));
      return isAromaticOrSp2 ? 120.0 : 109.47; // 六元環：芳香 120°，飽和烷烴 109.5°
    }

    // 若 u 或 w 屬於 5 元環，但此角度為環外取代基角 (exocyclic)
    const nbrs = covNeighbors[c];
    if (nbrs.length === 3) {
      let hasRing5 = false;
      for (let i = 0; i < nbrs.length; i++) {
        for (let j = i + 1; j < nbrs.length; j++) {
          if (VSEPR.findSmallestRingForAngle(c, nbrs[i], nbrs[j], covNeighbors) === 5) {
            hasRing5 = true;
            break;
          }
        }
        if (hasRing5) break;
      }
      if (hasRing5) return 126.0; // (360 - 108)/2 = 126°
    }

    // 檢查 N 是否在環中或鄰近 pi 鍵 (如咖啡因芳香環氮、咪唑、吡咯、醯胺)
    let isPlanarN = false;
    if (atoms[c].element === 'N') {
      const inAnyRing = nbrs.some(uIdx => nbrs.some(wIdx => uIdx !== wIdx && VSEPR.findSmallestRingForAngle(c, uIdx, wIdx, covNeighbors) > 0));
      const nearPi = nbrs.some(nbr => piCount[nbr] >= 1);
      if (inAnyRing || nearPi) isPlanarN = true;
    }

    // 一般非環角度：根據混成軌域計算
    const geom = VSEPR.getTargetGeometry(atoms[c].element, nbrs.length, piCount[c], isPlanarN);
    return geom.angle || (geom.type === 'octahedral' ? 90 : 109.47);
  },

  /**
   * GaussView 風格輕量分子力場幾何整理 (UFF-Clean 🧹)
   * 整合：環感知角度 (Ring Perception)、共面性外翻約束 (Planarity/Improper Dihedrals)、
   * 二面角扭轉 (Torsion)、3D 擾動展開 (3D Symmetry Breaking) 與拓樸安全維持
   */
  cleanGeometry(structure, selectedOnly = false) {
    if (structure.atoms.length === 0) return;

    // 若尚未偵測化學鍵，先以標準容許度偵測 (包含自動鍵級感知與氫鍵辨識)
    if (!structure.bonds || structure.bonds.length === 0) {
      structure.detectBonds(0.40);
    }
    if (structure.bonds.length === 0 && structure.atoms.length >= 2) {
      structure.detectBonds(1.20);
    }

    const atoms = structure.atoms;
    const n = atoms.length;
    const isTarget = i => !selectedOnly || atoms[i].selected;

    // 建立共價鄰接表與 pi 鍵統計 (排除非共價氫鍵)
    const covNeighbors = Array.from({ length: n }, () => []);
    const piCount = new Int32Array(n);
    for (const b of structure.bonds) {
      if (b.order === 'hb') continue;
      covNeighbors[b.a].push(b.b);
      covNeighbors[b.b].push(b.a);
      const ord = typeof b.order === 'number' ? b.order : 1;
      if (ord > 1) {
        piCount[b.a] += (ord - 1);
        piCount[b.b] += (ord - 1);
      }
    }

    // 3D 立體對稱破缺 (打破 2D 畫布完全平面的十字形陷阱)
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      if (atoms[i].z < minZ) minZ = atoms[i].z;
      if (atoms[i].z > maxZ) maxZ = atoms[i].z;
    }
    const isPlanar2D = (maxZ - minZ) < 0.05;
    if (isPlanar2D && n > 2) {
      // 若存在 sp3 中心，對終端非環原子 (如 H) 給予極微幅 Z 軸正負交錯擾動 (0.08 Å)
      for (let i = 0; i < n; i++) {
        if (covNeighbors[i].length >= 3 && piCount[i] === 0) {
          for (let p = 0; p < covNeighbors[i].length; p++) {
            const nbr = covNeighbors[i][p];
            if (covNeighbors[nbr].length === 1 && !atoms[nbr].fixed) {
              atoms[nbr].z += (p % 2 === 0 ? 0.08 : -0.08);
            }
          }
        }
      }
    }

    // 彈性鬆弛模擬 (Molecular Mechanics Relaxation)
    const steps = 80;
    const dt = 0.08;
    const kB = 25.0; // 共價鍵長彈簧常數
    const kAngle = 16.0; // 鍵角恢復常數
    const kOOP = 18.0; // 平面外反轉共面常數
    const kTorDouble = 25.0; // 雙鍵共面二面角常數
    const kTorAlkane = 3.5; // 烷烴交叉式二面角常數
    const kRep = 3.0; // 非成鍵排斥力常數

    for (let step = 0; step < steps; step++) {
      const fx = new Float64Array(n);
      const fy = new Float64Array(n);
      const fz = new Float64Array(n);

      // 1. 鍵長約束 (Bond Stretching - 支援多重鍵理想長度與氫鍵柔性引導)
      for (const b of structure.bonds) {
        const i = b.a;
        const j = b.b;
        const isHB = b.order === 'hb';
        const idealR = VSEPR.getIdealBondLength(atoms[i].element, atoms[j].element, b.order);
        const kSpring = isHB ? 2.5 : kB;

        let dx = atoms[j].x - atoms[i].x;
        let dy = atoms[j].y - atoms[i].y;
        let dz = atoms[j].z - atoms[i].z;
        let dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-4) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          dz = (Math.random() - 0.5) * 0.1;
          dist = Math.hypot(dx, dy, dz);
        }

        const delta = dist - idealR;
        const force = -kSpring * delta;
        const fx_ij = (dx / dist) * force;
        const fy_ij = (dy / dist) * force;
        const fz_ij = (dz / dist) * force;

        if (isTarget(i)) { fx[i] -= fx_ij; fy[i] -= fy_ij; fz[i] -= fz_ij; }
        if (isTarget(j)) { fx[j] += fx_ij; fy[j] += fy_ij; fz[j] += fz_ij; }
      }

      // 2. 鍵角約束 (Bond Angles - 融合環感知五元環 108°、六元環 120° 與混成態角度)
      for (let c = 0; c < n; c++) {
        const nbrs = covNeighbors[c];
        if (nbrs.length < 2) continue;

        for (let p = 0; p < nbrs.length; p++) {
          const u = nbrs[p];
          const v1x = atoms[u].x - atoms[c].x;
          const v1y = atoms[u].y - atoms[c].y;
          const v1z = atoms[u].z - atoms[c].z;
          const d1 = Math.hypot(v1x, v1y, v1z);
          if (d1 < 1e-3) continue;

          for (let q = p + 1; q < nbrs.length; q++) {
            const w = nbrs[q];
            const v2x = atoms[w].x - atoms[c].x;
            const v2y = atoms[w].y - atoms[c].y;
            const v2z = atoms[w].z - atoms[c].z;
            const d2 = Math.hypot(v2x, v2y, v2z);
            if (d2 < 1e-3) continue;

            const targetDeg = VSEPR.getTargetAngle(c, u, w, atoms, covNeighbors, piCount);
            const targetRad = (targetDeg * Math.PI) / 180;
            const cosTarget = Math.cos(targetRad);

            const cosTheta = (v1x * v2x + v1y * v2y + v1z * v2z) / (d1 * d2);
            const deltaCos = cosTheta - cosTarget;
            const fMag = -kAngle * deltaCos;

            const f1x = (v2x / d2 - cosTheta * (v1x / d1)) * fMag / d1;
            const f1y = (v2y / d2 - cosTheta * (v1y / d1)) * fMag / d1;
            const f1z = (v2z / d2 - cosTheta * (v1z / d1)) * fMag / d1;

            const f2x = (v1x / d1 - cosTheta * (v2x / d2)) * fMag / d2;
            const f2y = (v1y / d1 - cosTheta * (v2y / d2)) * fMag / d2;
            const f2z = (v1z / d1 - cosTheta * (v2z / d2)) * fMag / d2;

            if (isTarget(u)) { fx[u] += f1x; fy[u] += f1y; fz[u] += f1z; }
            if (isTarget(w)) { fx[w] += f2x; fy[w] += f2y; fz[w] += f2z; }
            if (isTarget(c)) {
              fx[c] -= (f1x + f2x);
              fy[c] -= (f1y + f2y);
              fz[c] -= (f1z + f2z);
            }
          }
        }
      }

      // 3. 平面外翻約束 (Symmetric Out-of-Plane Constraint)
      // 對所有 sp2 3 配位中心 (苯環碳、咖啡因環氮/碳、乙烯碳、羰基碳)，將中心原子拉入 3 鄰居所構成的平面
      for (let c = 0; c < n; c++) {
        const nbrs = covNeighbors[c];
        if (nbrs.length !== 3) continue;
        const elem = atoms[c].element;
        const inAnyRing = nbrs.some(uIdx => nbrs.some(wIdx => uIdx !== wIdx && VSEPR.findSmallestRingForAngle(c, uIdx, wIdx, covNeighbors) > 0));
        const isSp2 = (piCount[c] >= 1) || (elem === 'C') || (elem === 'N' && (inAnyRing || nbrs.some(nbr => piCount[nbr] >= 1)));
        if (!isSp2) continue;

        const [u, v, w] = nbrs;
        // 3 鄰居構成之平面法向量 n = (rv - ru) x (rw - ru)
        const ru = [atoms[u].x, atoms[u].y, atoms[u].z];
        const rv = [atoms[v].x, atoms[v].y, atoms[v].z];
        const rw = [atoms[w].x, atoms[w].y, atoms[w].z];

        const vu = [rv[0] - ru[0], rv[1] - ru[1], rv[2] - ru[2]];
        const vw = [rw[0] - ru[0], rw[1] - ru[1], rw[2] - ru[2]];

        const nx = vu[1] * vw[2] - vu[2] * vw[1];
        const ny = vu[2] * vw[0] - vu[0] * vw[2];
        const nz = vu[0] * vw[1] - vu[1] * vw[0];
        const nLen = Math.hypot(nx, ny, nz);
        if (nLen < 1e-4) continue;

        const unx = nx / nLen, uny = ny / nLen, unz = nz / nLen;
        // 中心原子偏離 3 鄰居平面的距離 h = (rc - ru) . un
        const rc = [atoms[c].x, atoms[c].y, atoms[c].z];
        const h = (rc[0] - ru[0]) * unx + (rc[1] - ru[1]) * uny + (rc[2] - ru[2]) * unz;

        if (Math.abs(h) > 1e-4) {
          const fOOP = -kOOP * h;
          const fcx = unx * fOOP;
          const fcy = uny * fOOP;
          const fcz = unz * fOOP;

          if (isTarget(c)) { fx[c] += fcx; fy[c] += fcy; fz[c] += fcz; }
          // 3 鄰居平分反作用力，保持動量守恆
          const fnx = -fcx / 3.0, fny = -fcy / 3.0, fnz = -fcz / 3.0;
          if (isTarget(u)) { fx[u] += fnx; fy[u] += fny; fz[u] += fnz; }
          if (isTarget(v)) { fx[v] += fnx; fy[v] += fny; fz[v] += fnz; }
          if (isTarget(w)) { fx[w] += fnx; fy[w] += fny; fz[w] += fnz; }
        }
      }

      // 4. 二面角扭轉約束 (Dihedral Torsion)
      // 雙鍵 (order === 2)：約束為 0° 或 180° 共面
      // 烷烴單鍵 (sp3-sp3)：約束為 60°/180°/300° 交叉式鋸齒構型
      for (const b of structure.bonds) {
        if (b.order === 'hb') continue;
        const j = b.a;
        const k = b.b;
        const nbrsJ = covNeighbors[j].filter(x => x !== k);
        const nbrsK = covNeighbors[k].filter(x => x !== j);
        if (nbrsJ.length === 0 || nbrsK.length === 0) continue;

        const isDouble = (b.order === 2);
        const isAlkane = (b.order === 1 && covNeighbors[j].length === 4 && covNeighbors[k].length === 4 && piCount[j] === 0 && piCount[k] === 0);
        if (!isDouble && !isAlkane) continue;

        const u0 = nbrsJ[0];
        const w0 = nbrsK[0];

        const b1 = [atoms[j].x - atoms[u0].x, atoms[j].y - atoms[u0].y, atoms[j].z - atoms[u0].z];
        const b2 = [atoms[k].x - atoms[j].x, atoms[k].y - atoms[j].y, atoms[k].z - atoms[j].z];
        const b3 = [atoms[w0].x - atoms[k].x, atoms[w0].y - atoms[k].y, atoms[w0].z - atoms[k].z];

        const lenB2 = Math.hypot(...b2);
        if (lenB2 < 1e-3) continue;
        const ub2 = [b2[0]/lenB2, b2[1]/lenB2, b2[2]/lenB2];

        const n1 = [
          b1[1] * b2[2] - b1[2] * b2[1],
          b1[2] * b2[0] - b1[0] * b2[2],
          b1[0] * b2[1] - b1[1] * b2[0]
        ];
        const n2 = [
          b2[1] * b3[2] - b2[2] * b3[1],
          b2[2] * b3[0] - b2[0] * b3[2],
          b2[0] * b3[1] - b2[1] * b3[0]
        ];

        const lenN1 = Math.hypot(...n1);
        const lenN2 = Math.hypot(...n2);
        if (lenN1 < 1e-4 || lenN2 < 1e-4) continue;

        const un1 = [n1[0]/lenN1, n1[1]/lenN1, n1[2]/lenN1];
        const un2 = [n2[0]/lenN2, n2[1]/lenN2, n2[2]/lenN2];

        const dotN = un1[0]*un2[0] + un1[1]*un2[1] + un1[2]*un2[2];
        const cosPhi = Math.max(-1, Math.min(1, dotN));

        const cx = un1[1] * un2[2] - un1[2] * un2[1];
        const cy = un1[2] * un2[0] - un1[0] * un2[2];
        const cz = un1[0] * un2[1] - un1[1] * un2[0];
        const sinPhi = (cx * ub2[0] + cy * ub2[1] + cz * ub2[2]);

        const phi = Math.atan2(sinPhi, cosPhi);
        const torque = isDouble ? (kTorDouble * Math.sin(2 * phi)) : (kTorAlkane * Math.sin(3 * phi));
        if (Math.abs(torque) < 1e-5) continue;

        // 對 k 端的鄰居施加純切向力矩 -torque * (ub2 x r_kw)
        for (const w of nbrsK) {
          const rkw = [atoms[w].x - atoms[k].x, atoms[w].y - atoms[k].y, atoms[w].z - atoms[k].z];
          const tw = [
            ub2[1] * rkw[2] - ub2[2] * rkw[1],
            ub2[2] * rkw[0] - ub2[0] * rkw[2],
            ub2[0] * rkw[1] - ub2[1] * rkw[0]
          ];
          const tLen = Math.hypot(...tw);
          if (tLen < 1e-3) continue;
          const fw = -torque / tLen;
          if (isTarget(w)) {
            fx[w] += tw[0] * fw;
            fy[w] += tw[1] * fw;
            fz[w] += tw[2] * fw;
          }
        }

        // 對 j 端的鄰居施加反向切向力矩 +torque * (ub2 x r_ju)
        for (const u of nbrsJ) {
          const rju = [atoms[u].x - atoms[j].x, atoms[u].y - atoms[j].y, atoms[u].z - atoms[j].z];
          const tu = [
            ub2[1] * rju[2] - ub2[2] * rju[1],
            ub2[2] * rju[0] - ub2[0] * rju[2],
            ub2[0] * rju[1] - ub2[1] * rju[0]
          ];
          const tLen = Math.hypot(...tu);
          if (tLen < 1e-3) continue;
          const fu = torque / tLen;
          if (isTarget(u)) {
            fx[u] += tu[0] * fu;
            fy[u] += tu[1] * fu;
            fz[u] += tu[2] * fu;
          }
        }
      }

      // 5. 非鍵結原子間軟排斥 (Non-bonded Soft Repulsion 避免空間重疊)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (covNeighbors[i].includes(j)) continue;
          let dx = atoms[j].x - atoms[i].x;
          let dy = atoms[j].y - atoms[i].y;
          let dz = atoms[j].z - atoms[i].z;
          let dist = Math.hypot(dx, dy, dz);
          const minSafeDist = 1.8; // Å
          if (dist < minSafeDist && dist > 1e-4) {
            const overlap = minSafeDist - dist;
            const repForce = kRep * overlap;
            const rfx = (dx / dist) * repForce;
            const rfy = (dy / dist) * repForce;
            const rfz = (dz / dist) * repForce;

            if (isTarget(i)) { fx[i] -= rfx; fy[i] -= rfy; fz[i] -= rfz; }
            if (isTarget(j)) { fx[j] += rfx; fy[j] += rfy; fz[j] += rfz; }
          }
        }
      }

      // 更新座標（阻尼前進）
      const damping = Math.exp(-step / 50.0);
      for (let i = 0; i < n; i++) {
        if (!isTarget(i) || atoms[i].fixed) continue;
        const moveDist = Math.hypot(fx[i], fy[i], fz[i]) * dt * damping;
        const maxStep = 0.25;
        const scale = moveDist > maxStep ? maxStep / moveDist : 1.0;

        atoms[i].x += fx[i] * dt * damping * scale;
        atoms[i].y += fy[i] * dt * damping * scale;
        atoms[i].z += fz[i] * dt * damping * scale;
      }
    }

    structure.syncFractionalFromCartesian();
    structure.updateBondDistances();
  },

  /**
   * 取得單位正交向量
   */
  getPerpendicular(v) {
    let [x, y, z] = v;
    const len = Math.hypot(x, y, z);
    if (len < 1e-5) return [1, 0, 0];
    x /= len; y /= len; z /= len;

    let p = Math.abs(x) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    // Gram-Schmidt 投影
    const dot = p[0] * x + p[1] * y + p[2] * z;
    let rx = p[0] - dot * x;
    let ry = p[1] - dot * y;
    let rz = p[2] - dot * z;
    const rlen = Math.hypot(rx, ry, rz);
    return [rx / rlen, ry / rlen, rz / rlen];
  },

  /**
   * 自動加氫 (Add Hydrogens)：根據元素典型化學價態與鍵級補足氫原子
   */
  addHydrogens(structure, selectedOnly = false) {
    structure.detectBonds();
    const originalAtoms = [...structure.atoms];
    const n = originalAtoms.length;

    const standardValences = {
      'H': 1, 'He': 0, 'Li': 1, 'Be': 2, 'B': 3,
      'C': 4, 'N': 3, 'O': 2, 'F': 1, 'Ne': 0,
      'Na': 1, 'Mg': 2, 'Al': 3, 'Si': 4, 'P': 3,
      'S': 2, 'Cl': 1, 'Ar': 0, 'K': 1, 'Ca': 2,
      'Br': 1, 'I': 1, 'Ge': 4, 'As': 3, 'Se': 2
    };

    // 建立各原子之已用共價鍵級總和 (Sum of incident bond orders)
    const currentValences = new Int32Array(n);
    const neighbors = Array.from({ length: n }, () => []);
    for (const b of structure.bonds) {
      if (b.order === 'hb') continue;
      const ord = (typeof b.order === 'number') ? b.order : 1;
      currentValences[b.a] += ord;
      currentValences[b.b] += ord;
      neighbors[b.a].push(b.b);
      neighbors[b.b].push(b.a);
    }

    const newHydrogens = [];

    for (let i = 0; i < n; i++) {
      const atom = originalAtoms[i];
      if (selectedOnly && !atom.selected) continue;
      if (atom.element === 'H') continue;

      const sym = atom.element;
      const targetValence = standardValences[sym] !== undefined ? standardValences[sym] : (getElementInfo(sym).valence || 4);

      // 核心修復：需補氫數量 = 標準價態 - 當前已形成的總鍵級
      const hNeeded = targetValence - currentValences[i];
      if (hNeeded <= 0) continue;

      const bondDist = VSEPR.getIdealBondLength(atom.element, 'H');

      // 取得現有鍵向量（單位化）
      const existingVectors = [];
      for (const nbrIdx of neighbors[i]) {
        const nbr = originalAtoms[nbrIdx];
        let vx = nbr.x - atom.x;
        let vy = nbr.y - atom.y;
        let vz = nbr.z - atom.z;
        const len = Math.hypot(vx, vy, vz);
        if (len > 1e-4) {
          existingVectors.push([vx / len, vy / len, vz / len]);
        }
      }

      // 根據剩餘空位幾何產生新氫原子方向向量
      const newDirs = [];

      if (existingVectors.length === 0) {
        // 孤立中心原子
        if (hNeeded === 1) {
          newDirs.push([0, 0, 1]);
        } else if (hNeeded === 2) {
          // 水分子型 (104.5°)
          const half = (104.5 * Math.PI) / 360;
          newDirs.push([Math.sin(half), Math.cos(half), 0]);
          newDirs.push([-Math.sin(half), Math.cos(half), 0]);
        } else if (hNeeded === 3) {
          // 氨分子三角錐 (107°)
          newDirs.push([0, 0.96, 0.28]);
          newDirs.push([0.83, -0.48, 0.28]);
          newDirs.push([-0.83, -0.48, 0.28]);
        } else if (hNeeded >= 4) {
          // 甲烷正四面體 (109.5°)
          const s = 1.0 / Math.sqrt(3);
          newDirs.push([s, s, s]);
          newDirs.push([-s, -s, s]);
          newDirs.push([-s, s, -s]);
          newDirs.push([s, -s, -s]);
        }
      } else if (existingVectors.length === 1) {
        // 已有 1 個連鍵
        const v = existingVectors[0];
        const p1 = VSEPR.getPerpendicular(v);
        const p2 = [
          v[1] * p1[2] - v[2] * p1[1],
          v[2] * p1[0] - v[0] * p1[2],
          v[0] * p1[1] - v[1] * p1[0]
        ];

        if (hNeeded === 1) {
          // 若為醇羥基 O-H 或硫醇 S-H，保持 ~104.5° 彎曲幾何，亞胺 N 保持 ~120°，其餘情況（炔烴、直線）為 180°
          if (['O', 'S'].includes(atom.element)) {
            const angle = (104.5 * Math.PI) / 180;
            newDirs.push([
              Math.cos(angle) * v[0] + Math.sin(angle) * p1[0],
              Math.cos(angle) * v[1] + Math.sin(angle) * p1[1],
              Math.cos(angle) * v[2] + Math.sin(angle) * p1[2]
            ]);
          } else if (['N'].includes(atom.element)) {
            const angle = (120 * Math.PI) / 180;
            newDirs.push([
              Math.cos(angle) * v[0] + Math.sin(angle) * p1[0],
              Math.cos(angle) * v[1] + Math.sin(angle) * p1[1],
              Math.cos(angle) * v[2] + Math.sin(angle) * p1[2]
            ]);
          } else {
            newDirs.push([-v[0], -v[1], -v[2]]);
          }
        } else if (hNeeded === 2) {
          // 例如甲醛類或二級胺 (120°)
          const angle = (120 * Math.PI) / 180;
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          newDirs.push([
            cosA * v[0] + sinA * p1[0],
            cosA * v[1] + sinA * p1[1],
            cosA * v[2] + sinA * p1[2]
          ]);
          newDirs.push([
            cosA * v[0] - sinA * p1[0],
            cosA * v[1] - sinA * p1[1],
            cosA * v[2] - sinA * p1[2]
          ]);
        } else if (hNeeded >= 3) {
          // 甲基型 (四面體對稱延伸 109.47°)
          const cosTet = -1 / 3;
          const sinTet = Math.sqrt(1 - cosTet * cosTet);
          for (let k = 0; k < 3; k++) {
            const phi = (k * 2 * Math.PI) / 3;
            const cp = Math.cos(phi);
            const sp = Math.sin(phi);
            newDirs.push([
              cosTet * v[0] + sinTet * (cp * p1[0] + sp * p2[0]),
              cosTet * v[1] + sinTet * (cp * p1[1] + sp * p2[1]),
              cosTet * v[2] + sinTet * (cp * p1[2] + sp * p2[2])
            ]);
          }
        }
      } else if (existingVectors.length === 2) {
        // 已有 2 個連鍵
        const v1 = existingVectors[0];
        const v2 = existingVectors[1];
        // 反平分向量
        let bisect = [-(v1[0] + v2[0]), -(v1[1] + v2[1]), -(v1[2] + v2[2])];
        let blen = Math.hypot(bisect[0], bisect[1], bisect[2]);
        if (blen < 1e-4) bisect = VSEPR.getPerpendicular(v1);
        else { bisect[0] /= blen; bisect[1] /= blen; bisect[2] /= blen; }

        if (hNeeded === 1) {
          newDirs.push(bisect);
        } else if (hNeeded === 2) {
          // 四面體另外兩個方向（垂直於 bisect 與 (v1-v2) 的平面）
          const normal = [
            v1[1] * v2[2] - v1[2] * v2[1],
            v1[2] * v2[0] - v1[0] * v2[2],
            v1[0] * v2[1] - v1[1] * v2[0]
          ];
          const nlen = Math.hypot(normal[0], normal[1], normal[2]);
          if (nlen > 1e-4) {
            normal[0] /= nlen; normal[1] /= nlen; normal[2] /= nlen;
            const halfAngle = (109.5 * Math.PI) / 360;
            const cosH = Math.cos(halfAngle);
            const sinH = Math.sin(halfAngle);
            newDirs.push([
              cosH * bisect[0] + sinH * normal[0],
              cosH * bisect[1] + sinH * normal[1],
              cosH * bisect[2] + sinH * normal[2]
            ]);
            newDirs.push([
              cosH * bisect[0] - sinH * normal[0],
              cosH * bisect[1] - sinH * normal[1],
              cosH * bisect[2] - sinH * normal[2]
            ]);
          } else {
            newDirs.push(bisect);
          }
        }
      } else if (existingVectors.length === 3) {
        // 已有 3 個連鍵，補第 4 個 (反三向量和)
        let sumX = -(existingVectors[0][0] + existingVectors[1][0] + existingVectors[2][0]);
        let sumY = -(existingVectors[0][1] + existingVectors[1][1] + existingVectors[2][1]);
        let sumZ = -(existingVectors[0][2] + existingVectors[1][2] + existingVectors[2][2]);
        const slen = Math.hypot(sumX, sumY, sumZ);
        if (slen > 1e-4) {
          newDirs.push([sumX / slen, sumY / slen, sumZ / slen]);
        } else {
          newDirs.push([0, 0, 1]);
        }
      }

      // 生成氫原子座標
      for (const d of newDirs) {
        newHydrogens.push({
          element: 'H',
          x: atom.x + d[0] * bondDist,
          y: atom.y + d[1] * bondDist,
          z: atom.z + d[2] * bondDist
        });
      }
    }

    // 將新氫原子加入結構
    for (const h of newHydrogens) {
      structure.addAtom(h.element, h.x, h.y, h.z);
    }
    structure.detectBonds();
  },

  /**
   * 去氫 (Remove Hydrogens)
   */
  removeHydrogens(structure, selectedOnly = false) {
    if (selectedOnly) {
      structure.atoms = structure.atoms.filter(a => !(a.element === 'H' && a.selected));
    } else {
      structure.atoms = structure.atoms.filter(a => a.element !== 'H');
    }
    structure.syncFractionalFromCartesian();
    structure.detectBonds();
  },

  /**
   * 針對單一特定原子進行局部自動補氫 (Saturate Single Atom with Hydrogens, GaussView Style)
   * 適用於：筆刷新增原子時自動飽和，或筆刷置換原子時自動修正其連接之氫原子
   * @param {Structure} structure 
   * @param {number} atomIndex 目標原子索引
   * @param {string} hybridMode 可選混成模式 ('sp3' | 'sp2' | 'sp' | 'sq_planar' | 'octahedral')
   */
  saturateAtom(structure, atomIndex, hybridMode = '') {
    if (atomIndex < 0 || atomIndex >= structure.atoms.length) return;
    structure.detectBonds();

    const targetAtom = structure.atoms[atomIndex];
    if (targetAtom.element === 'H') return;

    // 1. 找出與 targetAtom 相連的所有鄰居
    const connectedHydrogens = [];

    for (const b of structure.bonds) {
      let nbr = -1;
      if (b.a === atomIndex) nbr = b.b;
      else if (b.b === atomIndex) nbr = b.a;

      if (nbr !== -1 && structure.atoms[nbr].element === 'H') {
        connectedHydrogens.push(nbr);
      }
    }

    // 2. 若該原子上已經連有舊氫原子，先予以清理以重新依新元素/混成飽和
    if (connectedHydrogens.length > 0) {
      const hSet = new Set(connectedHydrogens);
      let newTargetIndex = atomIndex;
      const remainingAtoms = [];
      for (let i = 0; i < structure.atoms.length; i++) {
        if (!hSet.has(i)) {
          remainingAtoms.push(structure.atoms[i]);
        } else if (i < atomIndex) {
          newTargetIndex--;
        }
      }
      structure.atoms = remainingAtoms;
      atomIndex = newTargetIndex;
      structure.detectBonds();
    }

    const atom = structure.atoms[atomIndex];
    const elemInfo = getElementInfo(atom.element);

    const standardValences = {
      'H': 1, 'He': 0, 'Li': 1, 'Be': 2, 'B': 3,
      'C': 4, 'N': 3, 'O': 2, 'F': 1, 'Ne': 0,
      'Na': 1, 'Mg': 2, 'Al': 3, 'Si': 4, 'P': 3,
      'S': 2, 'Cl': 1, 'Ar': 0, 'K': 1, 'Ca': 2,
      'Br': 1, 'I': 1, 'Ge': 4, 'As': 3, 'Se': 2
    };

    // 3. 判定目標價態 / 配位數 (Target Valence / Coordination)
    let targetValence = standardValences[atom.element] !== undefined ? standardValences[atom.element] : (elemInfo.valence || 4);
    if (hybridMode === 'sp3') targetValence = 4;
    else if (hybridMode === 'sp2') targetValence = 3;
    else if (hybridMode === 'sp') targetValence = 2;
    else if (hybridMode === 'octahedral') targetValence = 6;
    else if (hybridMode === 'sq_planar') targetValence = 4;

    // 計算當前連接的重原子成鍵總鍵級 (Sum of bond orders with heavy atoms)
    let currentValence = 0;
    const currentHeavy = [];
    for (const b of structure.bonds) {
      if (b.order === 'hb') continue;
      let nbr = -1;
      if (b.a === atomIndex) nbr = b.b;
      else if (b.b === atomIndex) nbr = b.a;
      if (nbr !== -1 && structure.atoms[nbr].element !== 'H') {
        currentHeavy.push(structure.atoms[nbr]);
        const ord = (typeof b.order === 'number') ? b.order : 1;
        currentValence += ord;
      }
    }

    const hNeeded = targetValence - currentValence;
    if (hNeeded <= 0) {
      structure.syncFractionalFromCartesian();
      structure.detectBonds();
      return;
    }

    const bondDist = VSEPR.getIdealBondLength(atom.element, 'H');

    // 4. 取得現有重原子成鍵向量
    const existingVectors = [];
    for (const nbr of currentHeavy) {
      let vx = nbr.x - atom.x;
      let vy = nbr.y - atom.y;
      let vz = nbr.z - atom.z;
      const len = Math.hypot(vx, vy, vz);
      if (len > 1e-4) {
        existingVectors.push([vx / len, vy / len, vz / len]);
      }
    }

    const newDirs = [];

    // 5. 按照 VSEPR 空間幾何分配新氫原子方向向量
    if (existingVectors.length === 0) {
      // 孤立中心原子
      if (hNeeded === 1) {
        newDirs.push([0, 0, 1]);
      } else if (hNeeded === 2) {
        const half = (104.5 * Math.PI) / 360;
        newDirs.push([Math.sin(half), Math.cos(half), 0]);
        newDirs.push([-Math.sin(half), Math.cos(half), 0]);
      } else if (hNeeded === 3) {
        newDirs.push([0, 0.96, 0.28]);
        newDirs.push([0.83, -0.48, 0.28]);
        newDirs.push([-0.83, -0.48, 0.28]);
      } else if (hNeeded >= 4) {
        const s = 1.0 / Math.sqrt(3);
        newDirs.push([s, s, s]);
        newDirs.push([-s, -s, s]);
        newDirs.push([-s, s, -s]);
        newDirs.push([s, -s, -s]);
      }
    } else if (existingVectors.length === 1) {
      const v = existingVectors[0];
      const p1 = VSEPR.getPerpendicular(v);
      const p2 = [
        v[1] * p1[2] - v[2] * p1[1],
        v[2] * p1[0] - v[0] * p1[2],
        v[0] * p1[1] - v[1] * p1[0]
      ];

      if (hNeeded === 1) {
        if (['O', 'S'].includes(atom.element)) {
          const angle = (104.5 * Math.PI) / 180;
          newDirs.push([
            Math.cos(angle) * v[0] + Math.sin(angle) * p1[0],
            Math.cos(angle) * v[1] + Math.sin(angle) * p1[1],
            Math.cos(angle) * v[2] + Math.sin(angle) * p1[2]
          ]);
        } else if (['N'].includes(atom.element)) {
          const angle = (120 * Math.PI) / 180;
          newDirs.push([
            Math.cos(angle) * v[0] + Math.sin(angle) * p1[0],
            Math.cos(angle) * v[1] + Math.sin(angle) * p1[1],
            Math.cos(angle) * v[2] + Math.sin(angle) * p1[2]
          ]);
        } else {
          newDirs.push([-v[0], -v[1], -v[2]]);
        }
      } else if (hNeeded === 2) {
        const angle = (120 * Math.PI) / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        newDirs.push([cosA * v[0] + sinA * p1[0], cosA * v[1] + sinA * p1[1], cosA * v[2] + sinA * p1[2]]);
        newDirs.push([cosA * v[0] - sinA * p1[0], cosA * v[1] - sinA * p1[1], cosA * v[2] - sinA * p1[2]]);
      } else if (hNeeded >= 3) {
        const cosTetra = -1.0 / 3.0; // 109.47°
        const sinTetra = Math.sqrt(8.0 / 9.0);
        for (let k = 0; k < 3; k++) {
          const phi = (k * 2 * Math.PI) / 3;
          newDirs.push([
            cosTetra * v[0] + sinTetra * (Math.cos(phi) * p1[0] + Math.sin(phi) * p2[0]),
            cosTetra * v[1] + sinTetra * (Math.cos(phi) * p1[1] + Math.sin(phi) * p2[1]),
            cosTetra * v[2] + sinTetra * (Math.cos(phi) * p1[2] + Math.sin(phi) * p2[2])
          ]);
        }
      }
    } else if (existingVectors.length === 2) {
      const v1 = existingVectors[0];
      const v2 = existingVectors[1];
      const bisect = [-(v1[0] + v2[0]), -(v1[1] + v2[1]), -(v1[2] + v2[2])];
      const blen = Math.hypot(bisect[0], bisect[1], bisect[2]);

      if (blen > 1e-4) {
        bisect[0] /= blen; bisect[1] /= blen; bisect[2] /= blen;
      } else {
        const perp = VSEPR.getPerpendicular(v1);
        bisect[0] = perp[0]; bisect[1] = perp[1]; bisect[2] = perp[2];
      }

      if (hNeeded === 1) {
        newDirs.push(bisect);
      } else if (hNeeded >= 2) {
        const normal = [
          v1[1] * v2[2] - v1[2] * v2[1],
          v1[2] * v2[0] - v1[0] * v2[2],
          v1[0] * v2[1] - v1[1] * v2[0]
        ];
        const nlen = Math.hypot(normal[0], normal[1], normal[2]);
        if (nlen > 1e-4) {
          normal[0] /= nlen; normal[1] /= nlen; normal[2] /= nlen;
          const halfAngle = (109.5 * Math.PI) / 360;
          const cosH = Math.cos(halfAngle);
          const sinH = Math.sin(halfAngle);
          newDirs.push([
            cosH * bisect[0] + sinH * normal[0],
            cosH * bisect[1] + sinH * normal[1],
            cosH * bisect[2] + sinH * normal[2]
          ]);
          newDirs.push([
            cosH * bisect[0] - sinH * normal[0],
            cosH * bisect[1] - sinH * normal[1],
            cosH * bisect[2] - sinH * normal[2]
          ]);
        } else {
          newDirs.push(bisect);
        }
      }
    } else if (existingVectors.length === 3) {
      let sumX = -(existingVectors[0][0] + existingVectors[1][0] + existingVectors[2][0]);
      let sumY = -(existingVectors[0][1] + existingVectors[1][1] + existingVectors[2][1]);
      let sumZ = -(existingVectors[0][2] + existingVectors[1][2] + existingVectors[2][2]);
      const slen = Math.hypot(sumX, sumY, sumZ);
      if (slen > 1e-4) {
        newDirs.push([sumX / slen, sumY / slen, sumZ / slen]);
      } else {
        newDirs.push([0, 0, 1]);
      }
    }

    // 6. 新增氫原子並同步檢測成鍵
    for (let k = 0; k < Math.min(hNeeded, newDirs.length); k++) {
      const d = newDirs[k];
      structure.addAtom('H', atom.x + d[0] * bondDist, atom.y + d[1] * bondDist, atom.z + d[2] * bondDist);
    }

    structure.syncFractionalFromCartesian();
    structure.detectBonds();
  },

  /**
   * GaussView 風格片段接枝 / 混成延伸 (Attach Fragment on Hydrogen, GaussView Style)
   * 當使用者在筆刷模式下點選氫原子時，以該價鍵為生長方向，
   * 依據共價單鍵理想鍵長將氫原子延伸並替換為新重原子，
   * 同時依混成狀態以交叉式 (Staggered) 立體構型補足新氫原子，保證碳鏈鋸齒狀自然延伸，絕不產生自交環狀錯誤鍵。
   * @param {Structure} structure
   * @param {number} hIndex 點選之氫原子索引
   * @param {string} newElement 目標接枝元素 (例如 'C', 'N', 'O', 'F')
   * @param {string} hybridMode 混成模式 (例如 'sp3', 'sp2', 'sp')
   */
  attachFragment(structure, hIndex, newElement = 'C', hybridMode = 'sp3') {
    if (hIndex < 0 || hIndex >= structure.atoms.length) return;
    const hAtom = structure.atoms[hIndex];
    if (hAtom.element !== 'H') {
      // 若點選的不是氫原子，回退至原位元素替換
      hAtom.element = newElement;
      this.saturateAtom(structure, hIndex, hybridMode);
      return;
    }

    structure.detectBonds();

    // 1. 尋找與該氫原子相連的母體重原子 (Parent Atom)
    let parentIdx = -1;
    for (const b of structure.bonds) {
      if (b.order === 'hb') continue;
      if (b.a === hIndex) { parentIdx = b.b; break; }
      else if (b.b === hIndex) { parentIdx = b.a; break; }
    }

    // 若未成鍵，則以最近距離尋找母體原子
    if (parentIdx === -1) {
      let minDist = Infinity;
      for (let i = 0; i < structure.atoms.length; i++) {
        if (i === hIndex) continue;
        const a = structure.atoms[i];
        const d = Math.hypot(a.x - hAtom.x, a.y - hAtom.y, a.z - hAtom.z);
        if (d < minDist && d <= 1.8) {
          minDist = d;
          parentIdx = i;
        }
      }
    }

    if (parentIdx === -1) {
      // 孤立氫原子：直接原地替換
      hAtom.element = newElement;
      this.saturateAtom(structure, hIndex, hybridMode);
      return;
    }

    const parentAtom = structure.atoms[parentIdx];

    // 2. 計算由母體原子指向氫原子的方向單位向量 u
    let ux = hAtom.x - parentAtom.x;
    let uy = hAtom.y - parentAtom.y;
    let uz = hAtom.z - parentAtom.z;
    const uLen = Math.hypot(ux, uy, uz);
    if (uLen < 1e-4) {
      ux = 0; uy = 0; uz = 1;
    } else {
      ux /= uLen; uy /= uLen; uz /= uLen;
    }
    const u = [ux, uy, uz];

    // 3. 計算母體原子與新元素之間的理想共價單鍵鍵長 (例如 C-C 為 1.54 Å)
    const idealBondDist = VSEPR.getIdealBondLength(parentAtom.element, newElement);

    // 4. 將該氫原子移動至理想單鍵位置，並更新元素為新元素 (成為新重原子)
    hAtom.element = newElement;
    hAtom.x = parentAtom.x + u[0] * idealBondDist;
    hAtom.y = parentAtom.y + u[1] * idealBondDist;
    hAtom.z = parentAtom.z + u[2] * idealBondDist;
    const newAtomIdx = hIndex;

    // 5. 建立與母體原子現存取代基相互對齊的參考正交基 (以確保交叉式 Staggered 構型)
    // 尋找母體原子的其他鄰居 (排除新重原子 newAtomIdx)
    let refNbrIdx = -1;
    for (const b of structure.bonds) {
      if (b.order === 'hb') continue;
      const nbr = (b.a === parentIdx) ? b.b : ((b.b === parentIdx) ? b.a : -1);
      if (nbr !== -1 && nbr !== newAtomIdx) {
        // 優先選取重原子鄰居以確保主碳鏈鋸齒平面的延伸
        if (refNbrIdx === -1 || structure.atoms[nbr].element !== 'H') {
          refNbrIdx = nbr;
          if (structure.atoms[nbr].element !== 'H') break;
        }
      }
    }

    let p1;
    if (refNbrIdx !== -1) {
      const refAtom = structure.atoms[refNbrIdx];
      const vx = refAtom.x - parentAtom.x;
      const vy = refAtom.y - parentAtom.y;
      const vz = refAtom.z - parentAtom.z;
      // 投影至垂直於鍵軸 u 的平面
      const dot = vx * u[0] + vy * u[1] + vz * u[2];
      const projX = vx - dot * u[0];
      const projY = vy - dot * u[1];
      const projZ = vz - dot * u[2];
      const projLen = Math.hypot(projX, projY, projZ);
      if (projLen > 1e-4) {
        p1 = [projX / projLen, projY / projLen, projZ / projLen];
      } else {
        p1 = VSEPR.getPerpendicular(u);
      }
    } else {
      p1 = VSEPR.getPerpendicular(u);
    }

    // p2 = u × p1
    const p2 = [
      u[1] * p1[2] - u[2] * p1[1],
      u[2] * p1[0] - u[0] * p1[2],
      u[0] * p1[1] - u[1] * p1[0]
    ];

    // 6. 判定新原子所需的新生氫原子數量與幾何方向
    const standardValences = {
      'H': 1, 'He': 0, 'Li': 1, 'Be': 2, 'B': 3,
      'C': 4, 'N': 3, 'O': 2, 'F': 1, 'Ne': 0,
      'Na': 1, 'Mg': 2, 'Al': 3, 'Si': 4, 'P': 3,
      'S': 2, 'Cl': 1, 'Ar': 0, 'K': 1, 'Ca': 2,
      'Br': 1, 'I': 1, 'Ge': 4, 'As': 3, 'Se': 2
    };

    let targetValence = standardValences[newElement] !== undefined ? standardValences[newElement] : 4;
    if (hybridMode === 'sp3' || hybridMode === 'sp3_tetrahedral') targetValence = 4;
    else if (hybridMode === 'sp2' || hybridMode === 'sp2_planar') targetValence = 3;
    else if (hybridMode === 'sp' || hybridMode === 'sp_linear') targetValence = 2;
    else if (hybridMode === 'sp3_bent') targetValence = 2;
    else if (hybridMode === 'sp3_pyramidal') targetValence = 3;
    else if (hybridMode === 'terminal') targetValence = 1;

    // 新原子已與母體原子形成 1 根單鍵，故需補氫數為:
    const hNeeded = targetValence - 1;
    const newDirs = [];

    if (hNeeded === 3) {
      // 正四面體甲基型 (sp3 -CH3)：相對於母體鄰居 p1 採 180° 反式 (Anti) 與 ±60° 左右交叉式 (Gauche)
      // 夾角與鍵軸反向向量 -u 成 109.47° (即與 u 成 70.53°)
      const cosA = 1.0 / 3.0;
      const sinA = Math.sqrt(8.0 / 9.0);
      // 第一個氫置於反式 (phi = pi，即 -p1 方向)，使後續點擊時自然沿碳鏈平面鋸齒狀延伸
      const phis = [Math.PI, Math.PI / 3.0, -Math.PI / 3.0];
      for (const phi of phis) {
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        newDirs.push([
          cosA * u[0] + sinA * (cp * p1[0] + sp * p2[0]),
          cosA * u[1] + sinA * (cp * p1[1] + sp * p2[1]),
          cosA * u[2] + sinA * (cp * p1[2] + sp * p2[2])
        ]);
      }
    } else if (hNeeded === 2) {
      // 2 配位：例如 -NH2 (三角錐) 或 =CH2 (平面三角形)
      if (hybridMode.startsWith('sp2')) {
        // 平面 120° (與 u 成 60°)
        const cosA = 0.5;
        const sinA = Math.sqrt(0.75);
        newDirs.push([
          cosA * u[0] + sinA * p1[0],
          cosA * u[1] + sinA * p1[1],
          cosA * u[2] + sinA * p1[2]
        ]);
        newDirs.push([
          cosA * u[0] - sinA * p1[0],
          cosA * u[1] - sinA * p1[1],
          cosA * u[2] - sinA * p1[2]
        ]);
      } else {
        // 三角錐 / 角形：夾角 ~107°~109.5°，置於交叉對稱兩側
        const cosA = 1.0 / 3.0;
        const sinA = Math.sqrt(8.0 / 9.0);
        const phis = [Math.PI / 3.0, -Math.PI / 3.0];
        for (const phi of phis) {
          const cp = Math.cos(phi);
          const sp = Math.sin(phi);
          newDirs.push([
            cosA * u[0] + sinA * (cp * p1[0] + sp * p2[0]),
            cosA * u[1] + sinA * (cp * p1[1] + sp * p2[1]),
            cosA * u[2] + sinA * (cp * p1[2] + sp * p2[2])
          ]);
        }
      }
    } else if (hNeeded === 1) {
      // 1 配位：例如醇羥基 -OH (104.5°) 或炔基 -C#CH (180°)
      if (hybridMode.startsWith('sp') && !hybridMode.startsWith('sp3')) {
        // 直線形 180°
        newDirs.push([u[0], u[1], u[2]]);
      } else {
        // 彎曲形 104.5° (與 u 夾角 75.5°)，置於反式方向 (-p1)
        const angle = (75.5 * Math.PI) / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        newDirs.push([
          cosA * u[0] - sinA * p1[0],
          cosA * u[1] - sinA * p1[1],
          cosA * u[2] - sinA * p1[2]
        ]);
      }
    }

    // 7. 將新氫原子添加至結構
    const hBondDist = VSEPR.getIdealBondLength(newElement, 'H');
    for (const d of newDirs) {
      structure.addAtom('H', hAtom.x + d[0] * hBondDist, hAtom.y + d[1] * hBondDist, hAtom.z + d[2] * hBondDist);
    }

    structure.syncFractionalFromCartesian();
    structure.detectBonds();
  },

  /**
   * GaussView 風格單一原子純替換 (1-to-1 Atom Substitution)
   * 替換單一原子元素，保持既有分子鍵結拓撲，不自動加氫或接枝片段
   * 自動沿鍵軸向調整理想共價鍵長 (例如 CH4 中將 H 替換為 F，自動將 C-H 1.09 Å 調整為 C-F 1.33~1.35 Å)
   * @param {Structure} structure
   * @param {number} atomIndex 目標原子索引
   * @param {string} newElement 新元素符號 (例如 'F', 'Cl', 'O', 'N', 'C', 'Si')
   * @returns {boolean} 是否成功替換
   */
  replaceSingleAtom(structure, atomIndex, newElement) {
    if (!structure || atomIndex < 0 || atomIndex >= structure.atoms.length) return false;
    const target = structure.atoms[atomIndex];
    if (!target) return false;

    structure.detectBonds();

    // 尋找與該原子鍵結的所有鄰居
    const nbrs = [];
    for (const b of structure.bonds) {
      if (b.order === 'hb') continue;
      if (b.a === atomIndex) nbrs.push(b.b);
      else if (b.b === atomIndex) nbrs.push(b.a);
    }

    // 若未成鍵，嘗試尋找最近鄰原子 (Cutoff 2.2 Å)
    if (nbrs.length === 0) {
      let nearestIdx = -1;
      let nearestDist = Infinity;
      for (let i = 0; i < structure.atoms.length; i++) {
        if (i === atomIndex) continue;
        const a = structure.atoms[i];
        const d = Math.hypot(a.x - target.x, a.y - target.y, a.z - target.z);
        if (d < nearestDist && d <= 2.2) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      if (nearestIdx !== -1) {
        nbrs.push(nearestIdx);
      }
    }

    if (nbrs.length === 1) {
      // 單配位/末端原子 (例如 CH4 上的 H 換成 F, 或苯環上的 H 換成 Br)
      const parent = structure.atoms[nbrs[0]];
      let ux = target.x - parent.x;
      let uy = target.y - parent.y;
      let uz = target.z - parent.z;
      const uLen = Math.hypot(ux, uy, uz);
      if (uLen < 1e-4) {
        ux = 0; uy = 0; uz = 1;
      } else {
        ux /= uLen; uy /= uLen; uz /= uLen;
      }

      const idealDist = VSEPR.getIdealBondLength(parent.element, newElement);
      target.x = parent.x + ux * idealDist;
      target.y = parent.y + uy * idealDist;
      target.z = parent.z + uz * idealDist;
      target.element = newElement;
    } else if (nbrs.length > 1) {
      // 多配位原子 (例如將中心 C 替換為 Si)
      target.element = newElement;
      // 若鄰居中有氫原子，微調氫原子距離以符合新元素的理想鍵長
      for (const nbrIdx of nbrs) {
        const nbrAtom = structure.atoms[nbrIdx];
        if (nbrAtom.element === 'H') {
          let vx = nbrAtom.x - target.x;
          let vy = nbrAtom.y - target.y;
          let vz = nbrAtom.z - target.z;
          const vLen = Math.hypot(vx, vy, vz);
          const idealH = VSEPR.getIdealBondLength(newElement, 'H');
          if (vLen > 1e-4) {
            nbrAtom.x = target.x + (vx / vLen) * idealH;
            nbrAtom.y = target.y + (vy / vLen) * idealH;
            nbrAtom.z = target.z + (vz / vLen) * idealH;
          }
        }
      }
    } else {
      // 孤立原子
      target.element = newElement;
    }

    structure.syncFractionalFromCartesian();
    structure.detectBonds();
    return true;
  }
};

