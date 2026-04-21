import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'pciAuditEvidence',
  access: (allow) => ({
    'evidence/*': [
      // Admins and ISAs can do everything
      allow.groups(['ADMIN', 'ISA']).to(['read', 'write', 'delete']),
      // Auditors can only read
      allow.groups(['AUDITOR']).to(['read'])
    ]
  })
});
