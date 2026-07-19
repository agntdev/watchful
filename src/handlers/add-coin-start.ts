import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { addToWatchlist, getWatchlist } from "../storage.js";
import { searchCoins } from "../crypto-api.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("add_coin:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_ticker";
  await ctx.reply("Type the ticker symbol of the coin you want to track (e.g. BTC, ETH, SOL).", {
    reply_markup: { force_reply: true, input_field_placeholder: "Type a ticker symbol…" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_ticker") return next();
  const ticker = ctx.message.text.trim().toUpperCase();
  if (ticker.length < 1 || ticker.length > 10) {
    await ctx.reply("That doesn't look like a ticker. Try something like BTC or ETH.");
    return;
  }

  ctx.session.step = undefined;
  const results = await searchCoins(ticker);
  if (results.length === 0) {
    await ctx.reply(`Couldn't find any coins matching "${ticker}". Check the spelling and try again.`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const top = results.slice(0, 5);
  ctx.session.addCoinTicker = ticker;
  const buttons = top.map((c) => [inlineButton(`${c.name} (${c.symbol})`, `ac:pick:${c.id}:${c.name}:${c.symbol}`)]);
  buttons.push([inlineButton("⬅️ Cancel", "menu:main")]);
  await ctx.reply(`🔍 Found these coins:\n\nTap one to add it to your watchlist.`, {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^ac:pick:(.+):(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, coinId, coinName, coinSymbol] = ctx.match;
  ctx.session.addCoinCoinId = coinId;
  ctx.session.addCoinName = coinName;
  ctx.session.addCoinTicker = coinSymbol;
  await ctx.editMessageText(`Add ${coinName} (${coinSymbol}) to your watchlist?`, {
    reply_markup: confirmKeyboard("ac:add"),
  });
});

function confirmKeyboard(prefix: string) {
  return inlineKeyboard([
    [inlineButton("✅ Yes", `${prefix}:yes`), inlineButton("❌ No", `${prefix}:no`)],
  ]);
}

composer.callbackQuery("ac:add:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const ticker = ctx.session.addCoinTicker;
  const name = ctx.session.addCoinName;
  const coinId = ctx.session.addCoinCoinId;
  if (!ticker || !name || !coinId) {
    await ctx.editMessageText("Something went wrong. Tap /start to try again.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const watchlist = await getWatchlist(userId);
  const alreadyExists = watchlist.some((e) => e.ticker === ticker);
  if (alreadyExists) {
    await ctx.editMessageText(`${name} (${ticker}) is already in your watchlist.`, {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    ctx.session.addCoinTicker = undefined;
    ctx.session.addCoinName = undefined;
    ctx.session.addCoinCoinId = undefined;
    return;
  }

  await addToWatchlist(userId, {
    ticker,
    displayName: name,
    coinId,
    enabled: true,
    lastNotified: {},
  });

  ctx.session.addCoinTicker = undefined;
  ctx.session.addCoinName = undefined;
  ctx.session.addCoinCoinId = undefined;

  await ctx.editMessageText(`✅ ${name} (${ticker}) added to your watchlist.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🪙 Add another", "add_coin:start")],
      [inlineButton("📊 See watchlist", "price:menu")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("ac:add:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.addCoinTicker = undefined;
  ctx.session.addCoinName = undefined;
  ctx.session.addCoinCoinId = undefined;
  await ctx.editMessageText("Cancelled.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
