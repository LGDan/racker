import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Operator Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Launch DCIM Workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Global Datacenter Operations Center" })
  ).toBeVisible();
}

export async function submitHierarchy(
  page: Page,
  entity: string,
  name: string,
  code?: string
) {
  const dialog = page.getByRole("heading", {
    name: `Add New ${entity} to Infrastructure`,
  });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Name / Description").fill(name);
  if (code) await page.getByLabel("Short Code").fill(code);
  await page.getByRole("button", { name: `Create ${entity}` }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(name).first()).toBeVisible();
}
