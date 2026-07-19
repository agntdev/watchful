import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  getWatchlist,
} from "../storage.js";
import { now } from "../clock.js";

function genId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const composer = new Composer<Ctx>();

composer.callbackQuery("alerts:manage", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const alerts = await getAlerts(userId);
  if (alerts.length === 0) {
    await ctx.editMessageText("No alerts yet — tap Create Alert to set one up.", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔔 Create Alert", "alerts:create")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  const lines = alerts.map((r) => {
    const status = r.enabled ? "✅" : "⏸️";
    if (r.type === "price_threshold") {
      return `${status} ${r.coinTicker} ${r.direction} $${r.thresholdPrice?.toLocaleString()}`;
    }
    return `${status} ${r.coinTicker} ±${r.percentValue}% in ${r.windowMinutes}min`;
  });
  await ctx.editMessageText(`🔔 Your alerts:\n\n${lines.join("\n")}`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🔔 Create Alert", "alerts:create")],
      ...alerts.map((r) => [
        inlineButton(
          `${r.enabled ? "⏸️ Pause" : "▶️ Resume"} ${r.coinTicker}`,
          `alerts:toggle:${r.id}`,
        ),
        inlineButton(`🗑 Remove`, `alerts:del:${r.id}`),
      ]),
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("alerts:create", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("What type of alert?", {
    reply_markup: inlineKeyboard([
      [inlineButton("📈 Price Threshold", "alerts:price_threshold")],
      [inlineButton("📊 Percent Move", "alerts:percent_move")],
      [inlineButton("⬅️ Back", "alerts:manage")],
    ]),
  });
});

composer.callbackQuery("alerts:price_threshold", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const watchlist = await getWatchlist(userId);
  if (watchlist.length === 0) {
    await ctx.editMessageText("Add a coin to your watchlist first.", {
      reply_markup: inlineKeyboard([[inlineButton("🪙 Add Coin", "add_coin:start")]]),
    });
    return;
  }
  ctx.session.alertType = "price_threshold";
  const buttons = watchlist.map((e) => [inlineButton(`${e.displayName} (${e.ticker})`, `ac:alert:${e.ticker}:${e.coinId}:${e.displayName}`)]);
  buttons.push([inlineButton("⬅️ Cancel", "alerts:create")]);
  await ctx.editMessageText("Select a coin for the price alert:", {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery("alerts:percent_move", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const watchlist = await getWatchlist(userId);
  if (watchlist.length === 0) {
    await ctx.editMessageText("Add a coin to your watchlist first.", {
      reply_markup: inlineKeyboard([[inlineButton("🪙 Add Coin", "add_coin:start")]]),
    });
    return;
  }
  ctx.session.alertType = "percent_move";
  const buttons = watchlist.map((e) => [inlineButton(`${e.displayName} (${e.ticker})`, `ac:alert:${e.ticker}:${e.coinId}:${e.displayName}`)]);
  buttons.push([inlineButton("⬅️ Cancel", "alerts:create")]);
  await ctx.editMessageText("Select a coin for the percent alert:", {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^ac:alert:(.+):(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, ticker, coinId, displayName] = ctx.match;
  ctx.session.alertCoinTicker = ticker;
  ctx.session.alertCoinId = coinId;

  if (ctx.session.alertType === "price_threshold") {
    await ctx.editMessageText(`Alert when ${displayName} goes above or below the current price?`, {
      reply_markup: inlineKeyboard([
        [inlineButton("📈 Above", "alerts:dir:above"), inlineButton("📉 Below", "alerts:dir:below")],
        [inlineButton("⬅️ Cancel", "alerts:create")],
      ]),
    });
  } else {
    ctx.session.step = "awaiting_percent";
    await ctx.editMessageText(`Enter the percent change threshold for ${displayName} (e.g. 5 for 5%):`);
    await ctx.reply("Type the percent value:", {
      reply_markup: { force_reply: true, input_field_placeholder: "e.g. 5" },
    });
  }
});

composer.callbackQuery(/^alerts:dir:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const direction = ctx.match[1] as "above" | "below";
  ctx.session.alertDirection = direction;
  ctx.session.step = "awaiting_threshold";
  await ctx.editMessageText(`Enter the target price for ${ctx.session.alertCoinTicker} (e.g. 50000):`);
  await ctx.reply("Type the price:", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 50000" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step === "awaiting_threshold") {
    const text = ctx.message.text.trim();
    const price = parseFloat(text.replace(/[$,]/g, ""));
    if (isNaN(price) || price <= 0) {
      await ctx.reply("That doesn't look like a valid price. Try a number like 50000.");
      return;
    }
    ctx.session.alertThreshold = price;
    ctx.session.step = undefined;
    const ticker = ctx.session.alertCoinTicker ?? "???";
    const dir = ctx.session.alertDirection ?? "above";
    const dirWord = dir === "above" ? "above" : "below";
    await ctx.reply(
      `Create alert: ${ticker} ${dirWord} $${price.toLocaleString()}?`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("✅ Create", "alerts:confirm"), inlineButton("❌ Cancel", "alerts:create")],
        ]),
      },
    );
    return;
  }

  if (ctx.session.step === "awaiting_percent") {
    const text = ctx.message.text.trim();
    const pct = parseFloat(text.replace(/%/g, ""));
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      await ctx.reply("Enter a percent between 1 and 100.");
      return;
    }
    ctx.session.alertPercent = pct;
    ctx.session.step = "awaiting_window";
    await ctx.reply(`Over what time window? Enter minutes (e.g. 60 for 1 hour):`, {
      reply_markup: { force_reply: true, input_field_placeholder: "e.g. 60" },
    });
    return;
  }

  if (ctx.session.step === "awaiting_window") {
    const text = ctx.message.text.trim();
    const mins = parseInt(text, 10);
    if (isNaN(mins) || mins < 1 || mins > 1440) {
      await ctx.reply("Enter a number between 1 and 1440 (24 hours).");
      return;
    }
    ctx.session.alertWindow = mins;
    ctx.session.step = undefined;
    const ticker = ctx.session.alertCoinTicker ?? "???";
    const pct = ctx.session.alertPercent ?? 0;
    await ctx.reply(
      `Create alert: ${ticker} ±${pct}% in ${mins}min?`,
      {
        reply_markup: inlineKeyboard([
          [inlineButton("✅ Create", "alerts:confirm"), inlineButton("❌ Cancel", "alerts:create")],
        ]),
      },
    );
    return;
  }

  return next();
});

composer.callbackQuery("alerts:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const ticker = ctx.session.alertCoinTicker;
  const coinId = ctx.session.alertCoinId;
  const type = ctx.session.alertType;
  if (!ticker || !coinId || !type) {
    await ctx.editMessageText("Something went wrong. Tap /start to try again.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const rule = {
    id: genId(),
    type,
    coinTicker: ticker,
    coinId,
    direction: ctx.session.alertDirection,
    thresholdPrice: ctx.session.alertThreshold,
    percentValue: ctx.session.alertPercent,
    windowMinutes: ctx.session.alertWindow,
    enabled: true,
    cooldown: 15,
    createdAt: now().getTime(),
    lastTriggered: 0,
  };

  await addAlert(userId, rule);

  ctx.session.alertCoinTicker = undefined;
  ctx.session.alertCoinId = undefined;
  ctx.session.alertType = undefined;
  ctx.session.alertDirection = undefined;
  ctx.session.alertThreshold = undefined;
  ctx.session.alertPercent = undefined;
  ctx.session.alertWindow = undefined;

  const desc =
    type === "price_threshold"
      ? `${ticker} ${rule.direction} $${rule.thresholdPrice?.toLocaleString()}`
      : `${ticker} ±${rule.percentValue}% in ${rule.windowMinutes}min`;

  await ctx.editMessageText(`✅ Alert created: ${desc}`, {
    reply_markup: inlineKeyboard([
      [inlineButton("🔔 Manage alerts", "alerts:manage")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^alerts:toggle:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const ruleId = ctx.match[1];
  await toggleAlert(userId, ruleId);
  const alerts = await getAlerts(userId);
  const rule = alerts.find((r) => r.id === ruleId);
  const status = rule?.enabled ? "resumed" : "paused";
  await ctx.answerCallbackQuery({ text: `Alert ${status}` });
  await ctx.editMessageText(`Alert ${status}.`, {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to alerts", "alerts:manage")]]),
  });
});

composer.callbackQuery(/^alerts:del:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const ruleId = ctx.match[1];
  await removeAlert(userId, ruleId);
  await ctx.editMessageText("Alert removed.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to alerts", "alerts:manage")],
    ]),
  });
});

export default composer;
