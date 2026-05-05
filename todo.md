[x] need to have date + location added to story form but as optional (but don't hide them, leave them visible)
[x] these updates did not work and still needs to be implemented
    [x] 4. Deterministic Tree Rooting:
       * Hardened the Family Tree API to more reliably select the user's own record as the root. It now prioritizes the earliest person record created by the user, ensuring that
         imports (which might share a createdById) don't displace the user's primary profile.
        When a specific user is NOT selected, then it should automatically load the user's node and those around it
    [x] 5. Global Family Tree Search: currently only searches the visible members, needs to do a database lookup
       * Expanded the family tree search to include all people in the familyspace, not just those currently visible in the tree subset.
       * Selecting a person from the search results now automatically refocuses the tree on that individual and centers the view on their node.
[x] Need to either space out the lines so overlapping lines have space so you can see where they are connected or need to have different color lines so you can follow the lines properly. It is currently very hard to tell which lines connect which people if there are multiple lines on a level
[x] If two nodes are connected (such as father/mother) then they need to always been together and not separated (unless they're not specifically connected). I have seen an example where a mother and father had a random family member put in between their nodes so it looked like this: [mother][random family member][father]
    [x] Still finding instances where this isn't quite working, but it definitely is improving
[x] Add story button on family tree modal not working
[x] remove the collapse component from the family tree member search, just have a textbox to search with
[x] Add a self button so that the user can find their node 
    [x] if the user's node is not visible/loaded, then load all nodes leading to them (but none of the extra nodes like siblings etc.) it should traverse the tree until it has all direct descendant nodes
[x] update the self button to be something different as it just looks like a pointer instead of a self icon
[x] need to have a sibling load branch on the left/right side of the nodes (there's currently a load children at the top and load parents at the bottom)
    [x] Need to actually rename the buttons for "Load Branch":
        [x] the ones at the top should be Load Children (and not be there if no children for that node)
        [x] the ones at the bottom should be Load Parents
        [x] the ones at the side (to be created net neww) should be load siblings
    [x] Remove the Load Siblings Button from the toolbar 
[x] remove the Edit Relationships from the toolbar
[x] Child needs to be added to the drop down for relationship to person on the add story form
[x] Relatives tab on family tree node modal should show how each person is related instead of just listing the people they're related to
[x] Remove the pointer button and the hand button from the toolbar and we will always use the dragging hand button (default) 
[x] Received error when clicking on a result from the search on family tree page:
[x] seeing this error in network traffic: {
        "success": false,
        "error": "Invalid query parameters",
        "code": "BAD_REQUEST",
        "details": {
            "limit": "Too big: expected number to be <=50"
        }
    }Request URL
    https://trubuck-design-ai-beast.stern-mulley.ts.net:4777/api/people?limit=500
    Request Method
    GET
    Status Code
    400 Bad Request
[x] can remove chip from search bar on family tree as it's not needed
[x] Move toolbar to be at the end of the search bar on the family tree page
[x] Need to update the node shape to include the buttons to the sides of the shape. I want to make the buttons a part of the shape rather then separate so that each side of the shape if there are multiple siblings should show sibling, then top show Load Children, the bottom should be Load Parents
    [x] Make sure that the spacing of the shapes allows for this extra size of the shapes so the shapes don't overlap

    [ ] example:                             .-----------------------------.
                                          .-'                               '-.
                                       .-'                                     '-.
                                     .'                                           '.
                                    /                                               \
                                   /                                                 \
                                  |                                                   |
                                  |        ( )        Ryan Samuel Buck                |
                                  |       (   )       b. 1985                         |
      .----------------------.    |         Self • 0 Memories                         |
     /   « Load Siblings »   \ - -|                                                   |
     '----------------------'     |                                                   |
                                  |        [   Open Story   ]                         |
                                  |                                                   |
                                  |     [ Edit ] [ Relatives ] [ Add ]                |
                                  |                                                   |
                                   \                                                 /
                                    \                                               /
                                     '.                                           .'
                                       '-.                                     .-'
                                          '-.                               .-'
                                             '-----------------------------'

                              .-----------------------------.
                           .-'                               '-.
                        .-'                                     '-.
                      .'                                           '.
                     /                                               \
                    /                                                 \
                   |                                                   |
                   |        ( )        Ryan Samuel Buck                |
                   |       (   )       b. 1985                         |
 .-----------------+        ---        Self • 0 Memories               |
 |                 |                                                 |
 |       «         |        [   Open Story   ]                         |
 |      Load       |                                                   |
 |    Siblings     |     [ Edit ] [ Relatives ] [ Add ]                |
 |       »         |                                                   |
 '-----------------+                                                 |
                    \                                                 /
                     \                                               /
                      '.                                           .'
                        '-.                                     .-'
                           '-.                               .-'
                              '-----------------------------'