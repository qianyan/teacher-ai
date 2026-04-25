import type { GenerateInput } from "@/lib/agent/generate-dynamic-body";

export type GenerateJobStatus = "queued" | "running" | "completed" | "failed";

export type GenerateJobRecord = {
  id: string;
  status: GenerateJobStatus;
  input: GenerateInput;
  createdAt: number;
  updatedAt: number;
  dynamicBodyHtml?: string;
  fullHtml?: string;
  error?: string;
};

type GenerateResult = {
  dynamicBodyHtml: string;
  fullHtml: string;
};

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 200;

function getStore(): Map<string, GenerateJobRecord> {
  const g = globalThis as typeof globalThis & {
    __teacherAiGenerateJobs?: Map<string, GenerateJobRecord>;
  };
  if (!g.__teacherAiGenerateJobs) {
    g.__teacherAiGenerateJobs = new Map<string, GenerateJobRecord>();
  }
  return g.__teacherAiGenerateJobs;
}

function cleanupStore(store: Map<string, GenerateJobRecord>): void {
  const now = Date.now();
  for (const [id, job] of store.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) {
      store.delete(id);
    }
  }
  if (store.size <= MAX_JOBS) return;
  const all = [...store.values()].sort((a, b) => a.updatedAt - b.updatedAt);
  const overflow = store.size - MAX_JOBS;
  for (let i = 0; i < overflow; i++) {
    store.delete(all[i].id);
  }
}

export function createGenerateJob(input: GenerateInput): GenerateJobRecord {
  const store = getStore();
  cleanupStore(store);
  const now = Date.now();
  const job: GenerateJobRecord = {
    id: crypto.randomUUID(),
    status: "queued",
    input,
    createdAt: now,
    updatedAt: now,
  };
  store.set(job.id, job);
  return job;
}

export function getGenerateJob(id: string): GenerateJobRecord | null {
  const store = getStore();
  cleanupStore(store);
  return store.get(id) ?? null;
}

export async function runGenerateJob(
  jobId: string,
  runner: (input: GenerateInput) => Promise<GenerateResult>,
): Promise<void> {
  const store = getStore();
  const job = store.get(jobId);
  if (!job) return;
  job.status = "running";
  job.updatedAt = Date.now();
  store.set(job.id, job);
  try {
    const result = await runner(job.input);
    job.status = "completed";
    job.dynamicBodyHtml = result.dynamicBodyHtml;
    job.fullHtml = result.fullHtml;
    job.error = undefined;
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Generate failed";
  } finally {
    job.updatedAt = Date.now();
    store.set(job.id, job);
  }
}
