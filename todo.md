[ ] need to have date + location added to story form but as optional (but don't hide them, leave them visible)
[ ] these updates did not work and still needs to be implemented
    4. Deterministic Tree Rooting:
       * Hardened the Family Tree API to more reliably select the user's own record as the root. It now prioritizes the earliest person record created by the user, ensuring that
         imports (which might share a createdById) don't displace the user's primary profile.
        When a specific user is NOT selected, then it should automatically load the user's node and those around it
    5. Global Family Tree Search:
       * Expanded the family tree search to include all people in the familyspace, not just those currently visible in the tree subset.
       * Selecting a person from the search results now automatically refocuses the tree on that individual and centers the view on their node.
[ ] Need to either space out the lines so overlapping lines have space so you can see where they are connected or need to have different color lines so you can follow the lines properly. It is currently very hard to tell which lines connect which people if there are multiple lines on a level