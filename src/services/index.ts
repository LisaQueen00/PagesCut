import { MockOutlineProvider, MockPageGenerationProvider, MockSearchProvider } from "@/services/providers/mockProviders";
import type { WorkType } from "@/types/domain";

const outlineProvider = new MockOutlineProvider();

export const services = {
  outlineProvider,
  pageGenerationProvider: new MockPageGenerationProvider(),
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
