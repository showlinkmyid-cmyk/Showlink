# ShowLink Authentication Setup

- Email + password registration/login
- Google OAuth via Supabase
- No Turnstile
- Forgot password redirects to `/reset-password.html`
- Successful registration can go directly to Dashboard when Supabase email confirmation is disabled.
- Google OAuth users complete a username on `/google-profile.html` if needed.

Google Cloud redirect URI:
`https://ralhenfokkrzbgsmemkp.supabase.co/auth/v1/callback`

Supabase URL Configuration:
`https://showlink.my.id/auth-callback.html`

For immediate dashboard after email registration, in Supabase Authentication settings disable email confirmation. If confirmation remains enabled, Supabase will require the user to confirm their email first.
