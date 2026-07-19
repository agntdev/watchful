import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getWatchlist } from "../storage.js";
import { getPrice, getPrices } from "../crypto-api.js";
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

composer.command("price", async (ctx) => {
  const userId = ctx.from?.id ?? 0;
  const arg = ctx.message?.text?.replace(/^\/price\s*/, "").trim().toUpperCase();

  if (arg) {
    const watchlist = await getWatchlist(userId);
    const entry = watchlist.find((e) => e.ticker === arg);
    if (!entry) {
      await ctx.reply(`Couldn't find ${arg} in your watchlist. Add it first with the Add Coin button.`, {
        reply_markup: inlineKeyboard([[inlineButton("🪙 Add Coin", "add_coin:start")]]),
      });
      return;
    }
    const priceData = await getPrice(entry.coinId);
    if (!priceData) {
      await ctx.reply("Couldn't fetch the price. Try again in a moment.", {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
      });
      return;
    }
    const change = formatChange(priceData.usd24hChange);
    await ctx.reply(
      `📊 ${entry.displayName} (${entry.ticker})\n\nPrice: ${formatPrice(priceData.usd)}\n24h change: ${change}`,
      { reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]) },
    );
    return;
  }

  const watchlist = await getWatchlist(userId);
  if (watchlist.length === 0) {
    await ctx.reply("Your watchlist is empty — tap 🪙 Add Coin to start tracking one.", {
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
      lines.push(`${entry.ticker} — ${formatPrice(p.usd)} (${formatChange(p.usd24hChange)})`);
    } else {
      lines.push(`${entry.ticker} — price unavailable`);
    }
  }
  if (lines.length === 0) {
    await ctx.reply("Your watchlist is empty — tap 🪙 Add Coin to start tracking one.", {
      reply_markup: inlineKeyboard([[inlineButton("🪙 Add Coin", "add_coin:start")]]),
    });
    return;
  }
  const text = `📊 Your watchlist:\n\n${lines.join("\n")}`;
  await ctx.reply(text, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

composer.callbackQuery("price:menu", async (ctx) => {
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
      lines.push(`${entry.ticker} — ${formatPrice(p.usd)} (${formatChange(p.usd24hChange)})`);
    } else {
      lines.push(`${entry.ticker} — price unavailable`);
    }
  }
  const text = `📊 Your watchlist:\n\n${lines.join("\n")}`;
  await ctx.editMessageText(text, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
