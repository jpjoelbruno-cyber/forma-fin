# FORMÁ: cursos gratuitos, suscripción futura y Mis cuentas

## Estado

La interfaz está preparada para la publicación. No se han cambiado bases de datos por este trabajo: Joel aplica personalmente el script de activación.
La conexión bancaria y los cobros siguen desactivados. Los cursos existentes de texto y sus progresos se conservan.

## Activación por Joel

1. Abrir el proyecto **FORMA Personal Independiente**, referencia **irsuevjqmgpwunvymxbc**.
2. Entrar en **SQL Editor → New query**.
3. Copiar TODO `education-accounts.sql`, pegar y pulsar **Run**. El script verifica el administrador de FORMÁ, se ejecuta en una transacción y no modifica las tablas financieras existentes.
4. Si da error, copiar el mensaje antes de reintentar. No ejecutar en proyectos Eleva.
5. Recargar FORMÁ e ir a **Administración → Cursos**. Deben aparecer cinco cursos en borrador.
6. Validar persistencia y permisos después de activar: crear una lección de prueba con un enlace de Joel, volver a abrirla, comprobarla con una cuenta de alumno; marcar completada y volver a entrar. Comprobar que alumno no puede editar, no suscriptor no recibe lecciones restringidas y otra cuenta no ve cuentas/progreso ajenos.

## Publicar el primer curso gratis

1. Abrir **Mi primer presupuesto** y mantener Acceso **Gratis**.
2. Añadir una lección: nombre del módulo, título, enlace de YouTube, explicación y actividad.
3. Revisar el video con el botón de revisión. El enlace debe corresponder a un video, no a un canal o playlist. Revisar en YouTube que su reproducción e inserción estén permitidas.
4. Guardar la lección como **Publicado**. Añadir más lecciones con orden 0, 1, 2…; usar el mismo nombre de módulo para agruparlas.
5. Cambiar el curso a **Publicado** y guardar. Para retirarlo del catálogo, usar **Archivado**; no se borran sus progresos.
6. El alumno abre **Aprender → Ver curso → Ver video**. Su progreso se marca manualmente; no afirmamos que el botón acredita haber visto todo el video.

Todos los cursos nuevos son gratuitos por defecto. Los cursos iniciales deben permanecer gratuitos. Las futuras actualizaciones exclusivas se crean como cursos separados de suscripción.

## Suscripción futura

La estructura `access_level=subscription` está preparada. El contenido se filtra en el servidor mediante RLS, con autorización vigente en `forma_private.course_entitlements`. El alumno no puede modificar ese registro desde el aplicativo. No hay checkout ni autosuscripción ni cobros.

Antes de cobrar se deben definir el plan, reglas de cancelación, proveedor de pago y webhook verificado con idempotencia. Solo el servidor concede/revoca permisos según eventos verificados; jamás según parámetros del navegador. Las becas y accesos manuales también se registran por servidor/administración, con vencimiento. Las políticas de suscripción deben probarse tras aplicar el script.

YouTube facilita el contenido gratuito. Un enlace público o no listado puede compartirse fuera de FORMÁ: el control del aplicativo no convierte YouTube en una plataforma de protección de videos. Para cursos de pago protegidos, evaluar alojamiento privado y autorizaciones temporales antes del lanzamiento comercial.

## Mis cuentas

Anotaciones opcionales de banco/lugar, alias, monto y fecha. El saldo es declarado manualmente, no saldo consultado; no cambia el presupuesto, ingresos o metas. Se puede corregir cada anotación.

La integración bancaria futura requiere proveedor y contrato, consentimiento, acceso de consulta, revocación, tokens exclusivamente en servidor y una auditoría específica. Ningún botón activa una conexión hoy. No se almacenan claves bancarias, CPF o números de cuenta en este módulo.

## Validación realizada antes de activación

Pruebas de URLs YouTube, rechazo de hosts falsos, validación de montos manuales, estructura RLS de propiedad y suscripción, carga de interfaz y regresiones de registro por voz. Las pruebas estáticas del SQL no sustituyen la validación de permisos reales posterior a la activación.
