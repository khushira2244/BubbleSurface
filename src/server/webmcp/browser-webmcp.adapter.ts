import type { BrowserToolRegistration } from "./webmcp-tool.types";

interface ModelContextApi {
  registerTool(tool: BrowserToolRegistration, options: { signal: AbortSignal }): Promise<void> | void;
}
interface DocumentWithModelContext { modelContext?: ModelContextApi }

export interface BrowserWebMcpAdapter {
  isAvailable(): boolean;
  register(tool: BrowserToolRegistration): Promise<boolean>;
  unregister(toolName: string): Promise<boolean>;
}

export class ExperimentalBrowserWebMcpAdapter implements BrowserWebMcpAdapter {
  private readonly controllers = new Map<string, AbortController>();
  constructor(private readonly browserDocument?: DocumentWithModelContext) {}
  isAvailable(): boolean { return typeof this.browserDocument?.modelContext?.registerTool === "function"; }
  async register(tool: BrowserToolRegistration): Promise<boolean> {
    if (!this.isAvailable()) return false;
    this.controllers.get(tool.name)?.abort();
    const controller = new AbortController();
    this.controllers.set(tool.name, controller);
    try {
      await this.browserDocument!.modelContext!.registerTool(tool, { signal: controller.signal });
      return true;
    } catch (error) {
      controller.abort();
      this.controllers.delete(tool.name);
      throw error;
    }
  }
  async unregister(toolName: string): Promise<boolean> {
    const controller = this.controllers.get(toolName);
    if (!controller) return false;
    controller.abort();
    this.controllers.delete(toolName);
    return true;
  }
}

export function createBrowserWebMcpAdapter(): ExperimentalBrowserWebMcpAdapter {
  const browserDocument = typeof document === "undefined" ? undefined : document as unknown as DocumentWithModelContext;
  return new ExperimentalBrowserWebMcpAdapter(browserDocument);
}
