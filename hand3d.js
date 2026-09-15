/**
 * Hand3D - Interactive Realistic 3D Human Hand Model with Three.js (WebGL)
 * DBS & DBE Project - Real-time Sign Language Translator
 *
 * Robust Anatomical Geometry + Zero Artifacts + Expressive Sign Language Gestures
 */

(function (window) {
    'use strict';

    class Hand3DController {
        constructor() {
            this.container   = null;
            this.canvas      = null;
            this.renderer    = null;
            this.scene       = null;
            this.camera      = null;
            this.controls    = null;
            this.handRoot    = null;
            this.wristJoint  = null;
            this.armMesh     = null;
            this.palmMesh    = null;
            this.fingers     = {};
            this.animationId = null;

            this.playbackSpeed  = 1.0;
            this.activeSignData = null;
            this.clock          = null;
            this.time           = 0;
            this.isInitialized  = false;

            this.cameraTargetPos = null;

            this.skinMaterial = null;
            this.nailMaterial = null;

            /* Joint state */
            this.jointState = {
                wrist:  { x: 0, y: 0, z: 0 },
                thumb:  { cmcX: 0.12, cmcY: 0.02, cmcZ: 0.10, mcpX: 0.04, mcpZ: 0.01, ipX: 0.02 },
                index:  { mcpX: 0.02, mcpY: 0.00, mcpZ: 0.04, pipX: 0.02, dipX: 0.02 },
                middle: { mcpX: 0.01, mcpY: 0.00, mcpZ: 0.00, pipX: 0.02, dipX: 0.02 },
                ring:   { mcpX: 0.02, mcpY: 0.00, mcpZ: -0.04, pipX: 0.02, dipX: 0.02 },
                pinky:  { mcpX: 0.04, mcpY: 0.00, mcpZ: -0.08, pipX: 0.03, dipX: 0.02 }
            };

            /* Spring velocities */
            this.vel = {
                thumb:  { cmcX: 0, cmcY: 0, cmcZ: 0, mcpX: 0, mcpZ: 0, ipX: 0 },
                index:  { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                middle: { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                ring:   { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 },
                pinky:  { mcpX: 0, mcpY: 0, mcpZ: 0, pipX: 0, dipX: 0 }
            };

            this.targetJoints = JSON.parse(JSON.stringify(this.jointState));
        }

        _spring(cur, tgt, vel, k, d) {
            const force = (tgt - cur) * k;
            vel = vel * d + force;
            return { val: cur + vel, vel: vel };
        }

        /* ══════════════════════════════════════════════════════════════════════
           INIT
           ══════════════════════════════════════════════════════════════════════ */
        init(containerElement) {
            if (typeof THREE === 'undefined') {
                console.error('Three.js not found');
                return false;
            }

            this.container = containerElement;
            this.container.innerHTML = '';

            const W = this.container.clientWidth  || 300;
            const H = this.container.clientHeight || 300;

            this.scene = new THREE.Scene();
            this.clock = new THREE.Clock();

            this.camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
            this.camera.position.set(0, 0.44, 3.4);

            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(W, H);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

            this.canvas = this.renderer.domElement;
            this.canvas.id = 'hand-3d-canvas';
            this.canvas.style.cssText = 'width:100%;height:100%;outline:none;cursor:grab;';
            this.container.appendChild(this.canvas);

            if (typeof THREE.OrbitControls !== 'undefined') {
                this.controls = new THREE.OrbitControls(this.camera, this.canvas);
                this.controls.enableDamping = true;
                this.controls.dampingFactor = 0.08;
                this.controls.minDistance   = 1.8;
                this.controls.maxDistance   = 5.0;
                this.controls.target.set(0, 0.38, 0);
                this.controls.maxPolarAngle = Math.PI * 0.95;
                this.controls.minPolarAngle = Math.PI * 0.05;

                this.canvas.addEventListener('mousedown', () => { this.canvas.style.cursor = 'grabbing'; });
                window.addEventListener('mouseup', () => { if (this.canvas) this.canvas.style.cursor = 'grab'; });
            }

            this.setupLighting();
            this.initMaterials();
            this.buildHandModel();

            this.isInitialized = true;
            this.animate();

            const ro = new ResizeObserver(() => this.onWindowResize());
            ro.observe(this.container);
            return true;
        }

        /* ══════════════════════════════════════════════════════════════════════
           LIGHTING
           ══════════════════════════════════════════════════════════════════════ */
        setupLighting() {
            this.scene.add(new THREE.AmbientLight(0xfff3ec, 0.80));

            const key = new THREE.DirectionalLight(0xfff5ea, 1.20);
            key.position.set(2.2, 3.6, 3.0);
            key.castShadow = true;
            key.shadow.mapSize.set(1024, 1024);
            key.shadow.bias = -0.0010;
            this.scene.add(key);

            const fill = new THREE.DirectionalLight(0xdbe8fa, 0.55);
            fill.position.set(-2.5, 2.0, 2.2);
            this.scene.add(fill);

            const rim = new THREE.DirectionalLight(0xffe6d6, 1.15);
            rim.position.set(0, 3.2, -3.0);
            this.scene.add(rim);

            const ground = new THREE.DirectionalLight(0xffdec8, 0.30);
            ground.position.set(0, -2.8, 1.0);
            this.scene.add(ground);
        }

        /* ══════════════════════════════════════════════════════════════════════
           MATERIALS
           ══════════════════════════════════════════════════════════════════════ */
        initMaterials() {
            const skinTex = this._createProceduralSkinTexture();

            this.skinMaterial = new THREE.MeshStandardMaterial({
                color: 0xf5ba9e,
                map: skinTex,
                roughness: 0.50,
                metalness: 0.01
            });

            this.nailMaterial = new THREE.MeshStandardMaterial({
                color: 0xfde2d6,
                roughness: 0.20,
                metalness: 0.02
            });
        }

        _createProceduralSkinTexture() {
            if (typeof document === 'undefined') return null;
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 512;
            const ctx = c.getContext('2d');
            if (!ctx) return null;

            const grad = ctx.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0.00, '#eed0be');
            grad.addColorStop(0.40, '#e5b69c');
            grad.addColorStop(0.80, '#dc9e82');
            grad.addColorStop(1.00, '#d29074');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 512, 512);

            const addGlow = (x, y, r, alpha) => {
                const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
                rg.addColorStop(0, `rgba(235, 140, 120, ${alpha})`);
                rg.addColorStop(0.6, `rgba(230, 150, 130, ${alpha * 0.4})`);
                rg.addColorStop(1, 'rgba(230, 150, 130, 0)');
                ctx.fillStyle = rg;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            };

            addGlow(160, 360, 110, 0.30);
            addGlow(360, 370, 85, 0.25);
            addGlow(120, 120, 45, 0.25);
            addGlow(200, 90, 45, 0.25);
            addGlow(280, 95, 45, 0.25);
            addGlow(360, 140, 40, 0.22);

            const imgData = ctx.getImageData(0, 0, 512, 512);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
                const n = (Math.random() - 0.5) * 5;
                d[i]   = Math.min(255, Math.max(0, d[i] + n));
                d[i+1] = Math.min(255, Math.max(0, d[i+1] + n * 0.8));
                d[i+2] = Math.min(255, Math.max(0, d[i+2] + n * 0.6));
            }
            ctx.putImageData(imgData, 0, 0);

            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        }

        /* ══════════════════════════════════════════════════════════════════════
           HAND MODEL GEOMETRY
           ══════════════════════════════════════════════════════════════════════ */
        buildHandModel() {
            this.handRoot = new THREE.Group();
            this.handRoot.position.set(0, -0.42, 0);
            this.scene.add(this.handRoot);

            /* ── 1. Forearm (anatomical oval cylinder) ── */
            const armGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.68, 28);
            armGeo.scale(1.0, 1.0, 0.68);
            this.armMesh = new THREE.Mesh(armGeo, this.skinMaterial);
            this.armMesh.position.set(0, -0.34, 0);
            this.armMesh.castShadow = true;
            this.armMesh.receiveShadow = true;
            this.handRoot.add(this.armMesh);

            /* ── 2. Wrist Joint Pivot ── */
            this.wristJoint = new THREE.Group();
            this.wristJoint.position.set(0, 0.04, 0);
            this.handRoot.add(this.wristJoint);

            /* ── 3. Sculpted Palm ── */
            this._buildPalm();

            /* ── 4. Articulated Fingers ── */
            const fingerCfgs = [
                { name: 'index',  x: -0.125, y: 0.60, z: 0.005, l1: 0.30, l2: 0.21, l3: 0.15, r: 0.058 },
                { name: 'middle', x: -0.005, y: 0.64, z: 0.010, l1: 0.33, l2: 0.23, l3: 0.16, r: 0.060 },
                { name: 'ring',   x:  0.115, y: 0.60, z: 0.005, l1: 0.31, l2: 0.22, l3: 0.15, r: 0.056 },
                { name: 'pinky',  x:  0.225, y: 0.52, z: -0.005,l1: 0.24, l2: 0.17, l3: 0.13, r: 0.048 }
            ];

            fingerCfgs.forEach(cfg => {
                this.fingers[cfg.name] = this._buildArticulatedFinger(cfg);
                this.wristJoint.add(this.fingers[cfg.name].root);
            });

            /* ── 5. Opposable Thumb ── */
            this.fingers.thumb = this._buildOpposableThumb();
            this.wristJoint.add(this.fingers.thumb.root);
        }

        /* ── Clean Sculpted Palm ─────────────────────────────────────────── */
        _buildPalm() {
            const palmGeo = new THREE.BoxGeometry(0.54, 0.62, 0.18, 14, 14, 6);
            const pos = palmGeo.attributes.position;

            for (let i = 0; i < pos.count; i++) {
                let x = pos.getX(i);
                let y = pos.getY(i);
                let z = pos.getZ(i);

                // Wrist taper
                if (y < -0.12) {
                    x *= 0.82;
                    z *= 0.86;
                }

                // Thenar eminence (thumb mound)
                if (x < -0.05 && y > -0.22 && y < 0.24 && z > 0) {
                    const d = Math.hypot(x - (-0.20), y - 0.02);
                    if (d < 0.24) z += Math.cos(d / 0.24 * Math.PI * 0.5) * 0.065;
                }

                // Hypothenar eminence (pinky heel)
                if (x > 0.05 && y > -0.20 && y < 0.18 && z > 0) {
                    const d = Math.hypot(x - 0.18, y - 0.0);
                    if (d < 0.20) z += Math.cos(d / 0.20 * Math.PI * 0.5) * 0.038;
                }

                // Central palmar hollow
                if (Math.abs(x) < 0.10 && y > -0.05 && y < 0.22 && z > 0) {
                    z -= 0.020;
                }

                // Knuckle arch
                if (y > 0.15) {
                    y += Math.cos(x * 3.4) * 0.045;
                }

                pos.setXYZ(i, x, y, z);
            }
            palmGeo.computeVertexNormals();

            this.palmMesh = new THREE.Mesh(palmGeo, this.skinMaterial);
            this.palmMesh.position.set(0, 0.31, 0);
            this.palmMesh.castShadow = true;
            this.palmMesh.receiveShadow = true;
            this.wristJoint.add(this.palmMesh);
        }

        /* ── Solid Smooth Phalanx Segment ─────────────────────────────────── */
        _createSegment(rBot, rTop, len, isTip) {
            const group = new THREE.Group();

            // Cylinder body
            const cylGeo = new THREE.CylinderGeometry(rTop, rBot, len, 24, 1, false);
            cylGeo.translate(0, len * 0.5, 0);
            const cyl = new THREE.Mesh(cylGeo, this.skinMaterial);
            cyl.castShadow = true;
            group.add(cyl);

            // Knuckle ball at joint base
            const baseJoint = new THREE.Mesh(new THREE.SphereGeometry(rBot * 1.01, 18, 14), this.skinMaterial);
            baseJoint.castShadow = true;
            group.add(baseJoint);

            // If tip, smooth rounded dome
            if (isTip) {
                const tipGeo = new THREE.SphereGeometry(rTop * 1.01, 18, 14);
                tipGeo.translate(0, len, 0);
                const tipMesh = new THREE.Mesh(tipGeo, this.skinMaterial);
                tipMesh.castShadow = true;
                group.add(tipMesh);
            }

            return group;
        }

        /* ── Delicate Curved Fingernail ───────────────────────────────────── */
        _createFingernail(width, len) {
            const geo = new THREE.BoxGeometry(width, len, 0.008);
            const mesh = new THREE.Mesh(geo, this.nailMaterial);
            mesh.castShadow = true;
            return mesh;
        }

        /* ── Build Articulated Finger ─────────────────────────────────────── */
        _buildArticulatedFinger(cfg) {
            const root = new THREE.Group();
            root.position.set(cfg.x, cfg.y, cfg.z);

            // MCP
            const mcp = new THREE.Group();
            root.add(mcp);

            const mcpKnuckle = new THREE.Mesh(new THREE.SphereGeometry(cfg.r * 1.04, 18, 14), this.skinMaterial);
            mcpKnuckle.castShadow = true;
            mcp.add(mcpKnuckle);

            const seg1 = this._createSegment(cfg.r, cfg.r * 0.90, cfg.l1, false);
            mcp.add(seg1);

            // PIP
            const pip = new THREE.Group();
            pip.position.set(0, cfg.l1, 0);
            mcp.add(pip);

            const seg2 = this._createSegment(cfg.r * 0.90, cfg.r * 0.80, cfg.l2, false);
            pip.add(seg2);

            // DIP
            const dip = new THREE.Group();
            dip.position.set(0, cfg.l2, 0);
            pip.add(dip);

            const seg3 = this._createSegment(cfg.r * 0.80, cfg.r * 0.65, cfg.l3, true);
            dip.add(seg3);

            // Fingernail on dorsal side (-Z)
            const nail = this._createFingernail(cfg.r * 0.92, cfg.l3 * 0.45);
            nail.position.set(0, cfg.l3 * 0.65, -cfg.r * 0.62);
            nail.rotation.x = -0.04;
            dip.add(nail);

            return { root, mcp, pip, dip };
        }

        /* ── Build Opposable Thumb ────────────────────────────────────────── */
        _buildOpposableThumb() {
            const root = new THREE.Group();
            root.position.set(-0.22, 0.18, 0.05);

            // CMC
            const cmc = new THREE.Group();
            root.add(cmc);

            const lMetacarpal = 0.22;
            const rBase = 0.076, rMcp = 0.068;
            const meta = this._createSegment(rBase, rMcp, lMetacarpal, false);
            cmc.add(meta);

            // MCP
            const mcp = new THREE.Group();
            mcp.position.set(0, lMetacarpal, 0);
            cmc.add(mcp);

            const lProximal = 0.22;
            const rIp = 0.060;
            const prox = this._createSegment(rMcp, rIp, lProximal, false);
            mcp.add(prox);

            // IP
            const ip = new THREE.Group();
            ip.position.set(0, lProximal, 0);
            mcp.add(ip);

            const lDistal = 0.20;
            const rTip = 0.050;
            const dist = this._createSegment(rIp, rTip, lDistal, true);
            ip.add(dist);

            // Thumb nail on dorsal side
            const nail = this._createFingernail(rIp * 1.05, lDistal * 0.46);
            nail.position.set(0, lDistal * 0.62, -rIp * 0.64);
            nail.rotation.x = -0.04;
            ip.add(nail);

            cmc.rotation.set(0.12, 0.02, 0.10);

            return { root, cmc, mcp, ip };
        }

        /* ══════════════════════════════════════════════════════════════════════
           SIGN POSE LIBRARY
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

            /* Base open hand */
            const pose = {
                wrist:  { x: 0, y: 0, z: 0 },
                thumb:  { ...thumbOpen },
                index:  ext(0.04),
                middle: ext(0.00),
                ring:   ext(-0.04),
                pinky:  ext(-0.08)
            };

            if (name.includes('THUMBS') || name.includes('HELP')) {
                /* THUMBS UP / HELP */
                pose.wrist  = { x: -0.06, y: 0.04, z: 0.02 };
                pose.index  = fistCurl(1.0, -0.04);
                pose.middle = fistCurl(1.0,  0.00);
                pose.ring   = fistCurl(1.0,  0.05);
                pose.pinky  = fistCurl(1.0,  0.10);
                pose.thumb  = {
                    cmcX: -0.20,
                    cmcY:  0.08,
                    cmcZ:  0.28,
                    mcpX: -0.12,
                    mcpZ:  0.06,
                    ipX:  -0.08
                };

            } else if (name.includes('THANK') || name === 'ALPHABET B') {
                /* THANK YOU / B: flat hand, thumb alongside index */
                pose.index  = ext(0.01);
                pose.middle = ext(0.00);
                pose.ring   = ext(-0.01);
                pose.pinky  = ext(-0.02);
                pose.thumb  = {
                    cmcX: 0.12,
                    cmcY: 0.02,
                    cmcZ: 0.10,
                    mcpX: 0.04,
                    mcpZ: 0.01,
                    ipX:  0.02
                };

            } else if (name.includes('HELLO') || name.includes('HI') || name.includes('FIVE')) {
                /* HELLO / HIGH FIVE */
                pose.index  = ext(0.12);
                pose.middle = ext(0.02);
                pose.ring   = ext(-0.08);
                pose.pinky  = ext(-0.18);
                pose.thumb  = { cmcX: 0.10, cmcY: -0.06, cmcZ: 0.65, mcpX: 0.04, mcpZ: 0.10, ipX: 0.02 };

            } else if (name.includes('PEACE') || name.includes('VICTORY') || name.includes('TWO') || name === 'ALPHABET V') {
                /* PEACE / V */
                pose.index  = { mcpX: 0.02, mcpY: 0, mcpZ:  0.16, pipX: 0.02, dipX: 0.02 };
                pose.middle = { mcpX: 0.02, mcpY: 0, mcpZ: -0.14, pipX: 0.02, dipX: 0.02 };
                pose.ring   = fistCurl(1.0, 0.04);
                pose.pinky  = fistCurl(1.0, 0.08);
                pose.thumb  = thumbHold;

            } else if (name === 'ALPHABET U') {
                pose.index  = { mcpX: 0.02, mcpY: 0, mcpZ:  0.01, pipX: 0.02, dipX: 0.02 };
                pose.middle = { mcpX: 0.02, mcpY: 0, mcpZ: -0.01, pipX: 0.02, dipX: 0.02 };
                pose.ring   = fistCurl(1.0, 0.04);
                pose.pinky  = fistCurl(1.0, 0.08);
                pose.thumb  = thumbHold;

            } else if (name.includes('WATER') || name.includes('THREE') || name === 'ALPHABET W') {
                pose.index  = ext(0.16);
                pose.middle = ext(0.00);
                pose.ring   = ext(-0.16);
                pose.pinky  = fistCurl(1.0, 0.08);
                pose.thumb  = thumbHold;

            } else if (name.includes('OK') || name === 'ALPHABET F') {
                pose.index  = { mcpX: 0.88, mcpY: 0.06, mcpZ: -0.08, pipX: 1.15, dipX: 0.85 };
                pose.middle = ext(-0.03);
                pose.ring   = ext(-0.10);
                pose.pinky  = ext(-0.18);
                pose.thumb  = { cmcX: 0.50, cmcY: -0.20, cmcZ: -0.12, mcpX: 0.58, mcpZ: -0.06, ipX: 0.42 };

            } else if (name.includes('ROCK') || name.includes('METAL') || name.includes('HORNS')) {
                pose.index  = ext(0.08);
                pose.pinky  = ext(-0.16);
                pose.middle = fistCurl(1.0, 0.00);
                pose.ring   = fistCurl(1.0, 0.04);
                pose.thumb  = thumbFist;

            } else if (name.includes('I LOVE YOU') || name === 'ALPHABET Y') {
                pose.index  = name.includes('LOVE') ? ext(0.08) : fistCurl(1.0);
                pose.middle = fistCurl(1.0, 0.00);
                pose.ring   = fistCurl(1.0, 0.04);
                pose.pinky  = ext(-0.20);
                pose.thumb  = { cmcX: 0.06, cmcY: -0.10, cmcZ: 0.65, mcpX: 0.04, mcpZ: 0.10, ipX: 0.02 };

            } else if (name.includes('ONE') || name === 'ALPHABET D') {
                pose.index  = ext(0.00);
                pose.middle = fistCurl(1.0, 0.00);
                pose.ring   = fistCurl(1.0, 0.05);
                pose.pinky  = fistCurl(1.0, 0.10);
                pose.thumb  = thumbFist;

            } else if (name === 'ALPHABET L') {
                pose.index  = ext(0.00);
                pose.middle = fistCurl(1.0, 0.00);
                pose.ring   = fistCurl(1.0, 0.05);
                pose.pinky  = fistCurl(1.0, 0.10);
                pose.thumb  = { cmcX: 0.00, cmcY: 0.00, cmcZ: 0.90, mcpX: 0.02, mcpZ: 0.18, ipX: 0.00 };

            } else if (name === 'ALPHABET I') {
                pose.index  = fistCurl(1.0, -0.04);
                pose.middle = fistCurl(1.0,  0.00);
                pose.ring   = fistCurl(1.0,  0.05);
                pose.pinky  = ext(-0.04);
                pose.thumb  = thumbFist;

            } else if (name === 'ALPHABET C') {
                pose.index  = { mcpX: 0.70, mcpY: 0, mcpZ:  0.02, pipX: 0.62, dipX: 0.40 };
                pose.middle = { mcpX: 0.70, mcpY: 0, mcpZ:  0.00, pipX: 0.62, dipX: 0.40 };
                pose.ring   = { mcpX: 0.70, mcpY: 0, mcpZ: -0.02, pipX: 0.62, dipX: 0.40 };
                pose.pinky  = { mcpX: 0.70, mcpY: 0, mcpZ: -0.04, pipX: 0.62, dipX: 0.40 };
                pose.thumb  = { cmcX: 0.40, cmcY: -0.06, cmcZ: 0.32, mcpX: 0.36, mcpZ: 0.06, ipX: 0.26 };

            } else if (name.includes('YES') || name.includes('FIST') || name === 'ALPHABET S' || name === 'ALPHABET A') {
                pose.index  = fistCurl(1.05, -0.04);
                pose.middle = fistCurl(1.05,  0.00);
                pose.ring   = fistCurl(1.05,  0.05);
                pose.pinky  = fistCurl(1.05,  0.10);
                pose.thumb  = thumbFist;

            } else if (name.includes('NO')) {
                pose.index  = { mcpX: 0.82, mcpY: 0, mcpZ: -0.04, pipX: 0.74, dipX: 0.36 };
                pose.middle = { mcpX: 0.82, mcpY: 0, mcpZ:  0.04, pipX: 0.74, dipX: 0.36 };
                pose.ring   = fistCurl(1.0, 0.05);
                pose.pinky  = fistCurl(1.0, 0.10);
                pose.thumb  = { cmcX: 0.42, cmcY: -0.16, cmcZ: -0.12, mcpX: 0.38, mcpZ: -0.06, ipX: 0.24 };

            } else if (name.includes('STOP') || name.includes('DANGER') || name.includes('EMERGENCY')) {
                pose.index  = ext(0.08);
                pose.middle = ext(0.02);
                pose.ring   = ext(-0.06);
                pose.pinky  = ext(-0.14);
                pose.thumb  = { cmcX: 0.12, cmcY: -0.06, cmcZ: 0.60, mcpX: 0.06, mcpZ: 0.08, ipX: 0.02 };

            } else if (name.includes('CALL')) {
                pose.index  = fistCurl(1.0, -0.04);
                pose.middle = fistCurl(1.0,  0.00);
                pose.ring   = fistCurl(1.0,  0.05);
                pose.pinky  = ext(-0.20);
                pose.thumb  = { cmcX: 0.06, cmcY: -0.08, cmcZ: 0.68, mcpX: 0.04, mcpZ: 0.12, ipX: 0.02 };

            } else if (name.includes('FOUR')) {
                pose.index  = ext(0.10);
                pose.middle = ext(0.02);
                pose.ring   = ext(-0.06);
                pose.pinky  = ext(-0.14);
                pose.thumb  = thumbHold;

            } else {
                pose.index  = ext(0.04);
                pose.middle = ext(0.01);
                pose.ring   = ext(-0.03);
                pose.pinky  = ext(-0.07);
                pose.thumb  = thumbOpen;
            }

            return pose;
        }

        /* ══════════════════════════════════════════════════════════════════════
           PUBLIC API
           ══════════════════════════════════════════════════════════════════════ */
        displaySign(item, speedClass = '') {
            if (!item) return;
            this.activeSignData = item;
            this.playbackSpeed  = speedClass === 'slow-motion' ? 0.5 : 1.0;
            this.targetJoints   = this.getSignJointTargets(item.name);

            const n = (item.name || '').toUpperCase();
            this.setCameraView(
                (n.includes('YES') || n.includes('FIST') || n === 'ALPHABET S') ? 'back' : 'front'
            );
        }

        setCameraView(viewMode) {
            if (!this.camera) return;
            if      (viewMode === 'front') this.cameraTargetPos = new THREE.Vector3( 0,  0.44,  3.4);
            else if (viewMode === 'back')  this.cameraTargetPos = new THREE.Vector3( 0,  0.44, -3.4);
            else if (viewMode === 'iso' || viewMode === 'angle')
                                           this.cameraTargetPos = new THREE.Vector3(-1.8, 0.95, 2.7);
            if (this.controls) this.controls.target.set(0, 0.38, 0);
        }

        resetRotation() { this.setCameraView('front'); }

        /* ══════════════════════════════════════════════════════════════════════
           ANIMATION LOOP
           ══════════════════════════════════════════════════════════════════════ */
        animate() {
            this.animationId = requestAnimationFrame(() => this.animate());

            const delta = this.clock ? this.clock.getDelta() : 0.016;
            this.time  += delta * this.playbackSpeed;
            const t     = this.time * 2.8;

            if (this.cameraTargetPos) {
                this.camera.position.lerp(this.cameraTargetPos, 0.08);
                if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.02)
                    this.cameraTargetPos = null;
            }
            if (this.controls) this.controls.update();

            const K = 0.16, D = 0.70;

            // 4 Fingers
            ['index', 'middle', 'ring', 'pinky'].forEach(fn => {
                const cur = this.jointState[fn];
                const tgt = this.targetJoints[fn];
                const v   = this.vel[fn];
                if (!cur || !tgt) return;

                ['mcpX', 'pipX', 'dipX', 'mcpY', 'mcpZ'].forEach(key => {
                    if (tgt[key] === undefined) return;
                    const s = this._spring(cur[key] || 0, tgt[key], v[key] || 0, K, D);
                    cur[key] = s.val;
                    v[key]   = s.vel;
                });

                const f = this.fingers[fn];
                if (f) {
                    f.mcp.rotation.x = cur.mcpX || 0;
                    f.mcp.rotation.y = cur.mcpY || 0;
                    f.mcp.rotation.z = cur.mcpZ || 0;
                    f.pip.rotation.x = cur.pipX || 0;
                    f.dip.rotation.x = cur.dipX || 0;
                }
            });

            // Opposable Thumb
            if (this.jointState.thumb && this.targetJoints.thumb && this.vel.thumb) {
                const cur = this.jointState.thumb;
                const tgt = this.targetJoints.thumb;
                const v   = this.vel.thumb;

                ['cmcX', 'cmcY', 'cmcZ', 'mcpX', 'mcpZ', 'ipX'].forEach(key => {
                    if (tgt[key] === undefined) return;
                    const s = this._spring(cur[key] || 0, tgt[key], v[key] || 0, K, D);
                    cur[key] = s.val;
                    v[key]   = s.vel;
                });

                const th = this.fingers.thumb;
                if (th) {
                    th.cmc.rotation.set(cur.cmcX || 0, cur.cmcY || 0, cur.cmcZ || 0);
                    th.mcp.rotation.set(cur.mcpX || 0, 0, cur.mcpZ || 0);
                    th.ip.rotation.x = cur.ipX || 0;
                }
            }

            if (this.wristJoint && this.handRoot) {
                const name = this.activeSignData ? (this.activeSignData.name || '').toUpperCase() : '';
                this._applySignMotion(name, t);
            }

            if (this.renderer && this.scene && this.camera)
                this.renderer.render(this.scene, this.camera);
        }

        _applySignMotion(name, t) {
            let rootX = 0, rootY = -0.42, rootZ = 0;
            let wRX = 0, wRY = 0, wRZ = 0;

            if (name.includes('HELLO') || name.includes('HI')) {
                wRZ   = Math.sin(t * 1.28) * 0.28;
                wRY   = Math.cos(t * 1.28) * 0.09;
                rootY += Math.abs(Math.sin(t * 1.28)) * 0.04;

            } else if (name.includes('THANK')) {
                const c = (Math.sin(t * 0.75) + 1) * 0.5;
                rootY = -0.26 - c * 0.24;
                rootZ =  c * 0.36;
                wRX   = -0.08 + c * 0.28;

            } else if (name.includes('HELP')) {
                const lift = (Math.sin(t * 1.15) + 1) * 0.5;
                rootY = -0.55 + lift * 0.32;
                rootZ = (Math.sin(t * 1.15 + 0.6) + 1) * 0.08;

            } else if (name.includes('THUMBS')) {
                const b = Math.sin(t * 1.50);
                rootY  += b > 0 ? b * 0.12 : 0;
                wRX     = b > 0 ? -0.06 : 0;

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
                wRX = th * -0.10;

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

            const tr = 0.0030;
            rootX += Math.sin(t * 9.7)  * tr + Math.sin(t * 17.3) * tr * 0.5;
            rootY += Math.cos(t * 7.3)  * tr + Math.cos(t * 13.1) * tr * 0.4;
            rootZ += Math.sin(t * 11.5) * tr * 0.6;

            this.handRoot.position.set(rootX, rootY, rootZ);
            this.wristJoint.rotation.set(wRX, wRY, wRZ);
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
            if (this.renderer?.domElement?.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
            this.isInitialized = false;
        }
    }

    window.Hand3D = new Hand3DController();

})(window);
