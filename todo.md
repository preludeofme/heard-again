## Misc Updates

[x] comments on a story are posted as anonymous instead of tying to the user's profile/identity
[x] need to make sure when commenting and posting stories that it's connecting to the person record (family tree) rather than just the user (authenticated user) that way someone can click on the name from a comment and it will take them to the family record/profile 
[x] Add an export tree as image/pdf etc. 
    [x] allow the user to get a full picture of their tree and the size maybe if they want to frame it or something like that
[x] Add a load all button (but make sure to put a caution alert that it will cause performance and slowness depending on the size of the family)
[x] add a progress per chunk of family tree import (for larger trees)
[x] Fix the slice processing of the audio chunks so that it tells the user the progress of the audio generation, it used to work but since moving to runpod it doesn't 
[x] move first name to home sign up page to pass to user family node so that when the user creates the account with name and email it will take first name last name to put on the create user node 
[x] fix family tree as large families are all grouped at the same level even though they're are 16b generations meaning there should be that many levels
[x] fix initial voice generation test sample from profile page, use new audio generation system from narration
[x] redesign profile  to have less scrolling
[x] Record story audio needs to be fixed, errors using the old method of saving audio. need to follow the new method we use with cloning the voice
[x] filter out gedcom and any audio sample files from keepsakes
[ ] story audio recording - 
    [ ] transcription failed errors: 
{"level":"info","time":"2026-05-16T11:45:09.289Z","service":"heardagain-api","version":"unknown","storyId":"2d1042f4-08b0-4159-8f14-42196c217e51","assetId":"c10c714a-ec3c-4249-ac55-2f5b748f3b6f","msg":"[transcribe] fetching audio from storage"}
{"level":"info","time":"2026-05-16T11:45:09.402Z","service":"heardagain-api","version":"unknown","storyId":"2d1042f4-08b0-4159-8f14-42196c217e51","url":"https://api.runpod.ai/v2/gjtkiwlc3ja3y3/run/api/tts/transcribe","msg":"[transcribe] forwarding to TTS Whisper"}
{"level":"error","time":"2026-05-16T11:45:09.479Z","service":"heardagain-api","version":"unknown","storyId":"2d1042f4-08b0-4159-8f14-42196c217e51","status":404,"errText":"404 page not found","msg":"[transcribe] TTS transcription failed"}
{"level":"error","time":"2026-05-16T11:45:09.485Z","service":"heardagain-api","version":"unknown","value":"Transcription service failed — check TTS logs","msg":"[API ERROR] POST /api/stories/2d1042f4-08b0-4159-8f14-42196c217e51/transcribe (249ms):"}
[ ] Update all media players to use the styled  player from the profile page in the Voice Signature component (custom waveform)
    [ ] Updaate custom waveform media player to include timeline to show the audio timeline
[ ] UPDATE - record audio needs a start/stop button at top AND bottom of the script not just the top and bottom of the record component. 
[ ] Consent needs to pop up when user clicks record consent from generation success screen, currently when a voice is saved and you have the success modal and the button is "Record Consent" is pressed it just closes the modal and nothing happens. It should close the success modal but then immediately open the consent modal so the user can record their consent
[ ] user auth seems to lose the session sometimes and then they post as anonymous instead of as the user. also get csrf errors
[ ] error on commenting on a story: Something went wrong Cannot read properties of undefined (reading 'split') client side error after posting comment
[ ] comments and stories posted should be posted as the user's name not their email (needs to also link to their family profile if they have one)
[ ] family tree need to be able to zoom out more, for extremely large trees need to be able to see full picture even if it's unreadable 