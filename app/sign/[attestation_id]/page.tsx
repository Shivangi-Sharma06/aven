import { redirect } from "next/navigation";

export default async function SignRedirectPage({
  params,
}: {
  params: Promise<{ attestation_id: string }>;
}) {
  const { attestation_id } = await params;
  redirect(`/verify/${attestation_id}`);
}
