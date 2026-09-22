/**
 * Hand3D - Realistic Rigged 3D Human Hand with Three.js (WebGL)
 * DBS & DBE Project - Real-time Sign Language Translator
 *
 * Loads the rigged GLB skeleton (assets/hand_right.glb), re-parents the flat
 * bone list into a true anatomical hierarchy, applies a physically based skin
 * material, and drives the bones from either:
 *   (a) the built-in sign-pose library  ->  displaySign(item, speed)
 *   (b) live MediaPipe landmarks        ->  updateFromLandmarks(landmarks)
 *
 * Public API (backward compatible with the previous procedural version):
 *   init(container)            -> boolean
 *   displaySign(item, speed)   -> void
 *   setCameraView('front'|'back'|'iso')
 *   playbackSpeed              -> 1.0 | 0.5
 *   updateFromLandmarks(lm, handedness)
 *   setLiveTracking(bool)
 *   onWindowResize()
 *   destroy()
 */

(function (window) {
    'use strict';

    /* ══════════════════════════════════════════════════════════════════════
       CONSTANTS - Bone topology of assets/hand_right.glb
       The GLB stores every bone as a direct child of the Armature node.
       We rebuild the real anatomical hierarchy below so that a rotation on a
       proximal bone automatically carries its children with it (the flat
       hierarchy alone cannot animate a finger chain correctly).
       ══════════════════════════════════════════════════════════════════════ */
    const BONE_PARENT = {
        'wrist': null,
        'thumb-metacarpal':           'wrist',
        'thumb-phalanx-proximal':     'thumb-metacarpal',
        'thumb-phalanx-distal':       'thumb-phalanx-proximal',
        'thumb-tip':                  'thumb-phalanx-distal',
        'index-finger-metacarpal':            'wrist',
        'index-finger-phalanx-proximal':      'index-finger-metacarpal',
        'index-finger-phalanx-intermediate':  'index-finger-phalanx-proximal',
        'index-finger-phalanx-distal':        'index-finger-phalanx-intermediate',
        'index-finger-tip':                   'index-finger-phalanx-distal',
        'middle-finger-metacarpal':           'wrist',
        'middle-finger-phalanx-proximal':     'middle-finger-metacarpal',
        'middle-finger-phalanx-intermediate': 'middle-finger-phalanx-proximal',
        'middle-finger-phalanx-distal':       'middle-finger-phalanx-intermediate',
        'middle-finger-tip':                  'middle-finger-phalanx-distal',
        'ring-finger-metacarpal':             'wrist',
        'ring-finger-phalanx-proximal':       'ring-finger-metacarpal',
        'ring-finger-phalanx-intermediate':   'ring-finger-phalanx-proximal',
        'ring-finger-phalanx-distal':         'ring-finger-phalanx-intermediate',
        'ring-finger-tip':                    'ring-finger-phalanx-distal',
        'pinky-finger-metacarpal':            'wrist',
        'pinky-finger-phalanx-proximal':      'pinky-finger-metacarpal',
        'pinky-finger-phalanx-intermediate':  'pinky-finger-phalanx-proximal',
        'pinky-finger-phalanx-distal':        'pinky-finger-phalanx-intermediate',
        'pinky-finger-tip':                   'pinky-finger-phalanx-distal'
    };

    /* Which bone owns each degree of freedom of the pose model.
       mcpX / pipX / dipX -> flexion around the computed curl axis
       mcpZ               -> splay around the computed spread axis
       mcpY               -> axial twist around the bone */
    const FINGER_BONES = {
        index:  { mcp: 'index-finger-metacarpal',  pip: 'index-finger-phalanx-proximal',  dip: 'index-finger-phalanx-intermediate' },
        middle: { mcp: 'middle-finger-metacarpal', pip: 'middle-finger-phalanx-proximal', dip: 'middle-finger-phalanx-intermediate' },
        ring:   { mcp: 'ring-finger-metacarpal',   pip: 'ring-finger-phalanx-proximal',   dip: 'ring-finger-phalanx-intermediate' },
        pinky:  { mcp: 'pinky-finger-metacarpal',  pip: 'pinky-finger-phalanx-proximal',  dip: 'pinky-finger-phalanx-intermediate' }
    };

    const THUMB_BONES = {
        cmc: 'thumb-metacarpal',
        mcp: 'thumb-phalanx-proximal',
        ip:  'thumb-phalanx-distal'
    };

    const DEFAULT_JOINTS = {
        wrist:  { x: 0, y: 0, z: 0 },
        thumb:  { cmcX: 0.12, cmcY: 0.02, cmcZ: 0.10, mcpX: 0.04, mcpZ: 0.01, ipX: 0.02 },
        index:  { mcpX: 0.02, mcpY: 0.00, mcpZ: 0.04, pipX: 0.02, dipX: 0.02 },
        middle: { mcpX: 0.01, mcpY: 0.00, mcpZ: 0.00, pipX: 0.02, dipX: 0.02 },
        ring:   { mcpX: 0.02, mcpY: 0.00, mcpZ: -0.04, pipX: 0.02, dipX: 0.02 },
        pinky:  { mcpX: 0.04, mcpY: 0.00, mcpZ: -0.08, pipX: 0.03, dipX: 0.02 }
    };

    class Hand3DController {
        constructor() {
            this.container   = null;
            this.canvas      = null;
            this.renderer    = null;
            this.scene       = null;
            this.camera      = null;
            this.controls    = null;
            this.clock       = null;
            this.animationId = null;

            this.handRoot    = null;   // wrapper group (idle bobbing / drift)
            this.wristJoint  = null;   // wrist bone (root of the skeleton)
            this.skinnedMesh = null;
            this.bones       = {};     // boneName -> THREE.Bone
            this.restLocal   = {};     // boneName -> bind-pose quaternion (parent space)
            this.flexAxis    = {};     // boneName -> curl axis (parent space)
            this.spreadAxis  = {};     // boneName -> splay axis (parent space)
            this.twistAxis   = {};     // boneName -> axial twist axis (parent space)
            this.modelReady  = false;
            this.modelError  = false;

            this.playbackSpeed  = 1.0;
            this.activeSignData = null;
            this.isInitialized  = false;
            this.time           = 0;

            /* Live MediaPipe mirroring */
            this.liveTracking  = false;
            this.liveLandmarks = null;
            this._liveSmooth   = null;

            /* Joint state + spring velocities */
            this.jointState  = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
            this.targetJoints = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
            this.vel = {
                wrist:  { x: 0, y: 0, z: 0 },
                thumb:  { cmcX: 0, cmcY: 0, cmcZ: 0, mcpX: 0, mcpZ: 0, ipX: 0 },
                index:  { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                middle: { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                ring:   { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                pinky:  { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 }
            };

            this._resizeObserver = null;
            this._pendingSign    = null;
            this._rootOffset     = { x: 0, y: 0, z: 0 };
            this._motionWrist    = { x: 0, y: 0, z: 0 };
            this.fallbackActive  = false;
            this._rootBase = { x: 0, y: 0, z: 0 };  // set once model bounds are known
            this._handScale = 1;
        }

        /* Damped spring integrator */
        _spring(cur, tgt, vel, k, d) {
            const force = (tgt - cur) * k;
            vel = vel * d + force;
            return { val: cur + vel, vel: vel };
        }

        /* ══════════════════════════════════════════════════════════════════════
           INIT - scene / camera / renderer / controls / lighting / model
           ══════════════════════════════════════════════════════════════════════ */
        init(containerElement) {
            if (!containerElement) return false;
            if (typeof THREE === 'undefined') {
                console.error('Hand3D: Three.js not found');
                return false;
            }

            // If already initialized, cleanly re-attach canvas to container and resize
            if (this.isInitialized && this.canvas && this.renderer) {
                if (this.container !== containerElement) {
                    this.container = containerElement;
                    this.container.innerHTML = '';
                    this.container.appendChild(this.canvas);
                }
                setTimeout(() => this.onWindowResize(), 30);
                return true;
            }

            this.container = containerElement;
            this.container.innerHTML = '';

            const W = this.container.clientWidth  || 300;
            const H = this.container.clientHeight || 300;

            this.scene = new THREE.Scene();
            this.clock = new THREE.Clock();

            this.camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 100);
            this.camera.position.set(0, 0.05, 2.4);

            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.setSize(W, H);
            if (THREE.sRGBEncoding !== undefined) this.renderer.outputEncoding = THREE.sRGBEncoding;
            if (THREE.ACESFilmicToneMapping !== undefined) {
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                this.renderer.toneMappingExposure = 1.05;
            }

            this.canvas = this.renderer.domElement;
            this.canvas.id = 'hand-3d-canvas';
            this.canvas.style.cssText = 'width:100%;height:100%;display:block;outline:none;cursor:grab;';
            this.container.appendChild(this.canvas);

            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.canvas);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.enablePan     = false;
                this.controls.minDistance   = 1.0;
                this.controls.maxDistance   = 5.0;
                this.controls.target.set(0, 0, 0);
                this.controls.maxPolarAngle = Math.PI * 0.94;
                this.controls.minPolarAngle = Math.PI * 0.06;
                this.canvas.addEventListener('mousedown', () => { this.canvas.style.cursor = 'grabbing'; });
                window.addEventListener('mouseup', () => { if (this.canvas) this.canvas.style.cursor = 'grab'; });
            }

            /* Root wrapper for life-like idle bobbing / drift */
            this.handRoot = new THREE.Group();
            this.scene.add(this.handRoot);

            this._setupLights();

            this.isInitialized = true;
            this.animate();

            this._loadModel();

            if (typeof ResizeObserver !== 'undefined') {
                this._resizeObserver = new ResizeObserver(() => this.onWindowResize());
                this._resizeObserver.observe(this.container);
            }
            return true;
        }

        /* ══════════════════════════════════════════════════════════════════════
           LIGHTING - warm studio key / cool rim / soft fill
           ══════════════════════════════════════════════════════════════════════ */
        _setupLights() {
            const hemi = new THREE.HemisphereLight(0xffffff, 0xc5d4e8, 0.62);
            this.scene.add(hemi);

            // Stronger key light for better visibility
            const key = new THREE.DirectionalLight(0xfff5e8, 1.55);
            key.position.set(2.2, 3.2, 2.8);
            this.scene.add(key);

            const fill = new THREE.DirectionalLight(0xe0eeff, 0.65);
            fill.position.set(-2.8, 1.4, 2.0);
            this.scene.add(fill);

            const rim = new THREE.DirectionalLight(0xffffff, 0.85);
            rim.position.set(-0.8, 1.8, -3.4);
            this.scene.add(rim);

            const bounce = new THREE.DirectionalLight(0xffecd5, 0.35);
            bounce.position.set(0.5, -2.2, 1.6);
            this.scene.add(bounce);
        }

        /* ══════════════════════════════════════════════════════════════════════
           MODEL LOAD
           ══════════════════════════════════════════════════════════════════════ */
        _loadModel() {
            const path = 'assets/hand_right.glb';

            if (typeof THREE.GLTFLoader === 'undefined') {
                /* Self-heal: pages should include assets/GLTFLoader.js, but if they
                   forget, inject it dynamically and retry once before degrading. */
                if (!this._gltfLoaderInjected) {
                    this._gltfLoaderInjected = true;
                    console.warn('Hand3D: THREE.GLTFLoader missing - injecting assets/GLTFLoader.js');
                    const s = document.createElement('script');
                    s.src = 'assets/GLTFLoader.js';
                    s.onload = () => {
                        if (typeof THREE.GLTFLoader !== 'undefined') this._loadModel();
                        else { this.modelError = true; this._buildFallbackHand(); }
                    };
                    s.onerror = () => {
                        console.error('Hand3D: could not load assets/GLTFLoader.js');
                        this.modelError = true;
                        this._buildFallbackHand();
                    };
                    document.head.appendChild(s);
                    return;
                }
                console.error('Hand3D: THREE.GLTFLoader missing - add assets/GLTFLoader.js');
                this.modelError = true;
                this._buildFallbackHand();
                return;
            }

            const loader = new THREE.GLTFLoader();
            loader.load(
                path,
                (gltf) => this._onModelLoaded(gltf),
                undefined,
                (err) => {
                    console.warn('Hand3D: GLB load failed, using fallback hand.', err);
                    this.modelError = true;
                    this._buildFallbackHand();
                }
            );
        }

        _onModelLoaded(gltf) {
            const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
            if (!root) { 
                console.error('Hand3D: No scene in GLB, using fallback');
                this._buildFallbackHand(); 
                return; 
            }

            /* Collect every bone by name */
            root.traverse((obj) => {
                if (obj.isBone && obj.name) this.bones[obj.name] = obj;
                if (obj.isSkinnedMesh && !this.skinnedMesh) this.skinnedMesh = obj;
            });

            if (!this.bones['wrist']) {
                console.warn('Hand3D: Wrist bone not found in GLB, using fallback');
                this._buildFallbackHand();
                return;
            }

            /* 1. Rebuild an anatomical hierarchy so chains animate correctly */
            this._reparentBones();

            /* 2. Scale the hand to be ABSOLUTELY MASSIVE - 20x the original size */
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            console.log('Hand3D DEBUG: Original hand dimensions:', size.x, size.y, size.z);
            console.log('Hand3D DEBUG: Max dimension:', maxDim);
            const targetDim = 2.0;  // Target 2 units in world space
            this._handScale = targetDim / maxDim;
            console.log('Hand3D DEBUG: Calculated scale factor:', this._handScale);
            root.scale.setScalar(this._handScale);
            console.log('Hand3D DEBUG: Applied scale:', root.scale.x);

            /* 3. Re-centre: place palm and fingers squarely in the center of the camera view */
            root.updateMatrixWorld(true);
            const box2 = new THREE.Box3().setFromObject(root);
            const center = new THREE.Vector3();
            box2.getCenter(center);
            root.position.set(-center.x - 0.22, -center.y - 0.45, -center.z);

            /* 4. Improved physically based skin material with better color and lighting */
            this._applySkinMaterial();

            root.traverse((obj) => {
                if (obj.isMesh || obj.isSkinnedMesh) {
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                    obj.frustumCulled = false;        // skinned bounds can be wrong
                }
            });

            this.handRoot.add(root);
            this.wristJoint = this.bones['wrist'];

            /* 5. Cache bind pose and derive per-bone rotation axes */
            root.updateMatrixWorld(true);
            this._cacheRestPose();
            this._deriveAxes();

            this.modelReady = true;
            console.log('✅ Hand3D: GLB model loaded successfully!');
            console.log('Hand3D: Bones found:', Object.keys(this.bones).length);
            console.log('Hand3D: Hand scale applied:', this._handScale);

            /* 6. Camera framing / controls target */
            this._rootBase = { x: 0, y: 0, z: 0 };
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.minDistance = 1.0;
                this.controls.maxDistance = 6.0;
            }
            
            console.log('Hand3D: Model loaded successfully with scale:', this._handScale);
            console.log('Hand3D: Camera position:', this.camera.position);
            console.log('Hand3D: Hand root position:', this.handRoot.position);

            /* Apply whatever sign was requested while we were still loading */
            if (this._pendingSign) {
                const p = this._pendingSign;
                this._pendingSign = null;
                this.displaySign(p.item, p.speed);
            } else {
                this._setTargetFromPose(DEFAULT_JOINTS);
            }
        }

        /* ══════════════════════════════════════════════════════════════════════
           RIGGING - rebuild hierarchy, cache bind pose, derive joint axes
           ══════════════════════════════════════════════════════════════════════ */

        /* The GLB stores all 25 bones as direct children of the Armature.
           Object3D.attach() re-parents while preserving the world transform,
           so the bind pose (and therefore the skinning) stays pixel-identical
           while finger chains start inheriting their parents' rotations. */
        _reparentBones() {
            for (const name in BONE_PARENT) {
                const parentName = BONE_PARENT[name];
                if (!parentName) continue;
                const bone   = this.bones[name];
                const parent = this.bones[parentName];
                if (!bone || !parent || bone === parent) continue;
                if (bone.parent === parent) continue;
                parent.attach(bone);        // preserves world transform
            }
        }

        /* Store the parent-relative bind rotation of every bone. All animation
           is expressed as an offset from this quaternion. */
        _cacheRestPose() {
            for (const name in this.bones) {
                this.restLocal[name] = this.bones[name].quaternion.clone();
            }
        }

        /* Derive, for every animated bone, the three rotation axes (curl /
           splay / twist) expressed in that bone's PARENT space.
           Using purely geometric axes means retargeting works no matter how
           the exporter happened to orient each individual bone. */
        _deriveAxes() {
            const worldPos = (name) => {
                const b = this.bones[name];
                return b ? b.getWorldPosition(new THREE.Vector3()) : null;
            };

            const wrist     = worldPos('wrist');
            const indexMCP  = worldPos('index-finger-metacarpal');
            const middleMCP = worldPos('middle-finger-metacarpal');
            const pinkyMCP  = worldPos('pinky-finger-metacarpal');

            if (!wrist || !indexMCP || !middleMCP || !pinkyMCP) return;

            /* Palm frame:
                 fwd    - wrist toward the knuckles
                 across - index side toward pinky side
                 dorsal - normal of the palm plane (back-of-hand side) */
            const fwd    = middleMCP.clone().sub(wrist).normalize();
            const across = pinkyMCP.clone().sub(indexMCP).normalize();
            const dorsal = new THREE.Vector3().crossVectors(fwd, across).normalize();

            /* Sanity-check the sign of the palm normal. In a flat bind pose the
               thumb sits toward the palmar side of the hand, so if the averaged
               thumb position lands on the "dorsal" side then our cross product
               came out inverted and we flip it. This keeps the curl direction
               correct (fingers fold toward the palm, not away from it). */
            const thumbProx = worldPos('thumb-phalanx-proximal');
            const thumbTip  = worldPos('thumb-tip');
            if (thumbProx && thumbTip) {
                const tAvg = thumbProx.clone().add(thumbTip).multiplyScalar(0.5).sub(wrist);
                if (tAvg.dot(dorsal) > 0) dorsal.negate();
            }

            this._dorsal = dorsal;

            /* Convert a world-space axis into a bone's parent-local space */
            const toParent = (bone, worldAxis) => {
                const pq = new THREE.Quaternion();
                (bone.parent || this.handRoot).getWorldQuaternion(pq);
                return worldAxis.clone().applyQuaternion(pq.invert()).normalize();
            };

            /* Direction the bone points: toward its first child bone */
            const boneDir = (bone) => {
                const child = bone.children.find((c) => c.isBone);
                const a = bone.getWorldPosition(new THREE.Vector3());
                const b = child
                    ? child.getWorldPosition(new THREE.Vector3())
                    : a.clone().add(new THREE.Vector3(0, 1, 0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion())));
                return b.sub(a).normalize();
            };

            const setup = (boneName) => {
                const bone = this.bones[boneName];
                if (!bone) return;

                const dir = boneDir(bone);

                /* Curl axis: rotating around cross(dorsal, dir) by a positive
                   angle sweeps the fingertip toward the PALMAR side (-dorsal).
                   Note the cross order matters: cross(dir, dorsal) instead
                   would rotate the finger toward the back of the hand
                   (hyperextension). The order below was verified against the
                   GLB's bind pose transforms. Spread axis: rotating around the
                   dorsal normal swings the bone within the palm plane. */
                const flexW   = new THREE.Vector3().crossVectors(dorsal, dir);
                const spreadW = dorsal.clone();
                const twistW  = dir.clone();

                if (flexW.lengthSq() < 1e-6) flexW.set(1, 0, 0);

                this.flexAxis[boneName]   = toParent(bone, flexW.normalize());
                this.spreadAxis[boneName] = toParent(bone, spreadW.normalize());
                this.twistAxis[boneName]  = toParent(bone, twistW.normalize());
            };

            ['index', 'middle', 'ring', 'pinky'].forEach((finger) => {
                const spec = FINGER_BONES[finger];
                setup(spec.mcp);
                setup(spec.pip);
                setup(spec.dip);
            });
            setup(THUMB_BONES.cmc);
            setup(THUMB_BONES.mcp);
            setup(THUMB_BONES.ip);
        }

        /* ══════════════════════════════════════════════════════════════════════
           MATERIAL - the GLB ships with a flat Lambert material; replace it
           with a physically based skin shader for a realistic finish.
           ══════════════════════════════════════════════════════════════════════ */
        _applySkinMaterial() {
            if (!this.skinnedMesh) return;

            const mat = new THREE.MeshPhysicalMaterial({
                color:              0xf5d0b8,       // warmer, more natural skin tone
                roughness:          0.52,            // smoother for better lighting
                metalness:          0.0,
                clearcoat:          0.12,
                clearcoatRoughness: 0.50,
                reflectivity:       0.35,
                sheen:              0.35,            // increased sheen for better visibility
                sheenRoughness:     0.70,
                sheenColor:         new THREE.Color(0xffe5d1)
            });

            /* THREE r128 gates the skinning shader chunk on this flag */
            mat.skinning = true;

            this.skinnedMesh.material = mat;
            this.skinMaterial = mat;
        }

        /* ══════════════════════════════════════════════════════════════════════
           FALLBACK - minimal articulated hand, only used if the GLB cannot be
           loaded (offline / GLTFLoader missing). Reuses the joint-state model.
           ══════════════════════════════════════════════════════════════════════ */
        _buildFallbackHand() {
            console.warn('Hand3D: Using FALLBACK procedural hand - GLB model failed to load!');
            const group = new THREE.Group();
            group.scale.setScalar(3.0);  // Make fallback hand 3x larger
            const skin = new THREE.MeshStandardMaterial({
                color: 0xf3c9a9, roughness: 0.62, metalness: 0.0
            });

            /* Tapered segment + rounded knuckle, hanging downward from origin */
            const seg = (r1, r2, len) => {
                const g = new THREE.CylinderGeometry(r2, r1, len, 14, 1, false);
                g.translate(0, -len / 2, 0);
                const holder = new THREE.Group();
                const m = new THREE.Mesh(g, skin);
                m.castShadow = true; m.receiveShadow = true;
                const knot = new THREE.Mesh(new THREE.SphereGeometry(r2 * 1.02, 12, 10), skin);
                knot.castShadow = true;
                holder.add(m); holder.add(knot);
                return holder;
            };

            const wrist = new THREE.Group();
            group.add(wrist);

            const palm = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.56, 0.16, 4, 4, 2), skin);
            palm.position.set(0, -0.28, 0);
            palm.castShadow = true; palm.receiveShadow = true;
            wrist.add(palm);

            const makeFinger = (x, y, z, l1, l2, l3, r, splay) => {
                const mcp = new THREE.Group();
                mcp.position.set(x, y, z);
                mcp.rotation.z = splay;
                mcp.add(seg(r, r * 0.9, l1));
                const pip = new THREE.Group();
                pip.position.set(0, -l1, 0);
                pip.add(seg(r * 0.9, r * 0.8, l2));
                const dip = new THREE.Group();
                dip.position.set(0, -l2, 0);
                dip.add(seg(r * 0.8, r * 0.62, l3));
                mcp.add(pip); pip.add(dip);
                wrist.add(mcp);
                return { mcp, pip, dip };
            };

            const fingers = {
                index:  makeFinger(-0.165, -0.02, 0, 0.30, 0.20, 0.15, 0.058,  0.06),
                middle: makeFinger(-0.020, -0.01, 0, 0.33, 0.22, 0.16, 0.060,  0.00),
                ring:   makeFinger( 0.125, -0.02, 0, 0.31, 0.21, 0.15, 0.056, -0.06),
                pinky:  makeFinger( 0.245, -0.06, 0, 0.25, 0.17, 0.13, 0.048, -0.13)
            };

            /* Thumb emerges from the side of the palm cage */
            const cmc = new THREE.Group();
            cmc.position.set(-0.29, -0.34, 0.02);
            cmc.rotation.set(0, 0, 1.15);
            cmc.add(seg(0.076, 0.068, 0.22));
            const tMcp = new THREE.Group();
            tMcp.position.set(0, -0.22, 0);
            tMcp.add(seg(0.068, 0.060, 0.22));
            const tIp = new THREE.Group();
            tIp.position.set(0, -0.22, 0);
            tIp.add(seg(0.060, 0.050, 0.20));
            cmc.add(tMcp); tMcp.add(tIp);
            wrist.add(cmc);

            this.fallback = { root: group, wrist, fingers, thumb: { cmc, mcp: tMcp, ip: tIp } };
            this.fallbackActive = true;
            this.handRoot.add(group);
            this.modelReady = true;
        }

        /* ══════════════════════════════════════════════════════════════════════
           SIGN POSE LIBRARY
           Each entry returns a target joint state. Values are radians of joint
           flexion / splay, exactly as in the original implementation so every
           existing sign keeps its meaning.
           ══════════════════════════════════════════════════════════════════════ */
        getSignJointTargets(signName) {
            const name = (signName || '').toUpperCase().trim();

            const fistCurl = (amt = 1.0, convergence = 0) => ({
                mcpX: 1.45 * amt,
                pipX: 1.70 * amt,
                dipX: 1.55 * amt,
                mcpY: 0,
                mcpZ: convergence
            });

            const ext = (splay = 0) => ({
                mcpX: 0.02,
                pipX: 0.02,
                dipX: 0.02,
                mcpY: 0,
                mcpZ: splay
            });

            const thumbOpen = { cmcX: 0.14, cmcY: 0.04, cmcZ: 0.22, mcpX: 0.06, mcpZ: 0.04, ipX: 0.04 };
            const thumbFist = { cmcX: 0.48, cmcY: -0.20, cmcZ: -0.20, mcpX: 0.56, mcpZ: -0.10, ipX: 0.40 };
            const thumbHold = { cmcX: 0.52, cmcY: -0.22, cmcZ: -0.28, mcpX: 0.56, mcpZ: -0.12, ipX: 0.38 };

            /* Base: relaxed open hand */
            const pose = {
                wrist:  { x: 0, y: 0, z: 0 },
                thumb:  Object.assign({}, thumbOpen),
                index:  ext(0.04),
                middle: ext(0.00),
                ring:   ext(-0.04),
                pinky:  ext(-0.08)
            };

            if (name.includes('THUMBS UP') && !name.includes('HELP')) {
                /* THUMBS UP - Tight fist with thumb pointing straight up */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };   // Fully curled
                pose.middle = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: -0.3, cmcY: 0.0, cmcZ: 0.8, mcpX: -0.2, mcpZ: 0.0, ipX: -0.1 };  // Straight up
            
            } else if (name.includes('HELP')) {
                /* HELP - Open palm with thumb up at angle */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.1 };   // Slightly spread
                pose.middle = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: -0.1 };
                pose.thumb  = { cmcX: 0.0, cmcY: 0.1, cmcZ: 0.6, mcpX: 0.0, mcpZ: 0.0, ipX: 0.0 };  // Up at angle

            } else if (name.includes('THANK') || name === 'ALPHABET B') {
                /* THANK YOU - Flat palm, all fingers straight together */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };   // Perfectly straight
                pose.middle = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.3, cmcY: 0.0, cmcZ: 0.2, mcpX: 0.1, mcpZ: 0.0, ipX: 0.0 };  // Thumb alongside palm

            } else if (name.includes('HELLO') || name.includes('HI') || name.includes('FIVE')) {
                /* HELLO/HI - Wide spread fingers for waving */
                pose.wrist  = { x: 0.0, y: 0.1, z: 0.0 };
                pose.index  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.5 };   // Wide spread
                pose.middle = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.15 };
                pose.ring   = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: -0.15 };
                pose.pinky  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: -0.5 };   // Wide spread
                pose.thumb  = { cmcX: 0.15, cmcY: 0.1, cmcZ: 0.5, mcpX: 0.0, mcpZ: 0.0, ipX: 0.0 };  // Extended

            } else if (name.includes('PEACE') || name.includes('VICTORY') || name.includes('TWO') || name === 'ALPHABET V') {
                /* PEACE/VICTORY - Dramatic V-shape with two fingers extended */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.6 };   // Straight, wide spread
                pose.middle = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: -0.6 };  // Straight, opposite spread
                pose.ring   = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };   // Fully curled
                pose.pinky  = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.5, cmcY: -0.2, cmcZ: 0.0, mcpX: 0.6, mcpZ: 0.0, ipX: 0.5 };  // Curled tight

            } else if (name === 'ALPHABET U') {
                pose.index  = { mcpX: 0.02, mcpY: 0, mcpZ:  0.01, pipX: 0.02, dipX: 0.02 };
                pose.middle = { mcpX: 0.02, mcpY: 0, mcpZ: -0.01, pipX: 0.02, dipX: 0.02 };
                pose.ring   = fistCurl(1.0, 0.04);
                pose.pinky  = fistCurl(1.0, 0.08);
                pose.thumb  = Object.assign({}, thumbHold);

            } else if (name.includes('WATER') || name.includes('THREE') || name === 'ALPHABET W') {
                pose.index  = ext(0.16);
                pose.middle = ext(0.00);
                pose.ring   = ext(-0.16);
                pose.pinky  = fistCurl(1.0, 0.08);
                pose.thumb  = Object.assign({}, thumbHold);

            } else if (name.includes('PLEASE')) {
                /* PLEASE - Slightly curved natural pose */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 0.3, pipX: 0.3, dipX: 0.3, mcpY: 0, mcpZ: 0.0 };   // Gentle curve
                pose.middle = { mcpX: 0.3, pipX: 0.3, dipX: 0.3, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 0.3, pipX: 0.3, dipX: 0.3, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 0.3, pipX: 0.3, dipX: 0.3, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.2, cmcY: 0.0, cmcZ: 0.4, mcpX: 0.1, mcpZ: 0.0, ipX: 0.1 };  // Angled out

            } else if (name.includes('MORE')) {
                /* MORE - All fingertips touching (pinched together) */
                pose.index  = { mcpX: 0.85, mcpY: 0, mcpZ: -0.08, pipX: 0.78, dipX: 0.55 };  // Curved to meet thumb
                pose.middle = { mcpX: 0.85, mcpY: 0, mcpZ:  0.08, pipX: 0.78, dipX: 0.55 };
                pose.ring   = { mcpX: 0.85, mcpY: 0, mcpZ:  0.20, pipX: 0.78, dipX: 0.55 };
                pose.pinky  = { mcpX: 0.85, mcpY: 0, mcpZ: -0.08, pipX: 0.78, dipX: 0.55 };
                pose.thumb  = { cmcX: 0.52, cmcY: -0.12, cmcZ: 0.52, mcpX: 0.55, mcpZ: 0.15, ipX: 0.42 };  // Meeting fingertips

            } else if (name.includes('OK') || name === 'ALPHABET F') {
                /* OK SIGN - Circle with thumb and index, other fingers extended */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 0.9, pipX: 1.0, dipX: 0.9, mcpY: 0, mcpZ: 0.2 };   // Curved to meet thumb
                pose.middle = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };   // Straight
                pose.ring   = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.3, cmcY: 0.0, cmcZ: 0.5, mcpX: 0.6, mcpZ: 0.1, ipX: 0.7 };  // Extended to meet index

            } else if (name.includes('ROCK') || name.includes('METAL') || name.includes('HORNS')) {
                /* ROCK/METAL HORNS - Index and pinky extended dramatically */
                pose.index  = { mcpX: -0.05, mcpY: 0, mcpZ: 0.20, pipX: -0.05, dipX: -0.05 };  // Extended
                pose.pinky  = { mcpX: -0.05, mcpY: 0, mcpZ: -0.28, pipX: -0.05, dipX: -0.05 };  // Extended
                pose.middle = fistCurl(1.28, 0.00);  // Tight curl
                pose.ring   = fistCurl(1.30, 0.06);
                pose.thumb  = { cmcX: 0.50, cmcY: -0.20, cmcZ: -0.15, mcpX: 0.48, mcpZ: -0.08, ipX: 0.32 };  // Wrapped tight

            } else if (name.includes('I LOVE YOU') || (name.includes('ROCK') && !name.includes('METAL')) || name === 'ALPHABET Y') {
                /* I LOVE YOU - Thumb, index, and pinky DRAMATICALLY extended, middle+ring curled */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: -0.05, mcpY: 0, mcpZ: 0.28, pipX: -0.05, dipX: -0.05 };  // Very extended
                pose.middle = fistCurl(1.32, 0.00);  // Very tight curl
                pose.ring   = fistCurl(1.35, 0.05);
                pose.pinky  = { mcpX: -0.05, mcpY: 0, mcpZ: -0.42, pipX: -0.05, dipX: -0.05 };  // Very extended
                pose.thumb  = { cmcX: 0.18, cmcY: -0.12, cmcZ: 0.95, mcpX: 0.08, mcpZ: 0.22, ipX: 0.04 };  // Very extended perpendicular

            } else if (name.includes('ONE') || name === 'ALPHABET D') {
                /* ONE / D - Index finger pointing up, others curled */
                pose.index  = { mcpX: -0.05, mcpY: 0, mcpZ: 0.00, pipX: -0.05, dipX: -0.05 };  // Straight up
                pose.middle = fistCurl(1.20, 0.00);
                pose.ring   = fistCurl(1.22, 0.08);
                pose.pinky  = fistCurl(1.24, 0.15);
                pose.thumb  = { cmcX: 0.45, cmcY: -0.18, cmcZ: -0.10, mcpX: 0.40, mcpZ: -0.05, ipX: 0.28 };  // Wrapped against palm

            } else if (name === 'ALPHABET L') {
                /* L SHAPE - Index up, thumb out at 90 degrees */
                pose.index  = { mcpX: -0.05, mcpY: 0, mcpZ: 0.00, pipX: -0.05, dipX: -0.05 };  // Straight up
                pose.middle = fistCurl(1.20, 0.00);
                pose.ring   = fistCurl(1.22, 0.08);
                pose.pinky  = fistCurl(1.24, 0.15);
                pose.thumb  = { cmcX: 0.02, cmcY: -0.02, cmcZ: 1.05, mcpX: 0.02, mcpZ: 0.28, ipX: 0.00 };  // Perpendicular L shape

            } else if (name === 'ALPHABET I') {
                /* I - Pinky extended, others curled */
                pose.index  = fistCurl(1.20, -0.06);
                pose.middle = fistCurl(1.22,  0.00);
                pose.ring   = fistCurl(1.24,  0.08);
                pose.pinky  = { mcpX: -0.05, mcpY: 0, mcpZ: -0.08, pipX: -0.05, dipX: -0.05 };  // Straight up
                pose.thumb  = { cmcX: 0.45, cmcY: -0.18, cmcZ: -0.10, mcpX: 0.40, mcpZ: -0.05, ipX: 0.28 };  // Wrapped

            } else if (name === 'ALPHABET C') {
                /* ALPHABET C - Hand curved like a C shape */
                pose.index  = { mcpX: 0.85, mcpY: 0, mcpZ:  0.04, pipX: 0.75, dipX: 0.52 };  // More curved
                pose.middle = { mcpX: 0.85, mcpY: 0, mcpZ:  0.00, pipX: 0.75, dipX: 0.52 };
                pose.ring   = { mcpX: 0.85, mcpY: 0, mcpZ: -0.04, pipX: 0.75, dipX: 0.52 };
                pose.pinky  = { mcpX: 0.85, mcpY: 0, mcpZ: -0.08, pipX: 0.75, dipX: 0.52 };
                pose.thumb  = { cmcX: 0.50, cmcY: -0.08, cmcZ: 0.45, mcpX: 0.45, mcpZ: 0.10, ipX: 0.35 };  // Thumb curved to match

            } else if (name.includes('YES') && !name.includes('FIST')) {
                /* YES - Fist nodding yes */
                pose.wrist  = { x: 0.2, y: 0.0, z: 0.0 };  // Slight nod
                pose.index  = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };   // Fully curled
                pose.middle = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 1.5, pipX: 1.6, dipX: 1.5, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.5, cmcY: -0.2, cmcZ: 0.0, mcpX: 0.5, mcpZ: 0.0, ipX: 0.4 };  // Wrapped over
                
            } else if (name.includes('FIST') || name === 'ALPHABET S') {
                /* FIST - Closed fist, thumb on side */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 1.4, pipX: 1.5, dipX: 1.4, mcpY: 0, mcpZ: 0.0 };   // Curled
                pose.middle = { mcpX: 1.4, pipX: 1.5, dipX: 1.4, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 1.4, pipX: 1.5, dipX: 1.4, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 1.4, pipX: 1.5, dipX: 1.4, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.3, cmcY: 0.0, cmcZ: 0.3, mcpX: 0.3, mcpZ: 0.0, ipX: 0.2 };  // On side
                
            } else if (name === 'ALPHABET A') {
                /* ALPHABET A - Fist with thumb alongside */
                pose.wrist  = { x: 0.0, y: 0.0, z: 0.0 };
                pose.index  = { mcpX: 1.3, pipX: 1.4, dipX: 1.3, mcpY: 0, mcpZ: 0.0 };
                pose.middle = { mcpX: 1.3, pipX: 1.4, dipX: 1.3, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 1.3, pipX: 1.4, dipX: 1.3, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 1.3, pipX: 1.4, dipX: 1.3, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.2, cmcY: 0.0, cmcZ: 0.2, mcpX: 0.1, mcpZ: 0.0, ipX: 0.0 };

            } else if (name.includes('NO')) {
                /* NO - Index and middle extended together (like scissors), others curled */
                pose.index  = { mcpX: 0.95, mcpY: 0, mcpZ: -0.06, pipX: 0.88, dipX: 0.45 };  // More extended
                pose.middle = { mcpX: 0.95, mcpY: 0, mcpZ:  0.06, pipX: 0.88, dipX: 0.45 };  // More extended
                pose.ring   = fistCurl(1.18, 0.08);  // Tighter curl
                pose.pinky  = fistCurl(1.22, 0.14);
                pose.thumb  = { cmcX: 0.55, cmcY: -0.22, cmcZ: -0.18, mcpX: 0.52, mcpZ: -0.10, ipX: 0.35 };  // Thumb more visible

            } else if (name.includes('STOP') || name.includes('DANGER') || name.includes('EMERGENCY')) {
                /* STOP - Flat palm forward, all fingers straight */
                pose.index  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.middle = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.ring   = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.pinky  = { mcpX: 0.0, pipX: 0.0, dipX: 0.0, mcpY: 0, mcpZ: 0.0 };
                pose.thumb  = { cmcX: 0.2, cmcY: 0.0, cmcZ: 0.8, mcpX: 0.0, mcpZ: 0.0, ipX: 0.0 };  // Out to side

            } else if (name.includes('CALL')) {
                /* CALL ME - Thumb and pinky DRAMATICALLY extended (phone gesture) */
                pose.index  = fistCurl(1.25, -0.06);  // Tight curl
                pose.middle = fistCurl(1.28,  0.00);
                pose.ring   = fistCurl(1.30,  0.08);
                pose.pinky  = { mcpX: -0.10, mcpY: 0, mcpZ: -0.45, pipX: -0.10, dipX: -0.10 };  // VERY extended
                pose.thumb  = { cmcX: 0.10, cmcY: -0.15, cmcZ: 0.92, mcpX: 0.06, mcpZ: 0.22, ipX: 0.03 };  // VERY extended opposite direction

            } else if (name.includes('FOUR')) {
                pose.index  = ext(0.10);
                pose.middle = ext(0.02);
                pose.ring   = ext(-0.06);
                pose.pinky  = ext(-0.14);
                pose.thumb  = Object.assign({}, thumbHold);

            } else {
                /* Default relaxed hand */
                pose.index  = ext(0.04);
                pose.middle = ext(0.01);
                pose.ring   = ext(-0.03);
                pose.pinky  = ext(-0.07);
                pose.thumb  = Object.assign({}, thumbOpen);
            }

            return pose;
        }
        /* ══════════════════════════════════════════════════════════════════════
           POSE APPLICATION
           ══════════════════════════════════════════════════════════════════════ */

        /* Copy a pose object into the target joint state (missing dofs -> 0) */
        _setTargetFromPose(pose) {
            if (!pose) return;
            const t = this.targetJoints;
            if (pose.wrist) t.wrist = Object.assign({ x: 0, y: 0, z: 0 }, pose.wrist);
            ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((part) => {
                if (!pose[part]) return;
                const keys = Object.keys(this.vel[part] || {});
                const clean = {};
                keys.forEach((k) => { clean[k] = pose[part][k] !== undefined ? pose[part][k] : 0; });
                t[part] = clean;
            });
            
            // Debug: Log current vs target state for index finger
            if (this.jointState.index && t.index) {
                console.log('Hand3D: Index finger - Current:', this.jointState.index, 'Target:', t.index);
            }
        }

        /* Apply one bone's flexion / splay / twist as an offset from its bind
           rotation. The axes were pre-converted into the bone's parent space,
           so premultiplying the bind quaternion yields the intended world
           rotation regardless of how the exporter oriented the bone. */
        _applyBone(boneName, flex, spread, twist) {
            const bone = this.bones[boneName];
            const rest = this.restLocal[boneName];
            if (!bone || !rest) return;

            const q = new THREE.Quaternion();

            if (twist && this.twistAxis[boneName]) {
                q.multiply(new THREE.Quaternion().setFromAxisAngle(this.twistAxis[boneName], twist));
            }
            if (spread && this.spreadAxis[boneName]) {
                q.multiply(new THREE.Quaternion().setFromAxisAngle(this.spreadAxis[boneName], spread));
            }
            if (flex && this.flexAxis[boneName]) {
                q.multiply(new THREE.Quaternion().setFromAxisAngle(this.flexAxis[boneName], flex));
            }

            bone.quaternion.copy(rest).premultiply(q);
        }

        /* Wrist tilt expressed around the armature's own X/Y/Z axes */
        _applyWrist(rx, ry, rz) {
            const bone = this.bones['wrist'];
            const rest = this.restLocal['wrist'];
            if (!bone || !rest) return;

            const parent = bone.parent || this.handRoot;
            const pq = new THREE.Quaternion();
            parent.getWorldQuaternion(pq);
            const inv = pq.clone().invert();

            const q = new THREE.Quaternion();
            if (rz) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1).applyQuaternion(inv).normalize(), rz));
            if (ry) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(inv).normalize(), ry));
            if (rx) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(inv).normalize(), rx));

            bone.quaternion.copy(rest).premultiply(q);
        }

        /* Push the current joint state into the skeleton (or the fallback) */
        _applyPose() {
            if (this.fallbackActive) { this._applyFallbackJoints(); return; }
            if (!this.modelReady) return;

            const js = this.jointState;

            ['index', 'middle', 'ring', 'pinky'].forEach((finger) => {
                const spec = FINGER_BONES[finger];
                const c = js[finger];
                if (!spec || !c) return;
                this._applyBone(spec.mcp, c.mcpX, c.mcpZ, c.mcpY);
                this._applyBone(spec.pip, c.pipX, 0, 0);
                this._applyBone(spec.dip, c.dipX, 0, 0);
            });

            if (js.thumb) {
                this._applyBone(THUMB_BONES.cmc, js.thumb.cmcX, js.thumb.cmcZ, js.thumb.cmcY);
                this._applyBone(THUMB_BONES.mcp, js.thumb.mcpX, js.thumb.mcpZ, 0);
                this._applyBone(THUMB_BONES.ip,  js.thumb.ipX,  0, 0);
            }

            if (js.wrist) {
                const mw = this._motionWrist || { x: 0, y: 0, z: 0 };
                this._applyWrist(js.wrist.x + mw.x, js.wrist.y + mw.y, js.wrist.z + mw.z);
            }
        }

        /* Simplified pose application for the procedural fallback hand.
           That hand points down -Y with the palm facing +Z, so curling toward
           the palm is a negative rotation around X. */
        _applyFallbackJoints() {
            const f = this.fallback;
            if (!f) return;
            const js = this.jointState;

            ['index', 'middle', 'ring', 'pinky'].forEach((finger) => {
                const g = f.fingers[finger];
                const c = js[finger];
                if (!g || !c) return;
                const baseSplay = g.mcp.userData.baseSplay || (g.mcp.userData.baseSplay = g.mcp.rotation.z);
                g.mcp.rotation.set(-(c.mcpX || 0), c.mcpY || 0, baseSplay + (c.mcpZ || 0) * 0.6);
                g.pip.rotation.x = -(c.pipX || 0);
                g.dip.rotation.x = -(c.dipX || 0);
            });

            const t = f.thumb;
            const tc = js.thumb;
            if (t && tc) {
                if (!t.cmc.userData.base) t.cmc.userData.base = t.cmc.rotation.z;
                t.cmc.rotation.set(-(tc.cmcX || 0), tc.cmcY || 0, t.cmc.userData.base + (tc.cmcZ || 0) * 0.6);
                t.mcp.rotation.set(-(tc.mcpX || 0), 0, (tc.mcpZ || 0) * 0.6);
                t.ip.rotation.x  = -(tc.ipX || 0);
            }
            
            // Debug fallback pose application
            if (Math.random() < 0.01) {  // Log occasionally to avoid spam
                console.log('Hand3D FALLBACK: Applying pose - Index mcpX:', js.index.mcpX);
            }
        }

        /* ══════════════════════════════════════════════════════════════════════
           PUBLIC API & HUMAN ANIMATION MODE
           ══════════════════════════════════════════════════════════════════════ */
        displaySign(item, speedClass = '') {
            if (!item) return;

            /* If the GLB is still downloading, remember the request */
            if (!this.modelReady && !this.fallbackActive) {
                this._pendingSign = { item: item, speed: speedClass };
                this.activeSignData = item;
                return;
            }

            this.activeSignData = item;
            this.playbackSpeed  = speedClass === 'slow-motion' ? 0.5 : 1.0;
            this.liveTracking   = false;                 // a sign overrides live mirror
            
            const targetPose = this.getSignJointTargets(item.name);
            this._targetSignPose = targetPose;
            this._animCycleTime = 0; // Reset animation timer to start from relaxed open hand!

            // Always begin from relaxed open hand so the user sees the human fingers animate into the sign
            this.jointState = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
            this.targetJoints = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
            this._resetVelocities();

            console.log('Hand3D: 🎬 Starting Human Animation Mode for sign:', item.name);

            const n = (item.name || '').toUpperCase();
            
            // Set optimal camera angle based on sign type
            if (n.includes('YES') || n.includes('FIST') || n === 'ALPHABET S' || n === 'ALPHABET A') {
                this.setCameraView('back');
            } else if (n.includes('PEACE') || n.includes('VICTORY') || n.includes('OK')) {
                this.setCameraView('front');
            } else if (n.includes('THUMBS') || n.includes('HELP')) {
                this.setCameraView('iso'); // 3D angle shows thumb better
            } else {
                this.setCameraView('front');
            }
        }

        replaySign() {
            if (!this.activeSignData) return;
            this._animCycleTime = 0;
            this.jointState = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
            this.targetJoints = JSON.parse(JSON.stringify(DEFAULT_JOINTS));
            this._resetVelocities();
            console.log('Hand3D: 🔁 Replaying Human Animation for:', this.activeSignData.name);
        }

        _resetVelocities() {
            this.vel = {
                wrist:  { x: 0, y: 0, z: 0 },
                thumb:  { cmcX: 0, cmcY: 0, cmcZ: 0, mcpX: 0, mcpZ: 0, ipX: 0 },
                index:  { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                middle: { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                ring:   { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                pinky:  { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 }
            };
        }

        /* Interpolate joint targets between two poses with smooth easing */
        _interpolatePoseTargets(from, to, t) {
            t = Math.max(0, Math.min(1, t));
            const tgt = this.targetJoints;

            // Fingers
            ['index', 'middle', 'ring', 'pinky'].forEach((finger) => {
                const fFrom = from[finger] || {};
                const fTo = to[finger] || {};
                if (!tgt[finger]) tgt[finger] = {};
                ['mcpX', 'mcpY', 'mcpZ', 'pipX', 'dipX'].forEach((k) => {
                    const vFrom = fFrom[k] !== undefined ? fFrom[k] : 0;
                    const vTo = fTo[k] !== undefined ? fTo[k] : 0;
                    tgt[finger][k] = vFrom + (vTo - vFrom) * t;
                });
            });

            // Thumb
            const tFrom = from.thumb || {};
            const tTo = to.thumb || {};
            if (!tgt.thumb) tgt.thumb = {};
            ['cmcX', 'cmcY', 'cmcZ', 'mcpX', 'mcpZ', 'ipX'].forEach((k) => {
                const vFrom = tFrom[k] !== undefined ? tFrom[k] : 0;
                const vTo = tTo[k] !== undefined ? tTo[k] : 0;
                tgt.thumb[k] = vFrom + (vTo - vFrom) * t;
            });

            // Wrist
            const wFrom = from.wrist || {};
            const wTo = to.wrist || {};
            if (!tgt.wrist) tgt.wrist = {};
            ['x', 'y', 'z'].forEach((k) => {
                const vFrom = wFrom[k] !== undefined ? wFrom[k] : 0;
                const vTo = wTo[k] !== undefined ? wTo[k] : 0;
                tgt.wrist[k] = vFrom + (vTo - vFrom) * t;
            });
        }

        _updateAnimationBadge(phase, factor, signName) {
            const labelEl = document.getElementById('threed-status-label');
            const badgeEl = document.getElementById('threed-status-badge');
            if (!labelEl) return;

            if (phase === 'open') {
                labelEl.textContent = '1. Relaxed Open Hand';
                if (badgeEl) badgeEl.className = 'threed-status-badge phase-open';
            } else if (phase === 'forming') {
                const pct = Math.round(factor * 100);
                labelEl.textContent = `2. Forming Sign: ${signName} (${pct}%)`;
                if (badgeEl) badgeEl.className = 'threed-status-badge phase-forming';
            } else if (phase === 'hold') {
                labelEl.textContent = `3. Hold Pose: ${signName}`;
                if (badgeEl) badgeEl.className = 'threed-status-badge phase-hold';
            } else if (phase === 'relaxing') {
                labelEl.textContent = 'Returning to Open Hand...';
                if (badgeEl) badgeEl.className = 'threed-status-badge phase-relax';
            }
        }

        setCameraView(viewMode) {
            if (!this.camera) return;
            const baseDist = 2.5;
            
            if (viewMode === 'front') {
                this.cameraTargetPos = new THREE.Vector3(0, 0.05, baseDist);
            } else if (viewMode === 'back') {
                this.cameraTargetPos = new THREE.Vector3(0, 0.05, -baseDist);
            } else if (viewMode === 'iso' || viewMode === 'angle') {
                this.cameraTargetPos = new THREE.Vector3(-1.3, 0.45, baseDist * 0.9);
            }
            if (this.controls) this.controls.target.set(0, 0, 0);
        }

        resetRotation() { this.setCameraView('front'); }

        /* ══════════════════════════════════════════════════════════════════════
           LIVE MEDIAPIPE MIRRORING
           ══════════════════════════════════════════════════════════════════════ */
        setLiveTracking(enabled) {
            this.liveTracking = !!enabled;
            if (enabled) {
                this.activeSignData = null;
                this._liveSmooth = null;
            }
        }

        /* Retarget a 21-point MediaPipe landmark list onto the rig.
           Joint angles are measured from the landmark geometry itself, so the
           pose is independent of where the hand is or how large it appears. */
        updateFromLandmarks(landmarks) {
            if (!landmarks || landmarks.length < 21) return;
            if (!this.modelReady && !this.fallbackActive) return;

            const pose = this._landmarksToPose(landmarks);
            if (!pose) return;

            /* Exponential smoothing removes MediaPipe's per-frame jitter */
            if (!this._liveSmooth) {
                this._liveSmooth = JSON.parse(JSON.stringify(pose));
            } else {
                const a = 0.45;
                ['index', 'middle', 'ring', 'pinky'].forEach((f) => {
                    for (const k in pose[f]) {
                        this._liveSmooth[f][k] += (pose[f][k] - this._liveSmooth[f][k]) * a;
                    }
                });
                for (const k in pose.thumb) {
                    this._liveSmooth.thumb[k] += (pose.thumb[k] - this._liveSmooth.thumb[k]) * a;
                }
                ['x', 'y', 'z'].forEach((k) => {
                    this._liveSmooth.wrist[k] += (pose.wrist[k] - this._liveSmooth.wrist[k]) * a;
                });
            }

            this.liveTracking = true;
            this._setTargetFromPose(this._liveSmooth);
        }

        /* Convert 21 normalised landmarks into the joint-state model */
        _landmarksToPose(lm) {
            /* MediaPipe is image-space (+y down, +z away from camera).
               Flip y so the geometry behaves like a standard right-handed frame. */
            const P = lm.map((p) => new THREE.Vector3(p.x, -p.y, -(p.z || 0)));

            const sub = (a, b) => P[a].clone().sub(P[b]);
            const angle = (a, b, c) => {
                const v1 = sub(a, b).normalize();
                const v2 = sub(c, b).normalize();
                const d = Math.max(-1, Math.min(1, v1.dot(v2)));
                return Math.acos(d);                       // 0 = fully folded
            };
            /* Flexion = how far the joint is from straight (PI = straight) */
            const flex = (a, b, c) => Math.max(0, Math.PI - angle(a, b, c));
            const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

            /* Palm frame used as the splay reference */
            const across  = sub(17, 5).normalize();        // index MCP -> pinky MCP
            const forward = sub(9, 0).normalize();         // wrist -> middle MCP

            const splayOf = (mcp, pip) => {
                const dir = sub(pip, mcp).normalize();
                const lateral = Math.sign(dir.dot(across)) * Math.acos(clamp(Math.abs(dir.dot(forward)), 0, 1));
                return clamp(lateral, -0.45, 0.45);
            };

            const finger = (mcp, pip, dip, tip, restSplay) => ({
                /* MCP flexion: angle between the metacarpal direction (MCP→PIP)
                   and the palm's forward axis — yields ≈ 0 for a flat hand
                   instead of the old wrist-relative formula which biased ~0.54 rad. */
                mcpX: clamp(Math.acos(clamp(sub(pip, mcp).normalize().dot(forward), -1, 1)), 0, 1.6),
                pipX: clamp(flex(mcp, pip, dip), 0, Math.PI),
                dipX: clamp(flex(pip, dip, tip), 0, Math.PI),
                mcpY: 0,
                mcpZ: restSplay + splayOf(mcp, pip)
            });

            const pose = {
                wrist:  { x: 0, y: 0, z: 0 },
                index:  finger(5, 6, 7, 8, 0.04),
                middle: finger(9, 10, 11, 12, 0.00),
                ring:   finger(13, 14, 15, 16, -0.04),
                pinky:  finger(17, 18, 19, 20, -0.08)
            };

            /* Thumb: CMC opens the web; MCP and IP add the curl */
            const webOpen = Math.acos(clamp(sub(2, 1).normalize().dot(sub(5, 0).normalize()), -1, 1));
            pose.thumb = {
                cmcX: clamp(flex(0, 1, 2), 0, 1.3),
                cmcY: 0,
                cmcZ: clamp(webOpen - 0.6, -0.45, 0.8),
                mcpX: clamp(flex(1, 2, 3), 0, 1.3),
                mcpZ: 0,
                ipX:  clamp(flex(2, 3, 4), 0, 1.3)
            };

            /* Wrist orientation derived from the palm plane */
            const palmNormal = new THREE.Vector3().crossVectors(forward, across).normalize();
            pose.wrist = {
                x: clamp(-Math.asin(clamp(palmNormal.y, -1, 1)) * 0.8, -0.5, 0.5),
                y: 0,
                z: clamp(Math.atan2(across.y, across.x) * 0.35, -0.5, 0.5)
            };

            return pose;
        }

        /* ══════════════════════════════════════════════════════════════════════
           SIGN MOTION - makes each sign breathe / sway instead of freezing
           (offsets are relative to a centred hand, unlike the old build which
           sat the hand lower in the viewport)
           ══════════════════════════════════════════════════════════════════════ */
        _applySignMotion(name, t) {
            let rootX = 0, rootY = 0, rootZ = 0;
            let wRX = 0, wRY = 0, wRZ = 0;

            if (name.includes('HELLO') || name.includes('HI')) {
                wRZ   = Math.sin(t * 1.28) * 0.28;
                wRY   = Math.cos(t * 1.28) * 0.09;
                rootY += Math.abs(Math.sin(t * 1.28)) * 0.04;

            } else if (name.includes('THANK')) {
                const c = (Math.sin(t * 0.75) + 1) * 0.5;
                rootY = 0.16 - c * 0.24;
                rootZ = c * 0.36;
                wRX   = -0.08 + c * 0.28;

            } else if (name.includes('HELP')) {
                const lift = (Math.sin(t * 1.15) + 1) * 0.5;
                rootY = -0.13 + lift * 0.32;
                rootZ = (Math.sin(t * 1.15 + 0.6) + 1) * 0.08;

            } else if (name.includes('THUMBS')) {
                const b = Math.sin(t * 1.50);
                rootY += b > 0 ? b * 0.12 : 0;
                wRX    = b > 0 ? -0.06 : 0;

            } else if (name.includes('YES') || name.includes('FIST')) {
                wRX   = Math.sin(t * 1.55) * 0.24;
                rootY += Math.abs(Math.sin(t * 1.55)) * 0.04;

            } else if (name.includes('NO')) {
                wRY = Math.sin(t * 1.85) * 0.22;

            } else if (name.includes('STOP') || name.includes('DANGER')) {
                const push = Math.sin(t * 1.60);
                rootZ = push * 0.15;
                wRX   = push * 0.08;

            } else if (name.includes('PEACE') || name.includes('VICTORY') || name.includes('TWO')) {
                wRZ   = Math.sin(t * 0.75) * 0.08;
                rootY += Math.sin(t * 0.75) * 0.03;

            } else if (name.includes('OK')) {
                rootX  = Math.cos(t * 1.10) * 0.08;
                rootY += Math.sin(t * 1.10) * 0.06;

            } else if (name.includes('ROCK') || name.includes('METAL') || name.includes('HORNS')) {
                const th = (Math.sin(t * 1.30) + 1) * 0.5;
                rootZ = th * 0.18;
                rootY += Math.sin(t * 1.30) * 0.05;
                wRX   = th * -0.10;

            } else if (name.includes('I LOVE YOU')) {
                wRZ   = Math.sin(t * 0.65) * 0.12;
                rootY += Math.sin(t * 0.65 + 0.5) * 0.04;

            } else if (name.includes('CALL')) {
                wRX = Math.sin(t * 0.90) * 0.10;
                wRZ = Math.cos(t * 0.90) * 0.08;

            } else {
                rootY += Math.sin(t * 0.48) * 0.016;
                wRZ    = Math.sin(t * 0.38) * 0.020;
                wRX    = Math.sin(t * 0.55 + 1.0) * 0.010;
            }

            /* Micro-tremor so the hand never looks like a frozen statue */
            const tr = 0.0030;
            rootX += Math.sin(t * 9.7)  * tr + Math.sin(t * 17.3) * tr * 0.5;
            rootY += Math.cos(t * 7.3)  * tr + Math.cos(t * 13.1) * tr * 0.4;
            rootZ += Math.sin(t * 11.5) * tr * 0.6;

            this._rootOffset = { x: rootX, y: rootY, z: rootZ };
            this._motionWrist = { x: wRX, y: wRY, z: wRZ };
        }

        /* Gentle float used while mirroring the webcam or idling */
        _applyIdleMotion(t) {
            this._rootOffset  = { x: Math.sin(t * 0.7) * 0.010, y: Math.sin(t * 1.1) * 0.012, z: 0 };
            this._motionWrist = { x: Math.sin(t * 0.9) * 0.012, y: 0, z: Math.sin(t * 0.6) * 0.014 };
        }

        /* ══════════════════════════════════════════════════════════════════════
           SPRING INTEGRATION
           ══════════════════════════════════════════════════════════════════════ */
        _updateJoints(dt) {
            /* Frame-rate independent spring coefficients (1.0 at 60 fps) */
            const step = Math.min(Math.max(dt, 0), 0.05) * 60;
            const K = 0.45 * step;  // Increased from 0.22 for faster transitions
            const D = Math.pow(0.55, step);  // Increased damping from 0.66 for snappier response

            ['index', 'middle', 'ring', 'pinky'].forEach((fn) => {
                const cur = this.jointState[fn];
                const tgt = this.targetJoints[fn];
                const v   = this.vel[fn];
                if (!cur || !tgt) return;
                ['mcpX', 'mcpY', 'mcpZ', 'pipX', 'dipX'].forEach((key) => {
                    if (tgt[key] === undefined) return;
                    const s = this._spring(cur[key] || 0, tgt[key], v[key] || 0, K, D);
                    cur[key] = s.val;
                    v[key]   = s.vel;
                });
            });

            const cur = this.jointState.thumb;
            const tgt = this.targetJoints.thumb;
            const v   = this.vel.thumb;
            if (cur && tgt && v) {
                ['cmcX', 'cmcY', 'cmcZ', 'mcpX', 'mcpZ', 'ipX'].forEach((key) => {
                    if (tgt[key] === undefined) return;
                    const s = this._spring(cur[key] || 0, tgt[key], v[key] || 0, K, D);
                    cur[key] = s.val;
                    v[key]   = s.vel;
                });
            }

            if (this.targetJoints.wrist && this.jointState.wrist) {
                const cw = this.jointState.wrist, tw = this.targetJoints.wrist, vw = this.vel.wrist;
                ['x', 'y', 'z'].forEach((key) => {
                    if (tw[key] === undefined) return;
                    const s = this._spring(cw[key] || 0, tw[key], vw[key] || 0, K, D);
                    cw[key] = s.val;
                    vw[key] = s.vel;
                });
            }
        }

        /* ══════════════════════════════════════════════════════════════════════
           RENDER LOOP
           ══════════════════════════════════════════════════════════════════════ */
        animate() {
            this.animationId = requestAnimationFrame(() => this.animate());

            const delta = this.clock ? this.clock.getDelta() : 0.016;
            this.time  += delta * this.playbackSpeed;
            const t     = this.time * 2.8;

            if (this.cameraTargetPos) {
                this.camera.position.lerp(this.cameraTargetPos, 0.08);
                if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.02) this.cameraTargetPos = null;
            }
            if (this.controls) this.controls.update();

            if (!this._rootOffset)  this._rootOffset  = { x: 0, y: 0, z: 0 };
            if (!this._motionWrist) this._motionWrist = { x: 0, y: 0, z: 0 };

            if (this.liveTracking) {
                this._applyIdleMotion(t);
            } else if (this.activeSignData && this._targetSignPose) {
                // 🎬 HUMAN ANIMATION MODE: 4-Phase Cycle
                this._animCycleTime = (this._animCycleTime || 0) + delta * this.playbackSpeed;

                // Total cycle: 3.4 seconds (at 1.0x speed, or 6.8s at 0.5x slow-mo)
                // 0.0s - 0.4s: (0.4s) Phase 1: Relaxed neutral open human hand
                // 0.4s - 1.8s: (1.4s) Phase 2: Visible finger curling / articulate forming of the sign!
                // 1.8s - 2.8s: (1.0s) Phase 3: Hold formed sign with realistic gesture motion
                // 2.8s - 3.4s: (0.6s) Phase 4: Smooth return back to open hand to repeat
                const cycleDuration = 3.4;
                const cycleT = this._animCycleTime % cycleDuration;

                let blendFactor = 0;
                let statusPhase = 'open';

                if (cycleT < 0.4) {
                    blendFactor = 0;
                    statusPhase = 'open';
                } else if (cycleT < 1.8) {
                    const u = (cycleT - 0.4) / 1.4;
                    blendFactor = u * u * (3 - 2 * u); // Smooth cubic ease-in-out
                    statusPhase = 'forming';
                } else if (cycleT < 2.8) {
                    blendFactor = 1.0;
                    statusPhase = 'hold';
                } else {
                    const u = (cycleT - 2.8) / 0.6;
                    blendFactor = 1.0 - (u * u * (3 - 2 * u));
                    statusPhase = 'relaxing';
                }

                // Smoothly blend targets so fingers animate physically into the pose
                this._interpolatePoseTargets(DEFAULT_JOINTS, this._targetSignPose, blendFactor);
                this._updateAnimationBadge(statusPhase, blendFactor, this.activeSignData.name || '');

                if (blendFactor > 0.15) {
                    this._applySignMotion((this.activeSignData.name || '').toUpperCase(), t);
                    if (this._rootOffset) {
                        this._rootOffset.x *= blendFactor;
                        this._rootOffset.y *= blendFactor;
                        this._rootOffset.z *= blendFactor;
                    }
                } else {
                    this._applyIdleMotion(t);
                }
            } else {
                this._applyIdleMotion(t);
            }

            this._updateJoints(delta);
            this._applyPose();

            if (this.handRoot) {
                this.handRoot.position.set(this._rootOffset.x, this._rootOffset.y, this._rootOffset.z);
            }

            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        }

        onWindowResize() {
            if (!this.container || !this.renderer || !this.camera) return;
            const W = this.container.clientWidth, H = this.container.clientHeight;
            if (!W || !H) return;
            this.camera.aspect = W / H;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(W, H);
        }

        destroy() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            if (this.controls && this.controls.dispose) this.controls.dispose();
            if (this.skinMaterial) this.skinMaterial.dispose();
            if (this.renderer) {
                if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                    this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
                }
                this.renderer.dispose();
            }
            this.canvas      = null;
            this.renderer    = null;
            this.controls    = null;
            this.isInitialized = false;
            this.modelReady    = false;
            this.fallbackActive = false;
        }
    }

    window.Hand3D = new Hand3DController();

})(window);

