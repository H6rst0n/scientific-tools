/**
 * parsers.js - 計算化學與材料科學檔案格式解析器與匯出產生器
 * 支援格式：XYZ, ExtXYZ, Gaussian (.gjf/.com), ORCA (.inp), VASP (POSCAR),
 * Quantum ESPRESSO (pw.in), CIF, PDB
 */

const Parsers = {
  /**
   * 自動識別格式並載入結構
   */
  parse(text, filename = '') {
    const ext = filename.split('.').pop().toLowerCase();
    const cleanText = text.trim();

    if (ext === 'gjf' || ext === 'com' || cleanText.startsWith('%') || cleanText.startsWith('#')) {
      return this.parseGaussian(text);
    }
    if (ext === 'inp' || cleanText.includes('* xyz') || cleanText.startsWith('!')) {
      return this.parseORCA(text);
    }
    if (ext === 'cif' || cleanText.includes('_cell_length_') || cleanText.includes('data_')) {
      return this.parseCIF(text);
    }
    if (ext === 'pdb' || cleanText.includes('ATOM  ') || cleanText.includes('HETATM') || cleanText.startsWith('CRYST1')) {
      return this.parsePDB(text);
    }
    if (filename.toUpperCase().includes('POSCAR') || filename.toUpperCase().includes('CONTCAR') || this.isVASP(cleanText)) {
      return this.parseVASP(text);
    }
    if (cleanText.includes('&CONTROL') || cleanText.includes('CELL_PARAMETERS') || cleanText.includes('ATOMIC_POSITIONS')) {
      return this.parseQE(text);
    }

    // 預設嘗試 XYZ
    return this.parseXYZ(text);
  },

  /**
   * 判斷是否為 VASP POSCAR
   */
  isVASP(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 8) return false;
    const scale = parseFloat(lines[1].trim());
    if (isNaN(scale)) return false;
    // 第 3-5 行各應有 3 個浮點數
    for (let i = 2; i <= 4; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 3 || isNaN(parseFloat(parts[0]))) return false;
    }
    return true;
  },

  // ==========================================
  // 1. XYZ / Extended XYZ
  // ==========================================
  parseXYZ(text) {
    const structure = new Structure();
    const lines = text.trim().split('\n');
    if (lines.length < 3) return structure;

    const natoms = parseInt(lines[0].trim(), 10);
    const comment = lines[1].trim();
    structure.title = comment || 'XYZ Structure';

    // 檢查 Extended XYZ Lattice="ax ay az bx by bz cx cy cz"
    const latticeMatch = comment.match(/Lattice="([^"]+)"/i);
    if (latticeMatch) {
      const vals = latticeMatch[1].trim().split(/\s+/).map(Number);
      if (vals.length >= 9) {
        structure.setCell([
          [vals[0], vals[1], vals[2]],
          [vals[3], vals[4], vals[5]],
          [vals[6], vals[7], vals[8]]
        ], [true, true, true]);
      }
    }

    const start = 2;
    const end = isNaN(natoms) ? lines.length : Math.min(lines.length, start + natoms);

    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const tokens = line.split(/\s+/);
      if (tokens.length >= 4) {
        const elem = tokens[0];
        const x = parseFloat(tokens[1]);
        const y = parseFloat(tokens[2]);
        const z = parseFloat(tokens[3]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          structure.addAtom(elem, x, y, z);
        }
      }
    }
    structure.detectBonds();
    return structure;
  },

  exportXYZ(structure) {
    const n = structure.atoms.length;
    let comment = structure.title || 'Created with AtomCraft 3D';
    if (structure.cell) {
      const c = structure.cell;
      const latStr = `${c[0][0].toFixed(6)} ${c[0][1].toFixed(6)} ${c[0][2].toFixed(6)} ` +
                     `${c[1][0].toFixed(6)} ${c[1][1].toFixed(6)} ${c[1][2].toFixed(6)} ` +
                     `${c[2][0].toFixed(6)} ${c[2][1].toFixed(6)} ${c[2][2].toFixed(6)}`;
      comment = `Lattice="${latStr}" Properties=species:S:1:pos:R:3 ${structure.title || ''}`;
    }

    let out = `${n}\n${comment}\n`;
    for (const a of structure.atoms) {
      const sym = a.element.padEnd(3);
      const x = a.x.toFixed(6).padStart(12);
      const y = a.y.toFixed(6).padStart(12);
      const z = a.z.toFixed(6).padStart(12);
      out += `${sym} ${x} ${y} ${z}\n`;
    }
    return out;
  },

  // ==========================================
  // 2. Gaussian Input (.gjf / .com)
  // ==========================================
  parseGaussian(text) {
    const structure = new Structure();
    const lines = text.split('\n');
    let inCoords = false;
    let foundChargeMult = false;
    let titleLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line && !inCoords) continue;

      if (line.startsWith('%') || line.startsWith('#')) {
        continue;
      }

      // 檢查 Charge and Multiplicity (例如 "0 1")
      if (!foundChargeMult) {
        const cmMatch = line.match(/^([+-]?\d+)\s+([1-9]\d*)$/);
        if (cmMatch) {
          structure.charge = parseInt(cmMatch[1], 10);
          structure.multiplicity = parseInt(cmMatch[2], 10);
          foundChargeMult = true;
          inCoords = true;
          continue;
        }
      }

      if (inCoords) {
        if (!line) break; // 空行代表座標區結束
        const tokens = line.split(/\s+/);
        if (tokens.length >= 4) {
          const elem = tokens[0];
          // 檢查是否為 TV (週期性晶格向量)
          if (elem.toUpperCase() === 'TV') {
            if (!structure.cell) structure.cell = [];
            structure.cell.push([parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3])]);
            continue;
          }
          const x = parseFloat(tokens[tokens.length - 3]);
          const y = parseFloat(tokens[tokens.length - 2]);
          const z = parseFloat(tokens[tokens.length - 1]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            structure.addAtom(elem, x, y, z);
          }
        }
      }
    }

    if (structure.cell && structure.cell.length === 3) {
      structure.setCell(structure.cell, [true, true, true]);
    }

    structure.detectBonds();
    return structure;
  },

  exportGaussian(structure, options = {}) {
    const route = options.route || '#p opt b3lyp/6-31g(d)';
    const chk = options.chk || 'molecule.chk';
    const title = options.title || structure.title || 'Gaussian Calculation';
    const charge = options.charge !== undefined ? options.charge : structure.charge;
    const mult = options.mult !== undefined ? options.mult : structure.multiplicity;

    let out = `%chk=${chk}\n${route}\n\n${title}\n\n${charge} ${mult}\n`;
    for (const a of structure.atoms) {
      const sym = a.element.padEnd(3);
      const x = a.x.toFixed(6).padStart(14);
      const y = a.y.toFixed(6).padStart(14);
      const z = a.z.toFixed(6).padStart(14);
      out += `${sym} ${x} ${y} ${z}\n`;
    }

    if (structure.cell) {
      for (const row of structure.cell) {
        out += `TV  ${row[0].toFixed(6).padStart(14)} ${row[1].toFixed(6).padStart(14)} ${row[2].toFixed(6).padStart(14)}\n`;
      }
    }

    out += '\n\n';
    return out;
  },

  // ==========================================
  // 3. ORCA Input (.inp)
  // ==========================================
  parseORCA(text) {
    const structure = new Structure();
    const lines = text.split('\n');
    let inCoords = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const xyzStartMatch = line.match(/\*\s*xyz\s+([+-]?\d+)\s+([1-9]\d*)/i);
      if (xyzStartMatch) {
        structure.charge = parseInt(xyzStartMatch[1], 10);
        structure.multiplicity = parseInt(xyzStartMatch[2], 10);
        inCoords = true;
        continue;
      }

      if (inCoords) {
        if (line.startsWith('*')) {
          inCoords = false;
          break;
        }
        const tokens = line.split(/\s+/);
        if (tokens.length >= 4) {
          const elem = tokens[0];
          const x = parseFloat(tokens[1]);
          const y = parseFloat(tokens[2]);
          const z = parseFloat(tokens[3]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            structure.addAtom(elem, x, y, z);
          }
        }
      }
    }

    structure.detectBonds();
    return structure;
  },

  exportORCA(structure, options = {}) {
    const header = options.header || '! B3LYP def2-SVP Opt';
    const charge = options.charge !== undefined ? options.charge : structure.charge;
    const mult = options.mult !== undefined ? options.mult : structure.multiplicity;

    let out = `${header}\n\n* xyz ${charge} ${mult}\n`;
    for (const a of structure.atoms) {
      const sym = a.element.padEnd(3);
      const x = a.x.toFixed(6).padStart(14);
      const y = a.y.toFixed(6).padStart(14);
      const z = a.z.toFixed(6).padStart(14);
      out += `  ${sym} ${x} ${y} ${z}\n`;
    }
    out += '*\n';
    return out;
  },

  // ==========================================
  // 4. VASP POSCAR / CONTCAR
  // ==========================================
  parseVASP(text) {
    const structure = new Structure();
    const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 8) return structure;

    structure.title = lines[0];
    const scale = parseFloat(lines[1]);

    // 晶格向量 (行 2, 3, 4)
    const cell = [];
    for (let i = 2; i <= 4; i++) {
      const parts = lines[i].split(/\s+/).map(Number);
      cell.push([parts[0] * scale, parts[1] * scale, parts[2] * scale]);
    }
    structure.setCell(cell, [true, true, true]);

    let lineIdx = 5;
    let species = [];
    let counts = [];

    // 檢查第 5 行是否為元素符號 (VASP 5 格式)
    const tokens5 = lines[lineIdx].split(/\s+/);
    if (isNaN(parseInt(tokens5[0], 10))) {
      species = tokens5;
      lineIdx++;
      counts = lines[lineIdx].split(/\s+/).map(Number);
      lineIdx++;
    } else {
      // VASP 4 格式 (無符號行，預設依序給 X1, X2...)
      counts = tokens5.map(Number);
      species = counts.map((_, idx) => `E${idx + 1}`);
      lineIdx++;
    }

    // 檢查 Selective Dynamics
    let selectiveDynamics = false;
    if (lines[lineIdx].toLowerCase().startsWith('s')) {
      selectiveDynamics = true;
      lineIdx++;
    }

    // 檢查座標模式 (Direct / Cartesian)
    const coordMode = lines[lineIdx].toLowerCase().startsWith('d') ? 'direct' : 'cartesian';
    lineIdx++;

    for (let s = 0; s < species.length; s++) {
      const elem = species[s];
      const count = counts[s];
      for (let c = 0; c < count; c++) {
        if (lineIdx >= lines.length) break;
        const parts = lines[lineIdx].split(/\s+/);
        const c1 = parseFloat(parts[0]);
        const c2 = parseFloat(parts[1]);
        const c3 = parseFloat(parts[2]);

        let fixed = false;
        if (selectiveDynamics && parts.length >= 6) {
          fixed = (parts[3] === 'F' && parts[4] === 'F' && parts[5] === 'F');
        }

        if (coordMode === 'direct') {
          const atom = structure.addAtom(elem, null, null, null, c1, c2, c3);
          atom.fixed = fixed;
        } else {
          const atom = structure.addAtom(elem, c1 * scale, c2 * scale, c3 * scale);
          atom.fixed = fixed;
        }
        lineIdx++;
      }
    }

    structure.detectBonds();
    return structure;
  },

  exportVASP(structure, options = {}) {
    const isDirect = options.direct !== false;
    const title = structure.title || 'Generated by AtomCraft 3D';
    if (!structure.cell) {
      // 若無晶格向量，建立覆蓋分子的邊界虛擬晶胞
      const center = structure.getCenter();
      let maxDist = 15;
      for (const a of structure.atoms) {
        maxDist = Math.max(maxDist, Math.abs(a.x - center[0]) * 2 + 10, Math.abs(a.y - center[1]) * 2 + 10, Math.abs(a.z - center[2]) * 2 + 10);
      }
      structure.setCell([
        [maxDist, 0, 0],
        [0, maxDist, 0],
        [0, 0, maxDist]
      ], [true, true, true]);
    }

    // 依元素分類聚集
    const speciesMap = new Map();
    for (const a of structure.atoms) {
      if (!speciesMap.has(a.element)) speciesMap.set(a.element, []);
      speciesMap.get(a.element).push(a);
    }

    const species = Array.from(speciesMap.keys());
    const counts = species.map(s => speciesMap.get(s).length);

    let out = `${title}\n1.0\n`;
    for (const r of structure.cell) {
      out += `  ${r[0].toFixed(10).padStart(16)} ${r[1].toFixed(10).padStart(16)} ${r[2].toFixed(10).padStart(16)}\n`;
    }
    out += `  ${species.join('  ')}\n`;
    out += `  ${counts.join('  ')}\n`;

    const hasFixed = structure.atoms.some(a => a.fixed);
    if (hasFixed) out += 'Selective dynamics\n';
    out += isDirect ? 'Direct\n' : 'Cartesian\n';

    structure.syncFractionalFromCartesian();

    for (const elem of species) {
      const atoms = speciesMap.get(elem);
      for (const a of atoms) {
        const u = isDirect ? a.fx : a.x;
        const v = isDirect ? a.fy : a.y;
        const w = isDirect ? a.fz : a.z;
        let line = `  ${u.toFixed(10).padStart(16)} ${v.toFixed(10).padStart(16)} ${w.toFixed(10).padStart(16)}`;
        if (hasFixed) {
          line += a.fixed ? '   F   F   F' : '   T   T   T';
        }
        out += line + '\n';
      }
    }
    return out;
  },

  // ==========================================
  // 5. Quantum ESPRESSO (pw.in)
  // ==========================================
  parseQE(text) {
    const structure = new Structure();
    const lines = text.split('\n');
    let inCell = false;
    let inPositions = false;
    let posType = 'angstrom';
    const cellRows = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('!') || line.startsWith('#')) continue;

      if (line.toUpperCase().startsWith('CELL_PARAMETERS')) {
        inCell = true;
        inPositions = false;
        continue;
      }
      if (line.toUpperCase().startsWith('ATOMIC_POSITIONS')) {
        inPositions = true;
        inCell = false;
        posType = line.toLowerCase().includes('crystal') ? 'crystal' : 'angstrom';
        continue;
      }

      if (inCell) {
        const parts = line.split(/\s+/).map(Number);
        if (parts.length >= 3 && !isNaN(parts[0])) {
          cellRows.push([parts[0], parts[1], parts[2]]);
          if (cellRows.length === 3) {
            structure.setCell(cellRows, [true, true, true]);
            inCell = false;
          }
        }
      } else if (inPositions) {
        if (line.startsWith('&') || line.startsWith('/')) {
          inPositions = false;
          continue;
        }
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const elem = parts[0];
          const x = parseFloat(parts[1]);
          const y = parseFloat(parts[2]);
          const z = parseFloat(parts[3]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (posType === 'crystal') {
              structure.addAtom(elem, null, null, null, x, y, z);
            } else {
              structure.addAtom(elem, x, y, z);
            }
          }
        }
      }
    }

    structure.detectBonds();
    return structure;
  },

  exportQE(structure) {
    const species = Array.from(new Set(structure.atoms.map(a => a.element)));
    let out = `&CONTROL\n  calculation = 'scf',\n  prefix = 'atomcraft',\n/\n&SYSTEM\n  ibrav = 0,\n  nat = ${structure.atoms.length},\n  ntyp = ${species.length},\n/\n&ELECTRONS\n/\nATOMIC_SPECIES\n`;
    for (const elem of species) {
      const info = getElementInfo(elem);
      out += `  ${elem.padEnd(3)} ${info.mass.toFixed(3).padStart(8)} ${elem}.pbe-n-kjpaw_psl.1.0.0.UPF\n`;
    }

    if (structure.cell) {
      out += '\nCELL_PARAMETERS angstrom\n';
      for (const r of structure.cell) {
        out += `  ${r[0].toFixed(8).padStart(14)} ${r[1].toFixed(8).padStart(14)} ${r[2].toFixed(8).padStart(14)}\n`;
      }
      out += '\nATOMIC_POSITIONS crystal\n';
      structure.syncFractionalFromCartesian();
      for (const a of structure.atoms) {
        out += `  ${a.element.padEnd(3)} ${a.fx.toFixed(8).padStart(14)} ${a.fy.toFixed(8).padStart(14)} ${a.fz.toFixed(8).padStart(14)}\n`;
      }
    } else {
      out += '\nATOMIC_POSITIONS angstrom\n';
      for (const a of structure.atoms) {
        out += `  ${a.element.padEnd(3)} ${a.x.toFixed(8).padStart(14)} ${a.y.toFixed(8).padStart(14)} ${a.z.toFixed(8).padStart(14)}\n`;
      }
    }
    return out;
  },

  // ==========================================
  // 6. CIF (Crystallographic Information File)
  // ==========================================
  parseCIF(text) {
    const structure = new Structure();
    const lines = text.split('\n');

    let a = 10, b = 10, c = 10, alpha = 90, beta = 90, gamma = 90;
    let inLoop = false;
    let loopFields = [];
    const cleanNum = str => parseFloat(str.replace(/\(.*?\)/g, ''));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('_cell_length_a')) a = cleanNum(line.split(/\s+/)[1]);
      else if (line.startsWith('_cell_length_b')) b = cleanNum(line.split(/\s+/)[1]);
      else if (line.startsWith('_cell_length_c')) c = cleanNum(line.split(/\s+/)[1]);
      else if (line.startsWith('_cell_angle_alpha')) alpha = cleanNum(line.split(/\s+/)[1]);
      else if (line.startsWith('_cell_angle_beta')) beta = cleanNum(line.split(/\s+/)[1]);
      else if (line.startsWith('_cell_angle_gamma')) gamma = cleanNum(line.split(/\s+/)[1]);

      if (line.startsWith('loop_')) {
        inLoop = true;
        loopFields = [];
        continue;
      }

      if (inLoop) {
        if (line.startsWith('_')) {
          loopFields.push(line);
        } else {
          // 資料行
          const parts = line.split(/\s+/);
          if (parts.length >= loopFields.length && loopFields.some(f => f.includes('atom_site'))) {
            let elem = 'C', fx = 0, fy = 0, fz = 0;
            for (let k = 0; k < loopFields.length; k++) {
              const field = loopFields[k];
              const val = parts[k];
              if (field.includes('_atom_site_type_symbol') || field.includes('_atom_site_label')) {
                elem = val.replace(/[^a-zA-Z]/g, '');
              } else if (field.includes('_atom_site_fract_x')) {
                fx = cleanNum(val);
              } else if (field.includes('_atom_site_fract_y')) {
                fy = cleanNum(val);
              } else if (field.includes('_atom_site_fract_z')) {
                fz = cleanNum(val);
              }
            }
            if (!isNaN(fx) && !isNaN(fy) && !isNaN(fz)) {
              structure.addAtom(elem, null, null, null, fx, fy, fz);
            }
          }
        }
      }
    }

    structure.setCellParameters(a, b, c, alpha, beta, gamma, [true, true, true]);
    structure.detectBonds();
    return structure;
  },

  exportCIF(structure) {
    const params = structure.getCellParameters() || { a: 10, b: 10, c: 10, alpha: 90, beta: 90, gamma: 90 };
    structure.syncFractionalFromCartesian();

    let out = `data_atomcraft_structure\n_audit_creation_method 'AtomCraft 3D'\n\n` +
              `_cell_length_a     ${params.a.toFixed(5)}\n` +
              `_cell_length_b     ${params.b.toFixed(5)}\n` +
              `_cell_length_c     ${params.c.toFixed(5)}\n` +
              `_cell_angle_alpha  ${params.alpha.toFixed(3)}\n` +
              `_cell_angle_beta   ${params.beta.toFixed(3)}\n` +
              `_cell_angle_gamma  ${params.gamma.toFixed(3)}\n` +
              `_symmetry_space_group_name_H-M 'P 1'\n` +
              `_symmetry_Int_Tables_number 1\n\n` +
              `loop_\n` +
              `  _atom_site_label\n` +
              `  _atom_site_type_symbol\n` +
              `  _atom_site_fract_x\n` +
              `  _atom_site_fract_y\n` +
              `  _atom_site_fract_z\n`;

    for (let i = 0; i < structure.atoms.length; i++) {
      const a = structure.atoms[i];
      const lbl = `${a.element}${i + 1}`;
      out += `  ${lbl.padEnd(8)} ${a.element.padEnd(4)} ${a.fx.toFixed(6).padStart(12)} ${a.fy.toFixed(6).padStart(12)} ${a.fz.toFixed(6).padStart(12)}\n`;
    }
    return out;
  },

  // ==========================================
  // 7. PDB
  // ==========================================
  parsePDB(text) {
    const structure = new Structure();
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('CRYST1')) {
        const a = parseFloat(line.substring(6, 15));
        const b = parseFloat(line.substring(15, 24));
        const c = parseFloat(line.substring(24, 33));
        const alpha = parseFloat(line.substring(33, 40)) || 90;
        const beta = parseFloat(line.substring(40, 47)) || 90;
        const gamma = parseFloat(line.substring(47, 54)) || 90;
        if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
          structure.setCellParameters(a, b, c, alpha, beta, gamma, [true, true, true]);
        }
      } else if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
        const x = parseFloat(line.substring(30, 38));
        const y = parseFloat(line.substring(38, 46));
        const z = parseFloat(line.substring(46, 54));
        let elem = line.substring(76, 78).trim();
        if (!elem) {
          elem = line.substring(12, 16).trim().replace(/[^a-zA-Z]/g, '');
        }
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          structure.addAtom(elem, x, y, z);
        }
      }
    }

    structure.detectBonds();
    return structure;
  },

  exportPDB(structure) {
    let out = `HEADER    ATOMCRAFT 3D STRUCTURE\n`;
    if (structure.cell) {
      const p = structure.getCellParameters();
      const aStr = p.a.toFixed(3).padStart(9);
      const bStr = p.b.toFixed(3).padStart(9);
      const cStr = p.c.toFixed(3).padStart(9);
      const alStr = p.alpha.toFixed(2).padStart(7);
      const beStr = p.beta.toFixed(2).padStart(7);
      const gaStr = p.gamma.toFixed(2).padStart(7);
      out += `CRYST1${aStr}${bStr}${cStr}${alStr}${beStr}${gaStr} P 1\n`;
    }

    for (let i = 0; i < structure.atoms.length; i++) {
      const a = structure.atoms[i];
      const serial = String((i + 1) % 100000).padStart(5);
      const name = a.element.padEnd(4);
      const x = a.x.toFixed(3).padStart(8);
      const y = a.y.toFixed(3).padStart(8);
      const z = a.z.toFixed(3).padStart(8);
      const sym = a.element.padStart(2);
      out += `HETATM${serial} ${name} MOL A   1    ${x}${y}${z}  1.00  0.00          ${sym}\n`;
    }
    out += 'END\n';
    return out;
  }
};
