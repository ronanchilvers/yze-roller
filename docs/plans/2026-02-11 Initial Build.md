# Initial Build

## Behaviour Goals
- We are building a dice rolling app intended for use as an Owlbear Rodeo extension
- The initial implementation will be a single web page suitable for use in an iframe
  - Once the base functionality is in place we will convert it into an Owlbear Extension
- We will be implementing 3D dice
- The dice will be rolled in a "tray" window (in effect the iframe of the extension)
- The dice roller will have 3 different "types" of dice
  - Attribute dice - Standard D6 dice coloured green
  - Skill dice - Standard D6 dice coloured yellow
  - Strain dice - Standard D6 dice coloured red
- The user will be able to set a number of attribute and skill dice to roll each time
  - The user must select at least one attribute dice but may select zero skill dice
  - The number of dice last used will persist for convenience but the user can change it for any roll
- The app will broadcast the results of rolls using an Owlbear Rodeo toast to all users
  - A "success" is counted if a 6 appears on any die - more 6s are a "better" success
  - The toast should show "X successes"
- A user can elect to "push" the result
  - When "pushing", any dice that do not show either a 1 or a 6 are re-rolled
  - A "bane" is counted if a 1 appears on any die including dice previously rolled
  - A number of Strain Points equal to the number of "banes" are added to the global total
  - If a 1 appears on one or more strain dice, it indicates "Strain" is present
  - The toast result should show "X successes, X banes (with Strain)"
- Strain Points are shared by all users
- When a roll is made, a number of Strain Dice are added to the dice pool equal to the number of Strain Points
  - Strain dice are treated like any other dice, contributing successes and banes
- The current number of Strain Points should be shown clearly in the UI
