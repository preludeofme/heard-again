Heard Again Account & Deployment Design
1. Purpose

Heard Again supports three different ways to use the product:

Local Self-Hosted
Connected Self-Hosted
Fully Cloud Hosted

The account system should be designed so users can move between these modes without losing their identity, billing relationship, or family structure.

The core principle is:

account identity is separate from where the data and compute run

That lets a user:

start locally
add a HeardAgain.com tunnel later
add cloud GPU generation later
fully migrate to cloud hosting later
2. Core Account Model

Every user should have a Heard Again account even if they self-host.

That account is the central identity for:

authentication
billing
subscription tier
instance registration
domain/tunnel entitlement
cloud GPU entitlement
family invitations
usage tracking
Core entities
User

Represents a single person with login credentials.

Fields:

id
email
password hash or oauth provider
display name
created at
last login at
status
default workspace id
Workspace

Represents a family vault, household, or personal archive.

Fields:

id
name
owner user id
plan type
deployment mode
created at
billing customer id
current subscription id
Membership

Represents a user’s role in a workspace.

Fields:

id
workspace id
user id
role
invited by
joined at
status
Instance

Represents a deployed Heard Again application.

Fields:

id
workspace id
type
status
version
registered at
last heartbeat at
tunnel enabled
tunnel subdomain
compute mode
data mode
Subscription

Represents billing plan and entitlements.

Fields:

id
workspace id
plan id
billing status
renewal date
generation minute quota
storage quota
member quota
tunnel entitlement
cloud hosting entitlement
3. Deployment Modes
A. Local Self-Hosted
Summary

User runs Heard Again on their own hardware and only accesses it locally.

Intended user
privacy-focused users
technical users
users with local GPU
open-source community
Characteristics
data stored locally
compute handled locally
no HeardAgain.com routing
no managed cloud infrastructure required
may still sign in with Heard Again account for updates, licensing, optional add-ons
Setup flow
User downloads open-source package
Runs install script or Docker compose
Creates or signs into Heard Again account
Creates a workspace
Registers local instance with Heard Again control plane optionally
Uses product on LAN or local machine
Notes

This should be the free entry point.

B. Connected Self-Hosted
Summary

User hosts their own data and app locally, but HeardAgain.com provides secure routing through a managed tunnel and optional cloud services.

Intended user
users who want privacy + convenience
users who want remote access
users who want family members to connect easily
users who do not want to manage DNS or port forwarding
Characteristics
data stays local
app stays local
secure outbound tunnel to HeardAgain.com
subdomain like smithfamily.heardagain.com
optional cloud GPU generation
optional family sharing
optional instance monitoring
Setup flow
User installs self-hosted version
Signs into Heard Again account
Chooses a paid Connected plan
Instance registers with control plane
Tunnel agent is provisioned
User receives managed subdomain
Family members can log in via HeardAgain.com and access the instance through secure routing
Notes

This is likely your best low-cost paid tier.

C. Fully Cloud Hosted
Summary

Heard Again hosts the app, storage, and compute.

Intended user
non-technical users
families who want easiest experience
mobile-first users
users who do not want local infrastructure
Characteristics
app hosted by Heard Again
data stored in Heard Again cloud
compute handled in Heard Again cloud
easiest onboarding
best supportability
highest operating cost
Setup flow
User signs up on HeardAgain.com
Creates workspace
Chooses hosted plan
Uploads recordings and stories
Uses product immediately
Notes

This should be your simplest premium product.

4. Account Types

These should be represented as subscription/entitlement tiers, not separate codebases.

1. Free Account
Purpose

Entry-level user account for local self-hosting and evaluation.

Includes
Heard Again account
one workspace
self-hosted local use
local-only access
no HeardAgain.com tunnel
no cloud GPU minutes
community support only
Good for
developers
technical families
people testing the product
2. Connected Account
Purpose

Self-hosted users who want remote access and convenience through HeardAgain.com.

Includes
all free features
secure tunnel / managed subdomain
remote access through HeardAgain.com
workspace identity sync
optional family invitations
optional cloud GPU add-on
health monitoring for instance
Good for
privacy-first paid users
users with their own storage
users with local compute or hybrid compute
Example price
$1/month or low-cost baseline tier
3. Cloud Account
Purpose

Users who want fully hosted experience.

Includes
fully hosted app
hosted storage
hosted auth
cloud GPU generation included or metered
family sharing
account recovery
managed updates
support
Good for
non-technical users
families wanting turnkey experience
4. Hybrid Account
Purpose

Users who store data locally or self-host the app, but use Heard Again cloud GPU for generation.

Includes
connected self-host features
cloud generation minutes
local data ownership
secure upload for generation jobs
returned generated audio saved back to user instance
Good for
self-hosters without strong GPU
self-hosters who want faster generation
privacy-sensitive users who still want convenience
5. Roles Within a Workspace

Each workspace should support role-based access.

Owner

Full control over:

billing
deployment mode
instance settings
invite/remove users
voice permissions
cloud settings
export/delete workspace
Admin

Can manage:

members
people/profiles
stories
generation jobs
instance settings except billing ownership
Editor

Can:

upload recordings
create and edit stories
generate audio
organize collections
Viewer / Family Member

Can:

listen to stories
browse people and memories
possibly comment or save favorites
cannot manage billing or infrastructure
Optional: Legacy Contributor

Can:

upload stories or recordings about a person
limited edit access
intended for extended family or relatives
6. Plan Matrix
Free Self-Hosted
deployment: local
storage: user-owned
compute: local
tunnel: no
family sharing: limited or none
custom domain/subdomain: no
support: community
Connected Self-Hosted
deployment: local
storage: user-owned
compute: local or optional cloud
tunnel: yes
managed subdomain: yes
family sharing: yes
support: standard
Hybrid Self-Hosted + Cloud Compute
deployment: local
storage: user-owned
compute: cloud
tunnel: yes
minute-based billing: yes
family sharing: yes
support: standard or premium
Fully Cloud Hosted
deployment: cloud
storage: cloud
compute: cloud
tunnel: not needed
family sharing: yes
easiest onboarding: yes
support: premium
7. Recommended User Flows
Flow 1: Free local user
Install Heard Again locally
Create account
Create workspace
Add stories and voices
Use only on local machine/LAN
Upsell path: remote access or cloud generation
Flow 2: Upgrade to Connected
User logs into account portal
Selects Connected plan
Adds payment method
Instance is linked to workspace
Tunnel agent receives token
Subdomain is assigned
Remote access becomes active
Flow 3: Add cloud generation to self-hosted
User keeps data local
User upgrades to generation plan
Local instance submits generation jobs to cloud
Cloud returns generated audio
Audio stored locally
Usage minutes tracked against workspace subscription
Flow 4: Move to fully hosted
User selects hosted migration
Local data exported/imported into cloud workspace
Cloud instance becomes primary
Optional local archive remains as backup
8. Security Model
For all accounts
workspace-scoped authorization
role-based permissions
signed session tokens
audit logging for voice generation and sharing
explicit consent confirmation for voice creation
AI-generated content labeling
For connected self-hosted
instance makes outbound tunnel connection only
no direct inbound port exposure required
instance registration with signed token
tunnel mapped to workspace and instance
short-lived access sessions validated by control plane
For hybrid compute
only required assets sent to cloud for generation
no silent retention of source audio
clear policy for temporary job artifacts
optional “process only, do not store” mode
9. Billing & Entitlements

Billing should be attached to the workspace, not the individual instance.

Why:

a family vault is the billable object
users may have multiple instances
deployment can change over time
Entitlements to track
tunnel enabled
cloud generation enabled
generation minutes quota
number of family members
number of voice profiles
number of workspaces
storage quota for hosted users
priority generation access
10. Product Recommendations
Recommended launch structure
Free
local self-hosted
one workspace
local-only access
local compute only
Connected
all free features
HeardAgain.com subdomain
secure tunnel
family access through central auth
Hybrid Compute
connected features
cloud generation minutes included
Cloud Hosted
full hosted app
storage + compute included
easiest onboarding

This structure is simple and maps well to actual infrastructure cost.

11. Technical Setup Recommendation
Control Plane

Central Heard Again service handles:

auth
billing
workspace management
plan entitlements
instance registry
tunnel registration
cloud generation job orchestration
Self-Hosted Data Plane

Local instance handles:

local db
local file storage
local playback
local user-facing app
optional local compute
tunnel agent
Cloud App Plane

Hosted instance handles:

managed app hosting
managed db/storage
generation jobs
family sharing
12. Migration Rules

Users should be able to move between plans without rebuilding everything.

Supported migrations
free self-hosted -> connected
connected -> hybrid
connected -> fully cloud hosted
cloud hosted -> export to self-hosted archive
hybrid -> local-only

That flexibility should be a major selling point.

13. Final Recommendation

The cleanest account structure is:

User = login identity
Workspace = family vault / billing unit
Instance = where the app runs
Plan = what services are enabled
Role = what each member can do

And the cleanest plan lineup is:

Free Local
Connected Self-Hosted
Hybrid Compute
Fully Hosted

This keeps the product understandable while giving you room to monetize:

convenience
secure access
cloud GPU generation
managed hosting