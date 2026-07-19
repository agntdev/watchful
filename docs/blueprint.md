# Watchful Crypto Alerts — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Watchful is a personal Telegram bot that lets users manage private cryptocurrency watchlists with price-threshold and percent-move alerts. It respects quiet hours and alert cooldowns to avoid spam, and provides optional daily summaries. The owner has a private admin view of usage metrics.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Individual crypto traders
- Price-watchers

## Success criteria

- Users can create and manage watchlist entries with alerts
- Alerts are delivered according to user-configured rules and quiet hours
- Owner receives accurate metrics about user activity and alert triggers

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu for onboarding or returning users
- **/price** (command, actor: user, command: /price) — Check current price of a specific coin or list all watched coins
- **Add Coin** (button, actor: user, callback: add_coin:start) — Begin adding a new cryptocurrency to the watchlist
  - inputs: ticker symbol, display name
  - outputs: watchlist entry
- **Manage Alerts** (button, actor: user, callback: alerts:manage) — View and modify existing alert rules for watchlist entries
  - inputs: coin selection, alert type, parameters
  - outputs: updated alert rules
- **Settings** (button, actor: user, callback: settings:open) — Configure quiet hours, morning summary time, and alert cooldowns
  - inputs: timezone, quiet hours, summary time, cooldown settings
  - outputs: updated user profile

## Flows

### Onboarding
_Trigger:_ /start

1. Welcome message
2. Prompt to add first coin or open settings

_Data touched:_ user profile

### Add Coin
_Trigger:_ add_coin:start

1. Select or type ticker symbol
2. Confirm coin details
3. Add to watchlist

_Data touched:_ watchlist entry

### Create Price Threshold Alert
_Trigger:_ alerts:price_threshold

1. Select coin
2. Choose direction (above/below)
3. Enter threshold price
4. Confirm and create rule

_Data touched:_ alert rule

### Create Percent Move Alert
_Trigger:_ alerts:percent_move

1. Select coin or apply to all
2. Enter percent value
3. Enter window duration
4. Confirm and create rule

_Data touched:_ alert rule

### Price Check
_Trigger:_ /price

1. Parse ticker parameter
2. Fetch current price
3. Display price and 24h change

_Data touched:_ price snapshot

### Morning Summary
_Trigger:_ scheduled_daily

1. Check user's enabled summary setting
2. Fetch prices for all watchlist coins
3. Format summary with price and percent change

_Data touched:_ price snapshot, user profile

### Alert Evaluation
_Trigger:_ price_update

1. Check all active alert rules
2. Evaluate price thresholds and percent moves
3. Queue alerts if not in quiet hours
4. Deliver alerts with cooldown enforcement

_Data touched:_ alert rule, price snapshot, user profile

### Owner Metrics
_Trigger:_ owner:metrics

1. Fetch user counts
2. Fetch alert trigger statistics
3. Format and deliver metrics report

_Data touched:_ user profile, alert rule

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User Profile** _(retention: persistent)_ — User-specific settings and preferences
  - fields: Telegram user ID, display name, timezone, locale, quiet hours start/end, morning summary time, default cooldown, last active timestamp
- **Watchlist Entry** _(retention: persistent)_ — A cryptocurrency being tracked by a user
  - fields: ticker symbol, display name, enabled flag, last-notified timestamps per rule
- **Alert Rule** _(retention: persistent)_ — A specific alert condition for a watchlist entry
  - fields: type (price-threshold or percent-move), parameters, enabled flag, cooldown, creation timestamp, last triggered timestamp
- **Price Snapshot** _(retention: session)_ — Recorded price data for calculations
  - fields: symbol, timestamp, price, 24h change
- **Owner Metrics** _(retention: persistent)_ — Aggregated usage statistics
  - fields: total user count, active users (30d), alert trigger counts, symbol trigger counts

## Integrations

- **Telegram** (required) — Bot API messaging and user interaction
- **Market Price API** (required) — Fetch live cryptocurrency prices and historical data
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- View user counts and activity metrics
- Request on-demand alert usage reports
- Access top 20 most-triggered alerts and symbols

## Notifications

- Price threshold alerts
- Percent move alerts
- Daily morning summaries
- Owner metrics reports

## Permissions & privacy

- All user data is private and not shared
- Watchlists and alerts are per-user and not visible to others
- Owner only sees aggregated metrics, not individual watchlists

## Edge cases

- Price feed failures with retry logic
- Handling unknown/typo tickers with suggestions
- Quiet hours alert queuing and delivery
- Alert cooldown enforcement across users

## Required tests

- Verify alert delivery during non-quiet hours
- Test price threshold alert creation and triggering
- Validate percent move alert calculations
- Confirm morning summary formatting and timing
- Test owner metrics report generation

## Assumptions

- Default cooldown is 15 minutes
- Percent-move window is 1 hour
- Morning summary defaults to 08:00 local time
- Price verification with 3 retry attempts
- Owner metrics include top 20 alerts/symbols
