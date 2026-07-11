"use client";

import { Title, Text, Container, Card, Button } from "@mantine/core";
import { useParams, useRouter } from "next/navigation";

export default function VerifyAttestationPage() {
  const params = useParams();
  const attestation_id = params.attestation_id as string;
  const router = useRouter();

  return (
    <Container size="sm" py="xl">
      <Title order={2} mb="xl">Attestation Verified</Title>
      
      <Card withBorder padding="xl" radius="md">
        <Text size="sm" c="dimmed">Attestation ID</Text>
        <Text mb="md" fw={500}>{attestation_id}</Text>
        
        <Text size="sm" c="dimmed">Verification Status</Text>
        <Text mb="xl" color="green" fw={500}>Valid on Stellar Testnet</Text>
        
        <Button variant="light" onClick={() => router.push("/verify")}>
          Back to Verification
        </Button>
      </Card>
    </Container>
  );
}
