export const ATTENDANCE_AUTH_INTENT = 'attendance';
const ATTENDANCE_ACTION_PARAM = 'attendanceAction';
const ATTENDANCE_EVENT_ID_PARAM = 'attendanceEventId';
const ATTENDANCE_OCCURRENCE_ID_PARAM = 'attendanceOccurrenceId';

type AttendanceAction = 'going';

type AttendanceRedirectOptions = {
  pathname: string;
  search: string;
  eventId?: string | null;
  occurrenceId?: string | null;
  action?: AttendanceAction;
};

export type AttendanceRedirectState = {
  intent: typeof ATTENDANCE_AUTH_INTENT;
  action: AttendanceAction;
  eventId: string | null;
  occurrenceId: string | null;
};

const withSearch = (pathname: string, params: URLSearchParams) => {
  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
};

export const buildAttendanceReturnTo = ({
  pathname,
  search,
  eventId,
  occurrenceId,
  action = 'going',
}: AttendanceRedirectOptions) => {
  const params = new URLSearchParams(search);
  params.set('intent', ATTENDANCE_AUTH_INTENT);
  params.set(ATTENDANCE_ACTION_PARAM, action);

  if (eventId) params.set(ATTENDANCE_EVENT_ID_PARAM, eventId);
  else params.delete(ATTENDANCE_EVENT_ID_PARAM);

  if (occurrenceId) params.set(ATTENDANCE_OCCURRENCE_ID_PARAM, occurrenceId);
  else params.delete(ATTENDANCE_OCCURRENCE_ID_PARAM);

  return withSearch(pathname, params);
};

export const buildAttendanceAuthHref = ({ pathname, search, eventId, occurrenceId, action = 'going' }: AttendanceRedirectOptions) => {
  const returnTo = buildAttendanceReturnTo({ pathname, search, eventId, occurrenceId, action });
  const params = new URLSearchParams({
    mode: 'signin',
    intent: ATTENDANCE_AUTH_INTENT,
    returnTo,
  });

  if (eventId) {
    params.set('eventId', eventId);
  }

  return `/auth?${params.toString()}`;
};

export const readAttendanceRedirectState = (search: string): AttendanceRedirectState | null => {
  const params = new URLSearchParams(search);
  if (params.get('intent') !== ATTENDANCE_AUTH_INTENT) return null;

  const action = params.get(ATTENDANCE_ACTION_PARAM);
  if (action !== 'going') return null;

  return {
    intent: ATTENDANCE_AUTH_INTENT,
    action,
    eventId: params.get(ATTENDANCE_EVENT_ID_PARAM),
    occurrenceId: params.get(ATTENDANCE_OCCURRENCE_ID_PARAM),
  };
};

export const stripAttendanceRedirectState = (pathname: string, search: string) => {
  const params = new URLSearchParams(search);
  params.delete('intent');
  params.delete(ATTENDANCE_ACTION_PARAM);
  params.delete(ATTENDANCE_EVENT_ID_PARAM);
  params.delete(ATTENDANCE_OCCURRENCE_ID_PARAM);
  return withSearch(pathname, params);
};
