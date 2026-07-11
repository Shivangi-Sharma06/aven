"use client";

import { Title, Text, Container, Card, TextInput, Button, Select } from "@mantine/core";
import { useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { useRouter } from "next/navigation";

export default function RegisterSenderPage() {
  const { connected } = useWallet();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", proofUrl: "", type: "Individual" });

  return (
    <Container size="sm" py="xl">
      <Title order={2} mb="xl">Register as Sender</Title>
      
      <Card withBorder padding="xl" radius="md">
        <Text mb="md">Provide identity verification to establish trust as a sender.</Text>
        
        <TextInput 
          label="Name / Organization" 
          placeholder="Acme Corp" 
          mb="md"
          value={form.name}
          onChange={(e) => setForm({...form, name: e.target.value})}
        />
        
        <TextInput 
          label="Proof URL (Website/Social)" 
          placeholder="https://..." 
          mb="md"
          value={form.proofUrl}
          onChange={(e) => setForm({...form, proofUrl: e.target.value})}
        />
        
        <Select
          label="Entity Type"
          data={['Individual', 'Company', 'DAO']}
          value={form.type}
          onChange={(val) => setForm({...form, type: val || "Individual"})}
          mb="xl"
        />
        
        <Button 
          fullWidth 
          disabled={!connected} 
          onClick={() => {
            // Mock submit
            setTimeout(() => router.push("/dashboard"), 1000);
          }}
        >
          Submit Registration
        </Button>
      </Card>
    </Container>
  );
}
