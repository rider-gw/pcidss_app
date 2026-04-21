import { type ClientSchema, defineData, a } from "@aws-amplify/backend";
import { addUserToGroup } from "./add-user-to-group/resource"; // Ensure this import matches your folder name

const schema = a.schema({
  // 1. PCI Requirements / Controls
  Todo: a.model({
    content: a.string(),
    isDone: a.boolean(),
    priority: a.enum(['LOW', 'MEDIUM', 'HIGH']),
    dueDate: a.date(),
  }).authorization((allow) => [
    allow.group("ADMIN"),
    allow.group("ISA"),
    allow.group("AUDITOR").to(["read"])
  ]),

  // 2. User Metadata
  UserProfile: a.model({
    email: a.string().required(),
    lastLogin: a.datetime(),
  }).authorization((allow) => [
    allow.owner(),
    allow.group("ADMIN").to(["read"])
  ]),

  // 3. Immutable Audit Log
  AuditLog: a.model({
    userEmail: a.string().required(),
    action: a.string().required(),
    resource: a.string().required(),
    timestamp: a.datetime().required(),
    details: a.string(),
    recordHash: a.string().required(),
    previousHash: a.string(),
  }).authorization((allow) => [
    allow.group("ADMIN"),
    allow.group("ISA").to(["read", "create"]),
    allow.group("AUDITOR").to(["read"])
  ]),

  // 4. Evidence Vault Metadata
  Evidence: a.model({
    fileName: a.string().required(),
    s3Key: a.string().required(),
    controlId: a.string(),
    uploadedBy: a.string().required(),
    fileHash: a.string(),
    fileSize: a.integer(),
    status: a.enum(['PENDING', 'ACCEPTED', 'REJECTED']), 
    auditorComment: a.string(),
  }).authorization((allow) => [
    allow.group("ADMIN"),
    allow.group("ISA"),
    allow.group("AUDITOR").to(["read", "update"]) 
  ]),

    Asset: a.model({
    assetId: a.string().required(), // Your unique identifier (e.g. SRV-001)
    name: a.string().required(),
    type: a.enum(['SERVER', 'LAPTOP', 'PHONE', 'SOFTWARE']),
    location: a.string(),
    ownerEmail: a.string(),
    status: a.string(),
  }).authorization((allow) => [
    allow.group("ADMIN"),
    allow.group("ISA"),
    allow.group("AUDITOR").to(["read"])
  ]),

  // 6. User Group Assignments - Track which users are in which groups
  UserGroupAssignment: a.model({
    userEmail: a.string().required(),
    groupName: a.string().required(),
    assignedBy: a.string().required(),
    assignedAt: a.datetime().required(),
    notes: a.string(),
  }).authorization((allow) => [
    allow.group("ADMIN"),
    allow.group("ISA").to(["read"]),
  ]),

  // 7. PCI-DSS Controls
  PCIControl: a.model({
    controlName: a.string().required(),
    controlType: a.enum(['PREVENTATIVE', 'DETECTIVE', 'REACTIVE', 'DIRECTIVE']),
    controlMeasure: a.enum(['ELIMINATION', 'SUBSTITUTION', 'ENGINEERING', 'ADMINISTRATIVE']),
    description: a.string(),
    pciRequirement: a.string(), // e.g., "Requirement 1.1.1"
    status: a.enum(['ACTIVE', 'INACTIVE']),
    createdBy: a.string().required(),
    createdAt: a.datetime().required(),
  }).authorization((allow) => [
    allow.group("ADMIN"),
    allow.group("CONTROL").to(["create", "read", "update", "delete"]),
    allow.group("ISA").to(["read", "create", "update"]),
    allow.group("AUDITOR").to(["read"])
  ]),

  // --- 8. THE NEW ADMIN MUTATION ---
  addUserToGroup: a.mutation()
    .arguments({
      username: a.string().required(),
      groupName: a.string().required(),
    })
    .returns(a.customType({
      status: a.string(),
      message: a.string()
    }))
    .authorization((allow) => [allow.group("ADMIN")])
    .handler(a.handler.function(addUserToGroup)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});

