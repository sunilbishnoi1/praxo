import { z } from "zod";

import { PROVIDER_IDS } from "./types";

const optionalStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1)
);

const optionalUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().url()
);

export const providerIdSchema = z.enum(PROVIDER_IDS);

export const providerConfigSchema = z.object({
  apiKey: optionalStringSchema.optional(),
  baseUrl: optionalUrlSchema.optional(),
  model: optionalStringSchema.optional(),
});
