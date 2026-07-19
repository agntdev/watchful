import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getOrCreateProfile, incrementMetricUsers } from "../storage.js";

registerMainMenuItem({ label: "🪙 Add Coin", data: "add_coin:start", order: 10 });
registerMainMenuItem({ label: "📊 Price", data: "price:menu", order: 15 });
registerMainMenuItem({ label: "🔔 Alerts", data: "alerts:manage", order: 20 });
registerMainMenuItem({ label: "☀️ Summary", data: "morning:show", order: 25 });
registerMainMenuItem({ label: "⚙️ Settings", data: "settings:open", order: 30 });

const WELCOME = "👋 Welcome to Watchful! Tap a button below to get started.";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id ?? 0;
  const name = ctx.from?.first_name ?? "there";
  await getOrCreateProfile(userId, name);
  await incrementMetricUsers();
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
