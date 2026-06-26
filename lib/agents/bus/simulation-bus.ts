import type { SimulationMessage } from "./message-types";

export type SimulationMessageHandler = (message: SimulationMessage) => void;

export class SimulationBus {
  private listeners = new Set<SimulationMessageHandler>();
  private history: SimulationMessage[] = [];

  publish(message: SimulationMessage): void {
    this.history.push(message);
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  subscribe(handler: SimulationMessageHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  getHistory(): SimulationMessage[] {
    return [...this.history];
  }

  getHistoryByType<T extends SimulationMessage["type"]>(
    type: T
  ): Extract<SimulationMessage, { type: T }>[] {
    return this.history.filter(
      (m): m is Extract<SimulationMessage, { type: T }> => m.type === type
    );
  }

  clear(): void {
    this.history = [];
  }
}
