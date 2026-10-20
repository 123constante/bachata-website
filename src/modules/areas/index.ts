// Teacher + DJ areas (slice B-WEB1). Lazy page components ONLY: route wiring is
// slice B-WEB3's. Wizard steps import from ./teacher/wizardSteps and ./dj/wizardSteps.
import { lazyWithRetry } from '@/lib/lazyWithRetry';

export const TeacherAreaPage = lazyWithRetry(() => import('./teacher/TeacherAreaPage'));
export const TeacherProfilePage = lazyWithRetry(() => import('./teacher/TeacherProfilePage'));
export const DjAreaPage = lazyWithRetry(() => import('./dj/DjAreaPage'));
export const DjProfilePage = lazyWithRetry(() => import('./dj/DjProfilePage'));
