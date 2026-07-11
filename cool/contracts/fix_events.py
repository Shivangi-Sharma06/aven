import re

def process_stream():
    with open("contracts/stream_contract/src/lib.rs", "r") as f:
        content = f.read()

    # Remove contractevent import
    content = content.replace("contractclient, contractevent, contractimpl", "contractclient, contractimpl")
    
    # Remove structs
    content = re.sub(r'#\[contractevent\]\s*pub struct \w+\s*\{[^}]+\}', '', content)
    
    # Replace publishes
    # StreamCreated
    content = re.sub(
        r'StreamCreated\s*\{\s*stream_id:\s*id,\s*sender,\s*recipient,\s*total_deposited,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "StreamCreated"), id), (sender.clone(), recipient.clone(), total_deposited));',
        content
    )
    
    # Withdrawn
    content = re.sub(
        r'Withdrawn\s*\{\s*stream_id,?\s*recipient:\s*stream\.recipient\.clone\(\),\s*amount:\s*withdrawable,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "Withdrawn"), stream_id), (stream.recipient.clone(), withdrawable));',
        content
    )
    
    # StreamPaused
    content = re.sub(
        r'StreamPaused\s*\{\s*stream_id,?\s*at_ledger:\s*ledger,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "StreamPaused"), stream_id), ledger);',
        content
    )
    
    # StreamResumed
    content = re.sub(
        r'StreamResumed\s*\{\s*stream_id,?\s*at_ledger:\s*ledger,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "StreamResumed"), stream_id), ledger);',
        content
    )
    
    # StreamCancelled
    content = re.sub(
        r'StreamCancelled\s*\{\s*stream_id,?\s*earned_paid:\s*earned,\s*refunded:\s*unstreamed,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "StreamCancelled"), stream_id), (earned, unstreamed));',
        content
    )
    
    # StreamCompleted
    content = re.sub(
        r'StreamCompleted\s*\{\s*stream_id,?\s*attestation_id,?\s*total_paid:\s*stream\.total_withdrawn,\s*refunded:\s*refund,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "StreamCompleted"), stream_id, attestation_id), (stream.total_withdrawn, refund));',
        content
    )
    
    with open("contracts/stream_contract/src/lib.rs", "w") as f:
        f.write(content)

def process_attestation():
    with open("contracts/attestation_contract/src/lib.rs", "r") as f:
        content = f.read()

    # Remove contractevent import
    content = content.replace("contract, contractevent, contractimpl", "contract, contractimpl")
    
    # Remove structs
    content = re.sub(r'#\[contractevent\]\s*pub struct \w+\s*\{[^}]+\}', '', content)
    
    # Replace publish
    content = re.sub(
        r'AttestationMinted\s*\{\s*attestation_id:\s*id,\s*stream_id,?\s*recipient,?\s*total_paid,?\s*\}\s*\.publish\(&env\);',
        'env.events().publish((soroban_sdk::Symbol::new(&env, "AttestationMinted"), id, stream_id), (recipient.clone(), total_paid));',
        content
    )

    with open("contracts/attestation_contract/src/lib.rs", "w") as f:
        f.write(content)

process_stream()
process_attestation()
