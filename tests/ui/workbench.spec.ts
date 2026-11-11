import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test("import, inspect, persist, export and archive an investigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Yeni inceleme", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Örnek veriyi kullan", exact: true })
    .click();
  await page
    .getByLabel("İnceleme adı", { exact: true })
    .fill("Browser evidence workflow");
  await page.getByRole("button", { name: "Karşılaştır", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Browser evidence workflow",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bulgular 10", exact: true }),
  ).toBeVisible();
  const title = "Import ve dosya adı harf büyüklüğü uyuşmuyor";
  await page
    .getByRole("button", { name: title + " ayrıntıları", exact: true })
    .click();
  await expect(page.getByText(/error TS2307/).first()).toBeVisible();
  await page
    .getByRole("button", {
      name: title + " tamamlandı olarak işaretle",
      exact: true,
    })
    .click();
  await page
    .getByLabel("İnceleme notu", { exact: true })
    .fill("Reproduce on Linux before changing the import.");
  await page.getByRole("button", { name: "Notu kaydet", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Notu kaydet", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("İnceleme notu", { exact: true })).toHaveValue(
    "Reproduce on Linux before changing the import.",
  );
  await expect(
    page.getByRole("button", { name: title + " yeniden aç", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/workbench-desktop.png",
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Ortam farkları", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("20.19.0");
  await page.getByRole("button", { name: "Log izi 6", exact: true }).click();
  await expect(page.getByText(/error NETSDK1045/).first()).toBeVisible();
  await page.getByRole("button", { name: "Paylaşım", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "ZIP paketini indir", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^tracelens-.*\.zip$/);
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.includes(Buffer.from("Reproduce on Linux"))).toBe(false);
  await page
    .getByRole("button", { name: "İncelemeyi arşivle", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Browser evidence workflow",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Arşiv", exact: true }).click();
  await page
    .getByRole("button", { name: /Browser evidence workflow Local/ })
    .click();
  await page
    .getByRole("button", { name: "Arşivden çıkar", exact: true })
    .click();
  await page
    .getByRole("button", { name: /İncelemeler/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /Browser evidence workflow Local/ }),
  ).toBeVisible();
});

test("small screens keep controls usable and reject malformed JSON", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Yeni inceleme", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: /JSON metni yapıştır/ }).click();
  await page.getByLabel("Kaynak JSON", { exact: true }).fill("{invalid");
  await page.getByLabel("Hedef JSON", { exact: true }).fill("{}");
  await page.getByRole("button", { name: "Karşılaştır", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("button", { name: "Örnek veriyi kullan", exact: true })
    .click();
  await page
    .getByLabel("İnceleme adı", { exact: true })
    .fill("Mobile evidence workflow");
  await page.getByRole("button", { name: "Karşılaştır", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Mobile evidence workflow",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workbench-mobile.png",
    fullPage: false,
  });
});
