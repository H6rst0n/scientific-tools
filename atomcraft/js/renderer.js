/**
 * renderer.js - Three.js 高效能 3D 分子與晶格渲染引擎
 * 採用 GPU 實例化技術 (THREE.InstancedMesh)，支援數萬至數十萬原子流暢 60 FPS 渲染
 */

class MoleculeRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.style = 'ball_and_stick'; // 'ball_and_stick' | 'spacefill' | 'stick' | 'wireframe'
    
    // 視覺擴胞設定 (Visual Expansion)
    this.visualReplicas = [1, 1, 1]; // [na, nb, nc]
    this.showCellBox = true;
    this.showAxes = true;

    // Three.js 核心物件
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // 實例化網格
    this.atomMesh = null;
    this.bondMesh = null;
    this.cellLines = null;
    this.selectionGroup = null;
    this.measurementGroup = null;
    this.cleavePreviewGroup = null;

    // 拾取射線
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 幾何體快取
    this.sphereGeo = new THREE.SphereGeometry(1, 24, 20);
    this.cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
    this.cylinderGeo.translate(0, 0.5, 0); // 將基底對齊原點以利定位
    this.cylinderGeo.rotateX(Math.PI / 2); // 旋轉為沿 Z 軸

    // 材質
    this.atomMaterial = new THREE.MeshPhongMaterial({
      shininess: 60,
      specular: 0x444444
    });
    this.bondMaterial = new THREE.MeshPhongMaterial({
      color: 0x9e9e9e,
      shininess: 40
    });

    // 視角控制器與輔助器
    this.axesHelper = null;
    this.isRendering = true;

    // 自訂外觀與樣式屬性
    this.spacefillScale = 1.0;
    this.elementOverrides = {}; // { 'Li': { color: '#...', radiusScale: 1.2 } }
    this.backgroundColor = '#131722';
    this.currentStructure = null;

    this.init();
  }

  init() {
    const width = (this.container && this.container.clientWidth) || window.innerWidth || 800;
    const height = (this.container && this.container.clientHeight) || window.innerHeight || 600;

    // 1. 場景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x131722); // 質感深色科研背景

    // 2. 相機 (同時配置透視與正交相機，支援一鍵切換)
    this.isOrthographic = false;
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    this.perspectiveCamera.position.set(0, 0, 30);

    this.orthographicCamera = new THREE.OrthographicCamera(-15, 15, 15, -15, 0.1, 2000);
    this.orthographicCamera.position.set(0, 0, 30);

    this.camera = this.perspectiveCamera;

    // 3. WebGL 渲染器 (強制啟用獨立顯卡硬體加速)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    if (this.container) {
      this.container.appendChild(this.renderer.domElement);
    }

    // 4. 軌道控制器 (已全面解鎖極限位，支援 GaussView/MS 等級無死角 3D 自由旋轉)
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.unconstrainedRotation = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;

    // 5. 光照系統
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight1.position.set(30, 40, 50);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xaaccff, 0.35);
    dirLight2.position.set(-30, -40, -50);
    this.scene.add(dirLight2);

    // 6. 輔助群組
    this.selectionGroup = new THREE.Group();
    this.scene.add(this.selectionGroup);

    this.measurementGroup = new THREE.Group();
    this.scene.add(this.measurementGroup);

    this.cleavePreviewGroup = new THREE.Group();
    this.scene.add(this.cleavePreviewGroup);

    // 7. 坐標軸
    this.axesHelper = new THREE.AxesHelper(3);
    this.axesHelper.position.set(-15, -10, 0);
    this.scene.add(this.axesHelper);

    // 8. 視窗尺寸改變監聽
    window.addEventListener('resize', () => this.onResize());

    // 啟動渲染循環
    this.animate();
  }

  /**
   * 切換相機投影模式 (透視 vs 正交)
   */
  setProjection(isOrtho) {
    if (this.isOrthographic === isOrtho) return;
    this.isOrthographic = isOrtho;

    const width = (this.container && this.container.clientWidth) || window.innerWidth || 800;
    const height = (this.container && this.container.clientHeight) || window.innerHeight || 600;
    const aspect = width / height;

    const dist = this.camera.position.distanceTo(this.controls.target) || 30;

    if (isOrtho) {
      // 切換至正交相機
      const halfH = dist * Math.tan((22.5 * Math.PI) / 180);
      this.orthographicCamera.left = -halfH * aspect;
      this.orthographicCamera.right = halfH * aspect;
      this.orthographicCamera.top = halfH;
      this.orthographicCamera.bottom = -halfH;
      this.orthographicCamera.position.copy(this.perspectiveCamera.position);
      this.orthographicCamera.quaternion.copy(this.perspectiveCamera.quaternion);
      this.orthographicCamera.updateProjectionMatrix();

      this.camera = this.orthographicCamera;
      this.controls.object = this.orthographicCamera;
    } else {
      // 切換至透視相機
      this.perspectiveCamera.position.copy(this.orthographicCamera.position);
      this.perspectiveCamera.quaternion.copy(this.orthographicCamera.quaternion);
      this.perspectiveCamera.aspect = aspect;
      this.perspectiveCamera.updateProjectionMatrix();

      this.camera = this.perspectiveCamera;
      this.controls.object = this.perspectiveCamera;
    }
    this.controls.update();
  }

  onResize() {
    const width = (this.container && this.container.clientWidth) || window.innerWidth || 800;
    const height = (this.container && this.container.clientHeight) || window.innerHeight || 600;
    if (width === 0 || height === 0) return;
    const aspect = width / height;

    if (this.isOrthographic) {
      const dist = this.camera.position.distanceTo(this.controls.target) || 30;
      const halfH = dist * Math.tan((22.5 * Math.PI) / 180);
      this.orthographicCamera.left = -halfH * aspect;
      this.orthographicCamera.right = halfH * aspect;
      this.orthographicCamera.top = halfH;
      this.orthographicCamera.bottom = -halfH;
      this.orthographicCamera.updateProjectionMatrix();
    } else {
      this.perspectiveCamera.aspect = aspect;
      this.perspectiveCamera.updateProjectionMatrix();
    }
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.isRendering) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 設定渲染樣式
   * @param {'ball_and_stick' | 'spacefill' | 'stick' | 'wireframe'} style 
   */
  setStyle(style) {
    this.style = style;
  }

  /**
   * 取得原子顯示半徑 (Å)
   */
  getAtomRadius(elem, atom = null) {
    const info = getElementInfo(elem);
    let r = 0.3;
    if (this.style === 'spacefill') {
      r = info.vdwRadius * 0.75 * this.spacefillScale;
    } else if (this.style === 'stick') {
      r = 0.22;
    } else if (this.style === 'wireframe') {
      r = 0.10;
    } else {
      // ball_and_stick
      r = Math.max(0.25, info.covRadius * 0.42);
    }

    // 1. 全域特定元素自訂縮放倍率
    const elemOverride = this.elementOverrides[elem];
    if (elemOverride && elemOverride.radiusScale !== undefined) {
      r *= elemOverride.radiusScale;
    }

    // 2. 個別原子單獨自訂縮放倍率 (優先級最高)
    if (atom && atom.customRadius !== undefined && atom.customRadius !== null) {
      r *= atom.customRadius;
    }
    return r;
  }

  /**
   * 取得原子顯示顏色
   */
  getAtomColor(elem, atom = null) {
    // 1. 個別原子單獨自訂顏色 (優先級最高)
    if (atom && atom.customColor) {
      return atom.customColor;
    }
    // 2. 全域特定元素自訂顏色
    const elemOverride = this.elementOverrides[elem];
    if (elemOverride && elemOverride.color) {
      return elemOverride.color;
    }
    // 3. 預設 CPK 元素色彩
    const info = getElementInfo(elem);
    return info.color;
  }

  /**
   * 設定場景背景顏色
   */
  setBackgroundColor(colorHex) {
    this.backgroundColor = colorHex;
    if (this.scene) {
      this.scene.background = new THREE.Color(colorHex);
    }
  }

  /**
   * 設定空間填充縮放倍率
   */
  setSpacefillScale(scale) {
    this.spacefillScale = Math.max(0.1, Math.min(3.0, Number(scale) || 1.0));
    if (this.currentStructure) {
      this.update(this.currentStructure);
    }
  }

  /**
   * 設定特定元素的全域顏色或尺寸覆寫
   */
  setElementOverride(elem, opts = {}) {
    if (!this.elementOverrides[elem]) this.elementOverrides[elem] = {};
    if (opts.color !== undefined) this.elementOverrides[elem].color = opts.color;
    if (opts.radiusScale !== undefined) this.elementOverrides[elem].radiusScale = opts.radiusScale;
    if (this.currentStructure) {
      this.update(this.currentStructure);
    }
  }

  /**
   * 清除特定元素的全域樣式覆寫
   */
  clearElementOverride(elem) {
    delete this.elementOverrides[elem];
    if (this.currentStructure) {
      this.update(this.currentStructure);
    }
  }

  /**
   * 取得化學鍵顯示半徑 (Å)
   */
  getBondRadius() {
    if (this.style === 'spacefill') return 0;
    if (this.style === 'stick') return 0.16;
    if (this.style === 'wireframe') return 0.04;
    return 0.10; // ball_and_stick
  }

  /**
   * 更新分子與晶格 3D 渲染 (核心渲染函數)
   */
  update(structure) {
    this.currentStructure = structure;
    // 1. 清除舊有的 InstancedMesh 與晶格邊框
    if (this.atomMesh) {
      this.scene.remove(this.atomMesh);
      this.atomMesh.geometry.dispose();
      this.atomMesh = null;
    }
    if (this.bondMesh) {
      this.scene.remove(this.bondMesh);
      this.bondMesh.geometry.dispose();
      this.bondMesh = null;
    }
    if (this.cellLines) {
      this.scene.remove(this.cellLines);
      this.cellLines.geometry.dispose();
      this.cellLines = null;
    }
    // 清除選取光圈
    while (this.selectionGroup.children.length > 0) {
      const obj = this.selectionGroup.children[0];
      this.selectionGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
    }

    const nAtoms = structure.atoms.length;
    if (nAtoms === 0) return;

    // 2. 確定週期性視覺擴胞數
    const [na, nb, nc] = structure.cell ? this.visualReplicas : [1, 1, 1];
    const totalReplicas = na * nb * nc;
    const totalAtomInstances = nAtoms * totalReplicas;

    // 3. 建立原子 InstancedMesh
    this.atomMesh = new THREE.InstancedMesh(this.sphereGeo, this.atomMaterial, totalAtomInstances);
    this.atomMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let instIdx = 0;

    const cell = structure.cell;
    const hasCell = !!cell;

    for (let ia = 0; ia < na; ia++) {
      for (let ib = 0; ib < nb; ib++) {
        for (let ic = 0; ic < nc; ic++) {
          const shiftX = hasCell ? ia * cell[0][0] + ib * cell[1][0] + ic * cell[2][0] : 0;
          const shiftY = hasCell ? ia * cell[0][1] + ib * cell[1][1] + ic * cell[2][1] : 0;
          const shiftZ = hasCell ? ia * cell[0][2] + ib * cell[1][2] + ic * cell[2][2] : 0;
          const isBaseCell = (ia === 0 && ib === 0 && ic === 0);

          for (let i = 0; i < nAtoms; i++) {
            const a = structure.atoms[i];
            const r = this.getAtomRadius(a.element, a);
            const posX = a.x + shiftX;
            const posY = a.y + shiftY;
            const posZ = a.z + shiftZ;

            dummy.position.set(posX, posY, posZ);
            dummy.scale.set(r, r, r);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();

            this.atomMesh.setMatrixAt(instIdx, dummy.matrix);

            // 設定顏色 (支援個別原子及特定元素自訂覆寫)
            color.set(this.getAtomColor(a.element, a));
            // 若為視覺擴胞的副本，稍微降低飽和度以區分原胞
            if (!isBaseCell) {
              color.lerp(new THREE.Color(0x334155), 0.35);
            }
            this.atomMesh.setColorAt(instIdx, color);

            // 如果選中且在基礎晶胞內，加選取光環
            if (a.selected && isBaseCell) {
              this.createSelectionHighlight(posX, posY, posZ, r * 1.25);
            }

            instIdx++;
          }
        }
      }
    }

    this.atomMesh.instanceMatrix.needsUpdate = true;
    if (this.atomMesh.instanceColor) this.atomMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.atomMesh);

    // 4. 建立化學鍵 InstancedMesh
    if (this.style !== 'spacefill') {
      const bonds = structure.bonds.length > 0 ? structure.bonds : structure.detectBonds();
      const nBonds = bonds.length;
      const bondRadius = this.getBondRadius();

      if (nBonds > 0) {
        const renderedBonds = new Set();
        const maxPossibleBonds = Math.max(nBonds * totalReplicas * 6, 200);
        this.bondMesh = new THREE.InstancedMesh(this.cylinderGeo, this.bondMaterial, maxPossibleBonds);
        this.bondMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        let bondInstIdx = 0;
        const bondColor = new THREE.Color(0x94a3b8);
        const hbColor = new THREE.Color(0x38bdf8); // 氫鍵亮青色

        for (let ia = 0; ia < na; ia++) {
          for (let ib = 0; ib < nb; ib++) {
            for (let ic = 0; ic < nc; ic++) {
              const shiftAX = hasCell ? ia * cell[0][0] + ib * cell[1][0] + ic * cell[2][0] : 0;
              const shiftAY = hasCell ? ia * cell[0][1] + ib * cell[1][1] + ic * cell[2][1] : 0;
              const shiftAZ = hasCell ? ia * cell[0][2] + ib * cell[1][2] + ic * cell[2][2] : 0;

              for (let b = 0; b < nBonds; b++) {
                const bond = bonds[b];
                if (bond.order === 0) continue; // 無鍵結不繪製

                const atomA = structure.atoms[bond.a];
                const atomB = structure.atoms[bond.b];
                if (!atomA || !atomB) continue;

                const [offA, offB, offC] = bond.offset || [0, 0, 0];
                const ja = ia + offA;
                const jb = ib + offB;
                const jc = ic + offC;

                // 跨胞鍵：當相鄰原子落在視覺擴胞範圍內時，繪製連接兩晶胞的鍵結
                if (hasCell) {
                  if (ja < 0 || ja >= na || jb < 0 || jb >= nb || jc < 0 || jc >= nc) {
                    continue;
                  }
                }

                // 去除週期重複鍵
                const key1 = `${ia},${ib},${ic},${bond.a}_${ja},${jb},${jc},${bond.b}`;
                const key2 = `${ja},${jb},${jc},${bond.b}_${ia},${ib},${ic},${bond.a}`;
                if (renderedBonds.has(key1) || renderedBonds.has(key2)) continue;
                renderedBonds.add(key1);

                const shiftBX = hasCell ? ja * cell[0][0] + jb * cell[1][0] + jc * cell[2][0] : 0;
                const shiftBY = hasCell ? ja * cell[0][1] + jb * cell[1][1] + jc * cell[2][1] : 0;
                const shiftBZ = hasCell ? ja * cell[0][2] + jb * cell[1][2] + jc * cell[2][2] : 0;

                const pA = new THREE.Vector3(atomA.x + shiftAX, atomA.y + shiftAY, atomA.z + shiftAZ);
                const pB = new THREE.Vector3(atomB.x + shiftBX, atomB.y + shiftBY, atomB.z + shiftBZ);

                const len = pA.distanceTo(pB);
                if (len < 0.1 || len > 20.0) continue;

                const order = bond.order || 1;
                const bondDir = new THREE.Vector3().subVectors(pB, pA).normalize();
                const up = Math.abs(bondDir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
                const perp = new THREE.Vector3().crossVectors(up, bondDir).normalize();

                const renderCylinder = (posA, posB, r, col) => {
                  if (bondInstIdx >= maxPossibleBonds) return;
                  dummy.position.copy(posA);
                  dummy.scale.set(r, r, len);
                  dummy.lookAt(posB);
                  dummy.updateMatrix();
                  this.bondMesh.setMatrixAt(bondInstIdx, dummy.matrix);
                  this.bondMesh.setColorAt(bondInstIdx, col);
                  bondInstIdx++;
                };

                if (order === 2) {
                  // 雙鍵：平行兩根圓柱
                  const offsetDist = bondRadius * 1.25;
                  const offVec = perp.clone().multiplyScalar(offsetDist);
                  renderCylinder(pA.clone().add(offVec), pB.clone().add(offVec), bondRadius * 0.72, bondColor);
                  renderCylinder(pA.clone().sub(offVec), pB.clone().sub(offVec), bondRadius * 0.72, bondColor);
                } else if (order === 3) {
                  // 三鍵：中央單柱 + 兩側雙柱
                  const offsetDist = bondRadius * 1.5;
                  const offVec = perp.clone().multiplyScalar(offsetDist);
                  renderCylinder(pA, pB, bondRadius * 0.65, bondColor);
                  renderCylinder(pA.clone().add(offVec), pB.clone().add(offVec), bondRadius * 0.65, bondColor);
                  renderCylinder(pA.clone().sub(offVec), pB.clone().sub(offVec), bondRadius * 0.65, bondColor);
                } else if (order === 'hb') {
                  // 氫鍵：亮青色細柱
                  renderCylinder(pA, pB, bondRadius * 0.55, hbColor);
                } else {
                  // 單鍵 (預設)
                  renderCylinder(pA, pB, bondRadius, bondColor);
                }
              }
            }
          }
        }

        this.bondMesh.count = bondInstIdx;
        this.bondMesh.instanceMatrix.needsUpdate = true;
        if (this.bondMesh.instanceColor) this.bondMesh.instanceColor.needsUpdate = true;
        this.scene.add(this.bondMesh);
      }
    }

    // 5. 繪製晶胞線框 (Lattice Wireframe)
    if (this.showCellBox && hasCell) {
      this.drawLatticeBox(structure.cell);
    }
  }

  /**
   * 繪製主原胞晶格線框 (依使用者需求：視覺擴胞時僅顯示原本的原始晶胞，不畫大外框)
   */
  drawLatticeBox(cell) {
    const lines = Crystal.getLatticeBoxLines(cell);
    const vertices = [];

    // 主原胞線條 (亮青色)
    for (const [p1, p2] of lines) {
      vertices.push(p1[0], p1[1], p1[2]);
      vertices.push(p2[0], p2[1], p2[2]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 1 });
    this.cellLines = new THREE.LineSegments(geo, mat);
    this.scene.add(this.cellLines);
  }

  /**
   * 建立選取高亮光圈
   */
  createSelectionHighlight(x, y, z, radius) {
    const geo = new THREE.RingGeometry(radius * 0.9, radius * 1.15, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfacc15, // 亮黃色
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x, y, z);
    // 讓光環始終面向相機
    ring.quaternion.copy(this.camera.quaternion);
    this.selectionGroup.add(ring);
  }

  /**
   * 射線拾取原子 (Raycasting)
   * 透過滑鼠螢幕座標 (clientX, clientY) 找出對應原子索引
   */
  pickAtom(clientX, clientY, structure) {
    if (!this.atomMesh || structure.atoms.length === 0) return -1;
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.atomMesh);

    if (intersects.length > 0) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== undefined) {
        // 取模對應到原始結構原子索引
        return instanceId % structure.atoms.length;
      }
    }
    return -1;
  }

  /**
   * 重置相機視野以完整容納目前分子/晶胞
   */
  resetCamera(structure) {
    if (structure.atoms.length === 0) {
      this.camera.position.set(0, 0, 30);
      this.controls.target.set(0, 0, 0);
      return;
    }

    const center = structure.getCenter();
    let maxDist = 5;
    for (const a of structure.atoms) {
      const d = Math.hypot(a.x - center[0], a.y - center[1], a.z - center[2]);
      if (d > maxDist) maxDist = d;
    }

    this.controls.target.set(center[0], center[1], center[2]);
    const camDist = maxDist * 2.8;
    this.camera.position.set(center[0], center[1], center[2] + camDist);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(center[0], center[1], center[2]);

    if (this.isOrthographic) {
      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      const aspect = width / height;
      const halfH = maxDist * 1.35;
      this.orthographicCamera.left = -halfH * aspect;
      this.orthographicCamera.right = halfH * aspect;
      this.orthographicCamera.top = halfH;
      this.orthographicCamera.bottom = -halfH;
      this.orthographicCamera.updateProjectionMatrix();
    }
    this.controls.update();
  }

  /**
   * 對齊視角至主坐標軸 (X, Y, Z)
   */
  alignCamera(axis, structure) {
    const center = structure.atoms.length > 0 ? structure.getCenter() : [0, 0, 0];
    const dist = this.camera.position.distanceTo(new THREE.Vector3(...center)) || 30;

    this.controls.target.set(...center);
    if (axis === 'x') {
      this.camera.position.set(center[0] + dist, center[1], center[2]);
      this.camera.up.set(0, 1, 0);
    } else if (axis === 'y') {
      this.camera.position.set(center[0], center[1] + dist, center[2]);
      this.camera.up.set(0, 0, -1);
    } else if (axis === 'z') {
      this.camera.position.set(center[0], center[1], center[2] + dist);
      this.camera.up.set(0, 1, 0);
    }

    this.camera.lookAt(...center);
    this.controls.update();
  }

  /**
   * Materials Studio 風格 3D 表面切割與截面平移即時預覽
   * 包含：
   * 1. 12 條立體虛線稜線（3D Dashed Slab Prism）
   * 2. 平移截面位置（琥珀金色半透明平面 + 實線邊界 + 表面法向量箭頭）
   * 3. 頂部表面邊界
   * @param {Structure} structure
   * @param {Object} options { h, k, l, layers, thickness, shift }
   */
  updateCleavePreview(structure, options = {}) {
    if (!structure || !structure.cell || structure.atoms.length === 0) {
      this.hideCleavePreview();
      return;
    }

    const h = parseInt(options.h, 10) || 0;
    const k = parseInt(options.k, 10) || 0;
    const l = parseInt(options.l, 10) || 0;

    if (h === 0 && k === 0 && l === 0) {
      this.hideCleavePreview();
      return;
    }

    const planeInfo = Crystal.calculatePlaneSpacing(structure.cell, h, k, l);
    if (!planeInfo) {
      this.hideCleavePreview();
      return;
    }

    this.hideCleavePreview();

    const { d_hkl, normalUnit, uBasis, vBasis } = planeInfo;
    const [va, vb, vc] = structure.cell;

    let nLayers = parseInt(options.layers, 10) || 1;
    if (options.thickness && Number(options.thickness) > 0) {
      nLayers = Math.max(1, Math.ceil(Number(options.thickness) / d_hkl));
    }
    const shiftFrac = Math.max(0, Math.min(1.0, parseFloat(options.shift || 0.0)));

    // 面內基底向量在真實空間的座標 (Cartesian coordinates)
    const uCart = [
      uBasis[0] * va[0] + uBasis[1] * vb[0] + uBasis[2] * vc[0],
      uBasis[0] * va[1] + uBasis[1] * vb[1] + uBasis[2] * vc[1],
      uBasis[0] * va[2] + uBasis[1] * vb[2] + uBasis[2] * vc[2]
    ];
    const vCart = [
      vBasis[0] * va[0] + vBasis[1] * vb[0] + vBasis[2] * vc[0],
      vBasis[0] * va[1] + vBasis[1] * vb[1] + vBasis[2] * vc[1],
      vBasis[0] * va[2] + vBasis[1] * vb[2] + vBasis[2] * vc[2]
    ];

    const n = normalUnit;
    const z0 = shiftFrac * d_hkl;
    const slabHeight = nLayers * d_hkl;

    // 底面 4 個頂點 (平移截面起點)
    const p00 = [z0 * n[0], z0 * n[1], z0 * n[2]];
    const p10 = [uCart[0] + p00[0], uCart[1] + p00[1], uCart[2] + p00[2]];
    const p11 = [uCart[0] + vCart[0] + p00[0], uCart[1] + vCart[1] + p00[1], uCart[2] + vCart[2] + p00[2]];
    const p01 = [vCart[0] + p00[0], vCart[1] + p00[1], vCart[2] + p00[2]];

    // 頂面 4 個頂點 (頂部終端面)
    const tDiff = [slabHeight * n[0], slabHeight * n[1], slabHeight * n[2]];
    const t00 = [p00[0] + tDiff[0], p00[1] + tDiff[1], p00[2] + tDiff[2]];
    const t10 = [p10[0] + tDiff[0], p10[1] + tDiff[1], p10[2] + tDiff[2]];
    const t11 = [p11[0] + tDiff[0], p11[1] + tDiff[1], p11[2] + tDiff[2]];
    const t01 = [p01[0] + tDiff[0], p01[1] + tDiff[1], p01[2] + tDiff[2]];

    // 1. 繪製 12 條立體虛線稜線 (3D Dashed Slab Prism)
    const edges = [
      [p00, p10], [p10, p11], [p11, p01], [p01, p00], // 底面 4 邊
      [t00, t10], [t10, t11], [t11, t01], [t01, t00], // 頂面 4 邊
      [p00, t00], [p10, t10], [p11, t11], [p01, t01]  // 垂直 4 邊
    ];

    const linePositions = [];
    const lineDistances = [];
    for (const [start, end] of edges) {
      linePositions.push(start[0], start[1], start[2]);
      linePositions.push(end[0], end[1], end[2]);
      const len = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
      lineDistances.push(0, len);
    }

    const dashedGeo = new THREE.BufferGeometry();
    dashedGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    dashedGeo.setAttribute('lineDistance', new THREE.Float32BufferAttribute(lineDistances, 1));
    const dashedMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8, // 亮青色立體晶格虛線
      dashSize: 0.35,
      gapSize: 0.20,
      linewidth: 2
    });
    const dashedBox = new THREE.LineSegments(dashedGeo, dashedMat);
    this.cleavePreviewGroup.add(dashedBox);

    // 2. 繪製平移截面 (Cleavage / Termination Plane at Shift)
    const planeVertices = [
      ...p00, ...p10, ...p11,
      ...p00, ...p11, ...p01
    ];
    const planeGeo = new THREE.BufferGeometry();
    planeGeo.setAttribute('position', new THREE.Float32BufferAttribute(planeVertices, 3));
    planeGeo.computeVertexNormals();
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // 琥珀金色截面
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    this.cleavePreviewGroup.add(planeMesh);

    // 平移截面邊界高亮實線
    const borderVertices = [
      ...p00, ...p10,
      ...p10, ...p11,
      ...p11, ...p01,
      ...p01, ...p00
    ];
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.Float32BufferAttribute(borderVertices, 3));
    const borderMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 2
    });
    const borderLine = new THREE.LineSegments(borderGeo, borderMat);
    this.cleavePreviewGroup.add(borderLine);

    // 3. 繪製切面法向量指示箭頭 (Normal Vector Indicator Arrow)
    const center0 = new THREE.Vector3(
      (p00[0] + p10[0] + p11[0] + p01[0]) / 4,
      (p00[1] + p10[1] + p11[1] + p01[1]) / 4,
      (p00[2] + p10[2] + p11[2] + p01[2]) / 4
    );
    const normDir = new THREE.Vector3(n[0], n[1], n[2]).normalize();
    const arrowLen = Math.max(1.8, Math.min(4.5, d_hkl * 1.5));
    const arrow = new THREE.ArrowHelper(normDir, center0, arrowLen, 0xf59e0b, 0.45, 0.30);
    this.cleavePreviewGroup.add(arrow);

    // 4. 繪製頂面微透明封蓋 (Top Surface Cap)
    const topVertices = [
      ...t00, ...t10, ...t11,
      ...t00, ...t11, ...t01
    ];
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topVertices, 3));
    topGeo.computeVertexNormals();
    const topMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const topMesh = new THREE.Mesh(topGeo, topMat);
    this.cleavePreviewGroup.add(topMesh);
  }

  /**
   * 隱藏並清空表面切割即時預覽
   */
  hideCleavePreview() {
    if (!this.cleavePreviewGroup) return;
    while (this.cleavePreviewGroup.children.length > 0) {
      const obj = this.cleavePreviewGroup.children[0];
      this.cleavePreviewGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
  }
}
