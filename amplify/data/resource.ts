import { type ClientSchema, defineData, a } from '@aws-amplify/backend';

/* 
  We use 'a.schema' here because it provides the exact types 
  the 'defineData' function is looking for.
*/
const schema = a.schema({
  Todo: a.model({
    content: a.string(),
    isDone: a.boolean(),
    dueDate: a.date(), // Adds a date field
    priority: a.enum(['LOW', 'MEDIUM', 'HIGH']), // Adds a dropdown-style field
  }).authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
});


