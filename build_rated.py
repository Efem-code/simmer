"""Build the reviewed-recipe section of data.js from .sources.json.

.sources.json holds what was read from each recipe page on Allrecipes: name,
link, star rating, number of ratings, yield, total time, calories, protein and
the ingredient list. The ingredient lists come straight from the source (facts);
the method steps, blurbs and tips below are written for Simmer in our own words.

    python3 build_rated.py      # rewrites the block between the RATED markers
"""
import json, re, os
from fractions import Fraction

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(HERE, '.sources.json')))

UNITS = {
    'cup': 'cup', 'cups': 'cups', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'pound': 'lb', 'pounds': 'lb', 'ounce': 'oz', 'ounces': 'oz', 'quart': 'quart', 'quarts': 'quarts',
    'gallon': 'gallon', 'gallons': 'gallons', 'clove': 'clove', 'cloves': 'cloves', 'can': 'can', 'cans': 'cans',
    'slice': 'slice', 'slices': 'slices', 'bunch': 'bunch', 'bunches': 'bunches', 'head': 'head', 'pinch': 'pinch',
    'dash': 'dash', 'sprig': 'sprig', 'package': 'package', 'container': 'container', 'tub': 'tub', 'bag': 'bag',
    'leaves': 'leaves', 'stalk': 'stalk',
}
SIZED = {'can', 'package', 'container', 'tub', 'bag'}
UNI = {'½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75, '⅛': .125}

def num(tok):
    if tok in UNI: return UNI[tok]
    if '/' in tok: a, b = tok.split('/'); return int(a) / int(b)
    return float(tok)

def nice(x):
    """0.33333334 -> 1/3 as a float the app can scale and print as ⅓."""
    f = Fraction(x).limit_denominator(8)
    return round(float(f), 4)

def parse(line):
    line = line.strip()
    m = re.match(r'^(\d+(?:\.\d+)?(?:\s+\d+/\d+)?|\d+/\d+|[½⅓⅔¼¾⅛])\s+(.*)$', line)
    if not m:
        return [None, '', line]
    parts = m.group(1).split()
    qty = sum(num(p) for p in parts)
    rest = m.group(2)
    size = ''
    s = re.match(r'^\(([^)]*)\)\s*(.*)$', rest)
    if s:
        size, rest = s.group(1), s.group(2)
    w = rest.split(' ', 1)
    unit = ''
    if w[0].lower() in UNITS and (not size or w[0].lower() in SIZED):
        unit = UNITS[w[0].lower()]
        rest = w[1] if len(w) > 1 else ''
    if size:
        size = size.replace(' ounce', ' oz').replace(' inch', '-inch')
        rest = f'{rest} ({size})' if unit or 'oz' not in size else f'{rest} ({size} each)'
    return [nice(qty), unit, rest]

def minutes(iso):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?', iso or '')
    return (int(m.group(1) or 0) * 60 + int(m.group(2) or 0)) if m else 0

def first_int(s):
    m = re.search(r'\d+', str(s or ''))
    return int(m.group()) if m else None

# Our metadata per recipe. key -> source id in .sources.json.
# time = hands-on-ish minutes shown on cards; wait = passive time (optional).
R = [
  # ── Breakfast ──
  dict(id='overnight-oats', src='overnight-oats', course='Breakfast', cuisine='namerican', level='Easy', emoji='🥣', title='Easy Overnight Oats',
       time=5, wait='overnight', tags=['vegetarian', 'make-ahead', 'quick'],
       blurb='Oats, Greek yogurt, chia and blueberries — shake the jar tonight, eat tomorrow.',
       steps=['Put the milk, yogurt, oats, honey, chia seeds and cinnamon in a half-pint jar, close the lid and shake until mixed.',
              'Stir in the blueberries.',
              'Refrigerate at least 8 hours or overnight, then eat cold straight from the jar.'],
       tips=['Make 3–4 jars at once; they keep 3 days.']),
  dict(id='egg-muffins', src='egg-muffins', course='Breakfast', cuisine='namerican', level='Easy', emoji='🧁', title='Muffin Pan Frittatas',
       time=35, tags=['high-protein', 'make-ahead', 'gluten-free', 'vegetarian'],
       blurb='Little veggie-and-cheddar frittatas you can grab all week.',
       steps=['Heat the oven to 350°F (175°C) and spray a 12-cup muffin tin.',
              'Soften the asparagus, pepper and onion in the olive oil over medium heat, 5–10 minutes.',
              'Whisk the eggs, milk, salt and pepper, then stir in the cooked vegetables and the cheddar.',
              'Spoon about ¼ cup into each cup and bake about 20 minutes, until set in the middle.'],
       tips=['Swap the asparagus for spinach or mushrooms.', 'Fridge 4 days; reheat 30 seconds.']),
  dict(id='avo-toast-egg', src='avo-toast-egg', course='Breakfast', cuisine='namerican', level='Easy', emoji='🥑', title='Avocado Toast with Egg',
       time=10, tags=['vegetarian', 'quick'],
       blurb='Creamy lemony avocado, a fried egg and a pinch of cayenne.',
       steps=['Melt the butter in a skillet over medium-low and fry the eggs 2–3 minutes, flip gently and cook to how you like the yolk.',
              'Toast the bread.',
              'Mash the avocado with lemon juice, cayenne and salt and spread it on the toast.',
              'Top each with an egg, salt and pepper.'],
       tips=['Use a little olive oil instead of butter if you prefer.']),
  dict(id='banana-pancakes', src='banana-pancakes', course='Breakfast', cuisine='namerican', level='Easy', emoji='🥞', title='Whole Wheat Oat & Banana Pancakes',
       time=30, tags=['vegetarian'],
       blurb='Fluffy pancakes made with oat flour, whole wheat and ripe banana.',
       steps=['Blend the oats into a coarse flour.',
              'Whisk the oat flour with both flours, brown sugar, milk powder, baking powder, baking soda and salt.',
              'In another bowl whisk the milk, egg, 2 tbsp oil and vanilla, then stir in the banana.',
              'Stir wet into dry just until combined and rest the batter 5 minutes.',
              'Cook spoonfuls on an oiled griddle over medium-high about 2 minutes, until bubbles form, then flip and brown the other side.'],
       tips=['Freeze leftovers with paper between them and toast from frozen.']),
  dict(id='shakshuka', src='shakshuka', course='Breakfast', cuisine='nafrican', level='Easy', emoji='🍳', title='Shakshuka',
       time=40, tags=['vegetarian', 'gluten-free', 'one-pan'],
       blurb='Eggs gently cooked in a spiced tomato and pepper sauce.',
       steps=['Cook the onion, bell pepper and garlic in the olive oil over medium about 5 minutes, until soft.',
              'Mix the tomatoes with the chile, cumin, paprika and salt, add to the pan and simmer uncovered about 10 minutes, until thick.',
              'Make 4 hollows and slip an egg into each.',
              'Cover and cook about 5 minutes, until the eggs are just set. Serve with bread.'],
       tips=['Crumble feta and parsley on top for extra flavour.']),
  # ── Drink ──
  dict(id='green-smoothie', src='green-smoothie', course='Drink', cuisine='namerican', level='Easy', emoji='🥤', title='Groovy Green Smoothie',
       time=10, tags=['vegetarian', 'quick', 'gluten-free'],
       blurb='Spinach hidden in banana, grapes, apple and yogurt.',
       steps=['Put the spinach, banana, grapes, yogurt and apple in the blender.',
              'Blend until smooth, scraping down the sides, and pour into two glasses.'],
       tips=['Plain yogurt plus a little honey cuts the sugar.', 'Freeze the grapes for a colder, thicker smoothie.']),
  # ── Appetizers ──
  dict(id='hummus', src='hummus', course='Appetizer', cuisine='mideast', level='Easy', emoji='🫘', title='Super Easy Hummus',
       time=5, tags=['vegan', 'gluten-free', 'no-cook', 'quick'],
       blurb='Five minutes in the food processor, no tahini needed.',
       steps=['Blend the chickpeas, lemon juice, olive oil, garlic, cumin, salt and sesame oil in a food processor.',
              'With the motor running, pour in the saved chickpea liquid a little at a time until it is as smooth as you like.',
              'Serve with veggie sticks or pita.'],
       tips=['Add a spoon of tahini for a classic flavour.']),
  dict(id='bruschetta', src='bruschetta', course='Appetizer', cuisine='italian', level='Easy', emoji='🍅', title='Double Tomato Bruschetta',
       time=35, tags=['vegetarian', 'party'],
       blurb='Fresh and sun-dried tomatoes with basil and melted mozzarella.',
       steps=['Turn on the broiler.',
              'Mix both tomatoes, garlic, olive oil, balsamic, basil, salt and pepper and let it sit 10 minutes.',
              'Slice the baguette ¾ inch thick and broil 1–2 minutes until lightly toasted.',
              'Spoon the tomato mix onto the toasts, top with mozzarella and broil about 5 minutes until melted.'],
       tips=['Use less cheese, or a whole-grain baguette, for a lighter version.']),
  dict(id='spring-rolls', src='spring-rolls', course='Appetizer', cuisine='viet', level='Medium', emoji='🥢', title='Vietnamese Fresh Spring Rolls',
       time=50, tags=['gluten-free', 'light'],
       blurb='Rice-paper rolls with shrimp, noodles and herbs, plus two dipping sauces.',
       steps=['Cook the vermicelli in boiling salted water 3–5 minutes, drain and cool.',
              'Dip a rice wrapper in warm water for about 1 second to soften and lay it flat.',
              'Lay 2 shrimp halves, some noodles, lettuce, mint, cilantro and basil across the middle, leaving the sides clear.',
              'Fold in the sides and roll up tightly. Repeat.',
              'Stir water, lime juice, sugar, fish sauce, garlic and chili sauce for one dip; hoisin with chopped peanuts for the other.'],
       tips=['Hoisin is gluten-free only if the label says so.', 'Cover finished rolls with a damp towel.']),
  dict(id='chicken-satay', src='chicken-satay', course='Appetizer', cuisine='thai', level='Medium', emoji='🍢', title='Easy Chicken Satay',
       time=35, wait='2 hours marinating', tags=['high-protein', 'party'],
       blurb='Curry-coconut chicken skewers with a warm peanut sauce.',
       steps=['Whisk ½ cup coconut milk with garlic, brown sugar, curry powder, salt and pepper; coat the chicken and marinate at least 2 hours.',
              'Heat the grill to medium-high and oil the grate. Thread the chicken onto the soaked skewers.',
              'For the sauce, whisk the remaining coconut milk, stock, peanut butter, brown sugar and curry powder over medium-high until simmering, then simmer about 5 minutes until thick. Stir in lime juice and soy sauce.',
              'Grill the skewers 4–5 minutes a side, to 165°F (74°C) inside.',
              'Serve with the warm sauce.'],
       tips=['Light coconut milk cuts the fat a lot.']),
  dict(id='tuna-tapas', src='tuna-tapas', course='Appetizer', cuisine='spanish', level='Easy', emoji='🐟', title='Avocado & Tuna Tapas',
       time=20, tags=['high-protein', 'no-cook', 'gluten-free'],
       blurb='Avocado halves stuffed with a zesty tuna and pepper salad.',
       steps=['Mix the tuna, mayonnaise, green onions, red pepper and balsamic.',
              'Season with pepper and garlic salt.',
              'Pile the tuna into the avocado halves and top with more green onion.'],
       tips=['Use Greek yogurt instead of mayo for extra protein.']),
  # ── Soups & salads ──
  dict(id='lentil-soup', src='lentil-soup', course='Soup & Salad', cuisine='namerican', level='Easy', emoji='🍲', title='Sweet Potato, Carrot, Apple & Red Lentil Soup',
       time=80, tags=['vegetarian', 'gluten-free', 'freezer'],
       blurb='Velvety, gently spiced and naturally sweet.',
       steps=['Melt the butter in a big pot over medium-high. Cook the sweet potato, carrot, apple and onion about 10 minutes, until the onion is clear.',
              'Stir in the lentils and all the spices, add the broth and bring to a boil.',
              'Cover and simmer on medium-low about 30 minutes, until everything is soft.',
              'Blend until smooth, then simmer 10 minutes more, adding water if it is too thick.'],
       tips=['Use olive oil instead of butter to make it vegan.', 'Freezes well for 3 months.']),
  dict(id='chickpea-salad', src='chickpea-salad', course='Soup & Salad', cuisine='greek', level='Easy', emoji='🥗', title='Mediterranean Zucchini & Chickpea Salad',
       time=25, tags=['vegetarian', 'gluten-free', 'no-cook', 'make-ahead'],
       blurb='Raw zucchini, chickpeas, feta and olives in a herby dressing.',
       steps=['Dice and chop all the vegetables.',
              'Toss everything together in a large bowl and season with salt and pepper.',
              'Let it sit 15 minutes so the flavours blend.'],
       tips=['Keeps 3 days in the fridge.']),
  dict(id='tabbouleh', src='tabbouleh', course='Soup & Salad', cuisine='mideast', level='Easy', emoji='🌿', title='Quinoa Tabbouleh',
       time=30, tags=['vegan', 'gluten-free', 'make-ahead'],
       blurb='Lemony herb salad with quinoa instead of bulgur.',
       steps=['Boil the water, add the quinoa and a pinch of salt, cover and simmer on low 15 minutes. Cool and fluff.',
              'Meanwhile mix the olive oil, sea salt, lemon juice, tomatoes, cucumber, green onions, carrots and parsley.',
              'Stir in the cooled quinoa.'],
       tips=['Even better after an hour in the fridge.']),
  dict(id='beef-pho', src='pho', course='Soup & Salad', cuisine='viet', level='Hard', emoji='🍜', title='Beef Pho',
       time=180, wait='overnight chilling', tags=['high-protein', 'gluten-free', 'weekend project'],
       blurb='Slow-simmered beef broth with charred onion, ginger and star anise.',
       steps=['Cover the beef bones with the water, add 1 tsp salt, bring to a boil and simmer about 2 hours.',
              'Meanwhile broil the onions and ginger until charred, 10–15 minutes. Chop the onion and slice the ginger.',
              'Skim the broth. Add the oxtail, radish and onion, plus the ginger, star anise, cinnamon, peppercorns and cloves tied in cheesecloth. Season with sugar, fish sauce and the rest of the salt and keep simmering.',
              'Strain, discard the bones and spice bag, and chill the broth overnight.',
              'Lift off the fat, then bring the broth back to a boil.',
              'Soak the rice noodles in just-boiled water 6–10 minutes and slice the frozen sirloin paper-thin.',
              'Put noodles and raw sirloin in bowls and ladle the boiling broth over to cook the beef. Add herbs, lime and sprouts at the table.'],
       tips=['Serve with bean sprouts, Thai basil, lime, sliced chili, hoisin and sriracha.', 'Broth freezes for 3 months.']),
  dict(id='quinoa-salad', src='quinoa-salad', course='Soup & Salad', cuisine='mexican', level='Easy', emoji='🥙', title='Easy Quinoa Salad',
       time=30, tags=['vegan', 'gluten-free', 'make-ahead'],
       blurb='Black beans, tomatoes and cilantro in a lime-cumin dressing.',
       steps=['Bring the water and quinoa to a boil, cover and simmer on medium-low 10–15 minutes until absorbed. Cool.',
              'Whisk the olive oil, lime juice, cumin, salt and pepper flakes.',
              'Toss the quinoa with the tomatoes, beans and green onions, pour over the dressing and stir in the cilantro.'],
       tips=['Keeps 5 days in the fridge — great for lunches.']),
  dict(id='miso-soup', src='miso-soup', course='Soup & Salad', cuisine='japanese', level='Easy', emoji='🍵', title='Miso Soup',
       time=15, tags=['quick', 'light'],
       blurb='Light, savoury broth with silken tofu and green onion.',
       steps=['Bring the water and dashi granules to a boil.',
              'Turn to medium and whisk in the miso paste.',
              'Add the tofu and green onions and simmer gently 2–3 minutes. Do not boil hard once the miso is in.'],
       tips=['Dashi is made from fish; use kombu (seaweed) dashi to make it vegan.']),
  # ── Mains ──
  dict(id='lettuce-wraps', src='lettuce-wraps', course='Main', cuisine='chinese', level='Easy', emoji='🥬', title='Asian Lettuce Wraps',
       time=30, tags=['high-protein', 'low-carb', 'quick'],
       blurb='Saucy beef and water chestnuts in crisp butter-lettuce cups.',
       steps=['Rinse and dry the lettuce leaves without tearing them.',
              'Brown the beef in the oil over medium-high, 5–7 minutes, then move it to a bowl and pour off the fat.',
              'Cook the onion in the same pan 5–7 minutes.',
              'Stir in the hoisin, garlic, soy sauce, rice vinegar, ginger and chile sauce, then the water chestnuts, green onions, sesame oil and beef. Cook 2 minutes.',
              'Spoon into the lettuce cups.'],
       tips=['Ground chicken or turkey works the same way.']),
  dict(id='sheet-salmon', src='salmon', course='Main', cuisine='namerican', level='Easy', emoji='🍣', title='Easy 5-Ingredient Salmon',
       time=15, tags=['high-protein', 'gluten-free', 'quick'],
       blurb='Garlic-basil salmon pan-seared in 10 minutes.',
       steps=['Mix the garlic powder, basil and salt and rub it all over the salmon.',
              'Melt the butter in a large skillet over medium heat.',
              'Cook the salmon about 5 minutes per side, until browned and flaky.',
              'Serve with lemon wedges.'],
       tips=['Pair with the roasted broccoli and some brown rice.']),
  dict(id='chicken-stirfry', src='chicken-stirfry', course='Main', cuisine='chinese', level='Medium', emoji='🥢', title='Chicken Stir Fry',
       time=40, tags=['high-protein'],
       blurb='Ginger-garlic chicken with lots of crunchy vegetables over rice.',
       steps=['Simmer the rice in the water, covered, 20–25 minutes.',
              'Stir the soy sauce, brown sugar and cornstarch smooth, add the ginger, garlic and pepper flakes, and marinate the chicken in it at least 15 minutes.',
              'Stir-fry the vegetables in 1 tbsp sesame oil over medium-high about 5 minutes, then set aside.',
              'Heat the rest of the oil, sear the chicken (keep the marinade) about 2 minutes a side.',
              'Add the vegetables and marinade, bring to a boil and cook 5–7 minutes until the chicken is cooked through. Serve over the rice.'],
       tips=['Low-sodium soy sauce and brown rice make it lighter.']),
  dict(id='turkey-chili', src='turkey-chili', course='Main', cuisine='mexican', level='Easy', emoji='🌶️', title='Terrific Turkey Chili',
       time=70, tags=['high-protein', 'gluten-free', 'freezer'],
       blurb='Taco-spiced turkey chili loaded with zucchini and peppers.',
       steps=['Brown the turkey in 1 tbsp oil in a big pot, breaking it up, then season with the taco mix, coriander, oregano, chili flakes and tomato paste.',
              'Add the broth and simmer 5 minutes, then add the salsa, tomatoes and green chiles and simmer 10 minutes.',
              'Meanwhile cook the onion and pepper in 1 tbsp oil 5 minutes and add to the chili.',
              'Brown the zucchini in the last tbsp oil 5 minutes, add it, and simmer 15 minutes more.',
              'Top with sour cream, green onion and cheddar.'],
       tips=['Greek yogurt instead of sour cream adds protein.', 'Check the taco seasoning label if you need it gluten-free.']),
  dict(id='shrimp-tacos', src='shrimp-tacos', course='Main', cuisine='mexican', level='Easy', emoji='🌮', title='Shrimp Tacos with Mango Salsa',
       time=50, tags=['high-protein'],
       blurb='Sweet-buttery shrimp with a fresh mango-avocado salsa.',
       steps=['Toss the tomatoes, mango, avocado, cilantro, onion, lime juice, garlic and salt and chill 30 minutes.',
              'Melt the honey butter in a skillet over medium-high and cook the shrimp 2–3 minutes, until pink.',
              'Fill the warm tortillas with shrimp and salsa.'],
       tips=['Corn tortillas make it lighter and gluten-free.']),
  dict(id='chickpea-curry', src='chickpea-curry', course='Main', cuisine='indian', level='Easy', emoji='🍛', title='Creamy Chickpea Curry',
       time=45, tags=['vegan', 'one-pot'],
       blurb='Potatoes, cauliflower and chickpeas in a coconut curry sauce.',
       steps=['Brown the onion in the coconut oil 5–7 minutes, then add the ginger and garlic for 30 seconds.',
              'Stir in the curry powder, pepper flakes, broth, soy sauce, maple syrup and tomato paste.',
              'Add the potatoes and carrot, cover, bring to a boil and simmer with the lid ajar about 10 minutes.',
              'Add the cauliflower, chickpeas, coconut milk and cilantro and simmer until the cauliflower is tender, then stir in the peas.',
              'Season and serve over basmati rice with sriracha on the side.'],
       tips=['Use tamari to make it gluten-free.']),
  dict(id='zucchini-lasagna', src='zucchini-lasagna', course='Main', cuisine='italian', level='Medium', emoji='🍝', title='Zucchini Lasagna',
       time=80, tags=['low-carb', 'gluten-free', 'high-protein'],
       blurb='Lasagna layered with zucchini instead of noodles.',
       steps=['Heat the oven to 375°F (190°C) and grease an 8-inch square dish. Pat the zucchini slices dry.',
              'Brown the beef in the olive oil 5–8 minutes, add the marinara, 1 tsp salt, oregano and pepper, and simmer 10 minutes.',
              'Mix the ricotta, egg, 1 tsp salt and nutmeg.',
              'Layer: zucchini, half the sauce, zucchini, the ricotta, half the mozzarella, zucchini, the rest of the sauce and mozzarella, then the parmesan.',
              'Cover with foil and bake 30 minutes, then uncover and bake about 15 minutes more until golden.'],
       tips=['Salt the zucchini slices and leave 15 minutes before patting dry for a less watery lasagna.']),
  dict(id='greek-chicken', src='greek-chicken', course='Main', cuisine='greek', level='Easy', emoji='🍗', title='Greek Lemon Chicken & Potato Bake',
       time=70, tags=['high-protein', 'gluten-free', 'one-pan'],
       blurb='Lemon-herb chicken quarters, potatoes and green beans on one tray.',
       steps=['Heat the oven to 425°F (220°C) and grease a large rimmed tray. Put the chicken on it.',
              'Toss the potatoes with the olive oil, juice of 1 lemon, basil, oregano, salt, pepper and lemon-herb seasoning. Arrange around the chicken and pour most of the oil mix over; keep a little.',
              'Bake 30 minutes, shake the tray and bake 15 minutes more.',
              'Toss the green beans in the reserved oil, scatter over the tray and bake about 15 minutes, until the chicken reaches 165°F (74°C). Squeeze over the second lemon.'],
       tips=['Use skinless thighs and half the oil for a lighter version.']),
  dict(id='teriyaki-chicken', src='teriyaki-chicken', course='Main', cuisine='japanese', level='Easy', emoji='🍱', title='Baked Teriyaki Chicken',
       time=65, tags=['high-protein'],
       blurb='Sticky homemade teriyaki baked onto juicy chicken thighs.',
       steps=['Heat the oven to 425°F (220°C) and grease a 9×13 dish.',
              'Simmer the sugar, soy sauce, vinegar, cornstarch, water, garlic, ginger and pepper over low 3–5 minutes, until thick.',
              'Brush the chicken all over with sauce and bake 30 minutes.',
              'Flip, brush again, and bake 20–30 minutes more, basting every 10 minutes, until cooked through.'],
       tips=['Halve the sugar for a less sweet sauce.', 'Serve over rice with steamed broccoli.']),
  dict(id='black-bean-burgers', src='black-bean-burgers', course='Main', cuisine='namerican', level='Easy', emoji='🍔', title='Quinoa Black Bean Burgers',
       time=35, tags=['vegetarian', 'freezer'],
       blurb='Hearty, spicy-edged patties that hold together.',
       steps=['Simmer the quinoa in the water, covered, 15–20 minutes until absorbed.',
              'Mash the beans roughly, then mix in the quinoa, bread crumbs, pepper, egg, onion, garlic, cumin, hot sauce and salt. Shape 5 patties.',
              'Heat the olive oil in a skillet over medium.',
              'Cook the patties 2–3 minutes a side until browned and hot through.'],
       tips=['Freeze uncooked patties between parchment.']),
  dict(id='tikka-masala', src='tikka-masala', course='Main', cuisine='indian', level='Medium', emoji='🍛', title='Curry Stand Chicken Tikka Masala',
       time=80, tags=['high-protein', 'gluten-free'],
       blurb='The most-loved tikka masala on Allrecipes: rich, warmly spiced, a little sweet.',
       steps=['Cook the onion in the ghee over medium about 5 minutes, add the garlic for 1 minute.',
              'Add the cumin, salt, ginger, cayenne, cinnamon and turmeric and fry 2 minutes.',
              'Add the tomato sauce, bring to a boil and simmer 10 minutes on low.',
              'Stir in the cream, sugar and paprika and simmer, stirring, 10–15 minutes until thick.',
              'Sear the chicken with the curry powder in the oil about 3 minutes.',
              'Add the chicken to the sauce and simmer about 30 minutes until cooked through. Adjust salt and sugar.'],
       tips=['Lighter swap: half-and-half or Greek yogurt (stirred in off the heat) instead of heavy cream.', 'Serve with basmati rice or naan.']),
  dict(id='tagine', src='tagine', course='Main', cuisine='nafrican', level='Easy', emoji='🫖', title='Easy Moroccan Chicken Tagine',
       time=60, tags=['high-protein', 'gluten-free', 'one-pot'],
       blurb='Chicken, butternut squash and chickpeas simmered with coriander and lemon.',
       steps=['Cook the chicken, onion and garlic in the oil over medium about 15 minutes, until browned.',
              'Add the squash, chickpeas, tomatoes with their juice, broth, carrot, sugar, lemon juice, salt, coriander and cayenne.',
              'Bring to a boil, then simmer about 30 minutes until the vegetables are tender.'],
       tips=['Serve over couscous or quinoa.']),
  dict(id='kofta', src='kofta', course='Main', cuisine='mideast', level='Medium', emoji='🍢', title='Kofta Kebabs',
       time=50, servesUnit='kebabs', wait='30 min chilling', tags=['high-protein', 'gluten-free', 'party'],
       blurb='Spiced lamb skewers with parsley, cinnamon and allspice.',
       steps=['Mash the garlic and salt into a paste.',
              'Mix it into the lamb with the onion, parsley and all the spices.',
              'Shape into 28 balls, press each onto a soaked skewer as a 2-inch oval, and chill at least 30 minutes.',
              'Grill over medium, turning, 5–6 minutes until browned and cooked through (145°F / 63°C).'],
       tips=['Serve with tzatziki or the cucumber raita, salad and warm pita.', 'Ground beef works too.']),
  dict(id='falafel', src='falafel', course='Main', cuisine='mideast', level='Medium', emoji='🧆', title="Sean's Falafel with Cucumber Sauce",
       time=60, tags=['vegetarian'],
       blurb='Crisp chickpea falafel in pita with a cool yogurt-dill sauce.',
       steps=['Mix the yogurt, cucumber, mayonnaise, dill, salt and pepper and chill at least 30 minutes.',
              'Mash the chickpeas by hand until thick and pasty.',
              'Blend the onion, parsley and garlic and stir into the chickpeas.',
              'Mix in the egg, spices, salt, lemon juice, baking powder and olive oil, then add bread crumbs until the mix holds together. Shape into small patties.',
              'Fry in about 1 inch of hot oil until brown on both sides.',
              'Serve 2 in each pita half with tomatoes and sauce.'],
       tips=['Lighter: brush with oil and bake at 400°F (200°C) about 20 minutes, flipping once.']),
  dict(id='bibimbap', src='bibimbap', course='Main', cuisine='korean', level='Medium', emoji='🍚', title='Vegetarian Bibimbap',
       time=50, tags=['vegetarian'],
       blurb='Sesame vegetables and seasoned rice topped with a runny egg.',
       steps=['Cook the carrot and zucchini in the sesame oil over medium about 5 minutes, then add the sprouts, bamboo shoots and mushrooms and cook until the carrots are tender.',
              'In the same pan stir the rice, green onions, soy sauce and pepper until hot.',
              'Fry the eggs in butter until the whites are set but the yolks are runny.',
              'Divide the rice, top with vegetables and an egg, and serve with sweet chili sauce.'],
       tips=['Use fresh vegetables instead of canned if you have them.', 'Gochujang is the classic sauce (some brands contain alcohol — check the label).']),
  # ── Sides ──
  dict(id='raita', src='raita', course='Side', cuisine='indian', level='Easy', emoji='🥒', title='Cucumber Raita',
       time=10, wait='a few hours chilling', tags=['vegetarian', 'gluten-free', 'no-cook'],
       blurb='Cool minty yogurt to go with curries and kebabs.',
       steps=['Stir the yogurt, cucumber, lemon juice, mint, sugar and salt together.',
              'Cover and chill a few hours or overnight for the best flavour.'],
       tips=['A pinch of toasted cumin is a nice addition.']),
  dict(id='street-corn', src='street-corn', course='Side', cuisine='mexican', level='Easy', emoji='🌽', title='Mexican Street Corn Salad',
       time=20, tags=['vegetarian', 'gluten-free', 'quick'],
       blurb='Warm corn with cotija, lime and chili — elote in a bowl.',
       steps=['Bring the corn and its liquid to a boil, then drain and put back in the pan.',
              'Stir in the cotija, mayonnaise, lime juice, butter and chili.',
              'Garnish with cilantro.'],
       tips=['Char the corn in a hot dry pan for a smokier taste.']),
  dict(id='roast-broccoli', src='roast-broccoli', course='Side', cuisine='namerican', level='Easy', emoji='🥦', title='Easy Roasted Broccoli',
       time=30, tags=['vegan', 'gluten-free'],
       blurb='Three ingredients, crispy edges, and the stalks too.',
       steps=['Heat the oven to 400°F (200°C).',
              'Cut the florets off; peel the stalk and slice it ¼ inch thick.',
              'Toss with olive oil, spread on a tray and season.',
              'Roast 18–20 minutes until tender and browned.'],
       tips=['Finish with lemon and a little parmesan.']),
  dict(id='sunomono', src='sunomono', course='Side', cuisine='japanese', level='Easy', emoji='🥒', title='Sunomono (Japanese Cucumber Salad)',
       time=15, tags=['vegan', 'gluten-free', 'no-cook', 'light'],
       blurb='Thin cucumber in a sweet-sour rice vinegar and ginger dressing.',
       steps=['Halve the cucumbers lengthwise, scoop out big seeds and slice very thinly.',
              'Mix the rice vinegar, sugar, ginger and salt.',
              'Toss the cucumber in the dressing and serve chilled.'],
       tips=['Add sesame seeds or a few cooked shrimp to make it a starter.']),
  dict(id='persian-rice', src='persian-rice', course='Side', cuisine='persian', level='Hard', emoji='🍚', title='Persian Rice with Potato Tahdig',
       time=70, tags=['vegetarian', 'gluten-free'],
       blurb='Fluffy saffron basmati over a golden, crispy potato crust.',
       steps=['Boil the salted water, add the rice and cook exactly 7 minutes. Drain.',
              'Heat the oil in a pot over medium-high, cover the bottom with potato slices, sprinkle with cumin and salt and fry until sizzling, 2–3 minutes.',
              'Pile the rice on top, lower the heat and dot with butter.',
              'Cover with paper towels under the lid and steam about 45 minutes, until fluffy and the potatoes are crisp.',
              'Grind the saffron, steep in the hot water, and stir a few spoons of rice into it until golden.',
              'Serve the rice topped with the saffron rice, the crispy potatoes around the edge, and parsley.'],
       tips=['Pairs beautifully with the kofta kebabs.']),
  # ── Desserts ──
  dict(id='mango-chia', src='chia-pudding', course='Dessert', cuisine='thai', level='Easy', emoji='🥥', title='Chia Coconut Pudding',
       time=10, wait='20 min – overnight', tags=['vegan', 'gluten-free', 'make-ahead'],
       blurb='Creamy coconut chia pudding topped with fresh strawberries.',
       steps=['Whisk both coconut milks with the agave, vanilla, cinnamon and salt, then stir in the chia seeds.',
              'Let it thicken at least 20 minutes, or cover and chill overnight.',
              'Stir and top with strawberries.'],
       tips=['Diced mango is delicious instead of strawberries.', 'Unsweetened coconut milk cuts the sugar.']),
  dict(id='baked-apples', src='baked-apples', course='Dessert', cuisine='namerican', level='Easy', emoji='🍎', title='Baked Apples',
       time=50, tags=['vegetarian', 'gluten-free'],
       blurb='Tart apples stuffed with cinnamon sugar and baked until tender.',
       steps=['Heat the oven to 350°F (175°C).',
              'Core each apple from the top, leaving the bottom 1½ inches intact.',
              'Mix the brown sugar, cinnamon and salt and fill each apple with about 2 tbsp.',
              'Stand them in an 8-inch dish, top each with a piece of butter, add ¼ inch boiling water and cover with foil.',
              'Bake 20 minutes, uncover and bake 20–25 minutes more until tender.'],
       tips=['Serve with plain Greek yogurt instead of ice cream.']),
  dict(id='berry-crisp', src='berry-crisp', course='Dessert', cuisine='namerican', level='Easy', emoji='🫐', title='Triple Berry Crisp',
       time=50, tags=['vegetarian', 'party'],
       blurb='Blackberries, raspberries and blueberries under a buttery oat crumble.',
       steps=['Heat the oven to 350°F (175°C).',
              'Gently toss the berries with the white sugar.',
              'Mix the flour, oats, brown sugar, cinnamon and nutmeg, then cut in the butter until crumbly.',
              'Press half the crumble into a 9×13 pan, add the berries and sprinkle over the rest.',
              'Bake 30–40 minutes until bubbling and golden.'],
       tips=['Serves 18 — a party dessert. For a lighter version, halve the butter and brown sugar and use only a topping layer.']),
  dict(id='fruit-salad', src='fruit-salad', course='Dessert', cuisine='namerican', level='Easy', emoji='🍓', title='Perfect Summer Fruit Salad',
       time=30, wait='3 hours chilling', tags=['vegan', 'gluten-free', 'make-ahead', 'party'],
       blurb='Layers of fresh fruit in a citrus-vanilla syrup.',
       steps=['Simmer the orange juice, lemon juice, brown sugar and both zests about 5 minutes, until slightly thick.',
              'Take off the heat, stir in the vanilla and cool.',
              'Layer the pineapple, strawberries, kiwi, bananas, oranges, grapes and blueberries in a glass bowl.',
              'Pour the cooled syrup over, cover and chill 3–4 hours.'],
       tips=['Use honey instead of brown sugar if you prefer.']),
  # ── Snacks ──
  dict(id='energy-bites', src='energy-bites', course='Snack', cuisine='namerican', level='Easy', emoji='🟤', title='No-Bake Energy Bites',
       time=15, servesUnit='bites', wait='1 hour freezing', tags=['vegetarian', 'no-cook', 'make-ahead'],
       blurb='Oats, peanut butter, flax and chocolate chips rolled into bites.',
       steps=['Stir the oats, chocolate chips, flax, peanut butter, honey and vanilla together.',
              'Roll into 24 balls and set on a tray.',
              'Freeze about 1 hour until firm. Keep in the fridge or freezer.'],
       tips=['Not for the dog — chocolate is toxic to dogs.']),
  dict(id='roast-chickpeas', src='roast-chickpeas', course='Snack', cuisine='namerican', level='Easy', emoji='🥜', title='Roasted Chickpeas',
       time=40, wait='2 hours drying', tags=['vegan', 'gluten-free', 'budget'],
       blurb='Smoky, crunchy chickpeas — a salty snack with fibre and protein.',
       steps=['Blot the chickpeas dry and leave them to air-dry 2 hours (this is what makes them crunchy).',
              'Heat the oven to 450°F (230°C).',
              'Toss with olive oil, then the paprika, pepper, cayenne, garlic powder and salt.',
              'Roast on a rimmed tray 30–40 minutes until crunchy, watching closely near the end.'],
       tips=['Best the day they are made.']),
]

DOG = [
  dict(id='dog-pumpkin-biscuits', src='dog-pumpkin', course='Treat', level='Easy', emoji='🦴', title='Peanut Butter & Pumpkin Dog Treats',
       time=55, servesUnit='treats', tags=['treat', 'baked', 'freezer'],
       blurb='The most-reviewed homemade dog treat on Allrecipes: crunchy and easy.',
       steps=['Heat the oven to 350°F (175°C).',
              'Mix the flour, eggs, pumpkin, peanut butter, salt and cinnamon.',
              'Knead by hand until it comes together, adding water a teaspoon at a time only if needed — it should be dry and stiff.',
              'Roll out about ½ inch thick, cut into ½-inch pieces and put them on a tray.',
              'Bake about 40 minutes until golden and crunchy. Cool before serving.'],
       tips=['Use plain canned pumpkin, not pie filling.', 'Peanut butter must be xylitol-free (also called birch sugar).']),
  dict(id='dog-pb-banana', src='dog-pb-banana', course='Treat', level='Easy', emoji='🍌', title='Peanut Butter & Banana Dog Biscuits',
       time=55, servesUnit='biscuits', tags=['treat', 'baked'],
       blurb='Top-rated banana biscuits — cut them into fun shapes.',
       steps=['Heat the oven to 300°F (150°C) and grease a tray.',
              'Mix the egg, peanut butter, banana and honey well, then stir in the flour and wheat germ.',
              'Roll ¼ inch thick on a floured board and cut into shapes. Brush with egg white.',
              'Bake about 30 minutes until dry and golden. Cool on a rack.'],
       tips=['Peanut butter must be xylitol-free.', 'Cut small for training-size pieces.']),
  dict(id='dog-sweet-potato', src='dog-sweet-potato', course='Treat', level='Easy', emoji='🍠', title='Super Simple Sweet Potato Dog Treats',
       time=60, servesUnit='treats', tags=['treat', 'baked'],
       blurb='Four ingredients, no peanut butter — good for sensitive dogs.',
       steps=['Heat the oven to 350°F (175°C).',
              'Prick the sweet potato and microwave about 6 minutes until soft. Cool, scoop out and mash about 1 cup.',
              'Mix in the flour, eggs and applesauce to make a dough.',
              'Roll ½ inch thick on a floured surface and cut into shapes or strips.',
              'Bake 35–45 minutes until crisp. Cool completely.'],
       tips=['Unsweetened applesauce only.']),
  dict(id='dog-liver', src='dog-liver', course='Treat', level='Medium', emoji='🎯', title='Homemade Dog Liver Bites',
       time=50, servesUnit='bites', tags=['treat', 'high-value', 'training', 'baked'],
       blurb='Soft, irresistible training rewards for recall practice.',
       steps=['Heat the oven to 325°F (165°C). Grease a 9-inch square dish and line it with parchment.',
              'Pulse the oats until fine and mix with the flour.',
              'Purée the livers, then blend in the eggs and the oil.',
              'Stir the liver mix into the oats and flour and spread in the dish.',
              'Bake 30–40 minutes until firm but not crisp. Cool and cut into 50 pieces.'],
       tips=['Liver is rich in vitamin A — a few pieces a day, not handfuls.', 'Freeze in bags and take out a day at a time.']),
  dict(id='dog-cake', src='dog-cake', course='Treat', level='Easy', emoji='🎂', title='Doggie Birthday Cake',
       time=65, servesUnit='slices', tags=['treat', 'baked', 'party'],
       blurb="A carrot and peanut butter cake for Oscar's big day.",
       skip=['vanilla extract'],
       steps=['Heat the oven to 350°F (175°C) and grease a 6-cup ring or bundt pan.',
              'Blend the egg, honey, peanut butter and oil.',
              'Stir in the carrots.',
              'Sift the flour with the baking soda and fold it in.',
              'Spoon into the pan and bake about 40 minutes, until a toothpick comes out clean. Cool 10 minutes, then turn out.'],
       tips=['We left out the original recipe’s vanilla extract — it is mostly alcohol, which dogs should not have.',
             'Peanut butter must be xylitol-free.', 'A thin slice is plenty — it is a treat, not a meal.']),
]

def js(v):
    return json.dumps(v, ensure_ascii=False)

def entry(m, kind):
    s = SRC[m['src']]
    ing = [parse(x) for x in s['ing'] if not any(k in x for k in m.get('skip', []))]
    ing = [[q, u, t.replace('rice wine vinegar', 'rice vinegar')] for q, u, t in ing]
    serves = first_int(s['yield']) or 1
    kcal = first_int(s.get('kcal'))
    protein = first_int(s.get('protein'))
    out = {'id': m['id'], 'kind': kind, 'course': m['course']}
    if m.get('cuisine'): out['cuisine'] = m['cuisine']
    out.update({'level': m['level'], 'emoji': m['emoji'], 'title': m['title'], 'time': m['time']})
    if m.get('wait'): out['wait'] = m['wait']
    out['serves'] = serves
    if m.get('servesUnit'): out['servesUnit'] = m['servesUnit']
    out['tags'] = m['tags']
    out['blurb'] = m['blurb']
    if kcal: out['kcal'] = kcal
    if protein and kind == 'human': out['protein'] = protein
    if kcal and m.get('servesUnit'): out['kcalUnit'] = m['servesUnit'].rstrip('s')
    out['rating'] = s['rating']; out['ratings'] = s['count']
    out['source'] = {'site': 'Allrecipes', 'name': s['name'].strip(), 'url': s['url']}
    out['ingredients'] = ing
    out['steps'] = m['steps']
    out['tips'] = m.get('tips', [])
    lines = ['  { ' + ', '.join(f'{k}: {js(v)}' for k, v in out.items() if k not in ('ingredients', 'steps', 'tips', 'source')) + ',',
             f"    source: {js(out['source'])},",
             '    ingredients: [' + ', '.join(js(i) for i in ing) + '],',
             '    steps: ' + js(out['steps']) + ',',
             '    tips: ' + js(out['tips']) + ' },']
    return '\n'.join(lines)

blocks = ['  /* ───── Reviewed recipes (built by build_rated.py from .sources.json — edit there) ───── */']
blocks += [entry(m, 'human') for m in R]
blocks += ['', '  /* ───── Reviewed dog treats ───── */']
blocks += [entry(m, 'dog') for m in DOG]
block = '\n'.join(blocks)

p = os.path.join(HERE, 'data.js')
d = open(p).read()
START, END = '  /* RATED:START */', '  /* RATED:END */'
d = d[:d.index(START) + len(START)] + '\n' + block + '\n' + d[d.index(END):]
open(p, 'w').write(d)
print(f'wrote {len(R)} human + {len(DOG)} dog reviewed recipes')
