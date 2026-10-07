import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Headset } from 'lucide-react'
import { ProductStatusBadge, STATUS_COLOR } from '@/entities/product'
import { DEFAULT_SETTINGS, INSPECTION_LABEL } from '@/entities/settings'
import type { ProductStatus } from '@/entities/types'
import { ROLE_LABEL } from '@/entities/user'
import { Button, Kbd, PageHeader } from '@/shared/ui'
import { ContactDialog } from '@/features/support/ContactDialog'

const SECTIONS = [
  { id: 'statuses', title: 'Статусы изделия' },
  { id: 'data', title: 'Откуда данные' },
  { id: 'requests', title: 'Заявки и заказы' },
  { id: 'search', title: 'Поиск и сканер' },
  { id: 'notifications', title: 'Уведомления' },
  { id: 'exports', title: 'Отчёты и выгрузки' },
  { id: 'access', title: 'Доступ и пароль' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

const { warnDays, leadDays, inspectionDays } = DEFAULT_SETTINGS
const days = (list: readonly number[]) =>
  `${list.slice(0, -1).join(', ')} и ${list[list.length - 1]} дней`

/** A hose's life in the order it passes the statuses; the widths only suggest proportion. */
const LIFE: { status: ProductStatus; grow: number; from: string; text: string }[] = [
  {
    status: 'ok',
    grow: 5,
    from: 'Установка или отгрузка',
    text: 'Гарантия действует, до плановой замены ещё далеко.',
  },
  {
    status: 'no_warranty',
    grow: 3,
    from: 'Конец гарантии',
    text: 'Гарантия закончилась, срок эксплуатации ещё идёт. Этим же статусом помечено изделие, у которого в 1С нет ни даты установки, ни даты отгрузки.',
  },
  {
    status: 'warn',
    grow: 1.5,
    from: `За ${warnDays} дней`,
    text: `До плановой замены меньше ${warnDays} дней — пора заказать рукав. Порог настраивает администратор компании.`,
  },
  {
    status: 'replace',
    grow: 1.5,
    from: 'Плановая замена',
    text: 'Расчётный срок эксплуатации вышел, рукав нужно менять.',
  },
]

/**
 * «Помощь» from the rail: how to read the cabinet and whom to ask. Every
 * number in the text (the «Внимание» threshold, the notice days) comes from the
 * defaults the server uses, so the page cannot drift from the rule.
 */
export function HelpPage() {
  const { hash } = useLocation()
  const [contact, setContact] = useState(false)

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  const contactButton = (
    <Button variant="secondary" icon={Headset} onClick={() => setContact(true)}>
      Связаться со специалистом
    </Button>
  )

  return (
    // A reading column: the text fills its sheet instead of floating in a wide one.
    <div className="max-w-[60rem]">
      <PageHeader
        title="Помощь"
        description="Как читать кабинет и куда обращаться, если что-то не так"
        actions={contactButton}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label="Разделы помощи" className="sticky top-0 max-xl:hidden">
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={
                    'block rounded-lg px-3 py-1.5 text-ui transition-colors duration-150 ' +
                    (hash === `#${s.id}`
                      ? 'bg-sheet font-medium text-ink'
                      : 'text-ink-muted hover:bg-wash hover:text-ink')
                  }
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="sheet divide-y divide-line">
          <Section id="statuses">
            <p>
              Срок считается от даты установки, а если её нет — от даты отгрузки. Плановая замена —
              это начало срока плюс расчётный срок эксплуатации изделия. Статус всегда показывает
              худшее из того, что верно на сегодня: рукав на гарантии, но в последние {warnDays}{' '}
              дней срока, — уже «Внимание».
            </p>
            <Lifeline />
            <dl className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
              {LIFE.map((s) => (
                <Fragment key={s.status}>
                  <dt className="pt-0.5">
                    <ProductStatusBadge status={s.status} />
                  </dt>
                  <dd className="max-sm:mb-2">{s.text}</dd>
                </Fragment>
              ))}
            </dl>
          </Section>

          <Section id="data">
            <p>
              Изделия, отгрузки, техника и замены приходят из 1С поставщика. Кабинет сверяется с 1С
              каждые 10 минут; когда это было в последний раз, написано внизу меню слева. Если 1С не
              отвечает, в шапке появится предупреждение, а кабинет продолжит показывать последние
              полученные данные.
            </p>
            <p>
              В 1С данные правит поставщик. Если неверна дата установки, техника или место установки
              — напишите специалисту: кнопка «Связаться со специалистом» есть в шапке и на карточке
              изделия, изделие и верная дата уйдут вместе с сообщением.
            </p>
          </Section>

          <Section id="requests">
            <ul>
              <li>
                <b>«Создать заявку на замену»</b> на карточке изделия — изделие и его характеристики
                уже в заявке, остаётся указать количество и комментарий. С карточки техники («Заявка
                на замену») её изделия предлагаются первыми.
              </li>
              <li>
                <b>«Заказать такой же»</b> на карточке изделия — заявка на изготовление по его
                каталожному номеру.
              </li>
              <li>
                <b>«Новая заявка»</b> в разделе «Заявки» — несколько позиций сразу; каталожные
                номера можно вставить списком. К заявке можно приложить фото.
              </li>
            </ul>
            <p>
              Заявку обрабатывает менеджер поставщика: «Новая» → «В работе» → «Выполнена» или
              «Отклонена». О выполненной и отклонённой заявке придёт уведомление. Саму замену
              проводит поставщик — в «Истории замен» она появится, когда новое изделие будет
              отгружено.
            </p>
          </Section>

          <Section id="search">
            <p>
              Строка поиска в шапке (или <Kbd>⌘K</Kbd> / <Kbd>Ctrl K</Kbd>) находит изделие по
              номеру EHS, каталожному номеру, гаражному номеру техники и месту установки, технику —
              по гаражному и заводскому номеру.
            </p>
            <p>
              На телефоне в шапке есть сканер: он читает штрихкод или QR-код с бирки и сразу
              открывает изделие или технику. Если бирка стёрлась, номер можно ввести вручную.
            </p>
          </Section>

          <Section id="notifications">
            <p>Кабинет сам напоминает:</p>
            <ul>
              <li>о конце гарантии и о плановой замене — заранее, за {days(leadDays)};</li>
              <li>о том, что срок эксплуатации вышел;</li>
              <li>
                о плановом осмотре рукавов — по каждой машине,{' '}
                {INSPECTION_LABEL[inspectionDays].toLowerCase()};
              </li>
              <li>о выполненной или отклонённой заявке.</li>
            </ul>
            <p>
              За сколько дней предупреждать и как часто напоминать об осмотре, решает администратор
              компании. Какие уведомления получать и нужны ли письма, каждый выбирает сам:
              «Уведомления» → «Настройки уведомлений». Письма приходят, когда у компании подключена
              почта.
            </p>
          </Section>

          <Section id="exports">
            <p>
              Кнопка «Экспорт» на реестрах изделий, техники, замен и заявок сохраняет в Excel или
              CSV ровно то, что показывает таблица: с фильтрами, поиском и сортировкой, все
              страницы. На главной «Экспорт» сохраняет сводку за выбранный период.
            </p>
            <p>
              Руководителю и администратору доступны «Отчёты» — семь отчётов за выбранный период в
              Excel и PDF — и «Сравнение техники» по моделям.
            </p>
          </Section>

          <Section id="access">
            <p>
              Каждый видит только данные своей компании. {ROLE_LABEL.mechanic} и{' '}
              {ROLE_LABEL.engineer.toLowerCase()} работают с изделиями, техникой, заявками и
              уведомлениями; {ROLE_LABEL.manager.toLowerCase()} — ещё и с отчётами и сравнением
              техники; {ROLE_LABEL.admin.toLowerCase()} компании заводит пользователей и настраивает
              кабинет.
            </p>
            <p>
              Сменить пароль — в меню пользователя справа вверху. Забыли пароль — попросите
              администратора вашей компании: он пришлёт ссылку, по которой вы зададите новый, или
              выдаст временный пароль, который нужно будет сменить при входе.
            </p>
          </Section>
        </article>
      </div>
      {contact && <ContactDialog onClose={() => setContact(false)} />}
    </div>
  )
}

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)?.title
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-4 px-5 py-6 sm:px-8">
      <h2
        id={`${id}-title`}
        className="text-heading leading-tight font-semibold tracking-[-0.01em] text-ink"
      >
        {title}
      </h2>
      <div className="mt-3 max-w-[72ch] space-y-3 text-sm leading-6 text-ink-secondary [&_b]:font-medium [&_b]:text-ink [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-ink-faint">
        {children}
      </div>
    </section>
  )
}

/** The statuses on one axis, with the day each begins. */
function Lifeline() {
  return (
    <div aria-hidden className="mt-5">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {LIFE.map((s) => (
          <span
            key={s.status}
            style={{ flexGrow: s.grow, flexBasis: 0, background: STATUS_COLOR[s.status] }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-0.5 text-caption leading-tight text-ink-muted max-sm:hidden">
        {LIFE.map((s) => (
          <span key={s.status} style={{ flexGrow: s.grow, flexBasis: 0 }} className="pr-2">
            {s.from}
          </span>
        ))}
      </div>
    </div>
  )
}
