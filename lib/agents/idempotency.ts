import type { GraphNodeName } from "./types";
import type { LlmDecision } from "./types";

export type LedgerEntryKind =
  | "graph_run"
  | "node_attempt"
  | "llm_decision"
  | "tool_intent"
  | "engine_event"
  | "memory_write"
  | "budget_event";

export interface LedgerEntry {
  id: string;
  kind: LedgerEntryKind;
  scopeId: string;
  payload: unknown;
  createdAt: number;
}

/**
 * In-memory idempotency ledger. Chroma is memory storage, not deduplication.
 */
export class IdempotencyLedger {
  private entries = new Map<string, LedgerEntry>();

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get<T>(id: string): T | undefined {
    return this.entries.get(id)?.payload as T | undefined;
  }

  record(id: string, kind: LedgerEntryKind, scopeId: string, payload: unknown): void {
    if (this.entries.has(id)) return;
    this.entries.set(id, {
      id,
      kind,
      scopeId,
      payload,
      createdAt: Date.now(),
    });
  }

  async getOrRecordLlmDecision(
    decisionId: string,
    scopeId: string,
    node: GraphNodeName,
    factory: () => LlmDecision | Promise<LlmDecision>
  ): Promise<LlmDecision> {
    const cached = this.get<LlmDecision>(decisionId);
    if (cached) return cached;

    const decision = await factory();
    this.record(decisionId, "llm_decision", scopeId, decision);
    return decision;
  }

  markApplied(id: string, kind: LedgerEntryKind, scopeId: string): boolean {
    if (this.has(id)) return false;
    this.record(id, kind, scopeId, { applied: true });
    return true;
  }

  clear(): void {
    this.entries.clear();
  }
}

export function makeLedgerId(...parts: (string | number)[]): string {
  return parts.join(":");
}
