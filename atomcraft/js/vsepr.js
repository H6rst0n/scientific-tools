/**
 * vsepr.js - GaussView 風格 VSEPR 幾何整理與自動加氫工具 (VSEPR Geometric Clean 🧹)
 * 純幾何與彈簧力場放鬆演算法，微秒級完成結構修復與角度標準化
 */

const VSEPR = {
  /**
   * 取得理想鍵長 (Å)
   */
  getIdealBondLength(elemA, elemB) {
    const rA = getElementInfo(elemA).covRadius;
    const rB = getElementInfo(elemB).covRadius;
    return Math.max(0.6, rA + rB);
  },

  /**
   * 根據中心原子與配位數判定理想 VSEPR 目標幾何構型
   */
  getTargetGeometry(centerElem, neighborCount) {
    const info = getElementInfo(centerElem);
    const sym = info.symbol;

    if (neighborCount === 1) {
      return { type: 'single', angles: [] };
    }

    if (neighborCount === 2) {
      // 判斷直線 (180°) 或是角形 (104.5° ~ 120°)
      if (['Be', 'Hg', 'Zn', 'Cd'].includes(sym)) {
        return { type: 'linear', angle: 180 };
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
      if (['N', 'P', 'As'].includes(sym)) {
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
   * GaussView 掃把 (Clean 🧹)：快速整理分子幾何
   * 採用兩階段：1. 幾何投影校正  2. 輕量級彈簧梯度下降 (50 steps)
   */
  cleanGeometry(structure, selectedOnly = false) {
    if (structure.atoms.length === 0) return;

    // 若尚未偵測化學鍵，先以標準容許度偵測
    if (!structure.bonds || structure.bonds.length === 0) {
      structure.detectBonds(0.40);
    }
    // 若結構仍無化學鍵且有 2 個以上原子，使用寬鬆容許度偵測以抓取被拉伸變形的原子
    if (structure.bonds.length === 0 && structure.atoms.length >= 2) {
      structure.detectBonds(1.20);
    }

    const atoms = structure.atoms;
    const n = atoms.length;
    const isTarget = i => !selectedOnly || atoms[i].selected;

    // 建立鄰接表
    const neighbors = Array.from({ length: n }, () => []);
    for (const b of structure.bonds) {
      neighbors[b.a].push(b.b);
      neighbors[b.b].push(b.a);
    }

    // 彈性鬆弛模擬 (Spring & Repulsion Relaxation)
    const steps = 60;
    const dt = 0.08;
    const kB = 25.0; // 鍵長彈簧常數
    const kAngle = 15.0; // 鍵角恢復常數
    const kRep = 3.0; // 非成鍵排斥力常數

    for (let step = 0; step < steps; step++) {
      const fx = new Float64Array(n);
      const fy = new Float64Array(n);
      const fz = new Float64Array(n);

      // 1. 鍵長約束 (Bond Stretching)
      for (const b of structure.bonds) {
        const i = b.a;
        const j = b.b;
        const idealR = VSEPR.getIdealBondLength(atoms[i].element, atoms[j].element);

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
        const force = -kB * delta;
        const fx_ij = (dx / dist) * force;
        const fy_ij = (dy / dist) * force;
        const fz_ij = (dz / dist) * force;

        if (isTarget(i)) {
          fx[i] -= fx_ij;
          fy[i] -= fy_ij;
          fz[i] -= fz_ij;
        }
        if (isTarget(j)) {
          fx[j] += fx_ij;
          fy[j] += fy_ij;
          fz[j] += fz_ij;
        }
      }

      // 2. 鍵角約束 (Bond Angles via Target Geometry Repulsion)
      for (let c = 0; c < n; c++) {
        const nbrs = neighbors[c];
        if (nbrs.length < 2) continue;

        const geom = VSEPR.getTargetGeometry(atoms[c].element, nbrs.length);
        const targetDeg = geom.angle || (geom.type === 'octahedral' ? 90 : 109.47);
        const targetRad = (targetDeg * Math.PI) / 180;
        const cosTarget = Math.cos(targetRad);

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

            const cosTheta = (v1x * v2x + v1y * v2y + v1z * v2z) / (d1 * d2);
            const deltaCos = cosTheta - cosTarget; // 正值表示夾角過小，需互相推開

            const fMag = -kAngle * deltaCos;
            // 對 u 施加垂直於 v1 且朝向/遠離 v2 的力
            if (isTarget(u)) {
              fx[u] += (v2x / d2 - cosTheta * (v1x / d1)) * fMag / d1;
              fy[u] += (v2y / d2 - cosTheta * (v1y / d1)) * fMag / d1;
              fz[u] += (v2z / d2 - cosTheta * (v1z / d1)) * fMag / d1;
            }
            if (isTarget(w)) {
              fx[w] += (v1x / d1 - cosTheta * (v2x / d2)) * fMag / d2;
              fy[w] += (v1y / d1 - cosTheta * (v2y / d2)) * fMag / d2;
              fz[w] += (v1z / d1 - cosTheta * (v2z / d2)) * fMag / d2;
            }
          }
        }
      }

      // 3. 非鍵結原子間軟排斥 (Non-bonded Soft Repulsion 避免空間重疊)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (neighbors[i].includes(j)) continue; // 忽略直接成鍵者
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

            if (isTarget(i)) {
              fx[i] -= rfx; fy[i] -= rfy; fz[i] -= rfz;
            }
            if (isTarget(j)) {
              fx[j] += rfx; fy[j] += rfy; fz[j] += rfz;
            }
          }
        }
      }

      // 更新座標（阻尼前進）
      const damping = Math.exp(-step / 35.0);
      for (let i = 0; i < n; i++) {
        if (!isTarget(i) || atoms[i].fixed) continue;
        // 限制最大單步位移以防爆炸
        const moveDist = Math.hypot(fx[i], fy[i], fz[i]) * dt * damping;
        const maxStep = 0.25;
        const scale = moveDist > maxStep ? maxStep / moveDist : 1.0;

        atoms[i].x += fx[i] * dt * damping * scale;
        atoms[i].y += fy[i] * dt * damping * scale;
        atoms[i].z += fz[i] * dt * damping * scale;
      }
    }

    structure.syncFractionalFromCartesian();
    structure.detectBonds();
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
   * 自動加氫 (Add Hydrogens)：根據元素典型價態與幾何補足氫原子
   */
  addHydrogens(structure, selectedOnly = false) {
    structure.detectBonds();
    const originalAtoms = [...structure.atoms];
    const n = originalAtoms.length;

    // 建立成鍵計數
    const neighbors = Array.from({ length: n }, () => []);
    for (const b of structure.bonds) {
      neighbors[b.a].push(b.b);
      neighbors[b.b].push(b.a);
    }

    const newHydrogens = [];

    for (let i = 0; i < n; i++) {
      const atom = originalAtoms[i];
      if (selectedOnly && !atom.selected) continue;
      if (atom.element === 'H') continue;

      const info = getElementInfo(atom.element);
      const targetValence = info.valence || 4;
      const currentBonds = neighbors[i].length;
      const hNeeded = targetValence - currentBonds;

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
          // 氨分子三角錐
          newDirs.push([0, 0.96, 0.28]);
          newDirs.push([0.83, -0.48, 0.28]);
          newDirs.push([-0.83, -0.48, 0.28]);
        } else if (hNeeded === 4) {
          // 甲烷正四面體
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
        // 外積取得 p2
        const p2 = [
          v[1] * p1[2] - v[2] * p1[1],
          v[2] * p1[0] - v[0] * p1[2],
          v[0] * p1[1] - v[1] * p1[0]
        ];

        if (hNeeded === 1) {
          // 例如鹵素或直線/角形
          newDirs.push([-v[0], -v[1], -v[2]]);
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
        } else if (hNeeded === 3) {
          // 甲基型 (四面體對稱延伸)
          const cosTet = -1 / 3; // cos(109.47°)
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
  }
};
