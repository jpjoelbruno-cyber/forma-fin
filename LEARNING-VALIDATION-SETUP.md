# Activación del aprendizaje de FORMÁ

La interfaz puede publicarse antes de activar estas funciones. Hasta activarlas, muestra el aviso de validación pendiente, no convierte marcas manuales en cursos concluidos y solo permite la vista del primer curso.

## Paso 1: proyecto correcto

Abrir https://supabase.com/dashboard/project/irsuevjqmgpwunvymxbc/sql/new
Confirmar **FORMA Personal Independiente**, ID **irsuevjqmgpwunvymxbc**. No usar el proyecto de Eleva Taller o Eleva Modas.

## Paso 2: activar en SQL Editor

Copiar todo el contenido de `learning-validation.sql`, pegarlo en una consulta nueva y pulsar **Run**. El script verifica el administrador dedicado antes de modificar el proyecto. Si hay un error, la transacción no se confirma: guardar el mensaje y revisar antes de seguir. El mensaje final esperado es **FORMÁ: validación de aprendizaje instalada**.

Este paso crea validación privada de video y actividad, restringe las lecciones al recorrido permitido y elimina la escritura manual de progreso para alumnos. Conserva los registros históricos. No modifica presupuestos, movimientos, metas, autenticación bancaria ni cobros. Los cambios de Supabase los ejecuta el propietario.

## Paso 3: configurar cada clase

En FORMÁ: **Administración → Cursos → Editar clase**. Primero guardar el enlace de YouTube y volver a editar la clase. En **Validación de aprendizaje**, escribir la duración real del video en segundos, una pregunta breve, tres opciones y seleccionar la respuesta correcta. Guardar.

La duración debe coincidir con el video real (tolerancia de dos segundos). La conclusión exige al menos 95% de segundos únicos reproducidos, llegar al final y responder correctamente. Una pregunta es evidencia parcial de comprensión; los eventos de reproducción no demuestran atención ni constituyen protección absoluta frente a un cliente manipulado.

La sección cuenta únicamente cursos publicados. Ordenar cursos y clases antes de publicar; cursos vacíos no se concluyen automáticamente. Los cursos para suscriptores mantienen el requisito de acceso. No se activan cobros.

Cambiar video, duración o pregunta invalida la validación anterior de esa clase y vuelve a comprobar los requisitos posteriores. No cambiar una clase ya utilizada sin considerar ese efecto.

## Paso 4: prueba con un alumno

1. Entrar con una cuenta de alumno en FORMÁ; comprobar que no aparece Administración.
2. Confirmar primer curso disponible y siguientes cerrados.
3. Saltar al final: no debe habilitar la actividad ni concluir la clase.
4. Ver el video completo. Pausar, volver y recargar: el avance confirmado debe persistir.
5. Responder incorrectamente: clase pendiente. Esperar diez segundos y responder correctamente: clase concluida.
6. Comprobar que la siguiente clase se habilita; el siguiente curso requiere terminar todas las clases publicadas del anterior.
7. Volver a entrar y revisar el termómetro. El material concluido permanece disponible.

## Verificación de desarrollo

`node --test tests/security/*.test.cjs`

Para las pruebas de SQL, instalar **@electric-sql/pglite@0.3.14** en una carpeta temporal. Ejecutar:

`FORMA_PGLITE_MODULE=/ruta/temporal/node_modules/@electric-sql/pglite/dist/index.js node tests/security/learning-database.mjs`

Estas pruebas ejecutan el SQL dos veces y verifican permisos de alumno/administrador/anónimo, tokens ajenos, salto de video, preguntas, secuencia y revisión de contenido en PostgreSQL temporal. No acceden a datos de alumnos reales.
