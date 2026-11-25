import { prisma } from "@calcom/prisma";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateAppCredentialsOptions } from "./updateAppCredentials.handler";
import { updateAppCredentialsHandler } from "./updateAppCredentials.handler";

/**
 * Characterization tests for viewer.apps.updateAppCredentials (#30566).
 *
 * They pin down what the handler does at commit ae027bb, before any change.
 * Tests named "[current] ..." describe the defect reported in #30566 and are
 * inverted by the commit that fixes it. Every other test describes behavior
 * that must survive the change unchanged.
 */

const { paypalValidator } = vi.hoisted(() => ({ paypalValidator: vi.fn() }));

vi.mock("@calcom/prisma", () => ({
  prisma: {
    credential: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// PayPal's real validator calls the PayPal API, so it is replaced by a spy.
vi.mock("@calcom/paypal/lib/updateAppCredentials.validator", () => ({
  default: paypalValidator,
}));

const findFirst = prisma.credential.findFirst as unknown as ReturnType<typeof vi.fn>;
const update = prisma.credential.update as unknown as ReturnType<typeof vi.fn>;

const ctx = { user: { id: 1 } } as unknown as UpdateAppCredentialsOptions["ctx"];

/** Keys accepted by each app's own schema in packages/app-store/<app>/lib/. */
const VALID_KEYS = {
  btcpayserver: {
    serverUrl: "https://btcpay.example.com",
    storeId: "store-1",
    apiKey: "api-key",
    webhookSecret: "webhook-secret",
  },
  alby: {
    account_id: "acc-1",
    account_email: "owner@example.com",
    account_lightning_address: "owner@getalby.com",
    webhook_endpoint_id: "endpoint-1",
    webhook_endpoint_secret: "endpoint-secret",
  },
  hitpay: {
    prod: { apiKey: "api-key", saltKey: "salt-key" },
    isSandbox: false,
  },
} as const;

/** Keys each app's schema rejects: a missing field or a field of the wrong type. */
const INVALID_KEYS = [
  {
    appId: "btcpayserver",
    problem: "missing webhookSecret",
    key: { ...VALID_KEYS.btcpayserver, webhookSecret: undefined },
  },
  { appId: "alby", problem: "account_id is a number", key: { ...VALID_KEYS.alby, account_id: 123 } },
  { appId: "hitpay", problem: "missing isSandbox", key: { prod: VALID_KEYS.hitpay.prod } },
] as const;

const SCHEMA_APPS = Object.keys(VALID_KEYS) as (keyof typeof VALID_KEYS)[];

const call = (key: Record<string, unknown>) =>
  updateAppCredentialsHandler({ ctx, input: { credentialId: 10, key } });

/** Returns the `key` object the handler asked Prisma to persist. */
const persistedKey = () => update.mock.calls[0][0].data.key as Record<string, unknown>;

describe("updateAppCredentials — characterization (behavior at ae027bb)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({ id: 10 });
  });

  describe("lookup and ownership", () => {
    it("looks the credential up by id AND by the session user id", async () => {
      findFirst.mockResolvedValue({ id: 10, appId: "btcpayserver", key: {} });

      await call({ ...VALID_KEYS.btcpayserver });

      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 10, userId: 1 } }));
    });

    it("throws BAD_REQUEST and writes nothing when the credential is not found for this user", async () => {
      findFirst.mockResolvedValue(null);

      await expect(call({ ...VALID_KEYS.btcpayserver })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("paypal (custom validator)", () => {
    it("passes the input to the PayPal validator and merges what it returns into the stored key", async () => {
      findFirst.mockResolvedValue({ id: 10, appId: "paypal", key: { client_id: "old", legacy: "keep" } });
      paypalValidator.mockResolvedValue({ client_id: "new", secret_key: "s", webhook_id: "w" });

      const key = { client_id: "new", secret_key: "s" };
      const result = await call(key);

      expect(result).toBe(true);
      expect(paypalValidator).toHaveBeenCalledWith({ input: { credentialId: 10, key } });
      expect(persistedKey()).toEqual({ client_id: "new", secret_key: "s", webhook_id: "w", legacy: "keep" });
    });

    it("turns a validator error into BAD_REQUEST with its message and writes nothing", async () => {
      findFirst.mockResolvedValue({ id: 10, appId: "paypal", key: {} });
      paypalValidator.mockRejectedValue(new Error("Provided credentials failed to authenticate"));

      const result = call({ client_id: "x", secret_key: "y" });

      await expect(result).rejects.toBeInstanceOf(TRPCError);
      await expect(result).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Provided credentials failed to authenticate",
      });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("btcpayserver, alby and hitpay", () => {
    it.each(SCHEMA_APPS)("%s: merges a valid key into the stored key and returns true", async (appId) => {
      findFirst.mockResolvedValue({ id: 10, appId, key: { legacy: "keep" } });

      const result = await call({ ...VALID_KEYS[appId] });

      expect(result).toBe(true);
      expect(persistedKey()).toEqual({ legacy: "keep", ...VALID_KEYS[appId] });
    });

    it.each(INVALID_KEYS)("[current] $appId: stores a key its schema rejects ($problem)", async ({
      appId,
      key,
    }) => {
      findFirst.mockResolvedValue({ id: 10, appId, key: {} });

      await call({ ...key });

      expect(update).toHaveBeenCalledTimes(1);
    });

    it("[current] stores fields that are not in the app's schema", async () => {
      findFirst.mockResolvedValue({ id: 10, appId: "btcpayserver", key: {} });

      await call({ ...VALID_KEYS.btcpayserver, extra: "not in schema" });

      expect(persistedKey()).toEqual({ ...VALID_KEYS.btcpayserver, extra: "not in schema" });
    });

    it("[current] spreads a stored key that is not an object, character by character", async () => {
      findFirst.mockResolvedValue({ id: 10, appId: "btcpayserver", key: "abc" });

      await call({ ...VALID_KEYS.btcpayserver });

      expect(persistedKey()).toEqual({ "0": "a", "1": "b", "2": "c", ...VALID_KEYS.btcpayserver });
    });
  });

  describe("apps without a server-side schema", () => {
    it("[current] other apps: corrupts a key stored as an encrypted string", async () => {
      // caldavcalendar, applecalendar, ics-feedcalendar and exchange store symmetricEncrypt(...) strings
      findFirst.mockResolvedValue({ id: 10, appId: "caldavcalendar", key: "enc" });

      await call({ anything: "goes" });

      expect(persistedKey()).toEqual({ "0": "e", "1": "n", "2": "c", anything: "goes" });
    });

    it("[current] credential without appId: stores the key without any validation", async () => {
      findFirst.mockResolvedValue({ id: 10, appId: null, key: {} });

      await call({ anything: "goes" });

      expect(persistedKey()).toEqual({ anything: "goes" });
    });
  });
});
