# Corrección del diseño aprobado — FORMA

## Hallazgos de la comparación

La captura del usuario confirmó que la primera actualización no reproducía la composición aprobada. La tarjeta de cobros pendientes desplazaba los gráficos, había cuatro acciones separadas, se repetía el encabezado de trabajo y el sello anterior aplicaba un filtro de color a una imagen previa. Ventas mostraba tarjetas en una lista; no tenía el tablero por etapas aprobado. Además, la activación del servidor CRM seguía pendiente y no podía considerarse un CRM funcionando en producción.

## Correcciones de presentación

- Marca exacta enviada por el usuario: sello y wordmark contienen los JPEG originales sin filtros ni cambios en sus píxeles. El wordmark se encuadra mediante el viewBox del SVG para aprovechar su franja central, conservando el diseño. No se usa una imagen generada como logo.
- Paleta violeta/azul de esas referencias en acciones y navegación; verde para cobros, morado para salidas y rojo para urgencias. Podcast conserva naranja en el calendario.
- Cabecera fija preservada. La sección de Caja usa su propio título y no repite el gran encabezado de Agenda.
- Períodos y fecha junto al título, cuatro tarjetas con iconos, acción única Gestionar que contiene los botones originales con sus eventos.
- Día: barras por curso/servicio y pizza por medio de pago.
- Semana/Mes/Año: evolución del período a todo el ancho, barras por curso/servicio y desglose de salidas; formas de pago y explicación en un desplegable.
- Cobros pendientes debajo de los gráficos: tres cifras resumidas y un desplegable para personas, fechas y acciones.
- Ventas: cinco columnas por las cinco etapas persistidas existentes. Mantiene filtros, paginación, ficha y controles de versión. En celular las etapas son secciones desplegables, sin columnas estrechas. No cambia etapas guardadas ni crea clientes de ejemplo.
- Configurar FORMA reúne el acceso al instalador existente. Solo dirección puede copiarlo; no ejecuta SQL ni afirma que se activó la base.

## Estado de los datos y validación

No hay migraciones nuevas ni escrituras de registros reales en esta corrección. Se conservan la separación entre FORMA y las otras aplicaciones y los permisos de las operaciones existentes. La instalación de `forma-workspace-upgrade.sql` en el proyecto independiente sigue siendo un paso pendiente del propietario: el conector de la sesión no tiene permiso sobre esa base. El tablero sin activación muestra contadores desconocidos, no ceros ni datos ficticios.

Se prueban los flujos DOM con datos sintéticos, la agrupación de botones sin perder eventos, las vistas financieras, la conservación de permisos y la igualdad SHA-256 entre las imágenes adjuntas y las embebidas. No hay navegador de QA disponible en esta sesión; falta comprobación visual en dispositivos físicos.
