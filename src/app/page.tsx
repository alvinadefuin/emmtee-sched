import { connection } from "next/server";
import { PollView } from "./components/PollView";
import { getLatestMonthId, getMonthView } from "@/server/month-view";

export default async function Home() {
  await connection();
  const id = await getLatestMonthId();
  const view = id ? await getMonthView(id) : null;
  if (!view) {
    return <main className="mx-auto max-w-3xl px-4 py-12 text-center text-neutral-600">No schedule has been opened yet.</main>;
  }
  return <PollView view={view} />;
}
