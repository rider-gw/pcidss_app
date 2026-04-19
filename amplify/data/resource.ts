import { type ClientSchema, defineData, a } from '@aws-amplify/backend';

const schema = a.schema({
  Todo: a.model({
    content: a.string(),
    isDone: a.boolean(),
    dueDate: a.date(),
    priority: a.enum(['LOW', 'MEDIUM', 'HIGH']),
  }).authorization((allow) => [allow.owner()]),

  // ADD THIS BLOCK BELOW
  UserProfile: a.model({
    email: a.string().required(),
    lastLogin: a.datetime(),
  }).authorization((allow) => [allow.owner()]),
    AuditLog: a.model({
    userEmail: a.string().required(),
    action: a.string().required(),
    resource: a.string().required(),
    timestamp: a.datetime().required(),
    details: a.string(),
    recordHash: a.string().required(), // The integrity check
    previousHash: a.string(),         // The "Chain" link
  }).authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
});


