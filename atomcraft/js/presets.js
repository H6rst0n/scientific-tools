/**
 * presets.js - 內建精選化學與材料範例庫 (Sample Structures Library)
 * 涵蓋小分子、金屬有機配合物、2D 材料與 3D 塊材晶體
 */

const PRESETS = {
  // ================= 0D 孤立分子 =================
  water: {
    name: '水分子 (Water, H2O)',
    type: 'molecule',
    build: () => {
      const s = new Structure();
      s.title = 'Water (H2O)';
      s.addAtom('O', 0.000, 0.000, 0.117);
      s.addAtom('H', 0.000, 0.757, -0.469);
      s.addAtom('H', 0.000, -0.757, -0.469);
      s.detectBonds();
      return s;
    }
  },

  methane: {
    name: '甲烷 (Methane, CH4)',
    type: 'molecule',
    build: () => {
      const s = new Structure();
      s.title = 'Methane (CH4)';
      s.addAtom('C', 0.000, 0.000, 0.000);
      s.addAtom('H', 0.629, 0.629, 0.629);
      s.addAtom('H', -0.629, -0.629, 0.629);
      s.addAtom('H', -0.629, 0.629, -0.629);
      s.addAtom('H', 0.629, -0.629, -0.629);
      s.detectBonds();
      return s;
    }
  },

  benzene: {
    name: '苯環 (Benzene, C6H6)',
    type: 'molecule',
    build: () => {
      const s = new Structure();
      s.title = 'Benzene (C6H6)';
      const rC = 1.397;
      const rH = 2.480;
      for (let i = 0; i < 6; i++) {
        const theta = (i * 60 * Math.PI) / 180;
        s.addAtom('C', rC * Math.cos(theta), rC * Math.sin(theta), 0);
        s.addAtom('H', rH * Math.cos(theta), rH * Math.sin(theta), 0);
      }
      s.detectBonds();
      return s;
    }
  },

  caffeine: {
    name: '咖啡因 (Caffeine, C8H10N4O2)',
    type: 'molecule',
    build: () => {
      const s = new Structure();
      s.title = 'Caffeine (C8H10N4O2)';
      const atoms = [
        ['N',  1.261,  0.435,  0.000],
        ['C',  0.000,  1.072,  0.000],
        ['O', -0.052,  2.285,  0.000],
        ['C', -1.173,  0.222,  0.000],
        ['C', -0.849, -1.134,  0.000],
        ['N', -1.898, -1.986,  0.000],
        ['C', -1.411, -3.229,  0.000],
        ['H', -2.039, -4.110,  0.000],
        ['N', -0.106, -3.238,  0.000],
        ['C',  0.267, -1.916,  0.000],
        ['O',  1.396, -1.458,  0.000],
        ['N', -2.441,  0.722,  0.000],
        ['C', -2.766,  2.138,  0.000],
        ['H', -2.311,  2.607,  0.880],
        ['H', -2.311,  2.607, -0.880],
        ['H', -3.844,  2.247,  0.000],
        ['C',  2.473,  1.240,  0.000],
        ['H',  2.428,  1.879,  0.886],
        ['H',  2.428,  1.879, -0.886],
        ['H',  3.336,  0.584,  0.000],
        ['C',  0.949, -4.237,  0.000],
        ['H',  0.900, -4.869,  0.886],
        ['H',  0.900, -4.869, -0.886],
        ['H',  1.905, -3.727,  0.000]
      ];
      for (const [elem, x, y, z] of atoms) {
        s.addAtom(elem, x, y, z);
      }
      s.detectBonds();
      return s;
    }
  },

  ferrocene: {
    name: '二茂鐵 (Ferrocene, Fe(C5H5)2)',
    type: 'molecule',
    build: () => {
      const s = new Structure();
      s.title = 'Ferrocene Fe(Cp)2';
      s.addAtom('Fe', 0, 0, 0);

      const rC = 1.21;
      const rH = 2.25;
      const zRing = 1.65;

      // 頂層環 (z = +1.65)
      for (let i = 0; i < 5; i++) {
        const a = (i * 72 * Math.PI) / 180;
        s.addAtom('C', rC * Math.cos(a), rC * Math.sin(a), zRing);
        s.addAtom('H', rH * Math.cos(a), rH * Math.sin(a), zRing);
      }

      // 底層環 (z = -1.65, 交錯 36°)
      for (let i = 0; i < 5; i++) {
        const a = ((i * 72 + 36) * Math.PI) / 180;
        s.addAtom('C', rC * Math.cos(a), rC * Math.sin(a), -zRing);
        s.addAtom('H', rH * Math.cos(a), rH * Math.sin(a), -zRing);
      }

      s.detectBonds();
      return s;
    }
  },

  // ================= 週期性晶體與二維材料 =================
  silicon: {
    name: '矽金剛石晶胞 (Silicon Bulk, Si)',
    type: 'crystal',
    build: () => {
      const s = new Structure();
      s.title = 'Silicon Diamond Lattice';
      const a = 5.431;
      s.setCellParameters(a, a, a, 90, 90, 90, [true, true, true]);

      // FCC 晶格 8 個矽原子分數座標
      const fracPositions = [
        [0.00, 0.00, 0.00],
        [0.50, 0.50, 0.00],
        [0.50, 0.00, 0.50],
        [0.00, 0.50, 0.50],
        [0.25, 0.25, 0.25],
        [0.75, 0.75, 0.25],
        [0.75, 0.25, 0.75],
        [0.25, 0.75, 0.75]
      ];

      for (const [fx, fy, fz] of fracPositions) {
        s.addAtom('Si', null, null, null, fx, fy, fz);
      }
      s.detectBonds();
      return s;
    }
  },

  graphene: {
    name: '石墨烯 2D 材料 (Graphene Slab, C)',
    type: 'crystal',
    build: () => {
      const s = new Structure();
      s.title = 'Graphene 2D';
      const a = 2.461;
      const c = 15.000; // 真空層
      s.setCellParameters(a, a, c, 90, 90, 120, [true, true, false]);

      // 單位晶胞 2 個碳原子
      s.addAtom('C', null, null, null, 1/3, 2/3, 0.5);
      s.addAtom('C', null, null, null, 2/3, 1/3, 0.5);
      s.detectBonds();
      return s;
    }
  },

  nacl: {
    name: '食鹽晶體 (Rock Salt, NaCl)',
    type: 'crystal',
    build: () => {
      const s = new Structure();
      s.title = 'NaCl Rock Salt Lattice';
      const a = 5.64;
      s.setCellParameters(a, a, a, 90, 90, 90, [true, true, true]);

      // Na 佔據 FCC
      const naFracs = [
        [0.0, 0.0, 0.0], [0.5, 0.5, 0.0], [0.5, 0.0, 0.5], [0.0, 0.5, 0.5]
      ];
      // Cl 佔據邊心與體心
      const clFracs = [
        [0.5, 0.0, 0.0], [0.0, 0.5, 0.0], [0.0, 0.0, 0.5], [0.5, 0.5, 0.5]
      ];

      for (const f of naFracs) s.addAtom('Na', null, null, null, f[0], f[1], f[2]);
      for (const f of clFracs) s.addAtom('Cl', null, null, null, f[0], f[1], f[2]);

      s.detectBonds();
      return s;
    }
  },

  rutile: {
    name: '金紅石型二氧化鈦 (Rutile TiO2)',
    type: 'crystal',
    build: () => {
      const s = new Structure();
      s.title = 'Rutile TiO2';
      const a = 4.593;
      const c = 2.959;
      s.setCellParameters(a, a, c, 90, 90, 90, [true, true, true]);

      const u = 0.305;
      // Ti 原子 (2 個)
      s.addAtom('Ti', null, null, null, 0.0, 0.0, 0.0);
      s.addAtom('Ti', null, null, null, 0.5, 0.5, 0.5);

      // O 原子 (4 個)
      s.addAtom('O', null, null, null, u, u, 0.0);
      s.addAtom('O', null, null, null, 1 - u, 1 - u, 0.0);
      s.addAtom('O', null, null, null, 0.5 + u, 0.5 - u, 0.5);
      s.addAtom('O', null, null, null, 0.5 - u, 0.5 + u, 0.5);

      s.detectBonds();
      return s;
    }
  }
};
