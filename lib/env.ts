/**
 * Centralized, typed access to environment configuration. Reading env here
 * (instead of scattering `process.env` lookups) keeps defaults and validation
 * in one place.
 */

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export type AppEnv = {
  openAiApiKey: string | null;
  openAiModel: string;
  appUrl: string;
};

function readEnv(): AppEnv {
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const openAiModel = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return { openAiApiKey, openAiModel, appUrl };
}

export const env = readEnv();

/** Whether the optional LLM analysis layer is configured. */
export function isLlmEnabled(): boolean {
  return env.openAiApiKey !== null;
}
