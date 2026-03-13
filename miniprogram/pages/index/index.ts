/*
 * @Author: Mingxuan songmingxuan936@gmail.com
 * @Date: 2026-03-12 22:19:49
 * @LastEditors: Mingxuan songmingxuan936@gmail.com
 * @LastEditTime: 2026-03-13 18:24:49
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
        const text = this.extractArkText(res.data);
        const aiMsgId = Date.now();
        const aiMsg = { id: aiMsgId, role: "ai" as const, text };
        this.setData({
          messages: [...this.data.messages, aiMsg],
          toView: `msg-${aiMsgId}`,
        });
      },
      fail: (err) => {
        const aiMsgId = Date.now();
        const aiMsg = { id: aiMsgId, role: "ai" as const, text: "请求失败" };
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
    if (typeof data.output_text === "string") return data.output_text;
    if (data.output && typeof data.output.text === "string")
      return data.output.text;
    if (Array.isArray(data.output_texts) && data.output_texts.length > 0) {
      const first = data.output_texts[0];
      if (typeof first === "string") return first;
      if (first && typeof first.text === "string") return first.text;
    }
    if (data.choices && data.choices[0]?.message?.content) {
      const c = data.choices[0].message.content;
      if (Array.isArray(c)) {
        const t = c.find((x: any) => x && (x.text || x.type === "output_text"));
        if (t?.text) return t.text;
      }
    }
    return JSON.stringify(data);
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
