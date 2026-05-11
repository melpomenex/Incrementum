# Manual de usuario incremental

**Su guía completa para dominar la lectura incremental y la repetición espaciada**

---

## Introducción

### ¿Qué es el Incremento?

Incrementum es una poderosa aplicación de aprendizaje que combina dos técnicas probadas:

**Lectura incremental**: procese grandes cantidades de información en fragmentos pequeños y manejables a lo largo del tiempo. En lugar de leer artículos de principio a fin, extrae puntos clave y desarrolla gradualmente la comprensión.

**Repetición espaciada**: revise el material a intervalos científicamente optimizados para maximizar la retención. Algoritmos como FSRS-6, SM-20 y SM-18 predicen cuándo está a punto de olvidar y programan revisiones justo a tiempo.

### Conceptos clave

- **Documentos**: materiales de origen (PDF, EPUB, artículos, vídeos)
- **Extractos**: puntos o secciones clave que has extraído de los documentos
- **Elementos de aprendizaje**: Tarjetas didácticas o tarjetas de preguntas y respuestas creadas a partir de extractos
- **Cola**: elementos programados para revisión, organizados por prioridad
- **Reseñas**: Sesiones en las que recuerdas y calificas activamente tus conocimientos

---

## Empezando

### Primer lanzamiento

Cuando inicie Incrementum por primera vez, verá el **Panel** con cuatro secciones principales:

1. **Cola** - Tu cola de revisión (vacía al principio)
2. **Revisión** - Sesión de revisión activa
3. **Documentos** - Tu biblioteca de documentos
4. **Análisis** - Estadísticas de progreso

### Configuración inicial

1. **Elija un tema** - Vaya a Configuración → Apariencia → Tema
   - 147 temas integrados disponibles (26 modernos, 121 heredados)
   - Pruebe "Modern Dark" o "Material You" para una apariencia moderna

2. **Configurar ajustes de revisión** - Ajustes → Aprendizaje → Algoritmo
   - **Algoritmo**: FSRS-6 (recomendado), SM-20, SM-18 o SM-2
   - **Retención deseada**: 90% (predeterminado): apunta a qué tan bien quieres recordar
   - **Aprender por día**: 20-50 elementos recomendados para principiantes

3. **Configurar categorías** - Configuración → Categorías
   - Crear categorías para diferentes temas (por ejemplo, "Programación", "Ciencias", "Idiomas")
   - Las categorías ayudan a organizar y filtrar sus materiales de aprendizaje.

### Tu primer documento

Importemos su primer documento:

1. Haga clic en **Documentos** en la barra lateral.
2. Haga clic en el botón **Importar** (arriba a la derecha)
3. Elija su método de importación:
   - **Archivo local**: seleccione un archivo PDF, EPUB o de texto
   - **URL**: pega cualquier URL web
   - **Arxiv**: pegue el ID o la URL de un trabajo de investigación
4. Espere el procesamiento
   - Si la segmentación automática está habilitada en Configuración, el documento se dividirá automáticamente en extractos después de la importación.

---

## Gestión de documentos

### Importar formatos

| Formato | Descripción | Caso de uso |
|--------|-------------|----------|
| **PDF** | Formato de documento portátil | Trabajos de investigación, libros electrónicos, documentación |
| **EPUB** | Publicación electrónica | Libros, artículos con texto ajustable |
| **Rebaja** | Archivos `.md` | Documentación técnica, notas |
| **HTML** | Paginas web | Artículos, publicaciones de blogs |
| **Anki (.apkg)** | Paquete de mazo Anki | Migrar desde Anki |
| **SúperMemo** | Exportaciones ZIP | Migrar desde SuperMemo |
| **JSON (.json)** | Archivos de mazos de tarjetas didácticas | Importar mazos con datos de programación |
| **URL** | Cualquier enlace web | Artículos en línea, blogs |
| **Arxiv** | Trabajos académicos | Literatura de investigación |
| **Captura de pantalla** | Captura de pantalla | Capturas rápidas desde cualquier aplicación |

### Importación de documentos

#### Método 1: archivos locales

1. Haga clic en **Documentos** → **Importar**
2. Seleccione **Archivo local**
3. Navegue hasta su archivo y selecciónelo.
4. El incremento:
   - Extraer contenido de texto
   - Calcular el tiempo de lectura y el recuento de palabras.
   - Extraer metadatos (título, autor, etc.)
   - Si la segmentación automática está habilitada (Configuración → Documentos → Proceso automático al importar), divida automáticamente el documento en extractos

#### Método 2: Importación de URL

1. Copie cualquier URL web
2. Haga clic en **Documentos** → **Importar** → **URL**
3. Pega la URL
4. Haga clic en **Importar**
5. Incrementum recupera y procesa el contenido.

**Sitios compatibles:**
- Artículos de noticias (la mayoría de los sitios principales)
- Publicaciones de blogs
- Páginas de documentación
- Medio, Substack, etc.

#### Método 3: Documentos Arxiv

1. Busque un artículo de Arxiv (por ejemplo, `https://arxiv.org/abs/2301.07041`)
2. Copie la URL o la identificación del documento (`2301.07041`)
3. Haga clic en **Documentos** → **Importar** → **Arxiv**
4. Pegue la URL o ID
5. Descargas incrementales:
   - PDF completo
   - Resumen
   - Autores
   - Fecha de publicación
   - Referencias

#### Método 4: Importación de plataforma JSON

Importe mazos de tarjetas desde archivos JSON que incluyan datos de programación (intervalos, factores de facilidad, historial de revisión).

**Importación a través del Selector de archivos:**

1. Haga clic en **Documentos** → **Importar** → **JSON**
2. Seleccione su archivo de mazo `.json`
3. Incrementum crea un documento de mazo e importa todas las cartas, conservando:
   - Programación (intervalos, factores de facilidad, fechas de vencimiento)
   - Revisar el historial (repeticiones, lapsos, tasa de retención)
   - Estados de la tarjeta (nueva, en revisión o suspendida)

**Importación mediante arrastrar y soltar:**

Arrastre un archivo `.json` directamente a la ventana de la aplicación. Si el archivo coincide con el formato de plataforma esperado, se importa automáticamente.

**Formato de cubierta JSON:**

El archivo debe ser un objeto plano que asigne el texto de la pregunta a los datos de la tarjeta:

```json
{
  "¿Cuál es el motor de la célula?": {
    "respuesta": "Las mitocondrias.",
    "asunto": "Biología",
    "deck_name": "Biología celular",
    "factor_facilidad": 2.6,
    "intervalo_días": 7,
    "repeticiones": 3,
    "due_at": "2026-04-20T12:00:00Z"
  }
}
```

**Notas:**
- Cada archivo `.json` crea un mazo. El nombre del mazo proviene del campo `deck_name`.
- Las tarjetas importadas utilizan el algoritmo SM-2 de forma predeterminada. Puede cambiar algoritmos después de la importación.
- Dejar caer el mismo archivo dos veces no creará duplicados: se omitirán las tarjetas existentes.
- Las tarjetas marcadas como `known_pile: true` se importan como suspendidas.

### Visor de documentos

Una vez importado, abra cualquier documento para acceder:

**Características del visor:**
- **Navegación de página**: desplazarse por páginas/secciones
- **Zoom**: ajusta el tamaño del texto
- **Pantalla completa**: lectura sin distracciones
- **Buscar**: busque texto dentro del documento
- **Tabla de contenido**: saltar a las secciones (si están disponibles)**Herramientas de anotación:**
1. **Texto resaltado**: Seleccione texto → Elija color de resaltado
   - Amarillo: Conceptos importantes
   - Verde: Ejemplos
   - Azul: Definiciones
   - Rojo: Puntos críticos
   - Púrpura: Temas relacionados

2. **Crear extracto**: seleccione texto → Haga clic en el botón "Extraer"
   - El extracto aparece en la pestaña Extractos
   - Se puede convertir a tarjeta flash más tarde.

3. **Agregar nota**: seleccione texto → Haga clic en el botón "Nota"
   - Adjunte sus pensamientos/notas
   - Las notas aparecen con extractos.

### Organización del documento

**Categorías:**
- Asignar cada documento a una categoría.
- Filtrar documentos por categoría
- Las categorías heredan extractos y tarjetas.

**Etiquetas:**
- Agregar etiquetas personalizadas a los documentos
- Utilice etiquetas para organización entre categorías
- Ejemplos: `#urgente`, `#investigación`, `#tutorial`

**Buscar:**
- Búsqueda de texto completo en todos los documentos.
- Filtrar por categoría, etiquetas, rango de fechas
- Ordenar por título, fecha, recuento de palabras

---

## El sistema de aprendizaje

### Entendiendo FSRS-6

**FSRS-6** (Programador de repetición espaciada libre) es un algoritmo moderno que:

1. **Seguimiento del estado de la memoria**: modela la potencia de tu memoria para cada tarjeta
2. **Predice el olvido**: estima cuándo olvidarás cada elemento
3. **Optimiza la programación**: programa revisiones en momentos óptimos
4. **Se adapta a ti**: aprende de tus patrones de desempeño

**Métricas clave:**
- **Estabilidad**: cuánto dura una memoria (mayor = más estable)
- **Dificultad**: Qué tan difícil es el elemento para ti (escala 1-10)
- **Recuperabilidad**: Probabilidad actual de recuperación (0-100%)

### Entendiendo SM-18

**SM-18** (SuperMemo 18) es el algoritmo anterior de la familia SuperMemo. Representa una evolución significativa sobre SM-2, introduciendo el modelado de la estabilidad de la memoria y un enfoque basado en datos para el cálculo de intervalos.

SM-18:

1. **Modela el Olvido de Forma Exponencial**: Utiliza la fórmula `R = 0,9^(t/S)` para calcular la recuperabilidad — la probabilidad de que recuerdes un elemento en el tiempo `t` dada su estabilidad `S`
2. **Rastrea la Dificultad de Forma Independiente**: Mantiene un valor de dificultad `D ∈ [0, 1]` para cada elemento, actualizado mediante una fórmula de promedio móvil que se vuelve más receptiva con cada repetición
3. **Utiliza una Matriz SInc 3D**: Busca el factor de aumento de estabilidad en una matriz de 21×21×21 indexada por dificultad, estabilidad y recuperabilidad agrupadas — esta es la inteligencia central de SM-18
4. **Maneja los Fallos con Gracia**: En caso de fallo, reduce la estabilidad en un factor de 0,87 (dividido además por los fallos acumulados) y reinicia el contador de repeticiones, pero conserva la estimación de dificultad
5. **Calcula los Intervalos a partir de la Estabilidad**: Deriva el siguiente intervalo de revisión a partir del objetivo de retención deseado: `intervalo = S × ln(1-FI) / ln(0,9)`

**Métricas clave:**
- **Estabilidad (S)**: Cuánto tiempo persiste un recuerdo antes de deteriorarse (medido en días)
- **Dificultad (D)**: Un valor de 0 (más fácil) a 1 (más difícil), actualizado mediante combinación de promedio móvil después de cada revisión
- **Recuperabilidad (R)**: Probabilidad actual de recuperación, calculada como `0,9^(transcurrido/S)`
- **SInc**: El factor de aumento de estabilidad obtenido de la matriz de 9.261 entradas — cuánto crece la estabilidad después de cada revisión exitosa
- **Fallos**: Conteo de fracasos, que penalizan la estabilidad futura en fallos posteriores

### Entendiendo SM-20

**SM-20** (SuperMemo 20) es el algoritmo más avanzado disponible, obtenido mediante ingeniería inversa de `sm20`. Se basa en los fundamentos de SM-18 mientras introduce el suavizado bayesiano, múltiples versiones de algoritmo y una rama opcional de la familia FSRS.

SM-20:

1. **Soporta Múltiples Fórmulas de Intervalo**: Incluye tres versiones de algoritmo — V2 (compatible con SM-19), V4 (SM-20 propiamente dicho) y V6 (estilo FSRS) — cada una calculando intervalos de manera diferente a partir de las mismas variables de estado
2. **Aplica Suavizado Bayesiano**: Cuando se acumulan suficientes datos de revisión, suaviza los cálculos de intervalo mediante una búsqueda de vecinos 3×3×3 en las matrices de intervalo/cantidad, combinada con un prior bayesiano
3. **Rastrea la Estabilidad con Indexación de Ley de Potencias**: Convierte la estabilidad en índices de matriz usando una transformación de ley de potencias (`S^2,9`), proporcionando mayor resolución a estabilidades bajas y menor a valores altos
4. **Incluye una Rama de la Familia FSRS**: Los elementos pueden usar opcionalmente un modelo de mezcla de 3 expertos (ley de potencias, ley de potencias FSRS y olvido exponencial) con 35 parámetros dedicados para actualizaciones de dificultad y estabilidad
5. **Registra y Aprende de las Revisiones**: Cada revisión actualiza matrices de intervalo y cantidad de 21×21×21 mediante promediado incremental, permitiendo que el algoritmo aprenda intervalos óptimos a partir de tu rendimiento real a lo largo del tiempo

**Métricas clave:**
- **Estabilidad (S)**: Persistencia de la memoria en días, con una transformación de índice de ley de potencias para la búsqueda en matriz (limitada a un máximo de 44.530 días)
- **Dificultad (D)**: Agrupada en 10 niveles mediante `floor(D × 19) + 1`, usada como un eje de la matriz de intervalo
- **Versión**: Selecciona qué fórmula de intervalo usar (V2, V4 o V6)
- **Rama de Algoritmo**: 0 para SM-20 clásico, 1 para el modelo de mezcla de expertos de la familia FSRS
- **Retrov (Retrov):** Estimación de recuperabilidad utilizada por la rama FSRS para ajustes de estabilidad
- **Matrices de Intervalo/Cantidad**: Dos matrices de 9.261 entradas que acumulan tu historial de revisiones y permiten la optimización de intervalos con suavizado bayesiano

**Cómo difiere SM-20 de FSRS-6:**
- FSRS-6 utiliza un conjunto fijo de parámetros entrenados con datos agregados; SM-20 aprende de *tus* revisiones a lo largo del tiempo mediante sus matrices
- El suavizado bayesiano de SM-20 proporciona una forma fundamentada de equilibrar el conocimiento previo con los datos observados
- SM-20 permite cambiar entre fórmulas de intervalo (V2/V4/V6) e incluso tiene una rama de la familia FSRS integrada

### Sistema de calificación

Durante las revisiones, califique cada artículo según su retiro:

| Calificación | Etiqueta | Descripción | Intervalo típico |
|--------|-------|-------------|------------------|
| **1** | Otra vez | Apagón completo | ~10 minutos |
| **2** | Duro | Recordado con importante esfuerzo | 1-2 días |
| **3** | Bueno | Recordado con un poco de pensamiento | 5-7 días |
| **4** | Fácil | La recuperación fue fácil | 10-14 días |

**Intervalos de vista previa:**
Antes de calificar, Incrementum le muestra exactamente cuándo aparecerá cada tarjeta a continuación para las cuatro opciones de calificación. ¡Utiliza esto para optimizar tu agenda!

### Tipos de tarjetas

#### 1. Tarjetas didácticas básicas
Tarjetas anverso/reverso simples

**Anverso:** ¿Cuál es la capital de Francia?
**Volver:** París

**Ideal para:** Hechos, definiciones, vocabulario

#### 2. Eliminación de cloze
Estilo para rellenar espacios en blanco

**Texto:** La capital de {{Francia}} es París.

**Se muestra como:** La capital de _____ es París.

**Ideal para:** Aprendizaje contextual, relaciones

#### 3. Tarjetas de preguntas y respuestas
Parejas de preguntas y respuestas

**P:** Explique la diferencia entre TCP y UDP.
**R:** TCP está orientado a la conexión con entrega garantizada; UDP no tiene conexión y no tiene garantías.

**Ideal para:** Conceptos, explicaciones

#### 4. Oclusión de imagen
Ocultar partes de una imagen (diagramas, tablas)

**Mejor para:** Anatomía, mapas, diagramas

### Creando tarjetas

#### De extractos

1. Mientras lee, seleccione texto importante
2. Haga clic en **Extraer** para crear un extracto.
3. En la pestaña **Extractos**, revisa tus extractos.
4. Haga clic en **Crear tarjeta** en cualquier extracto.
5. Elija el tipo de tarjeta (Flashcard, Cloze, Q&A)
6. Edite el contenido de la tarjeta.
7. Haga clic en **Guardar**

¡La tarjeta ya está programada para revisión!

#### Creación manual

1. Haga clic en **Cola** → **Agregar elemento**
2. Elige el tipo de tarjeta
3. Ingrese el contenido del anverso/reverso
4. Seleccione categoría
5. Haga clic en **Crear**

#### Generación impulsada por IA

Si tienes IA configurada:

1. Seleccione un extracto o sección del documento.
2. Haga clic en **Generar Tarjetas**
3. La IA creará varias tarjetas automáticamente
4. Revise y edite según sea necesario
5. Guarda los mejores

---

## Gerente de cubierta

**Deck Manager** es una vista de pantalla completa para explorar, inspeccionar y editar tus mazos de tarjetas didácticas y sus tarjetas. Ábralo desde el botón **Deck Manager** en la página de inicio de Revisar.

### Plataformas de navegación

- La barra lateral izquierda enumera todos tus mazos con recuentos de cartas e indicadores de vencimiento hoy.
- Haga clic en un mazo para expandirlo; solo se expande un mazo a la vez.
- Los filtros de etiquetas para cada mazo se muestran como pequeñas píldoras debajo del nombre del mazo.

### Lista de tarjetas

Cuando se expande un mazo, sus cartas aparecen en una lista desplazable virtualizada. Cada fila de tarjetas muestra:

- **Insignia estatal**: codificado por colores: azul (Nuevo), naranja (Aprendizaje), verde (Revisión), rojo (Reaprendizaje)
- **Vista previa de la pregunta**: hasta 80 caracteres
- **Fecha de vencimiento** — etiqueta relativa (Hoy, Mañana, 5 días, vencido)
- **Dificultad** — 1–10 mini barra de progreso
- **Intervalo**: intervalo de revisión actual en días
- **Recuento de reseñas**: cuántas veces se revisó la tarjeta
- **Indicador de sanguijuela**: ícono de advertencia amarillo para tarjetas con más de 5 lapsos

### Clasificación y filtrado

**Ordenar** tarjetas por fecha de vencimiento, estado, dificultad, intervalo, recuento de revisiones o lapsos. Haga clic en un botón de clasificación nuevamente para alternar entre ascendente y descendente.

**Filtrar** por:
- **Estado**: nuevo, aprendizaje, revisión, reaprendizaje
- **Estado de vencimiento**: Vencimiento hoy, Vencido, No vencido

**Busca** por texto de pregunta o nombre de etiqueta usando la barra de búsqueda en la parte superior.

### Editor de tarjetas en línea

Haga clic en cualquier fila de tarjeta para expandir un editor en línea debajo de ella:

- Edite **pregunta**, **respuesta** y **etiquetas** directamente; no se necesita modal.
- **Tarjetas de cierre** muestran el texto de cierre con rangos de eliminación resaltados.
- **Tipos de tarjetas complejos** (opción múltiple, oclusión de imagen) muestran una vista previa de solo lectura con un enlace "Editar en Studio".
- Alternar **Suspender/Reanudar** con un solo clic.
- Los cambios se guardan con **actualizaciones optimistas**: la interfaz de usuario se actualiza instantáneamente y se revierte si falla el guardado.

### Panel de estadísticas de mazo

La barra lateral derecha muestra estadísticas del mazo ampliado:

- **Vence hoy** — recuento de tarjetas vencidas ahora
- **Tasa de retención**: estimación basada en el índice de retraso
- **Dificultad media** — en todas las cartas del mazo
- **Recuento de sanguijuelas**: tarjetas con más de 5 lapsos (haz clic para filtrar solo por sanguijuelas)
- **Desglose de madurez**: barra apilada que muestra la distribución de tarjetas Nuevo/Aprendizaje/Joven/Maduro
- **Previsión de 7 días**: minigráfico que muestra los recuentos vencidos proyectados para la próxima semana
- **Estado de la memoria FSRS**: estabilidad y dificultad promedio con un indicador de estado codificado por colores

### Operaciones masivas

Seleccione varias tarjetas usando las casillas de verificación, luego use la barra de herramientas de acciones masivas:

- **Suspender/Reanudar** — suspensión de alternancia por lotes
- **Eliminar**: elimina las tarjetas seleccionadas (con confirmación)
- **Volver a etiquetar**: agregue o elimine etiquetas en todas las tarjetas seleccionadas a la vez

### Atajos de teclado

| Clave | Acción |
|-----|--------|
| `Escape` | Contraer el editor en línea o contraer la plataforma expandida |

---

## Proceso de revisión

### Iniciar una sesión de revisión

1. Haga clic en **Revisar** en la barra lateral.
2. Ver las tarjetas que vencen hoy (y las próximas)
3. Haga clic en **Iniciar revisión** para comenzar.

### Revisar interfaz

**Visualización de tarjeta:**
- Se muestra el frente de la tarjeta (pregunta o mensaje)
- Presione **Espacio** o haga clic para revelar la respuesta
- La respuesta aparece a continuación.

**Sesiones de Repaso Mixtas (Tarjetas + Documentos):**
- Las sesiones de revisión pueden incluir **elementos de aprendizaje** y **documentos** que deben leerse.
- Cuando aparece un documento, puedes abrirlo directamente desde la tarjeta de sesión.
- Calificar un documento programa su próxima fecha de lectura, al igual que una tarjeta programa su próxima revisión.

**Interfaz de calificación:**
Después de revelar la respuesta, aparecen cuatro botones de calificación:

```
[Otra vez] [Difícil] [Bueno] [Fácil]
  ~10m ~2d ~7d ~14d
```

Cada botón muestra la **próxima fecha de revisión**. ¡Esta es la función **Intervalo de vista previa**!

**Acciones de recuperación (Revisar inspector de cola):**
Úselos cuando el cronograma de un elemento de aprendizaje necesite un empujón rápido:

- **Comprimir intervalos**: acerca la siguiente revisión (intervalo más corto).
- **Reprogramar inteligentemente**: mueva el elemento a "vencimiento ahora".
- **Frecuencia de degradación**: elimina la siguiente revisión (intervalo más largo).

Estas acciones se aplican a **elementos de aprendizaje únicamente** y actualizan el cronograma inmediatamente.

### Atajos de teclado (modo de revisión)

| Clave | Acción |
|-----|--------|
| `Espacio` | Mostrar respuesta |
| `1` | Califica "Otra vez" |
| `2` | Califica "Difícil" |
| `3` | Califica "Bueno" (predeterminado recomendado) |
| `4` | Califica "Fácil" |
| `Ctrl+Entrar` | Mostrar respuesta |
| `Ctrl+1/2/3/4` | Calificar sin mostrar respuesta |
| `Esc` | Pausar/finalizar sesión |
| `Ctrl+E` | Editar tarjeta actual (aún no implementada) |
| `Ctrl+D` | Eliminar tarjeta actual (también se usa globalmente para "Ir al panel") |

### Gestión de sesiones

**Revisar características de la sesión:**
- **Barra de progreso**: muestra las tarjetas restantes
- **Seguimiento del tiempo**: muestra la duración de la sesión
- **Temporizador de descanso**: Opcional rompe cada N cartas
- **Límites de sesión**: establezca tarjetas máximas o tiempo por sesión

**Finalizar una sesión:**
- Haga clic en **Finalizar** cuando haya terminado
- O establecer un límite (Configuración → Revisar → Límites de sesión)
- Las tarjetas sin terminar deben entregarse para la próxima sesión.

### Estrategias de revisión

#### Rutina de revisión diaria

1. **Sesión matutina** (15-30 min)
   - Tarjetas de revisión que deben entregarse al día siguiente
   - Centrarse en elementos más difíciles

2. **Sesión vespertina** (15-30 min)
   - Tarjetas de revisión agregadas durante el día.
   - Crea nuevas tarjetas a partir de la lectura.

#### Gestión del trabajo pendiente

Si tiene muchas tarjetas vencidas (>100):

1. **Céntrese en tarjetas nuevas**: limite la revisión a 20-30 por día
2. **Usa filtros**: revisa por categoría (no abrumes)
3. **Cram Sessions**: sesiones de puesta al día los fines de semana
4. **Ajustar retención**: reducir temporalmente al 85% (menos revisiones)

#### Cómo lidiar con las cartas "Otra vez"

Las tarjetas clasificadas como "Otra vez" reaparecen rápidamente (10 min). Estrategias:

- **Reaprendizaje Inmediato**: Revisar nuevamente las tarjetas dentro de la misma sesión
- **Sesión separada**: revise nuevamente las tarjetas más tarde durante el día
- **Comprensión de problemas**: si hay muchas respuestas en contra, es posible que la tarjeta esté mal escrita

---

## Gestión de colas

### Entendiendo la cola

La **Cola** contiene todos los elementos programados para revisión, organizados por:

- **Fecha de vencimiento**: los artículos que vencen antes aparecen primero
- **Prioridad**: prioridad establecida por el usuario (0-100)
- **Categoría**: Área temática
- **Tipo de tarjeta**: Flashcard, cloze, etc.

### Vistas de cola

#### Vista pendiente
Muestra los artículos vencidos hoy y vencidos, ordenados por hora de vencimiento

#### Vista programada
Muestra todos los elementos programados, incluidas revisiones futuras

#### Nueva vista
Muestra tarjetas recién creadas que aún no se han revisado

### Operaciones en cola

**Filtrado:**
- Por categoría (por ejemplo, "Mostrar sólo programación")
- Por tipo de tarjeta (por ejemplo, "Mostrar sólo tarjetas Cloze")
- Por rango de prioridad (por ejemplo, "Mostrar prioridad 80+")

**Clasificación:**
- Fecha de vencimiento (predeterminada)
- Prioridad
- Dificultad
- Aleatorio (para variedad)

**Acciones masivas:**
1. Seleccione varios elementos (casillas de verificación)
2. Elige la acción:
   - **Cambiar categoría**: pasar a una categoría diferente
   - **Establecer prioridad**: prioridad de actualización masiva
   - **Suspender**: Ocultar temporalmente de las reseñas
   - **Eliminar**: Eliminar permanentemente

### Sistema de prioridades

Establezca prioridad 0-100 en cualquier elemento:

- **100**: Crítico (debe aprender)
- **80-90**: Importante
- **60-70**: Prioridad normal
- **40-50**: prioridad baja
- **0-20**: Archivo/referencia

**Programación prioritaria:**
Los elementos de mayor prioridad se muestran con más frecuencia en reseñas mixtas.

### Colas inteligentes

Crea colas personalizadas con filtros:

**Colas de ejemplo:**
- "Enfoque de hoy": tarjetas vencidas de la categoría principal
- "Revisión rápida": Tarjetas fáciles, prioridad < 50
- "Deep Dive": Tarjetas duras de la categoría de investigación
- "Preparación para el examen": todas las tarjetas de la categoría "Biología"

**Creando cola inteligente:**
1. Haga clic en **Cola** → **Colas guardadas**
2. Haga clic en **Nueva cola**
3. Establecer filtros y orden de clasificación
4. Nombra y guarda

---

## Análisis y seguimiento del progreso

### Descripción general del panel

El panel de Analytics proporciona información completa:

**Métricas clave:**
- **Tarjetas vencidas hoy**: número en espera de revisión
- **Total de tarjetas**: todas las tarjetas del sistema
- **Tasa de retención**: Porcentaje recordado
- **Racha de estudios**: días consecutivos de actividad
- **Tarjetas aprendidas**: Total de tarjetas creadas

### Gráficos de actividades

**Actividad de 30 días:**
- Gráfico de barras que muestra reseñas por día.
- Codificado por colores por clasificación (Otra vez/Difícil/Bueno/Fácil)
- Identificar patrones en tus hábitos de estudio.

**Curva de aprendizaje:**
- Gráfico de líneas que muestra el total de tarjetas a lo largo del tiempo.
- Realice un seguimiento del crecimiento de su base de conocimientos

### Estadísticas

**Revisar estadísticas:**
- Total de revisiones completadas
- Distribución de calificación promedio
- Revisiones por día/semana/mes

**Estadísticas de la tarjeta:**
- Tarjetas totales por categoría
- Tarjetas por tipo (Flashcard, Cloze, etc.)
- Tarjetas nuevas versus tarjetas maduras

**Métricas de algoritmo (FSRS/SM-18):**
- Estabilidad media
- Dificultad media
- Retención prevista
- Rendimiento de la memoria

### Desglose de categorías

Ver desempeño por área temática:

- Tarjetas por categoría
- Tasa de retención por categoría
- Nivel de actividad por categoría
- Identificar áreas fuertes/débiles.

### Goles y rachas

**Establecer objetivos:**
1. Haga clic en **Análisis** → **Objetivos**
2. Establezca objetivos diarios/semanales:
   - Tarjetas para revisar
   - Tarjetas para crear
   - tiempo de estudio
3. Seguimiento de los indicadores visuales de progreso

**Rachas de estudio:**
- Días consecutivos con actividad
- Racha actual mostrada en el tablero
- Mantener rachas de motivación.

### Estadísticas de exportación

Exporte sus datos para su análisis:

1. Haga clic en **Análisis** → **Exportar**
2. Elige formato:
   - **CSV**: compatible con hojas de cálculo
   - **JSON**: para análisis personalizados
   - **PDF**: Informe imprimible
3. Seleccione el rango de fechas
4. Incluya métricas (reseñas, tarjetas, retención)

---

## Configuración y personalización

### Configuración de apariencia

#### Temas
- **147 temas integrados**: 26 temas modernos seleccionados y 121 temas heredados (oscuros y claros)
- **Vista previa en vivo**: vea los cambios de tema al instante
- **Temas personalizados**: crea tus propios esquemas de color

**Opciones de tema:**
- Oscuro moderno (oscuro predeterminado)
- Material usted (Diseño de materiales 3)
- Luz de aurora
- Azul hielo
- Nocturne Dark, Snow, Cartographer, Focus y muchos más...

#### Creación de temas personalizados

1. Configuración → Apariencia → Personalizar tema
2. Ajustar colores:
   - color primario
   - Color de fondo
   - Color del texto
   - Colores de acento
3. Guardar como tema personalizado
4. Exportar/importar temas para compartir

#### Opciones de visualización
- **Modo denso**: muestra más contenido por pantalla
- **Familia de fuentes**: elija entre 65 fuentes integradas en 5 categorías:
  - Sans-serif (25): Inter, Poppins, Montserrat, Space Grotesk y más
  - Serif (5): Merriweather, Playfair Display, Lora, Crimson Text, Bitter
  - Monospace (31): JetBrains Mono, Fira Code, Source Code Pro y más
  - Pantalla (2): Comic Neue, pantalla mono principal
  - Sistema (4): Sistema UI, Sistema Serif, Sistema Sans, Sistema Mono
- **Tamaño de fuente**: Ajustar el tamaño del texto
- **Animación de tarjeta**: activar/desactivar animaciones
- **Mostrar intervalos de vista previa**: muestra las próximas fechas de revisión

### Configuración de aprendizaje

#### Selección de algoritmo

Incrementum admite cuatro algoritmos de programación. Elige el que mejor se adapte a tu estilo de aprendizaje:

**FSRS-6 (Recomendado):**
- Moderno, respaldado por investigaciones
- Se adapta a la memoria individual
- Predice tiempos de olvido
- Mejor retención con menos reseñas

**SM-20 (SuperMemo 20):**
- Algoritmo más avanzado, obtenido mediante ingeniería inversa de sm20.exe vía Ghidra
- Admite tres versiones de fórmulas de intervalo (V2/V4/V6)
- El suavizado bayesiano aprende intervalos óptimos de tus datos de revisión reales
- Rama opcional de la familia FSRS con modelo de olvido de 3 expertos
- Construye conocimiento a lo largo del tiempo mediante matrices de intervalo/cantidad de 21×21×21

**SM-18 (Súper Memo 18):**
- El último algoritmo SuperMemo, realizado mediante ingeniería inversa a partir de la aplicación original.
- Utiliza una matriz de búsqueda 3D SInc (aumento de estabilidad) en dificultad, estabilidad y recuperabilidad.
- Seguimiento explícito de dificultades con actualizaciones del promedio final
- Modelo de curva de olvido exponencial: `R = 0,9^(t/S)`
- Manejo sofisticado de fallas con reducción de estabilidad dependiente del lapso

**SM-2 (Clásico):**
- Algoritmo tradicional SuperMemo 2 (documentado públicamente)
- Más simple, predecible
- Se requieren más revisiones

#### Parámetros

**Retención deseada:** 0,70 - 0,95
- **90%** (predeterminado): equilibra la retención de saldos y la carga de revisión
- **85%**: Menos reseñas, ligeramente menos retención
- **95%**: retención máxima, más reseñas

**Aprendizaje por día:** 10 - 100
- **20** (predeterminado): manejable para la mayoría de los usuarios
- **50**: Para periodos de estudio intensivos
- **10**: carga de revisión ligera

**Revisión por día:** 50 - 500
- **200** (predeterminado): límite diario razonable
- **500**: Para eliminar el trabajo atrasado
- **50**: Días de revisión ligeros

#### Configuración de intervalo

**Intervalos de tarjetas nuevas:**
- Intervalo de graduación (buena calificación): 1-10 días
- Intervalo fácil: 3-21 días
- Intervalo mínimo: 1 día

**Intervalo máximo:**
- Limitar los intervalos más largos (365 días por defecto)
- Evita que las tarjetas se programen con demasiada antelación

**Gorra de seguridad de forma larga (vídeos/artículos):**
- Para vídeos/artículos largos, las calificaciones positivas ("Bueno"/"Fácil") tienen en cuenta la cobertura.
- Si dedicas menos del **25%** del tiempo estimado al contenido, el siguiente intervalo tendrá un límite de **1 día**.
- Si gastas menos del **50 %**, el siguiente intervalo tendrá un límite de **2 días**.
- Si gastas menos del **75 %**, el siguiente intervalo tendrá un límite de **4 días**.
- Esto evita que el contenido de formato largo se programe demasiado tarde después de un progreso parcial.
- Cuando se aplica, el motivo del programador incluye una nota de **límite según la duración** para mayor transparencia.

### Revisar configuración

#### Límites de sesión**Límites de tiempo:**
- Duración máxima de la sesión (minutos)
- Intervalos de descanso
- Finalización automática después del límite

**Límites de la tarjeta:**
- Tarjetas máximas por sesión
- Límite separado para tarjetas nuevas
- Nuevamente límite de tarjeta

#### Opciones de calificación

**Atajos de calificación:**
- Personalizar atajos de teclado
- Establecer calificación predeterminada (tecla espaciadora)
- Activar/desactivar atajos de calificación

**Avance automático:**
- Pasar automáticamente a la siguiente tarjeta después de calificar
- Retraso antes del avance automático (segundos)

### Configuración general

#### Guardar automáticamente
- Intervalo de guardado (segundos)
- Ahorre en la calificación de la tarjeta
- Guardar al cambiar de pestaña

#### Documentos recientes
- Máximo de artículos recientes (5-50)
- Borrar documentos recientes

#### Categoría predeterminada
- Establecer categoría para nuevos artículos
- Puede anularse por elemento

#### Estadísticas
- Seguimiento del tiempo de revisión
- Seguimiento del recuento de tarjetas
- Intervalo de actualización (en tiempo real versus periódico)

### Configuración de sincronización

#### Sincronización del navegador
- Activar/desactivar la sincronización de la extensión del navegador
- Intervalo de sincronización (minutos)
- Resolución de conflictos (victorias locales/victorias remotas/preguntar)

#### Sincronización en la nube

**Proveedores admitidos:**
- Buzón
-Google Drive
-OneDrive

**Opciones de sincronización:**
- Sincronización automática de cambios
- Intervalo de sincronización (manual, 15 min, 30 min, 1 h)
- Sincronización al iniciar/cerrar la aplicación
- Manejo de conflictos

#### Copia de seguridad y restauración

Incrementum proporciona un sistema completo de copia de seguridad y restauración para proteger sus datos de aprendizaje y migrar entre dispositivos.

#### Copia de seguridad completa de la aplicación

**Lo que se respalda:**
- **Configuración**: todas las preferencias, temas, parámetros de aprendizaje
- **Documentos**: todos los documentos importados con metadatos
- **Extractos**: todos los aspectos destacados y el contenido extraído
- **Elementos de aprendizaje**: todas las tarjetas didácticas, eliminaciones de cloze, tarjetas de preguntas y respuestas
- **Datos de programación**: estados de memoria del algoritmo (estabilidad, dificultad, intervalos), fechas de vencimiento
- **Colecciones**: todas las colecciones y asignaciones de documentos.
- **Estado de la interfaz de usuario**: estado de la barra lateral, preferencias de tema
- **Opcional**: archivos de documentos reales (PDF, EPUB, etc.)

**Creando una copia de seguridad:**

1. Vaya a **Configuración → Importar/Exportar → Copia de seguridad completa de la aplicación**
2. Haga clic en **Abrir copia de seguridad y restauración**
3. Seleccione **Exportar copia de seguridad**
4. Agregue una etiqueta opcional (por ejemplo, "Antes de formatear la PC")
5. Elija si desea incluir archivos de documentos:
   - **Solo metadatos**: archivo más pequeño (~KB-MB), vuelva a importar archivos por separado
   - **Incluir archivos**: archivo más grande (~MB-GB), copia de seguridad completa e independiente
6. Haga clic en **Exportar copia de seguridad** y guarde el archivo `.incrementum`.

**Formato de archivo:**
- Extensión: `.incrementum`
- Formato: JSON con comentario de encabezado
- Denominación: `incrementum-backup-[etiqueta]-[fecha]-[hora].incrementum`

**Restaurando desde Copia de Seguridad:**

1. Vaya a **Configuración → Importar/Exportar → Copia de seguridad completa de la aplicación**
2. Haga clic en **Abrir copia de seguridad y restauración**
3. Seleccione **Importar copia de seguridad**
4. Elija su archivo `.incrementum`
5. Obtenga una vista previa de lo que hay en la copia de seguridad:
   - Recuento de documentos
   - Recuento de extractos
   - Recuento de elementos de aprendizaje
   - Recuento de colecciones
   - Si se incluyen archivos
6. Configure las opciones de importación (opcional):
   - **Qué importar**: elija tipos de datos específicos
   - **Manejo de duplicados**: omitir, reemplazar o fusionar
   - **Importar archivos**: si se deben restaurar archivos de documentos
7. Haga clic en **Importar copia de seguridad**
8. Espere a que se complete la importación (se muestra el progreso)

**Estrategias de manejo duplicadas:**
- **Omitir**: omitir elementos que ya existen (recomendado para la mayoría de los casos)
- **Reemplazar**: sobrescribe elementos existentes con versiones de respaldo
- **Fusionar**: crea nuevas copias de todos los elementos (puede crear duplicados)

**Casos de uso:**| Escenario | Enfoque recomendado |
|----------|---------------------|
| **Migrar a una computadora nueva** | Exportar con archivos, importar en una máquina nueva |
| **Copia de seguridad antes de cambios importantes** | Copia de seguridad rápida solo de metadatos |
| **Sincronización entre dispositivos** | Flujo de trabajo de exportación/importación |
| **Compartir colecciones** | Exportar colecciones específicas |
| **Archivar datos antiguos** | Exportar y almacenar a largo plazo |
| **Restaurar después de reformatear** | Importar copia de seguridad completa con archivos |

**Notas importantes:**
- **Preservación de programación**: todos los datos de programación (estabilidad, dificultad, fechas de vencimiento) para todos los tipos de algoritmos se conservan exactamente
- **Rutas de archivos**: al importar sin archivos, deberá volver a importar los documentos originales. Incrementum los unirá por hash de contenido y restaurará los metadatos.
- **Compatibilidad de versiones**: las copias de seguridad son compatibles con versiones posteriores, pero es posible que no funcionen con versiones anteriores de la aplicación.
- **Almacenamiento**: mantenga las copias de seguridad seguras: contienen sus datos personales de aprendizaje

#### Opciones de copia de seguridad heredadas

**Copias de seguridad automáticas:**
- Frecuencia de respaldo (diaria, semanal)
- Máximo de copias de seguridad para conservar (5-50)
- Ubicación de la copia de seguridad

**Copia de seguridad manual:**
- Configuración → Copia de seguridad → Crear copia de seguridad
- Elige la ubicación
- Incluye todos los datos y configuraciones.

**Restaurar:**
- Configuración → Copia de seguridad → Restaurar
- Seleccionar archivo de copia de seguridad
- Confirmar restauración (reemplaza los datos actuales)

### Atajos de teclado

#### Atajos globales

| Atajo | Acción |
|----------|--------|
| `Ctrl+K` | Abrir paleta de comandos |
| `Ctrl+P` | Abrir paleta de comandos (alternativa) |
| `Ctrl+,` | Abrir configuración |
| `Ctrl+D` | Ir al panel |
| `Ctrl+Q` | Ir a la cola |
| `Ctrl+R` | Iniciar revisión |
| `Ctrl+O` | Abrir documento |
| `Ctrl+N` | Documento de importación (alternativo) |

#### Personalización

1. Configuración → Combinaciones de teclas
2. Seleccione la acción para reasignar
3. Presione nueva combinación de teclas
4. Guardar cambios

**Restablecer los valores predeterminados:** Haga clic en el botón "Restablecer todo".

### Configuración de integración

#### Integración de Anki

**Configuración:**
1. Configuración → Integraciones → Anki
2. Configure la URL de AnkiConnect (predeterminada: `http://localhost:8765`)
3. Prueba de conexión
4. Habilite la sincronización bidireccional

**Opciones de sincronización:**
- Sincronización con Anki al crear la tarjeta
- Intervalos de sincronización de Anki
- Mapeo de mazo (categoría Incrementum → mazo Anki)
- Sincronización de etiquetas

#### Integración de obsidiana

**Configuración:**
1. Configuración → Integraciones → Obsidiana
2. Establecer la ruta de la bóveda
3. Configurar plantilla
4. Habilite la sincronización

**Funciones de sincronización:**
- Exportar tarjetas a notas de obsidiana.
- Importar notas como tarjetas.
- Integración de notas diarias.
- Sincronización de etiquetas bidireccional

#### Integración de NotebookLM

Utilice NotebookLM dentro de Incrementum para investigar, generar artefactos de estudio y guardar extractos revisables.

**Configuración:**
1. Configuración → Funciones → habilitar **NotebookLM**
2. Configuración → Integraciones → **NotebookLM**
3. Haga clic en **Conectar** y elija el proveedor (`mock` para realizar pruebas, `cli` para NotebookLM en vivo)
4. Seleccione o cree un cuaderno activo

**Qué puedes hacer:**
- Haga preguntas en el chat de NotebookLM directamente desde Incrementum
- Ejecutar indicaciones de investigación (investigación en cuaderno asistida por web)
- Generar artefactos:
  - Tarjetas didácticas
  - Prueba
  - Informe / Guía de estudio
  - Mapa mental
  - Tabla de datos
  - Descripción general de audio
  - Descripción general del vídeo
- Vista previa de artefactos en la aplicación (incluidos reproductores de audio/vídeo cuando hay medios disponibles)
- Sincronizar tarjetas didácticas/elementos de cuestionario generados en la cola de revisión de Incrementum**Guardar respuestas de chat como extractos:**
1. Abra el chat del espacio de trabajo de NotebookLM
2. En cualquier respuesta del asistente, haga clic en **Guardar como extracto**
3. Opcional: resalte primero parte de la respuesta para guardar solo el texto seleccionado
4. Incrementum crea un extracto vinculado a NotebookLM con metadatos de hilo/fuente
5. Las respuestas guardadas muestran un indicador **ya guardadas** para evitar duplicados

**Preguntas y respuestas sobre el documento + Flujo de trabajo de NotebookLM:**
1. Abrir un documento en Incrementum
2. Utilice **Preguntas y respuestas sobre documentos** con el modo de investigación NotebookLM
3. Editar/refinar el texto de respuesta generado en línea
4. Cree extractos de la respuesta refinada.
5. Genere tarjetas didácticas/cloze/elementos de preguntas y respuestas a partir de esos extractos.

**Solución de problemas:**
- Si la vista previa del artefacto indica que los medios no están disponibles, espere a que finalice la generación de NotebookLM y vuelva a abrir el artefacto.
- Si utiliza el proveedor `cli`, asegúrese de que el sidecar/CLI de NotebookLM esté disponible en su compilación.
- Si cambió de proveedor o la autenticación expiró, vuelva a conectarse en Integraciones → NotebookLM.

#### Servidores MCP

**Servidores de protocolo de contexto modelo (MCP):**

Conecte hasta 3 servidores MCP para funciones impulsadas por IA:

1. Configuración → AI → Servidores MCP
2. Agregar la URL del servidor
3. Configurar la autenticación
4. Habilite las funciones:
   - Generación de tarjetas inteligentes
   - Resumen de contenido
   - Asistencia con preguntas y respuestas
   - Etiquetado automático

### Configuración de IA

#### Proveedores de control de calidad

Configure proveedores de IA para la generación de tarjetas:

**Proveedores admitidos:**
-OpenAI (GPT-4, GPT-3.5)
- Antrópico (Claude)
- Ollama (modelos locales como Llama, Mistral, Qwen)
- OpenRouter (acceso a muchos modelos, incluidos niveles gratuitos)
- llama.cpp / vLLM (cualquier modelo GGUF a través de API compatible con OpenAI)
- Puntos finales API personalizados

**Configuraciones por proveedor:**
- Clave API
- Nombre del modelo
- Temperatura (creatividad)
- Fichas máximas
- Aviso del sistema

#### Generación automática

**Generación de tarjeta:**
- Habilitar la generación automática a partir de extractos.
- Número de tarjetas por extracto
- Umbral de calidad
- Requerir aprobación manual

**Resumen:**
- Resumir automáticamente extractos largos
- Longitud del resumen (corto, medio, largo)
- Incluir en el contenido de la tarjeta.

#### Ventana de contexto

**Límites de tokens:**
- Máximo de tokens por solicitud
- Contexto de tarjetas relacionadas.
- Longitud del fragmento del documento

---

## Funciones avanzadas

### Gráfico de conocimiento

Visualice las conexiones entre sus conocimientos:

**Vista de gráfico 2D:**
- Nodos: Documentos, extractos, tarjetas.
- Bordes: Relaciones (misma categoría, etiquetas, referencias)
- Diseño dirigido por la fuerza
- Navegación interactiva

**Esfera de conocimiento 3D:**
- Visualización 3D inmersiva
- Girar, hacer zoom, desplazarse
- Codificado por colores por categoría
- Haga clic en los nodos para ver el contenido

**Características:**
- Buscar y filtrar
- Resaltar elementos relacionados
- Exportar como imagen
- Identificar lagunas de conocimiento

### Lector RSS

Aprenda de sus feeds favoritos:

#### Directorio de boletines

Descubra y suscríbase a boletines populares directamente en Incrementum:

**Acceda al directorio de boletines:**
1. Haga clic en la pestaña **RSS**
2. Haga clic en el **ícono del boletín** (📬) en el encabezado.
3. Busque boletines informativos seleccionados por categoría

**Categorías de boletines:**
- **Tecnología**: noticias tecnológicas, programación, IA
- **Ciencia**: investigaciones, descubrimientos, conocimientos científicos.
- **Finanzas**: inversiones, mercados, finanzas personales
- **Negocios**: Emprendimiento, estrategia, creación de empresas.
- **Salud**: Bienestar, medicina, vida sana
- **Estilo de vida**: cultura, viajes, comida, desarrollo personal.
- **Política**: política, gobernanza, actualidad
- **Arte y literatura**: libros, arte, música, escritura creativa
- **Educación**: aprendizaje, enseñanza, conocimientos académicos
- **Crypto y Web3**: Blockchain, DeFi, noticias sobre criptomonedas

**Suscripción a boletines:**
1. Explore el directorio o busque un boletín
2. Haga clic en **Suscribirse** en cualquier boletín.
3. El feed se agrega automáticamente a tus suscripciones RSS.
4. Aparecerán nuevos números en tu lector de RSS

**Descubrimiento del feed del boletín:**

Incrementum puede descubrir automáticamente canales RSS de plataformas de boletines populares:

- **Subpila**: agregue `/feed` a cualquier URL de subpila
  - Ejemplo: `https://author.substack.com` → `https://author.substack.com/feed`
- **Beehiiv**: descubre automáticamente el punto final `/feed`
- **Blogs fantasma**: descubre automáticamente el punto final `/rss/`
- **Botón**: agregue `/feed` a la URL del boletín
- **Genérico**: descubre automáticamente feeds RSS a partir de etiquetas HTML `<link>`

**Suscripción rápida desde URL:**
1. Copie la URL de cualquier boletín
2. Haga clic en **Agregar fuente** en la pestaña RSS.
3. Pega la URL
4. Incrementum descubre automáticamente la fuente RSS
5. Haga clic en **Agregar feed** para suscribirse.

**Búsqueda de canales RSS de boletines:**

La mayoría de las plataformas de boletines publican canales RSS:

| Plataforma | Patrón de alimentación RSS | Ejemplo |
|----------|------------------|---------|
| Subpila | `https://[autor].substack.com/feed` | `https://stratechery.substack.com/feed` |
| Abeja | `https://[boletín].beehiiv.com/feed` | `https://banklesshq.beehiiv.com/feed` |
| Fantasma | `https://[blog].ghost.io/rss/` | `https://blog.ghost.io/rss/` |
| Abotonado | `https://buttondown.email/[nombre]/feed` | `https://buttondown.email/newsletter/feed` |

**Plataformas compatibles:**
- Substack (la mayoría de los boletines)
- Beehiiv
- Blogs fantasma
- Botón
-ConvertirKit
- revista
- Publicaciones medianas
- Sitios de WordPress (genéricos)

**Importar/Exportar suscripciones a boletines:**
- **Importación OPML**: Importación desde otros lectores RSS
- **Exportación OPML**: haga una copia de seguridad de sus suscripciones al boletín
- Compartir suscripciones entre dispositivos

#### Gestión de feeds

1. Haga clic en la pestaña **RSS**
2. Haga clic en **Agregar fuente**
3. Ingrese la URL del feed
4. Establecer el intervalo de actualización
5. Habilite la importación automática a la cola

**Características del feed:**
- Encuesta automática para nuevos artículos.
- Importar artículos como documentos.
- Extraer puntos clave automáticamente
- Crear tarjetas a partir de feeds.**Feeds recomendadas:**
- Sitios de noticias (BBC, CNN, etc.)
- Blogs en tu campo.
- Revistas de investigación
- Noticias tecnológicas (Hacker News, Ars Technica)

### Integración de YouTube

**Importación de vídeo:**
1. Copie la URL de YouTube
2. Importar como documento
3. El incremento recupera:
   - Metadatos de vídeo
   - Transcripción (si está disponible)
   - Información del capítulo
   - Comentarios (opcional)

**Características de la transcripción:**
- Transcripción completa con capacidad de búsqueda
- Crear extractos de la transcripción
- Sincronizar transcripción con video
- Crear tarjetas en marcas de tiempo.

**Panel de funciones de vídeo:**
- Abra el botón **Paneles** en el visor de vídeo.
- Pestañas para marcadores, capítulos, transcripción
- Los marcadores guardan marcas de tiempo para saltos rápidos
- Los capítulos se pueden obtener de YouTube.

**Extractos de vídeo:**
1. Abra **Paneles** → **Extractos de vídeo**
2. Haga clic en **Nuevo**
3. Establecer inicio/fin y texto de transcripción opcional
4. Guarde para crear un clip reutilizable.

**Integración de SponsorBlock:**
- Saltar automáticamente segmentos patrocinados
- Filtrado de categorías
- Contribuir a SponsorBlock

**Seguimiento del progreso:**
- Reanudar desde la última posición
- Marcar las secciones vistas
- Ver historial

### Transcripción de vídeo local (aplicación de escritorio)

Genere transcripciones para archivos de video locales en la aplicación de escritorio Tauri.

1. Abre un vídeo local
2. Abra **Paneles** → **Transcripción**
3. Elige modelo e idioma
4. Haga clic en **Generar transcripción**

Notas:
- La transcripción se ejecuta localmente en su máquina
- Requiere una ruta de archivo local (no disponible para videos solo web)

### Transcripción de audiolibros (aplicación de escritorio)

Cree transcripciones de audiolibros para permitir la selección y sincronización de texto.

1. Importar un audiolibro
2. Abra el visor de audiolibros.
3. Haga clic en **Iniciar transcripción local**
4. Supervise el progreso y abra el panel de transcripción.

Notas:
- La transcripción se ejecuta localmente en su máquina
- Los modelos se gestionan en **Configuración → Transcripción de audio**

### OCR (reconocimiento óptico de caracteres)

Extraer texto de imágenes:

**Proveedores admitidos:**
- GLM-OCR (Local) — OCR multimodal a través de llama.cpp o vLLM
- Teseracto (Local)
- Visión de la nube de Google
- Extracto de texto de AWS
- Visión por computadora Azure
- Marcador (local): PDF a Markdown
- Turrón (Local) — documentos científicos con matemáticas

**Casos de uso:**
- Captura de pantalla
- Documentos escaneados
- Imágenes con texto
- Notas escritas a mano

**Configuración (proveedores de nube):**
1. Configuración → OCR
2. Elija el proveedor (Google, AWS o Azure)
3. Configurar la clave API y las credenciales
4. Seleccione idioma(s)
5. Prueba con imagen de muestra

**Configuración (GLM-OCR con llama.cpp):**

llama.cpp proporciona un servidor LLM local liviano para GLM-OCR sin requerir una GPU. Utiliza la API compatible con OpenAI en el puerto 8080.

1. **Compile llama.cpp** (si aún no está creado):
   ```golpecito
   clon de git https://github.com/ggml-org/llama.cpp.git
   cd llama.cpp
   cmake -B construir
   cmake --build build --config Lanzamiento -j$(nproc)
   ```

2. **Descargar un modelo multimodal** (formato GGUF):
   ```golpecito
   # Qwen2.5-VL (recomendado para OCR)
   huggingface-cli descargar bartowski/Qwen2.5-VL-7B-Instruct-GGUF \
     Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf --modelos de directorio local/
   ```

3. **Inicie el servidor**:
   ```golpecito
   ./build/bin/llama-servidor \
     -m modelos/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf \
     --puerto 8080 --host 0.0.0.0 -c 16384 -t $(nproc)
   ```

4. **Configurar en incremento**:
   - Configuración → OCR → Proveedor: **GLM-OCR (Local)**
   - Backend: **vLLM (GPU)** (este es el modo llama.cpp/vLLM; funciona para ambos)
   - Punto final: `http://localhost:8080/v1`
   - Modelo: el nombre de archivo de su modelo (por ejemplo, `Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf`)**Consejos de rendimiento:**
- Utilice `-c 16384` o superior para documentos largos (el valor predeterminado 4096 es demasiado pequeño para la mayoría de las tareas de OCR)
- Utilice `-t $(nproc)` para utilizar todos los subprocesos de la CPU
- La cuantificación Q4_K_M ofrece la mejor relación calidad/velocidad para la inferencia de la CPU
- Para aceleración de GPU, cree llama.cpp con soporte CUDA, Metal o Vulkan

**Configuración (GLM-OCR con vLLM):**

vLLM proporciona inferencia acelerada por GPU para modelos más grandes. Requiere una GPU NVIDIA con suficiente VRAM.

```golpecito
instalación de pip -U vllm
vllm sirve zai-org/GLM-OCR --allowed-local-media-path / --port 8080
```

Luego configure Incrementum de la misma manera (punto final `http://localhost:8080/v1`).

**Configuración (GLM-OCR con Ollama):**

La opción más sencilla para empezar: Ollama gestiona las descargas de modelos y el tiempo de ejecución automáticamente.

1. Configuración → OCR → Proveedor: **GLM-OCR (Local)**
2. Servidor: **Ollama (CPU)**
3. Haga clic en **Descargar Ollama** (si no está instalado)
4. Haga clic en **Iniciar tiempo de ejecución**
5. Establecer modelo (por ejemplo, `llava:7b` o `qwen2-vl:7b`)
6. Haga clic en **Extraer modelo**

**OCR de matemáticas:**
- Manejo especializado de ecuaciones.
- Salida de látex
- Reconocimiento de símbolos
- Ideal para: artículos científicos, libros de texto.

### Paleta de comandos

Acceso rápido a todos los comandos:

**Abrir:** `Ctrl+K` (o `Cmd+K` en Mac)

**Características:**
- Búsqueda difusa
- Navegación por teclado
- Comandos usados recientemente
- Buscar por nombre o acceso directo
- Los resultados de la búsqueda saltan a la ubicación coincidente en los documentos y resaltan la consulta (PDF, EPUB, Importaciones web)
- Las coincidencias de transcripciones de YouTube buscan la marca de tiempo e inician la reproducción.
- Pase el cursor sobre el resultado de un documento para ver coincidencias adicionales del mismo documento

**Comandos comunes:**
- "Documento de importación"
- "Iniciar revisión"
- "Crear tarjeta"
- "Abrir configuración"
- "Exportar datos"

### Modo Vimium

Navegación con teclado estilo Vim para usuarios avanzados:

**Habilitar:** Configuración → Combinaciones de teclas → Habilitar Vimium

**Navegación:**
- `j` / `k`: Desplazarse hacia abajo/arriba
- `h` / `l`: Desplazarse hacia la izquierda/derecha
- `gg`: Ir arriba
- `G`: Ir al final
- `/`: Buscar
- `n` / `N`: resultado de búsqueda siguiente/anterior

**Acciones:**
- `f`: sugerencias de enlaces (elementos en los que se puede hacer clic)
- `i`: ingresa al modo de entrada
- `Escape`: Salir del modo de entrada

**Personalización:**
- Reasignar claves
- Crear comandos personalizados
- Compartir configuraciones de combinación de teclas

### Búsqueda y filtrado

Búsqueda avanzada en todo el contenido:

**Búsqueda de texto completo:**
- Búsqueda de contenido de tarjetas, extractos, documentos.
- Operadores booleanos (Y, O, NO)
- Búsqueda de frases ("frase exacta")
- Comodines (tarjeta*)

**Filtros de búsqueda:**
- `categoría:programación`: Buscar en categoría
- `tag:urgente`: búsqueda por etiqueta
- `type:cloze`: Búsqueda por tipo de tarjeta
- `due:today`: buscar tarjetas de vencimiento
- `rating:again`: búsqueda por calificación

**Búsquedas guardadas:**
1. Realizar búsqueda
2. Haga clic en "Guardar búsqueda"
3. Nombra y guarda
4. Accede desde el menú desplegable de búsqueda

### Extensión del navegador

Conecta Incrementum con la navegación web:

**Características:**
- Resaltar páginas web
- Crear extractos de artículos.
- Sincronización con la aplicación de escritorio
- Agregar rápidamente a la cola
- Revisiones basadas en navegador

**Configuración:**
1. Instalar la extensión (Chrome/Firefox)
2. Emparejar con la aplicación de escritorio
3. Conceder permisos
4. ¡Empieza a usar!

**Uso:**
- Seleccionar texto en la página web
- Haga clic en el icono de extensión
- Elija "Agregar a Incrementum"
- Se sincroniza automáticamente

---

## Consejos y mejores prácticas

### Creación de tarjetas

**HACER:**
- Hacer tarjetas específicas (un dato por tarjeta)
- Utilice un lenguaje sencillo y claro.
- Incluir contexto en las respuestas.
- Agregar ejemplos relevantes
- Utilice cloze para las relaciones.
- Mantenga las preguntas concisas

**NO HACER:**
- Pon varios datos en una tarjeta.
- Utilizar palabras vagas.
- Hacer las preguntas demasiado fáciles o demasiado difíciles
- Copiar bloques de texto grandes
- Utilizar abreviaturas sin definición.

**Ejemplo: tarjeta incorrecta:**
```
P: ¿Cuál es la función de las mitocondrias y cómo
¿Se relaciona con la producción de ATP en la respiración celular?
R: [Explicación del párrafo]
```

**Ejemplo: Tarjetas buenas:**
```
Tarjeta 1:
P: ¿Cuál es la función principal de las mitocondrias?
A: Producir ATP a través de la respiración celular.

Tarjeta 2:
P: ¿Qué proceso utilizan las mitocondrias para producir ATP?
A: Respiración celular (aeróbica)

Tarjeta 3:
P: ¿Cuál es la moneda energética producida por las mitocondrias?
R: ATP (trifosfato de adenosina)
```

### Rutina de estudio

**Horario diario (20-30 min):**
1. **Mañana**: Revisar las tarjetas de entrega (15 min)
2. **A lo largo del día**: crea extractos de la lectura
3. **Tarde**: crea tarjetas a partir de extractos (10-15 min)

**Horario Semanal:**
- **Lunes a viernes**: revisiones periódicas y creación de tarjetas
- **Sábado**: Sesiones de estudio más largas (1-2 horas)
- **Domingo**: revisar análisis, ajustar objetivos, organizar

**Gestión de grandes volúmenes:**
- Establecer un límite de revisión diario (por ejemplo, 50 tarjetas)
- Priorizar por categoría (centrarse en un tema)
- Utilice colas inteligentes para dividir tareas
- Tomar descansos cada 20-30 minutos.

### Optimización de retención

**Mejorar la tasa de retención:**
- Califica honestamente (no infles las calificaciones)
- Revisar constantemente (lo mejor es diariamente)
- Dormir lo suficiente (la memoria se consolida durante el sueño)
- Recuerdo activo (no mires, piensa primero)
- Revisiones espaciadas (no abarrotes)

**Lidiar con el olvido:**
- Normal olvidar 10-20% (dependiendo de la retención objetivo)
- Las tarjetas "Otra vez" son oportunidades de aprendizaje.
- Si olvida con frecuencia (>30%), considere:
  - Reducir la retención deseada (85-90%)
  - Creación de tarjetas más simples.
  - Agregar más contexto
  - Revisar con más frecuencia

### Organización de categorías

**Mejores prácticas:**
- Empiece de forma amplia y luego subdivida
- Ejemplo: `Programación` → `Programación/Python` → `Programación/Python/Async`
- Utilice nombres consistentes
- No crees demasiados (5-10 es manejable)
- Fusionar categorías no utilizadas

**Ejemplo de estructura de categorías:**
```
├── Programación
│ ├── Pitón
│ ├── Óxido
│ └── Algoritmos
├── Idiomas
│ ├── español
│ └── japonés
├── Ciencia
│ ├── Física
│ └── Biología
└── Profesional
    ├── Gestión de Proyectos
    └── Diseño del sistema
```

### Gestión de prioridades

**Pautas de prioridad:**
- **100 (Crítico)**: preparación de exámenes, proyectos de trabajo urgentes
- **80-90 (Alto)**: cursos actuales, aprendizaje activo
- **60-70 (Medio)**: Intereses continuos, conocimientos generales
- **40-50 (Bajo)**: Es bueno saberlo, complementario
- **0-20 (Archivo)**: solo referencia, rara vez se revisa

**Programación prioritaria:**
- Centrarse en más de 80 prioridades para las revisiones diarias
- Revisar 60-70 cada pocos días
- Revisión 40-50 semanal
- Revisión 0-20 mensual o bajo demanda

### Uso de intervalos de vista previa

La función **Intervalo de vista previa** le muestra exactamente cuándo aparecerá cada tarjeta a continuación para las cuatro clasificaciones.

**Cómo utilizar:**
1. Lee la tarjeta
2. Verifique los intervalos de vista previa debajo de los botones de calificación.
3. Elija la calificación según:
   - Su retiro actual
   - ¿Qué tan pronto quieres volver a verlo?
   - Su horario (por ejemplo, el examen que se acerca)**Estrategia de ejemplo:**
- Examen en 2 semanas: califique "Fácil" en tarjetas importantes para volver a verlas pronto
- Día ocupado: califique "Bueno" o "Fácil" para espaciar las reseñas
- Quiere dominar: Califique "Difícil" para revisar con más frecuencia

### Manejo del agobio

**¿Demasiadas tarjetas vencidas?**
1. Establecer límite de revisión (Configuración → Revisar → Máximo por día)
2. Centrarse en elementos de alta prioridad
3. Suspender temporalmente las categorías de baja prioridad
4. Considere reducir ligeramente la retención deseada

**¿Demasiado contenido para procesar?**
1. Importar documentos gradualmente
2. Extraiga sólo los puntos clave (no todos)
3. Crea tarjetas de forma selectiva
4. Utilice categorías para organizar

**¿Agotamiento?**
1. Tómate un descanso (¡está bien!)
2. Reducir los límites diarios
3. Suspender categorías no críticas
4. Céntrese en una categoría a la vez

---

## Solución de problemas

### Problemas comunes

#### Tarjetas que no aparecen en la revisión

**Posibles causas:**
- Todas las tarjetas revisadas para hoy.
- Tarjetas suspendidas
- Filtrar tarjetas ocultas activas.

**Soluciones:**
1. Verifique el recuento de "vencimiento" en la pestaña Revisar
2. Cola de revisión → Asegúrese de que las tarjetas no estén suspendidas
3. Limpiar filtros
4. Verifique la fecha de revisión (tal vez tarjetas programadas para el futuro)

#### Baja tasa de retención

**Síntomas:** Olvido de muchas tarjetas, calificaciones frecuentes de "Otra vez"

**Soluciones:**
1. **Revisar la calidad de las tarjetas**: ¿Las tarjetas son claras? ¿Un dato por tarjeta?
2. **Menor retención deseada**: Pruebe con 85 % en lugar de 90 %
3. **Revisar con más frecuencia**: Revisiones diarias, no abarrotar
4. **Agregar contexto**: más información en las respuestas
5. **Simplificar tarjetas**: divida tarjetas complejas en otras más simples

#### Conflictos de sincronización

**Síntomas:** Tarjetas duplicadas, datos que no coinciden después de la sincronización

**Soluciones:**
1. Elija la estrategia de resolución de conflictos (Configuración → Sincronización)
   - **Victorias locales**: conserva tus cambios
   - **Remote Wins**: aceptar cambios de servidor
   - **Preguntar**: resuelva manualmente cada conflicto
2. Sincronice periódicamente para minimizar los conflictos
3. Utilice un dispositivo principal

#### Errores de importación

**Síntomas:** La importación de documentos falla o se producen errores

**Soluciones:**
1. **Verifique el formato del archivo**: asegúrese de que el formato sea compatible (PDF, EPUB, etc.)
2. **Verifique el tamaño del archivo**: los archivos muy grandes pueden agotar el tiempo de espera
3. **Verifique la URL**: algunos sitios bloquean el acceso automatizado
4. **Consultar Internet**: la importación de URL requiere conexión
5. **Pruebe una alternativa**: use copiar y pegar para contenido web

#### Problemas de rendimiento

**Síntomas:** Carga lenta, retraso, se congela

**Soluciones:**
1. **Base de datos grande**: Archivar tarjetas antiguas (Configuración → Datos → Archivo)
2. **Muchas imágenes**: las imágenes se cargan más lentamente
3. **Recursos del sistema**: cierra otras aplicaciones
4. **Reconstruir base de datos**: Configuración → Datos → Reconstruir (último recurso)

#### El OCR no funciona

**Síntomas:** El OCR falla o produce malos resultados

**Soluciones:**
1. **Verificar clave API**: Válida y con créditos (proveedores de nube)
2. **Compruebe la calidad de la imagen**: las imágenes claras y de alta resolución funcionan mejor
3. **Verificar idioma**: idioma correcto seleccionado
4. **Pruebe un proveedor alternativo**: algunos funcionan mejor para determinado contenido
5. **OCR local**: use Tesseract si tiene problemas con Internet

#### llama.cpp no responde

**Síntomas:** "Error al llamar a LLM" o conexión rechazada a localhost:8080

**Soluciones:**
1. **Compruebe si el servidor se está ejecutando**: `curl http://localhost:8080/v1/models`
2. **Inicie el servidor**: consulte [Configuración de OCR](#ocr-optical-character-recognition) arriba
3. **Tamaño del contexto demasiado pequeño**: reinicie con `-c 16384` o superior
4. **Puerto en uso**: otro proceso puede estar usando el puerto 8080; consulte con `lsof -i: 8080`
5. **Sin memoria**: utilice una cuantificación más pequeña (Q3_K_M en lugar de Q4_K_M) o un modelo más pequeño

#### Ollama no arranca

**Síntomas:** El tiempo de ejecución de GLM-OCR Ollama no se inicia

**Soluciones:**
1. **Instala Ollama**: usa el botón Descargar en Configuración → OCR, o instálalo desde ollama.com
2. **Verifique la ruta binaria**: configure la ruta binaria de Ollama si no está en la ubicación predeterminada
3. **Permisos de Linux**: Es posible que necesite `sudo` para instalar o ejecutar el servicio Ollama

### Obteniendo ayuda

**Recursos:**
- **Documentación**: consulte la carpeta `docs/` para obtener guías detalladas
- **Problemas de GitHub**: informar errores y solicitudes de funciones
- **Comunidad**: únete a debates, haz preguntas
- **Atajos de teclado**: presione `?` en la aplicación para una referencia rápida

**Modo de depuración:**
Habilite el registro de depuración (Configuración → Avanzado → Modo de depuración) para solucionar problemas.

**Exportación de datos:**
Exporte sus datos antes de cambios importantes (Configuración → Copia de seguridad → Exportar)

### Recuperación**Eliminación accidental:**
1. Verifique las copias de seguridad (Configuración → Copia de seguridad)
2. Restaurar desde una copia de seguridad reciente
3. Póngase en contacto con el soporte si no hay una copia de seguridad disponible

**Base de datos corrupta:**
1. Exportar datos inmediatamente
2. Reconstruir la base de datos (Configuración → Datos → Reconstruir)
3. Importar datos exportados
4. Verifique todos los datos presentes

**Progreso perdido:**
1. Verifique Analytics → Exportar para datos históricos
2. Restaurar desde la copia de seguridad si es necesario
3. Sincronizar con el proveedor de la nube si está habilitado

---

## Glosario

**Extracto**: contenido extraído de un documento, posible material de tarjeta.

**Elemento de aprendizaje**: cualquier elemento que deba aprenderse (tarjeta didáctica, cloze, preguntas y respuestas, etc.)

**Cola**: todos los elementos programados para revisión, organizados por prioridad

**Sesión de revisión**: un período de recuperación activa y calificación de tarjetas

**FSRS**: Programador de repetición espaciada libre, algoritmo moderno que optimiza el tiempo de revisión (FSRS-6 es la versión actual)

**Intervalo**: tiempo entre revisiones (p. ej., 7 días)

**Estabilidad**: cuánto dura una memoria (métrica FSRS)

**Dificultad**: qué tan difícil es un elemento para usted, escala del 1 al 10 (métrica FSRS)

**Recuperabilidad**: Probabilidad actual de recuperación, 0-100 % (métrica FSRS)

**Retención deseada**: Tasa de retención objetivo (normalmente 90 %)

**Intervalo de vista previa**: función que muestra la próxima fecha de revisión para cada opción de calificación

**Cloze**: tipo de tarjeta para rellenar los espacios en blanco

**Suspender**: ocultar temporalmente el artículo de las reseñas

**Categoría**: Área temática para la organización

**Etiqueta**: Etiqueta personalizada para organizaciones de categorías cruzadas

**Prioridad**: Importancia establecida por el usuario (0-100)

---

## Referencia de atajos de teclado

### Atajos globales

| Atajo | Acción |
|----------|--------|
| `Ctrl/Cmd + K` | Abrir paleta de comandos |
| `Ctrl/Cmd + P` | Abrir paleta de comandos (alternativa) |
| `Ctrl/Cmd +,` | Abrir configuración |
| `Ctrl/Cmd + D` | Ir al panel |
| `Ctrl/Cmd + Q` | Ir a la cola |
| `Ctrl/Cmd + R` | Iniciar revisión |
| `Ctrl/Cmd + O` | Abrir documento |
| `Ctrl/Cmd + N` | Documento de importación (alternativo) |
| `Ctrl/Cmd + /` | Mostrar atajos de teclado |
| `?` | Mostrar atajos de teclado (sin modificador) |

### Atajos del modo de revisión

| Atajo | Acción |
|----------|--------|
| `Espacio` | Mostrar respuesta |
| `1` | Califica "Otra vez" |
| `2` | Califica "Difícil" |
| `3` | Califica "Bueno" |
| `4` | Califica "Fácil" |
| `Ctrl/Cmd + Intro` | Mostrar respuesta (alternativa) |
| `Ctrl/Cmd + 1/2/3/4` | Calificar sin mostrar respuesta |
| `Esc` | Fin de sesión |
| `Ctrl/Cmd + E` | Editar tarjeta actual (aún no implementada) |
| `Ctrl/Cmd + D` | Eliminar tarjeta actual (también se usa globalmente para "Ir al panel") |
| `Ctrl/Cmd + S` | Suspender tarjeta |
| `Ctrl/Cmd + H` | Historial de tarjetas |

### Atajos de cola

| Atajo | Acción |
|----------|--------|
| `Ctrl/Cmd + F` | Búsqueda de enfoque |
| `Ctrl/Cmd + A` | Seleccionar todo |
| `Eliminar` | Eliminar seleccionados |
| `Ctrl/Cmd + Clic` | Selección múltiple |
| `Mayús + clic` | Seleccionar rango |

### Atajos del visor de documentos

| Atajo | Acción |
|----------|--------|
| `Ctrl/Cmd + F` | Buscar en documento |
| `Ctrl/Cmd + C` | Copiar texto seleccionado |
| `Ctrl/Cmd + E` | Crear extracto de la selección |
| `Ctrl/Cmd + H` | Selección destacada |
| `Ctrl/Cmd + +` | Ampliar |
| `Ctrl/Cmd + -` | Alejar |
| `Ctrl/Cmd + 0` | Restablecer zoom |
| `F11` | Pantalla completa |

---

## Preguntas frecuentes

**P: ¿Cómo agrego boletines a Incrementum?**
R: Puedes agregar boletines de dos maneras:
1. **Directorio de boletines**: haga clic en RSS → Icono de boletín (📬) → Explore y suscríbase a boletines seleccionados.
2. **URL directa**: Copie la URL de cualquier boletín (Substack, Beehiiv, etc.) → RSS → Agregar fuente → Pegar URL. Incrementum descubrirá automáticamente la fuente RSS.

**P: ¿Qué plataformas de boletines son compatibles?**
R: Incrementum admite fuentes RSS de sitios Substack, Beehiiv, Ghost blogs, Buttondown, ConvertKit, Revue, Medium y WordPress. La mayoría de los boletines publican canales RSS; consulte el sitio web del boletín para obtener un enlace RSS o intente agregar `/feed` a la URL.

**P: ¿Cuántas tarjetas debo revisar por día?**
R: Comience con 20-50 por día. Ajústelo según su horario y objetivos. La consistencia es más importante que el volumen.

**P: ¿Cuántas tarjetas puedo crear por día?**
R: Tantos como quieras, pero céntrate en la calidad sobre la cantidad. 10-20 cartas bien hechas son mejores que 50 malas.

**P: ¿A qué tasa de retención debería apuntar?**
R: 90% es el valor predeterminado recomendado. Ajústelo al 85% si tiene demasiadas reseñas, o al 95% para material crítico.

**P: ¿Puedo usar Incrementum para idiomas?**
R: ¡Absolutamente! Es excelente para tarjetas de vocabulario, gramática y oraciones. Utilice tarjetas cloze para patrones gramaticales.

**P: ¿Cómo manejo las ecuaciones matemáticas?**
R: Utilice la sintaxis LaTeX en las tarjetas. Para OCR, utilice el proveedor Mathpix para obtener mejores resultados con contenido matemático.

**P: ¿Puedo sincronizar con Anki?**
R: ¡Sí! Configure AnkiConnect en Configuración → Integraciones → Anki para sincronización bidireccional.

**P: ¿Cuál es la diferencia entre suspender y eliminar?**
R: La suspensión oculta las cartas temporalmente (se puede reactivar). La eliminación se elimina permanentemente (se puede restaurar desde la copia de seguridad).

**P: ¿Con qué frecuencia debo revisar?**
R: Diariamente es ideal. Si pierde días, las tarjetas se acumularán pero no se "perderán"; simplemente póngase al día cuando pueda.

**P: ¿Puedo usar Incrementum en varios dispositivos?**
R: Todavía no directamente, pero puedes sincronizar datos a través de Dropbox/Google Drive o usar la extensión del navegador.

**P: ¿Mis datos son privados?**
R: ¡Sí! Todos los datos almacenados localmente. La sincronización en la nube está cifrada. No se envían datos a los servidores, excepto a los proveedores de IA configurados.

**P: ¿Cómo exporto mis tarjetas?**
R: Configuración → Copia de seguridad → Exportar, o use Anki sync para exportar al formato .apkg.

---

## Registro de cambios

Consulte [CHANGELOG.md](https://github.com/melpomenex/incrementum-tauri/blob/main/CHANGELOG.md) para conocer el historial de versiones y las actualizaciones.

---

## Soporte y comunidad

- **Documentación**: [docs/](./)
- **GitHub**: [incrementum-tauri](https://github.com/melpomenex/incrementum-tauri)
- **Problemas**: [Informar errores](https://github.com/melpomenex/incrementum-tauri/issues)
- **Discusiones**: [Hacer preguntas](https://github.com/melpomenex/incrementum-tauri/discussions)

---

**¡Feliz aprendizaje! 🚀**

Construido con ❤️ usando Tauri + React + Rust
