import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  console.log("Seeding Racker DCIM database...");

  const adminHash = await bcrypt.hash("admin123", 10);
  const operatorHash = await bcrypt.hash("operator123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@racker.local",
      name: "Alex Mercer (Infrastructure Admin)",
      passwordHash: adminHash,
      role: "ADMIN",
      active: true,
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: "operator@racker.local",
      name: "Sam Chen (Rack Operator)",
      passwordHash: operatorHash,
      role: "STANDARD",
      active: true,
    },
  });

  // Device Templates Catalog
  const tplDellR760 = await prisma.deviceTemplate.create({
    data: {
      manufacturer: "Dell",
      model: "PowerEdge R760 (2U Compute)",
      deviceType: "SERVER",
      uHeight: 2,
      defaultWatts: 680,
      peakWatts: 1100,
      weightKg: 28,
      psuCount: 2,
      psuPlugType: "C14",
      portCount: 4,
      portType: "SFP28_25G",
    },
  });

  const tplHpeDl360 = await prisma.deviceTemplate.create({
    data: {
      manufacturer: "HPE",
      model: "ProLiant DL360 Gen11 (1U Dense)",
      deviceType: "SERVER",
      uHeight: 1,
      defaultWatts: 460,
      peakWatts: 750,
      weightKg: 17,
      psuCount: 2,
      psuPlugType: "C14",
      portCount: 4,
      portType: "SFP28_25G",
    },
  });

  const tplGpuNode = await prisma.deviceTemplate.create({
    data: {
      manufacturer: "Supermicro",
      model: "SYS-421GE-TNRT (4U 8xGPU AI Node)",
      deviceType: "SERVER",
      uHeight: 4,
      defaultWatts: 3200,
      peakWatts: 4800,
      weightKg: 68,
      psuCount: 4,
      psuPlugType: "C20",
      portCount: 6,
      portType: "QSFP28_100G",
    },
  });

  const tplAristaSwitch = await prisma.deviceTemplate.create({
    data: {
      manufacturer: "Arista",
      model: "7050SX3-48YC8 (1U ToR Leaf Switch)",
      deviceType: "SWITCH",
      uHeight: 1,
      defaultWatts: 280,
      peakWatts: 420,
      weightKg: 9.5,
      psuCount: 2,
      psuPlugType: "C14",
      portCount: 16,
      portType: "SFP28_25G",
    },
  });

  const tplNetAppStorage = await prisma.deviceTemplate.create({
    data: {
      manufacturer: "NetApp",
      model: "AFF A400 (4U NVMe SAN)",
      deviceType: "STORAGE",
      uHeight: 4,
      defaultWatts: 1150,
      peakWatts: 1600,
      weightKg: 46,
      psuCount: 2,
      psuPlugType: "C20",
      portCount: 8,
      portType: "QSFP28_100G",
    },
  });

  const tplPatchPanel = await prisma.deviceTemplate.create({
    data: {
      manufacturer: "Corning",
      model: "EDGE8 24-Port OM4 Fiber Patch Panel",
      deviceType: "PATCH_PANEL",
      uHeight: 1,
      defaultWatts: 0,
      peakWatts: 0,
      weightKg: 3.5,
      psuCount: 0,
      psuPlugType: "C14",
      portCount: 12,
      portType: "FIBER_LC",
    },
  });

  // Site 1: London Primary Campus (LON-DC1)
  const siteLon = await prisma.site.create({
    data: {
      name: "London Docklands Campus",
      code: "LON-DC1",
      address: "14 Harbour Exchange Square",
      city: "London",
      country: "United Kingdom",
      utilityCapacityKw: 4500,
      pueTarget: 1.24,
    },
  });

  // Site 2: Ashburn Secondary Campus (IAD-DC2)
  const siteIad = await prisma.site.create({
    data: {
      name: "Ashburn Loudoun Tech Park",
      code: "IAD-DC2",
      address: "21700 Filigree Court",
      city: "Ashburn, VA",
      country: "United States",
      utilityCapacityKw: 6000,
      pueTarget: 1.31,
    },
  });

  const bldgA = await prisma.building.create({
    data: {
      siteId: siteLon.id,
      name: "Building Alpha (North Wing)",
      code: "BLDG-A",
    },
  });

  const bldgB = await prisma.building.create({
    data: {
      siteId: siteIad.id,
      name: "Building Core-1",
      code: "BLDG-C1",
    },
  });

  const floor1 = await prisma.floor.create({
    data: {
      buildingId: bldgA.id,
      name: "Ground Floor (Plant & Hall 1)",
      levelNumber: 1,
    },
  });

  const floor2 = await prisma.floor.create({
    data: {
      buildingId: bldgA.id,
      name: "First Floor (High-Density Hall 2)",
      levelNumber: 2,
    },
  });

  const floorIad1 = await prisma.floor.create({
    data: {
      buildingId: bldgB.id,
      name: "Level 1 Data Suites",
      levelNumber: 1,
    },
  });

  // Rooms in London Building A
  const roomHall1 = await prisma.room.create({
    data: {
      floorId: floor1.id,
      name: "Data Hall 1A (Primary Production)",
      code: "LON-DH1A",
      roomType: "DATA_HALL",
      coolingCapacityKw: 120,
      coolingRedundancy: "N_PLUS_1",
      ambientTempTargetC: 21.5,
      humidityTargetPct: 45,
      widthMm: 14000,
      depthMm: 10000,
      gridCols: 12,
      gridRows: 9,
    },
  });

  const roomPower1 = await prisma.room.create({
    data: {
      floorId: floor1.id,
      name: "Electrical Switchgear Room A/B",
      code: "LON-PWR1",
      roomType: "POWER_ROOM",
      coolingCapacityKw: 45,
      coolingRedundancy: "N_PLUS_1",
      ambientTempTargetC: 24.0,
      humidityTargetPct: 40,
      widthMm: 8000,
      depthMm: 6000,
      gridCols: 8,
      gridRows: 6,
    },
  });

  const roomHall2 = await prisma.room.create({
    data: {
      floorId: floor2.id,
      name: "Data Hall 2A (AI & HPC Pod)",
      code: "LON-DH2A",
      roomType: "DATA_HALL",
      coolingCapacityKw: 180,
      coolingRedundancy: "TWO_N",
      ambientTempTargetC: 19.5,
      humidityTargetPct: 46,
      widthMm: 12000,
      depthMm: 9000,
      gridCols: 10,
      gridRows: 8,
    },
  });

  const roomIadHall1 = await prisma.room.create({
    data: {
      floorId: floorIad1.id,
      name: "Ashburn Suite 101",
      code: "IAD-DH101",
      roomType: "DATA_HALL",
      coolingCapacityKw: 150,
      coolingRedundancy: "N_PLUS_1",
      ambientTempTargetC: 22.0,
      humidityTargetPct: 45,
      widthMm: 12000,
      depthMm: 8000,
      gridCols: 10,
      gridRows: 8,
    },
  });

  // Cooling Units in Data Hall 1A
  await prisma.coolingUnit.createMany({
    data: [
      {
        roomId: roomHall1.id,
        name: "CRAH-DH1A-01 (North Perimeter)",
        unitType: "CRAH",
        capacityKw: 45,
        airflowCfm: 14500,
        supplyTempC: 18.2,
        returnTempC: 26.8,
        status: "ONLINE",
        powerDrawWatts: 6200,
        posX: 1,
        posY: 1,
      },
      {
        roomId: roomHall1.id,
        name: "CRAH-DH1A-02 (South Perimeter)",
        unitType: "CRAH",
        capacityKw: 45,
        airflowCfm: 14500,
        supplyTempC: 18.5,
        returnTempC: 27.1,
        status: "ONLINE",
        powerDrawWatts: 6400,
        posX: 11,
        posY: 1,
      },
      {
        roomId: roomHall1.id,
        name: "CRAH-DH1A-03 (N+1 Redundant)",
        unitType: "CRAH",
        capacityKw: 45,
        airflowCfm: 14500,
        supplyTempC: 19.0,
        returnTempC: 22.0,
        status: "STANDBY",
        powerDrawWatts: 1200,
        posX: 11,
        posY: 8,
      },
      {
        roomId: roomHall2.id,
        name: "INROW-DH2A-01 (Chilled Water)",
        unitType: "IN_ROW",
        capacityKw: 90,
        airflowCfm: 18000,
        supplyTempC: 17.5,
        returnTempC: 29.4,
        status: "ONLINE",
        powerDrawWatts: 8500,
        posX: 1,
        posY: 2,
      },
      {
        roomId: roomHall2.id,
        name: "INROW-DH2A-02 (Chilled Water)",
        unitType: "IN_ROW",
        capacityKw: 90,
        airflowCfm: 18000,
        supplyTempC: 17.8,
        returnTempC: 28.9,
        status: "ONLINE",
        powerDrawWatts: 8400,
        posX: 9,
        posY: 2,
      },
    ],
  });

  await prisma.floorTile.createMany({
    data: [3, 5, 7].flatMap((posX) =>
      [4, 5].map((posY) => ({
        roomId: roomHall1.id,
        posX,
        posY,
        surface: "GRILL",
      }))
    ),
  });

  // Upstream Power Infrastructure (Utility -> Generator -> ATS -> UPS -> 3-Phase Panels)
  const utilityA = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "UKPN Grid Substation Feed A (11kV/400V)",
      sourceType: "UTILITY",
      redundancyGroup: "A",
      capacityKw: 2000,
      voltageV: 400,
      maxAmps: 2880,
      status: "ONLINE",
    },
  });

  const utilityB = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "UKPN Grid Substation Feed B (11kV/400V)",
      sourceType: "UTILITY",
      redundancyGroup: "B",
      capacityKw: 2000,
      voltageV: 400,
      maxAmps: 2880,
      status: "ONLINE",
    },
  });

  const genA = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "CAT 3516B Diesel Generator G1 (Feed A)",
      sourceType: "GENERATOR",
      redundancyGroup: "A",
      capacityKw: 2250,
      voltageV: 400,
      maxAmps: 3240,
      status: "STANDBY",
      fuelRuntimeHours: 48,
    },
  });

  const genB = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "CAT 3516B Diesel Generator G2 (Feed B)",
      sourceType: "GENERATOR",
      redundancyGroup: "B",
      capacityKw: 2250,
      voltageV: 400,
      maxAmps: 3240,
      status: "STANDBY",
      fuelRuntimeHours: 48,
    },
  });

  const atsA = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "Main Transfer Switch ATS-A",
      sourceType: "ATS",
      redundancyGroup: "A",
      capacityKw: 1800,
      voltageV: 400,
      maxAmps: 2600,
      status: "ONLINE",
      upstreamSourceAId: utilityA.id,
      upstreamSourceBId: genA.id,
    },
  });

  const atsB = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "Main Transfer Switch ATS-B",
      sourceType: "ATS",
      redundancyGroup: "B",
      capacityKw: 1800,
      voltageV: 400,
      maxAmps: 2600,
      status: "ONLINE",
      upstreamSourceAId: utilityB.id,
      upstreamSourceBId: genB.id,
    },
  });

  const upsA = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "Eaton 9395P UPS System A",
      sourceType: "UPS",
      redundancyGroup: "A",
      capacityKw: 600,
      voltageV: 400,
      maxAmps: 866,
      status: "ONLINE",
      batteryRuntimeMins: 22,
      upstreamSourceAId: atsA.id,
    },
  });

  const upsB = await prisma.powerSource.create({
    data: {
      siteId: siteLon.id,
      roomId: roomPower1.id,
      name: "Eaton 9395P UPS System B",
      sourceType: "UPS",
      redundancyGroup: "B",
      capacityKw: 600,
      voltageV: 400,
      maxAmps: 866,
      status: "ONLINE",
      batteryRuntimeMins: 24,
      upstreamSourceAId: atsB.id,
    },
  });

  // Distribution Panels in Data Hall 1A & 2A
  const panelA1 = await prisma.powerPanel.create({
    data: {
      roomId: roomHall1.id,
      upstreamSourceId: upsA.id,
      name: "PDU-PANEL-DH1A-A (Feed A 3-Phase)",
      feedSide: "A",
      voltageLToN: 230,
      voltageLToL: 400,
      maxAmpsPerPhase: 125,
      totalBreakerSlots: 24,
      status: "ONLINE",
    },
  });

  const panelB1 = await prisma.powerPanel.create({
    data: {
      roomId: roomHall1.id,
      upstreamSourceId: upsB.id,
      name: "PDU-PANEL-DH1A-B (Feed B 3-Phase)",
      feedSide: "B",
      voltageLToN: 230,
      voltageLToL: 400,
      maxAmpsPerPhase: 125,
      totalBreakerSlots: 24,
      status: "ONLINE",
    },
  });

  const panelA2 = await prisma.powerPanel.create({
    data: {
      roomId: roomHall2.id,
      upstreamSourceId: upsA.id,
      name: "PDU-PANEL-DH2A-A (Feed A High-Density)",
      feedSide: "A",
      voltageLToN: 230,
      voltageLToL: 400,
      maxAmpsPerPhase: 160,
      totalBreakerSlots: 24,
      status: "ONLINE",
    },
  });

  const panelB2 = await prisma.powerPanel.create({
    data: {
      roomId: roomHall2.id,
      upstreamSourceId: upsB.id,
      name: "PDU-PANEL-DH2A-B (Feed B High-Density)",
      feedSide: "B",
      voltageLToN: 230,
      voltageLToL: 400,
      maxAmpsPerPhase: 160,
      totalBreakerSlots: 24,
      status: "ONLINE",
    },
  });

  // Rows in Data Hall 1A
  const rowA = await prisma.row.create({
    data: {
      roomId: roomHall1.id,
      name: "Row A (Cold Aisle North)",
      orientation: "HORIZONTAL",
      aisleContainment: "COLD_AISLE",
      gridX: 3,
      gridY: 3,
    },
  });

  const rowB = await prisma.row.create({
    data: {
      roomId: roomHall1.id,
      name: "Row B (Cold Aisle South)",
      orientation: "HORIZONTAL",
      aisleContainment: "COLD_AISLE",
      gridX: 3,
      gridY: 6,
    },
  });

  const rowHpc = await prisma.row.create({
    data: {
      roomId: roomHall2.id,
      name: "Row Pod-1 (AI Compute)",
      orientation: "HORIZONTAL",
      aisleContainment: "HOT_AISLE",
      gridX: 3,
      gridY: 4,
    },
  });

  const rowIad = await prisma.row.create({
    data: {
      roomId: roomIadHall1.id,
      name: "Row 01 (Edge Core)",
      orientation: "HORIZONTAL",
      aisleContainment: "COLD_AISLE",
      gridX: 3,
      gridY: 3,
    },
  });

  // Racks in Row A & Row B
  const rackA01 = await prisma.rack.create({
    data: {
      rowId: rowA.id,
      name: "Rack A01 (Core Network & Compute)",
      code: "R-A01",
      totalU: 42,
      maxWeightKg: 1200,
      maxPowerWatts: 12000,
      posX: 3,
      posY: 3,
    },
  });

  const rackA02 = await prisma.rack.create({
    data: {
      rowId: rowA.id,
      name: "Rack A02 (Kubernetes Worker Pod)",
      code: "R-A02",
      totalU: 42,
      maxWeightKg: 1200,
      maxPowerWatts: 12000,
      posX: 5,
      posY: 3,
    },
  });

  const rackA03 = await prisma.rack.create({
    data: {
      rowId: rowA.id,
      name: "Rack A03 (SAN Storage & Database)",
      code: "R-A03",
      totalU: 42,
      maxWeightKg: 1500,
      maxPowerWatts: 14000,
      posX: 7,
      posY: 3,
    },
  });

  const rackB01 = await prisma.rack.create({
    data: {
      rowId: rowB.id,
      name: "Rack B01 (General Virtualization)",
      code: "R-B01",
      totalU: 42,
      maxWeightKg: 1200,
      maxPowerWatts: 12000,
      posX: 3,
      posY: 6,
    },
  });

  const rackHpc01 = await prisma.rack.create({
    data: {
      rowId: rowHpc.id,
      name: "Rack HPC-01 (GPU Training Cluster)",
      code: "R-HPC01",
      totalU: 48,
      maxWeightKg: 1800,
      maxPowerWatts: 22000,
      posX: 4,
      posY: 4,
    },
  });

  await prisma.rack.create({
    data: {
      rowId: rowIad.id,
      name: "Rack IAD-01 (US East Core)",
      code: "R-IAD01",
      totalU: 42,
      maxWeightKg: 1200,
      maxPowerWatts: 12000,
      posX: 3,
      posY: 3,
    },
  });

  // Floor Sockets / Power Circuits (allocated across L1, L2, L3 phases)
  const cirA01_A = await prisma.powerCircuit.create({
    data: {
      panelId: panelA1.id,
      roomId: roomHall1.id,
      rackId: rackA01.id,
      name: "Whip A01-A (Phase L1)",
      floorSocketLabel: "FS-DH1A-A01-L1",
      breakerNumber: 1,
      phaseAllocation: "L1",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 3,
      posY: 2,
    },
  });

  const cirA01_B = await prisma.powerCircuit.create({
    data: {
      panelId: panelB1.id,
      roomId: roomHall1.id,
      rackId: rackA01.id,
      name: "Whip A01-B (Phase L1)",
      floorSocketLabel: "FS-DH1A-A01-B-L1",
      breakerNumber: 1,
      phaseAllocation: "L1",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 4,
      posY: 2,
    },
  });

  const cirA02_A = await prisma.powerCircuit.create({
    data: {
      panelId: panelA1.id,
      roomId: roomHall1.id,
      rackId: rackA02.id,
      name: "Whip A02-A (Phase L2)",
      floorSocketLabel: "FS-DH1A-A02-L2",
      breakerNumber: 2,
      phaseAllocation: "L2",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 5,
      posY: 2,
    },
  });

  const cirA02_B = await prisma.powerCircuit.create({
    data: {
      panelId: panelB1.id,
      roomId: roomHall1.id,
      rackId: rackA02.id,
      name: "Whip A02-B (Phase L2)",
      floorSocketLabel: "FS-DH1A-A02-B-L2",
      breakerNumber: 2,
      phaseAllocation: "L2",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 6,
      posY: 2,
    },
  });

  const cirA03_A = await prisma.powerCircuit.create({
    data: {
      panelId: panelA1.id,
      roomId: roomHall1.id,
      rackId: rackA03.id,
      name: "Whip A03-A (Phase L3)",
      floorSocketLabel: "FS-DH1A-A03-L3",
      breakerNumber: 3,
      phaseAllocation: "L3",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 7,
      posY: 2,
    },
  });

  const cirA03_B = await prisma.powerCircuit.create({
    data: {
      panelId: panelB1.id,
      roomId: roomHall1.id,
      rackId: rackA03.id,
      name: "Whip A03-B (Phase L3)",
      floorSocketLabel: "FS-DH1A-A03-B-L3",
      breakerNumber: 3,
      phaseAllocation: "L3",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 8,
      posY: 2,
    },
  });

  const cirB01_A = await prisma.powerCircuit.create({
    data: {
      panelId: panelA1.id,
      roomId: roomHall1.id,
      rackId: rackB01.id,
      name: "Whip B01-A (Phase L1)",
      floorSocketLabel: "FS-DH1A-B01-L1",
      breakerNumber: 4,
      phaseAllocation: "L1",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 3,
      posY: 7,
    },
  });

  const cirB01_B = await prisma.powerCircuit.create({
    data: {
      panelId: panelB1.id,
      roomId: roomHall1.id,
      rackId: rackB01.id,
      name: "Whip B01-B (Phase L2)",
      floorSocketLabel: "FS-DH1A-B01-B-L2",
      breakerNumber: 4,
      phaseAllocation: "L2",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 4,
      posY: 7,
    },
  });

  // Spare unconnected Floor Socket in Hall 1A for interactive demo connecting
  await prisma.powerCircuit.create({
    data: {
      panelId: panelA1.id,
      roomId: roomHall1.id,
      rackId: rackA01.id,
      name: "Spare Floor Whip A01-C (Phase L3)",
      floorSocketLabel: "FS-DH1A-SPARE-L3",
      breakerNumber: 5,
      phaseAllocation: "L3",
      ratedAmps: 32,
      voltageV: 230,
      socketType: "IEC_60309_32A_1P",
      posX: 2,
      posY: 2,
    },
  });

  // 3-Phase High-Density Floor Sockets in Hall 2A
  const cirHpc_A = await prisma.powerCircuit.create({
    data: {
      panelId: panelA2.id,
      roomId: roomHall2.id,
      rackId: rackHpc01.id,
      name: "3-Phase Commando HPC01-A (32A 400V)",
      floorSocketLabel: "FS-DH2A-HPC01-3P-A",
      breakerNumber: 1,
      phaseAllocation: "THREE_PHASE",
      ratedAmps: 32,
      voltageV: 400,
      socketType: "IEC_60309_32A_3P",
      posX: 4,
      posY: 3,
    },
  });

  const cirHpc_B = await prisma.powerCircuit.create({
    data: {
      panelId: panelB2.id,
      roomId: roomHall2.id,
      rackId: rackHpc01.id,
      name: "3-Phase Commando HPC01-B (32A 400V)",
      floorSocketLabel: "FS-DH2A-HPC01-3P-B",
      breakerNumber: 1,
      phaseAllocation: "THREE_PHASE",
      ratedAmps: 32,
      voltageV: 400,
      socketType: "IEC_60309_32A_3P",
      posX: 5,
      posY: 3,
    },
  });

  // Helper to create a PDU with 16 outlets (12x C13, 4x C19)
  async function createRackPduWithOutlets(params: {
    rackId: string;
    circuitId: string | null;
    name: string;
    mounting: string;
    feedSide: string;
    phaseMode: string;
    maxAmps: number;
    voltageV: number;
    maxWatts: number;
    defaultBankPhase: string;
  }) {
    const pdu = await prisma.rackPdu.create({
      data: {
        rackId: params.rackId,
        circuitId: params.circuitId,
        name: params.name,
        model:
          params.phaseMode === "THREE_PHASE"
            ? "Raritan PX3-5466V (3-Phase 22kW)"
            : "APC AP8853 Zero-U (32A 7.4kW)",
        mounting: params.mounting,
        uHeight: 0,
        feedSide: params.feedSide,
        phaseMode: params.phaseMode,
        maxAmps: params.maxAmps,
        voltageV: params.voltageV,
        maxWatts: params.maxWatts,
        inputPlugType:
          params.phaseMode === "THREE_PHASE"
            ? "IEC_60309_32A_3P"
            : "IEC_60309_32A_1P",
        status: "ONLINE",
      },
    });

    const phases = ["L1", "L2", "L3"];
    for (let i = 1; i <= 16; i++) {
      const bankPhase =
        params.phaseMode === "THREE_PHASE"
          ? phases[(i - 1) % 3]
          : params.defaultBankPhase;
      const socketType = i >= 13 ? "C19" : "C13";
      await prisma.pduOutlet.create({
        data: {
          pduId: pdu.id,
          outletNumber: i,
          label: `Outlet #${i} (${socketType})`,
          bankPhase,
          socketType,
          maxAmps: socketType === "C19" ? 16 : 10,
        },
      });
    }

    return prisma.rackPdu.findUniqueOrThrow({
      where: { id: pdu.id },
      include: { outlets: { orderBy: { outletNumber: "asc" } } },
    });
  }

  // Create PDUs in Racks
  const pduA01_A = await createRackPduWithOutlets({
    rackId: rackA01.id,
    circuitId: cirA01_A.id,
    name: "PDU-A01-A (Left Feed A)",
    mounting: "ZERO_U_LEFT",
    feedSide: "A",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L1",
  });

  const pduA01_B = await createRackPduWithOutlets({
    rackId: rackA01.id,
    circuitId: cirA01_B.id,
    name: "PDU-A01-B (Right Feed B)",
    mounting: "ZERO_U_RIGHT",
    feedSide: "B",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L1",
  });

  const pduA02_A = await createRackPduWithOutlets({
    rackId: rackA02.id,
    circuitId: cirA02_A.id,
    name: "PDU-A02-A (Left Feed A)",
    mounting: "ZERO_U_LEFT",
    feedSide: "A",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L2",
  });

  const pduA02_B = await createRackPduWithOutlets({
    rackId: rackA02.id,
    circuitId: cirA02_B.id,
    name: "PDU-A02-B (Right Feed B)",
    mounting: "ZERO_U_RIGHT",
    feedSide: "B",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L2",
  });

  const pduA03_A = await createRackPduWithOutlets({
    rackId: rackA03.id,
    circuitId: cirA03_A.id,
    name: "PDU-A03-A (Left Feed A)",
    mounting: "ZERO_U_LEFT",
    feedSide: "A",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L3",
  });

  const pduA03_B = await createRackPduWithOutlets({
    rackId: rackA03.id,
    circuitId: cirA03_B.id,
    name: "PDU-A03-B (Right Feed B)",
    mounting: "ZERO_U_RIGHT",
    feedSide: "B",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L3",
  });

  const pduB01_A = await createRackPduWithOutlets({
    rackId: rackB01.id,
    circuitId: cirB01_A.id,
    name: "PDU-B01-A (Left Feed A)",
    mounting: "ZERO_U_LEFT",
    feedSide: "A",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L1",
  });

  const pduB01_B = await createRackPduWithOutlets({
    rackId: rackB01.id,
    circuitId: cirB01_B.id,
    name: "PDU-B01-B (Right Feed B)",
    mounting: "ZERO_U_RIGHT",
    feedSide: "B",
    phaseMode: "SINGLE_PHASE",
    maxAmps: 32,
    voltageV: 230,
    maxWatts: 7360,
    defaultBankPhase: "L2",
  });

  const pduHpc_A = await createRackPduWithOutlets({
    rackId: rackHpc01.id,
    circuitId: cirHpc_A.id,
    name: "PDU-HPC01-A (3P 22kW Left)",
    mounting: "ZERO_U_LEFT",
    feedSide: "A",
    phaseMode: "THREE_PHASE",
    maxAmps: 32,
    voltageV: 400,
    maxWatts: 22000,
    defaultBankPhase: "L1",
  });

  const pduHpc_B = await createRackPduWithOutlets({
    rackId: rackHpc01.id,
    circuitId: cirHpc_B.id,
    name: "PDU-HPC01-B (3P 22kW Right)",
    mounting: "ZERO_U_RIGHT",
    feedSide: "B",
    phaseMode: "THREE_PHASE",
    maxAmps: 32,
    voltageV: 400,
    maxWatts: 22000,
    defaultBankPhase: "L1",
  });

  // Helper to create a RackDevice with PSUs and NetworkPorts
  async function createPopulatedDevice(params: {
    rackId: string;
    templateId?: string;
    name: string;
    hostname: string;
    assetTag: string;
    deviceType: string;
    manufacturer: string;
    model: string;
    startU: number;
    uHeight: number;
    nominalWatts: number;
    peakWatts: number;
    weightKg: number;
    psuCount: number;
    psuPlugType: string;
    portCount: number;
    portPrefix: string;
    portType: string;
    speedGbps: number;
    outletIds?: (string | null)[];
  }) {
    const dev = await prisma.rackDevice.create({
      data: {
        rackId: params.rackId,
        templateId: params.templateId,
        name: params.name,
        hostname: params.hostname,
        assetTag: params.assetTag,
        serialNumber: `SN-${params.assetTag}-2026`,
        deviceType: params.deviceType,
        manufacturer: params.manufacturer,
        model: params.model,
        startU: params.startU,
        uHeight: params.uHeight,
        face: "BOTH",
        status: "ACTIVE",
        nominalWatts: params.nominalWatts,
        peakWatts: params.peakWatts,
        weightKg: params.weightKg,
      },
    });

    for (let i = 1; i <= params.psuCount; i++) {
      const outletId = params.outletIds?.[i - 1] ?? null;
      await prisma.devicePsu.create({
        data: {
          deviceId: dev.id,
          name: `PSU ${i}`,
          maxWatts: Math.round(params.peakWatts / Math.max(1, params.psuCount - 1 || 1)),
          plugType: params.psuPlugType,
          connectedOutletId: outletId,
          cableColor: i % 2 === 1 ? "#3b82f6" : "#f59e0b",
          cableLabel: `${params.hostname}-PSU${i}`,
        },
      });
    }

    for (let p = 1; p <= params.portCount; p++) {
      await prisma.networkPort.create({
        data: {
          deviceId: dev.id,
          name: `${params.portPrefix}${p}`,
          portNumber: p,
          portType: params.portType,
          speedGbps: params.speedGbps,
          vlanTag: p === 1 ? 10 : 200,
          isManagement: p === 1 && params.deviceType === "SERVER",
          ipAddress:
            p === 1
              ? `10.40.${params.startU}.${10 + p}`
              : undefined,
        },
      });
    }

    return prisma.rackDevice.findUniqueOrThrow({
      where: { id: dev.id },
      include: {
        psus: true,
        networkPorts: { orderBy: { portNumber: "asc" } },
      },
    });
  }

  // Populate Rack A01 (Core Network & Compute)
  const patchA01 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplPatchPanel.id,
    name: "PP-A01-TOP (Fiber Patch Panel)",
    hostname: "pp-a01-top",
    assetTag: "LON-PP-001",
    deviceType: "PATCH_PANEL",
    manufacturer: "Corning",
    model: "EDGE8 24-Port OM4",
    startU: 42,
    uHeight: 1,
    nominalWatts: 0,
    peakWatts: 0,
    weightKg: 3.5,
    psuCount: 0,
    psuPlugType: "C14",
    portCount: 8,
    portPrefix: "P",
    portType: "FIBER_LC",
    speedGbps: 100,
  });

  const swA01_1 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplAristaSwitch.id,
    name: "TOR-SW-A01-A (Arista Leaf A)",
    hostname: "tor-sw-a01-a.lon.racker",
    assetTag: "LON-SW-101",
    deviceType: "SWITCH",
    manufacturer: "Arista",
    model: "7050SX3-48YC8",
    startU: 41,
    uHeight: 1,
    nominalWatts: 280,
    peakWatts: 420,
    weightKg: 9.5,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 12,
    portPrefix: "Et",
    portType: "SFP28_25G",
    speedGbps: 25,
    outletIds: [pduA01_A.outlets[0].id, pduA01_B.outlets[0].id],
  });

  const swA01_2 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplAristaSwitch.id,
    name: "TOR-SW-A01-B (Arista Leaf B)",
    hostname: "tor-sw-a01-b.lon.racker",
    assetTag: "LON-SW-102",
    deviceType: "SWITCH",
    manufacturer: "Arista",
    model: "7050SX3-48YC8",
    startU: 40,
    uHeight: 1,
    nominalWatts: 280,
    peakWatts: 420,
    weightKg: 9.5,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 12,
    portPrefix: "Et",
    portType: "SFP28_25G",
    speedGbps: 25,
    outletIds: [pduA01_A.outlets[1].id, pduA01_B.outlets[1].id],
  });

  const srvA01_1 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplDellR760.id,
    name: "PROD-K8S-CTRL-01",
    hostname: "prod-k8s-ctrl-01.lon",
    assetTag: "LON-SRV-201",
    deviceType: "SERVER",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    startU: 36,
    uHeight: 2,
    nominalWatts: 720,
    peakWatts: 1100,
    weightKg: 28,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 4,
    portPrefix: "eth",
    portType: "SFP28_25G",
    speedGbps: 25,
    outletIds: [pduA01_A.outlets[2].id, pduA01_B.outlets[2].id],
  });

  const srvA01_2 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplDellR760.id,
    name: "PROD-K8S-CTRL-02",
    hostname: "prod-k8s-ctrl-02.lon",
    assetTag: "LON-SRV-202",
    deviceType: "SERVER",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    startU: 34,
    uHeight: 2,
    nominalWatts: 740,
    peakWatts: 1100,
    weightKg: 28,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 4,
    portPrefix: "eth",
    portType: "SFP28_25G",
    speedGbps: 25,
    outletIds: [pduA01_A.outlets[3].id, pduA01_B.outlets[3].id],
  });

  const srvA01_3 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplHpeDl360.id,
    name: "PROD-AUTH-GW-01 (Single-Corded Warning Demo)",
    hostname: "prod-auth-gw-01.lon",
    assetTag: "LON-SRV-203",
    deviceType: "SERVER",
    manufacturer: "HPE",
    model: "ProLiant DL360 Gen11",
    startU: 32,
    uHeight: 1,
    nominalWatts: 490,
    peakWatts: 750,
    weightKg: 17,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 4,
    portPrefix: "eno",
    portType: "SFP28_25G",
    speedGbps: 25,
    // Intentionally leave PSU 2 unplugged so operator can see SPOF indicator and connect it interactively!
    outletIds: [pduA01_A.outlets[4].id, null],
  });

  const srvA01_4 = await createPopulatedDevice({
    rackId: rackA01.id,
    templateId: tplNetAppStorage.id,
    name: "SAN-NVME-PRIMARY-01",
    hostname: "san-nvme-01.lon",
    assetTag: "LON-SAN-301",
    deviceType: "STORAGE",
    manufacturer: "NetApp",
    model: "AFF A400",
    startU: 26,
    uHeight: 4,
    nominalWatts: 1280,
    peakWatts: 1650,
    weightKg: 46,
    psuCount: 2,
    psuPlugType: "C20",
    portCount: 4,
    portPrefix: "e0",
    portType: "QSFP28_100G",
    speedGbps: 100,
    outletIds: [pduA01_A.outlets[12].id, pduA01_B.outlets[12].id],
  });

  // Network cables in Rack A01
  await prisma.networkCable.createMany({
    data: [
      {
        portAId: srvA01_1.networkPorts[0].id,
        portBId: swA01_1.networkPorts[0].id,
        cableType: "DAC",
        color: "#06b6d4",
        label: "CBL-A01-K8S1-A",
        lengthMeters: 2.0,
      },
      {
        portAId: srvA01_1.networkPorts[1].id,
        portBId: swA01_2.networkPorts[0].id,
        cableType: "DAC",
        color: "#f59e0b",
        label: "CBL-A01-K8S1-B",
        lengthMeters: 2.0,
      },
      {
        portAId: srvA01_2.networkPorts[0].id,
        portBId: swA01_1.networkPorts[1].id,
        cableType: "DAC",
        color: "#06b6d4",
        label: "CBL-A01-K8S2-A",
        lengthMeters: 2.0,
      },
      {
        portAId: srvA01_2.networkPorts[1].id,
        portBId: swA01_2.networkPorts[1].id,
        cableType: "DAC",
        color: "#f59e0b",
        label: "CBL-A01-K8S2-B",
        lengthMeters: 2.0,
      },
      {
        portAId: srvA01_3.networkPorts[0].id,
        portBId: swA01_1.networkPorts[2].id,
        cableType: "DAC",
        color: "#10b981",
        label: "CBL-A01-AUTH-A",
        lengthMeters: 1.5,
      },
      {
        portAId: swA01_1.networkPorts[11].id,
        portBId: patchA01.networkPorts[0].id,
        cableType: "MMF_OM4",
        color: "#a855f7",
        label: "FBR-UPLINK-SPINE-1",
        lengthMeters: 15.0,
      },
    ],
  });

  // Populate Rack A02 (Kubernetes Worker Pod)
  const swA02_1 = await createPopulatedDevice({
    rackId: rackA02.id,
    templateId: tplAristaSwitch.id,
    name: "TOR-SW-A02-A",
    hostname: "tor-sw-a02-a.lon.racker",
    assetTag: "LON-SW-103",
    deviceType: "SWITCH",
    manufacturer: "Arista",
    model: "7050SX3-48YC8",
    startU: 42,
    uHeight: 1,
    nominalWatts: 290,
    peakWatts: 420,
    weightKg: 9.5,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 12,
    portPrefix: "Et",
    portType: "SFP28_25G",
    speedGbps: 25,
    outletIds: [pduA02_A.outlets[0].id, pduA02_B.outlets[0].id],
  });

  for (let idx = 0; idx < 5; idx++) {
    const uPos = 38 - idx * 3;
    const worker = await createPopulatedDevice({
      rackId: rackA02.id,
      templateId: tplDellR760.id,
      name: `PROD-K8S-WORK-0${idx + 1}`,
      hostname: `prod-k8s-work-0${idx + 1}.lon`,
      assetTag: `LON-SRV-21${idx + 1}`,
      deviceType: "SERVER",
      manufacturer: "Dell",
      model: "PowerEdge R760",
      startU: uPos,
      uHeight: 2,
      nominalWatts: 820,
      peakWatts: 1150,
      weightKg: 28,
      psuCount: 2,
      psuPlugType: "C14",
      portCount: 4,
      portPrefix: "eth",
      portType: "SFP28_25G",
      speedGbps: 25,
      outletIds: [pduA02_A.outlets[idx + 1].id, pduA02_B.outlets[idx + 1].id],
    });

    await prisma.networkCable.create({
      data: {
        portAId: worker.networkPorts[0].id,
        portBId: swA02_1.networkPorts[idx].id,
        cableType: "DAC",
        color: "#06b6d4",
        label: `CBL-A02-W${idx + 1}`,
        lengthMeters: 2.5,
      },
    });
  }

  // Populate Rack A03 (SAN Storage & Database)
  await createPopulatedDevice({
    rackId: rackA03.id,
    templateId: tplNetAppStorage.id,
    name: "DB-PGSQL-CLUSTER-01",
    hostname: "db-pgsql-01.lon",
    assetTag: "LON-DB-401",
    deviceType: "STORAGE",
    manufacturer: "NetApp",
    model: "AFF A400",
    startU: 36,
    uHeight: 4,
    nominalWatts: 1450,
    peakWatts: 1800,
    weightKg: 46,
    psuCount: 2,
    psuPlugType: "C20",
    portCount: 4,
    portPrefix: "e0",
    portType: "QSFP28_100G",
    speedGbps: 100,
    outletIds: [pduA03_A.outlets[12].id, pduA03_B.outlets[12].id],
  });

  await createPopulatedDevice({
    rackId: rackA03.id,
    templateId: tplNetAppStorage.id,
    name: "DB-PGSQL-CLUSTER-02",
    hostname: "db-pgsql-02.lon",
    assetTag: "LON-DB-402",
    deviceType: "STORAGE",
    manufacturer: "NetApp",
    model: "AFF A400",
    startU: 30,
    uHeight: 4,
    nominalWatts: 1420,
    peakWatts: 1800,
    weightKg: 46,
    psuCount: 2,
    psuPlugType: "C20",
    portCount: 4,
    portPrefix: "e0",
    portType: "QSFP28_100G",
    speedGbps: 100,
    outletIds: [pduA03_A.outlets[13].id, pduA03_B.outlets[13].id],
  });

  // Populate Rack B01
  await createPopulatedDevice({
    rackId: rackB01.id,
    templateId: tplDellR760.id,
    name: "VMWARE-ESXI-HV-01",
    hostname: "esxi-hv-01.lon",
    assetTag: "LON-VM-501",
    deviceType: "SERVER",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    startU: 38,
    uHeight: 2,
    nominalWatts: 690,
    peakWatts: 980,
    weightKg: 28,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 4,
    portPrefix: "vmnic",
    portType: "SFP28_25G",
    speedGbps: 25,
    outletIds: [pduB01_A.outlets[0].id, pduB01_B.outlets[0].id],
  });

  // Populate Rack HPC-01 (High-Density AI GPU Rack)
  await createPopulatedDevice({
    rackId: rackHpc01.id,
    templateId: tplGpuNode.id,
    name: "AI-H100-NODE-01",
    hostname: "ai-h100-01.lon",
    assetTag: "LON-GPU-901",
    deviceType: "SERVER",
    manufacturer: "Supermicro",
    model: "SYS-421GE-TNRT (8x H100)",
    startU: 40,
    uHeight: 4,
    nominalWatts: 3400,
    peakWatts: 4800,
    weightKg: 68,
    psuCount: 4,
    psuPlugType: "C20",
    portCount: 4,
    portPrefix: "ib",
    portType: "QSFP28_100G",
    speedGbps: 100,
    outletIds: [
      pduHpc_A.outlets[12].id,
      pduHpc_A.outlets[13].id,
      pduHpc_B.outlets[12].id,
      pduHpc_B.outlets[13].id,
    ],
  });

  await createPopulatedDevice({
    rackId: rackHpc01.id,
    templateId: tplGpuNode.id,
    name: "AI-H100-NODE-02",
    hostname: "ai-h100-02.lon",
    assetTag: "LON-GPU-902",
    deviceType: "SERVER",
    manufacturer: "Supermicro",
    model: "SYS-421GE-TNRT (8x H100)",
    startU: 34,
    uHeight: 4,
    nominalWatts: 3350,
    peakWatts: 4800,
    weightKg: 68,
    psuCount: 4,
    psuPlugType: "C20",
    portCount: 4,
    portPrefix: "ib",
    portType: "QSFP28_100G",
    speedGbps: 100,
    outletIds: [
      pduHpc_A.outlets[14].id,
      pduHpc_A.outlets[15].id,
      pduHpc_B.outlets[14].id,
      pduHpc_B.outlets[15].id,
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "SEED_INITIALIZED",
        entityType: "SYSTEM",
        details: "Initialized London Docklands (LON-DC1) and Ashburn (IAD-DC2) infrastructure.",
      },
      {
        userId: operator.id,
        action: "PATCH_PSU_CORD",
        entityType: "RACK",
        entityId: rackA01.id,
        details: "Patched PROD-K8S-CTRL-01 dual power supplies to PDU-A01-A and PDU-A01-B.",
      },
    ],
  });

  console.log("Racker DCIM seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
