export type ParsedSection = {
  title: string;
  contentHtml: string;
  photoPrefix?: string;
  isTips: boolean;
};

export type ParsedBody = {
  sections: ParsedSection[];
  tips: ParsedSection | null;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function detectPhotoPrefix(title: string, contentHtml: string): string | undefined {
  const fromContent = contentHtml.match(/照片前缀[：:]\s*([^\s<，,。.]+)/);
  if (fromContent) return fromContent[1].trim();

  const fromTitle = title.match(/^(.+?)(?:板块|版块|活动|记录)?$/);
  if (fromTitle && fromTitle[1].length <= 12) return fromTitle[1].trim();
  return undefined;
}

function isTipsTitle(title: string): boolean {
  return /(家长|提示|家园|tips|home\s*school)/i.test(title);
}

function splitByHeadings(html: string): { title: string; contentHtml: string }[] {
  const chunks = html.split(/(?=<h[23][^>]*>)/i).map((c) => c.trim()).filter(Boolean);
  const out: { title: string; contentHtml: string }[] = [];

  for (const chunk of chunks) {
    const m = chunk.match(/^<h[23][^>]*>([\s\S]*?)<\/h[23]>([\s\S]*)$/i);
    if (m) {
      out.push({ title: stripTags(m[1]), contentHtml: m[2].trim() });
      continue;
    }
    out.push({ title: "本周记录", contentHtml: chunk });
  }
  return out;
}

function splitByStrongBlocks(html: string): { title: string; contentHtml: string }[] {
  const chunks = html.split(/(?=<p>\s*<strong>)/i).map((c) => c.trim()).filter(Boolean);
  if (chunks.length <= 1) return [{ title: "本周记录", contentHtml: html }];

  return chunks.map((chunk) => {
    const m = chunk.match(/^<p>\s*<strong>([\s\S]*?)<\/strong>\s*(?:<\/p>|(?:<\/strong>\s*([^<]*?)<\/p>))([\s\S]*)$/i);
    if (!m) return { title: "本周记录", contentHtml: chunk };
    const inlineTail = (m[2] ?? "").trim();
    const rest = (m[3] ?? "").trim();
    const title = stripTags(m[1] + inlineTail);
    return { title, contentHtml: rest };
  });
}

/** Parse rich-editor body HTML into sections + optional tips block. */
export function parseBodyHtml(bodyHtml: string): ParsedBody {
  const html = bodyHtml.trim();
  if (!html) return { sections: [], tips: null };

  const hasHeading = /<h[23][^>]*>/i.test(html);
  const blocks = hasHeading ? splitByHeadings(html) : splitByStrongBlocks(html);

  const sections: ParsedSection[] = [];
  let tips: ParsedSection | null = null;

  for (const block of blocks) {
    const title = block.title || "本周记录";
    const entry: ParsedSection = {
      title,
      contentHtml: block.contentHtml || "<p></p>",
      photoPrefix: detectPhotoPrefix(title, block.contentHtml),
      isTips: isTipsTitle(title),
    };
    if (entry.isTips) {
      tips = entry;
    } else {
      sections.push(entry);
    }
  }

  if (sections.length === 0 && tips) {
    return { sections: [], tips };
  }

  return { sections, tips };
}

export function groupPhotoKeysByPrefix(
  photoLogicalNames: string[],
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const name of photoLogicalNames) {
    const base = name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
    const m = base.match(/^(.+?)(\d+)$/);
    if (!m) continue;
    const prefix = m[1];
    const index = parseInt(m[2], 10);
    const list = map.get(prefix) ?? [];
    list.push(index);
    map.set(prefix, list);
  }
  for (const [prefix, indices] of map) {
    map.set(
      prefix,
      [...indices].sort((a, b) => a - b),
    );
  }
  return map;
}

export function resolveSectionPhotoIndices(
  section: ParsedSection,
  sections: ParsedSection[],
  photoByPrefix: Map<string, number[]>,
  usedPrefixes: Set<string>,
): { prefix: string; indices: number[] } | null {
  const candidates = [
    section.photoPrefix,
    ...Array.from(photoByPrefix.keys()).filter(
      (p) =>
        section.title.includes(p) ||
        section.contentHtml.includes(p) ||
        section.contentHtml.includes(`${p}1.`),
    ),
  ].filter(Boolean) as string[];

  for (const prefix of candidates) {
    if (usedPrefixes.has(prefix)) continue;
    const indices = photoByPrefix.get(prefix);
    if (indices?.length) {
      usedPrefixes.add(prefix);
      return { prefix, indices };
    }
  }

  for (const [prefix, indices] of photoByPrefix) {
    if (usedPrefixes.has(prefix) || !indices.length) continue;
    usedPrefixes.add(prefix);
    return { prefix, indices };
  }

  return null;
}
