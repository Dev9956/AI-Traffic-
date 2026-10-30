"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useTrafficStore } from "@/store/trafficStore";
import { Maximize2, RotateCcw, Sun, CloudRain, Moon, ShieldAlert, Navigation } from "lucide-react";

interface ThreeCityViewerProps {
  weather?: "clear" | "rain" | "fog" | "night";
}

export default function ThreeCityViewer({ weather = "clear" }: ThreeCityViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intersections = useTrafficStore((s) => s.intersections);
  const vehicles = useTrafficStore((s) => s.vehicles);
  const activeEvRoutes = useTrafficStore((s) => s.activeEvRoutes);
  const selectedIntersection = useTrafficStore((s) => s.selectedIntersection);
  const selectIntersection = useTrafficStore((s) => s.selectIntersection);

  const [activeWeather, setActiveWeather] = useState<"clear" | "rain" | "night">("clear");
  const [cameraMode, setCameraMode] = useState<"drone" | "street" | "orbit">("drone");
  const [stats, setStats] = useState({ fps: 60, buildings: 120, vehicles: 0, signals: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(activeWeather === "night" ? 0x05070d : 0x0f172a);
    scene.fog = new THREE.FogExp2(
      activeWeather === "night" ? 0x05070d : 0x0f172a,
      activeWeather === "rain" ? 0.0035 : 0.0018
    );

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      2500
    );
    camera.position.set(250, 300, 350);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = activeWeather === "night" ? 0.8 : 1.2;
    container.appendChild(renderer.domElement);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(
      activeWeather === "night" ? 0x1e293b : 0xe2e8f0,
      activeWeather === "night" ? 0.5 : 1.4
    );
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(
      activeWeather === "night" ? 0x38bdf8 : 0xffffff,
      activeWeather === "night" ? 0.4 : 1.8
    );
    sunLight.position.set(400, 600, 300);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1500;
    const d = 500;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // GROUND & ROAD NETWORK
    const groundGeo = new THREE.PlaneGeometry(1600, 1600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: activeWeather === "night" ? 0x0a0f1d : 0x0f172a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // GRID HELPERS & ASPHALT ROADS
    const roadGroup = new THREE.Group();
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
    });
    const roadMarkMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });

    // Build 6x6 arterial road grid
    const GRID_SPACING = 140;
    const GRID_COUNT = 5; // -2 to +2
    for (let i = -GRID_COUNT; i <= GRID_COUNT; i++) {
      // Horizontal road
      const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(1400, 24), roadMat);
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.2, i * GRID_SPACING);
      hRoad.receiveShadow = true;
      roadGroup.add(hRoad);

      // Vertical road
      const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(24, 1400), roadMat);
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(i * GRID_SPACING, 0.2, 0);
      vRoad.receiveShadow = true;
      roadGroup.add(vRoad);

      // Dash lines
      const dashGeo = new THREE.PlaneGeometry(1400, 1.2);
      const hDash = new THREE.Mesh(dashGeo, roadMarkMat);
      hDash.rotation.x = -Math.PI / 2;
      hDash.position.set(0, 0.3, i * GRID_SPACING);
      roadGroup.add(hDash);

      const vDash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1400), roadMat);
      vDash.rotation.x = -Math.PI / 2;
      vDash.position.set(i * GRID_SPACING, 0.3, 0);
      roadGroup.add(vDash);
    }
    scene.add(roadGroup);

    // PROCEDURAL 3D CITY BUILDINGS (Skyscrapers & Glass Towers)
    const buildingGroup = new THREE.Group();
    const buildingColors = [0x1e3a8a, 0x0f766e, 0x334155, 0x1e293b, 0x475569, 0x2563eb];
    const windowColors = [0x38bdf8, 0xfacc15, 0x67e8f9];

    let bCount = 0;
    for (let x = -GRID_COUNT; x < GRID_COUNT; x++) {
      for (let z = -GRID_COUNT; z < GRID_COUNT; z++) {
        // Place 2 to 4 buildings per block
        const blockCenterX = x * GRID_SPACING + GRID_SPACING / 2;
        const blockCenterZ = z * GRID_SPACING + GRID_SPACING / 2;

        const subBlocks = [
          { dx: -35, dz: -35 },
          { dx: 35, dz: -35 },
          { dx: -35, dz: 35 },
          { dx: 35, dz: 35 },
        ];

        subBlocks.forEach((sb, sIdx) => {
          const height = 40 + Math.random() * 180 + ((x === 0 && z === 0) ? 120 : 0);
          const width = 36 + Math.random() * 18;
          const depth = 36 + Math.random() * 18;

          const bGeo = new THREE.BoxGeometry(width, height, depth);
          const bMat = new THREE.MeshStandardMaterial({
            color: buildingColors[(x + z + sIdx + 10) % buildingColors.length],
            roughness: 0.3,
            metalness: 0.6,
          });

          const building = new THREE.Mesh(bGeo, bMat);
          building.position.set(blockCenterX + sb.dx, height / 2, blockCenterZ + sb.dz);
          building.castShadow = true;
          building.receiveShadow = true;
          buildingGroup.add(building);

          // Roof helipad or antenna on tall towers
          if (height > 140) {
            const beaconGeo = new THREE.SphereGeometry(1.5, 8, 8);
            const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(blockCenterX + sb.dx, height + 3, blockCenterZ + sb.dz);
            buildingGroup.add(beacon);
          }
          bCount++;
        });
      }
    }
    scene.add(buildingGroup);

    // 3D PHYSICAL TRAFFIC SIGNAL POLES (With Dynamic Lights)
    const signalPolesGroup = new THREE.Group();
    const signalMeshes: { [key: string]: { red: THREE.Mesh; green: THREE.Mesh; light: THREE.PointLight } } = {};

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

    // Generate signals at intersections
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const jx = x * GRID_SPACING;
        const jz = z * GRID_SPACING;
        const jId = `J_${x}_${z}`;

        // 4 poles per junction
        const offsets = [
          { ox: 16, oz: 16, rot: 0 },
          { ox: -16, oz: 16, rot: Math.PI / 2 },
          { ox: -16, oz: -16, rot: Math.PI },
          { ox: 16, oz: -16, rot: -Math.PI / 2 },
        ];

        offsets.forEach((off, idx) => {
          const poleGroup = new THREE.Group();
          poleGroup.position.set(jx + off.ox, 0, jz + off.oz);
          poleGroup.rotation.y = off.rot;

          // Vertical Mast (Height: 18m)
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 18, 12), poleMat);
          mast.position.y = 9;
          poleGroup.add(mast);

          // Horizontal Arm (Length: 12m)
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 12, 12), poleMat);
          arm.rotation.z = Math.PI / 2;
          arm.position.set(-6, 17, 0);
          poleGroup.add(arm);

          // Signal Housing Box
          const box = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), housingMat);
          box.position.set(-8, 15, 0);
          poleGroup.add(box);

          // Red Light
          const redGeo = new THREE.SphereGeometry(0.8, 16, 16);
          const redMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
          const redSphere = new THREE.Mesh(redGeo, redMat);
          redSphere.position.set(-8, 16.5, 1.1);
          poleGroup.add(redSphere);

          // Green Light
          const grnGeo = new THREE.SphereGeometry(0.8, 16, 16);
          const grnMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
          const grnSphere = new THREE.Mesh(grnGeo, grnMat);
          grnSphere.position.set(-8, 13.5, 1.1);
          poleGroup.add(grnSphere);

          // Dynamic PointLight for real-world ground illumination
          const dynamicLight = new THREE.PointLight(0xef4444, 1.2, 35);
          dynamicLight.position.set(-8, 15, 3);
          poleGroup.add(dynamicLight);

          signalPolesGroup.add(poleGroup);

          if (idx === 0) {
            signalMeshes[jId] = { red: redSphere, green: grnSphere, light: dynamicLight };
          }
        });
      }
    }
    scene.add(signalPolesGroup);

    // 3D VEHICLES (Cars, Ambulances, Delivery Vans)
    const vehicleGroup = new THREE.Group();
    const dynamicVehicles: Array<{
      mesh: THREE.Group;
      type: "car" | "ambulance" | "truck";
      speed: number;
      lane: number;
      dir: "h" | "v";
      pos: number;
      siren?: THREE.PointLight;
    }> = [];

    const carGeo = new THREE.BoxGeometry(4.5, 2, 9);
    const carMat1 = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.8 });
    const carMat2 = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.2, metalness: 0.8 });
    const carMat3 = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.1, metalness: 0.9 });
    const ambuMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 });

    // Spawn 80 dynamic vehicles across city
    for (let v = 0; v < 80; v++) {
      const vMesh = new THREE.Group();
      const isEmergency = v === 0 || v === 1; // 2 emergency ambulances
      const isTruck = v > 70;

      const bodyGeo = isTruck
        ? new THREE.BoxGeometry(5.5, 4.5, 14)
        : new THREE.BoxGeometry(4.2, 2.2, 9);
      const bodyMat = isEmergency ? ambuMat : isTruck ? carMat2 : v % 2 === 0 ? carMat1 : carMat3;

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = isTruck ? 2.5 : 1.3;
      body.castShadow = true;
      vMesh.add(body);

      // Cabin/Roof
      const cabinGeo = new THREE.BoxGeometry(3.8, 1.6, 5);
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, isTruck ? 4.5 : 2.6, -0.5);
      vMesh.add(cabin);

      // Headlights (Front illumination)
      const hlLeft = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      hlLeft.position.set(-1.5, 1.2, 4.6);
      vMesh.add(hlLeft);

      const hlRight = hlLeft.clone();
      hlRight.position.x = 1.5;
      vMesh.add(hlRight);

      // Taillights
      const tlLeft = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      tlLeft.position.set(-1.5, 1.2, -4.6);
      vMesh.add(tlLeft);

      const tlRight = tlLeft.clone();
      tlRight.position.x = 1.5;
      vMesh.add(tlRight);

      // Siren for ambulance
      let sirenLight: THREE.PointLight | undefined;
      if (isEmergency) {
        sirenLight = new THREE.PointLight(0xef4444, 2, 40);
        sirenLight.position.set(0, 4, 0);
        vMesh.add(sirenLight);

        // Emergency Green Corridor indicator
        const auraGeo = new THREE.RingGeometry(6, 7.5, 24);
        const auraMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
        const aura = new THREE.Mesh(auraGeo, auraMat);
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.5;
        vMesh.add(aura);
      }

      const dir = v % 2 === 0 ? "h" : "v";
      const lane = ((v % 5) - 2) * GRID_SPACING;
      const initialPos = (Math.random() - 0.5) * 1200;

      vMesh.position.set(
        dir === "h" ? initialPos : lane + (v % 4 === 0 ? 5 : -5),
        0,
        dir === "h" ? lane + (v % 4 === 0 ? 5 : -5) : initialPos
      );

      if (dir === "h") {
        vMesh.rotation.y = Math.PI / 2;
      }

      vehicleGroup.add(vMesh);
      dynamicVehicles.push({
        mesh: vMesh,
        type: isEmergency ? "ambulance" : isTruck ? "truck" : "car",
        speed: isEmergency ? 1.8 : 0.6 + Math.random() * 0.6,
        lane,
        dir,
        pos: initialPos,
        siren: sirenLight,
      });
    }
    scene.add(vehicleGroup);

    // RAIN PARTICLES
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 4000;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let r = 0; r < rainCount * 3; r += 3) {
      rainPositions[r] = (Math.random() - 0.5) * 1200;
      rainPositions[r + 1] = Math.random() * 500;
      rainPositions[r + 2] = (Math.random() - 0.5) * 1200;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 1.2,
      transparent: true,
      opacity: activeWeather === "rain" ? 0.7 : 0,
    });
    const rainSystem = new THREE.Points(rainGeo, rainMat);
    scene.add(rainSystem);

    // INTERACTION CONTROLS (Smooth Orbit & Panning)
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let spherical = { radius: 520, theta: Math.PI / 4, phi: Math.PI / 3.2 };

    const updateCamera = () => {
      camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = spherical.radius * Math.cos(spherical.phi);
      camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 15, 0);
    };
    updateCamera();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;

      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.15, Math.min(Math.PI / 2.05, spherical.phi - dy * 0.005));

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      updateCamera();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      spherical.radius = Math.max(120, Math.min(1400, spherical.radius + e.deltaY * 0.8));
      updateCamera();
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    // ANIMATION & REAL-TIME SIMULATION LOOP
    let animId: number;
    let clock = new THREE.Clock();
    let tickCount = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      tickCount++;

      // 1. Move vehicles
      dynamicVehicles.forEach((v) => {
        v.pos += v.speed * (v.dir === "h" ? 60 : -60) * delta;
        if (v.pos > 700) v.pos = -700;
        if (v.pos < -700) v.pos = 700;

        if (v.dir === "h") {
          v.mesh.position.x = v.pos;
        } else {
          v.mesh.position.z = v.pos;
        }

        // Flashing siren on ambulance
        if (v.siren) {
          const flash = Math.sin(elapsed * 12) > 0;
          v.siren.color.setHex(flash ? 0xef4444 : 0x3b82f6);
        }
      });

      // 2. Animate Traffic Signals (Cycle state every 6s)
      const signalState = Math.floor(elapsed / 6) % 2 === 0;
      Object.entries(signalMeshes).forEach(([id, sm], sIdx) => {
        const isGreen = sIdx % 2 === 0 ? signalState : !signalState;
        (sm.red.material as THREE.MeshBasicMaterial).color.setHex(isGreen ? 0x331010 : 0xef4444);
        (sm.green.material as THREE.MeshBasicMaterial).color.setHex(isGreen ? 0x22c55e : 0x052e16);
        sm.light.color.setHex(isGreen ? 0x22c55e : 0xef4444);
      });

      // 3. Animate Rain
      if (activeWeather === "rain") {
        const pos = rainGeo.attributes.position.array as Float32Array;
        for (let i = 1; i < rainCount * 3; i += 3) {
          pos[i] -= 320 * delta;
          if (pos[i] < 0) pos[i] = 450;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      // 4. Update Stats
      if (tickCount % 60 === 0) {
        setStats({
          fps: Math.round(1 / Math.max(delta, 0.016)),
          buildings: bCount,
          vehicles: dynamicVehicles.length,
          signals: Object.keys(signalMeshes).length * 4,
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // RESIZE LISTENER
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [activeWeather]);

  return (
    <div className="relative w-full h-full min-h-[580px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* 3D WebGL Canvas Mount */}
      <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top Floating HUD: Controls & Modes */}
      <div className="relative z-10 flex flex-wrap items-center justify-between p-3.5 bg-gradient-to-b from-slate-950/90 via-slate-900/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            3D DIGITAL TWIN: ACTIVE
          </div>

          <div className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 font-mono text-[11px]">
            ⚡ {stats.fps} FPS | {stats.buildings} TOWERS | {stats.vehicles} VEHICLES
          </div>
        </div>

        {/* Action Buttons: Weather & View Modes */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={() => setActiveWeather("clear")}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeWeather === "clear"
                ? "bg-sky-500/20 border-sky-500 text-sky-400 shadow-lg shadow-sky-500/20"
                : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Clear Sky"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Day</span>
          </button>

          <button
            onClick={() => setActiveWeather("night")}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeWeather === "night"
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/20"
                : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Night Vision"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Night</span>
          </button>

          <button
            onClick={() => setActiveWeather("rain")}
            className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              activeWeather === "rain"
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/20"
                : "bg-slate-900/80 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Rain Simulation"
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rain</span>
          </button>
        </div>
      </div>

      {/* Bottom Floating Telemetry Overlay */}
      <div className="mt-auto relative z-10 flex flex-wrap items-end justify-between p-3.5 bg-gradient-to-t from-slate-950/95 via-slate-900/60 to-transparent pointer-events-none">
        <div className="flex flex-col gap-1 pointer-events-auto">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            NTCIP 1202 Signal Actuation: 36 Physical Poles Synced
          </div>
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Emergency Green Corridor: 2 Ambulances with Active Preemption
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-500 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80 pointer-events-auto">
          Mouse Drag: 360° Rotate | Scroll: Zoom In/Out | Right Click: Pan
        </div>
      </div>
    </div>
  );
}
