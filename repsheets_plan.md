I want to create a web app that supports PWA that is designed to be a workout tracker. The backend for this workout tracker will be Google Sheets. The user will authenticate using their Google account and then select a sheet from the list of sheets that they have access to. Optionally if this is their first time opening the app, the app would generate an example Google Sheet (in their environment) that shows them the exact schema needed. What makes this app interesting is that a Google sheet can be shared among multiple people. 

Authentication:
All users will need to login with their google account and grant the necessary permissions/scopes to work with google sheets

Roles:
1. Athlete
	Athlete mode should be considered the default when a Google Sheet is used to track a user's own workouts. 
2. Coach
	Coach mode is still an athlete in that you can track your own workouts but you are also able to see all the other athletes' data that has been tracked in the log. This would allow you to keep track of clients or compare metrics between athletes. Coach Mode would only be applicable if there is at least one athlete in the log that is not the current user. A coach should be able to log their own workouts alongside those of their athletes if they choose. All of the functionality available to the athletes is also available to the coach. 

Sharing:
Sharing can be done in two different ways. 
1. Copy to my environment - In Google Sheets if you designate someone as a viewer, then they would need to copy the spreadsheet to their own environment and work with it there. This would be the method that you would choose if you wanted to share your workout on Reddit, for example, to a bunch of strangers. This would strip out your workout log but keep the designated routines intact for the other users to benefit from. 
2. Shared environment - Secondly you should be able to share your routine with another user but you maintain control of the spreadsheet. Both users now can work out and the log will track both athletes' progress. The owner of the spreadsheet would be considered the coach whereas the guests to the spreadsheet would be considered athletes. Athletes should not be able to change the log for any other athletes. Coaches should maintain full control. If technically feasible it would be nice for each athlete to automatically maintain a backup copy in their own environment just in case they lose access to the coach's spreadsheet.

Table Schema
The Rep Sheets Google Sheet is a dead simple spreadsheet that the user would use to configure their workout plan for the app. I can only think of 6 columns that we need in the table:
1. Routine - freeform text representing the friendly name of the routine that will be selectable in the UI (ex: "Monday:LegDay")
2. Exercise - freeform text representing the name of each exercise (ex: "Bench Press (Heavy)")
3. Sets - this would either be an integer representing which set or it could be an integer followed by an "x". If a user wrote 3x, for example, this would mean that they want 3 identical sets. This would be equivalent to them creating 3 identical rows in the table and incrementing the sets as 1,2, and 3.
4. Reps - an integer representing the number of repetitions for each exercise
5. Value - value represents the weight or any other measurable quantity that the user wants to track (ex: miles, lbs, kilos, seconds, minutes, rounds, anything)
6. Unit - unit describes what the value number signifies (ex: miles, lbs, kilos, seconds, minutes, rounds, anything)

UI
Desktop version - TODO
Mobile version - Please draw inspiration from the Hevy and Strong IOS apps. They have a modern, clean feel. I am envisioning 3 tabs on a bottom navbar.
1. Routines - This is a distinct list of routines that the user setup in the spreadsheet. Routines should be sorted in the same order as they appear in the spreadsheet and update in the mobile ui if updated in the spreadsheet (just upon refresh, no need for real-time). When a user clicks a routine from the list, the app would check to see if a workout is already in progress. If so, prompt the user if they want to discard the current workout before continuing. When no workout is currently in progress, this would take the user to the workout tab
2. Workout - This is the screen to show when there is a workout actively in progress. By default, this would be a condensed list of exercises with checkboxes. The goal is to get this to fit on an iphone screen so user can minimize their scrolling. For example:
	- Bench Press			[]
		5x5 @ 225lbs
	- Overhead press 		[]
		3x3 @ 185lbs
	- Barbell Rows			[]
		4x8 @ 155lbs
Each exercise should be easily readable followed by a subtitle summarizing the details. if the user checks the box on a parent item, all of the children should be checked automatically. If the user needs to change something, they can click the exercise to expand out the details. For example, if a user failed the last set of Bench Press from the example above, they can click on Bench Press and it should expand like this:
	- Bench Press 				[]
		1:	5reps	225llbs		[]
		2:	5reps	225llbs		[]
		3:	5reps	225llbs		[]
		4:	5reps	225llbs		[]
		5:	3reps	225llbs		[]
and the user can edit reps or values before saving it. In this example, i changed the set 5 reps to 3 to simulate a failure. When done, the user should be able to click the exercise again to collapse it back. Each fillable box (reps and values) should prepopulate with the most current value from the log for that specific routine/exercise/set# if it's available. Clicking on reps or values should bring up the number pad and highlight the current value to be overwritten. I want to make sure that it doesn't append to the value but overwrites the value by default.
3. Logs - TODO