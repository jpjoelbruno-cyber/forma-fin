-- FORMÁ · Corrección urgente 28/10/2026 (15:40): la función enrolment_admin no tenía permiso de ejecución para usuarios autenticados
-- (error "permission denied for function enrolment_admin"). Afecta: cancelar grupo, CPF, cambio de grupo y observaciones.
-- Aditivo y reversible: revoke execute on function forma_private.enrolment_admin(text,jsonb) from authenticated;
grant execute on function forma_private.enrolment_admin(text,jsonb) to authenticated;
notify pgrst,'reload schema';
