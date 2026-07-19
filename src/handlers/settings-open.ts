import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getOrCreateProfile, updateProfile } from "../storage.js";

function formatSettings(profile: {
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  summaryEnabled: boolean;
  morningSummaryTime: string;
  defaultCooldown: number;
}): string {
  const summary = profile.summaryEnabled ? "On" : "Off";
  return (
    `⚙️ Settings\n\n` +
    `Timezone: ${profile.timezone}\n` +
    `Quiet hours: ${profile.quietHoursStart}–${profile.quietHoursEnd}\n` +
    `Morning summary: ${summary} (${profile.morningSummaryTime})\n` +
    `Cooldown: ${profile.defaultCooldown} min`
  );
}

const composer = new Composer<Ctx>();

composer.callbackQuery("settings:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const name = ctx.from?.first_name ?? "";
  const profile = await getOrCreateProfile(userId, name);
  await ctx.editMessageText(formatSettings(profile), {
    reply_markup: inlineKeyboard([
      [inlineButton("🌍 Timezone", "settings:tz"), inlineButton("🌙 Quiet hours", "settings:qh")],
      [inlineButton("☀️ Summary", "settings:summary"), inlineButton("⏱ Cooldown", "settings:cooldown")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("settings:tz", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_timezone";
  await ctx.editMessageText("Type your timezone (e.g. America/New_York, Europe/London, Asia/Tokyo).");
  await ctx.reply("Send your timezone:", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. America/New_York" },
  });
});

composer.callbackQuery("settings:qh", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_quiet_hours";
  await ctx.editMessageText("Set quiet hours start and end (e.g. 22:00 08:00).");
  await ctx.reply("Send start and end times:", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 22:00 08:00" },
  });
});

composer.callbackQuery("settings:summary", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id ?? 0;
  const name = ctx.from?.first_name ?? "";
  const profile = await getOrCreateProfile(userId, name);
  await updateProfile(userId, { summaryEnabled: !profile.summaryEnabled });
  const updated = await getOrCreateProfile(userId, name);
  await ctx.editMessageText(formatSettings(updated), {
    reply_markup: inlineKeyboard([
      [inlineButton("🌍 Timezone", "settings:tz"), inlineButton("🌙 Quiet hours", "settings:qh")],
      [inlineButton("☀️ Summary", "settings:summary"), inlineButton("⏱ Cooldown", "settings:cooldown")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("settings:cooldown", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_cooldown";
  await ctx.editMessageText("Set alert cooldown in minutes (default 15).");
  await ctx.reply("Send cooldown minutes:", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. 15" },
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step === "awaiting_timezone") {
    const tz = ctx.message.text.trim();
    if (tz.length < 2 || tz.length > 50) {
      await ctx.reply("That doesn't look like a valid timezone. Try something like America/New_York.");
      return;
    }
    const userId = ctx.from?.id ?? 0;
    await updateProfile(userId, { timezone: tz });
    ctx.session.step = undefined;
    const name = ctx.from?.first_name ?? "";
    const profile = await getOrCreateProfile(userId, name);
    await ctx.reply(`✅ Timezone set to ${tz}.`, {
      reply_markup: inlineKeyboard([[inlineButton("⚙️ Settings", "settings:open")]]),
    });
    return;
  }

  if (ctx.session.step === "awaiting_quiet_hours") {
    const text = ctx.message.text.trim();
    const match = text.match(/^(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})$/);
    if (!match) {
      await ctx.reply("Use this format: HH:MM HH:MM (e.g. 22:00 08:00).");
      return;
    }
    const userId = ctx.from?.id ?? 0;
    await updateProfile(userId, { quietHoursStart: match[1], quietHoursEnd: match[2] });
    ctx.session.step = undefined;
    await ctx.reply(`✅ Quiet hours set to ${match[1]}–${match[2]}.`, {
      reply_markup: inlineKeyboard([[inlineButton("⚙️ Settings", "settings:open")]]),
    });
    return;
  }

  if (ctx.session.step === "awaiting_cooldown") {
    const text = ctx.message.text.trim();
    const mins = parseInt(text, 10);
    if (isNaN(mins) || mins < 1 || mins > 1440) {
      await ctx.reply("Enter a number between 1 and 1440 (24 hours).");
      return;
    }
    const userId = ctx.from?.id ?? 0;
    await updateProfile(userId, { defaultCooldown: mins });
    ctx.session.step = undefined;
    await ctx.reply(`✅ Cooldown set to ${mins} min.`, {
      reply_markup: inlineKeyboard([[inlineButton("⚙️ Settings", "settings:open")]]),
    });
    return;
  }

  return next();
});

export default composer;
