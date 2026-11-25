import type { TUpdateAppCredentialsInputSchema } from "./updateAppCredentials.schema";

type CredentialKeyValidatorLoader = () => Promise<CredentialKeyValidator>;

// Loaded on demand so that an app's code is only imported when its credential is updated.
const validatorLoaders: Map<string, CredentialKeyValidatorLoader> = new Map([
  [
    "paypal",
    async (): Promise<CredentialKeyValidator> =>
      (await import("@calcom/paypal/lib/updateAppCredentials.validator")).default,
  ],
]);

/** Validates the key sent to viewer.apps.updateAppCredentials and returns what should be stored. */
export type CredentialKeyValidator = (args: { input: TUpdateAppCredentialsInputSchema }) => Promise<unknown>;

/** Returns the loader of the server-side validator registered for `appId`, if any. */
export const getCredentialKeyValidatorLoader = (appId: string): CredentialKeyValidatorLoader | undefined =>
  validatorLoaders.get(appId);
