Page({
  data: {
    inputValue: "",
    messages: [] as { id: number; role: "user" | "ai"; text: string }[],
    toView: ""
  },

  onInput(e: WechatMiniprogram.Input) {
    this.setData({
      inputValue: e.detail.value,
    });
  },

  onSend() {
    console.log("onSend triggered, inputValue:", this.data.inputValue);
    const content = this.data.inputValue.trim();
    if (!content) {
      console.log("Content is empty");
      // 可以选择给用户一个提示，比如 toast，但这里先不做，避免打扰
      return;
    }

    const now = Date.now();
    const userMsg = { id: now, role: "user" as const, text: content };
    
    // Append user message
    const newMessages = [...this.data.messages, userMsg];
    
    this.setData({
      messages: newMessages,
      inputValue: "",
      toView: `msg-${now}` // Scroll to the new message
    });

    // Mock AI response for demonstration
    setTimeout(() => {
      const aiMsgId = Date.now();
      const aiMsg = { id: aiMsgId, role: "ai" as const, text: "AI收到: " + content };
      this.setData({
        messages: [...this.data.messages, aiMsg],
        toView: `msg-${aiMsgId}`
      });
    }, 1000);
  },
});
