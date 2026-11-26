// Winner journey W4a: "You won!" (signed in, not straight from sign-in). Controlled, unrouted.
import { Ticket } from './GateScreen';

export default function WonScreen({ onChoose }: { onChoose: () => void }) {
  return (
    <main className="flex min-h-[100dvh] flex-col justify-center gap-4 bg-[#150a1c] px-5 py-6 text-[#f7ecd9]" data-testid="win-won">
      <h1 className="text-[46px] leading-[1.02] font-extrabold">You won!</h1>
      <Ticket
        title="Free entry to a bachata night you have never been to. Pick which one."
        stub={<div className="flex items-center gap-3"><span>Night</span><span className="flex-1 border-b-2 border-dashed border-[#24121f]/35 text-[13px] font-medium text-[#6d5560]">your pick goes here</span></div>}
      />
      <p className="self-start rounded-full bg-[#3ddbb4]/15 px-3 py-2 text-[13.5px] font-semibold text-[#3ddbb4]">You are signed in, so no WhatsApp needed.</p>
      <button type="button" onClick={onChoose} className="h-[56px] w-full rounded-[18px] bg-[#ec3458] text-[17px] font-bold text-white">Choose my night</button>
      <p className="text-[13px] text-[#f7ecd9]/60">By claiming this prize you agree to your photo and first name being shown publicly as a winner.</p>
    </main>
  );
}
