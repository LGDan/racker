import { prisma } from "./db";

export interface PhaseLoad {
  wattsL1: number;
  wattsL2: number;
  wattsL3: number;
  ampsL1: number;
  ampsL2: number;
  ampsL3: number;
  totalWatts: number;
  imbalancePct: number;
}

export interface PduCapacitySummary {
  id: string;
  name: string;
  rackId: string;
  rackCode: string;
  feedSide: string;
  mounting: string;
  phaseMode: string;
  circuitId: string | null;
  floorSocketLabel: string | null;
  voltageV: number;
  maxAmps: number;
  maxWatts: number;
  loadWatts: number;
  loadAmps: number;
  loadPct: number;
  totalOutlets: number;
  usedOutlets: number;
  freeOutlets: number;
  c13Total: number;
  c13Used: number;
  c19Total: number;
  c19Used: number;
  phaseLoad: PhaseLoad;
}

export interface RackCapacitySummary {
  id: string;
  name: string;
  code: string;
  rowId: string;
  rowName: string;
  roomId: string;
  roomName: string;
  siteCode: string;
  totalU: number;
  usedU: number;
  freeU: number;
  uUtilizationPct: number;
  largestContiguousFreeU: number;
  maxPowerWatts: number;
  currentPowerWatts: number;
  peakPowerWatts: number;
  powerUtilizationPct: number;
  maxWeightKg: number;
  currentWeightKg: number;
  deviceCount: number;
  spofDeviceCount: number;
  unpoweredDeviceCount: number;
  pduCount: number;
  totalOutlets: number;
  freeOutlets: number;
  feedAWatts: number;
  feedBWatts: number;
}

export interface PanelCapacitySummary {
  id: string;
  name: string;
  roomId: string;
  roomName: string;
  upstreamSourceId: string;
  upstreamSourceName: string;
  feedSide: string;
  voltageLToN: number;
  voltageLToL: number;
  maxAmpsPerPhase: number;
  totalBreakerSlots: number;
  usedBreakerSlots: number;
  phaseLoad: PhaseLoad;
  maxPhaseLoadPct: number;
}

export interface RoomCoolingSummary {
  roomId: string;
  roomName: string;
  roomCode: string;
  roomType: string;
  siteName: string;
  itLoadKw: number;
  itHeatBtuHr: number;
  coolingUnitLoadKw: number;
  configuredCoolingKw: number;
  onlineCoolingKw: number;
  standbyCoolingKw: number;
  redundancyMode: string;
  thermalUtilizationPct: number;
  nPlusOneCompliant: boolean;
  unitCount: number;
  onlineUnitCount: number;
}

export interface SystemCapacitySnapshot {
  totals: {
    siteCount: number;
    roomCount: number;
    rackCount: number;
    deviceCount: number;
    totalU: number;
    usedU: number;
    freeU: number;
    totalItWatts: number;
    totalItKw: number;
    totalPduOutlets: number;
    usedPduOutlets: number;
    freePduOutlets: number;
    totalOnlineCoolingKw: number;
    spofDevicesCount: number;
    overloadedCircuitsCount: number;
  };
  racks: RackCapacitySummary[];
  pdus: PduCapacitySummary[];
  panels: PanelCapacitySummary[];
  roomsCooling: RoomCoolingSummary[];
  powerSources: {
    id: string;
    name: string;
    sourceType: string;
    redundancyGroup: string;
    status: string;
    capacityKw: number;
    loadKw: number;
    loadPct: number;
    voltageV: number;
    maxAmps: number;
    loadAmps: number;
    upstreamSourceAId: string | null;
    upstreamSourceBId: string | null;
    batteryRuntimeMins: number | null;
    fuelRuntimeHours: number | null;
  }[];
  alerts: {
    severity: "CRITICAL" | "WARNING" | "INFO";
    category: "POWER" | "PHASE" | "COOLING" | "REDUNDANCY" | "SPACE";
    title: string;
    description: string;
    entityId?: string;
  }[];
}

function calcImbalance(w1: number, w2: number, w3: number): number {
  const avg = (w1 + w2 + w3) / 3;
  if (avg <= 1) return 0;
  const maxDev = Math.max(
    Math.abs(w1 - avg),
    Math.abs(w2 - avg),
    Math.abs(w3 - avg)
  );
  return Math.round((maxDev / avg) * 1000) / 10;
}

export async function getFullInfrastructureSnapshot() {
  const [
    sites,
    rooms,
    racks,
    powerSources,
    powerPanels,
    powerCircuits,
    pdus,
    devices,
    networkCables,
    templates,
  ] = await Promise.all([
    prisma.site.findMany({
      include: {
        buildings: {
          include: {
            floors: {
              orderBy: { levelNumber: "asc" },
              include: {
                rooms: {
                  include: {
                    coolingUnits: true,
                    floorTiles: true,
                    obstructions: true,
                    rows: {
                      orderBy: { createdAt: "asc" },
                      include: {
                        racks: {
                          orderBy: [{ posY: "asc" }, { posX: "asc" }],
                          include: {
                            devices: {
                              select: {
                                id: true,
                                name: true,
                                hostname: true,
                                deviceType: true,
                                startU: true,
                                uHeight: true,
                              },
                              orderBy: { startU: "asc" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({
      include: {
        floor: {
          include: {
            building: {
              include: { site: true },
            },
          },
        },
        coolingUnits: true,
        rows: {
          include: {
            racks: true,
          },
        },
      },
    }),
    prisma.rack.findMany({
      include: {
        row: {
          include: {
            room: {
              include: {
                floor: {
                  include: {
                    building: {
                      include: { site: true },
                    },
                  },
                },
              },
            },
          },
        },
        pdus: {
          include: {
            circuit: {
              include: {
                panel: true,
              },
            },
            outlets: {
              orderBy: { outletNumber: "asc" },
              include: {
                connectedPsu: {
                  include: {
                    device: true,
                  },
                },
              },
            },
          },
        },
        devices: {
          orderBy: { startU: "desc" },
          include: {
            psus: {
              include: {
                connectedOutlet: {
                  include: {
                    pdu: true,
                  },
                },
              },
            },
            networkPorts: {
              orderBy: { portNumber: "asc" },
              include: {
                cableAsPortA: {
                  include: {
                    portB: { include: { device: true } },
                  },
                },
                cableAsPortB: {
                  include: {
                    portA: { include: { device: true } },
                  },
                },
              },
            },
          },
        },
        floorSockets: {
          include: {
            panel: true,
            pdus: true,
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.powerSource.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.powerPanel.findMany({
      include: {
        room: true,
        upstreamSource: true,
        circuits: {
          include: {
            pdus: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.powerCircuit.findMany({
      include: {
        panel: true,
        room: true,
        rack: true,
        pdus: true,
      },
      orderBy: [{ panelId: "asc" }, { breakerNumber: "asc" }],
    }),
    prisma.rackPdu.findMany({
      include: {
        rack: true,
        circuit: {
          include: { panel: true },
        },
        outlets: {
          orderBy: { outletNumber: "asc" },
          include: {
            connectedPsu: {
              include: { device: true },
            },
          },
        },
      },
    }),
    prisma.rackDevice.findMany({
      include: {
        rack: true,
        psus: {
          include: {
            connectedOutlet: {
              include: { pdu: true },
            },
          },
        },
        networkPorts: true,
      },
    }),
    prisma.networkCable.findMany({
      include: {
        portA: { include: { device: { include: { rack: true } } } },
        portB: { include: { device: { include: { rack: true } } } },
      },
    }),
    prisma.deviceTemplate.findMany({
      orderBy: [{ deviceType: "asc" }, { manufacturer: "asc" }],
    }),
  ]);

  // 1. Compute per-PSU load (active PSUs on a device share its nominalWatts)
  const psuWattsMap = new Map<string, number>();
  for (const dev of devices) {
    const connectedPsus = dev.psus.filter((p) => p.connectedOutletId !== null);
    const activeCount = connectedPsus.length;
    if (activeCount > 0 && dev.status !== "OFFLINE") {
      const wattsPerActivePsu = dev.nominalWatts / activeCount;
      for (const psu of connectedPsus) {
        psuWattsMap.set(psu.id, wattsPerActivePsu);
      }
    }
  }

  // 2. Compute PDU summaries
  const pduSummariesMap = new Map<string, PduCapacitySummary>();
  for (const pdu of pdus) {
    let wattsL1 = 0;
    let wattsL2 = 0;
    let wattsL3 = 0;
    let c13Total = 0;
    let c13Used = 0;
    let c19Total = 0;
    let c19Used = 0;

    for (const outlet of pdu.outlets) {
      const isUsed = Boolean(outlet.connectedPsu);
      if (outlet.socketType === "C19") {
        c19Total++;
        if (isUsed) c19Used++;
      } else {
        c13Total++;
        if (isUsed) c13Used++;
      }

      if (outlet.connectedPsu) {
        const w = psuWattsMap.get(outlet.connectedPsu.id) ?? 0;
        const phase =
          pdu.phaseMode === "SINGLE_PHASE" && pdu.circuit
            ? pdu.circuit.phaseAllocation === "L2"
              ? "L2"
              : pdu.circuit.phaseAllocation === "L3"
              ? "L3"
              : "L1"
            : outlet.bankPhase;
        if (phase === "L2") wattsL2 += w;
        else if (phase === "L3") wattsL3 += w;
        else wattsL1 += w;
      }
    }

    const totalWatts = wattsL1 + wattsL2 + wattsL3;
    const vLN = 230;
    const ampsL1 = wattsL1 / vLN;
    const ampsL2 = wattsL2 / vLN;
    const ampsL3 = wattsL3 / vLN;
    const loadAmps =
      pdu.phaseMode === "THREE_PHASE"
        ? Math.max(ampsL1, ampsL2, ampsL3)
        : totalWatts / Math.max(1, pdu.voltageV);

    const usedOutlets = c13Used + c19Used;
    const totalOutlets = pdu.outlets.length;

    pduSummariesMap.set(pdu.id, {
      id: pdu.id,
      name: pdu.name,
      rackId: pdu.rackId,
      rackCode: pdu.rack.code,
      feedSide: pdu.feedSide,
      mounting: pdu.mounting,
      phaseMode: pdu.phaseMode,
      circuitId: pdu.circuitId,
      floorSocketLabel: pdu.circuit?.floorSocketLabel ?? null,
      voltageV: pdu.voltageV,
      maxAmps: pdu.maxAmps,
      maxWatts: pdu.maxWatts,
      loadWatts: Math.round(totalWatts),
      loadAmps: Math.round(loadAmps * 10) / 10,
      loadPct: Math.round((totalWatts / Math.max(1, pdu.maxWatts)) * 1000) / 10,
      totalOutlets,
      usedOutlets,
      freeOutlets: totalOutlets - usedOutlets,
      c13Total,
      c13Used,
      c19Total,
      c19Used,
      phaseLoad: {
        wattsL1: Math.round(wattsL1),
        wattsL2: Math.round(wattsL2),
        wattsL3: Math.round(wattsL3),
        ampsL1: Math.round(ampsL1 * 10) / 10,
        ampsL2: Math.round(ampsL2 * 10) / 10,
        ampsL3: Math.round(ampsL3 * 10) / 10,
        totalWatts: Math.round(totalWatts),
        imbalancePct:
          pdu.phaseMode === "THREE_PHASE"
            ? calcImbalance(wattsL1, wattsL2, wattsL3)
            : 0,
      },
    });
  }

  // 3. Compute Rack capacity summaries
  const rackSummaries: RackCapacitySummary[] = [];
  for (const rack of racks) {
    const occupiedSlots = new Array(rack.totalU + 1).fill(false);
    let usedU = 0;
    let currentPowerWatts = 0;
    let peakPowerWatts = 0;
    let currentWeightKg = 0;
    let spofDeviceCount = 0;
    let unpoweredDeviceCount = 0;

    for (const dev of rack.devices) {
      usedU += dev.uHeight;
      currentPowerWatts += dev.nominalWatts;
      peakPowerWatts += dev.peakWatts;
      currentWeightKg += dev.weightKg;

      for (let u = dev.startU; u < dev.startU + dev.uHeight && u <= rack.totalU; u++) {
        occupiedSlots[u] = true;
      }

      if (dev.psus.length > 0) {
        const connectedFeeds = new Set<string>();
        let connectedCount = 0;
        for (const psu of dev.psus) {
          if (psu.connectedOutlet?.pdu) {
            connectedCount++;
            connectedFeeds.add(psu.connectedOutlet.pdu.feedSide);
          }
        }
        if (connectedCount === 0) {
          unpoweredDeviceCount++;
          spofDeviceCount++;
        } else if (connectedFeeds.size < 2 || connectedCount < 2) {
          spofDeviceCount++;
        }
      }
    }

    let largestContiguousFreeU = 0;
    let currentRun = 0;
    for (let u = 1; u <= rack.totalU; u++) {
      if (!occupiedSlots[u]) {
        currentRun++;
        if (currentRun > largestContiguousFreeU) {
          largestContiguousFreeU = currentRun;
        }
      } else {
        currentRun = 0;
      }
    }

    let totalOutlets = 0;
    let freeOutlets = 0;
    let feedAWatts = 0;
    let feedBWatts = 0;
    for (const pdu of rack.pdus) {
      const pSum = pduSummariesMap.get(pdu.id);
      if (pSum) {
        totalOutlets += pSum.totalOutlets;
        freeOutlets += pSum.freeOutlets;
        if (pSum.feedSide === "A") feedAWatts += pSum.loadWatts;
        else feedBWatts += pSum.loadWatts;
      }
    }

    rackSummaries.push({
      id: rack.id,
      name: rack.name,
      code: rack.code,
      rowId: rack.rowId,
      rowName: rack.row.name,
      roomId: rack.row.roomId,
      roomName: rack.row.room.name,
      siteCode: rack.row.room.floor.building.site.code,
      totalU: rack.totalU,
      usedU,
      freeU: Math.max(0, rack.totalU - usedU),
      uUtilizationPct: Math.round((usedU / rack.totalU) * 1000) / 10,
      largestContiguousFreeU,
      maxPowerWatts: rack.maxPowerWatts,
      currentPowerWatts: Math.round(currentPowerWatts),
      peakPowerWatts: Math.round(peakPowerWatts),
      powerUtilizationPct:
        Math.round((currentPowerWatts / Math.max(1, rack.maxPowerWatts)) * 1000) /
        10,
      maxWeightKg: rack.maxWeightKg,
      currentWeightKg: Math.round(currentWeightKg * 10) / 10,
      deviceCount: rack.devices.length,
      spofDeviceCount,
      unpoweredDeviceCount,
      pduCount: rack.pdus.length,
      totalOutlets,
      freeOutlets,
      feedAWatts: Math.round(feedAWatts),
      feedBWatts: Math.round(feedBWatts),
    });
  }

  // 4. Compute Panel 3-Phase Load Summaries
  const panelSummaries: PanelCapacitySummary[] = [];
  const sourceLoadWattsMap = new Map<string, number>();

  for (const panel of powerPanels) {
    let wattsL1 = 0;
    let wattsL2 = 0;
    let wattsL3 = 0;

    for (const cir of panel.circuits) {
      for (const pdu of cir.pdus) {
        const pSum = pduSummariesMap.get(pdu.id);
        if (!pSum) continue;
        if (cir.phaseAllocation === "THREE_PHASE") {
          wattsL1 += pSum.phaseLoad.wattsL1;
          wattsL2 += pSum.phaseLoad.wattsL2;
          wattsL3 += pSum.phaseLoad.wattsL3;
        } else if (cir.phaseAllocation === "L2") {
          wattsL2 += pSum.loadWatts;
        } else if (cir.phaseAllocation === "L3") {
          wattsL3 += pSum.loadWatts;
        } else {
          wattsL1 += pSum.loadWatts;
        }
      }
    }

    const totalWatts = wattsL1 + wattsL2 + wattsL3;
    const vLN = panel.voltageLToN || 230;
    const ampsL1 = wattsL1 / vLN;
    const ampsL2 = wattsL2 / vLN;
    const ampsL3 = wattsL3 / vLN;
    const maxPhaseAmps = Math.max(ampsL1, ampsL2, ampsL3);

    panelSummaries.push({
      id: panel.id,
      name: panel.name,
      roomId: panel.roomId,
      roomName: panel.room.name,
      upstreamSourceId: panel.upstreamSourceId,
      upstreamSourceName: panel.upstreamSource.name,
      feedSide: panel.feedSide,
      voltageLToN: vLN,
      voltageLToL: panel.voltageLToL,
      maxAmpsPerPhase: panel.maxAmpsPerPhase,
      totalBreakerSlots: panel.totalBreakerSlots,
      usedBreakerSlots: panel.circuits.length,
      phaseLoad: {
        wattsL1: Math.round(wattsL1),
        wattsL2: Math.round(wattsL2),
        wattsL3: Math.round(wattsL3),
        ampsL1: Math.round(ampsL1 * 10) / 10,
        ampsL2: Math.round(ampsL2 * 10) / 10,
        ampsL3: Math.round(ampsL3 * 10) / 10,
        totalWatts: Math.round(totalWatts),
        imbalancePct: calcImbalance(wattsL1, wattsL2, wattsL3),
      },
      maxPhaseLoadPct:
        Math.round((maxPhaseAmps / Math.max(1, panel.maxAmpsPerPhase)) * 1000) /
        10,
    });

    const prevSourceWatts = sourceLoadWattsMap.get(panel.upstreamSourceId) ?? 0;
    sourceLoadWattsMap.set(panel.upstreamSourceId, prevSourceWatts + totalWatts);
  }

  // Propagate load upstream (UPS -> ATS -> Utility/Generator)
  for (let pass = 0; pass < 3; pass++) {
    for (const src of powerSources) {
      const myLoad = sourceLoadWattsMap.get(src.id) ?? 0;
      if (myLoad > 0 && src.upstreamSourceAId) {
        // Only add once on pass 0 for UPS->ATS, pass 1 for ATS->Utility
        if (
          (pass === 0 && src.sourceType === "UPS") ||
          (pass === 1 && src.sourceType === "ATS")
        ) {
          const curA = sourceLoadWattsMap.get(src.upstreamSourceAId) ?? 0;
          sourceLoadWattsMap.set(src.upstreamSourceAId, curA + myLoad);
        }
      }
    }
  }

  const powerSourceSummaries = powerSources.map((src) => {
    const loadWatts = sourceLoadWattsMap.get(src.id) ?? 0;
    const loadKw = Math.round((loadWatts / 1000) * 100) / 100;
    const loadAmps =
      Math.round((loadWatts / (Math.sqrt(3) * Math.max(230, src.voltageV))) * 10) /
      10;
    return {
      id: src.id,
      name: src.name,
      sourceType: src.sourceType,
      redundancyGroup: src.redundancyGroup,
      status: src.status,
      capacityKw: src.capacityKw,
      loadKw,
      loadPct: Math.round((loadKw / Math.max(1, src.capacityKw)) * 1000) / 10,
      voltageV: src.voltageV,
      maxAmps: src.maxAmps,
      loadAmps,
      upstreamSourceAId: src.upstreamSourceAId,
      upstreamSourceBId: src.upstreamSourceBId,
      batteryRuntimeMins: src.batteryRuntimeMins,
      fuelRuntimeHours: src.fuelRuntimeHours,
    };
  });

  // 5. Compute Room Cooling & Thermal Summaries
  const roomsCooling: RoomCoolingSummary[] = [];
  for (const room of rooms) {
    const roomRacks = rackSummaries.filter((r) => r.roomId === room.id);
    const itWatts = roomRacks.reduce((acc, r) => acc + r.currentPowerWatts, 0);
    const itLoadKw = Math.round((itWatts / 1000) * 100) / 100;
    const itHeatBtuHr = Math.round(itWatts * 3.41214);

    let onlineCoolingKw = 0;
    let standbyCoolingKw = 0;
    let coolingUnitWatts = 0;
    let onlineUnitCount = 0;
    let largestUnitKw = 0;

    for (const cu of room.coolingUnits) {
      if (cu.status === "ONLINE") {
        onlineCoolingKw += cu.capacityKw;
        coolingUnitWatts += cu.powerDrawWatts;
        onlineUnitCount++;
        if (cu.capacityKw > largestUnitKw) largestUnitKw = cu.capacityKw;
      } else if (cu.status === "STANDBY") {
        standbyCoolingKw += cu.capacityKw;
        coolingUnitWatts += cu.powerDrawWatts;
      }
    }

    const effectiveCapacity =
      onlineCoolingKw > 0 ? onlineCoolingKw : room.coolingCapacityKw;
    const thermalUtilizationPct =
      Math.round((itLoadKw / Math.max(1, effectiveCapacity)) * 1000) / 10;

    const totalAvailableIfOneFails =
      onlineCoolingKw + standbyCoolingKw - largestUnitKw;

    roomsCooling.push({
      roomId: room.id,
      roomName: room.name,
      roomCode: room.code,
      roomType: room.roomType,
      siteName: room.floor.building.site.name,
      itLoadKw,
      itHeatBtuHr,
      coolingUnitLoadKw: Math.round((coolingUnitWatts / 1000) * 100) / 100,
      configuredCoolingKw: room.coolingCapacityKw,
      onlineCoolingKw,
      standbyCoolingKw,
      redundancyMode: room.coolingRedundancy,
      thermalUtilizationPct,
      nPlusOneCompliant: totalAvailableIfOneFails >= itLoadKw,
      unitCount: room.coolingUnits.length,
      onlineUnitCount,
    });
  }

  // 6. Generate Live Engineering Alerts
  const alerts: SystemCapacitySnapshot["alerts"] = [];

  for (const r of rackSummaries) {
    if (r.spofDeviceCount > 0) {
      alerts.push({
        severity: "WARNING",
        category: "REDUNDANCY",
        title: `${r.spofDeviceCount} Single-Corded / Non-Redundant Device(s) in ${r.code}`,
        description: `Rack ${r.name} has ${r.spofDeviceCount} device(s) without dual A+B power feed redundancy. Connect spare PSU in the Rack Studio.`,
        entityId: r.id,
      });
    }
    if (r.powerUtilizationPct >= 80) {
      alerts.push({
        severity: "CRITICAL",
        category: "POWER",
        title: `High Power Density on ${r.code} (${r.powerUtilizationPct}%)`,
        description: `Drawing ${r.currentPowerWatts}W of ${r.maxPowerWatts}W rated rack power envelope.`,
        entityId: r.id,
      });
    }
  }

  for (const p of panelSummaries) {
    if (p.phaseLoad.imbalancePct > 15) {
      alerts.push({
        severity: "WARNING",
        category: "PHASE",
        title: `Phase Imbalance (${p.phaseLoad.imbalancePct}%) on ${p.name}`,
        description: `L1: ${p.phaseLoad.ampsL1}A | L2: ${p.phaseLoad.ampsL2}A | L3: ${p.phaseLoad.ampsL3}A. Consider rebalancing single-phase floor whips across L1/L2/L3.`,
        entityId: p.id,
      });
    }
  }

  for (const rc of roomsCooling) {
    if (rc.thermalUtilizationPct > 80) {
      alerts.push({
        severity: "CRITICAL",
        category: "COOLING",
        title: `Thermal Threshold Exceeded in ${rc.roomName}`,
        description: `IT heat output (${rc.itLoadKw} kW / ${rc.itHeatBtuHr.toLocaleString()} BTU/hr) is at ${rc.thermalUtilizationPct}% of active cooling.`,
        entityId: rc.roomId,
      });
    }
  }

  const pduArray = Array.from(pduSummariesMap.values());
  const totalU = rackSummaries.reduce((a, r) => a + r.totalU, 0);
  const usedU = rackSummaries.reduce((a, r) => a + r.usedU, 0);
  const totalItWatts = rackSummaries.reduce(
    (a, r) => a + r.currentPowerWatts,
    0
  );
  const totalPduOutlets = pduArray.reduce((a, p) => a + p.totalOutlets, 0);
  const usedPduOutlets = pduArray.reduce((a, p) => a + p.usedOutlets, 0);
  const totalOnlineCoolingKw = roomsCooling.reduce(
    (a, c) => a + c.onlineCoolingKw,
    0
  );
  const spofDevicesCount = rackSummaries.reduce(
    (a, r) => a + r.spofDeviceCount,
    0
  );

  const capacity: SystemCapacitySnapshot = {
    totals: {
      siteCount: sites.length,
      roomCount: rooms.length,
      rackCount: racks.length,
      deviceCount: devices.length,
      totalU,
      usedU,
      freeU: totalU - usedU,
      totalItWatts,
      totalItKw: Math.round((totalItWatts / 1000) * 100) / 100,
      totalPduOutlets,
      usedPduOutlets,
      freePduOutlets: totalPduOutlets - usedPduOutlets,
      totalOnlineCoolingKw,
      spofDevicesCount,
      overloadedCircuitsCount: pduArray.filter((p) => p.loadPct >= 80).length,
    },
    racks: rackSummaries,
    pdus: pduArray,
    panels: panelSummaries,
    roomsCooling,
    powerSources: powerSourceSummaries,
    alerts,
  };

  return {
    sites,
    rooms,
    racks,
    powerSources,
    powerPanels,
    powerCircuits,
    pdus,
    devices,
    networkCables,
    templates,
    capacity,
  };
}
