## Misc Updates


[x] email sign up (non-google auth) getting csrf error
[x] Need to add a +Add to the family tree nodes so the user can add a new family member from that node 
[x] need toggle for using the narration version of the story or the original for the voice generation. That way someone can choose to generate/listen to each one if they want
[x] Look into vercel's malware scanner if there is one as alternative to CLAMAV
[x] Add whisper to runpod container 
[x] comments on a story are posted as anonymous instead of tying to the user's profile/identity
[x] need to make sure when commenting and posting stories that it's connecting to the person record (family tree) rather than just the user (authenticated user) that way someone can click on the name from a comment and it will take them to the family record/profile 
[x] Add an export tree as image/pdf etc. 
    [x] allow the user to get a full picture of their tree and the size maybe if they want to frame it or something like that
[x] Add a load all button (but make sure to put a caution alert that it will cause performance and slowness depending on the size of the family)
[x] add a progress per chunk of family tree import (for larger trees)
[x] Fix the slice processing of the audio chunks so that it tells the user the progress of the audio generation, it used to work but since moving to runpod it doesn't 