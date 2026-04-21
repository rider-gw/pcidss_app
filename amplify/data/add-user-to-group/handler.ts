// amplify/data/add-user-to-group/handler.ts
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { Schema } from "../resource"

const client = new CognitoIdentityProviderClient({});

export const handler: Schema["addUserToGroup"]["functionHandler"] = async (event) => {
  const { username, groupName } = event.arguments;
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID;

  // 1. Remove from all possible groups first (to ensure they only have one role)
  const groups = ["ADMIN", "ISA", "AUDITOR", "CONTROL", "GUEST"];
  for (const group of groups) {
    try {
      await client.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: group,
      }));
    } catch (e) { /* Ignore if they weren't in the group */ }
  }

  // 2. Add to the new group
  await client.send(new AdminAddUserToGroupCommand({
    UserPoolId: userPoolId,
    Username: username,
    GroupName: groupName,
  }));

  return { status: "SUCCESS", message: `User moved to ${groupName}` };
};
