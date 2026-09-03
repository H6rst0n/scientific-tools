/**
 * periodic_table.js - GaussView 風格元素週期表與混成軌域幾何片段資料庫
 * 支援 1 ~ 118 號元素選取、混成狀態 (sp3, sp2, sp, sp3d, sp3d2 等) 片段生成
 */

const PERIODIC_TABLE_DATA = [
  // Period 1
  { num: 1, sym: 'H', name: 'Hydrogen', nameZh: '氫', row: 1, col: 1, cat: 'nonmetal' },
  { num: 2, sym: 'He', name: 'Helium', nameZh: '氦', row: 1, col: 18, cat: 'noble' },

  // Period 2
  { num: 3, sym: 'Li', name: 'Lithium', nameZh: '鋰', row: 2, col: 1, cat: 'alkali' },
  { num: 4, sym: 'Be', name: 'Beryllium', nameZh: '鈹', row: 2, col: 2, cat: 'alkaline' },
  { num: 5, sym: 'B', name: 'Boron', nameZh: '硼', row: 2, col: 13, cat: 'metalloid' },
  { num: 6, sym: 'C', name: 'Carbon', nameZh: '碳', row: 2, col: 14, cat: 'nonmetal' },
  { num: 7, sym: 'N', name: 'Nitrogen', nameZh: '氮', row: 2, col: 15, cat: 'nonmetal' },
  { num: 8, sym: 'O', name: 'Oxygen', nameZh: '氧', row: 2, col: 16, cat: 'nonmetal' },
  { num: 9, sym: 'F', name: 'Fluorine', nameZh: '氟', row: 2, col: 17, cat: 'halogen' },
  { num: 10, sym: 'Ne', name: 'Neon', nameZh: '氖', row: 2, col: 18, cat: 'noble' },

  // Period 3
  { num: 11, sym: 'Na', name: 'Sodium', nameZh: '鈉', row: 3, col: 1, cat: 'alkali' },
  { num: 12, sym: 'Mg', name: 'Magnesium', nameZh: '鎂', row: 3, col: 2, cat: 'alkaline' },
  { num: 13, sym: 'Al', name: 'Aluminium', nameZh: '鋁', row: 3, col: 13, cat: 'post-transition' },
  { num: 14, sym: 'Si', name: 'Silicon', nameZh: '矽', row: 3, col: 14, cat: 'metalloid' },
  { num: 15, sym: 'P', name: 'Phosphorus', nameZh: '磷', row: 3, col: 15, cat: 'nonmetal' },
  { num: 16, sym: 'S', name: 'Sulfur', nameZh: '硫', row: 3, col: 16, cat: 'nonmetal' },
  { num: 17, sym: 'Cl', name: 'Chlorine', nameZh: '氯', row: 3, col: 17, cat: 'halogen' },
  { num: 18, sym: 'Ar', name: 'Argon', nameZh: '氬', row: 3, col: 18, cat: 'noble' },

  // Period 4
  { num: 19, sym: 'K', name: 'Potassium', nameZh: '鉀', row: 4, col: 1, cat: 'alkali' },
  { num: 20, sym: 'Ca', name: 'Calcium', nameZh: '鈣', row: 4, col: 2, cat: 'alkaline' },
  { num: 21, sym: 'Sc', name: 'Scandium', nameZh: '鈧', row: 4, col: 3, cat: 'transition' },
  { num: 22, sym: 'Ti', name: 'Titanium', nameZh: '鈦', row: 4, col: 4, cat: 'transition' },
  { num: 23, sym: 'V', name: 'Vanadium', nameZh: '釩', row: 4, col: 5, cat: 'transition' },
  { num: 24, sym: 'Cr', name: 'Chromium', nameZh: '鉻', row: 4, col: 6, cat: 'transition' },
  { num: 25, sym: 'Mn', name: 'Manganese', nameZh: '錳', row: 4, col: 7, cat: 'transition' },
  { num: 26, sym: 'Fe', name: 'Iron', nameZh: '鐵', row: 4, col: 8, cat: 'transition' },
  { num: 27, sym: 'Co', name: 'Cobalt', nameZh: '鈷', row: 4, col: 9, cat: 'transition' },
  { num: 28, sym: 'Ni', name: 'Nickel', nameZh: '鎳', row: 4, col: 10, cat: 'transition' },
  { num: 29, sym: 'Cu', name: 'Copper', nameZh: '銅', row: 4, col: 11, cat: 'transition' },
  { num: 30, sym: 'Zn', name: 'Zinc', nameZh: '鋅', row: 4, col: 12, cat: 'transition' },
  { num: 31, sym: 'Ga', name: 'Gallium', nameZh: '鎵', row: 4, col: 13, cat: 'post-transition' },
  { num: 32, sym: 'Ge', name: 'Germanium', nameZh: '鍺', row: 4, col: 14, cat: 'metalloid' },
  { num: 33, sym: 'As', name: 'Arsenic', nameZh: '砷', row: 4, col: 15, cat: 'metalloid' },
  { num: 34, sym: 'Se', name: 'Selenium', nameZh: '硒', row: 4, col: 16, cat: 'nonmetal' },
  { num: 35, sym: 'Br', name: 'Bromine', nameZh: '溴', row: 4, col: 17, cat: 'halogen' },
  { num: 36, sym: 'Kr', name: 'Krypton', nameZh: '氪', row: 4, col: 18, cat: 'noble' },

  // Period 5
  { num: 37, sym: 'Rb', name: 'Rubidium', nameZh: '銣', row: 5, col: 1, cat: 'alkali' },
  { num: 38, sym: 'Sr', name: 'Strontium', nameZh: '鍶', row: 5, col: 2, cat: 'alkaline' },
  { num: 39, sym: 'Y', name: 'Yttrium', nameZh: '釔', row: 5, col: 3, cat: 'transition' },
  { num: 40, sym: 'Zr', name: 'Zirconium', nameZh: '鋯', row: 5, col: 4, cat: 'transition' },
  { num: 41, sym: 'Nb', name: 'Niobium', nameZh: '鈮', row: 5, col: 5, cat: 'transition' },
  { num: 42, sym: 'Mo', name: 'Molybdenum', nameZh: '鉬', row: 5, col: 6, cat: 'transition' },
  { num: 43, sym: 'Tc', name: 'Technetium', nameZh: '鎝', row: 5, col: 7, cat: 'transition' },
  { num: 44, sym: 'Ru', name: 'Ruthenium', nameZh: '釕', row: 5, col: 8, cat: 'transition' },
  { num: 45, sym: 'Rh', name: 'Rhodium', nameZh: '銠', row: 5, col: 9, cat: 'transition' },
  { num: 46, sym: 'Pd', name: 'Palladium', nameZh: '鈀', row: 5, col: 10, cat: 'transition' },
  { num: 47, sym: 'Ag', name: 'Silver', nameZh: '銀', row: 5, col: 11, cat: 'transition' },
  { num: 48, sym: 'Cd', name: 'Cadmium', nameZh: '鎘', row: 5, col: 12, cat: 'transition' },
  { num: 49, sym: 'In', name: 'Indium', nameZh: '銦', row: 5, col: 13, cat: 'post-transition' },
  { num: 50, sym: 'Sn', name: 'Tin', nameZh: '錫', row: 5, col: 14, cat: 'post-transition' },
  { num: 51, sym: 'Sb', name: 'Antimony', nameZh: '銻', row: 5, col: 15, cat: 'metalloid' },
  { num: 52, sym: 'Te', name: 'Tellurium', nameZh: '碲', row: 5, col: 16, cat: 'metalloid' },
  { num: 53, sym: 'I', name: 'Iodine', nameZh: '碘', row: 5, col: 17, cat: 'halogen' },
  { num: 54, sym: 'Xe', name: 'Xenon', nameZh: '氙', row: 5, col: 18, cat: 'noble' },

  // Period 6
  { num: 55, sym: 'Cs', name: 'Caesium', nameZh: '銫', row: 6, col: 1, cat: 'alkali' },
  { num: 56, sym: 'Ba', name: 'Barium', nameZh: '鋇', row: 6, col: 2, cat: 'alkaline' },
  { num: 57, sym: 'La', name: 'Lanthanum', nameZh: '鑭', row: 6, col: 3, cat: 'lanthanide' },
  { num: 72, sym: 'Hf', name: 'Hafnium', nameZh: '鉿', row: 6, col: 4, cat: 'transition' },
  { num: 73, sym: 'Ta', name: 'Tantalum', nameZh: '鉭', row: 6, col: 5, cat: 'transition' },
  { num: 74, sym: 'W', name: 'Tungsten', nameZh: '鎢', row: 6, col: 6, cat: 'transition' },
  { num: 75, sym: 'Re', name: 'Rhenium', nameZh: '錸', row: 6, col: 7, cat: 'transition' },
  { num: 76, sym: 'Os', name: 'Osmium', nameZh: '鋨', row: 6, col: 8, cat: 'transition' },
  { num: 77, sym: 'Ir', name: 'Iridium', nameZh: '銥', row: 6, col: 9, cat: 'transition' },
  { num: 78, sym: 'Pt', name: 'Platinum', nameZh: '鉑', row: 6, col: 10, cat: 'transition' },
  { num: 79, sym: 'Au', name: 'Gold', nameZh: '金', row: 6, col: 11, cat: 'transition' },
  { num: 80, sym: 'Hg', name: 'Mercury', nameZh: '汞', row: 6, col: 12, cat: 'transition' },
  { num: 81, sym: 'Tl', name: 'Thallium', nameZh: '鉈', row: 6, col: 13, cat: 'post-transition' },
  { num: 82, sym: 'Pb', name: 'Lead', nameZh: '鉛', row: 6, col: 14, cat: 'post-transition' },
  { num: 83, sym: 'Bi', name: 'Bismuth', nameZh: '鉍', row: 6, col: 15, cat: 'post-transition' }
];

/**
 * 混成軌域幾何幾何模板庫 (Hybridization / Fragment Templates)
 */
const HYBRIDIZATION_PRESETS = {
  // 碳族 (C, Si, Ge)
  C: [
    { id: 'sp3', name: 'sp³ Tetrahedral', nameZh: '正四面體 (sp³)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] },
    { id: 'sp2', name: 'sp² Trigonal Planar', nameZh: '平面三角形 (sp²)', coord: 3, dirs: [[1,0,0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]] },
    { id: 'sp', name: 'sp Linear', nameZh: '直線型 (sp)', coord: 2, dirs: [[1,0,0], [-1,0,0]] }
  ],
  Si: [
    { id: 'sp3', name: 'sp³ Tetrahedral', nameZh: '正四面體 (sp³)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] },
    { id: 'octahedral', name: 'Octahedral', nameZh: '正八面體 (sp³d²)', coord: 6, dirs: [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]] }
  ],

  // 氮族 (N, P, As)
  N: [
    { id: 'sp3_pyramidal', name: 'sp³ Trigonal Pyramidal', nameZh: '三角錐 (sp³)', coord: 3, dirs: [[0, 0.96, 0.28], [0.83, -0.48, 0.28], [-0.83, -0.48, 0.28]] },
    { id: 'sp2_planar', name: 'sp² Trigonal Planar', nameZh: '平面三角形 (sp²)', coord: 3, dirs: [[1,0,0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]] },
    { id: 'sp2_bent', name: 'sp² Bent', nameZh: '角形 (sp²)', coord: 2, dirs: [[1,0,0], [-0.5, 0.866, 0]] },
    { id: 'sp_linear', name: 'sp Linear', nameZh: '直線端點 (sp)', coord: 1, dirs: [[1,0,0]] }
  ],
  P: [
    { id: 'sp3_pyramidal', name: 'sp³ Trigonal Pyramidal', nameZh: '三角錐 (sp³)', coord: 3, dirs: [[0, 0.96, 0.28], [0.83, -0.48, 0.28], [-0.83, -0.48, 0.28]] },
    { id: 'sp3_tetrahedral', name: 'Tetrahedral', nameZh: '四面體 (sp³)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] },
    { id: 'sp3d_bipyramidal', name: 'Trigonal Bipyramidal', nameZh: '雙三角錐 (sp³d)', coord: 5, dirs: [[0,0,1], [0,0,-1], [1,0,0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]] }
  ],

  // 氧族 (O, S)
  O: [
    { id: 'sp3_bent', name: 'sp³ Bent', nameZh: '角形/水分子型 (sp³)', coord: 2, dirs: [[0.793, 0.609, 0], [-0.793, 0.609, 0]] },
    { id: 'sp2_double', name: 'sp² Terminal', nameZh: '羰基雙鍵端點 (sp²)', coord: 1, dirs: [[1,0,0]] }
  ],
  S: [
    { id: 'sp3_bent', name: 'sp³ Bent', nameZh: '角形 (sp³)', coord: 2, dirs: [[0.793, 0.609, 0], [-0.793, 0.609, 0]] },
    { id: 'sp3_tetrahedral', name: 'Tetrahedral', nameZh: '四面體/碸基 (sp³)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] },
    { id: 'sp3d2_octahedral', name: 'Octahedral (SF6)', nameZh: '正八面體 (sp³d²)', coord: 6, dirs: [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]] }
  ],

  // 硼族 (B)
  B: [
    { id: 'sp2_planar', name: 'sp² Trigonal Planar', nameZh: '平面三角形 (sp²)', coord: 3, dirs: [[1,0,0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]] },
    { id: 'sp3_tetrahedral', name: 'Tetrahedral', nameZh: '四面體 (sp³)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] }
  ],

  // 氫與鹵素 (H, F, Cl, Br, I)
  H: [
    { id: 'terminal', name: 'Monovalent', nameZh: '單配位端點', coord: 1, dirs: [[1,0,0]] }
  ],
  F: [{ id: 'terminal', name: 'Monovalent', nameZh: '單配位端點', coord: 1, dirs: [[1,0,0]] }],
  Cl: [{ id: 'terminal', name: 'Monovalent', nameZh: '單配位端點', coord: 1, dirs: [[1,0,0]] }],
  Br: [{ id: 'terminal', name: 'Monovalent', nameZh: '單配位端點', coord: 1, dirs: [[1,0,0]] }],
  I: [{ id: 'terminal', name: 'Monovalent', nameZh: '單配位端點', coord: 1, dirs: [[1,0,0]] }],

  // 過渡金屬通用幾何模板 (Fe, Co, Ni, Cu, Pt, Pd, Au, Ti, Ru, Rh 等)
  TRANSITION_DEFAULT: [
    { id: 'octahedral', name: 'Octahedral (6-coord)', nameZh: '正八面體 (6配位)', coord: 6, dirs: [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]] },
    { id: 'square_planar', name: 'Square Planar (4-coord)', nameZh: '平面四方 (4配位)', coord: 4, dirs: [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0]] },
    { id: 'tetrahedral', name: 'Tetrahedral (4-coord)', nameZh: '正四面體 (4配位)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] },
    { id: 'linear', name: 'Linear (2-coord)', nameZh: '直線型 (2配位)', coord: 2, dirs: [[1,0,0], [-1,0,0]] }
  ]
};

/**
 * 取得特定元素的可用混成模式清單
 */
function getHybridizationsForElement(elem) {
  if (HYBRIDIZATION_PRESETS[elem]) {
    return HYBRIDIZATION_PRESETS[elem];
  }
  const info = getElementInfo(elem);
  // 若為金屬或過渡金屬
  if (info.number >= 21 && info.number <= 30 || info.number >= 39 && info.number <= 48 || info.number >= 72 && info.number <= 80) {
    return HYBRIDIZATION_PRESETS.TRANSITION_DEFAULT;
  }
  // 預設返回四面體與直線
  return [
    { id: 'tetrahedral', name: 'Tetrahedral', nameZh: '四面體 (4配位)', coord: 4, dirs: [[1,1,1], [-1,-1,1], [-1,1,-1], [1,-1,-1]] },
    { id: 'linear', name: 'Linear', nameZh: '直線 (2配位)', coord: 2, dirs: [[1,0,0], [-1,0,0]] }
  ];
}
