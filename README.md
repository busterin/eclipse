# Quiz escaneable (MVP)

Demo en HTML/CSS/JS inspirada en Plickers:

- Portada con botón `Comenzar`
- 1 pregunta de prueba con opciones A/B/C/D
- Conteo y porcentaje por opción
- Resultado al confirmar:
  - `EXITO` si más del 50% eligió la correcta (A)
  - `FALLO` en caso contrario
- Modo escáner con cámara (`?mode=scanner`)
- Tarjeta QR única para todos los jugadores (sin usuarios)

## Uso rápido

1. Sube estos archivos a GitHub.
2. Activa GitHub Pages para el repositorio.
3. Abre la URL en ordenador (modo quiz).
4. En la sección "Escaneo con móvil", abre en el móvil el enlace `?mode=scanner`.
5. Imprime o muestra en otra pantalla la tarjeta QR del modo escáner.

## Notas de esta versión

- La app está pensada como MVP para pruebas.
- Incluye sincronización por `BroadcastChannel`/`localStorage` para pruebas sencillas.
- Para uso en producción multi-dispositivo (ordenador + varios móviles en tiempo real), el siguiente paso recomendado es añadir backend de sesiones (WebSocket/Firebase/Supabase).
