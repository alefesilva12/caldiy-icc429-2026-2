import { prisma } from "@calcom/prisma";
import type { Prisma } from "@calcom/prisma/client";
import { TRPCError } from "@trpc/server";
import type { TrpcSessionUser } from "../../../types";
import { getCredentialKeyValidatorLoader } from "./credentialKeyValidators";
import type { TUpdateAppCredentialsInputSchema } from "./updateAppCredentials.schema";

export type UpdateAppCredentialsOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
  };
  input: TUpdateAppCredentialsInputSchema;
};

const isJsonObject = (value: unknown): value is Prisma.JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const handleCustomValidations = async ({
  input,
  appId,
}: UpdateAppCredentialsOptions & { appId: string }) => {
  const loadValidator = getCredentialKeyValidatorLoader(appId);
  // Keys are only written after a server-side check: an app without a validator
  // cannot have its key replaced through this route (#30566).
  if (!loadValidator) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Credential keys of this app cannot be updated",
    });
  }
  try {
    const validator = await loadValidator();
    return await validator({ input });
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Validation failed",
    });
  }
};

export const updateAppCredentialsHandler = async ({ ctx, input }: UpdateAppCredentialsOptions) => {
  const { user } = ctx;

  // Find user credential
  const credential = await prisma.credential.findFirst({
    where: {
      id: input.credentialId,
      userId: user.id,
    },
    select: { id: true, appId: true, key: true },
  });
  // Check if credential exists
  if (!credential) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Could not find credential ${input.credentialId}`,
    });
  }

  const validatedKeys = await handleCustomValidations({ ctx, input, appId: credential.appId || "" });

  // A stored key that is not an object (e.g. an encrypted string) must not be spread
  let storedKey: Prisma.JsonObject = {};
  if (isJsonObject(credential.key)) {
    storedKey = credential.key;
  }

  const updated = await prisma.credential.update({
    where: {
      id: credential.id,
    },
    data: {
      key: {
        ...storedKey,
        ...(validatedKeys as Prisma.JsonObject),
      },
    },
    select: { id: true },
  });

  return !!updated;
};
