# Correcciones de la auditoría profesional — 9 octubre 2026

## Cambios de aplicación

- Pantalla informativa de acceso pendiente: referencia y ayuda por correo del propietario; WhatsApp si el administrador lo ha configurado. No aprueba alumnos automáticamente ni promete plazos.
- Celular: Inicio, Registrar, Metas, Aprender y Más. Más contiene Historial, Mis cuentas, Mi año y Ayuda. PC conserva navegación lateral completa; administración sigue siendo una sección privada.
- Inicio: una acción de registro y un resumen de entradas/gastos/resultado. Editar presupuesto junto al termómetro. Se mantienen los elementos internos que usa el cálculo, ocultos para evitar información repetida.
- Registro: voz y formulario escrito accesibles; metas sin imagen/porcentaje repetido, botones más cortos. Fechas visibles dd/mm/aaaa, importes R$ 3.200,00.
- Aprender: continuidad, termómetro y catálogo; elimina curso actual duplicado e historial repetido. Un curso publicado sigue siendo visible aunque solo haya uno.
- Ejemplo público: año con datos ficticios y gráfico con escala. No implica actividad real ni guarda datos.
- Voz avanzada: configuración JSON entre comillas reconocida correctamente. Requiere configuración del proveedor; no se anuncia como activa sin ella.
- Aportes a metas: referencia estable y confirmación del registro; un reintento no debe duplicar el aporte. Con RPC pendiente solo se permite aporte positivo por el método anterior, verificando los datos devueltos. Los retiros no usan ese método.

## Pendiente: propietario en Supabase

No se han aplicado cambios a la base de datos de producción. Ejecutar únicamente en **FORMA Personal Independiente**, ID `irsuevjqmgpwunvymxbc`, nunca en Eleva.

1. SQL Editor → New query. Pegar completo `goal-event-security.sql` y ejecutar. Protege saldo con bloqueo de la meta, valida cada movimiento, elimina INSERT directo y deja inmutable el saldo inicial. Después comprobar un aporte y un retiro pequeño con cuenta de prueba. Mientras esta función no exista, la aplicación informa que los retiros no están habilitados.
2. Otra consulta: ejecutar `learning-validation.sql`, siguiendo `LEARNING-VALIDATION-SETUP.md`. Configurar duración y pregunta de cada clase desde administración. Sin configurar una clase no se acredita conclusión ni se abre la siguiente. No se deben convertir marcas antiguas en aprendizaje verificado.
3. Auth → configuración de contraseñas: revisar disponibilidad y activar protección contra contraseñas filtradas. No se ha cambiado aquí esta opción ni el envío SMTP.

La protección del servidor sigue pendiente hasta completar estos pasos. La interfaz por sí sola no restringe clientes antiguos/API directas. No conectar bancos todavía; la integración sigue deshabilitada.

## Verificación

- Suite Node de autenticación, propietarios, voz, presupuesto, aprendizaje, navegación y aportes.
- PostgreSQL aislado desechable: ambas migraciones se aplican dos veces; retiros por encima del saldo, otra cuenta, inserción directa, cambio de saldo inicial y usuarios revocados/anónimos son rechazados. Reintentos conservan un solo evento. Prueba secuencial, sin simular conexiones concurrentes reales.
- Prueba del arranque de la interfaz completa con datos ficticios: navegación, registro, tarjetas, pantalla pendiente y formato.
- Revisión visual en navegador tras despliegue. La demostración no sustituye prueba real de Google, SMTP, micrófono o sesión administrativa.

## Conservación e independencia

No se eliminan usuarios, se aprueban pendientes ni se modifican datos históricos del proyecto compartido. Su retirada debe esperar a verificar respaldos y recuperación. La aplicación usa solamente el Supabase independiente. Los datos mostrados en el ejemplo son ficticios.
