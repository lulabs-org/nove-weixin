/*
 * @Author: Mingxuan songmingxuan936@gmail.com
 * @Date: 2026-03-12 22:19:49
 * @LastEditors: Mingxuan songmingxuan936@gmail.com
 * @LastEditTime: 2026-03-15 09:51:47
 * @FilePath: /miniprogram-1/miniprogram/pages/index/index.ts
 * @Description:
 *
 * Copyright (c) 2026 by ${git_name_email}, All Rights Reserved.
 */
import { noveMCP } from "../../utils/mcp";
import { mdToRichText } from "../../utils/md-parser";

Page({
  data: {
    inputValue: "",
    messages: [] as {
      id: number;
      role: "user" | "ai" | "system" | "tool";
      text: string;
      html?: string;
    }[],
    toView: "",
    history: [] as any[], // AI conversation history
  },

  onLoad() {
    // Proactively connect to MCP server
    noveMCP.connect().catch((err) => {
      console.error("MCP Auto-connect failed:", err);
    });
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({
      inputValue: e.detail.value,
    });
  },

  maskSecret(s: string) {
    if (!s) return "";
    if (s.length <= 8) return "****";
    return s.slice(0, 4) + "****" + s.slice(-4);
  },

  handleCommand(text: string) {
    const t = text.trim();
    const setKeyDash = t.match(/^\/?set-key\s+(\S+)/i);
    if (setKeyDash) {
      const val = setKeyDash[1];
      wx.setStorageSync("VOLCENGINE_API_KEY", val);
      const aiMsgId = Date.now();
      const valText = "已保存 API Key: " + this.maskSecret(val);
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: valText,
        html: mdToRichText(valText),
      };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`,
      });
      return true;
    }
    const setKey = t.match(
      /^\/?set\s+(apikey|key|VOLCENGINE_API_KEY)\s+(\S+)/i,
    );
    if (setKey) {
      const val = setKey[2];
      wx.setStorageSync("VOLCENGINE_API_KEY", val);
      const aiMsgId = Date.now();
      const valText = "已保存 API Key: " + this.maskSecret(val);
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: valText,
        html: mdToRichText(valText),
      };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`,
      });
      return true;
    }
    const setModel = t.match(/^\/?set\s+(model|VOLCENGINE_MODEL)\s+(\S+)/i);
    if (setModel) {
      const val = setModel[2];
      wx.setStorageSync("VOLCENGINE_MODEL", val);
      const aiMsgId = Date.now();
      const valText = "已保存模型: " + val;
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: valText,
        html: mdToRichText(valText),
      };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`,
      });
      return true;
    }
    if (/^\/?get\s+(apikey|key|VOLCENGINE_API_KEY)$/i.test(t)) {
      const v = (wx.getStorageSync("VOLCENGINE_API_KEY") as string) || "";
      const aiMsgId = Date.now();
      const valText = v
        ? "当前 API Key: " + this.maskSecret(v)
        : "未设置 API Key";
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: valText,
        html: mdToRichText(valText),
      };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`,
      });
      return true;
    }
    if (/^\/?get\s+(model|VOLCENGINE_MODEL)$/i.test(t)) {
      const v = (wx.getStorageSync("VOLCENGINE_MODEL") as string) || "";
      const aiMsgId = Date.now();
      const valText = v ? "当前模型: " + v : "未设置模型";
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: valText,
        html: mdToRichText(valText),
      };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`,
      });
      return true;
    }

    if (/^\/?clear$/i.test(t)) {
      this.setData({
        messages: [],
        history: [],
      });
      return true;
    }

    if (t.startsWith("/mcp")) {
      this.handleMCPCommand(t);
      return true;
    }
    return false;
  },

  async handleMCPCommand(command: string) {
    const parts = command.split(" ");
    const action = parts[1]; // list, call, etc.

    try {
      if (!noveMCP.postUrl) {
        this.addAIMessage("正在连接 MCP 服务器...");
        await noveMCP.connect();
      }

      if (action === "list") {
        this.addAIMessage("正在获取工具列表...");
        const res = await noveMCP.listTools();
        this.addAIMessage(
          "MCP 工具列表:\n" + JSON.stringify(res.result, null, 2),
        );
      } else if (action === "call") {
        const toolName = parts[2];
        const argsStr = parts.slice(3).join(" ");
        let args = {};
        if (argsStr) {
          try {
            args = JSON.parse(argsStr);
          } catch (e) {
            this.addAIMessage("参数 JSON 格式错误");
            return;
          }
        }
        this.addAIMessage(`正在调用工具 ${toolName}...`);
        const res = await noveMCP.callTool(toolName, args);
        this.addAIMessage(
          `工具返回结果:\n${JSON.stringify(res.result || res.error, null, 2)}`,
        );
      } else {
        this.addAIMessage(
          "未知 MCP 命令。可用命令:\n/mcp list\n/mcp call <toolName> <argsJson>",
        );
      }
    } catch (err: any) {
      console.error("MCP Error:", err);
      this.addAIMessage(`MCP 错误: ${err.message || JSON.stringify(err)}`);
    }
  },

  async callArk(userText: string) {
    const apiKey = (wx.getStorageSync("VOLCENGINE_API_KEY") as string) || "";
    const model =
      (wx.getStorageSync("VOLCENGINE_MODEL") as string) ||
      "doubao-seed-2-0-mini-260215";
    if (!apiKey || !model) {
      wx.showToast({ title: "缺少密钥或模型", icon: "none" });
      return;
    }

    const nowStr = new Date().toLocaleString();
    const systemPrompt = `当前北京时间: ${nowStr}。
如果你需要处理与时间相关的请求（如“最近”、“今天”、“明天”等），请参考此时间。`;

    // Ensure we have a system message at the start or updated
    let history = [...this.data.history];
    const systemIdx = history.findIndex((h) => h.role === "system");
    if (systemIdx > -1) {
      history[systemIdx].content = systemPrompt;
    } else {
      history.unshift({ role: "system", content: systemPrompt });
    }

    // Add user message to history
    history.push({ role: "user", content: userText });
    this.setData({ history });

    try {
      // 1. Get tools from MCP
      await noveMCP.connect();
      const toolsRes = await noveMCP.listTools();
      const mcpTools = (toolsRes.result?.tools || []).map((t: any) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      // Add a local "get_current_time" tool as well if model prefers calling it
      mcpTools.push({
        type: "function",
        function: {
          name: "get_current_time",
          description: "获取当前北京时间",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      });

      // 2. Call AI with tools
      const response = await this.requestArk(model, apiKey, history, mcpTools);
      await this.handleAIResponse(response, model, apiKey);
    } catch (err: any) {
      this.addAIMessage(`Ark Error: ${err.message || JSON.stringify(err)}`);
    }
  },

  async requestArk(
    model: string,
    apiKey: string,
    messages: any[],
    tools: any[],
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      wx.request({
        url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
        method: "POST",
        header: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        data: {
          model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(
              new Error(
                `Ark API returned ${res.statusCode}: ${JSON.stringify(res.data)}`,
              ),
            );
          }
        },
        fail: (err) => reject(err),
      });
    });
  },

  async handleAIResponse(data: any, model: string, apiKey: string) {
    const message = data.choices?.[0]?.message;
    if (!message) {
      this.addAIMessage("AI 未返回有效内容");
      return;
    }

    // Add AI message to history
    let currentHistory = [...this.data.history, message];
    this.setData({ history: currentHistory });

    if (message.content) {
      this.addAIMessage(message.content);
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      let updatedHistory = currentHistory;
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name;
        const argsStr = toolCall.function.arguments;
        let args = {};
        try {
          args = JSON.parse(argsStr);
        } catch (e) {
          console.error("Failed to parse tool args", argsStr);
        }

        this.addAIMessage(`[AI 正在调用 MCP 工具: ${name}]`);

        try {
          let resultText = "";
          if (name === "get_current_time") {
            resultText = JSON.stringify({
              current_time: new Date().toLocaleString(),
            });
          } else {
            const toolResult = await noveMCP.callTool(name, args);
            resultText = JSON.stringify(toolResult.result || toolResult.error);
          }

          updatedHistory = [
            ...updatedHistory,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: resultText,
            },
          ];
        } catch (e: any) {
          this.addAIMessage(`调用工具失败: ${e.message}`);
          updatedHistory = [
            ...updatedHistory,
            {
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: ${e.message}`,
            },
          ];
        }
      }

      this.setData({ history: updatedHistory });

      // Call AI again with ALL tool results
      const nextResponse = await this.requestArk(
        model,
        apiKey,
        updatedHistory,
        [],
      );
      await this.handleAIResponse(nextResponse, model, apiKey);
    }
  },

  addAIMessage(text: string) {
    const aiMsgId = Date.now();
    const html = mdToRichText(text);
    console.log("Generated RichText HTML:", html);
    const aiMsg = { id: aiMsgId, role: "ai" as const, text, html };
    this.setData({
      messages: [...this.data.messages, aiMsg],
      toView: `msg-${aiMsgId}`,
    });
  },

  onSend() {
    const content = this.data.inputValue.trim();
    if (!content) {
      return;
    }

    const now = Date.now();
    const userMsg = { id: now, role: "user" as const, text: content };

    const newMessages = [...this.data.messages, userMsg];

    this.setData({
      messages: newMessages,
      inputValue: "",
      toView: `msg-${now}`,
    });

    const handled = this.handleCommand(content);
    if (!handled) {
      this.callArk(content);
    }
  },
});
