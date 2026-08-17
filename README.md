# Неофициальный русскоязычный перевод Pathfinder 2e для Foundry VTT

Перевод основан на материалах https://pf2.ru/

Модуль переводит две разные вещи двумя разными механизмами:

| Что                                   | Механизм                                                                  | Файлы                    |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| Интерфейс системы PF2e и ядра Foundry | штатный i18n Foundry                                                      | `lang/ru.json`           |
| Содержимое компендиумов               | [Babele](https://gitlab.com/riccisi/foundryvtt-babele) — подмена в памяти | `translations/ru/*.json` |

Babele обязателен: без него компендиумы останутся английскими.

## Установка

В Foundry → «Установить модуль» → в поле «Manifest URL»:

```
https://github.com/lookforward-github/foundry-pf2e-ru/releases/latest/download/module.json
```

---

# Для разработки

## Главный принцип: `pull` и `build` — разные фазы

| Фаза    | Сеть    | Детерминизм | Что делает                                             |
| ------- | ------- | ----------- | ------------------------------------------------------ |
| `pull`  | да      | нет         | Google Sheets и API → выгрузки, которые **коммитятся** |
| `build` | **нет** | да          | выгрузки + `data/` → `lang/` и `translations/`         |

Из этого следует всё остальное:

- **`build` работает офлайн и без ключей.** В CI не нужны секреты, у нового
  участника всё собирается сразу после `npm ci`.
- **Мок API — это не отдельный режим.** Пока API нет, выгрузка просто лежит в
  `fixtures/api` и правится руками. Когда API появится, `npm run pull:api`
  начнёт перезаписывать те же файлы по HTTP — в `build` не меняется ничего.
- **Дифф выгрузки = ревью перевода.** Видно, что именно поменяли в таблице.
- **Сборка воспроизводима.** Один коммит → один результат, это проверяет CI.

```
sheets/snapshot/*.json ─┐
data/lang, data/manual ─┼→ normalize → merge → подстановка {{…}} → emit → validate
fixtures/api/*.json ────┘                          ↑
                                        данные API (сущности + глоссарий)
```

## Команды

```bash
npm ci                  # один раз
npm run pull            # обновить выгрузки из Sheets и API (нужен .env)
npm run build           # собрать lang/ и translations/ — офлайн
npm run validate        # линт артефактов: JSON, форма, {{…}}, @UUID[…]
npm run report          # покрытие перевода по файлам
npm run sync:manifest   # привести module.json в согласие с репозиторием
```

Полезные флаги:

```bash
npm run build -- --allow-unresolved   # собрать черновик, не падая на пустых {{…}}
npm run build -- --check              # не менять молча: упасть, если результат отличается (CI)
npm run pull:api -- --source=http     # разово сходить в живой API, не трогая .env
```

## Что где лежит

```
scripts/            рантайм модуля: то, что грузит Foundry (чистый JS, без сборки)
styles/             css модуля
lang/               ⚙ АРТЕФАКТ: собранный i18n — не править руками
translations/ru/    ⚙ АРТЕФАКТ: собранные Babele-переводы — не править руками
data/               ✍ ИСТОЧНИК: то, что правится руками (см. README внутри)
sheets/             конфиг листов + закоммиченная выгрузка Google Sheets
fixtures/api/       закоммиченная выгрузка API сайта переводов (она же мок)
tools/              сборочные скрипты на TypeScript, в модуль не попадают
```

Файлы в `lang/` и `translations/` перезаписываются каждой сборкой. Правки туда
теряются — их место в `data/overrides`.

## Слои и приоритет

Значение из более приоритетного слоя перебивает предыдущий; что и чем перебито,
пишется в лог сборки.

1. `sheets/snapshot/` — основная масса переводов из Google Sheets
2. `data/lang`, `data/manual` — то, чего в таблицах нет
3. `data/overrides` — точечные хотфиксы

Пустая ячейка в таблице **не** затирает перевод из нижнего слоя.

## Настройка Google Sheets

Таблица должна быть расшарена «всем, у кого есть ссылка» с ролью «Читатель».
Ключ: Google Cloud Console → Credentials → API key, затем включить Google
Sheets API. Ключ и `spreadsheetId` — в `.env` (см. `.env.example`).

Какие листы тянуть и как разложить их колонки, описано в
[sheets/sheets.config.json](sheets/sheets.config.json):

```json
{
  "sheet": "Spells",
  "type": "babele",
  "target": "translations/ru/pf2e.spells-srd.json",
  "packLabel": "Заклинания",
  "keyColumn": "Name EN",
  "columns": { "name": "Название", "description": "Описание" },
  "skipWhen": { "Статус": ["", "черновик"] }
}
```

- `type: "i18n"` — лист даёт ключ→строку, `target` всегда `lang/ru.json`,
  в `columns` обязателен ключ `value`.
- `type: "babele"` — лист даёт один пак. `keyColumn` — **оригинальное английское
  название** сущности, по нему Babele находит документ. Допустимые поля в
  `columns` перечислены в `MAPPING` в
  [scripts/babele/converters.js](scripts/babele/converters.js).

Новый пак = новый блок в конфиге. Код не трогается.

## Плейсхолдеры и API

В текстах переводов можно ссылаться на данные сайта переводов:

```
{{term:flat-footed}}                        принятый перевод термина
{{entry:spell:magic-missile}}                русское название сущности
{{entry:spell:magic-missile.description}}    поле из fields
```

Форма ответа API описана единственной схемой —
[tools/sources/api/contract.ts](tools/sources/api/contract.ts). Через неё
проходят и HTTP-ответ, и локальная выгрузка, поэтому мок не может незаметно
разойтись с контрактом.

Режим переключается `PF2E_RU_API_MODE`:

- `fixture` (по умолчанию) — читать `fixtures/api`, в сеть не ходить;
- `http` — ходить в API (`PF2E_RU_API_BASE_URL`, `PF2E_RU_API_TOKEN`).

Термин, которого в API ещё нет, можно временно положить в
`data/glossary/terms.json` — это запасной слой, сборка сообщит, что им
воспользовалась. Нераскрытый плейсхолдер по умолчанию останавливает сборку.

## Релиз

CI собирает, проверяет и публикует по тегу:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

Workflow подставит версию и ссылки в `module.json`, соберёт `module.zip` только
из рантайм-файлов и приложит оба к релизу. `manifest`/`download` в манифесте
указывают на `releases/latest/download`, поэтому Foundry сам увидит обновление.

## Лицензии

См. [LICENSE](LICENSE): Paizo Community Use Policy, ORC Notice, OGL 1.0a.
Модуль не аффилирован с Paizo Publishing или «Мир Хобби».
