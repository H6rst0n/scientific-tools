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

    // ==========================================
    // 2. XYZ 族系優先處理（副檔名為 .xyz, .arc，或特徵符合 Tinker / Standard XYZ）
    // 兩者副檔名皆常為 .xyz，優先交由 XYZ 族系處理，防止被其他格式誤判
    // ==========================================
    if (ext === 'arc' || (ext === 'xyz' && this.isTinkerXYZ(cleanText))) {
      const sTinker = this.parseTinkerXYZ(text);
      if (sTinker.atoms.length > 0) return sTinker;
    }

    if (ext === 'xyz' && this.isStandardXYZ(cleanText)) {
      const sXYZ = this.parseXYZ(text);
      if (sXYZ.atoms.length > 0) return sXYZ;
    }

    if (ext === 'xyz') {
      const tryTinker = this.parseTinkerXYZ(text);
      if (tryTinker.atoms.length > 0) return tryTinker;
      const tryXYZ = this.parseXYZ(text);
      if (tryXYZ.atoms.length > 0) return tryXYZ;
    }

    // ==========================================
    // 3. 晶體與動力學格式 (VASP, LAMMPS, QE)
    // ==========================================
    if (ext === 'vasp' || filename.toUpperCase().includes('POSCAR') || filename.toUpperCase().includes('CONTCAR') || this.isVASP(cleanText)) {
      return this.parseVASP(text);
    }
    if (ext === 'data' || ext === 'lammps' || this.isLAMMPSData(cleanText)) {
      return this.parseLAMMPSData(text);
    }
    if (ext === 'lammpstrj' || ext === 'dump' || this.isLAMMPSDump(cleanText)) {
      return this.parseLAMMPSDump(text);
    }
    if (cleanText.includes('&CONTROL') || cleanText.includes('CELL_PARAMETERS') || cleanText.includes('ATOMIC_POSITIONS')) {
      return this.parseQE(text);
    }

    // ==========================================
    // 4. 無副檔名或未定格式時的內容判定
    // ==========================================
    if (this.isTinkerXYZ(cleanText)) {
      const sTinker = this.parseTinkerXYZ(text);
      if (sTinker.atoms.length > 0) return sTinker;
    }

    if (this.isStandardXYZ(cleanText)) {
      const sXYZ = this.parseXYZ(text);
      if (sXYZ.atoms.length > 0) return sXYZ;
    }

    // 5. 終極回退容錯
    const tryTinker = this.parseTinkerXYZ(text);
    if (tryTinker.atoms.length > 0) return tryTinker;

    return this.parseXYZ(text);
  },

  /**
   * 判斷是否為 VASP POSCAR
   */
  isVASP(text) {
    const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 8) return false;

    // 第 2 行 (lines[1]) 在 VASP POSCAR 中為晶格縮放因子 (universal scaling factor)
    // 必須為單一非零浮點數，絕不能是 6 個晶格參數
    const scaleTokens = lines[1].split(/\s+/);
    if (scaleTokens.length !== 1) return false;
    const scale = parseFloat(scaleTokens[0]);
    if (isNaN(scale) || scale === 0) return false;

    // 第 3-5 行 (lines[2..4]) 各為晶格基向量 a, b, c，每行必須有至少 3 個數值且全為浮點數
    for (let i = 2; i <= 4; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length < 3) return false;
      if (isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1])) || isNaN(parseFloat(parts[2]))) {
        return false;
      }
    }

    // 檢查第 6-9 行是否具備 VASP 特徵關鍵字 (Direct, Cartesian, Fractional, 或 Selective dynamics)
    let hasCoordKeyword = false;
    for (let i = 5; i < Math.min(10, lines.length); i++) {
      const lineLower = lines[i].toLowerCase();
      if (
        lineLower.includes('direct') ||
        lineLower.includes('cart') ||
        lineLower.includes('fractional') ||
        lineLower.includes('selective')
      ) {
        hasCoordKeyword = true;
        break;
      }
    }

    return hasCoordKeyword;
  },

  // ==========================================
  // 1. XYZ / Extended XYZ
  // ==========================================
  parseXYZ(text) {
    const structure = new Structure();
    const rawLines = text.split(/\r?\n/);
    if (rawLines.length < 3) return structure;

    let lineIdx = 0;
    let frameIdx = 0;

    while (lineIdx < rawLines.length) {
      // 尋找下一個非空行作為原子數行
      while (lineIdx < rawLines.length && !rawLines[lineIdx].trim()) {
        lineIdx++;
      }
      if (lineIdx >= rawLines.length) break;

      const nAtomsStr = rawLines[lineIdx].trim().split(/\s+/)[0];
      const natoms = parseInt(nAtomsStr, 10);
      if (isNaN(natoms) || natoms <= 0) break;
      lineIdx++;

      // 註解行 / 標題行
      const comment = (lineIdx < rawLines.length) ? rawLines[lineIdx].trim() : '';
      lineIdx++;

      // 檢查 Extended XYZ Lattice="ax ay az bx by bz cx cy cz"
      let frameCell = null;
      const latticeMatch = comment.match(/Lattice="([^"]+)"/i);
      if (latticeMatch) {
        const vals = latticeMatch[1].trim().split(/\s+/).map(Number);
        if (vals.length >= 9) {
          frameCell = [
            [vals[0], vals[1], vals[2]],
            [vals[3], vals[4], vals[5]],
            [vals[6], vals[7], vals[8]]
          ];
        }
      }

      // 讀取該影格的所有原子座標
      const framePositions = [];
      let atomsParsed = 0;

      while (lineIdx < rawLines.length && atomsParsed < natoms) {
        const line = rawLines[lineIdx].trim();
        lineIdx++;
        if (!line) continue;

        const tokens = line.split(/\s+/);
        if (tokens.length >= 4) {
          const elem = tokens[0];
          const x = parseFloat(tokens[1]);
          const y = parseFloat(tokens[2]);
          const z = parseFloat(tokens[3]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (frameIdx === 0) {
              structure.addAtom(elem, x, y, z);
            }
            framePositions.push({ x, y, z });
            atomsParsed++;
          }
        }
      }

      if (frameIdx === 0) {
        structure.title = comment || 'XYZ Structure';
        if (frameCell) {
          structure.setCell(frameCell, [true, true, true]);
        }
      }

      if (framePositions.length > 0) {
        structure.addTrajectoryFrame(framePositions, frameCell, {
          title: `Frame ${frameIdx + 1}`,
          comment: comment,
          timestep: frameIdx
        });
      }

      frameIdx++;
    }

    if (structure.atoms.length > 0) {
      structure.detectBonds();
    }

    // 若僅有單一影格，清除 trajectory 物件以保持單一結構簡潔
    if (structure.trajectory && structure.trajectory.frames.length <= 1) {
      structure.trajectory = null;
    }

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

    if (isDirect) {
      structure.syncFractionalFromCartesian();
    } else if (structure.atoms.some(a => a.x === null || a.x === undefined || isNaN(a.x))) {
      structure.syncCartesianFromFractional();
    }

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
    structure.syncCartesianFromFractional();
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
    const lines = text.split(/\r?\n/);
    let modelCount = 0;
    let currentModelPositions = [];
    let isMultiModel = false;

    const finishModel = () => {
      if (currentModelPositions.length > 0) {
        structure.addTrajectoryFrame(currentModelPositions, structure.cell, {
          title: `Model ${modelCount}`,
          timestep: modelCount - 1
        });
        currentModelPositions = [];
      }
    };

    for (const line of lines) {
      if (line.startsWith('MODEL')) {
        isMultiModel = true;
        finishModel();
        modelCount++;
      } else if (line.startsWith('ENDMDL')) {
        finishModel();
      } else if (line.startsWith('CRYST1')) {
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
          if (modelCount <= 1 && (!isMultiModel || structure.atoms.length === currentModelPositions.length)) {
            structure.addAtom(elem, x, y, z);
          }
          currentModelPositions.push({ x, y, z });
        }
      }
    }

    finishModel();

    structure.detectBonds();

    if (structure.trajectory && structure.trajectory.frames.length <= 1) {
      structure.trajectory = null;
    }

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
  },

  // ==========================================
  // 8. 輔助函數：原子質量對應元素 (Mass to Element)
  // ==========================================
  massToElement(mass) {
    if (!mass || isNaN(mass)) return 'C';
    const m = parseFloat(mass);
    const massTable = [
      { elem: 'H', m: 1.008 },
      { elem: 'He', m: 4.003 },
      { elem: 'Li', m: 6.94 },
      { elem: 'Be', m: 9.012 },
      { elem: 'B', m: 10.81 },
      { elem: 'C', m: 12.011 },
      { elem: 'N', m: 14.007 },
      { elem: 'O', m: 15.999 },
      { elem: 'F', m: 18.998 },
      { elem: 'Ne', m: 20.180 },
      { elem: 'Na', m: 22.990 },
      { elem: 'Mg', m: 24.305 },
      { elem: 'Al', m: 26.982 },
      { elem: 'Si', m: 28.085 },
      { elem: 'P', m: 30.974 },
      { elem: 'S', m: 32.06 },
      { elem: 'Cl', m: 35.45 },
      { elem: 'Ar', m: 39.948 },
      { elem: 'K', m: 39.098 },
      { elem: 'Ca', m: 40.078 },
      { elem: 'Sc', m: 44.956 },
      { elem: 'Ti', m: 47.867 },
      { elem: 'V', m: 50.942 },
      { elem: 'Cr', m: 51.996 },
      { elem: 'Mn', m: 54.938 },
      { elem: 'Fe', m: 55.845 },
      { elem: 'Co', m: 58.933 },
      { elem: 'Ni', m: 58.693 },
      { elem: 'Cu', m: 63.546 },
      { elem: 'Zn', m: 65.38 },
      { elem: 'Ga', m: 69.723 },
      { elem: 'Ge', m: 72.63 },
      { elem: 'As', m: 74.922 },
      { elem: 'Se', m: 78.971 },
      { elem: 'Br', m: 79.904 },
      { elem: 'Kr', m: 83.798 },
      { elem: 'Rb', m: 85.468 },
      { elem: 'Sr', m: 87.62 },
      { elem: 'Y', m: 88.906 },
      { elem: 'Zr', m: 91.224 },
      { elem: 'Mo', m: 95.95 },
      { elem: 'Ru', m: 101.07 },
      { elem: 'Rh', m: 102.91 },
      { elem: 'Pd', m: 106.42 },
      { elem: 'Ag', m: 107.87 },
      { elem: 'Cd', m: 112.41 },
      { elem: 'In', m: 114.82 },
      { elem: 'Sn', m: 118.71 },
      { elem: 'Sb', m: 121.76 },
      { elem: 'Te', m: 127.60 },
      { elem: 'I', m: 126.90 },
      { elem: 'Cs', m: 132.91 },
      { elem: 'Ba', m: 137.33 },
      { elem: 'La', m: 138.91 },
      { elem: 'W', m: 183.84 },
      { elem: 'Pt', m: 195.08 },
      { elem: 'Au', m: 196.97 },
      { elem: 'Hg', m: 200.59 },
      { elem: 'Pb', m: 207.2 }
    ];
    let bestElem = 'C';
    let minDiff = Infinity;
    for (const item of massTable) {
      const diff = Math.abs(item.m - m);
      if (diff < minDiff) {
        minDiff = diff;
        bestElem = item.elem;
      }
    }
    return bestElem;
  },

  // ==========================================
  // 9. Tinker XYZ 格式 (.arc / .xyz) 與 標準 XYZ 判定
  // ==========================================
  isTinkerXYZ(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return false;

    const firstTokens = lines[0].split(/\s+/);
    if (firstTokens.length < 1) return false;
    const nAtoms = parseInt(firstTokens[0], 10);
    if (isNaN(nAtoms) || nAtoms <= 0) return false;

    // 檢查第 2 行是否為 Tinker 週期性晶胞參數 (a, b, c, alpha, beta, gamma 共 6 個數值)
    let atomStartLine = 1;
    if (lines.length > 2) {
      const line1Tokens = lines[1].split(/\s+/);
      if (line1Tokens.length === 6 && line1Tokens.every(t => !isNaN(Number(t)))) {
        atomStartLine = 2;
      }
    }

    const linesToCheck = Math.min(5, lines.length - atomStartLine);
    if (linesToCheck <= 0) return false;

    let matchCount = 0;
    for (let i = 0; i < linesToCheck; i++) {
      const tokens = lines[atomStartLine + i].split(/\s+/);
      // Tinker 原子行至少包含 5 欄 (id, element, x, y, z)，標準格式具備 6 欄以上 (含 force field type 與鍵結)
      if (tokens.length < 5) return false;

      const atomId = parseInt(tokens[0], 10);
      // 首欄必須是遞增的正整數序號 (1, 2, 3...)
      const isIdValid = !isNaN(atomId) && atomId === (i + 1);

      // 第 2 欄為元素或原子名稱 (非純數字，且包含英文字母)
      const isNameValid = isNaN(Number(tokens[1])) && /[A-Za-z]/.test(tokens[1]);

      // 第 3, 4, 5 欄為 x, y, z 浮點座標
      const x = parseFloat(tokens[2]);
      const y = parseFloat(tokens[3]);
      const z = parseFloat(tokens[4]);
      const areCoordsValid = !isNaN(x) && !isNaN(y) && !isNaN(z);

      // 第 6 欄若存在，在 Tinker 中為原子類型整數
      const isTypeValid = (tokens.length >= 6) ? !isNaN(parseInt(tokens[5], 10)) : true;

      if (isIdValid && isNameValid && areCoordsValid && isTypeValid) {
        matchCount++;
      }
    }

    return matchCount === linesToCheck;
  },

  isStandardXYZ(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 3) return false;

    const firstTokens = lines[0].split(/\s+/);
    if (firstTokens.length < 1) return false;
    const nAtoms = parseInt(firstTokens[0], 10);
    if (isNaN(nAtoms) || nAtoms <= 0) return false;

    // 標準 XYZ 第 2 行為註解行，第 3 行起為原子座標行
    const linesToCheck = Math.min(5, lines.length - 2);
    if (linesToCheck <= 0) return false;

    let matchCount = 0;
    for (let i = 0; i < linesToCheck; i++) {
      const tokens = lines[2 + i].split(/\s+/);
      if (tokens.length < 4) return false;

      // 標準 XYZ 第 1 欄必須是化學元素符號 (非純數字，1~3 個英文字母)
      const isElemSymbol = isNaN(Number(tokens[0])) && /^[A-Za-z]{1,3}$/.test(tokens[0]);

      // 第 2, 3, 4 欄為 x, y, z 座標
      const x = parseFloat(tokens[1]);
      const y = parseFloat(tokens[2]);
      const z = parseFloat(tokens[3]);
      const areCoordsValid = !isNaN(x) && !isNaN(y) && !isNaN(z);

      if (isElemSymbol && areCoordsValid) {
        matchCount++;
      }
    }

    return matchCount === linesToCheck;
  },

  parseTinkerXYZ(text) {
    const structure = new Structure();
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length < 2) return structure;

    let lineIdx = 0;
    let frameIdx = 0;
    const bondsList = [];
    const idMap = new Map();

    while (lineIdx < rawLines.length) {
      const firstTokens = rawLines[lineIdx].split(/\s+/);
      const nAtoms = parseInt(firstTokens[0], 10);
      if (isNaN(nAtoms) || nAtoms <= 0) break;

      const frameTitle = rawLines[lineIdx].replace(firstTokens[0], '').trim() || (frameIdx === 0 ? 'Tinker Structure' : `Frame ${frameIdx + 1}`);
      lineIdx++;

      // 檢查第 2 行是否為 Tinker 週期性晶胞參數 (a, b, c, alpha, beta, gamma)
      let frameCell = null;
      if (lineIdx < rawLines.length) {
        const lineTokens = rawLines[lineIdx].split(/\s+/);
        if (lineTokens.length === 6 && lineTokens.every(t => !isNaN(Number(t)))) {
          const a = parseFloat(lineTokens[0]);
          const b = parseFloat(lineTokens[1]);
          const c = parseFloat(lineTokens[2]);
          const alpha = parseFloat(lineTokens[3]);
          const beta = parseFloat(lineTokens[4]);
          const gamma = parseFloat(lineTokens[5]);
          if (a > 0 && b > 0 && c > 0) {
            if (frameIdx === 0) {
              structure.setCellParameters(a, b, c, alpha, beta, gamma);
            }
            // 構建晶胞矩陣供影格記錄
            const toRad = Math.PI / 180;
            const aRad = alpha * toRad;
            const bRad = beta * toRad;
            const gRad = gamma * toRad;
            const ax = a, ay = 0, az = 0;
            const bx = b * Math.cos(gRad), by = b * Math.sin(gRad), bz = 0;
            const cx = c * Math.cos(bRad);
            const cy = c * (Math.cos(aRad) - Math.cos(bRad) * Math.cos(gRad)) / Math.sin(gRad);
            const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy));
            frameCell = [[ax, ay, az], [bx, by, bz], [cx, cy, cz]];
            lineIdx++;
          }
        }
      }

      const framePositions = [];
      let atomsParsed = 0;

      while (lineIdx < rawLines.length && atomsParsed < nAtoms) {
        const line = rawLines[lineIdx];
        lineIdx++;
        const tokens = line.split(/\s+/);
        if (tokens.length >= 5) {
          const atomId = parseInt(tokens[0], 10);
          let rawElem = tokens[1];
          let elem = rawElem.replace(/[^a-zA-Z]/g, '');
          if (elem.length > 2) {
            elem = elem.charAt(0);
          } else if (elem.length === 2) {
            const info = getElementInfo(elem);
            if (!info || info.name === elem) {
              elem = elem.charAt(0);
            }
          }
          if (!elem) elem = 'C';
          elem = elem.charAt(0).toUpperCase() + elem.slice(1).toLowerCase();

          const x = parseFloat(tokens[2]);
          const y = parseFloat(tokens[3]);
          const z = parseFloat(tokens[4]);

          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (frameIdx === 0) {
              structure.addAtom(elem, x, y, z);
              const curIdx = structure.atoms.length - 1;
              idMap.set(atomId, curIdx);

              // 讀取相連成鍵資訊 (第 7 欄起，1-indexed)
              if (tokens.length > 6) {
                for (let k = 6; k < tokens.length; k++) {
                  const neighborId = parseInt(tokens[k], 10);
                  if (!isNaN(neighborId)) {
                    bondsList.push({ aId: atomId, bId: neighborId });
                  }
                }
              }
            }
            framePositions.push({ x, y, z });
            atomsParsed++;
          }
        }
      }

      if (frameIdx === 0) {
        structure.title = frameTitle;
      }

      if (framePositions.length > 0) {
        structure.addTrajectoryFrame(framePositions, frameCell, {
          title: frameTitle,
          timestep: frameIdx
        });
      }

      frameIdx++;
    }

    if (bondsList.length > 0) {
      const bondSet = new Set();
      const finalBonds = [];
      for (const b of bondsList) {
        const idxA = idMap.get(b.aId);
        const idxB = idMap.get(b.bId);
        if (idxA !== undefined && idxB !== undefined && idxA !== idxB) {
          const min = Math.min(idxA, idxB);
          const max = Math.max(idxA, idxB);
          const key = `${min}-${max}`;
          if (!bondSet.has(key)) {
            bondSet.add(key);
            finalBonds.push({
              a: min,
              b: max,
              dist: structure.getDistance(min, max),
              order: 1
            });
          }
        }
      }
      structure.bonds = finalBonds;
    } else {
      structure.detectBonds();
    }

    if (structure.trajectory && structure.trajectory.frames.length <= 1) {
      structure.trajectory = null;
    }

    return structure;
  },

  exportTinkerXYZ(structure) {
    if (!structure.bonds || structure.bonds.length === 0) {
      structure.detectBonds();
    }
    const n = structure.atoms.length;
    let out = ` ${n}  ${structure.title || 'AtomCraft Tinker XYZ'}\n`;

    const neighbors = Array.from({ length: n }, () => []);
    for (const b of structure.bonds) {
      neighbors[b.a].push(b.b + 1);
      neighbors[b.b].push(b.a + 1);
    }

    for (let i = 0; i < n; i++) {
      const a = structure.atoms[i];
      const idStr = String(i + 1).padStart(6);
      const elemStr = a.element.padEnd(3);
      const xStr = a.x.toFixed(6).padStart(12);
      const yStr = a.y.toFixed(6).padStart(12);
      const zStr = a.z.toFixed(6).padStart(12);
      const typeStr = String(getElementInfo(a.element).number || 1).padStart(5);
      const connStr = neighbors[i].map(nbr => String(nbr).padStart(6)).join('');
      out += `${idStr}  ${elemStr} ${xStr} ${yStr} ${zStr} ${typeStr}${connStr}\n`;
    }
    return out;
  },

  massToElement(mass) {
    return inferElementFromMass(mass);
  },

  // ==========================================
  // 10. LAMMPS Data 格式 (.data / .lammps)
  // ==========================================
  isLAMMPSData(text) {
    const clean = text.toLowerCase();
    return (clean.includes('atoms') && (clean.includes('xlo xhi') || clean.includes('atom types') || clean.includes('masses')));
  },

  parseLAMMPSData(text) {
    const structure = new Structure();
    const lines = text.split('\n');
    let xlo = 0, xhi = 0, ylo = 0, yhi = 0, zlo = 0, zhi = 0;
    let xy = 0, xz = 0, yz = 0;
    let hasCell = false;

    const masses = {};
    let section = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      if (line.includes('xlo xhi')) {
        const p = line.split(/\s+/);
        xlo = parseFloat(p[0]); xhi = parseFloat(p[1]);
        hasCell = true;
      } else if (line.includes('ylo yhi')) {
        const p = line.split(/\s+/);
        ylo = parseFloat(p[0]); yhi = parseFloat(p[1]);
      } else if (line.includes('zlo zhi')) {
        const p = line.split(/\s+/);
        zlo = parseFloat(p[0]); zhi = parseFloat(p[1]);
      } else if (line.includes('xy xz yz')) {
        const p = line.split(/\s+/);
        xy = parseFloat(p[0]); xz = parseFloat(p[1]); yz = parseFloat(p[2]);
      } else if (line.startsWith('Masses')) {
        section = 'masses';
      } else if (line.startsWith('Atoms')) {
        section = 'atoms';
      } else if (['Velocities', 'Bonds', 'Angles', 'Dihedrals', 'Impropers'].some(s => line.startsWith(s))) {
        section = '';
      } else if (section === 'masses') {
        const p = line.split(/\s+/);
        if (p.length >= 2 && !isNaN(parseInt(p[0], 10))) {
          const typeId = parseInt(p[0], 10);
          const mass = parseFloat(p[1]);
          let elem = null;
          const hashIdx = line.indexOf('#');
          if (hashIdx !== -1) {
            const commentPart = line.substring(hashIdx + 1).trim().split(/\s+/)[0];
            if (commentPart && getElementInfo(commentPart).number) {
              elem = commentPart;
            }
          }
          masses[typeId] = elem || this.massToElement(mass);
        }
      } else if (section === 'atoms') {
        const p = line.split(/\s+/);
        if (p.length >= 5 && !isNaN(parseInt(p[0], 10))) {
          let type = 1;
          let x = 0, y = 0, z = 0;

          if (p.length === 5) {
            type = parseInt(p[1], 10);
            x = parseFloat(p[2]); y = parseFloat(p[3]); z = parseFloat(p[4]);
          } else if (p.length === 6) {
            type = parseInt(p[1], 10);
            x = parseFloat(p[3]); y = parseFloat(p[4]); z = parseFloat(p[5]);
          } else {
            type = parseInt(p[2], 10);
            x = parseFloat(p[4]); y = parseFloat(p[5]); z = parseFloat(p[6]);
          }

          const elem = masses[type] || 'C';
          structure.addAtom(elem, x, y, z);
        }
      }
    }

    if (hasCell) {
      const lx = xhi - xlo;
      const ly = yhi - ylo;
      const lz = zhi - zlo;
      structure.setCell([
        [lx, 0, 0],
        [xy, ly, 0],
        [xz, yz, lz]
      ], [true, true, true]);
    }

    structure.masses = masses;
    structure.detectBonds();
    return structure;
  },

  exportLAMMPSData(structure) {
    const n = structure.atoms.length;
    const elements = [...new Set(structure.atoms.map(a => a.element))];
    const elemToType = {};
    elements.forEach((elem, idx) => { elemToType[elem] = idx + 1; });

    let out = `LAMMPS data file generated by AtomCraft 3D\n\n`;
    out += `${n} atoms\n`;
    out += `${elements.length} atom types\n\n`;

    let lx = 20, ly = 20, lz = 20;
    if (structure.cell) {
      lx = structure.cell[0][0] || 20;
      ly = structure.cell[1][1] || 20;
      lz = structure.cell[2][2] || 20;
    }
    out += `0.000000 ${lx.toFixed(6)} xlo xhi\n`;
    out += `0.000000 ${ly.toFixed(6)} ylo yhi\n`;
    out += `0.000000 ${lz.toFixed(6)} zlo zhi\n\n`;

    out += `Masses\n\n`;
    elements.forEach((elem, idx) => {
      const info = getElementInfo(elem);
      const mass = info.mass || 12.011;
      out += `${idx + 1} ${mass.toFixed(4)}  # ${elem}\n`;
    });

    out += `\nAtoms # atomic\n\n`;
    for (let i = 0; i < n; i++) {
      const a = structure.atoms[i];
      const type = elemToType[a.element] || 1;
      out += `${i + 1} ${type} ${a.x.toFixed(6)} ${a.y.toFixed(6)} ${a.z.toFixed(6)}\n`;
    }

    return out;
  },

  // ==========================================
  // 11. LAMMPS Dump / Trajectory 格式 (.lammpstrj / .dump)
  // ==========================================
  isLAMMPSDump(text) {
    return text.includes('ITEM: TIMESTEP') && text.includes('ITEM: NUMBER OF ATOMS');
  },

  parseLAMMPSDump(text, typeMapping = null) {
    const structure = new Structure();
    const lines = text.split(/\r?\n/);
    let section = '';
    let xlo = 0, xhi = 0, ylo = 0, yhi = 0, zlo = 0, zhi = 0;
    let xy = 0, xz = 0, yz = 0;
    let isTriclinic = false;
    let boxLineCount = 0;
    let atomColumns = [];
    let isFractional = false;
    let currentTimestep = 0;
    let frameIdx = 0;
    let currentFramePositions = [];
    let currentFrameCell = null;
    const uniqueTypes = new Set();

    const typeDefaults = ['C', 'H', 'O', 'N', 'Li', 'Na', 'Si', 'Fe', 'Cu', 'Pt', 'Au', 'S', 'P', 'F', 'Cl'];

    const finishCurrentFrame = () => {
      if (currentFramePositions.length > 0) {
        structure.addTrajectoryFrame(currentFramePositions, currentFrameCell, {
          timestep: currentTimestep,
          title: `Timestep ${currentTimestep}`
        });
        currentFramePositions = [];
        frameIdx++;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('ITEM: TIMESTEP')) {
        finishCurrentFrame();
        section = 'timestep';
      } else if (line.startsWith('ITEM: NUMBER OF ATOMS')) {
        section = 'natoms';
      } else if (line.startsWith('ITEM: BOX BOUNDS')) {
        section = 'box';
        boxLineCount = 0;
        isTriclinic = line.includes('xy') || line.includes('xz') || line.includes('yz');
      } else if (line.startsWith('ITEM: ATOMS')) {
        section = 'atoms';
        atomColumns = line.replace('ITEM: ATOMS', '').trim().split(/\s+/);
        isFractional = atomColumns.includes('xs') || atomColumns.includes('ys') || atomColumns.includes('zs');
      } else if (section === 'timestep') {
        currentTimestep = parseInt(line, 10) || 0;
      } else if (section === 'box') {
        const p = line.split(/\s+/).map(Number);
        if (boxLineCount === 0) {
          xlo = p[0]; xhi = p[1];
          if (isTriclinic && p.length >= 3) xy = p[2];
        } else if (boxLineCount === 1) {
          ylo = p[0]; yhi = p[1];
          if (isTriclinic && p.length >= 3) xz = p[2];
        } else if (boxLineCount === 2) {
          zlo = p[0]; zhi = p[1];
          if (isTriclinic && p.length >= 3) yz = p[2];
        }
        boxLineCount++;
        if (boxLineCount === 3) {
          const lx = xhi - xlo;
          const ly = yhi - ylo;
          const lz = zhi - zlo;
          if (lx > 0 && ly > 0 && lz > 0) {
            currentFrameCell = [
              [lx, 0, 0],
              [xy, ly, 0],
              [xz, yz, lz]
            ];
            if (frameIdx === 0) {
              structure.setCell(currentFrameCell, [true, true, true]);
            }
          }
        }
      } else if (section === 'atoms') {
        const p = line.split(/\s+/);
        if (p.length < atomColumns.length) continue;

        const getCol = (name) => {
          const idx = atomColumns.indexOf(name);
          return idx !== -1 ? p[idx] : undefined;
        };

        const typeInt = parseInt(getCol('type') || '1', 10);
        if (!isNaN(typeInt)) uniqueTypes.add(typeInt);

        let elem = getCol('element') || getCol('name');
        if (!elem) {
          if (typeMapping && typeMapping[typeInt]) {
            elem = typeMapping[typeInt];
          } else {
            elem = typeDefaults[typeInt - 1] || `T${typeInt}`;
          }
        }

        let x = 0, y = 0, z = 0;
        const lx = xhi - xlo;
        const ly = yhi - ylo;
        const lz = zhi - zlo;

        if (isFractional) {
          const xs = parseFloat(getCol('xs') || '0');
          const ys = parseFloat(getCol('ys') || '0');
          const zs = parseFloat(getCol('zs') || '0');
          x = xlo + xs * lx;
          y = ylo + ys * ly;
          z = zlo + zs * lz;
        } else {
          x = parseFloat(getCol('x') || getCol('xu') || getCol('xsu') || '0');
          y = parseFloat(getCol('y') || getCol('yu') || getCol('ysu') || '0');
          z = parseFloat(getCol('z') || getCol('zu') || getCol('zsu') || '0');
        }

        if (frameIdx === 0) {
          const atom = structure.addAtom(elem, x, y, z);
          atom.lammpsType = typeInt;
        }
        currentFramePositions.push({ x, y, z });
      }
    }

    finishCurrentFrame();

    structure.lammpsTypes = Array.from(uniqueTypes).sort((a, b) => a - b);
    structure.title = `LAMMPS Trajectory (${structure.trajectory ? structure.trajectory.frames.length : 1} frames)`;

    if (structure.atoms.length > 0) {
      structure.detectBonds();
    }

    if (structure.trajectory && structure.trajectory.frames.length <= 1) {
      structure.trajectory = null;
    }

    return structure;
  }
};
