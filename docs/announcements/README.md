# 更新公告发版流程

玩家第一次打开带新公告的版本时，会弹出「更新公告」；点「知道了」后写入本地 `seenId`，同版本不再弹。下一版换新的 `id` 再弹。

## 三步发版

1. **Bump 版本**  
   修改根目录 `package.json` 的 `version`（如 `1.6.31` → `1.6.32`）。该值会注入 `__APP_VERSION__`，并建议与公告 `id` 一致。

2. **生成草稿**  
   ```bash
   npm run announce:draft
   # 或指定版本 / 起点提交
   npm run announce:draft -- --version 1.6.32 --since 1.6.31
   ```  
   输出：`docs/announcements/draft_{version}.md`  
   脚本会按 conventional commit 粗分【新增】【优化】【修复】【活动】，并标出建议删除的内部改动。

3. **确认后入库**  
   人工改写成玩家向短句（收益导向、5～12 条），去掉 `← \`commit\`` 对照亦可。然后：
   ```bash
   npm run announce:apply -- docs/announcements/draft_1.6.32.md
   ```  
   会覆盖 [`src/config/UpdateAnnouncementConfig.ts`](../../src/config/UpdateAnnouncementConfig.ts) 的 `UPDATE_ANNOUNCEMENT_ACTIVE`。

未确认前**不要**直接把草稿当正式文案上线；`apply` 是唯一推荐的写入方式（也可手改 Config）。

## 临时关闭

将 `UPDATE_ANNOUNCEMENT_ACTIVE.enabled` 设为 `false`。

## 验收

- 清本地 `huahua_update_announcement` 或改 `ACTIVE.id` → 进主界面（教程完成后）应弹出
- 点「知道了」后同 id 不再弹
- 正文过长可滚动；关闭不误触棋盘
