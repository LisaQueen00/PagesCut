import type { Page } from "@/types/domain";

export function getPageBucket(page: Page) {
  if (page.pageKind === "content") {
    return "content";
  }

  if (page.pageRole === "cover" || page.pageRole === "toc") {
    return "front";
  }

  return "rear";
}

export function sortPagesForFinalOrder(pages: Page[]) {
  return pages.slice().sort((a, b) => {
    const bucketOrder = { front: 0, content: 1, rear: 2 } as const;
    const aBucket = getPageBucket(a);
    const bBucket = getPageBucket(b);

    if (aBucket !== bBucket) {
      return bucketOrder[aBucket] - bucketOrder[bBucket];
    }

    if (aBucket === "front") {
      const roleOrder = { cover: 0, toc: 1 } as const;
      const aRole = a.pageRole === "cover" || a.pageRole === "toc" ? a.pageRole : "toc";
      const bRole = b.pageRole === "cover" || b.pageRole === "toc" ? b.pageRole : "toc";
      return roleOrder[aRole] - roleOrder[bRole] || a.index - b.index;
    }

    return a.index - b.index;
  });
}

export function getPageDisplayLabel(page: Page, allPages: Page[]) {
  const bucket = getPageBucket(page);
  const bucketPages = sortPagesForFinalOrder(allPages).filter((item) => getPageBucket(item) === bucket);
  const number = Math.max(
    1,
    bucketPages.findIndex((item) => item.id === page.id) + 1,
  );
  const prefix = bucket === "front" ? "B" : bucket === "rear" ? "T" : "P";
  return `${prefix}${number}`;
}
