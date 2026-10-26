# Wembley scale adjustment

Approved by the user: uniformly scale the Wembley landmark to 125%, keeping its existing center and ground contact fixed. Scale the arch, roof, bowl, and lights together. No other landmark or city placement changes.

- Scope: `createWembley` plus the landmark geometry browser contract.
- Keep existing mesh/material/triangle budgets and update floodlight bounds with the scaled group.
- Check Wembley bounds, nearby clearance, and capture the existing route view.
