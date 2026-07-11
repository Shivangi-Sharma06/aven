import { redirect } from "next/navigation";

export default function AttestRedirectPage() {
  redirect("/stream/create");
}
