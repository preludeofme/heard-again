## Misc Updates

[x] comments on a story are posted as anonymous instead of tying to the user's profile/identity
[x] need to make sure when commenting and posting stories that it's connecting to the person record (family tree) rather than just the user (authenticated user) that way someone can click on the name from a comment and it will take them to the family record/profile 
[x] Add an export tree as image/pdf etc. 
    [x] allow the user to get a full picture of their tree and the size maybe if they want to frame it or something like that
[x] Add a load all button (but make sure to put a caution alert that it will cause performance and slowness depending on the size of the family)
[x] add a progress per chunk of family tree import (for larger trees)
[x] Fix the slice processing of the audio chunks so that it tells the user the progress of the audio generation, it used to work but since moving to runpod it doesn't 
[x] move first name to home sign up page to pass to user family node so that when the user creates the account with name and email it will take first name last name to put on the create user node 
[x] Consent needs to pop up when user clicks record consent from generation success screen
[x] fix family tree as large families are all grouped at the same level even though they're are 16b generations meaning there should be that many levels
[x] fix initial voice generation test sample from profile page, use new audio generation system from narration
[ ] setup trigger.dev locally SKIP FOR NOW
[x] redesign profile  to have less scrolling
[x] record audio needs a start/stop button at top AND bottom of record audio modal
[x] Record story audio needs to be fixed, errors using the old method of saving audio. need to follow the new method we use with cloning the voice
[x] filter out gedcom and any audio sample files from keepsakes
