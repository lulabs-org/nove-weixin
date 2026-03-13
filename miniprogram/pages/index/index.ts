/*
 * @Author: Mingxuan songmingxuan936@gmail.com
 * @Date: 2026-03-12 22:19:49
 * @LastEditors: Mingxuan songmingxuan936@gmail.com
 * @LastEditTime: 2026-03-13 18:32:42
 * @FilePath: /miniprogram-1/miniprogram/pages/index/index.ts
 * @Description:
 *
 * Copyright (c) 2026 by ${git_name_email}, All Rights Reserved.
 */
Page({
  data: {
    inputValue: "",
    messages: [] as { id: number; role: "user" | "ai"; text: string }[],
    toView: "",
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
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: "已保存 API Key: " + this.maskSecret(val),
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
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: "已保存 API Key: " + this.maskSecret(val),
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
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: "已保存模型: " + val,
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
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: v ? "当前 API Key: " + this.maskSecret(v) : "未设置 API Key",
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
      const aiMsg = {
        id: aiMsgId,
        role: "ai" as const,
        text: v ? "当前模型: " + v : "未设置模型",
      };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`,
      });
      return true;
    }
    return false;
  },

  callArk(userText: string) {
    const apiKey = (wx.getStorageSync("VOLCENGINE_API_KEY") as string) || "";
    const model =
      (wx.getStorageSync("VOLCENGINE_MODEL") as string) ||
      "doubao-seed-2-0-mini-260215";
    if (!apiKey || !model) {
      wx.showToast({ title: "缺少密钥或模型", icon: "none" });
      return;
    }
    wx.request({
      url: "https://ark.cn-beijing.volces.com/api/v3/responses",
      method: "POST",
      header: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      data: {
        model,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: userText }],
          },
        ],
      },
      success: (res) => {
        const status = res.statusCode || 0;
        const d: any = res.data as any;
        let text: string;
        const hasErr =
          status < 200 ||
          status >= 300 ||
          (d && typeof d === "object" && (d.error || d.Code || d.code));
        if (hasErr) {
          const msg =
            d?.error?.message ||
            d?.message ||
            d?.msg ||
            d?.Message ||
            d?.Msg ||
            JSON.stringify(d);
          text = `请求错误(${status}): ${msg}`;
        } else {
          text = this.extractArkText(d);
        }
        console.log("Ark response:", res);
        const aiMsgId = Date.now();
        const aiMsg = { id: aiMsgId, role: "ai" as const, text };
        this.setData({
          messages: [...this.data.messages, aiMsg],
          toView: `msg-${aiMsgId}`,
        });
      },
      fail: (err) => {
        console.error("Ark request fail:", err);
        const aiMsgId = Date.now();
        const aiMsg = {
          id: aiMsgId,
          role: "ai" as const,
          text: `请求失败: ${err?.errMsg || "未知错误"}`,
        };
        this.setData({
          messages: [...this.data.messages, aiMsg],
          toView: `msg-${aiMsgId}`,
        });
      },
    });
  },

  extractArkText(data: any): string {
    if (!data) return "无返回";
    if (typeof data === "string") return data;
    const texts: string[] = [];
    const pick = (v: any) => {
      if (!v) return;
      if (typeof v === "string") {
        if (v.trim()) texts.push(v);
        return;
      }
      if (typeof v.text === "string") {
        if (v.text.trim()) texts.push(v.text);
        return;
      }
      if (typeof v.content === "string") {
        if (v.content.trim()) texts.push(v.content);
        return;
      }
      if (typeof v.value === "string") {
        if (v.value.trim()) texts.push(v.value);
        return;
      }
    };
    if (typeof (data as any).output_text === "string")
      return (data as any).output_text;
    if ((data as any).output && typeof (data as any).output.text === "string")
      return (data as any).output.text;
    if (Array.isArray((data as any).output)) {
      const out = (data as any).output as any[];
      for (const item of out) {
        if (item && Array.isArray(item.content)) {
          for (const part of item.content) {
            pick(part);
          }
        } else {
          pick(item);
        }
      }
      if (texts.length) return texts.join("\n");
    }
    if (
      Array.isArray((data as any).output_texts) &&
      (data as any).output_texts.length > 0
    ) {
      const first = (data as any).output_texts[0];
      pick(first);
      if (texts.length) return texts.join("\n");
    }
    if ((data as any).choices && (data as any).choices[0]?.message?.content) {
      const c = (data as any).choices[0].message.content;
      if (Array.isArray(c)) {
        for (const part of c) pick(part);
        if (texts.length) return texts.join("\n");
      } else {
        pick(c);
        if (texts.length) return texts.join("\n");
      }
    }
    try {
      return JSON.stringify(data);
    } catch {
      return String(data);
    }
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
