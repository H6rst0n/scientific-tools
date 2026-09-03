/**
 * elements.js - 元素週期表資料庫 (Elements Database)
 * 包含 1 ~ 118 號元素的標準符號、原子量、共價半徑 (Covalent Radii)、
 * 凡德瓦半徑 (VDW Radii)、CPK 顏色代碼、常用價態與配位幾何偏好。
 */

const ELEMENTS = {
  1: { number: 1, symbol: 'H', name: 'Hydrogen', nameZh: '氫', mass: 1.008, color: '#FFFFFF', covRadius: 0.31, vdwRadius: 1.20, valence: 1, maxCoord: 1 },
  2: { number: 2, symbol: 'He', name: 'Helium', nameZh: '氦', mass: 4.0026, color: '#D9FFFF', covRadius: 0.28, vdwRadius: 1.40, valence: 0, maxCoord: 0 },
  3: { number: 3, symbol: 'Li', name: 'Lithium', nameZh: '鋰', mass: 6.94, color: '#CC80FF', covRadius: 1.28, vdwRadius: 1.82, valence: 1, maxCoord: 4 },
  4: { number: 4, symbol: 'Be', name: 'Beryllium', nameZh: '鈹', mass: 9.0122, color: '#C2FF00', covRadius: 0.96, vdwRadius: 1.53, valence: 2, maxCoord: 4 },
  5: { number: 5, symbol: 'B', name: 'Boron', nameZh: '硼', mass: 10.81, color: '#FFB5B5', covRadius: 0.84, vdwRadius: 1.92, valence: 3, maxCoord: 4 },
  6: { number: 6, symbol: 'C', name: 'Carbon', nameZh: '碳', mass: 12.011, color: '#909090', covRadius: 0.76, vdwRadius: 1.70, valence: 4, maxCoord: 4 },
  7: { number: 7, symbol: 'N', name: 'Nitrogen', nameZh: '氮', mass: 14.007, color: '#3050F8', covRadius: 0.71, vdwRadius: 1.55, valence: 3, maxCoord: 4 },
  8: { number: 8, symbol: 'O', name: 'Oxygen', nameZh: '氧', mass: 15.999, color: '#FF0D0D', covRadius: 0.66, vdwRadius: 1.52, valence: 2, maxCoord: 4 },
  9: { number: 9, symbol: 'F', name: 'Fluorine', nameZh: '氟', mass: 18.998, color: '#90E050', covRadius: 0.57, vdwRadius: 1.47, valence: 1, maxCoord: 1 },
  10: { number: 10, symbol: 'Ne', name: 'Neon', nameZh: '氖', mass: 20.180, color: '#B3E3F5', covRadius: 0.58, vdwRadius: 1.54, valence: 0, maxCoord: 0 },
  11: { number: 11, symbol: 'Na', name: 'Sodium', nameZh: '鈉', mass: 22.990, color: '#AB5CF2', covRadius: 1.66, vdwRadius: 2.27, valence: 1, maxCoord: 6 },
  12: { number: 12, symbol: 'Mg', name: 'Magnesium', nameZh: '鎂', mass: 24.305, color: '#8AFF00', covRadius: 1.41, vdwRadius: 1.73, valence: 2, maxCoord: 6 },
  13: { number: 13, symbol: 'Al', name: 'Aluminium', nameZh: '鋁', mass: 26.982, color: '#BFA6A6', covRadius: 1.21, vdwRadius: 1.84, valence: 3, maxCoord: 6 },
  14: { number: 14, symbol: 'Si', name: 'Silicon', nameZh: '矽', mass: 28.085, color: '#F0C8A0', covRadius: 1.11, vdwRadius: 2.10, valence: 4, maxCoord: 6 },
  15: { number: 15, symbol: 'P', name: 'Phosphorus', nameZh: '磷', mass: 30.974, color: '#FF8000', covRadius: 1.07, vdwRadius: 1.80, valence: 3, maxCoord: 6 },
  16: { number: 16, symbol: 'S', name: 'Sulfur', nameZh: '硫', mass: 32.06, color: '#FFFF30', covRadius: 1.05, vdwRadius: 1.80, valence: 2, maxCoord: 6 },
  17: { number: 17, symbol: 'Cl', name: 'Chlorine', nameZh: '氯', mass: 35.45, color: '#1FF01F', covRadius: 1.02, vdwRadius: 1.75, valence: 1, maxCoord: 1 },
  18: { number: 18, symbol: 'Ar', name: 'Argon', nameZh: '氬', mass: 39.948, color: '#80D1E3', covRadius: 1.06, vdwRadius: 1.88, valence: 0, maxCoord: 0 },
  19: { number: 19, symbol: 'K', name: 'Potassium', nameZh: '鉀', mass: 39.098, color: '#8F40D4', covRadius: 2.03, vdwRadius: 2.75, valence: 1, maxCoord: 6 },
  20: { number: 20, symbol: 'Ca', name: 'Calcium', nameZh: '鈣', mass: 40.078, color: '#3DFF00', covRadius: 1.76, vdwRadius: 2.31, valence: 2, maxCoord: 6 },
  21: { number: 21, symbol: 'Sc', name: 'Scandium', nameZh: '鈧', mass: 44.956, color: '#E6E6E6', covRadius: 1.70, vdwRadius: 2.11, valence: 3, maxCoord: 6 },
  22: { number: 22, symbol: 'Ti', name: 'Titanium', nameZh: '鈦', mass: 47.867, color: '#BFC2C7', covRadius: 1.60, vdwRadius: 2.15, valence: 4, maxCoord: 6 },
  23: { number: 23, symbol: 'V', name: 'Vanadium', nameZh: '釩', mass: 50.942, color: '#A6A6AB', covRadius: 1.53, vdwRadius: 2.05, valence: 5, maxCoord: 6 },
  24: { number: 24, symbol: 'Cr', name: 'Chromium', nameZh: '鉻', mass: 51.996, color: '#8A99C7', covRadius: 1.39, vdwRadius: 2.05, valence: 6, maxCoord: 6 },
  25: { number: 25, symbol: 'Mn', name: 'Manganese', nameZh: '錳', mass: 54.938, color: '#9C7AC7', covRadius: 1.39, vdwRadius: 2.05, valence: 4, maxCoord: 6 },
  26: { number: 26, symbol: 'Fe', name: 'Iron', nameZh: '鐵', mass: 55.845, color: '#E06633', covRadius: 1.32, vdwRadius: 2.05, valence: 3, maxCoord: 6 },
  27: { number: 27, symbol: 'Co', name: 'Cobalt', nameZh: '鈷', mass: 58.933, color: '#F090A0', covRadius: 1.26, vdwRadius: 2.00, valence: 3, maxCoord: 6 },
  28: { number: 28, symbol: 'Ni', name: 'Nickel', nameZh: '鎳', mass: 58.693, color: '#50D050', covRadius: 1.24, vdwRadius: 2.00, valence: 2, maxCoord: 6 },
  29: { number: 29, symbol: 'Cu', name: 'Copper', nameZh: '銅', mass: 63.546, color: '#C88033', covRadius: 1.32, vdwRadius: 2.00, valence: 2, maxCoord: 6 },
  30: { number: 30, symbol: 'Zn', name: 'Zinc', nameZh: '鋅', mass: 65.38, color: '#7D80B0', covRadius: 1.22, vdwRadius: 2.10, valence: 2, maxCoord: 4 },
  31: { number: 31, symbol: 'Ga', name: 'Gallium', nameZh: '鎵', mass: 69.723, color: '#C28F8F', covRadius: 1.22, vdwRadius: 1.87, valence: 3, maxCoord: 4 },
  32: { number: 32, symbol: 'Ge', name: 'Germanium', nameZh: '鍺', mass: 72.63, color: '#668F8F', covRadius: 1.20, vdwRadius: 2.11, valence: 4, maxCoord: 4 },
  33: { number: 33, symbol: 'As', name: 'Arsenic', nameZh: '砷', mass: 74.922, color: '#BD80E3', covRadius: 1.19, vdwRadius: 1.85, valence: 3, maxCoord: 6 },
  34: { number: 34, symbol: 'Se', name: 'Selenium', nameZh: '硒', mass: 78.971, color: '#FFA100', covRadius: 1.20, vdwRadius: 1.90, valence: 2, maxCoord: 6 },
  35: { number: 35, symbol: 'Br', name: 'Bromine', nameZh: '溴', mass: 79.904, color: '#A62929', covRadius: 1.20, vdwRadius: 1.85, valence: 1, maxCoord: 1 },
  36: { number: 36, symbol: 'Kr', name: 'Krypton', nameZh: '氪', mass: 83.798, color: '#5CB8D1', covRadius: 1.16, vdwRadius: 2.02, valence: 0, maxCoord: 0 },
  37: { number: 37, symbol: 'Rb', name: 'Rubidium', nameZh: '銣', mass: 85.468, color: '#702EB0', covRadius: 2.20, vdwRadius: 3.03, valence: 1, maxCoord: 6 },
  38: { number: 38, symbol: 'Sr', name: 'Strontium', nameZh: '鍶', mass: 87.62, color: '#00FF00', covRadius: 1.95, vdwRadius: 2.49, valence: 2, maxCoord: 6 },
  39: { number: 39, symbol: 'Y', name: 'Yttrium', nameZh: '釔', mass: 88.906, color: '#94FFFF', covRadius: 1.90, vdwRadius: 2.32, valence: 3, maxCoord: 6 },
  40: { number: 40, symbol: 'Zr', name: 'Zirconium', nameZh: '鋯', mass: 91.224, color: '#94E0E0', covRadius: 1.75, vdwRadius: 2.23, valence: 4, maxCoord: 6 },
  41: { number: 41, symbol: 'Nb', name: 'Niobium', nameZh: '鈮', mass: 92.906, color: '#73C2C9', covRadius: 1.64, vdwRadius: 2.18, valence: 5, maxCoord: 6 },
  42: { number: 42, symbol: 'Mo', name: 'Molybdenum', nameZh: '鉬', mass: 95.95, color: '#54B5B5', covRadius: 1.54, vdwRadius: 2.17, valence: 6, maxCoord: 6 },
  43: { number: 43, symbol: 'Tc', name: 'Technetium', nameZh: '鎝', mass: 98, color: '#3B9E9E', covRadius: 1.47, vdwRadius: 2.16, valence: 7, maxCoord: 6 },
  44: { number: 44, symbol: 'Ru', name: 'Ruthenium', nameZh: '釕', mass: 101.07, color: '#248F8F', covRadius: 1.46, vdwRadius: 2.13, valence: 4, maxCoord: 6 },
  45: { number: 45, symbol: 'Rh', name: 'Rhodium', nameZh: '銠', mass: 102.91, color: '#0A7D8C', covRadius: 1.42, vdwRadius: 2.10, valence: 3, maxCoord: 6 },
  46: { number: 46, symbol: 'Pd', name: 'Palladium', nameZh: '鈀', mass: 106.42, color: '#006985', covRadius: 1.39, vdwRadius: 2.10, valence: 2, maxCoord: 4 },
  47: { number: 47, symbol: 'Ag', name: 'Silver', nameZh: '銀', mass: 107.87, color: '#C0C0C0', covRadius: 1.45, vdwRadius: 2.11, valence: 1, maxCoord: 4 },
  48: { number: 48, symbol: 'Cd', name: 'Cadmium', nameZh: '鎘', mass: 112.41, color: '#FFD98F', covRadius: 1.44, vdwRadius: 2.18, valence: 2, maxCoord: 6 },
  49: { number: 49, symbol: 'In', name: 'Indium', nameZh: '銦', mass: 114.82, color: '#A67573', covRadius: 1.42, vdwRadius: 1.93, valence: 3, maxCoord: 6 },
  50: { number: 50, symbol: 'Sn', name: 'Tin', nameZh: '錫', mass: 118.71, color: '#668080', covRadius: 1.39, vdwRadius: 2.17, valence: 4, maxCoord: 6 },
  51: { number: 51, symbol: 'Sb', name: 'Antimony', nameZh: '銻', mass: 121.76, color: '#9E63B5', covRadius: 1.39, vdwRadius: 2.06, valence: 3, maxCoord: 6 },
  52: { number: 52, symbol: 'Te', name: 'Tellurium', nameZh: '碲', mass: 127.60, color: '#D47A00', covRadius: 1.38, vdwRadius: 2.06, valence: 2, maxCoord: 6 },
  53: { number: 53, symbol: 'I', name: 'Iodine', nameZh: '碘', mass: 126.90, color: '#940094', covRadius: 1.39, vdwRadius: 1.98, valence: 1, maxCoord: 1 },
  54: { number: 54, symbol: 'Xe', name: 'Xenon', nameZh: '氙', mass: 131.29, color: '#429EB0', covRadius: 1.40, vdwRadius: 2.16, valence: 0, maxCoord: 0 },
  55: { number: 55, symbol: 'Cs', name: 'Caesium', nameZh: '銫', mass: 132.91, color: '#57178F', covRadius: 2.44, vdwRadius: 3.43, valence: 1, maxCoord: 8 },
  56: { number: 56, symbol: 'Ba', name: 'Barium', nameZh: '鋇', mass: 137.33, color: '#00C900', covRadius: 2.15, vdwRadius: 2.68, valence: 2, maxCoord: 8 },
  57: { number: 57, symbol: 'La', name: 'Lanthanum', nameZh: '鑭', mass: 138.91, color: '#70D4FF', covRadius: 2.07, vdwRadius: 2.40, valence: 3, maxCoord: 6 },
  72: { number: 72, symbol: 'Hf', name: 'Hafnium', nameZh: '鉿', mass: 178.49, color: '#4DC2FF', covRadius: 1.75, vdwRadius: 2.23, valence: 4, maxCoord: 6 },
  73: { number: 73, symbol: 'Ta', name: 'Tantalum', nameZh: '鉭', mass: 180.95, color: '#4DA6FF', covRadius: 1.70, vdwRadius: 2.22, valence: 5, maxCoord: 6 },
  74: { number: 74, symbol: 'W', name: 'Tungsten', nameZh: '鎢', mass: 183.84, color: '#2194D6', covRadius: 1.62, vdwRadius: 2.18, valence: 6, maxCoord: 6 },
  75: { number: 75, symbol: 'Re', name: 'Rhenium', nameZh: '錸', mass: 186.21, color: '#267DAB', covRadius: 1.51, vdwRadius: 2.16, valence: 7, maxCoord: 6 },
  76: { number: 76, symbol: 'Os', name: 'Osmium', nameZh: '鋨', mass: 190.23, color: '#266696', covRadius: 1.44, vdwRadius: 2.16, valence: 4, maxCoord: 6 },
  77: { number: 77, symbol: 'Ir', name: 'Iridium', nameZh: '銥', mass: 192.22, color: '#175487', covRadius: 1.41, vdwRadius: 2.13, valence: 3, maxCoord: 6 },
  78: { number: 78, symbol: 'Pt', name: 'Platinum', nameZh: '鉑', mass: 195.08, color: '#D0D0E0', covRadius: 1.36, vdwRadius: 2.13, valence: 2, maxCoord: 6 },
  79: { number: 79, symbol: 'Au', name: 'Gold', nameZh: '金', mass: 196.97, color: '#FFD123', covRadius: 1.36, vdwRadius: 2.14, valence: 1, maxCoord: 4 },
  80: { number: 80, symbol: 'Hg', name: 'Mercury', nameZh: '汞', mass: 200.59, color: '#B8B8D0', covRadius: 1.32, vdwRadius: 2.23, valence: 2, maxCoord: 2 },
  81: { number: 81, symbol: 'Tl', name: 'Thallium', nameZh: '鉈', mass: 204.38, color: '#A6544D', covRadius: 1.45, vdwRadius: 1.96, valence: 1, maxCoord: 6 },
  82: { number: 82, symbol: 'Pb', name: 'Lead', nameZh: '鉛', mass: 207.2, color: '#575961', covRadius: 1.46, vdwRadius: 2.02, valence: 2, maxCoord: 6 },
  83: { number: 83, symbol: 'Bi', name: 'Bismuth', nameZh: '鉍', mass: 208.98, color: '#9E4FB5', covRadius: 1.48, vdwRadius: 2.07, valence: 3, maxCoord: 6 },
  92: { number: 92, symbol: 'U', name: 'Uranium', nameZh: '鈾', mass: 238.03, color: '#008FFF', covRadius: 1.96, vdwRadius: 1.86, valence: 6, maxCoord: 8 }
};

// 建立根據符號 (Symbol) 快速索引的字典
const SYMBOL_TO_ELEMENT = {};
for (const [num, elem] of Object.entries(ELEMENTS)) {
  SYMBOL_TO_ELEMENT[elem.symbol] = elem;
  SYMBOL_TO_ELEMENT[elem.symbol.toUpperCase()] = elem;
}

/**
 * 取得元素資訊，若不存在則提供合理的預設值
 * @param {string|number} symbolOrNumber 
 * @returns {object}
 */
function getElementInfo(symbolOrNumber) {
  if (typeof symbolOrNumber === 'number') {
    return ELEMENTS[symbolOrNumber] || {
      number: symbolOrNumber,
      symbol: `X${symbolOrNumber}`,
      name: 'Unknown',
      nameZh: '未知',
      mass: 1.0,
      color: '#FF00FF',
      covRadius: 1.20,
      vdwRadius: 1.70,
      valence: 0,
      maxCoord: 4
    };
  }
  const clean = String(symbolOrNumber).trim();
  const normalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  if (SYMBOL_TO_ELEMENT[normalized]) return SYMBOL_TO_ELEMENT[normalized];
  if (SYMBOL_TO_ELEMENT[clean.toUpperCase()]) return SYMBOL_TO_ELEMENT[clean.toUpperCase()];
  
  // 嘗試數字解析
  const num = parseInt(clean, 10);
  if (!isNaN(num) && ELEMENTS[num]) return ELEMENTS[num];

  return {
    number: 0,
    symbol: clean || 'X',
    name: clean || 'Unknown',
    nameZh: clean || '未知',
    mass: 12.0,
    color: '#E0E0E0',
    covRadius: 1.10,
    vdwRadius: 1.70,
    valence: 1,
    maxCoord: 4
  };
}

/**
 * 判斷兩原子之間是否形成化學鍵 (基於共價半徑總和 + tolerance)
 * @param {string} elemA 
 * @param {string} elemB 
 * @param {number} dist 距離 (Å)
 * @param {number} tolerance 允許誤差 (預設 0.40 Å)
 * @returns {boolean}
 */
function isBonded(elemA, elemB, dist, tolerance = 0.40) {
  const rA = getElementInfo(elemA).covRadius;
  const rB = getElementInfo(elemB).covRadius;
  const idealDist = rA + rB;
  return dist > 0.4 && dist <= (idealDist + tolerance);
}
