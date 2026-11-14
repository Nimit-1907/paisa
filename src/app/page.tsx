import { redirect } from "next/navigation";

/** Records is the home tab (and the PWA start_url). */
export default function Home() {
  redirect("/records");
}
