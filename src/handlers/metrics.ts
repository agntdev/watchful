import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getMetrics } from "../storage.js";

const OWNER_ID = Number(process.env.OWNER_USER_ID ?? "0");

const composer = new Composer<Ctx>();

composer.callbackQuery("owner:metrics", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  if (OWNER_ID && userId !== OWNER_ID) {
    await ctx.reply("This feature is only available to the bot owner.");
    return;
  }

  const metrics = await getMetrics();
  const topSymbols = Object.entries(metrics.symbolTriggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  const topAlerts = Object.entries(metrics.alertTriggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const symbolLines = topSymbols.length > 0
    ? topSymbols.map(([s, c]) => `  ${s}: ${c}`).join("\n")
    : "  No triggers yet";
  const alertLines = topAlerts.length > 0
    ? topAlerts.map(([s, c]) => `  ${s}: ${c}`).join("\n")
    : "  No triggers yet";

  const text =
    `📊 Owner Metrics\n\n` +
    `Total users: ${metrics.totalUsers}\n` +
    `Active (30d): ${metrics.activeUsers30d}\n` +
    `Alert triggers: ${Object.values(metrics.alertTriggerCounts).reduce((a, b) => a + b, 0)}\n\n` +
    `Top triggered symbols:\n${symbolLines}\n\n` +
    `Top alert types:\n${alertLines}`;

  await ctx.reply(text, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
