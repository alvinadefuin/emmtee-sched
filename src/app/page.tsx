import { connection } from "next/server";
import { PollView } from "./components/PollView";
import { getLatestMonthId, getMonthView } from "@/server/month-view";

export default async function Home() {
  await connection();
  const id = await getLatestMonthId();
  const view = id ? await getMonthView(id) : null;
  if (!view) {
    return (
      <main className="page-x page-bottom mx-auto w-full max-w-3xl pt-16">
        <p className="card p-8 text-center text-muted">No schedule has been opened yet.</p>
      </main>
    );
  }
  return <PollView view={view} />;
}
