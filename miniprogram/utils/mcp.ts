export interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: string | number;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

export class MCPClient {
  private sseUrl: string;
  private headers: Record<string, string>;
  public postUrl: string | null = null;
  private pendingRequests: Map<string | number, (res: any) => void> = new Map();
  private requestTask: WechatMiniprogram.RequestTask | null = null;
  private buffer: string = "";

  constructor(url: string, headers: Record<string, string>) {
    this.sseUrl = url;
    this.headers = headers;
  }

  async connect(): Promise<void> {
    if (this.postUrl) {
      return Promise.resolve();
    }
    if (this.requestTask) {
      // Already connecting, wait for postUrl
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.postUrl) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(check);
          if (!this.postUrl)
            reject(new Error("Wait for MCP connection timeout"));
        }, 10000);
      });
    }

    return new Promise((resolve, reject) => {
      this.requestTask = wx.request({
        url: this.sseUrl,
        header: {
          ...this.headers,
          Accept: "text/event-stream",
        },
        method: "GET",
        enableChunked: true,
      } as any) as any;

      (this.requestTask as any).onChunkReceived((chunk: any) => {
        const chunkStr = this.decodeArrayBuffer(chunk.data);
        console.log("SSE Chunk Received:", chunkStr);
        this.buffer += chunkStr;
        this.parseSSE();
      });

      // Wait for endpoint to be established
      const checkInterval = setInterval(() => {
        if (this.postUrl) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10s
      setTimeout(() => {
        if (!this.postUrl) {
          clearInterval(checkInterval);
          reject(new Error("SSE connection timeout - no endpoint received"));
        }
      }, 10000);
    });
  }

  private decodeArrayBuffer(buffer: ArrayBuffer): string {
    try {
      // @ts-ignore
      if (typeof TextDecoder !== "undefined") {
        // @ts-ignore
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(buffer);
      }
    } catch (e) {
      console.warn("TextDecoder failed, using fallback", e);
    }

    const uint8Array = new Uint8Array(buffer);
    let str = "";
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i]);
    }
    try {
      // Handle multi-byte characters
      return decodeURIComponent(escape(str));
    } catch (e) {
      return str;
    }
  }

  private parseSSE() {
    const lines = this.buffer.split("\n");
    // Keep the last potentially incomplete line in buffer
    this.buffer = lines.pop() || "";

    let currentEvent = "";
    let currentData = "";

    for (const line of lines) {
      console.log("SSE parsing line:", line);
      if (line.trim() === "") {
        // End of event
        if (currentEvent === "endpoint" && currentData) {
          // Normalize endpoint URL
          if (currentData.startsWith("http")) {
            this.postUrl = currentData;
          } else if (currentData.startsWith("/")) {
            // Host-relative path
            const hostRoot = this.sseUrl.split("/").slice(0, 3).join("/");
            this.postUrl = hostRoot + currentData;
          } else {
            // Path-relative path
            const lastSlashIndex = this.sseUrl.lastIndexOf("/");
            const baseDir = this.sseUrl.substring(0, lastSlashIndex);
            this.postUrl = baseDir + "/" + currentData;
          }
          console.log("MCP Endpoint established:", this.postUrl);
        } else if (currentEvent === "message" && currentData) {
          try {
            console.log("MCP message event data:", currentData);
            const msg = JSON.parse(currentData) as JSONRPCResponse;
            if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
              const resolve = this.pendingRequests.get(msg.id);
              if (resolve) {
                resolve(msg);
                this.pendingRequests.delete(msg.id);
              }
            }
          } catch (e) {
            console.error("Failed to parse MCP message data", e);
          }
        }
        currentEvent = "";
        currentData = "";
        continue;
      }

      if (line.startsWith("event: ")) {
        currentEvent = line.substring(7).trim();
      } else if (line.startsWith("data: ")) {
        currentData += (currentData ? "\n" : "") + line.substring(6).trim();
      }
    }
  }

  async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.postUrl) {
      throw new Error("MCP not connected or endpoint not received");
    }

    const id = Date.now().toString() + Math.random().toString(36).substring(7);
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      method,
      params,
      id,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, resolve);

      wx.request({
        url: this.postUrl!,
        method: "POST",
        header: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        data: request,
        success: (res) => {
          if (res.statusCode !== 200 && res.statusCode !== 202) {
            this.pendingRequests.delete(id);
            reject(new Error(`MCP POST failed with status ${res.statusCode}`));
          }
          // Response will come via SSE stream
        },
        fail: (err) => {
          this.pendingRequests.delete(id);
          reject(err);
        },
      });

      // Timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async listTools() {
    return this.sendRequest("tools/list");
  }

  async callTool(name: string, args: any) {
    return this.sendRequest("tools/call", {
      name,
      arguments: args,
    });
  }
}

// Singleton instance with hardcoded credentials as requested
export const noveMCP = new MCPClient("https://noveapi.proflu.cn/sse", {
  Authorization:
    "Bearer sk_DE_hdC6uZD.dMQcm9P4Hq_D73XCJNPmfLPdJCkqhh1Z_hMFaDqu",
});
