export function mdToRichText(md: string): string {
  if (!md) return "";

  // 1. Pre-process: Normalize newlines
  let content = md.replace(/\r\n/g, "\n").trim();

  // 2. Escape HTML special characters
  content = escapeHtml(content);

  // 3. Handle Code Blocks (```code```)
  // We use a unique placeholder to avoid interference with other rules
  const codeBlocks: string[] = [];
  content = content.replace(/```([\s\S]*?)```/g, (match, p1) => {
    const code = p1.trim();
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(
      `<div style="background-color: #2d2d2d; color: #ccc; padding: 20rpx; border-radius: 8rpx; margin: 20rpx 0; font-family: monospace; white-space: pre; overflow-x: auto; word-break: break-all;">${code}</div>`,
    );
    return id;
  });

  // 4. Handle Inline Code (`code`)
  content = content.replace(
    /`(.*?)`/g,
    '<code style="background-color: #f0f0f0; padding: 4rpx 8rpx; border-radius: 4rpx; font-family: monospace; color: #e83e8c;">$1</code>',
  );

  // 5. Handle Headers
  content = content.replace(
    /^### (.*$)/gm,
    '<h3 style="font-size: 30rpx; font-weight: bold; margin: 12rpx 0; display: block;">$1</h3>',
  );
  content = content.replace(
    /^## (.*$)/gm,
    '<h2 style="font-size: 32rpx; font-weight: bold; margin: 16rpx 0; display: block;">$1</h2>',
  );
  content = content.replace(
    /^# (.*$)/gm,
    '<h1 style="font-size: 36rpx; font-weight: bold; margin: 20rpx 0; display: block;">$1</h1>',
  );

  // 6. Handle Bold
  content = content.replace(
    /\*\*(.*?)\*\*/g,
    '<strong style="font-weight: bold;">$1</strong>',
  );

  // 7. Handle Lists
  content = content.replace(
    /^\s*[\-\*] (.*$)/gm,
    '<div style="display: flex; margin: 8rpx 0;"><span style="margin-right: 12rpx;">•</span><span>$1</span></div>',
  );
  content = content.replace(
    /^\s*(\d+)\. (.*$)/gm,
    '<div style="display: flex; margin: 8rpx 0;"><span style="margin-right: 12rpx;">$1.</span><span>$2</span></div>',
  );

  // 8. Handle Remaining Newlines (Paragraphs)
  content = content.replace(/\n/g, "<br/>");

  // 9. Restore Code Blocks
  codeBlocks.forEach((html, i) => {
    content = content.replace(`__CODE_BLOCK_${i}__`, html);
  });

  return content;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
