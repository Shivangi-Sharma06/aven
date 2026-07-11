"use client";

import { redirect } from "next/navigation";

// Redirect /profile to /profile/<wallet-address> via client-side check
// The profile/[address] page handles missing address gracefully.
export default function ProfileRedirectPage() {
  // Static redirect to a placeholder — real redirect happens client-side in [address] page
  redirect("/profile/me");
}
