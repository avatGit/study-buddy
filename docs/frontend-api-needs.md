# Deferred frontend API needs

## Password recovery

Password recovery is deferred. The Flutter sign-in screen may show “Forgot password? — Coming soon” as a disabled action, but it must not navigate or send a request. No password-recovery endpoint is implemented or documented as available.

Do not design or wire a client contract until email delivery and the secure reset-token flow have been agreed. The future backend design must specify token entropy, hashing at rest, expiration, single-use behavior, rate limits, privacy-preserving responses for unknown emails, password policy, and whether active refresh-token sessions are revoked after a reset. These are future requirements, not current API behavior.
