# РВД Кабинет — dashboard

Личный кабинет для учёта рукавов высокого давления (РВД) на технике клиента.
Frontend-first: UI работает на mock-данных (MSW), интеграция с 1С через OData — следующий этап.

## Стек

React 19 · TypeScript · Vite · Tailwind v4 · React Router · TanStack Query/Table · Recharts · MSW · Vitest

## Запуск

```bash
cp .env.example .env.local   # VITE_USE_MOCKS=true — работа без бэкенда
npm ci
npm run msw:init             # один раз: генерирует public/mockServiceWorker.js
npm run dev
```

## Скрипты

| команда             | что делает                   |
| ------------------- | ---------------------------- |
| `npm run dev`       | dev-сервер                   |
| `npm run build`     | typecheck + production build |
| `npm run lint`      | oxlint                       |
| `npm run typecheck` | tsc                          |
| `npm test`          | vitest                       |
| `npm run format`    | prettier                     |

## Структура

```
src/
  app/          layout, router, providers
  entities/     доменные типы (из ТЗ, не из 1С)
  features/     dashboard, products, equipment, replacements, requests
  shared/api/   fetch-клиент + query-хуки — единственная точка замены mock → 1С
  shared/mocks/ MSW handlers + генератор данных
  shared/ui/    переиспользуемые компоненты
docs/           документация проекта (docs/customer/ не коммитится)
```

## Секреты

Никакие `.env*` (кроме `.env.example`), ключи и документы заказчика в репозиторий не попадают — см. `.gitignore`.
