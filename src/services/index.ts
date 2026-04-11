import { MockOutlineProvider, MockPageGenerationProvider, MockSearchProvider } from "@/services/providers/mockProviders";
import { generationProviderConfig } from "@/services/generationSettings";
import { OllamaGenerationProvider } from "@/services/providers/ollamaGenerationProvider";
import type { WorkType } from "@/types/domain";

const outlineProvider = new MockOutlineProvider();

export const services = {
  outlineProvider,
  pageGenerationProvider: new MockPageGenerationProvider(),
  generationProvider: new OllamaGenerationProvider(generationProviderConfig),
  generationProviderConfig,
  searchProvider: new MockSearchProvider(),
  async createTaskFromPrompt(prompt: string, workType: WorkType) {
    const normalized = await outlineProvider.normalizeTaskInput(
      {
        rawPrompt: prompt,
        workType,
      },
      { stage: "outline" },
    );

    return outlineProvider.generateInitialOutline(normalized, { stage: "outline" });
  },
};
