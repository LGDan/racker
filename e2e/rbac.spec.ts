import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const stamp = Date.now().toString().slice(-8);
const userName = `PW Operator ${stamp}`;
const userEmail = `pw.${stamp}@racker.test`;

test.describe("roles", () => {
  test("a standard user can see the estate and edit a rack, not the plant or directory", async ({
    page,
  }) => {
    await login(page, "operator@racker.local", "operator123");

    await expect(page.getByRole("link", { name: "Users & RBAC Audit" })).toHaveCount(0);
    await page.goto("/hierarchy");
    await expect(page.getByRole("button", { name: "New Site" })).toHaveCount(0);
    await expect(page.getByText("Standard Mode")).toBeVisible();

    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "Global Datacenter Operations Center" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/racks");
    await expect(page.getByRole("button", { name: "Install device" })).toBeVisible();

    const hierarchy = await page.request.post("/api/hierarchy", {
      data: { entityType: "SITE", name: "Denied Site", code: `NO${stamp}` },
    });
    expect(hierarchy.status()).toBe(403);

    const users = await page.request.post("/api/users", {
      data: {
        action: "CREATE_USER",
        name: "Denied",
        email: `denied.${stamp}@racker.test`,
        password: "denied-pass",
        role: "ADMIN",
      },
    });
    expect(users.status()).toBe(403);
  });

  test("an admin can create a user, change the role, and see the audit entry", async ({
    page,
  }) => {
    await login(page, "admin@racker.local", "admin123");
    await page.goto("/admin/users");

    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create user" }),
    });
    await form.getByPlaceholder("Name").fill(userName);
    await form.getByPlaceholder("Email").fill(userEmail);
    await form.getByPlaceholder("Password").fill("pw-user-pass");
    await form.getByRole("combobox").selectOption("STANDARD");
    await form.getByRole("button", { name: "Create user" }).click();

    const row = page.getByRole("row", { name: new RegExp(userEmail) });
    await expect(row).toBeVisible();
    await row.getByRole("combobox").selectOption("ADMIN");
    await expect(row.getByRole("combobox")).toHaveValue("ADMIN");
    await expect(page.getByText("CREATE_USER").first()).toBeVisible();
  });
});
