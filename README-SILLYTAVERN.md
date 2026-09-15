# Message Enhancer (CCC) para SillyTavern (puerto no oficial)

Plugin original: **CCC - Message Enhancer v1.7.7**, de Clowuds, para la app
Tavo. Puerto independiente — no comparte código ni estado con el puerto de
Crossroads que armamos antes, aunque ambos vengan de la familia "CCC".

## Qué se tocó y qué no

- **`entry.js` y `ui/panel-me.html`: cero cambios.** Copia exacta del zip
  original (lo confirmé con `diff` antes de empaquetar). Mismo diseño, mismos
  botones (Enhance / Try Again / Use This / Guided Reroll), mismos temas de
  color.
- **`locales/*.json` y `cover.png`:** también sin tocar, van incluidos tal
  cual (el panel de ajustes que agrego usa `locales/es.json` para las
  etiquetas).
- **`tavo-shim.js` (nuevo):** traduce `tavo.get/set`, `tavo.generate`,
  `tavo.message.find/update`, `tavo.input.set`, `tavo.plugin.config.all()`,
  `tavo.plugin.onSidebarAction/onInputAction` a llamadas reales de
  SillyTavern.
- **`index.js` (nuevo):** carga todo en orden y arma un panel de ajustes
  simple dentro del cajón de **Extensions** de SillyTavern (Tavo genera esa
  pantalla solo a partir del `manifest.json`; SillyTavern no lo hace para
  extensiones de terceros, así que la reconstruí a mano con las mismas
  opciones: Modo iPhone, mostrar FAB, mostrar FAB del Enhancer, instrucción
  OOC por defecto, longitud objetivo, ID de preset).
- **`manifest.json` (nuevo):** formato de manifest de SillyTavern.

## Instalación

Igual que con Crossroads:

1. Copia esta carpeta completa dentro de
   `SillyTavern/public/scripts/extensions/third-party/`
   (o súbela a un repo de GitHub propio y usa **Extensions → Download
   Extensions and Assets → Install Extension** con la URL del repo).
2. Recarga SillyTavern.
3. Confírmala activada en **Extensions**.
4. Deberías ver el botón flotante (FAB) del Enhancer sobre el chat.

Si no aparece ningún botón: escribe `/enhance` (pestaña Usuario) o
`/enhancechar` (pestaña Personaje / Reintento Guiado) en el cuadro de
mensaje — ambos abren el panel sin importar si el FAB o el menú de
Extensions se ven bien en tu tema.

Los ajustes del plugin (Modo iPhone, longitud, instrucción OOC, etc.) están
en **Extensions → Message Enhancer**, cerca del final del cajón.

## Cosas que dependen de tu versión de SillyTavern

Mismo aviso que con Crossroads: no pude probar esto contra una instancia real
de SillyTavern. Los puntos marcados `ADAPTA AQUÍ` en `tavo-shim.js` son los
más propensos a necesitar un ajuste si tu versión renombró algo.

| Síntoma | Qué mirar |
|---|---|
| No aparece nada | Consola (F12), busca `[Message Enhancer]`. Revisa que la carpeta esté en la ruta correcta. |
| "Enhance" no genera texto | Revisa `tavoGenerate()` en `tavo-shim.js` — puede que falte `generateRaw` en tu versión (hay respaldo a `generateQuietPrompt`). |
| "Guided Reroll" no encuentra el último mensaje del personaje | `allTavoMessages()` depende de `ctx.chat` con campos `is_user`/`mes` — revisa que esos nombres coincidan con tu versión. |
| "Use This" reemplaza el mensaje pero no se ve el cambio en pantalla / no se guarda | `tavoMessage.update()` intenta `ctx.updateMessageBlock` y `ctx.saveChatConditional`; si tu versión los nombra distinto, el texto se guarda en el array de chat pero el mensaje en pantalla puede no refrescarse solo (recargar el chat lo mostraría bien). Ajusta esos dos nombres en el shim. |
| El panel de ajustes no aparece en Extensions | Se busca `#extensions_settings2` o `#extensions_settings`; si tu tema usa otro contenedor, el plugin sigue funcionando con los valores por defecto, solo no es configurable desde la UI — puedes editarlos manualmente en la consola con `window.__imeSettingsBridge.write({...})`. |

## Diferencias de comportamiento que vale la pena saber

- **El tema (color/oscuro-claro) no se sincroniza con Crossroads.** En Tavo,
  ambos plugins comparten una misma variable global (`__cccTheme`) y por eso
  el tema se veía igual en los dos paneles. Como pediste mantener las dos
  extensiones totalmente separadas, cada una guarda su propia copia — puedes
  ajustar el tema en cada panel por separado.
- **El ajuste "ID de preset personalizado" no hace nada por ahora.** En Tavo
  elegía un perfil de API/modelo guardado en la app. SillyTavern no tiene un
  gancho equivalente expuesto de forma simple, así que esa opción queda
  guardada pero se ignora — la generación siempre usa la API/preset que ya
  tengas activa en SillyTavern.

## Créditos

Message Enhancer es de **Clowuds**. Este puerto solo agrega la capa de
compatibilidad con SillyTavern.
