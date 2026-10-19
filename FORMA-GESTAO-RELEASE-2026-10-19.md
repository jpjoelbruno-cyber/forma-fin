# FORMA Gestão — presentación aprobada

La cabecera usa el sello original de FORMA en blanco y el nombre portugués **FORMA Gestão**, sobre una franja continua violeta y azul. El texto se adapta a PC, tablet y celular; mantiene navegación fija, lupa, campana y cuenta. En celular las etiquetas compactas Agenda y Caja abren las mismas vistas de Mi semana y Finanzas. El contenido financiero mantiene el botón Gestionar, las cuatro tarjetas y los gráficos de la propuesta aprobada; los importes reales no se reemplazan con cifras de la imagen.

## Limpieza de la presentación

`agenda.html` carga solamente `forma-gestao.css`. Se retiraron del proyecto las nueve hojas de estilo anteriores que solo consumía esa página: agenda, asistente, calendario, ingresos, CRM, finanzas, períodos, notificaciones y workspace. También se retiró el wordmark rectangular anterior, sin consumidores restantes.

La hoja canónica conserva las reglas funcionales de calendario, formularios, modales y permisos de visualización. Se eliminaron 79 selectores de cabeceras anteriores y 75 declaraciones repetidas con selector y contexto idénticos, respetando el orden de cascada y la prioridad `important`. La nueva cabecera tiene una sola definición base y sus adaptaciones por ancho. El archivo resultante es código legible, no una importación de estilos retirados ni una capa nueva sobre ellos. Las próximas modificaciones deben editar esta fuente directamente.

`forma-gestao-mark.svg` conserva embebida la imagen original del sello. Una máscara SVG obtiene su silueta existente y la presenta en blanco; no se dibuja un símbolo nuevo. Se comprobó el origen de la imagen por SHA-256 y se inspeccionó su renderizado SVG. El sello original en color se conserva para las páginas personales que ya lo usan.

## Datos, permisos y validación

Esta entrega no modifica tablas, usuarios, reservas, pagos, contratos ni registros de René. No modifica otras aplicaciones ni las configuraciones de autenticación. El instalador pendiente del CRM no se ejecuta con un cambio visual.

Se verifican: una sola hoja cargada y parseable, ausencia de los diez archivos retirados, nombre con el acento portugués, sello sin wordmark, cabecera fija con gradiente, medios móviles, menús de notificación, logout y limpieza de datos privados, flujos de reservas/cobros, períodos y tablero CRM. El navegador de QA no está disponible en esta sesión; queda pendiente revisar la composición en dispositivos físicos.
