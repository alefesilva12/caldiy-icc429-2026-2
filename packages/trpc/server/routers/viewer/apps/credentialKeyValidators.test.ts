import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { appsWithCredentialKeyValidator, getCredentialKeyValidatorLoader } from "./credentialKeyValidators";

// PayPal's real validator calls the PayPal API; it is not exercised here.
vi.mock("@calcom/paypal/lib/updateAppCredentials.validator", () => ({ default: vi.fn() }));

// The repository root is six levels above this folder.
const SETUP_SCREENS_DIR = join(__dirname, "../../../../../../apps/web/components/apps");

/** Apps whose Setup screen calls viewer.apps.updateAppCredentials. */
const appsWhoseSetupUpdatesCredentials = (): string[] =>
  readdirSync(SETUP_SCREENS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((app) => {
      try {
        return readFileSync(join(SETUP_SCREENS_DIR, app, "Setup.tsx"), "utf8").includes(
          "viewer.apps.updateAppCredentials"
        );
      } catch {
        return false;
      }
    });

describe("credentialKeyValidators", () => {
  it("registers a server-side validator for every app whose Setup screen updates credential keys", () => {
    const setupApps = appsWhoseSetupUpdatesCredentials();

    expect(setupApps.length).toBeGreaterThan(0);
    expect([...appsWithCredentialKeyValidator()].sort()).toEqual([...setupApps].sort());
  });

  it("has no validator for apps that store their key some other way", () => {
    expect(getCredentialKeyValidatorLoader("caldavcalendar")).toBeUndefined();
    expect(getCredentialKeyValidatorLoader("")).toBeUndefined();
  });

  it("validates with the app's own schema: drops undeclared fields, rejects missing ones", async () => {
    const loadValidator = getCredentialKeyValidatorLoader("btcpayserver");
    if (!loadValidator) throw new Error("btcpayserver must have a validator");
    const validate = await loadValidator();
    const key = { serverUrl: "https://btcpay.example.com", storeId: "s", apiKey: "a", webhookSecret: "w" };

    await expect(validate({ input: { credentialId: 1, key: { ...key, extra: 1 } } })).resolves.toEqual(key);
    await expect(validate({ input: { credentialId: 1, key: { storeId: "s" } } })).rejects.toThrow(
      "Invalid credential key"
    );
  });
});
