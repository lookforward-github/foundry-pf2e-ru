# data/manual — переводы компендиумов, которых нет в таблицах

Файлы в формате Babele. Имя файла = имя пака и одновременно имя результата
в `translations/ru/`.

`data/manual/pf2e.journals.json` → `translations/ru/pf2e.journals.json`

```json
{
  "label": "Журналы",
  "entries": {
    "Conditions": {
      "name": "Состояния",
      "description": "<p>…</p>"
    }
  }
}
```

Ключи в `entries` — **оригинальные английские названия** сущностей: именно по
ним Babele находит документ в компендиуме. Набор допустимых полей задан в
`MAPPING` в [scripts/babele/converters.js](../../scripts/babele/converters.js).

Обёртку `{ label, entries }` можно опустить — тогда весь объект считается
`entries`, а подпись пака берётся из уже собранного файла или из его имени.
