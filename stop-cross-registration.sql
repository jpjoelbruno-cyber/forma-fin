-- Owner explicitly authorized eliminating cross-app FORMA registration.
-- Existing accounts/data and every non-FORMA Auth trigger remain untouched.
-- FORMÁ's loadProfile already inserts an own student profile when missing.
drop trigger if exists on_forma_user_created on auth.users;
