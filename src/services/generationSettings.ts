import type { GenerationProviderConfig, GenerationProviderConfigSource } from "@/services/providers/types";

interface GenerationProviderConfigOverride {
  providerType?: GenerationProviderConfig["providerType"];
  endpoint?: string;
  model?: string;
  source?: GenerationProviderConfigSource;
}

const workspaceDefaultGenerationConfig: GenerationProviderConfig = {
  providerType: "ollama-local",
  endpoint: "",
  model: "",
  source: "workspace-default",
  options: {
    temperature: 0.35,
    topP: 0.85,
    numPredict: 1200,
  },
  truthfulnessPolicy: {
    requireGroundedOutput: true,
    allowUngroundedSpecificFacts: false,
    forbiddenSpecificFactKinds: ["company", "model", "money", "percentage", "ranking", "date", "metric"],
  },
};

function getEnvironmentGenerationConfig(): GenerationProviderConfigOverride {
  const endpoint = import.meta.env.VITE_PAGESCUT_OLLAMA_ENDPOINT;
  const model = import.meta.env.VITE_PAGESCUT_OLLAMA_MODEL;

  if (!endpoint && !model) {
    return {};
  }

  return {
    endpoint,
    model,
    source: "environment",
  };
}

export function createGenerationProviderConfig(overrides: GenerationProviderConfigOverride = {}): GenerationProviderConfig {
  const envConfig = getEnvironmentGenerationConfig();
  const merged = {
    ...workspaceDefaultGenerationConfig,
    ...envConfig,
    ...overrides,
  };

  return {
    ...merged,
    endpoint: merged.endpoint || workspaceDefaultGenerationConfig.endpoint,
    model: merged.model || workspaceDefaultGenerationConfig.model,
    providerType: merged.providerType || workspaceDefaultGenerationConfig.providerType,
    source: overrides.source ?? envConfig.source ?? workspaceDefaultGenerationConfig.source,
    options: workspaceDefaultGenerationConfig.options,
    truthfulnessPolicy: workspaceDefaultGenerationConfig.truthfulnessPolicy,
  };
}

// Current single workspace-level config. Page/admin config can call
// createGenerationProviderConfig(...) with scoped overrides without changing
// the provider or overview business chain.
export const generationProviderConfig = createGenerationProviderConfig();
