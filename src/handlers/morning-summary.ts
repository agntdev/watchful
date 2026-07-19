import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getWatchlist, getOrCreateProfile } from "../storage.js";
import { getPrices } from "../crypto-api.js";
import { now } from "../clock.js";

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(6)}`;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("morning:show", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const watchlist = await getWatchlist(userId);
  if (watchlist.length === 0) {
    await ctx.editMessageText("Your watchlist is empty — tap 🪙 Add Coin to start tracking one.", {
      reply_markup: inlineKeyboard([[inlineButton("🪙 Add Coin", "add_coin:start")]]),
    });
    return;
  }

  const coinIds = watchlist.filter((e) => e.enabled).map((e) => e.coinId);
  const prices = await getPrices(coinIds);
  const lines: string[] = [];
  for (const entry of watchlist) {
    if (!entry.enabled) continue;
    const p = prices[entry.coinId];
    if (p) {
      lines.push(`${entry.ticker}: ${formatPrice(p.usd)} (${formatChange(p.usd24hChange)})`);
    } else {
      lines.push(`${entry.ticker}: price unavailable`);
    }
  }

  const n = now();
  const timeStr = n.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const text = `☀️ Morning Summary (${timeStr})\n\n${lines.join("\n")}\n\nHave a great day!`;

  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
