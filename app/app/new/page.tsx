import { MomentCapture } from "@/components/moment-capture";

export const metadata = { title: "New moment — Soundmark" };

export default function NewMomentPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <MomentCapture />
    </div>
  );
}
