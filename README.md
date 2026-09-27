# Class Games

Simple games for the class TV. The teacher controls everything from a phone
(mirrored with SmartThings) or a laptop. Students play in teams and answer out loud.

Open **index.html** to start.

## Games
| Game | Status |
|---|---|
| Team Race (+ Tug of War) | Ready |
| Spin the Wheel | The **Pick** button (home page and every game) |
| Mystery Boxes | Ready |
| Picture Reveal | Ready |
| Hot Seat | Ready |
| What's Missing? | Ready |
| Save the Snowman | Ready |
| Dice Board Game | Ready |
| Odd One Out | Ready |

## Before class
1. Turn the phone sideways.
2. Tap **Full screen** (hides the browser bars).
3. Turn on **Do Not Disturb** so messages don't pop up on the TV.

Tip: on the phone, use the browser menu > **Add to Home screen**. It then opens
full screen like an app, and works without internet after the first visit.

## Laptop keys
| Key | Does |
|---|---|
| F | Full screen |
| W | Pick a student (wheel) |
| 1 2 3 4 | Team 1-4 got it right (Team Race) |
| 0 or N | Nobody - next question |
| A or Space | Show answer |
| U | Undo |

Team Race: the team whose turn it is answers (no stealing). Tap Right or Wrong - the answer shows, then tap "Next question" (it names the next team). Keys: Y/1 = right, N/0 = wrong, Enter/Space = next question, U = undo.
Team Race timer: Off / 10s / 15s / 20s. When time runs out the answer shows and the team gets no point. The timer pauses while the Pick wheel is open.

Mystery Boxes: inside a box, 1-4 = team got it, 0/N = nobody, A = show answer.
Picture Reveal: R = open a random tile, Y = right answer, N = wrong answer, G = guess now,
P = pass, 1-4 = team wants to guess (no-question mode), Enter = next picture.
In the guess box you can type the word on the keyboard and press Enter.

## Swap a picture
All pictures are in the **images** folder, named by the word (e.g. `cow.webp`).
1. Save your picture as **cow.png** or **cow.jpg** (same name, any of these types).
2. Put it in the **images** folder. Your picture now shows instead of the built-in one.
3. To go back, delete your file.

- Team characters are in **images/characters** (e.g. `rabbit.png`).
  If your picture faces the other way, change `faces:` for it at the top of `js/teams.js`.
- Pictures used by the menus are in **images/app**.
- Keep pictures small (about 300 x 300 pixels) so games load fast on the phone.
- Use pictures you made or ones with a free licence (e.g. Pixabay, Openclipart),
  because the website is public.

## G3 Science questions
`packs/science-g3.js` has 4 packs from the G3 Science book (Units 1-4). On a set-up screen tap
**Choose questions...** - packs are grouped (General / G3 Science) with an All / None button per group.
To add a pack to the G3 Science group, give it `group: 'G3 Science'`.

## Add your own questions
Open **packs/my-questions.js** and follow the example inside. One question per line:

```
What colour is the sky? | blue | cloud
```
question | answer | picture (optional, a file name from the images folder)

Hot Seat: Space = got it, S = skip, P = pause, Enter = start / next team.
Hot Seat "Our own words" (e.g. spelling words) are typed on the set-up screen and saved on that device.

What's Missing?: Space = hide / show answer / next round, A = show answer, 1-4 = team +1, U = undo.

Save the Snowman: type a letter to call it, Enter = next word. In "Solve it!" type the word and press Enter.
Its "Our spelling words" list is typed on the set-up screen (it can copy the Hot Seat list).

Dice Board Game: Space/Enter = roll, Y = right answer, N = wrong, A = show answer, U = undo.
Odd One Out: Space = show answer / next round, 1-4 = team +1, U = undo.
Odd One Out "Harder" rounds are in packs/odd-one-out.js (one line each: 4 pictures | odd one | why).

## Pictures for the picture games
Open **packs/picture-words.js**. Each set is a list of picture file names, e.g.
`cat, dog, ice-cream`. To show a different name, write `file=Name` (e.g. `sailboat=boat`).
Other answers that should also count go after a `/` (e.g. `dog=dog/puppy`) - Picture Reveal
uses these to check guesses.
You can add your own set with your own pictures.

## Mystery Box surprises
The surprises (and how many of each) are listed at the top of **js/games/mystery-boxes.js**.

## Classes & teams (nicknames)
Tap **Classes & teams** on the home page.
- **+ New class**, then **Edit names** and paste the nicknames (one per line).
- **Use this class**: the wheel and the team games now use these names.
- Tap a name to mark it **absent today** (it comes back tomorrow).
- **Teams** tab: **Shuffle teams** makes fair random teams. Tap a name to move it to the next team.
  Teams are remembered for next time.
- In a game, the **Pick** button starts on the team whose turn it is, so everyone in the team gets a turn.
  Tap a team's name or score to see who is in it.

**Save for all devices:** changes you make are kept on that phone/laptop. To share them with
every device, tap **Save for all devices** - it downloads `classes.js`. Upload it to the
**packs** folder on GitHub (replace the old one). **Load a classes file** reads one back.

## Without internet
Copy the whole folder to a USB drive or laptop and double-click **index.html**.
Everything works offline except the rounded font (a normal font is used instead).
