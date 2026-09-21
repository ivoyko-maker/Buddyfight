# Buddyfight

## Actualizar el catálogo oficial

El importador usa la lista oficial de Buddyfight, descubre los identificadores de
expansión, sigue todas las páginas de resultados y descarga cada ficha de carta.
No requiere un navegador ni dependencias externas:

```sh
npm run import:official-cards
```

El comando reescribe `data/cards.json` y valida el resultado con `validateCatalog`
antes de guardarlo. Para ejecutar las pruebas basadas en HTML guardado (sin red):

```sh
npm test
```

De forma opcional se puede indicar una ruta de salida distinta:

```sh
node scripts/import-official-cards.mjs /ruta/al/catalogo.json
```
