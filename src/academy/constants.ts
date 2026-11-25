import type { Locale } from './types'

export const subjects: Record<string, Record<Locale, string>> = {
  sv: { en: 'Swedish', sv: 'Svenska', fa: 'سوئدی', de: 'Schwedisch' },
  en: { en: 'English', sv: 'Engelska', fa: 'انگلیسی', de: 'Englisch' },
  de: { en: 'German', sv: 'Tyska', fa: 'آلمانی', de: 'Deutsch' },
  fa: { en: 'Persian', sv: 'Persiska', fa: 'فارسی', de: 'Persisch' }
}

export const blankCourse = {
  id: '',
  subject_code: 'sv',
  level_code: 'A1',
  title_en: '',
  title_sv: '',
  title_fa: '',
  title_de: '',
  description_en: '',
  description_sv: '',
  description_fa: '',
  description_de: '',
  topics_en: '',
  topics_sv: '',
  topics_fa: '',
  topics_de: '',
  duration_minutes: '60',
  price_sek: '',
  telegram_url: '',
  status: 'draft',
  individual: true,
  group: true,
  offline: true
}
export const blankTeacher = {
  id: '',
  user_id: '',
  display_name: '',
  name_en: '',
  name_fa: '',
  name_sv: '',
  name_de: '',
  photo_url: '',
  intro_en: '',
  intro_sv: '',
  intro_fa: '',
  intro_de: '',
  teaching_languages: 'sv',
  spoken_languages: 'en',
  levels: 'A1,A2,B1',
  specialties: '',
  email: '',
  phone: '',
  teams_chat_url: '',
  teams_call_url: '',
  telegram_url: '',
  status: 'draft'
}
