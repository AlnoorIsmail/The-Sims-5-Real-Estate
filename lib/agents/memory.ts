import type { MemoryRecordMetadata } from "@/lib/sim/types";
import type { HarnessConfig, RetrievedMemory } from "./types";

export interface MemoryStore {
  collectionName(agentId: string): string;
  write(
    agentId: string,
    document: string,
    metadata: MemoryRecordMetadata,
    writeId: string
  ): Promise<void>;
  query(
    agentId: string,
    queryText: string,
    filters?: Partial<MemoryRecordMetadata>,
    limit?: number
  ): Promise<RetrievedMemory[]>;
}

/** Local fallback when Chroma/Gemini are unavailable. */
export class InMemoryMemoryStore implements MemoryStore {
  private collections = new Map<
    string,
    Array<{ id: string; document: string; metadata: MemoryRecordMetadata }>
  >();
  private appliedWrites = new Set<string>();

  collectionName(agentId: string): string {
    return agentId === "game_master"
      ? "gm_world_memory"
      : `agent_${agentId}_memory`;
  }

  async write(
    agentId: string,
    document: string,
    metadata: MemoryRecordMetadata,
    writeId: string
  ): Promise<void> {
    if (this.appliedWrites.has(writeId)) return;
    this.appliedWrites.add(writeId);

    const name = this.collectionName(agentId);
    const bucket = this.collections.get(name) ?? [];
    bucket.push({ id: writeId, document, metadata });
    this.collections.set(name, bucket);
  }

  async query(
    agentId: string,
    queryText: string,
    filters?: Partial<MemoryRecordMetadata>,
    limit = 8
  ): Promise<RetrievedMemory[]> {
    const name = this.collectionName(agentId);
    const bucket = this.collections.get(name) ?? [];
    const tokens = queryText.toLowerCase().split(/\s+/).filter(Boolean);

    const scored = bucket
      .filter((entry) => matchesFilters(entry.metadata, filters))
      .map((entry) => ({
        id: entry.id,
        document: entry.document,
        metadata: entry.metadata,
        score: scoreDocument(entry.document, tokens, entry.metadata.importance),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }
}

function matchesFilters(
  metadata: MemoryRecordMetadata,
  filters?: Partial<MemoryRecordMetadata>
): boolean {
  if (!filters) return true;
  if (filters.memoryType && metadata.memoryType !== filters.memoryType) return false;
  if (filters.locationId && metadata.locationId !== filters.locationId) return false;
  if (filters.locationType && metadata.locationType !== filters.locationType) return false;
  if (filters.day !== undefined && metadata.day !== filters.day) return false;
  return true;
}

function scoreDocument(
  document: string,
  tokens: string[],
  importance: number
): number {
  const lower = document.toLowerCase();
  let overlap = 0;
  for (const token of tokens) {
    if (lower.includes(token)) overlap += 1;
  }
  return overlap * 10 + importance;
}

export function createMemoryStore(config: HarnessConfig): MemoryStore {
  if (config.mockMode || !config.chromaEnabled) {
    return new InMemoryMemoryStore();
  }
  // Chroma wiring lands when keys are present; mock path stays demo-safe.
  return new InMemoryMemoryStore();
}
