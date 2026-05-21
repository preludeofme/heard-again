## Misc Updates

[ ] familyspace/new - when user clicks create new familyspace it routes to a 404 page
    [ ] the 404 has a go home button but it doesn't route the user back to the home page
[ ] narrative timeline
    [ ] the paper rendering looks good and the year is in the right place, but we need to move the text down as it's overlapping the year
[ ] Recent users drop down shows recent users from other profiles/userspaces. It gives you a 404 error but it shouldn't even show them in the list
[ ] Keepsake Drawer
    [ ] change the title wording from "Scanned letters, blueprints, and physical memories. to "Scanned letters, pictures, news articles, and more"
    [ ] When the user clicks the Upload  it routes them to the family space legacy page on the keepsakes and heirlooms instead of for the specific profile/user upload page.
[ ] profile page
    [ ] i'm on https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/profile/10303510-70af-45fe-9403-853dcf83e39d and the voice signature button is missing so there's not a way to add a new voice model.
        [ ] looks like the description of the person is being displayed in the voice signature area 
[ ] Legacy page / keepsakes
    [ ] the export zip is showing in the letters list on the keepsakes (should not be included)
[ ] family search 
    [ ]  There are multiple search components and i want to combine them into a single component to be reused throughout the app. 
    [ ] The search method on the family tree actually works as i'm wanting it, however i like the header search visually with the recent users drop down. So we'll need to combine these components. The search method from the family tree but use the ui from the header search. 
        [ ] Replace the search component on the family tree with the new combined component.
        [ ] Replace the search component in the header with the new combined component.
        [ ] Replace the search component on the stories contribute page with the new combined component.
[ ] Gedcom import 
    [ ] Ensure that our schema and parsing works with v7 gedcom files. review /home/trubuck-design/Projects/Personal/heard-again/docs/archived-dev-docs/gedcom7-rc.pdf
    [ ] Make sure notes/sources/etc that are not person specific info is logged appropriately such as stories/narratives etc. 
[ ] Family Tree
    [ ] Need to make a visual distinction between blood family and in laws. so that when looking at a large tree you can see who is actually blood family and who married in, especially when looking at a line that has a lot of members in the same line (i.e. 5 siblings with 5 spouses, the spouses should have a different line style or color to distinguish them from blood family.)
    [ ] Expand button - can you confirm what function that is filling? 
[ ] PNG Export
    [ ] need to finish building out the png export 
[ ] Timeline
    [ ] The timeline view on the https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/legacy?lens=journey there needs to have some sort of redesign as there is a large square of color that is empty across from events such as births and marriages. Maybe look for another use for that space to make it a cleaner look or visually appealing. 
[ ] Contribute 
    [ ] on the contribution page it shows "Record a Voice Memory" and that should take you to the add story page with tthe voice recording. but instead it takes you to the voice https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/legacy?lens=voices instead of https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/stories/contribute and if you have a person alreaady selected it should take you to their contribute page: https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/stories/contribute?subjectId=4983f542-ffcf-47eb-b7af-6609d4dadf54 but need tto have it go to the voice recording vs the text memory entry. So might need to add a url parameter and default the story type accordingly. 
    
