import '@/index.css';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TicketPickerB1 } from '@/modules/tickets/TicketPickerB1';
import { publicTicketKeys } from '@/modules/tickets/ticketCheckoutApi';
const mk = (id: string, name: string, p: number, e = {}) => ({ id, occurrenceId: null, name, pricePence: p, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...e });
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
qc.setQueryData(publicTicketKeys.types('e1', null), [mk('a', '1 Class + Latin Party', 1000), mk('b', 'Full Experience', 1500), mk('c', '5 Weeks Class', 6500)]);
const q = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><MemoryRouter initialEntries={['/event/e1' + (q.get('c') ? '?tickets=cancelled' : '')]}>
    <TicketPickerB1 seriesId="e1" occurrenceId={null} title="Coco Loco" dateLine="Wednesday 18 November, 9pm" venueLine="Ritmo Latino Studio" onClose={() => {}} />
  </MemoryRouter></QueryClientProvider>);
