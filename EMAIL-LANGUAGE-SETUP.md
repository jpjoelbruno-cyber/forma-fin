# FORMÁ: correos en español y portugués

## Preparado en la aplicación

El registro incluye selección Español/Português. Sugiere inicialmente el idioma del navegador y conserva la elección en este dispositivo. `signUp` guarda únicamente `full_name` y `language` en los metadatos de Auth; el idioma no concede roles ni acceso.

En Ayuda, las cuentas existentes y las de Google pueden elegir el idioma de futuros correos y guardarlo en su propia cuenta. La recuperación usa el idioma previamente guardado de esa cuenta, no el navegador de una persona que solicita recuperar el correo de otro usuario. Si una cuenta antigua no tiene idioma, las plantillas muestran ambos idiomas.

Este cambio traduce el cuerpo de los correos de confirmación y recuperación. No traduce todas las pantallas, mensajes de voz ni notificaciones financieras. Se conserva el flujo de correo confirmado para el acceso automático, que necesita activar `automatic-account-access.sql` por separado.

## Paso manual del propietario en Supabase

Solo **FORMA Personal Independiente**, proyecto `irsuevjqmgpwunvymxbc`.

1. Authentication → Email Templates (en algunas versiones, Emails → Templates).
2. Confirm signup → cuerpo: reemplazar por el contenido completo de `email-templates/confirm-signup.html` → Save.
3. Reset password → cuerpo: reemplazar por el contenido completo de `email-templates/reset-password.html` → Save.
4. Usar `FORMÁ` como asunto en ambos para evitar texto de asunto en otro idioma. No se asume que el campo asunto evalúe plantillas condicionales.
5. Con dos correos de prueba, uno `es` y otro `pt`, verificar recepción, idioma, enlace de confirmación, regreso a FORMÁ y recuperación. El enlace PKCE debe abrirse en el navegador donde se pidió. Las pruebas automáticas no sustituyen entrega SMTP real.

Se conserva `{{ .ConfirmationURL }}` generado por Supabase; no insertar enlaces de Eleva ni direcciones inventadas. Cada cuerpo usa las condiciones oficiales de Go Templates `{{ if eq .Data.language "pt" }}` / `es`. No se añaden montos ni presupuestos a los mensajes. Estos correos no se envían desde ChatGPT.

**Estado:** plantillas preparadas, no instaladas en producción por el agente. SMTP no se ha modificado. La preferencia guardada solo será utilizada por los correos después de activar las dos plantillas. Las demás plantillas (invitación, cambios de email, avisos de seguridad) no se modifican aquí.

## Verificación

Suite Node: selección y persistencia local, metadatos enviados en registro, prioridad del idioma de cuenta, conservación de cambios al volver a la pestaña, guardado confirmado, fallos y bloqueo de escritura en ejemplo/sesión ausente/cambio de cuenta. Solo se envía `language` en la actualización; se conservan roles y permisos.

Referencia oficial: https://supabase.com/docs/guides/troubleshooting/customizing-emails-by-language-KZ_38Q
