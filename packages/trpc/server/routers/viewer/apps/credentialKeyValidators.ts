import type { ZodTypeAny } from "zod";
import type { TUpdateAppCredentialsInputSchema } from "./updateAppCredentials.schema";

type CredentialKeyValidatorLoader = () => Promise<CredentialKeyValidator>;

/**
 * Builds a validator from the app's own key schema. Fields the schema does not
 * declare are dropped by Zod; a missing field or a wrong type is an error.
 */
const fromSchema =
  (loadSchema: () => Promise<ZodTypeAny>): CredentialKeyValidatorLoader =>
  async (): Promise<CredentialKeyValidator> => {
    const schema = await loadSchema();
    const validator: CredentialKeyValidator = async ({
      input,
    }: {
      input: TUpdateAppCredentialsInputSchema;
    }): Promise<unknown> => {
      const parsed = schema.safeParse(input.key);
      if (!parsed.success) {
        throw new Error("Invalid credential key");
      }
      return parsed.data;
    };
    return validator;
  };

// Loaded on demand so that an app's code is only imported when its credential is updated.
const validatorLoaders: Map<string, CredentialKeyValidatorLoader> = new Map([
  [
    "paypal",
    async (): Promise<CredentialKeyValidator> =>
      (await import("@calcom/paypal/lib/updateAppCredentials.validator")).default,
  ],
  [
    "btcpayserver",
    fromSchema(
      async () =>
        (await import("@calcom/app-store/btcpayserver/lib/btcpayCredentialKeysSchema"))
          .btcpayCredentialKeysSchema
    ),
  ],
  [
    "alby",
    fromSchema(
      async () =>
        (await import("@calcom/app-store/alby/lib/albyCredentialKeysSchema")).albyCredentialKeysSchema
    ),
  ],
  [
    "hitpay",
    fromSchema(
      async () =>
        (await import("@calcom/app-store/hitpay/lib/hitpayCredentialKeysSchema")).hitpayCredentialKeysSchema
    ),
  ],
]);

/** Validates the key sent to viewer.apps.updateAppCredentials and returns what should be stored. */
export type CredentialKeyValidator = (args: { input: TUpdateAppCredentialsInputSchema }) => Promise<unknown>;

/** Returns the loader of the server-side validator registered for `appId`, if any. */
export const getCredentialKeyValidatorLoader = (appId: string): CredentialKeyValidatorLoader | undefined =>
  validatorLoaders.get(appId);

/** Slugs of the apps whose credential keys can be updated through viewer.apps.updateAppCredentials. */
export const appsWithCredentialKeyValidator = (): string[] => [...validatorLoaders.keys()];
