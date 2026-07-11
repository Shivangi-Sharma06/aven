import { redirect } from "next/navigation";

export default function SignRedirectPage() {
  redirect("/dashboard");
}
