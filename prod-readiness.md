[x] remove chat/conversation from navigation (this is a future enhancement but paused for now)
    [x] validated
[x] Rename all instances of "workspace" to "familyspace" (DB tables/columns/enums renamed via migration 20260428000000_rename_workspace_to_familyspace)
    [x] validated
[x] Familyspace
    [ ] validated
    [x] Need to have the familyspace admin page built out fully
        [ ] validated
    [x] Member admin (roles, invites, etc.)
        [ ] validated
    [x] familyspace settings (name, open/closed to public, who can add stories,etc)
        [ ] validated
    [x] Data settings
        [ ] validated
        [x] Ability to export full data package
            [ ] validated
    [x] Ability to delete familyspace (requires vote from all members)
        [ ] validated
[x] Voice Profiles Update
    [ ] validated
    [x] Voice Profile page needs to be updated to where if all voice are selected, it shows who the voice is assigned to
        [ ] validated
    [x] Need to have a person's profile selected before being able to create a voice (this will keep voices from being orphaned with no assigned person)
        [ ] validated

[x] Documents Update
    [ ] validated
    [x] the Documents page is showing what looks like audio samples or generated audio in the documents folder and those should be skipped if it's the audio generations from the stories and from testing the voice generation
        [ ] validated
[x] Person/Family Member create
    [ ] validated
    [x] need to add an optional photo for the profile page of the person
        [ ] validated
    [x] Need to add the photo to the Stories page and any other page where we are showing either an avatar of the person or a picture of the family member
        [ ] validated
[x] Add ability to insert photos into the stories (review thoughtsofmyfather project attached to familyspace)
    [x] validated
    [x] Allow stories to have rich text and formatting added and the ability to add photos embedded in the text
        [x] validated
[x] Profile page 
    [ ] validated
    [x] Need to make the Narrative or timeline section be easier to drag/scroll, right now it doesn't always register the click and hold when i begin dragging because i think the hyperlinks or buttons that make up the content of each item on the narrative timeline interferes with the drag and drop (but i'm not 100% sure)
        [x] validated
    [x] Voice Sample needs to actually play a voice sample when clicked (not re-route to the voice profiles page)
        [ ] validated
    [x] Voice Sample needs to have a different image for if there's no voices currently available (right now it shows the same image of what looks like sound waves) and it's not clear to the user that there's not a voice model available, so needs to switch if there's a model needing to be made
        [ ] validated
[x] Stories 
    [ ] validated
    [x] Stories Narration
        [ ] validated
        [x] The way the audio is stitched together does not flow, it is all one audio file but the audio cuts out between files for a split second, need to tighten up the stitching so that the audio doesn't sound stuttery. (Fixed by reducing silence padding to 50ms in worker)
            [ ] validated
    [x] Stories Voice Record
        [ ] validated
        [x] Ensure the ability to record the story from the browser will transcribe the story to text and save the raw audio (Implemented in controller and API)
            [ ] validated
        [x] I would like to be able to show to the user that there's the following (if available) with either icons or something to indicate the different versions available:
            [ ] validated
            [x] Raw audio from story teller
                [ ] validated
            [x] Transcript (maybe show a small disclaimer saying it might need validating)
                [ ] validated
            [x] Narration version
                [ ] validated
            [x] AI Narration audio
                [ ] validated
    [x] Need to account for the user and their relationship to the person they're telling the story about (if possible). (Added authorRelationship field to Story model and UI)
        [ ] validated
        [x] This helps with the narration ai generation so that it can generate a clearer first person account without as many errors if it knows who the story is about and who the teller is to the person
            [ ] validated
    [x] Add button to share link to people to tell stories about your family member (shareable on social media, email, etc.)
        [ ] validated
        [x] It will allow the user to tell a story (providing minimal information such as name, relationship and the story itself), Then when they submit a story it will ask them to create a free account (make sure it's clear that this is only so we can account the story to them etc. and that we don't market or sell their info to anyone)
            [ ] validated
    [x] Finish setting up comments on stories so it will save and display comments 
        [ ] validated
    [x] Finish setting up liking stories to show a count of those that linked it
        [ ] validated
    [x] Stories should show the name of the user posting not the email address
        [ ] validated
    [x] Need to have a share story link that will allow the story to be shared publicly without accounts 
        [ ] validated
        [x] Make sure to add a disclaimer that anyone with the link will be able to access it (they can also set their sharing settings for their family/person in the familyspace settings)
            [ ] validated
[x] Timeline page 
    [ ] validated
    [x] should have the ability to filter for specific family member
        [ ] validated
    [x] Should be draggable link the Narrative view in the profile page.
        [ ] validated
    [x] Have the ability to switch between horizontal view and vertical view
        [ ] validated
        [x] I like the way the narrative component looks and works in the profile, just want to expand it and add a little more features to make it a more full experience
            [ ] validated
    [x] Each item on the timeline should have a way to view the full details of the event (in modal view not in a routing, i don't want them navigated away)
        [ ] validated
[x] Family Tree
    [ ] validated
    [x] Need to set the drag option as the default instead of the pointer
        [ ] validated
    [x] Need to show relationship on modal to show how they're related
        [ ] validated
    [x] If it helps to show that on the family tree diagram and it make sense, add it
        [ ] validated
    [x] Need to add ability to import gedcom files so users can import their family trees from elsewhere
        [ ] validated
    [x] Need ability to export to GedCom format
        [ ] validated
[x] Privacy page
    [ ] validated
    [x] Review if there's a legal requirement to include the Data Retention Policy (thinking mainly for like the UK users etc)
        [ ] validated
    [x] If there is, see if we can include a don't remove data unless asked as the purpose of this site is to document family memories etc. like audio files
        [ ] validated
