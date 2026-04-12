import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { OutlineProvider } from "@/services/providers/types";
import type { Page, Task, WorkType } from "@/types/domain";

const OutlineState = Annotation.Root({
  rawPrompt: Annotation<string>,
  workType: Annotation<WorkType>,
  normalizedInstruction: Annotation<string>,
  desiredPageCount: Annotation<number | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  task: Annotation<Task | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  pages: Annotation<Page[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
});

export async function runOutlineWorkflow(provider: OutlineProvider, rawPrompt: string, workType: WorkType) {
  const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", "You normalize task requests for a page-based creation workspace."],
    ["human", "{prompt}"],
  ]);

  const graph = new StateGraph(OutlineState)
    .addNode("normalize", async (state) => {
      const promptValue = await promptTemplate.format({ prompt: state.rawPrompt });
      const normalized = await provider.normalizeTaskInput(
        {
          rawPrompt: state.rawPrompt,
          workType: state.workType,
        },
        { stage: "outline" },
      );

      return {
        normalizedInstruction: `${normalized.normalizedInstruction}\n${promptValue.toString()}`,
        desiredPageCount: normalized.desiredPageCount ?? null,
      };
    })
    .addNode("generateOutline", async (state) => {
      const result = await provider.generateInitialOutline(
        {
          taskType: state.workType,
          prompt: state.rawPrompt,
          normalizedInstruction: state.normalizedInstruction,
          desiredPageCount: state.desiredPageCount,
        },
        { stage: "outline" },
      );

      return {
        task: result.task,
        pages: result.pages,
      };
    })
    .addEdge(START, "normalize")
    .addEdge("normalize", "generateOutline")
    .addEdge("generateOutline", END);

  const app = graph.compile();
  const result = await app.invoke({
    rawPrompt,
    workType,
    normalizedInstruction: "",
    task: null,
    pages: [],
  });

  if (!result.task) {
    throw new Error("Outline workflow did not produce a task");
  }

  return {
    task: result.task,
    pages: result.pages,
  };
}
