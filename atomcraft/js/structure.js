/**
 * structure.js - 核心原子與晶胞資料結構 (Structure & Lattice Core)
 * 統一支援 0D 孤立分子與 1D/2D/3D 週期性晶體材料
 */

class Structure {
  constructor() {
    this.atoms = []; // [{ id, element, x, y, z, fx, fy, fz, selected, fixed }]
    this.cell = null; // 3x3 矩陣 [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] (Å)
    this.cellInv = null; // 晶格逆矩陣
    this.pbc = [false, false, false]; // 週期性邊界條件 [x, y, z]
    this.bonds = []; // 快取鍵結列表
    this.nextAtomId = 1;
    this.title = 'Untitled';
    this.charge = 0;
    this.multiplicity = 1;
  }

  /**
   * 清空結構
   */
  clear() {
    this.atoms = [];
    this.cell = null;
    this.cellInv = null;
    this.pbc = [false, false, false];
    this.bonds = [];
    this.nextAtomId = 1;
    this.title = 'Untitled';
    this.charge = 0;
    this.multiplicity = 1;
  }

  /**
   * 深拷貝目前結構（用於 Undo / Redo 歷史紀錄）
   */
  clone() {
    const copy = new Structure();
    copy.title = this.title;
    copy.charge = this.charge;
    copy.multiplicity = this.multiplicity;
    copy.nextAtomId = this.nextAtomId;
    copy.pbc = [...this.pbc];
    if (this.cell) {
      copy.cell = this.cell.map(row => [...row]);
      copy.updateCellInverse();
    }
    copy.atoms = this.atoms.map(a => ({ ...a }));
    copy.bonds = this.bonds.map(b => ({ ...b }));
    return copy;
  }

  /**
   * 新增一個原子
   */
  addAtom(element, x, y, z, fx = null, fy = null, fz = null) {
    const atom = {
      id: this.nextAtomId++,
      element: element || 'C',
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      fx: fx !== null ? Number(fx) : 0,
      fy: fy !== null ? Number(fy) : 0,
      fz: fz !== null ? Number(fz) : 0,
      selected: false,
      fixed: false
    };

    if (this.cell && (fx === null || fy === null || fz === null)) {
      const frac = this.cartesianToFractional(atom.x, atom.y, atom.z);
      atom.fx = frac[0];
      atom.fy = frac[1];
      atom.fz = frac[2];
    } else if (this.cell && (x === null || y === null || z === null)) {
      const cart = this.fractionalToCartesian(atom.fx, atom.fy, atom.fz);
      atom.x = cart[0];
      atom.y = cart[1];
      atom.z = cart[2];
    }

    this.atoms.push(atom);
    return atom;
  }

  /**
   * 設定晶格向量矩陣 (3x3)
   */
  setCell(matrix, pbc = [true, true, true]) {
    if (!matrix || matrix.length !== 3) {
      this.cell = null;
      this.cellInv = null;
      this.pbc = [false, false, false];
      return;
    }
    this.cell = [
      [Number(matrix[0][0]), Number(matrix[0][1]), Number(matrix[0][2])],
      [Number(matrix[1][0]), Number(matrix[1][1]), Number(matrix[1][2])],
      [Number(matrix[2][0]), Number(matrix[2][1]), Number(matrix[2][2])]
    ];
    this.pbc = [...pbc];
    this.updateCellInverse();
    // 若現有原子僅具有分數座標 (例如剛載入 CIF 且 x,y,z 均為 0)，優先由分數座標同步為笛卡爾座標
    let hasOnlyFractional = false;
    if (this.atoms.length > 0) {
      hasOnlyFractional = this.atoms.every(a => (a.x === 0 && a.y === 0 && a.z === 0) && (a.fx !== 0 || a.fy !== 0 || a.fz !== 0));
    }
    if (hasOnlyFractional) {
      this.syncCartesianFromFractional();
    } else {
      this.syncFractionalFromCartesian();
    }
  }

  /**
   * 根據晶格常數設定晶格向量 (a, b, c, alpha, beta, gamma in degrees)
   */
  setCellParameters(a, b, c, alpha = 90, beta = 90, gamma = 90, pbc = [true, true, true]) {
    const toRad = Math.PI / 180;
    const aRad = alpha * toRad;
    const bRad = beta * toRad;
    const gRad = gamma * toRad;

    const ax = a;
    const ay = 0;
    const az = 0;

    const bx = b * Math.cos(gRad);
    const by = b * Math.sin(gRad);
    const bz = 0;

    const cx = c * Math.cos(bRad);
    const cy = c * (Math.cos(aRad) - Math.cos(bRad) * Math.cos(gRad)) / Math.sin(gRad);
    const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy));

    this.setCell([
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz]
    ], pbc);
  }

  /**
   * 計算晶胞行列式與逆矩陣
   */
  updateCellInverse() {
    if (!this.cell) {
      this.cellInv = null;
      return;
    }
    const [
      [a1, a2, a3],
      [b1, b2, b3],
      [c1, c2, c3]
    ] = this.cell;

    const det = a1 * (b2 * c3 - b3 * c2) -
                a2 * (b1 * c3 - b3 * c1) +
                a3 * (b1 * c2 - b2 * c1);

    if (Math.abs(det) < 1e-8) {
      console.warn('Lattice vectors are linearly dependent (determinant is 0).');
      this.cellInv = null;
      return;
    }

    const invDet = 1.0 / det;
    this.cellInv = [
      [(b2 * c3 - b3 * c2) * invDet, (a3 * c2 - a2 * c3) * invDet, (a2 * b3 - a3 * b2) * invDet],
      [(b3 * c1 - b1 * c3) * invDet, (a1 * c3 - a3 * c1) * invDet, (a3 * b1 - a1 * b3) * invDet],
      [(b1 * c2 - b2 * c1) * invDet, (a2 * c1 - a1 * c2) * invDet, (a1 * b2 - a2 * b1) * invDet]
    ];
  }

  /**
   * 取得晶格參數 (a, b, c, alpha, beta, gamma, volume)
   */
  getCellParameters() {
    if (!this.cell) return null;
    const [va, vb, vc] = this.cell;
    const a = Math.hypot(va[0], va[1], va[2]);
    const b = Math.hypot(vb[0], vb[1], vb[2]);
    const c = Math.hypot(vc[0], vc[1], vc[2]);

    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const toDeg = 180 / Math.PI;

    const alpha = Math.acos(Math.max(-1, Math.min(1, dot(vb, vc) / (b * c)))) * toDeg;
    const beta  = Math.acos(Math.max(-1, Math.min(1, dot(va, vc) / (a * c)))) * toDeg;
    const gamma = Math.acos(Math.max(-1, Math.min(1, dot(va, vb) / (a * b)))) * toDeg;

    // 體積: det(cell)
    const vol = Math.abs(
      va[0] * (vb[1] * vc[2] - vb[2] * vc[1]) -
      va[1] * (vb[0] * vc[2] - vb[2] * vc[0]) +
      va[2] * (vb[0] * vc[1] - vb[1] * vc[0])
    );

    return { a, b, c, alpha, beta, gamma, volume: vol };
  }

  /**
   * 笛卡爾座標 -> 分數座標
   */
  cartesianToFractional(x, y, z) {
    if (!this.cellInv) return [0, 0, 0];
    const inv = this.cellInv;
    const fx = x * inv[0][0] + y * inv[1][0] + z * inv[2][0];
    const fy = x * inv[0][1] + y * inv[1][1] + z * inv[2][1];
    const fz = x * inv[0][2] + y * inv[1][2] + z * inv[2][2];
    return [fx, fy, fz];
  }

  /**
   * 分數座標 -> 笛卡爾座標
   */
  fractionalToCartesian(fx, fy, fz) {
    if (!this.cell) return [0, 0, 0];
    const c = this.cell;
    const x = fx * c[0][0] + fy * c[1][0] + fz * c[2][0];
    const y = fx * c[0][1] + fy * c[1][1] + fz * c[2][1];
    const z = fx * c[0][2] + fy * c[1][2] + fz * c[2][2];
    return [x, y, z];
  }

  /**
   * 依據笛卡爾座標更新分數座標
   */
  syncFractionalFromCartesian() {
    if (!this.cell) return;
    for (const a of this.atoms) {
      const [fx, fy, fz] = this.cartesianToFractional(a.x, a.y, a.z);
      a.fx = fx;
      a.fy = fy;
      a.fz = fz;
    }
  }

  /**
   * 依據分數座標更新笛卡爾座標
   */
  syncCartesianFromFractional() {
    if (!this.cell) return;
    for (const a of this.atoms) {
      const [x, y, z] = this.fractionalToCartesian(a.fx, a.fy, a.fz);
      a.x = x;
      a.y = y;
      a.z = z;
    }
  }

  /**
   * 計算兩原子間的笛卡爾歐氏距離 (Å)
   */
  getDistance(i, j) {
    const a = this.atoms[i];
    const b = this.atoms[j];
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }

  /**
   * 僅更新既有各化學鍵的即時空間長度 (保留成鍵拓樸，不隨距離破壞鍵結)
   */
  updateBondDistances() {
    for (const b of this.bonds) {
      b.dist = this.getDistance(b.a, b.b);
    }
  }

  /**
   * 設定兩原子間的化學鍵拓樸型態 (0: 斷鍵, 1: 單鍵, 2: 雙鍵, 3: 三鍵, 'hb': 氫鍵)
   */
  setBondOrder(idx1, idx2, order) {
    if (idx1 === idx2 || idx1 < 0 || idx2 < 0 || idx1 >= this.atoms.length || idx2 >= this.atoms.length) {
      return null;
    }
    const a = Math.min(idx1, idx2);
    const b = Math.max(idx1, idx2);

    const existingIdx = this.bonds.findIndex(bond => bond.a === a && bond.b === b);

    if (order === 0 || order === '0' || order === 'none') {
      // 移除鍵結 (無鍵結)
      if (existingIdx !== -1) {
        this.bonds.splice(existingIdx, 1);
      }
      return null;
    } else {
      const parsedOrder = order === 'hb' ? 'hb' : (parseInt(order, 10) || 1);
      if (existingIdx !== -1) {
        this.bonds[existingIdx].order = parsedOrder;
        this.bonds[existingIdx].dist = this.getDistance(a, b);
        return this.bonds[existingIdx];
      } else {
        const newBond = {
          a: a,
          b: b,
          dist: this.getDistance(a, b),
          order: parsedOrder,
          offset: [0, 0, 0]
        };
        this.bonds.push(newBond);
        return newBond;
      }
    }
  }

  /**
   * 偵測化學鍵 (支援孤立分子與週期性邊界最小鏡像約定)
   */
  detectBonds(tolerance = 0.40) {
    const bonds = [];
    const n = this.atoms.length;
    if (n < 2) {
      this.bonds = [];
      return bonds;
    }

    const hasPbc = this.cell && (this.pbc[0] || this.pbc[1] || this.pbc[2]);

    for (let i = 0; i < n; i++) {
      const a = this.atoms[i];
      const infoA = getElementInfo(a.element);
      for (let j = i + 1; j < n; j++) {
        const b = this.atoms[j];
        const infoB = getElementInfo(b.element);
        const maxBondDist = infoA.covRadius + infoB.covRadius + tolerance;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        let offset = [0, 0, 0];

        let shiftA = 0, shiftB = 0, shiftC = 0;
        if (hasPbc) {
          // 最小鏡像約定 (Minimum Image Convention in Fractional coords)
          let dfx = (b.fx !== undefined ? b.fx : 0) - (a.fx !== undefined ? a.fx : 0);
          let dfy = (b.fy !== undefined ? b.fy : 0) - (a.fy !== undefined ? a.fy : 0);
          let dfz = (b.fz !== undefined ? b.fz : 0) - (a.fz !== undefined ? a.fz : 0);

          if (this.pbc[0]) {
            shiftA = Math.round(dfx);
            dfx -= shiftA;
          }
          if (this.pbc[1]) {
            shiftB = Math.round(dfy);
            dfy -= shiftB;
          }
          if (this.pbc[2]) {
            shiftC = Math.round(dfz);
            dfz -= shiftC;
          }

          const c = this.cell;
          dx = dfx * c[0][0] + dfy * c[1][0] + dfz * c[2][0];
          dy = dfx * c[0][1] + dfy * c[1][1] + dfz * c[2][1];
          dz = dfx * c[0][2] + dfy * c[1][2] + dfz * c[2][2];
        }

        const dist = Math.hypot(dx, dy, dz);
        if (dist > 0.45 && dist <= maxBondDist) {
          bonds.push({
            a: i,
            b: j,
            dist: dist,
            order: 1,
            offset: [-shiftA, -shiftB, -shiftC]
          });
        }
      }
    }
    this.bonds = bonds;

    // 自動進行鍵級推算 (Bond Order Perception)
    this.perceiveBondOrders();

    // 自動偵測氫鍵 (Hydrogen Bond Detection)
    this.detectHydrogenBonds();

    return this.bonds;
  }

  /**
   * 智慧鍵級推算演算法 (Automatic Bond Order Perception)
   * 採用化學圖論「價態不飽和度最大權重匹配演算法」(Maximum-Weight Valence-Deficiency Matching)
   * 自動為單鍵骨架精準賦予雙鍵 (2) 與三鍵 (3)，完美契合 Kekulé 共軛環、芳香性、雜環與羰基系統
   */
  perceiveBondOrders() {
    if (!this.bonds || this.bonds.length === 0) return;

    const n = this.atoms.length;
    const monovalent = new Set(['H', 'F', 'Cl', 'Br', 'I', 'Li', 'Na', 'K']);

    const targetValences = {
      'H': 1, 'He': 0, 'Li': 1, 'Be': 2, 'B': 3,
      'C': 4, 'N': 3, 'O': 2, 'F': 1, 'Ne': 0,
      'Na': 1, 'Mg': 2, 'Al': 3, 'Si': 4, 'P': 3,
      'S': 2, 'Cl': 1, 'Ar': 0, 'K': 1, 'Ca': 2,
      'Br': 1, 'I': 1, 'Ge': 4, 'As': 3, 'Se': 2
    };

    // 1. 初步重設所有共價鍵為單鍵 (order: 1) 並建立鄰接表
    const covDegree = new Int32Array(n);
    const covAdj = Array.from({ length: n }, () => []);
    for (const b of this.bonds) {
      if (b.order === 'hb') continue;
      b.order = 1;
      covDegree[b.a]++;
      covDegree[b.b]++;
      covAdj[b.a].push(b.b);
      covAdj[b.b].push(b.a);
    }

    // 2. 判定各鍵是否為小型環鍵 (環大小 <= 7)
    const isRingBond = (u, v) => {
      const queue = [[u, 0]];
      const visited = new Set([u]);
      while (queue.length > 0) {
        const [curr, depth] = queue.shift();
        if (depth >= 6) continue;
        for (const nbr of covAdj[curr]) {
          if (curr === u && nbr === v) continue;
          if (nbr === v) return true;
          if (!visited.has(nbr)) {
            visited.add(nbr);
            queue.push([nbr, depth + 1]);
          }
        }
      }
      return false;
    };

    const inSmallRing = new Map();
    for (const b of this.bonds) {
      if (b.order === 'hb') continue;
      inSmallRing.set(b, isRingBond(b.a, b.b));
    }

    // 3. 計算各原子剩餘所需 pi 鍵數 (Valence Deficiency)
    const remDef = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const elem = this.atoms[i].element;
      const targetV = targetValences[elem] !== undefined ? targetValences[elem] : (getElementInfo(elem).valence || 4);
      remDef[i] = Math.max(0, targetV - covDegree[i]);
    }

    // 4. 第一階段：三鍵匹配 (兩端均需 >= 2 鍵且配位數 <= 2，鍵長 <= 1.26 Å)
    for (const b of this.bonds) {
      if (b.order === 'hb') continue;
      const u = b.a, v = b.b;
      const symA = this.atoms[u].element, symB = this.atoms[v].element;
      if (monovalent.has(symA) || monovalent.has(symB)) continue;

      if (remDef[u] >= 2 && remDef[v] >= 2 && covDegree[u] <= 2 && covDegree[v] <= 2) {
        if (b.dist <= 1.26) {
          b.order = 3;
          remDef[u] -= 2;
          remDef[v] -= 2;
        }
      }
    }

    // 5. 第二階段：雙鍵權重排序匹配
    // 限制：在小型環系中，每個環原子在環內最多只能形成 1 個雙鍵 (保持 Kekulé 交替，杜絕環內累積二烯烴)
    const ringPiCount = new Int32Array(n);
    const candidates = [];

    for (const b of this.bonds) {
      if (b.order === 'hb' || b.order === 3) continue;
      const u = b.a, v = b.b;
      if (remDef[u] <= 0 || remDef[v] <= 0) continue;

      const symA = this.atoms[u].element, symB = this.atoms[v].element;
      if (monovalent.has(symA) || monovalent.has(symB)) continue;

      const infoA = getElementInfo(symA);
      const infoB = getElementInfo(symB);
      const rSum = (infoA ? infoA.covRadius : 0.77) + (infoB ? infoB.covRadius : 0.77);
      const ratio = b.dist / rSum;

      // 雙鍵合理物理上限比值 (雙鍵/芳香鍵通常 <= 0.92，單鍵通常 >= 0.96)
      if (ratio > 0.94) continue;

      let priority = 0;
      // 末端雙鍵（例如羰基 =O、硫醯基 =S）具有最高化學優先權
      if (covDegree[u] === 1 || covDegree[v] === 1) {
        priority = 100;
      }

      candidates.push({ priority, ratio, bond: b, u, v });
    }

    // 排序：優先權高者在前，鍵長比值短者在前
    candidates.sort((c1, c2) => {
      if (c2.priority !== c1.priority) return c2.priority - c1.priority;
      return c1.ratio - c2.ratio;
    });

    for (const item of candidates) {
      const { u, v, bond } = item;
      if (remDef[u] > 0 && remDef[v] > 0) {
        const isRing = inSmallRing.get(bond);
        if (isRing && (ringPiCount[u] >= 1 || ringPiCount[v] >= 1)) {
          continue;
        }
        bond.order = 2;
        remDef[u] -= 1;
        remDef[v] -= 1;
        if (isRing) {
          ringPiCount[u]++;
          ringPiCount[v]++;
        }
      }
    }

    // 6. 八隅體防護：確保無原子超出其物理最大價態
    const maxValences = {
      'H': 1, 'He': 0, 'Li': 1, 'Be': 2, 'B': 3,
      'C': 4, 'N': 4, 'O': 2, 'F': 1, 'Ne': 0,
      'Na': 1, 'Mg': 2, 'Al': 3, 'Si': 4, 'P': 5,
      'S': 6, 'Cl': 1, 'Br': 1, 'I': 1
    };

    for (let iter = 0; iter < 3; iter++) {
      let changed = false;
      for (let i = 0; i < n; i++) {
        const elem = this.atoms[i].element;
        const maxV = maxValences[elem];
        if (maxV === undefined) continue;

        let totalValence = 0;
        const incBonds = [];
        for (const b of this.bonds) {
          if (b.order === 'hb') continue;
          if (b.a === i || b.b === i) {
            incBonds.push(b);
            totalValence += (typeof b.order === 'number' ? b.order : 1);
          }
        }

        if (totalValence > maxV) {
          incBonds.sort((b1, b2) => b2.dist - b1.dist);
          for (const b of incBonds) {
            if (b.order > 1) {
              b.order -= 1;
              totalValence -= 1;
              changed = true;
              if (totalValence <= maxV) break;
            }
          }
        }
      }
      if (!changed) break;
    }
  }

  /**
   * 智慧氫鍵偵測演算法 (Hydrogen Bond Detector)
   * 依據 IUPAC 幾何標準：供體 D (O, N, F) - 氫 H ··· 受體 A (O, N, F)
   * 判定條件：
   * 1. 距離：1.5 Å <= d(H···A) <= 2.6 Å
   * 2. 角度：∠(D-H···A) >= 115°
   * 3. 排除 1-2 (共價鍵本身) 或 1-3 (同一個供體上之其他原子)
   */
  detectHydrogenBonds() {
    const electronegative = new Set(['O', 'N', 'F']);
    const n = this.atoms.length;
    if (n < 3) return;

    // 先建立共價鄰接關係以快速查找 D-H
    const covNeighbors = Array.from({ length: n }, () => new Set());
    for (const b of this.bonds) {
      if (b.order !== 'hb') {
        covNeighbors[b.a].add(b.b);
        covNeighbors[b.b].add(b.a);
      }
    }

    const newHbBonds = [];

    // 尋找所有與供體 D 相連的 H
    for (let hIdx = 0; hIdx < n; hIdx++) {
      const atomH = this.atoms[hIdx];
      if (atomH.element !== 'H') continue;

      let dIdx = -1;
      for (const nbr of covNeighbors[hIdx]) {
        if (electronegative.has(this.atoms[nbr].element)) {
          dIdx = nbr;
          break;
        }
      }
      if (dIdx === -1) continue;
      const atomD = this.atoms[dIdx];

      // 尋找潛在受體 A
      for (let aIdx = 0; aIdx < n; aIdx++) {
        if (aIdx === hIdx || aIdx === dIdx) continue;
        const atomA = this.atoms[aIdx];
        if (!electronegative.has(atomA.element)) continue;

        // 排除 1-3 鍵 (若 A 也是與 D 相連的共價鄰居，不構成氫鍵)
        if (covNeighbors[dIdx].has(aIdx)) continue;

        const dx = atomA.x - atomH.x;
        const dy = atomA.y - atomH.y;
        const dz = atomA.z - atomH.z;
        const distHA = Math.hypot(dx, dy, dz);

        if (distHA >= 1.5 && distHA <= 2.6) {
          const vHD = [atomD.x - atomH.x, atomD.y - atomH.y, atomD.z - atomH.z];
          const vHA = [dx, dy, dz];

          const lenHD = Math.hypot(...vHD);
          const lenHA = distHA;
          if (lenHD < 1e-4 || lenHA < 1e-4) continue;

          const dot = vHD[0] * vHA[0] + vHD[1] * vHA[1] + vHD[2] * vHA[2];
          const cosAngle = dot / (lenHD * lenHA);
          const angleDeg = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);

          if (angleDeg >= 115) {
            const aMin = Math.min(hIdx, aIdx);
            const aMax = Math.max(hIdx, aIdx);
            const alreadyExists = this.bonds.some(b => (b.a === aMin && b.b === aMax) || (b.a === aMax && b.b === aMin));
            const inNewList = newHbBonds.some(b => b.a === aMin && b.b === aMax);

            if (!alreadyExists && !inNewList) {
              newHbBonds.push({
                a: aMin,
                b: aMax,
                dist: distHA,
                order: 'hb',
                offset: [0, 0, 0]
              });
            }
          }
        }
      }
    }

    if (newHbBonds.length > 0) {
      this.bonds.push(...newHbBonds);
    }
  }

  /**
   * 取得分子連通分支（用於選取基團或單個分子）
   */
  getConnectedFragment(startIndex) {
    if (this.bonds.length === 0) this.detectBonds();
    const adj = Array.from({ length: this.atoms.length }, () => []);
    for (const b of this.bonds) {
      adj[b.a].push(b.b);
      adj[b.b].push(b.a);
    }

    const visited = new Set();
    const queue = [startIndex];
    visited.add(startIndex);

    while (queue.length > 0) {
      const u = queue.shift();
      for (const v of adj[u]) {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      }
    }
    return Array.from(visited);
  }

  /**
   * 計算選中原子或整體的幾何中心
   */
  getCenter(selectedOnly = false) {
    const list = selectedOnly ? this.atoms.filter(a => a.selected) : this.atoms;
    if (list.length === 0) return [0, 0, 0];
    let sx = 0, sy = 0, sz = 0;
    for (const a of list) {
      sx += a.x;
      sy += a.y;
      sz += a.z;
    }
    return [sx / list.length, sy / list.length, sz / list.length];
  }

  /**
   * 平移原子
   */
  translate(dx, dy, dz, selectedOnly = false) {
    const list = selectedOnly ? this.atoms.filter(a => a.selected) : this.atoms;
    for (const a of list) {
      a.x += dx;
      a.y += dy;
      a.z += dz;
    }
    this.syncFractionalFromCartesian();
  }

  /**
   * 繞任意中心與旋轉軸旋轉原子 (Rodrigues' Rotation Formula)
   */
  rotate(axis, angleRad, origin = [0, 0, 0], selectedOnly = false) {
    const list = selectedOnly ? this.atoms.filter(a => a.selected) : this.atoms;
    const [ox, oy, oz] = origin;
    let [ux, uy, uz] = axis;
    const len = Math.hypot(ux, uy, uz);
    if (len < 1e-7) return;
    ux /= len; uy /= len; uz /= len;

    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);

    for (const a of list) {
      const px = a.x - ox;
      const py = a.y - oy;
      const pz = a.z - oz;

      const dot = px * ux + py * uy + pz * uz;
      const crossX = uy * pz - uz * py;
      const crossY = uz * px - ux * pz;
      const crossZ = ux * py - uy * px;

      const rx = px * cosTheta + crossX * sinTheta + ux * dot * (1 - cosTheta);
      const ry = py * cosTheta + crossY * sinTheta + uy * dot * (1 - cosTheta);
      const rz = pz * cosTheta + crossZ * sinTheta + uz * dot * (1 - cosTheta);

      a.x = ox + rx;
      a.y = oy + ry;
      a.z = oz + rz;
    }
    this.syncFractionalFromCartesian();
  }

  /**
   * 旋轉二面角（繞鍵軸旋轉鍵一側的分子基團）
   * @param {number} idxA 鍵的第一個原子
   * @param {number} idxB 鍵的第二個原子（該側的基團會被旋轉）
   * @param {number} angleRad 旋轉角度 (弧度)
   */
  rotateDihedral(idxA, idxB, angleRad) {
    if (idxA === idxB || idxA < 0 || idxB < 0 || idxA >= this.atoms.length || idxB >= this.atoms.length) return;
    if (this.bonds.length === 0) this.detectBonds();

    // 建立鄰接表（阻斷 idxA 與 idxB 之間的連線，求出 idxB 側的所有連通原子）
    const adj = Array.from({ length: this.atoms.length }, () => []);
    for (const b of this.bonds) {
      if ((b.a === idxA && b.b === idxB) || (b.a === idxB && b.b === idxA)) {
        continue; // 斷開這根鍵
      }
      adj[b.a].push(b.b);
      adj[b.b].push(b.a);
    }

    const groupB = new Set();
    const queue = [idxB];
    groupB.add(idxB);

    while (queue.length > 0) {
      const u = queue.shift();
      for (const v of adj[u]) {
        if (!groupB.has(v)) {
          groupB.add(v);
          queue.push(v);
        }
      }
    }

    // 若整顆分子是環狀，斷一根鍵可能還是能連到 idxA
    if (groupB.has(idxA)) {
      console.warn('Cannot perform simple dihedral twist on a ring bond.');
      return false;
    }

    const atomA = this.atoms[idxA];
    const atomB = this.atoms[idxB];
    const axis = [atomB.x - atomA.x, atomB.y - atomA.y, atomB.z - atomA.z];
    const origin = [atomB.x, atomB.y, atomB.z];

    const prevSelection = this.atoms.map(a => a.selected);
    for (let i = 0; i < this.atoms.length; i++) {
      this.atoms[i].selected = groupB.has(i);
    }
    this.rotate(axis, angleRad, origin, true);

    // 恢復原先選取狀態
    for (let i = 0; i < this.atoms.length; i++) {
      this.atoms[i].selected = prevSelection[i];
    }
    return true;
  }

  /**
   * 計算化學式 (Hill 系統：碳優先、氫其次、其餘字母排序)
   */
  getFormula() {
    const counts = {};
    for (const a of this.atoms) {
      counts[a.element] = (counts[a.element] || 0) + 1;
    }

    const parts = [];
    if (counts['C']) {
      parts.push(`C${counts['C'] > 1 ? counts['C'] : ''}`);
      delete counts['C'];
      if (counts['H']) {
        parts.push(`H${counts['H'] > 1 ? counts['H'] : ''}`);
        delete counts['H'];
      }
    }

    const remaining = Object.keys(counts).sort();
    for (const elem of remaining) {
      parts.push(`${elem}${counts[elem] > 1 ? counts[elem] : ''}`);
    }
    return parts.join(' ') || 'Empty';
  }

  /**
   * 計算總分子量 (g/mol)
   */
  getMolecularWeight() {
    let mass = 0;
    for (const a of this.atoms) {
      mass += getElementInfo(a.element).mass;
    }
    return mass;
  }

  /**
   * 居中分子或晶胞
   */
  center(selectedOnly = false) {
    if (this.cell) {
      // 週期性體系：將原子平移使幾何中心位於晶胞中心 (0.5, 0.5, 0.5)
      this.syncFractionalFromCartesian();
      const list = selectedOnly ? this.atoms.filter(a => a.selected) : this.atoms;
      if (list.length === 0) return;
      let sfx = 0, sfy = 0, sfz = 0;
      for (const a of list) {
        sfx += a.fx;
        sfy += a.fy;
        sfz += a.fz;
      }
      const dfx = 0.5 - sfx / list.length;
      const dfy = 0.5 - sfy / list.length;
      const dfz = 0.5 - sfz / list.length;
      for (const a of list) {
        a.fx += dfx;
        a.fy += dfy;
        a.fz += dfz;
      }
      this.syncCartesianFromFractional();
    } else {
      // 孤立分子：將中心平移到 (0, 0, 0)
      const center = this.getCenter(selectedOnly);
      this.translate(-center[0], -center[1], -center[2], selectedOnly);
    }
  }
}
