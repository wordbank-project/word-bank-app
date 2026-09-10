# Notifications (daily practice reminder)

The Memory tab (`memory-words.tsx`) has one optional feature: a single recurring
daily local notification reminding you to practice, toggled from a row on that
screen (not `more.tsx` — it's specific to this feature). Native-only: the toggle
(and its time/word-count rows) is hidden entirely on web, since `expo-notifications`
has no web implementation for local scheduling — and also hidden mid-round
(`phase === "playing"`), alongside the round-size picker. `daily-reminder.ts` also
installs a module-level `Notifications.setNotificationHandler` (banner on, sound/badge
off, guarded off web) so a foreground reschedule at round-end doesn't pop a banner
using platform defaults mid-summary.

- **Time and a word-count target are user-configurable**, revealed once the toggle
  is on. Time is picked via a real native time picker
  (`@react-native-community/datetimepicker` — Android's imperative
  `DateTimePickerAndroid.open(...)` dialog, iOS's inline spinner component, branched
  in `memory-words.tsx`'s `openTimePicker`). The word-count target reuses the same
  chip-row component (`SizeChipRow`, "5 / 10 / 20 / All") as the in-session round-size
  picker, but is a separate, independently-persisted value
  (`getReminderTime`/`setReminderTime`, `getReminderWordCount`/`setReminderWordCount`
  in [notifications-storage.ts](../src/storage/notifications-storage.ts)) — it has to
  survive app restarts since the notification can fire days after the app was last
  opened, unlike the in-session `roundSize` state.
- **The notification's text changes to reflect your last practice round** — every
  time a round finishes, `rescheduleDailyReminder(...)` re-schedules the *same*
  notification (by a fixed `identifier`, so it's always replaced, never stacked)
  with fresh body text (e.g. "You knew 8/10 words in your last practice — keep it
  up! 📚"). This is a **foreground call fired at the moment a round ends** — there
  is deliberately no background task/background fetch involved; the notification
  just reflects whatever the last foreground session recorded, with no date-keyed
  "daily stats" storage needed. Changing the time or word-count target resets the
  body back to a generic default (`defaultReminderBody`) until the next round completes.
- **Per-word ratings are now persisted as lightweight counters, not full spaced
  repetition.** Every "Knew it" / "Still learning" also increments that word's
  running count via `memory-stats-storage.ts`'s `recordRating` (fire-and-forget,
  called from `handleRate`) — no interval/ease-factor/due-date scheduling, just a
  tally feeding `stats.tsx`. This is separate from the **session-scoped** rotation,
  which stays purely in memory (`knownThisSession` in `memory-words.tsx`, resets on
  app restart): each round favors words not yet marked "Knew it" this session over
  ones you've already got, so repeated "Practice again" taps surface different words
  before repeating; once every saved word has been marked known at least once this
  session, the tracking resets and the whole pool becomes fair game again.
- **Permission denial** shows a plain `alertDialog` notice (mirrors the
  camera-permission-denied handling in [cover-images.md](cover-images.md)) and leaves
  the toggle off — no crash, no deep-link to Settings in v1.
- **Tapping the notification opens the Memory tab** — `scheduleDailyReminder` tags
  the notification with `data: { type: "daily-reminder" }`, and the root-mounted
  `NotificationResponseBridge` component (see [AGENTS.md](../AGENTS.md)'s Components
  table) reads that tag to route via `router.push("/memory-words")`. Covers a tap
  while the app is running or backgrounded (`addNotificationResponseReceivedListener`)
  and a tap that cold-starts the app (`getLastNotificationResponse()`, checked once on
  mount and cleared after handling so it isn't re-processed).
- **Two native modules** — `expo-notifications` and
  `@react-native-community/datetimepicker` — like the camera permission in
  [cover-images.md](cover-images.md), both
  required an `app.config.js` plugin entry (`"expo-notifications"` and
  `"@react-native-community/datetimepicker"`, neither needs options: local-only
  scheduling doesn't use the former's push-branding options, and the latter's plugin
  only customizes optional Android picker theming) and ship only via a new build, not OTA:
  ```bash
  npm run build:dev    # or build:apk:local:dev
  npm run build:apk    # or build:apk:local:preview
  ```

