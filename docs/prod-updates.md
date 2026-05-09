[ ] review install script to assess if we need to include nextauth secret 
[ ] Home page (landing unauthenticated) Updates
    [ ] Remove the "Watch story" button from home landing page
    [ ] Add "Heard Again" logo to home landing page so they know what app their on
    [ ] Need to review the documentation on the project to get context of the application, then I want to improve:
        [ ] the hero and details on the main page to be more descriptive of the features such as family tree but specifically the AI features such as cloned voice and story narration.
        [ ] I want to highlight that this is an open source product for those that are technically inclined and who have the hardware
        [ ] I want to highlight the privacy aspect that this is their data, through self-hosting
        [ ] Guarantee that their data will NEVER be sold or used by the company or third-parties for any reason. This is their data and their story for them
    [ ] Need to include the pricing structure on the home page to make it clear what the costs are for using the service. This can be included on the home page or linked to the pricing page.
[ ] Need to update the google client and secrets because it's using the dev version
[ ] Need to hide the following pricing and account options because we need to finish the tunnelling. so only options are self-hosted Free, and the paid plans with limits on usage that can be increased with additional credits.
[ ] ensure there are no instances of Archive in the application, it should only focus on stories and keepsakes (review the other components to understand the language being used, we don't want archive being used as it sounds cold)
    [ ] there is a page titled "archive" so the route needs to be updated from /archive to something else (let me know if you have some options that make sense from a high level view of a family)
[ ] Remove apple sign in option
[ ] change the picture on the signup page, it looks to be a placeholder image of a sink for some reason. create a new image that fits the theme of the application (if you need me to generate the image let me know)
[ ] Move privacy policy and terms of service pages to the unauthenticated side of the app, anyone should be able to access it
[ ] Need to have the main state for what person is currently being worked on, so we can update the URL to include the person id. This will allow us to have a unique URL for each person, so we can link to them from other pages. 
[ ] Need to allow the user to clear the person or select full family so that they can switch between views (upper right drop down should drive this)
[ ] family view page (not the family tree, but the current /archive which will need to be changed) 
    [ ] Need to add some stats on how many family members and generations there are
    [ ] Need ability to upload an image for the family avatar (if none selected use the existing first letters of the name)
    [ ] Keepsakes 
        [ ] Keepsakes needs to be only the following types of files:
                [ ] Audio (except for the audio used to clone voices)
                [ ] Video
                [ ] Documents (PDF)
                [ ] Images
        [ ] Keepsakes should allow the user to change the type so that if they're looking at an image they can change the type to handwriting for example. 
    [ ] Remove the "Whose story" drop down and the button "+ add a memory" from the top of the page. These options are available when editing an individual person. 
    [ ] Add an "add" button to the different options on the family page such as events, milestones, keepsakes, stories, and voice clones. there are currently buttons but they're further down in the page and i want one clear at the top (don't remove the other buttons near the bottom though)
[ ] family member select drop downs (need to create a single component that has the debounced search that will look up family members, there is an existing search method that is case-insensitive and will search by any part of a name and be contains search instead of exact) This should replace all instances of family member selection in the application, so we can use it in multiple places and have a unified experience
    [ ] The component to use is the family search on the `/family-tree` page
[ ] Family Tree page
    [ ] Need to change the color that is being used for a level that is showing as a white color (not sure if it is a cream color or just white, but you can't see the font so it just looks like a white box)
    [ ] Search family component is built into the toolbar but when the user types a search in, the drop down is hidden by the z-index, the z-index needs to be updated to always be visible
    [ ] The export button errors out and goes to this page: https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/api/assets/f94f9620-91ae-42d4-a867-5f2825946999/download with this result: {"success":false,"error":"Asset not found"}
    [ ] Generate Family Bio
        [ ] Currently is not working, need to implement this functionality and have a place to store it on the familyspace so that it can be used elsewhere
    [ ] Load Parents button needs to be raised by 50 pixels
    [ ] Node card
        [ ] Need to add the relation to the user (self, spouse, child, great x3 grandfather, etc.) so that there are two rows under their name/birthday row.
        [ ] Need to add the ability to click on the relation and be taken to that person's page
        [ ] Need option to be able to add a photo for the family member (this can also be the same component used for the family page avatar upload) default is the current letters in the family member name
        [ ] Relative tab should allow the user to click on one of the relatives and open their modal node card
        [ ] Need confirmation modal before deleting a person
[ ] Can we add a dynamic header navigation where if a person is selected in the state, then there will be a "Profile" link next to "Story Contribute Family" which are the nav options currently
[ ] Story page
    [ ] Create Story
        [ ] Ritch Text Editor should be the default editor for stories, need to replace the current basic text area with it so users can add images directly in the story and add formatting
    [ ] If there are images attached to a story, then it should be displayed anywhere a story is referenced or displayed (except for on the story page when the user is viewing the full story) such as the lifejourney 
[ ] Create an "opensource.md" file to detail what needs to be done to get this project to an opensource state. It should review the codebase to see what needs to be done and suggest options that will keep the project open-source. 
