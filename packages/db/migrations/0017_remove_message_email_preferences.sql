-- New messages are no longer emailed (in-app only), so choices saved for
-- their email channel no longer mean anything.
DELETE FROM "notification_preference" WHERE "type" = 'new-message' AND "channel" = 'email';
