# Eye Stretching

Aplicación de ejercicios oculares 100% estática (HTML/CSS/JS) lista para alojar en cualquier hosting web sin servidor.

## Ejecutar en local (sin Node.js)

Recomendado servir con un servidor estático (por ejemplo Python) para que funcionen los módulos ES:

```bash
python3 -m http.server 8000
```

Luego abre `http://127.0.0.1:8000`.

## Estructura

- `index.html` / `index.css`: UI.
- `index.js`: entrypoint (ESM).
- `src/app.js`: lógica principal + estado.
- `src/exercises.js`: animaciones de los ejercicios.
- `src/audio.js`: sonidos (WebAudio).
- `src/plans.js`: planes predefinidos.
- `src/dom.js`: obtención de elementos del DOM.
- `src/state.js`: estado inicial.

