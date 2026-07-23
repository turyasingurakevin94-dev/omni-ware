-- Lets a push_subscriptions row carry either a Web Push subscription
-- (endpoint/p256dh/auth_key, for anyone using worker.html as a
-- browser-installed PWA) or a native FCM token (for the installed
-- Android APK, which delivers real native notifications instead of
-- routing through the browser's push plumbing). notify-worker sends via
-- whichever channel a given row has populated.

alter table push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh drop not null,
  alter column auth_key drop not null,
  add column fcm_token text unique,
  add constraint push_subscriptions_has_one_channel check (
    (endpoint is not null and p256dh is not null and auth_key is not null)
    or fcm_token is not null
  );
