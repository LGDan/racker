"use client";

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { FloorLayer, FloorRack, FloorRoom, FloorSocket } from "./FloorPlan";
import { useTheme } from "@/components/layout/ThemeToggle";
import { floorTilePaint } from "./tile-theme";

const TILE = 0.6;
const U_METERS = 0.04445;

function applianceColors(deviceType: string) {
  switch (deviceType) {
    case "SWITCH":
      return { body: "#0c4a6e", face: "#38bdf8" };
    case "ROUTER":
      return { body: "#312e81", face: "#a5b4fc" };
    case "FIREWALL":
      return { body: "#881337", face: "#fb7185" };
    case "STORAGE":
      return { body: "#581c87", face: "#d8b4fe" };
    case "PATCH_PANEL":
      return { body: "#334155", face: "#e2e8f0" };
    case "UPS_RACK":
      return { body: "#78350f", face: "#fbbf24" };
    default:
      return { body: "#1e293b", face: "#94a3b8" };
  }
}

function ObstructionMarker({ opacity }: { opacity: number }) {
  const height = 2.2;
  const faded = opacity < 1;
  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[0.42, height, 0.42]} />
      <meshStandardMaterial
        color="#e11d48"
        roughness={0.55}
        metalness={0.08}
        transparent={faded}
        opacity={opacity}
      />
    </mesh>
  );
}

function RackCabinet({
  rack,
  color,
  opacity,
}: {
  rack: FloorRack;
  color: string;
  opacity: number;
}) {
  const height = Math.max(U_METERS, rack.totalU * U_METERS);
  const width = 0.48;
  const depth = 0.5;
  const post = 0.02;
  const faded = opacity < 1;
  const frame = {
    color,
    metalness: 0.5,
    roughness: 0.38,
    transparent: faded,
    opacity,
  };
  const posts: [number, number][] = [
    [-width / 2 + post / 2, depth / 2 - post / 2],
    [width / 2 - post / 2, depth / 2 - post / 2],
    [-width / 2 + post / 2, -depth / 2 + post / 2],
    [width / 2 - post / 2, -depth / 2 + post / 2],
  ];

  return (
    <group>
      {posts.map(([x, z], index) => (
        <mesh key={index} position={[x, height / 2, z]}>
          <boxGeometry args={[post, height, post]} />
          <meshStandardMaterial {...frame} />
        </mesh>
      ))}
      <mesh position={[0, 0.01, 0]}>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      <mesh position={[0, height - 0.01, 0]}>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial {...frame} />
      </mesh>
      <mesh position={[0, height / 2, -depth / 2 + 0.008]}>
        <boxGeometry args={[width - post, height - 0.05, 0.012]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.8}
          transparent={faded}
          opacity={opacity}
        />
      </mesh>
      {(rack.devices || []).map((device) => {
        if (device.startU < 1 || device.uHeight < 1) return null;
        const units = Math.min(
          device.uHeight,
          rack.totalU - device.startU + 1
        );
        if (units < 1) return null;
        const bodyH = Math.max(0.012, units * U_METERS - 0.004);
        const y = (device.startU - 1) * U_METERS + bodyH / 2 + 0.014;
        const colors = applianceColors(device.deviceType);
        const bodyW = width - post * 2 - 0.016;
        const bodyD = depth * 0.62;
        return (
          <group key={device.id} position={[0, y, 0.04]}>
            <mesh>
              <boxGeometry args={[bodyW, bodyH, bodyD]} />
              <meshStandardMaterial
                color={colors.body}
                metalness={0.25}
                roughness={0.5}
                transparent={faded}
                opacity={opacity}
              />
            </mesh>
            <mesh position={[0, 0, bodyD / 2 + 0.003]}>
              <boxGeometry args={[bodyW * 0.96, bodyH * 0.82, 0.006]} />
              <meshStandardMaterial
                color={colors.face}
                emissive={colors.face}
                emissiveIntensity={0.18}
                roughness={0.4}
                transparent={faded}
                opacity={opacity}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function opacityFor(active: boolean) {
  return active ? 1 : 0.18;
}

export function FloorPlan3D({
  room,
  sockets,
  rackColors,
  activeLayer,
}: {
  room: FloorRoom;
  sockets: FloorSocket[];
  rackColors: Record<string, string>;
  activeLayer: FloorLayer;
}) {
  const cols = room.gridCols;
  const rows = room.gridRows;
  const grills = useMemo(() => {
    const set = new Set<string>();
    for (const tile of room.floorTiles || []) {
      if (tile.surface === "GRILL") set.add(`${tile.posX},${tile.posY}`);
    }
    return set;
  }, [room.floorTiles]);

  const racks = room.rows.flatMap((row) => row.racks);
  const rackAt = useMemo(() => {
    const map = new Map<string, (typeof racks)[number]>();
    for (const rack of racks) map.set(`${rack.posX},${rack.posY}`, rack);
    return map;
  }, [racks]);

  function center(posX: number, posY: number): [number, number] {
    return [
      (posX - 0.5 - cols / 2) * TILE,
      (posY - 0.5 - rows / 2) * TILE,
    ];
  }

  const floorActive = activeLayer === "FLOOR";
  const rackActive = activeLayer === "RACK";
  const tiles = floorTilePaint(useTheme());

  return (
    <div className="h-[560px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      <Canvas
        camera={{ position: [cols * 0.22, 1.7, rows * 0.42], fov: 42 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
      >
        <color attach="background" args={[tiles.scene]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 6]} intensity={1.15} />
        <directionalLight position={[0, 2, 5]} intensity={0.45} />
        <OrbitControls makeDefault target={[0, 0.9, 0]} maxPolarAngle={Math.PI / 2.05} />

        {Array.from({ length: rows }, (_, rowIndex) =>
          Array.from({ length: cols }, (_, colIndex) => {
            const posX = colIndex + 1;
            const posY = rowIndex + 1;
            const [x, z] = center(posX, posY);
            const grill = grills.has(`${posX},${posY}`);
            const fade = opacityFor(floorActive);
            if (grill) {
              return (
                <group key={`floor-${posX}-${posY}`} position={[x, 0, z]}>
                  <mesh position={[0, -0.02, 0]}>
                    <boxGeometry args={[0.58, 0.02, 0.58]} />
                    <meshStandardMaterial
                      color={tiles.grillPlate}
                      transparent
                      opacity={fade}
                      roughness={0.9}
                    />
                  </mesh>
                  {Array.from({ length: 5 }, (_, bar) => (
                    <mesh
                      key={bar}
                      position={[-0.2 + bar * 0.1, 0.01, 0]}
                    >
                      <boxGeometry args={[0.035, 0.02, 0.5]} />
                      <meshStandardMaterial
                        color={tiles.grillBar}
                        transparent
                        opacity={fade}
                        roughness={0.45}
                      />
                    </mesh>
                  ))}
                </group>
              );
            }
            return (
              <mesh key={`floor-${posX}-${posY}`} position={[x, -0.02, z]}>
                <boxGeometry args={[0.58, 0.04, 0.58]} />
                <meshStandardMaterial
                  color={tiles.slab}
                  transparent
                  opacity={fade}
                  roughness={0.85}
                />
              </mesh>
            );
          })
        )}

        {racks.map((rack) => {
          const [x, z] = center(rack.posX, rack.posY);
          return (
            <group key={rack.id} position={[x, 0, z]}>
              <RackCabinet
                rack={rack}
                color={rackColors[rack.id] || "#22d3ee"}
                opacity={opacityFor(rackActive)}
              />
            </group>
          );
        })}

        {(room.obstructions || []).map((block) => {
          if (block.posX < 1 || block.posY < 1) return null;
          const [x, z] = center(block.posX, block.posY);
          return (
            <group key={block.id} position={[x, 0, z]}>
              <ObstructionMarker opacity={opacityFor(rackActive)} />
            </group>
          );
        })}

        {room.coolingUnits.map((unit) => {
          if (unit.posX < 1 || unit.posY < 1) return null;
          const [x, z] = center(unit.posX, unit.posY);
          return (
            <mesh key={unit.id} position={[x, 0.55, z]}>
              <boxGeometry args={[0.52, 1.1, 0.52]} />
              <meshStandardMaterial
                color="#38bdf8"
                transparent
                opacity={opacityFor(rackActive)}
                roughness={0.35}
              />
            </mesh>
          );
        })}

        {sockets.map((socket) => {
          const [x, z] = center(socket.posX, socket.posY);
          const overhead = socket.elevation === "OVERHEAD";
          const rack = rackAt.get(`${socket.posX},${socket.posY}`);
          const y = overhead
            ? rack
              ? Math.max(0.4, rack.totalU * 0.04445) + 0.18
              : 2.4
            : -0.16;
          const active = overhead
            ? activeLayer === "OVERHEAD"
            : activeLayer === "UNDERFLOOR";
          return (
            <mesh key={socket.id} position={[x, y, z]}>
              <boxGeometry args={[0.18, 0.08, 0.18]} />
              <meshStandardMaterial
                color={overhead ? "#c084fc" : "#fbbf24"}
                transparent
                opacity={opacityFor(active)}
                emissive={overhead ? "#6b21a8" : "#92400e"}
                emissiveIntensity={active ? 0.35 : 0.05}
              />
            </mesh>
          );
        })}
      </Canvas>
    </div>
  );
}
