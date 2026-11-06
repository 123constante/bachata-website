// One React Query read of raffle_public_board_v1 (admin R0; not on prod yet, not in generated
// types, so rpcLoose). The function is POST only (not GET-safe); supabase.rpc posts. Nothing
// imports this yet (R3a foundations); gate consumers on flags.raffleV2.
import { useQuery } from '@tanstack/react-query';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { parseRaffleBoard, type RaffleBoard } from '@/lib/raffleBoard';

export const RAFFLE_BOARD_RPC = 'raffle_public_board_v1';

export async function fetchRaffleBoard(): Promise<RaffleBoard> {
  const { data, error } = await rpcLoose(RAFFLE_BOARD_RPC);
  if (error) throw new Error(error.message);
  return parseRaffleBoard(data);
}

export function useRaffleBoard(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['raffle-board'],
    queryFn: fetchRaffleBoard,
    enabled: options.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}
