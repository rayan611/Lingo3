import { Children, cloneElement, isValidElement, useState } from 'react'
import type { ReactNode, ReactElement } from 'react'
import { AcademyHelp } from './AcademyHelp'
import type { AcademyLocale } from './AcademyHelp'

function textContent(value: ReactNode): string {
  return Children.toArray(value)
    .map(x =>
      typeof x === 'string' || typeof x === 'number'
        ? String(x)
        : isValidElement<{ children?: ReactNode }>(x)
          ? textContent(x.props.children)
          : ''
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
/** Keep the native label and select while making longer choices searchable. */
export function AcademyField({ locale, children }: { locale: string; children: ReactNode }) {
  const [query, setQuery] = useState('')
  const lang: AcademyLocale = locale === 'fa' || locale === 'sv' || locale === 'de' ? locale : 'en'
  const label = Children.toArray(children).find(isValidElement) as
    | ReactElement<{ children?: ReactNode }>
    | undefined
  const parts = label ? Children.toArray(label.props.children) : []
  const name = parts
    .filter((x): x is string | number => typeof x === 'string' || typeof x === 'number')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  const fieldName = name || { fa: 'این مورد', en: 'this item', sv: 'det här fältet', de: 'dieses Feld' }[lang]
  const select = parts.find(x => isValidElement(x) && x.type === 'select') as ReactElement<any> | undefined
  const options = select
    ? (Children.toArray(select.props.children).filter(isValidElement) as ReactElement<any>[])
    : []
  const searchable = options.length > 8
  const term = query.trim().toLocaleLowerCase()
  const filtered =
    searchable && term
      ? options.filter(
          option =>
            option.props.value === '' ||
            String(option.props.value ?? '') === String(select?.props.value ?? '') ||
            textContent(option.props.children).toLocaleLowerCase().includes(term)
        )
      : options
  const body =
    searchable && select && label
      ? cloneElement(
          label,
          {},
          Children.map(label.props.children, child =>
            isValidElement(child) && child.type === 'select'
              ? cloneElement(child as ReactElement<any>, {}, filtered)
              : child
          )
        )
      : children
  const searchLabel = {
    fa: `جستجو در ${fieldName}`,
    en: `Search ${fieldName}`,
    sv: `Sök i ${fieldName}`,
    de: `${fieldName} durchsuchen`
  }[lang]
  const control = parts.find(
    x => isValidElement(x) && ['input', 'textarea', 'select'].includes(String(x.type))
  ) as ReactElement<any> | undefined
  const type = control?.type === 'select' ? 'select' : control?.props.type || String(control?.type || 'text')
  const descriptions = {
    select: {
      fa: 'یکی از گزینه‌ها را انتخاب کنید.',
      en: 'Choose one of the available options.',
      sv: 'Välj ett av alternativen.',
      de: 'Wählen Sie eine der verfügbaren Optionen.'
    },
    checkbox: {
      fa: 'برای انتخاب یا لغو این گزینه روی آن بزنید.',
      en: 'Select or clear this option.',
      sv: 'Markera eller avmarkera alternativet.',
      de: 'Wählen oder entfernen Sie diese Option.'
    },
    'datetime-local': {
      fa: 'تاریخ و ساعت را بر اساس منطقه زمانی دستگاه خود انتخاب کنید.',
      en: 'Choose the date and time using your device time zone.',
      sv: 'Välj datum och tid enligt enhetens tidszon.',
      de: 'Wählen Sie Datum und Uhrzeit in der Zeitzone Ihres Geräts.'
    },
    time: {
      fa: 'ساعت را وارد کنید.',
      en: 'Enter a time.',
      sv: 'Ange en tid.',
      de: 'Geben Sie eine Uhrzeit ein.'
    },
    number: {
      fa: 'یک عدد وارد کنید.',
      en: 'Enter a number.',
      sv: 'Ange ett tal.',
      de: 'Geben Sie eine Zahl ein.'
    },
    url: {
      fa: 'نشانی کامل اینترنتی را وارد کنید.',
      en: 'Enter the full web address.',
      sv: 'Ange den fullständiga webbadressen.',
      de: 'Geben Sie die vollständige Internetadresse ein.'
    },
    email: {
      fa: 'نشانی ایمیل معتبر را وارد کنید.',
      en: 'Enter a valid email address.',
      sv: 'Ange en giltig e-postadress.',
      de: 'Geben Sie eine gültige E-Mail-Adresse ein.'
    },
    text: {
      fa: 'اطلاعات خواسته‌شده را وارد کنید.',
      en: 'Enter the requested information.',
      sv: 'Ange den efterfrågade informationen.',
      de: 'Geben Sie die angeforderten Informationen ein.'
    }
  } as const
  const detail = descriptions[type as keyof typeof descriptions] || descriptions.text
  const required = control?.props.required
    ? {
        fa: ' این فیلد ضروری است.',
        en: ' This field is required.',
        sv: ' Fältet är obligatoriskt.',
        de: ' Dieses Feld ist erforderlich.'
      }
    : { fa: '', en: '', sv: '', de: '' }
  const bounds =
    control?.props.min != null || control?.props.max != null
      ? ` (${control?.props.min ?? '…'}–${control?.props.max ?? '…'})`
      : ''
  const text = {
    fa: `${fieldName}: ${detail.fa}${bounds}${required.fa}`,
    en: `${fieldName}: ${detail.en}${bounds}${required.en}`,
    sv: `${fieldName}: ${detail.sv}${bounds}${required.sv}`,
    de: `${fieldName}: ${detail.de}${bounds}${required.de}`
  }
  const showHelp =
    !!control &&
    !['select', 'checkbox', 'radio', 'date', 'datetime-local', 'time', 'week', 'month', 'search'].includes(
      type
    ) &&
    !/\b(day|date|time|week|weekday|datum|dag|vecka|tid|uhrzeit|woche|tag)\b|تاریخ|ساعت|روز|هفته/i.test(
      fieldName
    )
  return (
    <div className={'academy-field-help academy-auto-field' + (showHelp ? ' has-help' : '')}>
      {searchable && (
        <input
          className="academy-select-search"
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      )}{' '}
      {body}
      {showHelp && <AcademyHelp locale={lang} text={text} />}
    </div>
  )
}
