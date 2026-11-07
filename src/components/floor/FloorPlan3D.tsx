"use client";

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { FloorLayer, FloorRoom, FloorSocket } from "./FloorPlan";

const TILE = 0.6;

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

  return (
    <div className="h-[560px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      <Canvas
        camera={{ position: [cols * 0.35, 6.5, rows * 0.55], fov: 42 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}
      >
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 10, 4]} intensity={1.1} />
        <OrbitControls makeDefault target={[0, 0.6, 0]} maxPolarAngle={Math.PI / 2.05} />

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
                      color="#0f172a"
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
                        color="#22d3ee"
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
                  color="#1e293b"
                  transparent
                  opacity={fade}
                  roughness={0.85}
                />
              </mesh>
            );
          })
        )}

        {racks.map((rack) => {
          const height = Math.max(0.4, rack.totalU * 0.04445);
          const [x, z] = center(rack.posX, rack.posY);
          return (
            <mesh key={rack.id} position={[x, height / 2, z]}>
              <boxGeometry args={[0.5, height, 0.5]} />
              <meshStandardMaterial
                color={rackColors[rack.id] || "#22d3ee"}
                transparent
                opacity={opacityFor(rackActive)}
                roughness={0.4}
                metalness={0.2}
              />
            </mesh>
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
