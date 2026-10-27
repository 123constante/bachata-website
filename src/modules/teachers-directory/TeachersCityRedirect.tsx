import { Navigate } from 'react-router-dom';
import { useCity } from '@/contexts/CityContext';
import { teachersRedirectTarget } from './teachersRedirect';

/** /teachers -> /city/<visitor city or london-gb>/teachers. */
export default function TeachersCityRedirect() {
  const { citySlug } = useCity();
  return <Navigate to={teachersRedirectTarget(citySlug)} replace />;
}
