# III Encuentro Empresarial · ANI · UNIPAZ

**Abrir la plataforma:** https://gaopyme-prog.github.io/encuentro-empresarial/

## ¿Qué es?
Una plataforma web de trabajo para organizar el **III Encuentro Empresarial** del programa de Administración de Negocios Internacionales (ANI) de UNIPAZ. La preparan los estudiantes de **Consultorio Empresarial** y la siguen el docente y la coordinación.

## ¿Para qué sirve? (finalidad)
Reunir en un solo lugar todo lo que necesita un evento académico organizado por estudiantes: instrucciones, documentos, quién hace qué, cuánto se ha avanzado y la comunicación del equipo. Así el docente y la coordinación ven el avance real **sin depender de mensajes sueltos por WhatsApp**, y cada estudiante sabe exactamente qué le corresponde.

**Dirigido a:** estudiantes organizadores, docente del curso y coordinación del programa. El modelo se puede replicar en cualquier evento institucional (foros, ferias, semanas culturales).

## Funciones
- **Ingreso con cédula y clave personal** (la primera vez con una clave inicial; luego cada uno crea la suya).
- **Perfiles:** estudiante líder, estudiante, docente y coordinación; cada uno ve lo que le corresponde.
- **Video de instrucciones** del evento.
- **Documentos** de trabajo enlazados desde Google Drive.
- **Responsabilidades** por estudiante y comisión, con **barra de cumplimiento**.
- **Muro de mensajes** del equipo.
- **Panel del docente** y **panel de coordinación** para el seguimiento.

## ¿Cómo se usa?
1. Abra el enlace e ingrese con su número de cédula y la clave que le dio el docente.
2. En el primer ingreso cree su clave personal (mínimo 6 caracteres).
3. Revise el video y los documentos, consulte sus responsabilidades y marque sus avances.
4. Use el muro para comunicarse con el equipo.
5. El docente y la coordinación revisan el avance en sus paneles.

## ¿Cómo está construida?
- **Página web** (este repositorio, publicada en GitHub Pages).
- **Servidor en Google Apps Script** conectado a una **hoja de cálculo de Google**, donde se guardan usuarios, tareas, avances, mensajes y documentos. Las claves se guardan cifradas (SHA-256).
- **Modo demostración:** si en `config.js` no hay dirección de Apps Script, la página funciona con datos de ejemplo guardados solo en el navegador (sirve para mostrarla sin tocar datos reales).

## Montarla para otro evento
1. Cree una hoja de cálculo de Google › *Extensiones* › *Apps Script*, pegue el contenido de `2_Codigo_AppsScript_Code.gs` y guarde.
2. Ejecute la función `configurarHoja` (autorice los permisos).
3. En la hoja escriba las cédulas en *Usuarios*, los enlaces de Drive en *Documentos* y el enlace del video en *Config*.
4. *Implementar* › *Nueva implementación* › *Aplicación web* (Ejecutar como: yo · Acceso: cualquier usuario). Copie la URL que termina en `/exec`.
5. Pegue esa URL en `config.js` y suba los archivos a un repositorio con GitHub Pages activado.

## Archivos del repositorio
| Archivo | Función |
|---|---|
| `index.html` | La aplicación |
| `config.js` | Dirección del servidor de Apps Script |
| `motor-demo.js` | Motor del modo demostración |
| `2_Codigo_AppsScript_Code.gs` | Código del servidor (Google Apps Script) |
| `1_Pagina_GitHub_III_Encuentro.zip` | Copia empaquetada de la página |

## Créditos
Consultorio Empresarial · ANI · UNIPAZ, Barrancabermeja, 2026.
Docente: **Omar Guerrero Avilés** (omar.guerreroav@unipaz.edu.co). Desarrollado con apoyo de inteligencia artificial.
