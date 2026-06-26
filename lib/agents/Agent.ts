import type { MemoryRecordMetadata } from "@/lib/sim/types";
import type { MemoryStore } from "./memory";
import type { AgentRole, HarnessConfig } from "./types";

export abstract class Agent {
  readonly id: string;
  readonly role: AgentRole;

  constructor(
    id: string,
    role: AgentRole,
    protected memory: MemoryStore,
    protected config: HarnessConfig
  ) {
    this.id = id;
    this.role = role;
  }

  collectionName(): string {
    return this.memory.collectionName(this.id);
  }

  async retrieveMemories(
    queryText: string,
    filters?: Partial<MemoryRecordMetadata>,
    limit?: number
  ) {
    return this.memory.query(this.id, queryText, filters, limit);
  }

  async writeMemory(
    document: string,
    metadata: MemoryRecordMetadata,
    writeId: string
  ): Promise<void> {
    await this.memory.write(this.id, document, metadata, writeId);
  }
}
