/* ============================================================
   PICTURE SETS  -  used by the picture games
   (Picture Reveal, and later What's Missing? and Hot Seat)
   ------------------------------------------------------------
   words: the picture file names from the images folder, with commas.
   The name shown to students is the file name ( - becomes a space ).
   To show a different name write      file=Name        e.g.  sailboat=boat
   Other answers that also count:      file=Name/other  e.g.  dog=dog/puppy
   group: used by Odd One Out ("The others are all animals.") - leave it out
          if the pictures don't make a clear group.
   To add your own set, copy one block and change it.
   ============================================================ */

addPictures({ id: 'animals', group: 'animals', title: 'Animals', picture: 'lion', words: `
  cat=cat/kitten/kitty, dog=dog/puppy/doggy, rabbit=rabbit/bunny, turtle=turtle/tortoise, elephant, lion, tiger, monkey=monkey/ape, giraffe, zebra,
  cow, pig=pig/piggy, horse=horse/pony, sheep=sheep/lamb, chicken=chicken/hen, duck, frog, fish, whale, dolphin,
  octopus, crab, snake, crocodile=crocodile/alligator, bird, owl, penguin, bee=bee/honeybee, butterfly, ant,
  snail, spider, bear=bear/teddy bear, panda, koala, kangaroo, camel, mouse=mouse/rat, dinosaur, t-rex=T. rex/dinosaur/trex,
  unicorn, bat, shark, hedgehog, flamingo
`});

addPictures({ id: 'food', group: 'food', title: 'Food', picture: 'pizza', words: `
  apple, banana, grapes=grapes/grape, orange, watermelon, strawberry, pineapple, mango, cherries=cherries/cherry, lemon,
  carrot, corn, broccoli, tomato, potato, bread, cheese, egg, rice, noodles=noodles/ramen,
  pizza, hamburger=hamburger/burger, hot-dog=hot dog/hotdog/sausage, sandwich, cake, ice-cream=ice cream, cookie=cookie/biscuit, candy=candy/sweets/lollipop, donut=donut/doughnut, milk,
  juice=juice/orange juice, popcorn, french-fries=french fries/fries/chips
`});

addPictures({ id: 'transport', group: 'transport', title: 'Transport', picture: 'bus', words: `
  car, bus, taxi=taxi/cab, train, airplane=airplane/plane/aeroplane/aircraft, bicycle=bicycle/bike, motorcycle=motorcycle/motorbike, sailboat=boat/sailboat, ship=ship/boat, helicopter,
  rocket, truck=truck/lorry, fire-engine=fire engine/fire truck, ambulance, police-car=police car, tractor, racing-car=racing car/race car/car
`});

addPictures({ id: 'things', title: 'Things', picture: 'backpack', words: `
  book, pencil, scissors, backpack=school bag/bag/backpack, clock=clock/alarm clock, football=ball/football/soccer ball, basketball=basketball/ball, balloon, gift=present/gift/box, umbrella,
  key, glasses, cap=cap/hat, t-shirt=T-shirt/shirt/tshirt, dress, shoe=shoe/shoes/sneaker, socks=socks/sock, crown, bell, guitar,
  drum, phone=phone/mobile phone/smartphone, computer=computer/laptop, television=TV/television, camera, light-bulb=light bulb/bulb/light, chair, bed, door, house=house/home,
  teddy-bear=teddy bear/teddy/bear, kite, robot, magnet, toothbrush, ruler, crayon=crayon/pencil,
  heart, cup=cup/mug, spoon, top-hat=hat/top hat, handbag=bag/handbag/purse, lollipop=lollipop/candy, watch=watch/clock, box=box/parcel/package,
  candle, boot=boot/boots/shoe, microscope, telescope, hourglass=hourglass/sand timer/timer, compass, thermometer,
  trumpet, violin, parachute, skateboard, tent, anchor, ladder
`});

addPictures({ id: 'nature', group: 'nature and weather', title: 'Nature & Weather', picture: 'rainbow', words: `
  sun, moon, star, cloud, rain=rain/rainy/raining/cloud, snowman, rainbow, lightning=lightning/thunder/storm, snowflake=snowflake/snow, fire,
  tree, sunflower=flower/sunflower, rose=rose/flower, tulip=flower/tulip, leaf, cactus, mountain, volcano, earth=earth/world/globe, mushroom
`});

addPictures({ id: 'feelings', group: 'feelings', title: 'Feelings', picture: 'happy', words: `
  happy=happy/smile, sad=sad/crying/cry, angry=angry/mad, surprised=surprised/shocked, sleepy=sleepy/tired/sleeping, scared=scared/afraid/frightened
`});
