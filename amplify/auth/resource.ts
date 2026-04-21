// amplify/auth/resource.ts
import { defineAuth } from "@aws-amplify/backend"
import { addUserToGroup } from "../data/add-user-to-group/resource" // Import the function

export const auth = defineAuth({
  loginWith: { email: true },
  groups: ["ADMIN", "ISA", "AUDITOR", "CONTROL", "GUEST"],
  access: (allow) => [
    allow.resource(addUserToGroup).to(["addUserToGroup", "removeUserFromGroup"])
  ],
});




/*
import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
});
*/
