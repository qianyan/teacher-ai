import { toast } from "sonner";

const base = {
  duration: 3600,
  closeButton: true,
} as const;

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/** 清除草稿成功 */
export function toastDraftCleared() {
  toast.success("已清除草稿", {
    ...base,
    description: "编辑区与照片已恢复为默认状态。",
  });
}

/** 清除草稿失败 */
export function toastDraftClearFailed(error: unknown) {
  toast.error("清除草稿失败", {
    ...base,
    description: errMessage(error, "请稍后重试。"),
  });
}

/** 删除历史记录成功 */
export function toastHistoryDeleted() {
  toast.success("已删除历史记录", {
    ...base,
    description: "该条已从侧栏列表移除。",
  });
}

/** 删除历史记录失败 */
export function toastHistoryDeleteFailed(error: unknown) {
  toast.error("删除历史记录失败", {
    ...base,
    description: errMessage(error, "请稍后重试。"),
  });
}

/** 从列表删除照片成功 */
export function toastPhotoRemoved(fileLabel: string) {
  toast.success("已删除照片", {
    ...base,
    description: fileLabel.trim() || "已从照片列表移除。",
  });
}

/** HEIC 转 PNG 失败（导入或草稿恢复迁移） */
export function toastHeicImportFailed(fileLabel: string, error: unknown) {
  toast.error("HEIC 转 PNG 失败", {
    ...base,
    description: `${fileLabel.trim() || "照片"}：${errMessage(error, "请换用 PNG/JPEG 或稍后重试。")}`,
  });
}
