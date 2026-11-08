import { expect, test, type Page } from "@playwright/test";
import { login, submitHierarchy } from "./helpers";

const stamp = Date.now().toString().slice(-8);
const siteName = `PW Campus ${stamp}`;
const siteCode = `PW${stamp}`;
const buildingName = `PW Hall ${stamp}`;
const buildingCode = `PB${stamp}`;
const floorName = `PW Level ${stamp}`;
const roomName = `PW Data Hall ${stamp}`;
const roomCode = `PR${stamp}`;
const rowName = `PW Row ${stamp}`;
const rackName = `PW Rack ${stamp}`;
const rackCode = `RK${stamp}`;
const sourceName = `PW Utility ${stamp}`;
const panelName = `PW Panel ${stamp}`;
const whipA = `FS-${stamp}-A`;
const whipB = `FS-${stamp}-B`;
const coolingName = `PW CRAH ${stamp}`;
const pduA = `PW PDU A ${stamp}`;
const pduB = `PW PDU B ${stamp}`;
const switchName = `PW Switch ${stamp}`;
const serverName = `PW Server ${stamp}`;
const gpuName = `PW GPU ${stamp}`;

test.describe.configure({ mode: "serial" });

test.describe("infrastructure lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin@racker.local", "admin123");
  });

  test("creates site, building, floor, room, row, and rack", async ({ page }) => {
    await page.goto("/hierarchy");
    await page.getByRole("button", { name: "New Site" }).click();
    await submitHierarchy(page, "SITE", siteName, siteCode);

    const tree = page.getByRole("navigation", { name: "Locations" });

    await tree
      .getByText(siteName, { exact: true })
      .locator("xpath=..")
      .getByRole("button", { name: "+ Bldg" })
      .click();
    await submitHierarchy(page, "BUILDING", buildingName, buildingCode);

    await tree
      .getByText(`${buildingName} (${buildingCode})`, { exact: true })
      .locator("xpath=..")
      .getByRole("button", { name: "+ Floor" })
      .click();
    await submitHierarchy(page, "FLOOR", floorName);

    await tree
      .getByText(floorName, { exact: false })
      .locator("xpath=..")
      .getByRole("button", { name: "+ Room" })
      .click();
    await submitHierarchy(page, "ROOM", roomName, roomCode);

    await tree.getByRole("button", { name: roomName, exact: true }).click();
    await page.getByRole("button", { name: `Add Row in ${roomCode}` }).click();
    await submitHierarchy(page, "ROW", rowName);

    await tree
      .getByText(rowName, { exact: true })
      .locator("xpath=..")
      .getByRole("button", { name: "+ Rack" })
      .click();
    await submitHierarchy(page, "RACK", rackName, rackCode);
    await expect(tree.getByRole("link", { name: new RegExp(rackCode) }).first()).toBeVisible();
  });

  test("creates a supply, panel, floor whips, and cooling unit", async ({ page }) => {
    await page.goto("/power-cooling");

    const supply = page.locator("form").filter({ hasText: "Add a supply" });
    await supply.locator("select").first().selectOption({ label: siteCode });
    await supply.getByPlaceholder("Name").fill(sourceName);
    await supply.getByRole("button", { name: "Add supply" }).click();
    await expect(page.getByRole("heading", { name: sourceName })).toBeVisible();

    const panel = page.locator("form").filter({ has: page.getByPlaceholder("Panel name") });
    await panel.getByPlaceholder("Panel name").fill(panelName);
    await panel.locator("select").nth(0).selectOption({ label: roomName });
    await panel.locator("select").nth(1).selectOption({ label: sourceName });
    await panel.getByRole("button", { name: "Add panel" }).click();
    await expect(page.getByText(panelName).first()).toBeVisible();

    await addWhip(page, whipA, "L1");
    await addWhip(page, whipB, "L2");

    const whipRow = page
      .locator("div.flex")
      .filter({ hasText: whipB })
      .filter({ has: page.locator("select") })
      .last();
    await whipRow.locator("select").selectOption("L3");
    await expect(whipRow.locator("select")).toHaveValue("L3");

    const cooling = page.locator("form").filter({ has: page.getByPlaceholder("Unit name") });
    await cooling.getByPlaceholder("Unit name").fill(coolingName);
    await cooling.locator("select").first().selectOption({ label: roomName });
    await cooling.locator("select").nth(1).selectOption("CRAH");
    await cooling.getByRole("button", { name: "Add unit" }).click();
    await expect(page.getByText(coolingName).first()).toBeVisible();
  });

  test("installs PDUs and devices, then cords and patches them", async ({ page }) => {
    await openRack(page);

    await addPdu(page, pduA, "A", whipA);
    await addPdu(page, pduB, "B", whipB);

    await installFromTemplate(page, "Arista 7050SX3-48YC8 (1U ToR Leaf Switch)", switchName);
    await installFromTemplate(page, "Dell PowerEdge R760 (2U Compute)", serverName);

    await page.getByRole("button", { name: "Power patching" }).click();
    await page.getByRole("button", { name: serverName }).click();
    await cordPsu(page, "PSU 1", pduA, 1);
    await expect(page.getByRole("button", { name: new RegExp(`#1 C13 L1 ${serverName}`) }).first()).toBeDisabled();
    await cordPsu(page, "PSU 2", pduB, 1);
    await expect(page.getByText(/A [1-9]\d* W · B [1-9]\d* W/)).toBeVisible();
    await expect(page.getByText("2 used of 32")).toBeVisible();

    await page.getByRole("button", { name: "Network patching" }).click();
    await page.getByRole("button", { name: serverName }).first().click();
    await page.getByRole("button", { name: /^eth1(?!\d)/ }).click();
    await page.getByRole("button", { name: switchName }).click();
    await page.getByRole("button", { name: /^Et1(?!\d)/ }).click();
    await expect(page.getByText("Patch cable landed.")).toBeVisible();

    await page.getByRole("button", { name: "Power patching" }).click();
    await installFromTemplate(page, "Supermicro SYS-421GE-TNRT (4U 8xGPU AI Node)", gpuName);
    await page.getByRole("button", { name: gpuName }).click();
    const gpuPsu = page.locator("div").filter({ hasText: /^PSU 1 · C20/ }).last();
    await gpuPsu.getByRole("button", { name: "Patch", exact: true }).click();
    await expect(gpuPsu.getByRole("button", { name: "Selecting outlet…" })).toBeVisible();
    const freeC13 = page.getByTitle(`${pduA} Outlet #2 (C13)`, { exact: true });
    await freeC13.scrollIntoViewIfNeeded();
    await freeC13.click();
    await expect(page.getByText("A C20 plug cannot mate with a C13 outlet")).toBeVisible();
    await expect(freeC13).toBeVisible();
  });

  test("shows the new rack on the report and the failure blast radius", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("link", { name: rackCode })).toBeVisible();

    await page.goto("/diagrams");
    await expect(page.getByText("Failure simulation")).toBeVisible();
    await page.getByRole("checkbox", { name: new RegExp(sourceName) }).check();
    await expect(page.getByText(/[1-9]\d* devices fully dark/)).toBeVisible();
  });
});

async function cordPsu(page: Page, psuName: string, pduName: string, outletNo: number) {
  const row = page.locator("div").filter({ hasText: new RegExp(`^${psuName} ·`) }).last();
  await row.getByRole("button", { name: "Patch", exact: true }).click();
  await expect(row.getByRole("button", { name: "Selecting outlet…" })).toBeVisible();
  const outlet = page.getByTitle(`${pduName} Outlet #${outletNo} (C13)`, { exact: true });
  await outlet.scrollIntoViewIfNeeded();
  await outlet.click();
  await expect(page.getByText(`${psuName} patched to ${pduName}`)).toBeVisible();
}

async function addWhip(page: Page, label: string, phase: string) {
  const form = page.locator("form").filter({ has: page.getByPlaceholder("Whip name") });
  await form.getByPlaceholder("Whip name").fill(label);
  await form.getByPlaceholder("Floor socket label").fill(label);
  await form.locator("select").nth(0).selectOption({ label: panelName });
  await form.locator("select").nth(1).selectOption({ label: roomName });
  await form.locator("select").nth(2).selectOption({ label: rackCode });
  await form.locator("select").nth(3).selectOption(phase);
  await form.getByRole("button", { name: "Add socket" }).click();
  await expect(page.getByText(label).first()).toBeVisible();
}

async function openRack(page: Page) {
  await page.goto("/racks");
  await page.getByRole("combobox", { name: /^Rack/ }).selectOption({
    label: `${rackCode} — ${rackName}`,
  });
  await expect(page.getByRole("heading", { name: new RegExp(rackCode) })).toBeVisible();
}

async function addPdu(page: Page, name: string, feed: string, socketLabel: string) {
  await page.getByRole("button", { name: "Add PDU" }).click();
  const form = page.locator("form").filter({ has: page.getByLabel("PDU name") });
  await form.getByLabel("PDU name").fill(name);
  await form.getByLabel("Feed").selectOption(feed);
  const phase = feed === "B" ? "L3" : "L1";
  await form.getByLabel("Floor socket").selectOption({
    label: `${socketLabel} · ${phase} · 32A`,
  });
  await form.getByRole("button", { name: "Add PDU" }).click();
  await expect(page.getByText(`Added ${name}.`)).toBeVisible();
}

async function installFromTemplate(page: Page, template: string, name: string) {
  await page.getByRole("button", { name: "Install device" }).click();
  const form = page.locator("form").filter({ has: page.getByLabel("Catalog template") });
  await form.getByLabel("Catalog template").selectOption({ label: template });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Place in rack" }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) }).first()).toBeVisible();
}
