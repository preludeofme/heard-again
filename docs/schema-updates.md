# Heard Again Schema Review - Detailed Changes to Make

## Summary

Your schema is a strong starting point, but there are a few categories of changes you should make:

1. **Fix broken or incomplete relations**
2. **Add missing models needed for user stories**
3. **Add safety / consent support for voice cloning**
4. **Add import/export workflow support**
5. **Add collaboration/invite support**
6. **Add user-level content features like favorites and collections**
7. **Tighten naming and field design so future features are easier**

---

# 1. Fix Existing Schema Issues First

These are the most important changes because they affect correctness and future development.

## 1.1 Add missing `Collection` model
You reference `collections Collection[]` on `Familyspace`, but `Collection` does not exist.

### Change
Add:
- `Collection`
- `CollectionStory` join table

### Why
Needed for:
- story grouping
- “Grandpa’s Stories”
- “Holiday Memories”
- favorite collections / curated sets

### Recommended model shape
```prisma
model Collection {
  id          String   @id @default(uuid())
  familyspaceId String
  familyspace   Familyspace @relation(fields: [familyspaceId], references: [id], onDelete: Cascade)

  name        String
  description String?
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])

  isPinned    Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  stories     CollectionStory[]

  @@index([familyspaceId])
  @@index([createdById])
}

model CollectionStory {
  id           String     @id @default(uuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)

  storyId      String
  story        Story      @relation(fields: [storyId], references: [id], onDelete: Cascade)

  sortOrder    Int        @default(0)
  addedAt      DateTime   @default(now())

  @@unique([collectionId, storyId])
  @@index([collectionId])
  @@index([storyId])
}
```

---

## 1.2 Add actual relations for foreign-key-like fields
You have several fields that look relational but are just `String` fields.

### Change these into real relations where appropriate

#### `User.defaultFamilyspaceId`
### Current
```prisma
defaultFamilyspaceId String?
```

### Change
```prisma
defaultFamilyspaceId String?
defaultFamilyspace   Familyspace? @relation("UserDefaultFamilyspace", fields: [defaultFamilyspaceId], references: [id])
```

Then on `Familyspace`:
```prisma
defaultForUsers User[] @relation("UserDefaultFamilyspace")
```

---

#### `Person.createdById`
### Current
```prisma
createdById String
```

### Change
```prisma
createdById String
createdBy   User   @relation(fields: [createdById], references: [id])
```

Then on `User`:
```prisma
createdPeople Person[]
```

---

#### `Person.avatarAssetId`
### Current
```prisma
avatarAssetId String?
```

### Change
```prisma
avatarAssetId String?
avatarAsset   Asset? @relation("PersonAvatar", fields: [avatarAssetId], references: [id], onDelete: SetNull)
```

Then on `Asset`:
```prisma
personAvatarFor Person[] @relation("PersonAvatar")
```

---

#### `Asset.uploadedById`
### Current
```prisma
uploadedById String
```

### Change
```prisma
uploadedById String
uploadedBy   User   @relation(fields: [uploadedById], references: [id])
```

Then on `User`:
```prisma
uploadedAssets Asset[]
```

---

#### `VoiceProfile.sourceAssetId`
### Current
```prisma
sourceAssetId String?
```

### Change
```prisma
sourceAssetId String?
sourceAsset   Asset? @relation("VoiceProfileSourceAsset", fields: [sourceAssetId], references: [id], onDelete: SetNull)
```

Then on `Asset`:
```prisma
voiceProfileSources VoiceProfile[] @relation("VoiceProfileSourceAsset")
```

---

#### `Story.generatedAudioAssetId`
### Current
```prisma
generatedAudioAssetId String?
```

### Change
```prisma
generatedAudioAssetId String?
generatedAudioAsset   Asset? @relation("StoryGeneratedAudio", fields: [generatedAudioAssetId], references: [id], onDelete: SetNull)
```

Then on `Asset`:
```prisma
generatedAudioForStories Story[] @relation("StoryGeneratedAudio")
```

---

#### `Story.voiceProfileId`
### Current
```prisma
voiceProfileId String?
```

### Change
```prisma
voiceProfileId String?
voiceProfile   VoiceProfile? @relation(fields: [voiceProfileId], references: [id], onDelete: SetNull)
```

Then on `VoiceProfile`:
```prisma
stories Story[]
```

---

#### `Story.generationJobId`
This one is optional. I would recommend **not** storing this field directly on `Story` unless you want a “current/latest generation job” shortcut.

### Better option
Use `VoiceGenerationJob.storyId` as the main relation and query latest job by story.

If you want a shortcut, then make it a real relation:
```prisma
generationJobId String?
generationJob   VoiceGenerationJob? @relation("StoryCurrentGenerationJob", fields: [generationJobId], references: [id], onDelete: SetNull)
```

But this adds complexity because `VoiceGenerationJob` also points to `Story`.

### Recommendation
Remove `Story.generationJobId` unless you truly need it.

---

#### `VoiceGenerationJob.storyId`
### Current
```prisma
storyId String?
```

### Change
```prisma
storyId String?
story   Story? @relation(fields: [storyId], references: [id], onDelete: SetNull)
```

Then on `Story`:
```prisma
generationJobs VoiceGenerationJob[]
```

---

#### `VoiceGenerationJob.outputAssetId`
### Current
```prisma
outputAssetId String?
```

### Change
```prisma
outputAssetId String?
outputAsset   Asset? @relation("VoiceGenerationOutputAsset", fields: [outputAssetId], references: [id], onDelete: SetNull)
```

Then on `Asset`:
```prisma
voiceGenerationOutputs VoiceGenerationJob[] @relation("VoiceGenerationOutputAsset")
```

---

## 1.3 Remove or simplify `Familyspace.currentSubscriptionId`
You already have:
```prisma
subscription Subscription?
```

And `Subscription.familyspaceId` is unique.

### Recommendation
Remove:
```prisma
currentSubscriptionId String?
```

### Why
This duplicates the relationship and risks data drift.

---

## 1.4 Add missing relation names where ambiguity may happen
Because you now have multiple relations between some tables, name them explicitly.

### Recommended areas
- `User` ↔ `Familyspace`
- `User` ↔ `Person`
- `User` ↔ `Asset`
- `Story` ↔ `Asset`
- `VoiceProfile` ↔ `Asset`

### Why
Prevents Prisma ambiguity errors later.

---

# 2. Add Missing Models for User Stories

---

## 2.1 Add `FamilyspaceInvite`
Right now `Membership` is trying to do both:
- membership
- invitation

That will get messy.

### Add separate invitation model
```prisma
model FamilyspaceInvite {
  id          String   @id @default(uuid())

  familyspaceId String
  familyspace   Familyspace @relation(fields: [familyspaceId], references: [id], onDelete: Cascade)

  email       String
  role        FamilyspaceRole @default(VIEWER)

  invitedById String
  invitedBy   User     @relation(fields: [invitedById], references: [id])

  token       String   @unique
  status      InviteStatus @default(PENDING)

  expiresAt   DateTime
  acceptedAt  DateTime?
  declinedAt  DateTime?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([familyspaceId])
  @@index([email])
  @@index([token])
}

enum InviteStatus {
  PENDING
  ACCEPTED
  DECLINED
  EXPIRED
  REVOKED
}
```

### Why
Needed for:
- viewing invites
- accepting/declining invites
- email-based sharing before user account exists

---

## 2.2 Add `ImportJob`
Needed for importing GEDCOM, JSON, CSV, etc.

```prisma
model ImportJob {
  id            String   @id @default(uuid())

  familyspaceId   String
  familyspace     Familyspace @relation(fields: [familyspaceId], references: [id], onDelete: Cascade)

  sourceType    ImportSourceType
  sourceAssetId String?
  sourceAsset   Asset?   @relation("ImportSourceAsset", fields: [sourceAssetId], references: [id], onDelete: SetNull)

  status        JobStatus @default(PENDING)
  errorMessage  String?

  importedById  String
  importedBy    User      @relation(fields: [importedById], references: [id])

  resultSummary Json?

  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([familyspaceId])
  @@index([status])
}

enum ImportSourceType {
  GEDCOM
  JSON
  CSV
  MANUAL_MIGRATION
}
```

---

## 2.3 Add `ExportJob`
Needed for PDF export, ZIP backup, JSON export.

```prisma
model ExportJob {
  id            String   @id @default(uuid())

  familyspaceId   String
  familyspace     Familyspace @relation(fields: [familyspaceId], references: [id], onDelete: Cascade)

  exportType    ExportType
  status        JobStatus @default(PENDING)
  errorMessage  String?

  requestedById String
  requestedBy   User      @relation(fields: [requestedById], references: [id])

  outputAssetId String?
  outputAsset   Asset?    @relation("ExportOutputAsset", fields: [outputAssetId], references: [id], onDelete: SetNull)

  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([familyspaceId])
  @@index([status])
}

enum ExportType {
  PDF
  JSON
  ZIP
  GEDCOM
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}
```

---

## 2.4 Add `VoiceConsent`
This is important for trust and legal safety.

```prisma
model VoiceConsent {
  id                   String   @id @default(uuid())

  familyspaceId          String
  familyspace            Familyspace @relation(fields: [familyspaceId], references: [id], onDelete: Cascade)

  personId             String?
  person               Person?   @relation(fields: [personId], references: [id], onDelete: SetNull)

  voiceProfileId       String?
  voiceProfile         VoiceProfile? @relation(fields: [voiceProfileId], references: [id], onDelete: SetNull)

  consentType          ConsentType
  grantedByUserId      String
  grantedByUser        User      @relation(fields: [grantedByUserId], references: [id])

  attestationText      String?
  allowsGeneration     Boolean   @default(true)
  allowsCloudProcessing Boolean  @default(false)
  allowsSharing        Boolean   @default(false)

  recordedAt           DateTime  @default(now())
  revokedAt            DateTime?

  metadata             Json?

  @@index([familyspaceId])
  @@index([personId])
  @@index([voiceProfileId])
}

enum ConsentType {
  SELF
  FAMILY_ATTESTATION
  ESTATE_REPRESENTATIVE
  OTHER
}
```

### Why
Needed for:
- permission to use someone’s voice
- cloud vs local generation rules
- future compliance / trust messaging

---

# 3. Add Missing User-Level Features

---

## 3.1 Add story favorites
You have `Story.isPinned`, but that is not the same as a user personally favoriting a story.

```prisma
model StoryFavorite {
  id        String   @id @default(uuid())

  storyId    String
  story      Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)

  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt  DateTime @default(now())

  @@unique([storyId, userId])
  @@index([userId])
}
```

### Why
Needed for:
- favorite stories
- saved stories
- personalized quick access

---

## 3.2 Add person aliases / alternate names
Family trees often need:
- maiden names
- nicknames
- alternate spellings

### Option A - simple fields on `Person`
```prisma
middleName  String?
nickname    String?
maidenName  String?
```

### Option B - normalized model
```prisma
model PersonAlias {
  id         String   @id @default(uuid())

  personId    String
  person      Person   @relation(fields: [personId], references: [id], onDelete: Cascade)

  alias       String
  aliasType   PersonAliasType
  createdAt   DateTime @default(now())

  @@index([personId])
  @@index([alias])
}

enum PersonAliasType {
  NICKNAME
  MAIDEN_NAME
  LEGAL_NAME
  ALTERNATE_SPELLING
  OTHER
}
```

### Recommendation
For MVP, add fields directly to `Person`.
For long-term flexibility, use `PersonAlias`.

---

## 3.3 Add notification model if invites/sharing matter
Optional for MVP, but useful.

```prisma
model Notification {
  id          String   @id @default(uuid())

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  type        NotificationType
  title       String
  message     String?
  isRead      Boolean  @default(false)

  resourceType String?
  resourceId   String?

  createdAt   DateTime @default(now())

  @@index([userId, isRead])
}

enum NotificationType {
  INVITE_RECEIVED
  INVITE_ACCEPTED
  STORY_COMMENT
  STORY_SHARED
  GENERATION_COMPLETED
  GENERATION_FAILED
}
```

---

# 4. Improve Content Models

---

## 4.1 Add optional story summary / excerpt
Helpful for list views and export.

### Change
```prisma
excerpt String?
summary String?
```

### Why
Useful for:
- cards
- preview lists
- PDF export
- search results

---

## 4.2 Add `visibility` to stories
You have familyspace-level membership, but story-level visibility may matter later.

### Add
```prisma
visibility StoryVisibility @default(FAMILYSPACE)
```

```prisma
enum StoryVisibility {
  PRIVATE
  FAMILYSPACE
  SHARED_LINK
}
```

### Why
Supports:
- private drafts
- family-visible stories
- optional shared links later

---

## 4.3 Consider replacing `tags String[]` with a real tag model later
Current `String[]` is fine for MVP.

### Recommendation
Keep as-is for now.

### Later option
- `Tag`
- `StoryTag`
- `PersonTag`

This matters only if:
- you want tag autocomplete
- tag analytics
- tag cleanup / normalization

---

# 5. Improve Voice / TTS Models

---

## 5.1 Rename `modelPath`
`modelPath` is too implementation-specific if you support:
- local
- cloud
- different engines

### Recommendation
Replace:
```prisma
modelPath String
```

With either:
```prisma
artifactAssetId String?
artifactAsset   Asset? @relation(...)
```

Or:
```prisma
modelLocation String
```

### Best option
Use `Asset` for stored model artifacts when applicable.

---

## 5.2 Add provider/engine metadata to `VoiceProfile`
You will almost certainly want support for different engines later.

### Add
```prisma
engineName   String?
engineVersion String?
```

### Why
Lets you track:
- Chatterbox
- Qwen
- future engines
- upgraded voice versions

---

## 5.3 Add voice generation mode
Useful for hybrid/local/cloud decisions.

### Add to `VoiceGenerationJob`
```prisma
generationMode GenerationMode @default(DEFAULT)
```

```prisma
enum GenerationMode {
  DEFAULT
  LOCAL
  CLOUD
  HYBRID
}
```

---

## 5.4 Add usage billing granularity if needed
You already store:
- `durationSeconds`
- `computeTimeSeconds`

That is good.

### Recommendation
Keep it.

### Optional add
```prisma
billedMinutes Int?
```

Only if billing is tied to rounded usage.

---

# 6. Improve Familyspace / Instance Design

---

## 6.1 Add instance auth token expiry or rotation fields
You already have:
```prisma
tunnelToken String?
```

### Add
```prisma
tunnelTokenExpiresAt DateTime?
lastAuthenticatedAt  DateTime?
```

### Why
Improves tunnel security and supportability.

---

## 6.2 Add health/status metadata to `Instance`
Optional but helpful.

### Add
```prisma
lastErrorAt      DateTime?
lastErrorMessage String?
```

### Why
Useful for:
- offline debugging
- instance dashboard
- support

---

# 7. Add Search-Friendly Person Fields

For family trees, I would strongly recommend expanding `Person`.

## Recommended additions
```prisma
middleName String?
nickname   String?
maidenName String?
suffix     String? // Jr, Sr, III
```

### Why
Search and genealogy workflows become much better.

---

# 8. Tighten Membership vs Invite Responsibilities

## Keep `Membership` for active familyspace participation
Use it only for:
- accepted members
- role/permissions
- joinedAt
- user/familyspace link

## Move invitation flow to `FamilyspaceInvite`
That means:
- `MembershipStatus.PENDING` becomes unnecessary

### Recommendation
Change `MembershipStatus` to:
```prisma
enum MembershipStatus {
  ACTIVE
  SUSPENDED
  REMOVED
}
```

### Why
Cleaner separation:
- invite = invite
- membership = membership

---

# 9. Suggested MVP Priority Order

## Must do now
1. Add `Collection`
2. Add `FamilyspaceInvite`
3. Add `ImportJob`
4. Add `ExportJob`
5. Add `VoiceConsent`
6. Convert string FK fields into real relations
7. Remove or simplify `currentSubscriptionId`

## Strongly recommended next
8. Add `StoryFavorite`
9. Add person alias / nickname support
10. Add better instance tunnel security fields

## Later
11. Add notifications
12. Add story visibility
13. Normalize tags
14. Add tree layout preferences

---

# 10. Final Recommendation

If you want the schema to align well with your product and user stories, the most important improvements are:

- separate invites from memberships
- add import/export workflow models
- add voice consent
- add collections
- fix non-relational string fields
- add per-user favorites
- improve person naming support

If you make those changes, your schema will be much closer to supporting:
- family tree collaboration
- voice cloning safety
- self-hosted + connected + cloud plans
- import/export
- story curation
- user-specific experience