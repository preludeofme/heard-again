

[ ] remove chat/conversation from navigation (this is a future enhancement but paused for now)
[ ] Rename all instances of "workspace" to "familyspace" 
[ ] Workspace
    [ ] Need to have the workspace (familyspace) admin page built out fully
    [ ] Member admin (roles, invites, etc.)
    [ ] familyspace settings (name, open/closed to public, who can add stories,etc)
    [ ] Data settings
        [ ] Ability to export full data package
    [ ] Ability to delete familyspace (requires vote from all members)
[ ] Voice Profiles Update
    [ ] Voice Profile page needs to be updated to where if all voice are selected, it shows who the voice is assigned to
    [ ] Need to have a person's profile selected before being able to create a voice (this will keep voices from being orphaned with no assigned person)

[ ] Documents Update
    [ ] the Documents page is showing what looks like audio samples or generated audio in the documents folder and those should be skipped if it's the audio generations from the stories and from testing the voice generation
[ ] Person/Family Member create
    [ ] need to add an optional photo for the profile page of the person
    [ ] Need to add the photo to the Stories page and any other page where we are showing either an avatar of the person or a picture of the family member
[ ] Add ability to insert photos into the stories (review thoughtsofmyfather project attached to workspace)
    [ ] Allow stories to have rich text and formatting added and the ability to add photos embedded in the text
[ ] Profile page 
    [ ] Need to make the Narrative or timeline section be easier to drag/scroll, right now it doesn't always register the click and hold when i begin dragging because i think the hyperlinks or buttons that make up the content of each item on the narrative timeline interferes with the drag and drop (but i'm not 100% sure)
    [ ] Voice Sample needs to actually play a voice sample when clicked (not re-route to the voice profiles page)
    [ ] Voice Sample needs to have a different image for if there's no voices currently available (right now it shows the same image of what looks like sound waves) and it's not clear to the user that there's not a voice model available, so needs to switch if there's a model needing to be made
[ ] Stories 
    [ ] Stories Narration
        [ ] The way the audio is stitched together does not flow, it is all one audio file but the audio cuts out between files for a split second, need to tighten up the stitching so that the audio doesn't sound stuttery.
    [ ] Stories Voice Record
        [ ] Ensure the ability to record the story from the browser will transcribe the story to text and save the raw audio 
        [ ] I would like to be able to show to the user that there's the following (if available) with either icons or something to indicate the different versions available:
            [ ] Raw audio from story teller
            [ ] Transcript (maybe show a small disclaimer saying it might need validating)
            [ ] Narration version
            [ ] AI Narration audio
    [ ] Need to account for the user and their relationship to the person they're telling the story about (if possible). 
        [ ] This helps with the narration ai generation so that it can generate a clearer first person account without as many errors if it knows who the story is about and who the teller is to the person
    [ ] Add button to share link to people to tell stories about your family member (shareable on social media, email, etc.)
        [ ] It will allow the user to tell a story (providing minimal information such as name, relationship and the story itself), Then when they submit a story it will ask them to create a free account (make sure it's clear that this is only so we can account the story to them etc. and that we don't market or sell their info to anyone)
    [ ] Finish setting up comments on stories so it will save and display comments 
    [ ] Finish setting up liking stories to show a count of those that linked it
    [ ] Stories should show the name of the user posting not the email address
    [ ] Need to have a share story link that will allow the story to be shared publicly without accounts 
        [ ] Make sure to add a disclaimer that anyone with the link will be able to access it (they can also set their sharing settings for their family/person in the familyspace settings)
[ ] Timeline page 
    [ ] should have the ability to filter for specific family member
    [ ] Should be draggable link the Narrative view in the profile page.
    [ ] Have the ability to switch between horizontal view and vertical view
        [ ] I like the way the narrative component looks and works in the profile, just want to expand it and add a little more features to make it a more full experience
    [ ] Each item on the timeline should have a way to view the full details of the event (in modal view not in a routing, i don't want them navigated away)
[ ] Family Tree
    [ ] Need to set the drag option as the default instead of the pointer
    [ ] Need to show relationship on modal to show how they're related
    [ ] If it helps to show that on the family tree diagram and it make sense, add it
    [ ] Need to add ability to import gedcom files so users can import their family trees from elsewhere
    [ ] Need ability to export to GedCom format
[ ] Privacy page
    [ ] Review if there's a legal requirement to include the Data Retention Policy (thinking mainly for like the UK users etc)
    [ ] If there is, see if we can include a don't remove data unless asked as the purpose of this site is to document family memories etc. like audio files
