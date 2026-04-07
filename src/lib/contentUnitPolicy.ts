import type { UserProvidedContentBlock } from "@/types/domain";
import type {
  PageContentPlanAssembly,
  PageContentSlotBinding,
  PageContentPolicyUnitType,
  PageContentSourceRef,
  PageContentUnitBinding,
  PageContentUnitOutcome,
  PageContentUnitPolicy,
} from "@/types/pageModel";

const CONTENT_UNIT_POLICIES: Record<Exclude<PageContentPolicyUnitType, "text">, PageContentUnitPolicy> = {
  imageTextPair: {
    unitType: "imageTextPair",
    relation: "paired",
    fillRule: "all-required-slots",
    slots: [
      {
        slotType: "image",
        required: true,
        missingReason: "missing-image-source",
      },
      {
        slotType: "text",
        required: true,
        missingReason: "missing-text-source",
      },
    ],
  },
  chartExplanationPair: {
    unitType: "chartExplanationPair",
    relation: "paired",
    fillRule: "all-required-slots",
    slots: [
      {
        slotType: "chart",
        required: true,
        missingReason: "missing-chart-source",
      },
      {
        slotType: "explanation",
        required: true,
        missingReason: "missing-explanation-source",
      },
    ],
  },
};
const TEXT_UNIT_POLICY: PageContentUnitPolicy = {
  unitType: "text",
  relation: "standalone",
  fillRule: "all-required-slots",
  slots: [
    {
      slotType: "text",
      required: true,
      missingReason: "missing-text-source",
    },
  ],
};

function createUnitId(unitType: string, index: number) {
  return `${unitType}-${index + 1}`;
}

function createSlotId(unitId: string, slotType: PageContentSlotBinding["slotType"]) {
  return `${unitId}:${slotType}`;
}

function clampText(value: string, limit: number, fallback = "") {
  const trimmed = value.trim() || fallback;
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}

function createSourceRef(slotType: PageContentSlotBinding["slotType"], block: UserProvidedContentBlock, index: number): PageContentSourceRef | undefined {
  switch (slotType) {
    case "image":
      if (block.type !== "image") return undefined;
      return {
        sourceId: block.id,
        sourceKind: "image-source",
        label: block.caption || block.altText || `image source ${index + 1}`,
      };
    case "text":
      if (block.type !== "text") return undefined;
      return {
        sourceId: block.id,
        sourceKind: "text-source",
        label: clampText(block.text, 26, `text source ${index + 1}`),
      };
    case "chart":
      if (block.type !== "chart_desc") return undefined;
      return {
        sourceId: block.id,
        sourceKind: "chart-source",
        label: clampText(block.description, 26, `chart source ${index + 1}`),
      };
    case "explanation":
      if (block.type !== "text") return undefined;
      return {
        sourceId: block.id,
        sourceKind: "explanation-source",
        label: clampText(block.text, 26, `explanation source ${index + 1}`),
      };
    default:
      return undefined;
  }
}

function getOutcome(slots: PageContentSlotBinding[]): PageContentUnitOutcome {
  const requiredSlots = slots.filter((slot) => slot.required);
  const filledRequiredSlots = requiredSlots.filter((slot) => slot.filled);
  if (requiredSlots.length > 0 && filledRequiredSlots.length === requiredSlots.length) {
    return "filled";
  }
  if (filledRequiredSlots.length > 0) {
    return "partial";
  }
  return "unfilled";
}

function buildSlotBinding(
  slotPolicy: PageContentUnitPolicy["slots"][number],
  unitId: string,
  unitIndex: number,
  source?: PageContentSourceRef,
): PageContentSlotBinding {
  const bound = Boolean(source);
  return {
    unitId,
    slotId: createSlotId(unitId, slotPolicy.slotType),
    slotKey: `${slotPolicy.slotType}-${unitIndex + 1}`,
    slotType: slotPolicy.slotType,
    required: slotPolicy.required,
    bound,
    filled: bound,
    source,
    missingReason: source ? undefined : slotPolicy.missingReason,
  };
}

function getSourcePools(unitType: Exclude<PageContentPolicyUnitType, "text">, blocks: UserProvidedContentBlock[]) {
  if (unitType === "imageTextPair") {
    return {
      image: blocks.filter((block) => block.type === "image"),
      text: blocks.filter((block) => block.type === "text"),
    };
  }

  return {
    chart: blocks.filter((block) => block.type === "chart_desc"),
    explanation: blocks.filter((block) => block.type === "text"),
  };
}

export function getContentUnitPolicy(unitType: Exclude<PageContentPolicyUnitType, "text">): PageContentUnitPolicy {
  return CONTENT_UNIT_POLICIES[unitType];
}

export function getTextUnitPolicy(): PageContentUnitPolicy {
  return TEXT_UNIT_POLICY;
}

export function resolveUnitAssemblyFromPolicy(
  unitType: Exclude<PageContentPolicyUnitType, "text">,
  blocks: UserProvidedContentBlock[],
  resolvedCount: number,
): PageContentPlanAssembly {
  const policy = getContentUnitPolicy(unitType);
  const pools = getSourcePools(unitType, blocks);

  const resolvedUnits: PageContentUnitBinding[] = Array.from({ length: resolvedCount }, (_, index) => {
    const unitId = createUnitId(unitType, index);
    const slots = policy.slots.map((slotPolicy) => {
      const sourceBlock = pools[slotPolicy.slotType as keyof typeof pools]?.[index];
      const source = sourceBlock ? createSourceRef(slotPolicy.slotType, sourceBlock, index) : undefined;
      return buildSlotBinding(slotPolicy, unitId, index, source);
    });

    return {
      unitId,
      unitType,
      outcome: getOutcome(slots),
      slots,
    };
  });

  const outcomeSummary = summarizeUnitOutcomes(resolvedUnits);
  return {
    fillRule: policy.fillRule,
    resolvedUnits,
    partialCount: outcomeSummary.partialCount,
    unfilledCount: outcomeSummary.unfilledCount,
  };
}

export function resolveTextUnitAssemblyFromTextSources(texts: { id: string; label: string }[], resolvedCount: number): PageContentPlanAssembly {
  const policy = getTextUnitPolicy();
  const resolvedUnits: PageContentUnitBinding[] = Array.from({ length: resolvedCount }, (_, index) => {
    const unitId = createUnitId("text", index);
    const textSource = texts[index];
    const slots = policy.slots.map((slotPolicy) =>
      buildSlotBinding(
        slotPolicy,
        unitId,
        index,
        textSource
          ? {
              sourceId: textSource.id,
              sourceKind: "text-source",
              label: textSource.label,
            }
          : undefined,
      ),
    );

    return {
      unitId,
      unitType: "text",
      outcome: getOutcome(slots),
      slots,
    };
  });

  const outcomeSummary = summarizeUnitOutcomes(resolvedUnits);
  return {
    fillRule: policy.fillRule,
    resolvedUnits,
    partialCount: outcomeSummary.partialCount,
    unfilledCount: outcomeSummary.unfilledCount,
  };
}

export function summarizeUnitOutcomes(bindings: PageContentUnitBinding[]) {
  return bindings.reduce(
    (acc, binding) => {
      if (binding.outcome === "filled") {
        acc.filledCount += 1;
      } else if (binding.outcome === "partial") {
        acc.partialCount += 1;
      } else {
        acc.unfilledCount += 1;
      }
      return acc;
    },
    {
      filledCount: 0,
      partialCount: 0,
      unfilledCount: 0,
    },
  );
}
