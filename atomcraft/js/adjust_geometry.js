/**
 * adjust_geometry.js - GaussView 幾何微調引擎 (Geometry Adjustment Engine)
 * 專門精確調節：
 * 1. 鍵長 (Bond Length): 支援 Fixed / Move Atom / Move Group (兩端可自由指定)
 * 2. 鍵角 (Bond Angle): 支援 Fixed / Rotate Atom / Rotate Group (兩端可自由指定，以頂點為轉軸)
 * 3. 二面角 (Dihedral Angle): 支援 Fixed / Rotate Group (以中鍵為轉軸)
 * 具備防爆發、防無窮漂移與至少保留一側活動的防護限制
 */

const GeometryAdjuster = {
  /**
   * 計算兩原子間距離 (Å)
   */
  getBondLength(structure, idx1, idx2) {
    const a = structure.atoms[idx1];
    const b = structure.atoms[idx2];
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  },

  /**
   * 調整鍵長 (GaussView 風格多模式)
   * @param {Structure} structure 
   * @param {number} idx1 原子 1 索引
   * @param {number} idx2 原子 2 索引
   * @param {number} targetLength 目標鍵長 (Å)
   * @param {'fixed' | 'atom' | 'group'} mode1 原子 1 移動模式
   * @param {'fixed' | 'atom' | 'group'} mode2 原子 2 移動模式
   */
  setBondLength(structure, idx1, idx2, targetLength, mode1 = 'fixed', mode2 = 'group') {
    targetLength = Math.max(0.1, Math.min(10.0, Number(targetLength) || 1.5));
    const atom1 = structure.atoms[idx1];
    const atom2 = structure.atoms[idx2];
    if (!atom1 || !atom2) return;

    // 防止兩端皆為固定 (至少需有一端活動)
    if (mode1 === 'fixed' && mode2 === 'fixed') {
      mode2 = 'group';
    }

    const vx = atom2.x - atom1.x;
    const vy = atom2.y - atom1.y;
    const vz = atom2.z - atom1.z;
    const currentLen = Math.hypot(vx, vy, vz);
    if (currentLen < 1e-4) return;

    const delta = targetLength - currentLen;
    if (Math.abs(delta) < 1e-5) return;

    const dirX = vx / currentLen;
    const dirY = vy / currentLen;
    const dirZ = vz / currentLen;

    if (mode1 === 'fixed') {
      // 僅移動 atom2 端
      const group2 = mode2 === 'atom' ? [idx2] : this.getSubgroup(structure, idx1, idx2);
      for (const i of group2) {
        if (i === idx1) continue;
        const a = structure.atoms[i];
        if (a) { a.x += dirX * delta; a.y += dirY * delta; a.z += dirZ * delta; }
      }
    } else if (mode2 === 'fixed') {
      // 僅移動 atom1 端 (反向移動)
      const group1 = mode1 === 'atom' ? [idx1] : this.getSubgroup(structure, idx2, idx1);
      for (const i of group1) {
        if (i === idx2) continue;
        const a = structure.atoms[i];
        if (a) { a.x -= dirX * delta; a.y -= dirY * delta; a.z -= dirZ * delta; }
      }
    } else {
      // 兩端對稱各分擔一半位移
      const halfDelta = delta * 0.5;
      const group1 = mode1 === 'atom' ? [idx1] : this.getSubgroup(structure, idx2, idx1);
      for (const i of group1) {
        if (i === idx2) continue;
        const a = structure.atoms[i];
        if (a) { a.x -= dirX * halfDelta; a.y -= dirY * halfDelta; a.z -= dirZ * halfDelta; }
      }
      const group2 = mode2 === 'atom' ? [idx2] : this.getSubgroup(structure, idx1, idx2);
      for (const i of group2) {
        if (i === idx1) continue;
        const a = structure.atoms[i];
        if (a) { a.x += dirX * halfDelta; a.y += dirY * halfDelta; a.z += dirZ * halfDelta; }
      }
    }

    structure.syncFractionalFromCartesian();
    structure.updateBondDistances();
  },

  /**
   * 計算 3 原子鍵角 (以 idx2 為頂點，角度制)
   */
  getBondAngle(structure, idx1, idx2, idx3) {
    const a = structure.atoms[idx1];
    const b = structure.atoms[idx2];
    const c = structure.atoms[idx3];
    if (!a || !b || !c) return 0;

    const v1 = [a.x - b.x, a.y - b.y, a.z - b.z];
    const v2 = [c.x - b.x, c.y - b.y, c.z - b.z];
    const d1 = Math.hypot(...v1);
    const d2 = Math.hypot(...v2);
    if (d1 < 1e-4 || d2 < 1e-4) return 0;

    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const cosTheta = Math.max(-1, Math.min(1, dot / (d1 * d2)));
    return Math.acos(cosTheta) * (180 / Math.PI);
  },

  /**
   * 調整鍵角 (GaussView 風格多模式)
   * @param {Structure} structure 
   * @param {number} idx1 原子 1 索引
   * @param {number} idx2 頂點原子索引 (轉折軸中心)
   * @param {number} idx3 原子 3 索引
   * @param {number} targetAngleDeg 目標鍵角 (0° ~ 180°)
   * @param {'fixed' | 'atom' | 'group'} mode1 原子 1 側旋轉模式
   * @param {'fixed' | 'atom' | 'group'} mode3 原子 3 側旋轉模式
   */
  setBondAngle(structure, idx1, idx2, idx3, targetAngleDeg, mode1 = 'fixed', mode3 = 'group') {
    targetAngleDeg = Math.max(0.1, Math.min(179.9, Number(targetAngleDeg) || 109.5));
    const a = structure.atoms[idx1];
    const b = structure.atoms[idx2];
    const c = structure.atoms[idx3];
    if (!a || !b || !c) return;

    if (mode1 === 'fixed' && mode3 === 'fixed') {
      mode3 = 'group';
    }

    const v1 = [a.x - b.x, a.y - b.y, a.z - b.z];
    const v2 = [c.x - b.x, c.y - b.y, c.z - b.z];
    const d1 = Math.hypot(...v1);
    const d2 = Math.hypot(...v2);
    if (d1 < 1e-4 || d2 < 1e-4) return;

    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    const currentAngle = Math.acos(Math.max(-1, Math.min(1, dot / (d1 * d2)))) * (180 / Math.PI);
    const deltaAngleDeg = targetAngleDeg - currentAngle;
    if (Math.abs(deltaAngleDeg) < 1e-4) return;
    const deltaRad = (deltaAngleDeg * Math.PI) / 180;

    // 計算旋轉法向量 (v1 x v2)
    let nx = v1[1] * v2[2] - v1[2] * v2[1];
    let ny = v1[2] * v2[0] - v1[0] * v2[2];
    let nz = v1[0] * v2[1] - v1[1] * v2[0];
    let nlen = Math.hypot(nx, ny, nz);

    if (nlen < 1e-4) {
      const perp = VSEPR.getPerpendicular(v1);
      nx = perp[0]; ny = perp[1]; nz = perp[2];
    } else {
      nx /= nlen; ny /= nlen; nz /= nlen;
    }

    const origin = [b.x, b.y, b.z];
    const axis = [nx, ny, nz];

    if (mode1 === 'fixed') {
      // 旋轉原子 3 側
      const group3 = mode3 === 'atom' ? [idx3] : this.getSubgroup(structure, idx2, idx3);
      this.rotateGroup(structure, group3, axis, deltaRad, origin);
    } else if (mode3 === 'fixed') {
      // 旋轉原子 1 側 (方向相反)
      const group1 = mode1 === 'atom' ? [idx1] : this.getSubgroup(structure, idx2, idx1);
      this.rotateGroup(structure, group1, axis, -deltaRad, origin);
    } else {
      // 兩側對稱旋轉
      const halfRad = deltaRad * 0.5;
      const group3 = mode3 === 'atom' ? [idx3] : this.getSubgroup(structure, idx2, idx3);
      this.rotateGroup(structure, group3, axis, halfRad, origin);
      const group1 = mode1 === 'atom' ? [idx1] : this.getSubgroup(structure, idx2, idx1);
      this.rotateGroup(structure, group1, axis, -halfRad, origin);
    }

    structure.syncFractionalFromCartesian();
    structure.updateBondDistances();
  },

  /**
   * 計算 4 原子二面角 (度, -180° ~ +180°)
   */
  getDihedralAngle(structure, idx1, idx2, idx3, idx4) {
    const p1 = structure.atoms[idx1];
    const p2 = structure.atoms[idx2];
    const p3 = structure.atoms[idx3];
    const p4 = structure.atoms[idx4];
    if (!p1 || !p2 || !p3 || !p4) return 0;

    const b1 = [p2.x - p1.x, p2.y - p1.y, p2.z - p1.z];
    const b2 = [p3.x - p2.x, p3.y - p2.y, p3.z - p2.z];
    const b3 = [p4.x - p3.x, p4.y - p3.y, p4.z - p3.z];

    const n1 = [b1[1]*b2[2] - b1[2]*b2[1], b1[2]*b2[0] - b1[0]*b2[2], b1[0]*b2[1] - b1[1]*b2[0]];
    const n2 = [b2[1]*b3[2] - b2[2]*b3[1], b2[2]*b3[0] - b2[0]*b3[2], b2[0]*b3[1] - b2[1]*b3[0]];

    const b2Len = Math.hypot(...b2);
    if (b2Len < 1e-4) return 0;
    const b2Unit = [b2[0] / b2Len, b2[1] / b2Len, b2[2] / b2Len];
    const m = [n1[1]*b2Unit[2] - n1[2]*b2Unit[1], n1[2]*b2Unit[0] - n1[0]*b2Unit[2], n1[0]*b2Unit[1] - n1[1]*b2Unit[0]];

    const x = n1[0]*n2[0] + n1[1]*n2[1] + n1[2]*n2[2];
    const y = m[0]*n2[0] + m[1]*n2[1] + m[2]*n2[2];
    return Math.atan2(y, x) * (180 / Math.PI);
  },

  /**
   * 調整二面角 (GaussView 風格多模式)
   * @param {Structure} structure 
   * @param {number} idx1 
   * @param {number} idx2 
   * @param {number} idx3 旋轉軸為 2 -> 3 鍵
   * @param {number} idx4 
   * @param {number} targetDihedralDeg 目標二面角 (-180° ~ +180°)
   * @param {'fixed' | 'group'} mode1 原子 1 側模式
   * @param {'fixed' | 'group'} mode4 原子 4 側模式
   */
  setDihedralAngle(structure, idx1, idx2, idx3, idx4, targetDihedralDeg, mode1 = 'fixed', mode4 = 'group') {
    const currentAngle = this.getDihedralAngle(structure, idx1, idx2, idx3, idx4);
    let deltaAngleDeg = targetDihedralDeg - currentAngle;
    while (deltaAngleDeg > 180) deltaAngleDeg -= 360;
    while (deltaAngleDeg < -180) deltaAngleDeg += 360;
    if (Math.abs(deltaAngleDeg) < 1e-4) return;
    const deltaRad = (deltaAngleDeg * Math.PI) / 180;

    if (mode1 === 'fixed' && mode4 === 'fixed') {
      mode4 = 'group';
    }

    const atom2 = structure.atoms[idx2];
    const atom3 = structure.atoms[idx3];
    const axis = [atom3.x - atom2.x, atom3.y - atom2.y, atom3.z - atom2.z];

    if (mode1 === 'fixed') {
      // 沿 2->3 軸旋轉 group4
      const origin4 = [atom3.x, atom3.y, atom3.z];
      const group4 = this.getSubgroup(structure, idx2, idx3);
      this.rotateGroup(structure, group4, axis, -deltaRad, origin4);
    } else if (mode4 === 'fixed') {
      // 旋轉 group1 (反向旋轉)
      const origin1 = [atom2.x, atom2.y, atom2.z];
      const group1 = this.getSubgroup(structure, idx3, idx2);
      this.rotateGroup(structure, group1, axis, deltaRad, origin1);
    } else {
      // 兩端對稱旋轉
      const halfRad = deltaRad * 0.5;
      const origin4 = [atom3.x, atom3.y, atom3.z];
      const group4 = this.getSubgroup(structure, idx2, idx3);
      this.rotateGroup(structure, group4, axis, -halfRad, origin4);

      const origin1 = [atom2.x, atom2.y, atom2.z];
      const group1 = this.getSubgroup(structure, idx3, idx2);
      this.rotateGroup(structure, group1, axis, halfRad, origin1);
    }

    structure.syncFractionalFromCartesian();
    structure.updateBondDistances();
  },

  /**
   * 斷開 idxA - idxB 的連線，取得 idxB 側的所有連通原子集合
   * (阻隔點防護：將 idxA 設為障礙點，在環狀分子中絕不繞回 idxA，避免整顆分子飛入無限遠)
   */
  getSubgroup(structure, idxA, idxB) {
    if (structure.bonds.length === 0) structure.detectBonds();
    const adj = Array.from({ length: structure.atoms.length }, () => []);
    for (const b of structure.bonds) {
      if ((b.a === idxA && b.b === idxB) || (b.a === idxB && b.b === idxA)) continue;
      adj[b.a].push(b.b);
      adj[b.b].push(b.a);
    }

    const visited = new Set();
    visited.add(idxA); // 將固定端 idxA 設為絕對阻隔障礙
    visited.add(idxB);

    const queue = [idxB];
    const group = [idxB];

    while (queue.length > 0) {
      const u = queue.shift();
      for (const v of adj[u]) {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
          group.push(v);
        }
      }
    }
    return group;
  },

  /**
   * 繞任意軸旋轉特定群組原子 (Rodrigues 公式)
   */
  rotateGroup(structure, atomIndices, axis, angleRad, origin) {
    const [ox, oy, oz] = origin;
    let [ux, uy, uz] = axis;
    const len = Math.hypot(ux, uy, uz);
    if (len < 1e-6) return;
    ux /= len; uy /= len; uz /= len;

    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);

    for (const idx of atomIndices) {
      const a = structure.atoms[idx];
      if (!a) continue;
      const px = a.x - ox;
      const py = a.y - oy;
      const pz = a.z - oz;

      const dot = px * ux + py * uy + pz * uz;
      const crossX = uy * pz - uz * py;
      const crossY = uz * px - ux * pz;
      const crossZ = ux * py - uy * px;

      a.x = ox + px * cosTheta + crossX * sinTheta + ux * dot * (1 - cosTheta);
      a.y = oy + py * cosTheta + crossY * sinTheta + uy * dot * (1 - cosTheta);
      a.z = oz + pz * cosTheta + crossZ * sinTheta + uz * dot * (1 - cosTheta);
    }
  }
};
