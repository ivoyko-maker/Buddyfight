# Buddyfight Arena

Versión de prueba local de un simulador web de **Future Card Buddyfight**. No hay instalación ni dependencias: abre `index.html` en un navegador moderno, o ejecuta `npm run serve` y visita `http://127.0.0.1:4173`.

## Cómo jugar la versión de prueba

1. Pulsa **Siguiente fase** hasta llegar a **Principal**.
2. Elige una carta de tu mano y usa **Llamar / usar carta**. Los monstruos entran en reposo y el tamaño total de tus monstruos no puede ser superior a 3.
3. Avanza hasta **Ataque**. Pulsa una carta preparada en tu campo para atacar; primero combate contra el monstruo rival y, si no hay ninguno, inflige daño directo según su crítico.
4. Tras la fase Final, Nova juega automáticamente. En su turno los controles quedan bloqueados y se reactivan al comenzar tu siguiente turno.

## Reglas implementadas

- Fases Inicio, Roba, Carga y roba, Principal, Ataque y Final.
- Mazos de veinte cartas, mano inicial de cinco cartas, gauge, drop, vida y zonas de campo.
- Límite de tamaño 3, reposo/preparación, reemplazo de ítem y resolución de combates por poder.
- Ataques directos cuando no hay monstruos defensores y derrota al llegar a cero de vida.
- Rival automático determinista para probar una partida completa en solitario.

## Validación

Ejecuta `npm test` para las pruebas del motor: preparación de la partida, robo, carga y robo, llamada y resolución de una batalla.

> Esta versión de prueba **no pretende ser aún un simulador reglamentario completo**. Counter, Soulguard, Penetrate, Double Attack, Buddy, flags, costes de gauge y los efectos específicos de cartas no se resuelven automáticamente.
