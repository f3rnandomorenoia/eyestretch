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

## Test de audio en iPhone / Safari

Hay una página de diagnóstico en `audio-test.html` para comprobar si el audio queda desbloqueado correctamente en iPhone/Safari.

Flujo recomendado:

1. Abrir `audio-test.html` en el iPhone.
2. Pulsar **Desbloquear audio**.
3. Pulsar **Secuencia de prueba**.
4. Si el estado queda en `running` y se oyen los tonos, el audio está funcionando.

Además, hay tests automatizados en `tests/`:

```bash
npm test
```

