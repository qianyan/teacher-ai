export function browserSupportsPasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
}

export function passkeyErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message.toLowerCase();
  if (msg.includes("cancel") || msg.includes("abort")) {
    return "已取消通行密钥操作";
  }
  if (msg.includes("not supported") || msg.includes("webauthn")) {
    return "当前浏览器不支持通行密钥";
  }
  if (msg.includes("no passkey") || msg.includes("not found")) {
    return "未找到通行密钥，请先用邮箱密码登录并绑定";
  }
  return error.message || fallback;
}
